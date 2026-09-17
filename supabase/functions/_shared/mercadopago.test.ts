import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { armarPreferencia, firmaValida, hmacSha256Hex, manifiestoFirma, parsearXSignature } from './mercadopago.ts';

const SECRETO = 'clave-secreta-del-panel';

/** Firma como lo haría Mercado Pago, con la librería de Node como referencia. */
function firmar(dataId: string, requestId: string, ts: string) {
  return createHmac('sha256', SECRETO).update(manifiestoFirma({ dataId, requestId, ts })).digest('hex');
}

describe('firma de las notificaciones', () => {
  it('arma el manifiesto con el formato que documenta Mercado Pago', () => {
    expect(manifiestoFirma({ dataId: '123456', requestId: 'req-1', ts: '1700000000000' })).toBe(
      'id:123456;request-id:req-1;ts:1700000000000;'
    );
  });

  it('pasa a minúsculas un data.id alfanumérico, pero no toca los numéricos', () => {
    expect(manifiestoFirma({ dataId: 'ABC123', requestId: 'r', ts: '1' })).toContain('id:abc123;');
    expect(manifiestoFirma({ dataId: '987', requestId: 'r', ts: '1' })).toContain('id:987;');
  });

  it('parsea el header x-signature', () => {
    expect(parsearXSignature('ts=1700000000000,v1=abcd')).toEqual({ ts: '1700000000000', v1: 'abcd' });
    expect(parsearXSignature('ts=1,v1=a=b')).toEqual({ ts: '1', v1: 'a=b' });
    expect(parsearXSignature('v1=abcd')).toBeNull();
    expect(parsearXSignature(null)).toBeNull();
  });

  it('su HMAC coincide con el de Node', async () => {
    expect(await hmacSha256Hex(SECRETO, 'hola')).toBe(createHmac('sha256', SECRETO).update('hola').digest('hex'));
  });

  it('acepta una firma correcta y reciente', async () => {
    const ahora = Date.now();
    const ts = String(ahora);
    const ok = await firmaValida({
      xSignature: `ts=${ts},v1=${firmar('555', 'req-9', ts)}`,
      xRequestId: 'req-9',
      dataId: '555',
      secreto: SECRETO,
      ahoraMs: ahora,
    });
    expect(ok).toBe(true);
  });

  it('rechaza firma manipulada, secreto distinto, id cambiado o firma vieja', async () => {
    const ahora = Date.now();
    const ts = String(ahora);
    const v1 = firmar('555', 'req-9', ts);
    const base = { xRequestId: 'req-9', dataId: '555', secreto: SECRETO, ahoraMs: ahora };

    expect(await firmaValida({ ...base, xSignature: `ts=${ts},v1=${v1.replace(/^./, 'f')}` })).toBe(false);
    expect(await firmaValida({ ...base, xSignature: `ts=${ts},v1=${v1}`, secreto: 'otra' })).toBe(false);
    // El atacante cambia el id del pago por uno que sí está aprobado.
    expect(await firmaValida({ ...base, xSignature: `ts=${ts},v1=${v1}`, dataId: '556' })).toBe(false);
    // Una notificación capturada hace una hora y repetida.
    expect(await firmaValida({ ...base, xSignature: `ts=${ts},v1=${v1}`, ahoraMs: ahora + 60 * 60 * 1000 })).toBe(false);
    expect(await firmaValida({ ...base, xSignature: null })).toBe(false);
  });
});

describe('preferencia de Checkout Pro', () => {
  const pedido = {
    id: '0a1b2c3d-0000-0000-0000-000000000000',
    total: 2189.5,
    shipping_cost: 189.5,
    order_items: [
      { product_id: 1, product_name: 'Proteína', quantity: 2, price_at_purchase: 1000 },
    ],
  };

  it('lista los artículos con los precios que fijó Postgres, más el envío', () => {
    const p = armarPreferencia({
      pedido,
      referencia: 'TH-0A1B2C3D',
      nombreTienda: 'Thaiger Supplements',
      correoCliente: 'ana@ejemplo.com',
      siteUrl: 'https://thaiger.mx',
      notificationUrl: 'https://ref.supabase.co/functions/v1/mp-webhook',
    });

    expect(p.items).toEqual([
      { id: '1', title: 'Proteína', quantity: 2, unit_price: 1000, currency_id: 'MXN' },
      { id: 'envio', title: 'Envío', quantity: 1, unit_price: 189.5, currency_id: 'MXN' },
    ]);
    const suma = p.items.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
    expect(suma).toBeCloseTo(pedido.total, 2);
  });

  it('enlaza el pago con el pedido y con el webhook', () => {
    const p = armarPreferencia({
      pedido,
      referencia: 'TH-0A1B2C3D',
      nombreTienda: 'Thaiger Supplements',
      siteUrl: 'https://thaiger.mx/',
      notificationUrl: 'https://ref.supabase.co/functions/v1/mp-webhook',
    });

    expect(p.external_reference).toBe(pedido.id);
    expect(p.notification_url).toBe('https://ref.supabase.co/functions/v1/mp-webhook');
    expect(p.back_urls.success).toContain('/pago/resultado?pedido=0a1b2c3d');
    expect(p.back_urls.success).toContain('estado=exito');
    expect(p.auto_return).toBe('approved');
    expect(p.statement_descriptor.length).toBeLessThanOrEqual(22);
    expect(p).not.toHaveProperty('payer');
  });

  it('sin envío no añade la línea de envío', () => {
    const p = armarPreferencia({
      pedido: { ...pedido, shipping_cost: 0, total: 2000 },
      referencia: 'X',
      nombreTienda: 'T',
      siteUrl: 'https://t.mx',
      notificationUrl: 'https://f',
    });
    expect(p.items).toHaveLength(1);
  });
});
