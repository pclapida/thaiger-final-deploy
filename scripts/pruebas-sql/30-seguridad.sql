\set ON_ERROR_STOP on
set client_min_messages = notice;

-- Los privilegios de tabla de anon/authenticated se conceden en 10-datos.sql.

do $$
declare v_err text;
begin
    -- 1. La RPC vieja ya no existe.
    perform pruebas.afirmar(
        not exists (select 1 from pg_proc where proname = 'decrement_stock'),
        'decrement_stock quedó eliminada');

    -- 2. create_order no es ejecutable por anon (la anon key va en el bundle).
    perform pruebas.afirmar(
        not has_function_privilege('anon', 'public.create_order(jsonb,jsonb,jsonb,jsonb)', 'execute'),
        'anon NO puede ejecutar create_order');
    perform pruebas.afirmar(
        has_function_privilege('authenticated', 'public.create_order(jsonb,jsonb,jsonb,jsonb)', 'execute'),
        'authenticated sí puede ejecutar create_order');
end $$;

-- 3. Un cliente con sesión NO puede insertar un pedido a mano.
set role authenticated;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);

do $$
declare v_err text;
begin
    begin
        insert into public.orders (user_id, status, subtotal, shipping_cost, total, tier, shipping_info, payment_info)
        values ('11111111-1111-1111-1111-111111111111', 'Pagado', 1, 0, 1, 3, '{}'::jsonb, '{}'::jsonb);
        raise exception 'el insert directo NO debería haber pasado';
    exception when insufficient_privilege then
        perform pruebas.afirmar(true, 'un cliente no puede insertar un pedido de $1 marcado como pagado');
    end;

    -- 4. Tampoco puede escribir líneas de pedido a mano.
    begin
        insert into public.order_items (order_id, product_id, product_name, quantity, price_at_purchase)
        values ((select id from public.orders limit 1), 1, 'Regalo', 1, 0);
        raise exception 'el insert directo de líneas NO debería haber pasado';
    exception when insufficient_privilege then
        perform pruebas.afirmar(true, 'un cliente no puede añadir líneas a un pedido');
    end;

    -- 5. Ni cambiar el estatus de su propio pedido a "Pagado".
    begin
        update public.orders set status = 'Pagado'
         where user_id = '11111111-1111-1111-1111-111111111111';
        perform pruebas.afirmar(not found, 'un cliente no puede marcar su pedido como pagado');
    exception when insufficient_privilege then
        perform pruebas.afirmar(true, 'un cliente no puede marcar su pedido como pagado');
    end;

    -- 6. Ni tocar el catálogo.
    begin
        update public.products set price1 = 1 where id = 1;
        perform pruebas.afirmar(not found, 'un cliente no puede cambiar precios del catálogo');
    exception when insufficient_privilege then
        perform pruebas.afirmar(true, 'un cliente no puede cambiar precios del catálogo');
    end;

    -- 7. Pero sí puede comprar por la puerta buena.
    perform public.create_order('[{"product_id": 3, "quantity": 1}]'::jsonb,
        '{"fullName":"Juan Pérez","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb,
        '{}'::jsonb);
    perform pruebas.afirmar(true, 'el camino legítimo (create_order) sigue funcionando con sesión');

    -- 8. Y sólo ve sus propios pedidos.
    perform pruebas.afirmar(
        (select count(*) from public.orders where user_id <> '11111111-1111-1111-1111-111111111111') = 0,
        'un cliente sólo ve sus pedidos');
end $$;

reset role;

-- 9. Storage: un cliente cualquiera ya no escribe en el bucket del catálogo.
insert into storage.buckets (id, name, public) values ('product-images','product-images',true) on conflict do nothing;
grant select, insert, update, delete on storage.objects to anon, authenticated;

set role authenticated;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
do $$
begin
    begin
        insert into storage.objects (bucket_id, name) values ('product-images', 'pirata.png');
        raise exception 'no debería poder subir al bucket del catálogo';
    exception when insufficient_privilege then
        perform pruebas.afirmar(true, 'un cliente no sube fotos al catálogo');
    end;

    -- Su propio avatar, dentro de su carpeta, sí.
    insert into storage.objects (bucket_id, name)
    values ('avatars', '11111111-1111-1111-1111-111111111111/foto.png');
    perform pruebas.afirmar(true, 'cada quien sube su avatar en su carpeta');

    begin
        insert into storage.objects (bucket_id, name)
        values ('avatars', '22222222-2222-2222-2222-222222222222/suplantada.png');
        raise exception 'no debería poder escribir en la carpeta de otra persona';
    exception when insufficient_privilege then
        perform pruebas.afirmar(true, 'nadie escribe en la carpeta de avatar de otra persona');
    end;
end $$;
reset role;

-- 10. Rol «catalogo»: toca productos y sus fotos, y nada más.
do $$
begin
    perform set_config('test.uid', '', false);
    insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'catalogo@thaiger.mx');
    update public.users set role = 'catalogo' where id = '66666666-6666-6666-6666-666666666666';

    begin
        update public.users set role = 'superadmin' where id = '66666666-6666-6666-6666-666666666666';
        raise exception 'un rol inventado no debería guardarse';
    exception when check_violation then
        perform pruebas.afirmar(true, 'la base rechaza roles que no existen');
    end;
end $$;

set role authenticated;
select set_config('test.uid', '66666666-6666-6666-6666-666666666666', false);
do $$
declare v_filas int;
begin
    insert into public.products (id, name, brand, category, price1, price2, price3, stock)
    values (900, 'Alta de catálogo', 'THAIGER LABS', 'Proteínas', 700, 650, 600, 4);
    update public.products set stock = 9 where id = 900;
    perform pruebas.afirmar(
        (select stock from public.products where id = 900) = 9,
        'una cuenta de catálogo da de alta y edita productos');
    delete from public.products where id = 900;
    perform pruebas.afirmar(
        not exists (select 1 from public.products where id = 900),
        'y puede borrarlos');

    insert into storage.objects (bucket_id, name) values ('product-images', 'nuevo/foto.webp');
    perform pruebas.afirmar(true, 'una cuenta de catálogo sube fotos de producto');

    update public.settings set value = '{}'::jsonb where id = 'site';
    get diagnostics v_filas = row_count;
    perform pruebas.afirmar(v_filas = 0, 'una cuenta de catálogo no cambia los ajustes (ni la CLABE)');

    update public.orders set status = 'Cancelado';
    get diagnostics v_filas = row_count;
    perform pruebas.afirmar(v_filas = 0, 'ni el estatus de los pedidos');
    perform pruebas.afirmar(
        (select count(*) from public.orders) = 0,
        'ni ve los pedidos de la tienda');
    perform pruebas.afirmar(
        (select count(*) from public.users) = 1,
        'ni la lista de cuentas (sólo su propio perfil)');

    update public.users set role = 'admin' where id = '66666666-6666-6666-6666-666666666666';
    perform pruebas.afirmar(
        (select role from public.users where id = '66666666-6666-6666-6666-666666666666') = 'catalogo',
        'ni se asciende a admin');
end $$;
reset role;

-- 11. Un perfil borrado no se puede volver a insertar como admin.
--     (Existía la política «Cada quien crea su perfil» y proteger_rol sólo
--     vigila UPDATE: la cuenta podía reinsertarse con role = 'admin'.)
delete from public.users where id = '66666666-6666-6666-6666-666666666666';
set role authenticated;
select set_config('test.uid', '66666666-6666-6666-6666-666666666666', false);
do $$
begin
    begin
        insert into public.users (id, email, name, role)
        values ('66666666-6666-6666-6666-666666666666', 'catalogo@thaiger.mx', 'Yo', 'admin');
        raise exception 'no debería poder crear su propio perfil de admin';
    exception when insufficient_privilege then
        perform pruebas.afirmar(true, 'nadie inserta su propio perfil (ni como admin)');
    end;
end $$;
reset role;
delete from storage.objects where name = 'nuevo/foto.webp';
