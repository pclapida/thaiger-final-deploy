/**
 * POST /functions/v1/notificar-pedido   (la llama la base de datos)
 *
 * El disparador que instala `configurar_notificaciones()` manda aquí cada
 * pedido nuevo y cada cambio de estatus, con el pedido completo en `record`.
 * Esta función decide qué correo toca y lo manda con Resend.
 *
 * Se autentica con un secreto compartido en la cabecera x-thaiger-secret: no
 * hay JWT porque quien llama es Postgres, no una persona.
 *
 * Secretos: NOTIFY_SECRET, RESEND_API_KEY, MAIL_FROM, SITE_URL,
 *           NOTIFY_ADMIN_EMAIL (opcional). verify_jwt = false.
 */
import { fallo, json, leerJson, requerirEnv } from '../_shared/http.ts';
import { clienteAdmin, leerAjustes } from '../_shared/supabase.ts';
import { enviarCorreo } from '../_shared/correo.ts';
import { correoAvisoAdmin, correoCambioEstatus, correoPedidoNuevo, type PedidoCorreo } from '../_shared/plantillas.ts';

interface Aviso {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: PedidoCorreo & { user_id: string };
  old_record: (PedidoCorreo & { user_id: string }) | null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fallo('Método no permitido.', 405);

  let secreto: string;
  try {
    secreto = requerirEnv('NOTIFY_SECRET');
  } catch (error) {
    console.error('notificar-pedido:', (error as Error).message);
    return fallo('Notificaciones sin configurar.', 500);
  }
  if (req.headers.get('x-thaiger-secret') !== secreto) return fallo('No autorizado.', 401);

  const aviso = await leerJson<Aviso>(req);
  if (aviso.table !== 'orders' || !aviso.record) return json({ ignorado: true });

  const esNuevo = aviso.type === 'INSERT';
  const cambioEstatus = aviso.type === 'UPDATE' && aviso.old_record?.status !== aviso.record.status;
  if (!esNuevo && !cambioEstatus) return json({ ignorado: true });

  // Sin Resend configurado no se rompe nada: se anota y ya.
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM');
  if (!apiKey || !from) {
    console.warn('notificar-pedido: falta RESEND_API_KEY o MAIL_FROM; no se manda correo.');
    return json({ enviado: false, motivo: 'correo sin configurar' });
  }

  try {
    const admin = clienteAdmin();
    const ajustes = await leerAjustes();
    const tienda = ajustes?.store ?? {};
    const siteUrl = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '');

    // El disparador manda la fila de `orders`; las líneas se leen aparte.
    const { data: lineas } = await admin.from('order_items').select('*').eq('order_id', aviso.record.id);
    const pedido: PedidoCorreo = { ...aviso.record, order_items: lineas ?? [] };

    const { data: cuenta } = await admin.auth.admin.getUserById(aviso.record.user_id);
    const correoCliente = cuenta?.user?.email ?? null;

    const enviados: string[] = [];

    if (esNuevo) {
      if (correoCliente) {
        const correo = correoPedidoNuevo({ pedido, tienda, spei: ajustes?.payment, siteUrl });
        await enviarCorreo(apiKey, from, { to: correoCliente, replyTo: tienda.email, ...correo });
        enviados.push('cliente');
      }
      const admin = Deno.env.get('NOTIFY_ADMIN_EMAIL');
      if (admin) {
        await enviarCorreo(apiKey, from, { to: admin, ...correoAvisoAdmin({ pedido, tienda, correoCliente }) });
        enviados.push('admin');
      }
    } else if (correoCliente) {
      const correo = correoCambioEstatus({ pedido, tienda, siteUrl });
      if (correo) {
        await enviarCorreo(apiKey, from, { to: correoCliente, replyTo: tienda.email, ...correo });
        enviados.push('cliente');
      }
    }

    return json({ enviado: enviados.length > 0, enviados });
  } catch (error) {
    // El disparador no reintenta: se deja rastro para revisarlo en los logs.
    console.error('notificar-pedido:', error);
    return fallo((error as Error).message, 500);
  }
});
