\set ON_ERROR_STOP on
set client_min_messages = warning;

-- ---------------------------------------------------------------- datos base
insert into auth.users (id, email) values
    ('11111111-1111-1111-1111-111111111111', 'cliente@thaiger.mx'),
    ('22222222-2222-2222-2222-222222222222', 'admin@thaiger.mx');

-- Los perfiles ya los creó el disparador al insertar en auth.users; aquí sólo
-- se les da nombre y se nombra al admin (sin sesión, como el SQL Editor).
insert into public.users (id, email, name, role) values
    ('11111111-1111-1111-1111-111111111111', 'cliente@thaiger.mx', 'Cliente', 'user'),
    ('22222222-2222-2222-2222-222222222222', 'admin@thaiger.mx', 'Admin', 'admin')
on conflict (id) do update set name = excluded.name, role = excluded.role;

insert into public.products (id, name, brand, category, price1, price2, price3, stock, is_on_sale, discount_percent) values
    (1, 'Proteína', 'THAIGER LABS', 'Proteínas', 1000, 900, 800, 10, false, 0),
    (2, 'Creatina',  'IRON PEAK',    'Creatina',  500, 450, 400,  3, true, 20),
    (3, 'Sin nivel', 'PURE CORE',    'Salud',     200,   0,   0,  5, false, 0);

update public.settings set value = jsonb_build_object(
    'tiers',    jsonb_build_object('tier2From', 10000, 'tier3From', 20000),
    'shipping', jsonb_build_object('freeFrom', 5000, 'cost', 250)
) where id = 'site';

create or replace function pruebas.afirmar(condicion boolean, etiqueta text) returns void
language plpgsql as $$
begin
    if condicion then
        raise notice '  ok   %', etiqueta;
    else
        raise exception 'FALLA: %', etiqueta;
    end if;
end;
$$;

-- Supabase concede los privilegios de tabla a anon/authenticated y deja que la
-- RLS decida. Sin esto, las pruebas de seguridad pasarían por el motivo
-- equivocado ("permiso denegado" en vez de "la política lo rechazó").
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant usage on schema pruebas to anon, authenticated;
grant execute on all functions in schema pruebas to anon, authenticated;
