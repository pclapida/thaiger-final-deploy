\set ON_ERROR_STOP on
set client_min_messages = warning;

-- ---------------------------------------------------------------- datos base
insert into auth.users (id, email) values
    ('11111111-1111-1111-1111-111111111111', 'cliente@thaiger.mx'),
    ('22222222-2222-2222-2222-222222222222', 'admin@thaiger.mx');

insert into public.users (id, email, name, role) values
    ('11111111-1111-1111-1111-111111111111', 'cliente@thaiger.mx', 'Cliente', 'user'),
    ('22222222-2222-2222-2222-222222222222', 'admin@thaiger.mx', 'Admin', 'admin');

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
