\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
declare
    v_cliente uuid := '11111111-1111-1111-1111-111111111111';
    r jsonb;
    v_stock int;
    v_err text;
begin
    perform set_config('test.uid', v_cliente::text, false);

    -- 1. Nivel 1 + envío: 2 x 1000 = 2000, por debajo del envío gratis.
    r := public.create_order(
        '[{"product_id": 1, "quantity": 2}]'::jsonb,
        '{"fullName":"Juan Pérez","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb,
        '{"concepto":"TH-1234","banco":"BANCO DEMO"}'::jsonb
    );
    perform pruebas.afirmar((r->>'subtotal')::numeric = 2000, 'nivel 1: subtotal 2000');
    perform pruebas.afirmar((r->>'shipping_cost')::numeric = 250, 'nivel 1: envío 250');
    perform pruebas.afirmar((r->>'total')::numeric = 2250, 'nivel 1: total 2250');
    perform pruebas.afirmar((r->>'tier')::int = 1, 'nivel 1: tier = 1');
    perform pruebas.afirmar(r->>'status' = 'Pago Pendiente', 'el estatus lo fija el servidor');
    perform pruebas.afirmar(jsonb_array_length(r->'order_items') = 1, 'devuelve las líneas del pedido');

    -- 2. El inventario baja en la misma operación.
    select stock into v_stock from public.products where id = 1;
    perform pruebas.afirmar(v_stock = 8, 'el stock bajó de 10 a 8 sin llamada aparte');

    -- 3. Oferta del 20% sobre el precio del nivel: 500 -> 400.
    r := public.create_order(
        '[{"product_id": 2, "quantity": 1}]'::jsonb,
        '{"fullName":"Juan Pérez","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb,
        '{}'::jsonb
    );
    perform pruebas.afirmar((r->>'subtotal')::numeric = 400, 'oferta 20% aplicada sobre el nivel');
    perform pruebas.afirmar((r->'order_items'->0->>'price_at_purchase')::numeric = 400, 'la línea guarda el precio cobrado');
    perform pruebas.afirmar(r->'payment_info'->>'concepto' <> '', 'genera concepto si el cliente no manda uno');

    -- 4. Nivel 2 desde 10,000 de lista: 10 x 1000 = 10000 -> price2 = 900.
    update public.products set stock = 100 where id = 1;
    r := public.create_order(
        '[{"product_id": 1, "quantity": 10}]'::jsonb,
        '{"fullName":"Juan Pérez","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb,
        '{}'::jsonb
    );
    perform pruebas.afirmar((r->>'tier')::int = 2, 'a 10,000 de lista sube a nivel 2');
    perform pruebas.afirmar((r->>'subtotal')::numeric = 9000, 'nivel 2 cobra price2');
    perform pruebas.afirmar((r->>'shipping_cost')::numeric = 0, 'envío gratis por encima de 5,000');

    -- 5. Nivel 3 desde 20,000: 20 x 1000 -> price3 = 800.
    r := public.create_order(
        '[{"product_id": 1, "quantity": 20}]'::jsonb,
        '{"fullName":"Juan Pérez","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb,
        '{}'::jsonb
    );
    perform pruebas.afirmar((r->>'tier')::int = 3, 'a 20,000 de lista sube a nivel 3');
    perform pruebas.afirmar((r->>'subtotal')::numeric = 16000, 'nivel 3 cobra price3');

    -- 6. Un producto sin price2/price3 cae al precio público, no a cero.
    r := public.create_order(
        '[{"product_id": 1, "quantity": 20}, {"product_id": 3, "quantity": 1}]'::jsonb,
        '{"fullName":"Juan Pérez","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb,
        '{}'::jsonb
    );
    perform pruebas.afirmar((r->>'tier')::int = 3, 'el carrito mixto sigue en nivel 3');
    perform pruebas.afirmar((r->>'subtotal')::numeric = 16200, 'sin price3 se cobra el precio público (200), no 0');
end $$;

-- ------------------------------------------------------------- lo que rechaza
do $$
declare
    v_cliente uuid := '11111111-1111-1111-1111-111111111111';
    v_err text;
    v_pedidos_antes int;
    v_pedidos_despues int;
begin
    perform set_config('test.uid', v_cliente::text, false);
    select count(*) into v_pedidos_antes from public.orders;

    begin
        perform public.create_order('[{"product_id": 2, "quantity": 99}]'::jsonb,
            '{"fullName":"Juan","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb, '{}'::jsonb);
        raise exception 'debió rechazar la sobreventa';
    exception when others then
        v_err := SQLERRM;
        perform pruebas.afirmar(v_err like '%Sólo quedan%', 'rechaza más unidades de las que hay: ' || v_err);
    end;

    begin
        perform public.create_order('[{"product_id": 1, "quantity": 0}]'::jsonb,
            '{"fullName":"Juan","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb, '{}'::jsonb);
        raise exception 'debió rechazar la cantidad cero';
    exception when others then
        perform pruebas.afirmar(SQLERRM like '%cantidad inválida%', 'rechaza cantidad cero');
    end;

    begin
        perform public.create_order('[]'::jsonb,
            '{"fullName":"Juan","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb, '{}'::jsonb);
        raise exception 'debió rechazar el carrito vacío';
    exception when others then
        perform pruebas.afirmar(SQLERRM like '%carrito está vacío%', 'rechaza el carrito vacío');
    end;

    begin
        perform public.create_order('[{"product_id": 1, "quantity": 1}]'::jsonb,
            '{"fullName":"Sólo el nombre"}'::jsonb, '{}'::jsonb);
        raise exception 'debió rechazar la dirección incompleta';
    exception when others then
        perform pruebas.afirmar(SQLERRM like '%dirección de envío%', 'rechaza la dirección incompleta');
    end;

    begin
        perform public.create_order('[{"product_id": 99999, "quantity": 1}]'::jsonb,
            '{"fullName":"Juan","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb, '{}'::jsonb);
        raise exception 'debió rechazar el producto inexistente';
    exception when others then
        perform pruebas.afirmar(SQLERRM like '%ya no está disponible%', 'rechaza un producto que ya no existe');
    end;

    -- Sin sesión no se compra.
    perform set_config('test.uid', '', false);
    begin
        perform public.create_order('[{"product_id": 1, "quantity": 1}]'::jsonb,
            '{"fullName":"Juan","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb, '{}'::jsonb);
        raise exception 'debió exigir sesión';
    exception when others then
        perform pruebas.afirmar(SQLERRM like '%iniciar sesión%', 'sin sesión no se puede comprar');
    end;

    select count(*) into v_pedidos_despues from public.orders;
    perform pruebas.afirmar(v_pedidos_antes = v_pedidos_despues, 'ningún rechazo dejó un pedido a medias');
end $$;

-- ----------------------------------------- una lista mixta no deja huérfanos
do $$
declare
    v_items int;
    v_pedidos int;
begin
    perform set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
    select count(*) into v_pedidos from public.orders;

    -- El primero cabe, el segundo no: la transacción entera debe deshacerse.
    begin
        perform public.create_order('[{"product_id": 1, "quantity": 1}, {"product_id": 2, "quantity": 500}]'::jsonb,
            '{"fullName":"Juan","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}'::jsonb, '{}'::jsonb);
    exception when others then null;
    end;

    perform pruebas.afirmar((select count(*) from public.orders) = v_pedidos,
        'si una línea falla, no queda pedido a medias');
end $$;

-- --------------------------------------- colonia y estado viajan a la guía
do $$
declare v_envio jsonb;
begin
    perform set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
    perform public.create_order('[{"product_id": 3, "quantity": 1}]'::jsonb,
        '{"fullName":"Juan","phone":"5512345678","address":"Av. Demo 123","neighborhood":"Centro","city":"Monterrey","state":"Nuevo León","zip":"64000"}'::jsonb,
        '{}'::jsonb);
    select shipping_info into v_envio from public.orders order by created_at desc limit 1;
    perform pruebas.afirmar(v_envio->>'neighborhood' = 'Centro' and v_envio->>'state' = 'Nuevo León',
        'el pedido guarda colonia y estado (la paquetería los pide para la guía)');
end $$;
