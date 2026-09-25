/**
 * Mercado Pago: Checkout Pro y verificación de sus notificaciones.
 *
 * Lo que no toca la red (firma, manifiesto, armado de la preferencia) está
 * separado para poder probarlo con Vitest sin Deno ni credenciales.
 */

const API = 'https://api.mercadopago.com';

// ---------------------------------------------------------------- firma

/**
 * El manifiesto que Mercado Pago firma. Regla suya: si `data.id` es
 * alfanumérico va en minúsculas; los ids numéricos se dejan como vienen.
 */
export function manifiestoFirma({ dataId, requestId, ts }: { dataId: string; requestId: string; ts: string }): string {
  const id = /^[a-zA-Z0-9]+$/.test(dataId) && /[a-zA-Z]/.test(dataId) ? dataId.toLowerCase() : dataId;
  return `id:${id};request-id:${requestId};ts:${ts};`;
}

/** Parte `ts=...,v1=...` del header x-signature. */
export function parsearXSignature(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;
  const partes: Record<string, string> = {};
  for (const trozo of header.split(',')) {
    const [clave, ...resto] = trozo.split('=');
    if (!clave || resto.length === 0) continue;
    partes[clave.trim()] = resto.join('=').trim();
  }
  if (!partes.ts || !partes.v1) return null;
  return { ts: partes.ts, v1: partes.v1 };
}

export async function hmacSha256Hex(secreto: string, mensaje: string): Promise<string> {
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const firma = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(mensaje));
  return Array.from(new Uint8Array(firma))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Comparación en tiempo constante: no revela cuántos caracteres coinciden. */
export function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * ¿La notificación la mandó Mercado Pago de verdad?
 * `toleranciaSeg` rechaza firmas viejas (una notificación capturada y repetida).
 */
export async function firmaValida({
  xSignature,
  xRequestId,
  dataId,
  secreto,
  ahoraMs = Date.now(),
  toleranciaSeg = 5 * 60,
}: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secreto: string;
  ahoraMs?: number;
  toleranciaSeg?: number;
}): Promise<boolean> {
  const partes = parsearXSignature(xSignature);
  if (!partes || !xRequestId || !dataId || !secreto) return false;

  // La documentación de Mercado Pago muestra `ts` en segundos (1704908010) y
  // hay notificaciones que lo traen en milisegundos. Se aceptan las dos: la
  // primera versión sólo leía milisegundos, así que toda firma en segundos
  // parecía de 1970, caía fuera de la tolerancia y respondía 401.
  const tsNumero = Number(partes.ts);
  if (!Number.isFinite(tsNumero)) return false;
  const tsMs = tsNumero < 1e12 ? tsNumero * 1000 : tsNumero;
  if (Math.abs(ahoraMs - tsMs) > toleranciaSeg * 1000) return false;

  const esperada = await hmacSha256Hex(secreto, manifiestoFirma({ dataId, requestId: xRequestId, ts: partes.ts }));
  return igualesEnTiempoConstante(esperada, partes.v1.toLowerCase());
}

// ------------------------------------------------------------ preferencia

export interface LineaPedido {
  product_id: number | string;
  product_name: string;
  quantity: number;
  price_at_purchase: number;
}

export interface PedidoParaCobrar {
  id: string;
  total: number;
  shipping_cost: number;
  order_items: LineaPedido[];
}

/**
 * Arma el cuerpo de la preferencia. Los importes salen del pedido que ya
 * calculó Postgres: aquí no se vuelve a calcular nada.
 */
export function armarPreferencia({
  pedido,
  referencia,
  nombreTienda,
  correoCliente,
  siteUrl,
  notificationUrl,
}: {
  pedido: PedidoParaCobrar;
  referencia: string;
  nombreTienda: string;
  correoCliente?: string | null;
  siteUrl: string;
  notificationUrl: string;
}) {
  const items = pedido.order_items.map((linea) => ({
    id: String(linea.product_id),
    title: linea.product_name.slice(0, 256),
    quantity: Number(linea.quantity),
    unit_price: Number(linea.price_at_purchase),
    currency_id: 'MXN',
  }));

  if (Number(pedido.shipping_cost) > 0) {
    items.push({ id: 'envio', title: 'Envío', quantity: 1, unit_price: Number(pedido.shipping_cost), currency_id: 'MXN' });
  }

  const volver = (estado: string) => `${siteUrl}/pago/resultado?pedido=${encodeURIComponent(pedido.id)}&estado=${estado}`;

  return {
    items,
    external_reference: pedido.id,
    notification_url: notificationUrl,
    back_urls: { success: volver('exito'), failure: volver('fallo'), pending: volver('pendiente') },
    auto_return: 'approved',
    // Lo que aparece en el estado de cuenta de la tarjeta (máximo 22 caracteres).
    statement_descriptor: nombreTienda.replace(/[^\w ]/g, '').slice(0, 22).toUpperCase() || 'TIENDA',
    metadata: { order_id: pedido.id, referencia },
    ...(correoCliente ? { payer: { email: correoCliente } } : {}),
  };
}

export interface PreferenciaCreada {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

export async function crearPreferencia(accessToken: string, cuerpo: unknown, idempotencia: string): Promise<PreferenciaCreada> {
  const respuesta = await fetch(`${API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      // Un reintento del navegador no crea dos preferencias.
      'X-Idempotency-Key': idempotencia,
    },
    body: JSON.stringify(cuerpo),
  });

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(`Mercado Pago rechazó la preferencia (${respuesta.status}): ${datos?.message ?? 'sin detalle'}`);
  }
  return { id: datos.id, init_point: datos.init_point, sandbox_init_point: datos.sandbox_init_point };
}

// ------------------------------------------------------------------ pagos

export interface PagoMercadoPago {
  id: number | string;
  status: string; // approved | pending | in_process | rejected | cancelled | refunded | charged_back
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  payment_method_id?: string;
  payment_type_id?: string;
  date_approved?: string | null;
}

export async function obtenerPago(accessToken: string, id: string): Promise<PagoMercadoPago> {
  const respuesta = await fetch(`${API}/v1/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(`No se pudo consultar el pago ${id} en Mercado Pago (${respuesta.status}).`);
    (error as Error & { status?: number }).status = respuesta.status;
    throw error;
  }
  return datos as PagoMercadoPago;
}
