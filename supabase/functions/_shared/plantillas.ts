/**
 * Correos de la tienda. Funciones puras: reciben el pedido y devuelven
 * asunto + HTML, para poder probarlas sin mandar nada.
 *
 * Todo lo que escribió una persona (nombre, dirección) pasa por `escapar`:
 * un cliente que se llame "<script>" no ejecuta nada en el correo del admin.
 */

export interface Tienda {
  name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
}

export interface CuentaSpei {
  bank?: string;
  clabe?: string;
  beneficiary?: string;
  instructions?: string;
}

export interface PedidoCorreo {
  id: string;
  status: string;
  total: number;
  subtotal?: number;
  shipping_cost?: number;
  payment_provider?: string;
  payment_info?: { concepto?: string } | null;
  shipping_info?: {
    fullName?: string;
    address?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
  } | null;
  shipment?: { carrier?: string; tracking_number?: string; tracking_url?: string; label_url?: string } | null;
  order_items?: Array<{ product_name: string; quantity: number; price_at_purchase: number }>;
  created_at?: string;
}

export function escapar(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function pesos(valor: unknown): string {
  const numero = Number(valor);
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number.isFinite(numero) ? numero : 0);
}

export function referencia(id: string): string {
  return `TH-${String(id).split('-')[0].toUpperCase()}`;
}

function tablaArticulos(pedido: PedidoCorreo): string {
  const filas = (pedido.order_items ?? [])
    .map(
      (linea) => `
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee">${escapar(linea.product_name)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${Number(linea.quantity)}</td>
          <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${pesos(Number(linea.price_at_purchase) * Number(linea.quantity))}</td>
        </tr>`
    )
    .join('');

  const envio = Number(pedido.shipping_cost) > 0 ? pesos(pedido.shipping_cost) : 'Gratis';

  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr style="color:#666;font-size:12px;text-transform:uppercase">
        <th style="text-align:left;padding:4px 0">Producto</th><th style="padding:4px 8px">Cant.</th><th style="text-align:right;padding:4px 0">Importe</th>
      </tr></thead>
      <tbody>${filas}</tbody>
      <tfoot>
        <tr><td colspan="2" style="padding:6px 0;color:#666">Subtotal</td><td style="text-align:right">${pesos(pedido.subtotal ?? pedido.total)}</td></tr>
        <tr><td colspan="2" style="padding:6px 0;color:#666">Envío</td><td style="text-align:right">${envio}</td></tr>
        <tr><td colspan="2" style="padding:8px 0;font-weight:bold">Total</td><td style="text-align:right;font-weight:bold;font-size:16px">${pesos(pedido.total)}</td></tr>
      </tfoot>
    </table>`;
}

function bloqueDireccion(pedido: PedidoCorreo): string {
  const e = pedido.shipping_info ?? {};
  return `
    <p style="font-size:14px;line-height:1.5;margin:0">
      <strong>${escapar(e.fullName)}</strong><br>
      ${escapar(e.address)}${e.neighborhood ? `, Col. ${escapar(e.neighborhood)}` : ''}<br>
      ${escapar(e.city)}${e.state ? `, ${escapar(e.state)}` : ''} · C.P. ${escapar(e.zip)}<br>
      Tel. ${escapar(e.phone)}
    </p>`;
}

function envoltura(tienda: Tienda, titulo: string, contenido: string): string {
  const nombre = escapar(tienda.name || 'Thaiger Supplements');
  const contacto = [tienda.email, tienda.phone].filter(Boolean).map(escapar).join(' · ');
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
    <div style="background:#0a0a0a;color:#fff;padding:20px 24px">
      <div style="font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#f97316">${nombre}</div>
      <h1 style="margin:8px 0 0;font-size:20px">${escapar(titulo)}</h1>
    </div>
    <div style="padding:24px">${contenido}</div>
    <div style="padding:16px 24px;background:#fafafa;color:#777;font-size:12px">${nombre}${contacto ? ' · ' + contacto : ''}</div>
  </div>
</body></html>`;
}

function seccion(titulo: string, contenido: string): string {
  return `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#666;margin:24px 0 8px">${escapar(titulo)}</h2>${contenido}`;
}

/** Al registrar el pedido: qué compró y cómo pagar. */
export function correoPedidoNuevo({
  pedido,
  tienda,
  spei,
  siteUrl,
}: {
  pedido: PedidoCorreo;
  tienda: Tienda;
  spei?: CuentaSpei;
  siteUrl: string;
}): { subject: string; html: string } {
  const ref = referencia(pedido.id);
  let pago: string;

  if (pedido.payment_provider === 'mercadopago') {
    pago = `
      <p style="font-size:14px;line-height:1.5">Si ya pagaste, en cuanto Mercado Pago nos confirme te avisamos por aquí.
      Si no terminaste el pago, puedes retomarlo desde tu cuenta:</p>
      <p><a href="${escapar(siteUrl)}/profile" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:4px;font-weight:bold">Pagar mi pedido</a></p>`;
  } else {
    pago = `
      <p style="font-size:14px;line-height:1.5">${escapar(spei?.instructions || 'Transfiere el total a esta cuenta usando el concepto indicado. En cuanto veamos tu pago, preparamos tu pedido.')}</p>
      <table style="font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Banco</td><td><strong>${escapar(spei?.bank)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Beneficiario</td><td>${escapar(spei?.beneficiary)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">CLABE</td><td style="font-family:monospace;font-size:16px;font-weight:bold">${escapar(spei?.clabe)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Total</td><td><strong>${pesos(pedido.total)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Concepto</td><td style="font-family:monospace;font-size:16px;font-weight:bold;color:#ea580c">${escapar(pedido.payment_info?.concepto)}</td></tr>
      </table>`;
  }

  const html = envoltura(
    tienda,
    `Recibimos tu pedido ${ref}`,
    `<p style="font-size:14px;line-height:1.5">Hola ${escapar(pedido.shipping_info?.fullName || '')}, gracias por tu compra. Éste es el resumen:</p>
     ${seccion('Artículos', tablaArticulos(pedido))}
     ${seccion('Cómo pagar', pago)}
     ${seccion('Enviaremos a', bloqueDireccion(pedido))}`
  );

  return { subject: `Pedido ${ref} recibido · ${tienda.name || 'Thaiger Supplements'}`, html };
}

/** Cuando el estatus cambia: pagado, en proceso, enviado, entregado, cancelado. */
export function correoCambioEstatus({
  pedido,
  tienda,
  siteUrl,
}: {
  pedido: PedidoCorreo;
  tienda: Tienda;
  siteUrl: string;
}): { subject: string; html: string } | null {
  const ref = referencia(pedido.id);
  const nombre = escapar(pedido.shipping_info?.fullName || '');
  const enlacePerfil = `<p><a href="${escapar(siteUrl)}/profile" style="color:#ea580c">Ver mi pedido</a></p>`;

  const textos: Record<string, { titulo: string; cuerpo: string }> = {
    Pagado: {
      titulo: `Pago confirmado · ${ref}`,
      cuerpo: `<p style="font-size:14px;line-height:1.5">Hola ${nombre}, ya recibimos tu pago de <strong>${pesos(pedido.total)}</strong>. Estamos preparando tu pedido y te avisamos cuando salga.</p>`,
    },
    'En Proceso': {
      titulo: `Estamos preparando tu pedido ${ref}`,
      cuerpo: `<p style="font-size:14px;line-height:1.5">Hola ${nombre}, tu pedido está en preparación. En cuanto lo entreguemos a la paquetería te mandamos la guía.</p>`,
    },
    Enviado: {
      titulo: `Tu pedido ${ref} va en camino`,
      cuerpo: (() => {
        const g = pedido.shipment ?? {};
        if (!g.tracking_number) {
          return `<p style="font-size:14px;line-height:1.5">Hola ${nombre}, tu pedido ya salió. Pronto tendrás el número de rastreo.</p>`;
        }
        const enlace = g.tracking_url
          ? `<a href="${escapar(g.tracking_url)}" style="color:#ea580c">Rastrear envío</a>`
          : '';
        return `<p style="font-size:14px;line-height:1.5">Hola ${nombre}, tu pedido ya salió con <strong>${escapar(g.carrier || 'la paquetería')}</strong>.</p>
          <p style="font-size:14px">Número de rastreo: <strong style="font-family:monospace;font-size:16px">${escapar(g.tracking_number)}</strong></p>
          ${enlace ? `<p>${enlace}</p>` : ''}`;
      })(),
    },
    Entregado: {
      titulo: `Tu pedido ${ref} fue entregado`,
      cuerpo: `<p style="font-size:14px;line-height:1.5">Hola ${nombre}, tu pedido llegó. Gracias por comprar con nosotros; si algo no está bien, respóndenos a este correo.</p>`,
    },
    Cancelado: {
      titulo: `Pedido ${ref} cancelado`,
      cuerpo: `<p style="font-size:14px;line-height:1.5">Hola ${nombre}, tu pedido quedó cancelado. Si no lo pediste tú o tienes dudas, contáctanos.</p>`,
    },
  };

  const texto = textos[pedido.status];
  if (!texto) return null;

  return {
    subject: `${texto.titulo} · ${tienda.name || 'Thaiger Supplements'}`,
    html: envoltura(tienda, texto.titulo, `${texto.cuerpo}${seccion('Enviaremos a', bloqueDireccion(pedido))}${enlacePerfil}`),
  };
}

/** Aviso interno: llegó un pedido nuevo. */
export function correoAvisoAdmin({
  pedido,
  tienda,
  correoCliente,
}: {
  pedido: PedidoCorreo;
  tienda: Tienda;
  correoCliente?: string | null;
}): { subject: string; html: string } {
  const ref = referencia(pedido.id);
  const metodo = pedido.payment_provider === 'mercadopago' ? 'Mercado Pago' : `SPEI · concepto ${escapar(pedido.payment_info?.concepto)}`;
  const html = envoltura(
    tienda,
    `Pedido nuevo ${ref}`,
    `<p style="font-size:14px">Total <strong>${pesos(pedido.total)}</strong> · ${metodo}</p>
     <p style="font-size:14px">Cliente: ${escapar(correoCliente || 'sin correo')}</p>
     ${seccion('Artículos', tablaArticulos(pedido))}
     ${seccion('Enviar a', bloqueDireccion(pedido))}`
  );
  return { subject: `Pedido nuevo ${ref} · ${pesos(pedido.total)}`, html };
}
