import { describe, it, expect } from 'vitest';
import { correoAvisoAdmin, correoCambioEstatus, correoPedidoNuevo, escapar } from './plantillas.ts';

const tienda = { name: 'Thaiger Supplements', email: 'hola@thaiger.mx' };
const pedido = {
  id: '0a1b2c3d-0000-0000-0000-000000000000',
  status: 'Pago Pendiente',
  total: 2250,
  subtotal: 2000,
  shipping_cost: 250,
  payment_provider: 'spei',
  payment_info: { concepto: 'TH-1234' },
  shipping_info: { fullName: 'Ana <script>alert(1)</script>', address: 'Calle 1', city: 'CDMX', zip: '01000', phone: '55' },
  order_items: [{ product_name: 'Proteína', quantity: 2, price_at_purchase: 1000 }],
};

describe('correos', () => {
  it('el pedido nuevo por SPEI lleva CLABE, concepto y total', () => {
    const { subject, html } = correoPedidoNuevo({
      pedido,
      tienda,
      spei: { bank: 'BBVA', clabe: '012345678901234567', beneficiary: 'Thaiger SA' },
      siteUrl: 'https://thaiger.mx',
    });
    expect(subject).toContain('TH-0A1B2C3D');
    expect(html).toContain('012345678901234567');
    expect(html).toContain('TH-1234');
    expect(html).toContain('$2,250.00');
    expect(html).toContain('Proteína');
  });

  it('el pedido nuevo por Mercado Pago invita a retomar el pago en vez de dar la CLABE', () => {
    const { html } = correoPedidoNuevo({ pedido: { ...pedido, payment_provider: 'mercadopago' }, tienda, siteUrl: 'https://thaiger.mx' });
    expect(html).toContain('https://thaiger.mx/profile');
    expect(html).not.toContain('CLABE');
  });

  it('escapa lo que escribió el cliente', () => {
    const { html } = correoPedidoNuevo({ pedido, tienda, siteUrl: 'https://thaiger.mx' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(escapar('a"b')).toBe('a&quot;b');
  });

  it('el correo de enviado lleva paquetería y rastreo', () => {
    const correo = correoCambioEstatus({
      pedido: { ...pedido, status: 'Enviado', shipment: { carrier: 'Estafeta', tracking_number: '7788', tracking_url: 'https://rastreo' } },
      tienda,
      siteUrl: 'https://thaiger.mx',
    });
    expect(correo?.subject).toMatch(/en camino/i);
    expect(correo?.html).toContain('7788');
    expect(correo?.html).toContain('https://rastreo');
    expect(correo?.html).toContain('Estafeta');
  });

  it('hay correo para cada estatus conocido y ninguno para uno desconocido', () => {
    for (const status of ['Pagado', 'En Proceso', 'Enviado', 'Entregado', 'Cancelado']) {
      expect(correoCambioEstatus({ pedido: { ...pedido, status }, tienda, siteUrl: 'https://x' })).not.toBeNull();
    }
    expect(correoCambioEstatus({ pedido: { ...pedido, status: 'Inventado' }, tienda, siteUrl: 'https://x' })).toBeNull();
  });

  it('el aviso al admin dice el total y el método', () => {
    const { subject, html } = correoAvisoAdmin({ pedido, tienda, correoCliente: 'ana@ejemplo.com' });
    expect(subject).toContain('$2,250.00');
    expect(html).toContain('ana@ejemplo.com');
    expect(html).toContain('TH-1234');
  });
});
