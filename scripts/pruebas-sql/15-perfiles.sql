\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ---------------------------------------------- el perfil nace con la cuenta
do $$
declare
    v_nueva uuid := '33333333-3333-3333-3333-333333333333';
    v_perfil public.users;
begin
    perform set_config('test.uid', '', false);

    insert into auth.users (id, email, raw_user_meta_data)
    values (v_nueva, 'ana@ejemplo.com', '{"name":"Ana Pérez"}'::jsonb);

    select * into v_perfil from public.users where id = v_nueva;
    perform pruebas.afirmar(found, 'registrarse crea el perfil en public.users');
    perform pruebas.afirmar(v_perfil.role = 'user', 'el perfil nuevo nace con rol user');
    perform pruebas.afirmar(v_perfil.name = 'Ana Pérez', 'con el nombre que se dio al registrarse');
    perform pruebas.afirmar(v_perfil.email = 'ana@ejemplo.com', 'y con su correo');

    insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'sin@nombre.com');
    perform pruebas.afirmar(
        (select name from public.users where id = '44444444-4444-4444-4444-444444444444') = 'Usuario Thaiger',
        'sin nombre, queda «Usuario Thaiger»');
end $$;

-- ----------------------------------- el SQL Editor sí puede nombrar un admin
do $$
begin
    -- Sin sesión de usuario: así corre el SQL Editor del panel.
    perform set_config('test.uid', '', false);
    update public.users set role = 'admin' where email = 'ana@ejemplo.com';

    perform pruebas.afirmar(
        (select role from public.users where email = 'ana@ejemplo.com') = 'admin',
        'el update del SQL Editor nombra administrador (antes no hacía nada)');

    update public.users set role = 'user' where email = 'ana@ejemplo.com';
end $$;

-- ------------------------------------------- pero un cliente no se asciende
set role authenticated;
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
do $$
begin
    update public.users set role = 'admin' where id = '33333333-3333-3333-3333-333333333333';
    perform pruebas.afirmar(
        (select role from public.users where id = '33333333-3333-3333-3333-333333333333') = 'user',
        'un cliente con sesión no puede ascenderse a admin');

    update public.users set name = 'Ana P.' where id = '33333333-3333-3333-3333-333333333333';
    perform pruebas.afirmar(
        (select name from public.users where id = '33333333-3333-3333-3333-333333333333') = 'Ana P.',
        'pero sí puede cambiar su nombre');
end $$;
reset role;

-- ------------------------------------------- y un admin sí cambia roles ajenos
set role authenticated;
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
do $$
begin
    update public.users set role = 'admin' where id = '33333333-3333-3333-3333-333333333333';
    perform pruebas.afirmar(
        (select role from public.users where id = '33333333-3333-3333-3333-333333333333') = 'admin',
        'un admin con sesión sí puede cambiar el rol de otra cuenta');
end $$;
reset role;

-- --------------------------------------------- las cuentas previas se reparan
do $$
begin
    perform set_config('test.uid', '', false);
    -- Una cuenta que existía antes del disparador y se quedó sin perfil.
    alter table auth.users disable trigger crear_perfil_de_usuario;
    insert into auth.users (id, email, raw_user_meta_data)
    values ('55555555-5555-5555-5555-555555555555', 'vieja@ejemplo.com', '{"name":"Cuenta Vieja"}'::jsonb);
    alter table auth.users enable trigger crear_perfil_de_usuario;

    perform pruebas.afirmar(
        not exists (select 1 from public.users where id = '55555555-5555-5555-5555-555555555555'),
        'escenario: una cuenta previa sin perfil');
end $$;

-- Volver a ejecutar el esquema hace de reparación: el backfill la recoge.
\ir ../setup_supabase.sql

do $$
begin
    perform pruebas.afirmar(
        (select name from public.users where id = '55555555-5555-5555-5555-555555555555') = 'Cuenta Vieja',
        'reejecutar el esquema crea el perfil de las cuentas que no lo tenían');
    perform pruebas.afirmar(
        (select role from public.users where id = '22222222-2222-2222-2222-222222222222') = 'admin',
        'y no toca los perfiles que ya existían (el admin sigue siendo admin)');
end $$;

-- Limpieza: estas cuentas no deben estorbar a las pruebas siguientes.
delete from auth.users where id in (
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555');
delete from public.users where id in (
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555');
