/**
 * POST /functions/v1/crear-pago   { order_id }
 *
 * Crea la preferencia de Checkout Pro para un pedido que ya existe y devuelve
 * la URL a la que hay que mandar al cliente. Exige sesión: el pedido se lee con
 * la RLS del usuario, así que nadie puede pagar (ni ver) un pedido ajeno.
 *
 * Secretos: MP_ACCESS_TOKEN, SITE_URL.
 */
import { fallo, json, leerJson, preflight, requerirEnv } from '../_shared/http.ts';
import { clienteAdmin, clienteDeUsuario, leerAjustes, referenciaPedido, urlDeFuncion, usuarioActual } from '../_shared/supabase.ts';
import { armarPreferencia, crearPreferencia } from '../_shared/mercadopago.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fallo('Método no permitido.', 405);

  try {
    const usuario = await usuarioActual(req);
    if (!usuario) return fallo('Necesitas iniciar sesión para pagar.', 401);

    const { order_id: orderId } = await leerJson<{ order_id?: string }>(req);
    if (!orderId) return fallo('Falta el pedido a pagar.');

    // Con la sesión del cliente: la RLS sólo le deja ver los suyos.
    const { data: pedido, error } = await clienteDeUsuario(req)
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .maybeSingle();

    if (error) return fallo(`No se pudo leer el pedido: ${error.message}`, 500);
    if (!pedido) return fallo('El pedido no existe o no es tuyo.', 404);
    if (pedido.paid_at) return fallo('Este pedido ya está pagado.');
    if (pedido.status !== 'Pago Pendiente') return fallo(`El pedido está en estatus "${pedido.status}" y ya no se puede pagar.`);

    const ajustes = await leerAjustes();
    const siteUrl = requerirEnv('SITE_URL').replace(/\/$/, '');
    const referencia = referenciaPedido(pedido.id);

    const cuerpo = armarPreferencia({
      pedido,
      referencia,
      nombreTienda: ajustes?.store?.name ?? 'Thaiger Supplements',
      correoCliente: usuario.email,
      siteUrl,
      notificationUrl: urlDeFuncion('mp-webhook'),
    });

    const preferencia = await crearPreferencia(requerirEnv('MP_ACCESS_TOKEN'), cuerpo, `pref-${pedido.id}`);

    // Se anota la preferencia en el pedido para poder cruzarla después.
    await clienteAdmin()
      .from('orders')
      .update({
        payment_provider: 'mercadopago',
        payment_info: { ...(pedido.payment_info ?? {}), method: 'Mercado Pago', mp_preference_id: preferencia.id },
      })
      .eq('id', pedido.id);

    return json({
      preference_id: preferencia.id,
      init_point: preferencia.init_point,
      sandbox_init_point: preferencia.sandbox_init_point ?? null,
      referencia,
    });
  } catch (error) {
    console.error('crear-pago:', error);
    return fallo((error as Error).message || 'No se pudo iniciar el pago.', 500);
  }
});
