\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ------------------------------------------------- envío con tarifa cotizada
do $$
declare
    v_cliente uuid := '11111111-1111-1111-1111-111111111111';
    v_otro    uuid := '22222222-2222-2222-2222-222222222222';
    v_quote   uuid;
    v_ajena   uuid;
    v_vieja   uuid;
    r         jsonb;
    v_envio   constant jsonb := '{"fullName":"Juan Pérez","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb;
    v_rates   constant jsonb := '[{"id":"r-estafeta","carrier":"Estafeta","service":"Terrestre","amount":189.50,"days":3},
                                  {"id":"r-dhl","carrier":"DHL","service":"Express","amount":320,"days":1}]'::jsonb;
begin
    perform set_config('test.uid', v_cliente::text, false);
    update public.products set stock = 100;

    -- Las cotizaciones las escribe la Edge Function con service_role.
    insert into public.shipping_quotes (user_id, provider, destination_zip, package, rates, expires_at)
    values (v_cliente, 'skydropx', '01000', '{"weight_g":1200}'::jsonb, v_rates, now() + interval '1 day')
    returning id into v_quote;
    insert into public.shipping_quotes (user_id, provider, destination_zip, package, rates, expires_at)
    values (v_otro, 'skydropx', '01000', '{}'::jsonb, v_rates, now() + interval '1 day')
    returning id into v_ajena;
    insert into public.shipping_quotes (user_id, provider, destination_zip, package, rates, expires_at)
    values (v_cliente, 'skydropx', '01000', '{}'::jsonb, v_rates, now() - interval '1 minute')
    returning id into v_vieja;

    -- 1. La tarifa elegida se cobra tal cual la guardó la Edge Function.
    r := public.create_order('[{"product_id": 1, "quantity": 2}]'::jsonb, v_envio, '{}'::jsonb,
            jsonb_build_object('quote_id', v_quote, 'rate_id', 'r-estafeta'));
    perform pruebas.afirmar((r->>'shipping_cost')::numeric = 189.50, 'cobra la tarifa cotizada (189.50)');
    perform pruebas.afirmar((r->>'total')::numeric = 2000 + 189.50, 'el total suma subtotal + tarifa');
    perform pruebas.afirmar(r->'shipping_quote'->'rate'->>'carrier' = 'Estafeta', 'guarda la tarifa elegida en el pedido');
    perform pruebas.afirmar(r->>'payment_provider' = 'spei', 'sin pasarela indicada, el pedido es SPEI');

    -- 2. El envío gratis se respeta aunque haya tarifa: la absorbe la tienda.
    r := public.create_order('[{"product_id": 1, "quantity": 6}]'::jsonb, v_envio, '{}'::jsonb,
            jsonb_build_object('quote_id', v_quote, 'rate_id', 'r-dhl'));
    perform pruebas.afirmar((r->>'shipping_cost')::numeric = 0, 'por encima del umbral el envío cotizado sale gratis');
    perform pruebas.afirmar(r->'shipping_quote'->'rate'->>'id' = 'r-dhl', 'pero la tarifa queda guardada para generar la guía');

    -- 3. La pasarela se registra.
    r := public.create_order('[{"product_id": 1, "quantity": 1}]'::jsonb, v_envio, '{"provider":"mercadopago"}'::jsonb, null);
    perform pruebas.afirmar(r->>'payment_provider' = 'mercadopago', 'registra la pasarela mercadopago');
    perform pruebas.afirmar(r->'payment_info'->>'method' = 'Mercado Pago', 'el método de pago dice Mercado Pago');

    -- 4. Lo que rechaza.
    begin
        perform public.create_order('[{"product_id": 1, "quantity": 1}]'::jsonb, v_envio, '{}'::jsonb,
            jsonb_build_object('quote_id', v_ajena, 'rate_id', 'r-dhl'));
        raise exception 'debió rechazar la cotización ajena';
    exception when others then
        perform pruebas.afirmar(SQLERRM like '%ya no es válida%', 'rechaza la cotización de otra persona');
    end;

    begin
        perform public.create_order('[{"product_id": 1, "quantity": 1}]'::jsonb, v_envio, '{}'::jsonb,
            jsonb_build_object('quote_id', v_vieja, 'rate_id', 'r-dhl'));
        raise exception 'debió rechazar la cotización caducada';
    exception when others then
        perform pruebas.afirmar(SQLERRM like '%caducó%', 'rechaza la cotización caducada');
    end;

    begin
        perform public.create_order('[{"product_id": 1, "quantity": 1}]'::jsonb,
            v_envio || '{"zip":"64000"}'::jsonb, '{}'::jsonb,
            jsonb_build_object('quote_id', v_quote, 'rate_id', 'r-dhl'));
        raise exception 'debió rechazar el C.P. distinto';
    exception when others then
        perform pruebas.afirmar(SQLERRM like '%otro código postal%', 'rechaza si el C.P. no es el cotizado');
    end;

    begin
        perform public.create_order('[{"product_id": 1, "quantity": 1}]'::jsonb, v_envio, '{}'::jsonb,
            jsonb_build_object('quote_id', v_quote, 'rate_id', 'r-inventada'));
        raise exception 'debió rechazar la tarifa inexistente';
    exception when others then
        perform pruebas.afirmar(SQLERRM like '%ya no está disponible%', 'rechaza una tarifa que no está en la cotización');
    end;

    -- 5. Sin tarifa, la regla fija de siempre.
    r := public.create_order('[{"product_id": 1, "quantity": 1}]'::jsonb, v_envio, '{}'::jsonb, null);
    perform pruebas.afirmar((r->>'shipping_cost')::numeric = 250, 'sin cotización aplica la tarifa fija');
end $$;

-- ------------------------------------------------------ confirmación del pago
do $$
declare
    v_cliente uuid := '11111111-1111-1111-1111-111111111111';
    r jsonb;
    v_id uuid;
    v_envio constant jsonb := '{"fullName":"Juan Pérez","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb;
begin
    perform set_config('test.uid', v_cliente::text, false);
    r := public.create_order('[{"product_id": 1, "quantity": 1}]'::jsonb, v_envio, '{"provider":"mercadopago"}'::jsonb, null);
    v_id := (r->>'id')::uuid;

    begin
        perform public.marcar_pedido_pagado(v_id, 'mercadopago', 'pago-1', 1.00);
        raise exception 'debió rechazar el monto distinto';
    exception when others then
        perform pruebas.afirmar(SQLERRM like '%no coincide%', 'rechaza un pago por un monto distinto al total');
    end;

    r := public.marcar_pedido_pagado(v_id, 'mercadopago', 'pago-1', (r->>'total')::numeric);
    perform pruebas.afirmar(r->>'status' = 'Pagado', 'marca el pedido como Pagado');
    perform pruebas.afirmar(r->>'paid_at' is not null, 'anota la fecha de pago');
    perform pruebas.afirmar(r->>'payment_reference' = 'pago-1', 'guarda la referencia de la pasarela');

    -- Mercado Pago reintenta: la segunda notificación no cambia nada ni falla.
    r := public.marcar_pedido_pagado(v_id, 'mercadopago', 'pago-1', (r->>'total')::numeric);
    perform pruebas.afirmar((r->>'ya_estaba_pagado')::boolean, 'la segunda notificación es inocua');

    -- Un pedido cancelado no se puede marcar como pagado por un reintento tardío.
    r := public.create_order('[{"product_id": 1, "quantity": 1}]'::jsonb, v_envio, '{"provider":"mercadopago"}'::jsonb, null);
    update public.orders set status = 'Cancelado' where id = (r->>'id')::uuid;
    begin
        perform public.marcar_pedido_pagado((r->>'id')::uuid, 'mercadopago', 'pago-2', (r->>'total')::numeric);
        raise exception 'debió rechazar el pedido cancelado';
    exception when others then
        perform pruebas.afirmar(SQLERRM like '%Cancelado%', 'no marca como pagado un pedido cancelado');
    end;

    perform pruebas.afirmar(
        not has_function_privilege('anon', 'public.marcar_pedido_pagado(uuid,text,text,numeric)', 'execute')
        and not has_function_privilege('authenticated', 'public.marcar_pedido_pagado(uuid,text,text,numeric)', 'execute'),
        'ni anon ni un cliente pueden marcar pedidos como pagados');
    perform pruebas.afirmar(
        has_function_privilege('service_role', 'public.marcar_pedido_pagado(uuid,text,text,numeric)', 'execute'),
        'sólo la service_role (el webhook) puede');
end $$;

-- ------------------------------------------------------------- notificaciones
do $$
declare
    v_cliente uuid := '11111111-1111-1111-1111-111111111111';
    r jsonb;
    v_id uuid;
    v_antes int;
    v_llamada record;
    v_envio constant jsonb := '{"fullName":"Juan Pérez","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb;
begin
    perform public.configurar_notificaciones('https://ref.supabase.co/functions/v1/notificar-pedido', 'secreto-123');
    perform set_config('test.uid', v_cliente::text, false);

    select count(*) into v_antes from supabase_functions.llamadas;
    r := public.create_order('[{"product_id": 1, "quantity": 1}]'::jsonb, v_envio, '{}'::jsonb, null);
    v_id := (r->>'id')::uuid;

    select * into v_llamada from supabase_functions.llamadas order by id desc limit 1;
    perform pruebas.afirmar((select count(*) from supabase_functions.llamadas) = v_antes + 1, 'un pedido nuevo dispara una notificación');
    perform pruebas.afirmar(v_llamada.url = 'https://ref.supabase.co/functions/v1/notificar-pedido', 'a la URL configurada');
    perform pruebas.afirmar(v_llamada.headers->>'x-thaiger-secret' = 'secreto-123', 'con el secreto compartido en la cabecera');
    perform pruebas.afirmar(v_llamada.payload->>'type' = 'INSERT' and (v_llamada.payload->'record'->>'id')::uuid = v_id, 'con el pedido completo');

    -- Editar algo que no es el estatus no manda correo.
    update public.orders set shipping_info = shipping_info || '{"notes":"tocar el timbre"}'::jsonb where id = v_id;
    perform pruebas.afirmar((select count(*) from supabase_functions.llamadas) = v_antes + 1, 'cambiar la dirección no notifica');

    update public.orders set status = 'Enviado' where id = v_id;
    select * into v_llamada from supabase_functions.llamadas order by id desc limit 1;
    perform pruebas.afirmar((select count(*) from supabase_functions.llamadas) = v_antes + 2, 'cambiar el estatus sí notifica');
    perform pruebas.afirmar(v_llamada.payload->>'type' = 'UPDATE'
        and v_llamada.payload->'record'->>'status' = 'Enviado'
        and v_llamada.payload->'old_record'->>'status' = 'Pago Pendiente', 'con el estatus nuevo y el anterior');

    -- Volver a configurar reemplaza los disparadores en vez de duplicarlos.
    perform public.configurar_notificaciones('https://ref.supabase.co/functions/v1/notificar-pedido', 'secreto-456');
    perform pruebas.afirmar((select count(*) from pg_trigger where tgname like 'notificar_pedido_%') = 2, 'reconfigurar no duplica los disparadores');
end $$;

-- --------------------------------------------- RLS de las cotizaciones
set role authenticated;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
do $$
begin
    perform pruebas.afirmar(
        (select count(*) from public.shipping_quotes where user_id <> '11111111-1111-1111-1111-111111111111') = 0,
        'un cliente sólo ve sus propias cotizaciones');
    begin
        insert into public.shipping_quotes (user_id, provider, destination_zip, package, rates, expires_at)
        values ('11111111-1111-1111-1111-111111111111', 'skydropx', '01000', '{}'::jsonb, '[{"id":"x","amount":1}]'::jsonb, now() + interval '1 day');
        raise exception 'un cliente NO debería poder inventarse una cotización';
    exception when insufficient_privilege then
        perform pruebas.afirmar(true, 'un cliente no puede inventarse una cotización de $1');
    end;
end $$;
reset role;
