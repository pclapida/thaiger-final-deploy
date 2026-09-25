/**
 * POST /functions/v1/mp-webhook   (lo llama Mercado Pago, no el navegador)
 *
 * 1. Comprueba la firma HMAC del header x-signature con el secreto del panel.
 * 2. Consulta el pago en la API de Mercado Pago (nunca se confía en el cuerpo
 *    de la notificación: sólo trae el id).
 * 3. Si está aprobado, llama a marcar_pedido_pagado(), que valida el monto
 *    contra el total del pedido y hace la transición de estatus.
 *
 * Responde 200 en cuanto la firma es válida, aunque no haya nada que hacer: si
 * no, Mercado Pago reintenta durante días. Un problema de negocio (monto
 * distinto, pedido cancelado) se anota en payment_info.alerta para que el
 * panel lo enseñe, y NO se reintenta.
 *
 * Secretos: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET. verify_jwt = false.
 */
import { fallo, json, leerJson, requerirEnv } from '../_shared/http.ts';
import { clienteAdmin } from '../_shared/supabase.ts';
import { firmaValida, obtenerPago } from '../_shared/mercadopago.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fallo('Método no permitido.', 405);

  const url = new URL(req.url);
  const cuerpo = await leerJson<{ type?: string; action?: string; data?: { id?: string | number } }>(req);

  const dataId = url.searchParams.get('data.id') ?? (cuerpo.data?.id != null ? String(cuerpo.data.id) : null);
  const tipo = url.searchParams.get('type') ?? cuerpo.type ?? '';

  let secreto: string;
  try {
    secreto = requerirEnv('MP_WEBHOOK_SECRET');
  } catch (error) {
    console.error('mp-webhook:', (error as Error).message);
    return fallo('Webhook sin configurar.', 500);
  }

  const valida = await firmaValida({
    xSignature: req.headers.get('x-signature'),
    xRequestId: req.headers.get('x-request-id'),
    dataId,
    secreto,
  });
  if (!valida) {
    console.warn('mp-webhook: firma inválida', { tipo, dataId });
    return fallo('Firma inválida.', 401);
  }

  // Sólo interesan los pagos; merchant_order, chargebacks, etc. se ignoran.
  if (tipo !== 'payment' || !dataId) return json({ ignorado: true, tipo });

  try {
    const pago = await obtenerPago(requerirEnv('MP_ACCESS_TOKEN'), dataId);
    const orderId = pago.external_reference;
    if (!orderId) return json({ ignorado: true, motivo: 'sin external_reference' });

    const admin = clienteAdmin();
    const { data: pedido } = await admin.from('orders').select('id, payment_info, paid_at').eq('id', orderId).maybeSingle();
    if (!pedido) return json({ ignorado: true, motivo: 'pedido no encontrado', orderId });

    const rastro = {
      ...(pedido.payment_info ?? {}),
      method: 'Mercado Pago',
      mp_payment_id: String(pago.id),
      mp_status: pago.status,
      mp_status_detail: pago.status_detail ?? null,
      mp_payment_method: pago.payment_method_id ?? null,
      mp_updated_at: new Date().toISOString(),
    };

    if (pago.status !== 'approved') {
      // Rechazado, pendiente (OXXO sin pagar), reembolsado... se deja rastro
      // y el pedido sigue donde estaba; el cliente puede volver a intentar.
      await admin.from('orders').update({ payment_info: rastro }).eq('id', orderId);
      return json({ ok: true, estado: pago.status });
    }

    const { error } = await admin.rpc('marcar_pedido_pagado', {
      p_order_id: orderId,
      p_provider: 'mercadopago',
      p_reference: String(pago.id),
      p_amount: Number(pago.transaction_amount),
    });

    if (error) {
      // Monto distinto o pedido ya cancelado: alguien tiene que mirarlo.
      console.error('mp-webhook: no se pudo marcar como pagado', error.message);
      await admin
        .from('orders')
        .update({ payment_info: { ...rastro, alerta: error.message } })
        .eq('id', orderId);
      return json({ ok: false, alerta: error.message });
    }

    await admin.from('orders').update({ payment_info: rastro }).eq('id', orderId);
    return json({ ok: true, estado: 'approved', orderId });
  } catch (error) {
    // Un pago que no existe (la notificación de prueba del panel de Mercado
    // Pago usa el id inventado 123456) no se arregla reintentando: 200.
    if ((error as { status?: number }).status === 404) {
      return json({ ignorado: true, motivo: 'el pago no existe', dataId });
    }
    // Un fallo de red al consultar el pago sí merece reintento: 500.
    console.error('mp-webhook:', error);
    return fallo('Error procesando la notificación.', 500);
  }
});
