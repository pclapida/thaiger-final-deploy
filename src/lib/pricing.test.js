import { describe, it, expect } from 'vitest';
import {
  applyDiscount,
  amountToNextTier,
  computeCartTotals,
  formatPrice,
  getDiscountPercent,
  getTier,
  getTierBasePrice,
  getUnitPrice,
  hasDiscount,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_COST,
} from './pricing';

const producto = {
  id: 1,
  name: 'Whey',
  price1: 1000,
  price2: 900,
  price3: 800,
  is_on_sale: false,
  discount_percent: 0,
};

const enOferta = { ...producto, is_on_sale: true, discount_percent: 20 };

describe('ofertas', () => {
  it('reconoce una oferta válida', () => {
    expect(hasDiscount(enOferta)).toBe(true);
    expect(getDiscountPercent(enOferta)).toBe(20);
  });

  it('ignora la bandera de oferta si el porcentaje no sirve', () => {
    expect(hasDiscount({ ...producto, is_on_sale: true, discount_percent: 0 })).toBe(false);
    expect(hasDiscount({ ...producto, is_on_sale: true, discount_percent: 150 })).toBe(false);
    expect(hasDiscount({ ...producto, is_on_sale: false, discount_percent: 30 })).toBe(false);
    expect(hasDiscount(null)).toBe(false);
  });

  it('aplica el porcentaje al precio', () => {
    expect(applyDiscount(1000, enOferta)).toBe(800);
    expect(applyDiscount(1000, producto)).toBe(1000);
  });
});

describe('precios por nivel', () => {
  it('devuelve el precio del nivel pedido', () => {
    expect(getTierBasePrice(producto, 1)).toBe(1000);
    expect(getTierBasePrice(producto, 2)).toBe(900);
    expect(getTierBasePrice(producto, 3)).toBe(800);
  });

  it('cae al precio público cuando faltan los niveles 2 y 3', () => {
    const soloPrecio1 = { price1: 500, price2: 0, price3: null };
    expect(getTierBasePrice(soloPrecio1, 2)).toBe(500);
    expect(getTierBasePrice(soloPrecio1, 3)).toBe(500);
  });

  it('combina nivel y oferta', () => {
    // Nivel 2 (900) con 20% de descuento.
    expect(getUnitPrice(enOferta, 2)).toBe(720);
  });
});

describe('escalones del carrito', () => {
  it('asigna el nivel según el total de lista', () => {
    expect(getTier(0)).toBe(1);
    expect(getTier(9999)).toBe(1);
    expect(getTier(10000)).toBe(2);
    expect(getTier(19999)).toBe(2);
    expect(getTier(20000)).toBe(3);
  });

  it('calcula cuánto falta para el siguiente nivel', () => {
    expect(amountToNextTier(0)).toBe(10000);
    expect(amountToNextTier(12000)).toBe(8000);
    expect(amountToNextTier(25000)).toBe(0);
  });
});

describe('totales del carrito', () => {
  it('un carrito vacío no cobra envío', () => {
    const totales = computeCartTotals([]);
    expect(totales.subtotal).toBe(0);
    expect(totales.shipping).toBe(0);
    expect(totales.total).toBe(0);
  });

  it('cobra envío por debajo del mínimo', () => {
    const totales = computeCartTotals([{ ...producto, quantity: 1 }]);
    expect(totales.tier).toBe(1);
    expect(totales.subtotal).toBe(1000);
    expect(totales.shipping).toBe(SHIPPING_COST);
    expect(totales.total).toBe(1000 + SHIPPING_COST);
  });

  it('el envío es gratis justo en el umbral', () => {
    const totales = computeCartTotals([{ ...producto, price1: FREE_SHIPPING_THRESHOLD, quantity: 1 }]);
    expect(totales.shipping).toBe(0);
  });

  it('usa el precio de nivel 2 al pasar los $10,000 de lista', () => {
    const totales = computeCartTotals([{ ...producto, quantity: 10 }]);
    expect(totales.listTotal).toBe(10000);
    expect(totales.tier).toBe(2);
    expect(totales.subtotal).toBe(9000);
    expect(totales.shipping).toBe(0);
  });

  it('usa el precio de nivel 3 al pasar los $20,000 de lista', () => {
    const totales = computeCartTotals([{ ...producto, quantity: 20 }]);
    expect(totales.tier).toBe(3);
    expect(totales.subtotal).toBe(16000);
  });

  it('respeta la oferta dentro del carrito (bug histórico: se cobraba precio completo)', () => {
    const totales = computeCartTotals([{ ...enOferta, quantity: 2 }]);
    expect(totales.tier).toBe(1);
    expect(totales.subtotal).toBe(1600); // 2 x 800, no 2 x 1000
  });

  it('el nivel se decide con precios de lista aunque haya ofertas', () => {
    // 10 x 1000 de lista => nivel 2, aunque con descuento se pague menos.
    const totales = computeCartTotals([{ ...enOferta, quantity: 10 }]);
    expect(totales.tier).toBe(2);
    expect(totales.subtotal).toBe(7200); // 10 x (900 - 20%)
  });

  it('ignora cantidades o precios corruptos', () => {
    const totales = computeCartTotals([{ price1: 'abc', quantity: 2 }, { ...producto, quantity: undefined }]);
    expect(totales.subtotal).toBe(0);
  });
});

describe('formato de precio', () => {
  it('formatea en pesos mexicanos', () => {
    expect(formatPrice(1234.5)).toContain('1,234.50');
  });

  it('no revienta con valores inválidos', () => {
    expect(formatPrice(undefined)).toContain('0.00');
    expect(formatPrice(NaN)).toContain('0.00');
  });
});
