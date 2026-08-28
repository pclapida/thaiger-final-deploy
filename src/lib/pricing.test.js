import { describe, it, expect, afterEach } from 'vitest';
import {
  applyDiscount,
  amountToFreeShipping,
  amountToNextTier,
  computeCartTotals,
  configurePricing,
  formatPrice,
  getDiscountPercent,
  getPricingConfig,
  getShippingCost,
  getTier,
  getTierBasePrice,
  getUnitPrice,
  hasDiscount,
  resetPricingConfig,
  DEFAULT_PRICING,
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

describe('ahorro y envío', () => {
  it('suma lo que el cliente se ahorra frente al precio público', () => {
    // 2 unidades con 20% de descuento sobre 1000 => 400 de ahorro.
    expect(computeCartTotals([{ ...enOferta, quantity: 2 }]).savings).toBe(400);
    expect(computeCartTotals([{ ...producto, quantity: 2 }]).savings).toBe(0);
  });

  it('el ahorro incluye la mejora de nivel, no sólo la oferta', () => {
    // 10 x 1000 de lista pasa a nivel 2 (900): 1000 de ahorro.
    expect(computeCartTotals([{ ...producto, quantity: 10 }]).savings).toBe(1000);
  });

  it('dice cuánto falta para el envío gratis', () => {
    const totales = computeCartTotals([{ ...producto, quantity: 1 }]);
    expect(totales.missingForFreeShipping).toBe(FREE_SHIPPING_THRESHOLD - 1000);
    expect(amountToFreeShipping(FREE_SHIPPING_THRESHOLD)).toBe(0);
  });

  it('cuenta los artículos del carrito', () => {
    expect(computeCartTotals([{ ...producto, quantity: 2 }, { ...enOferta, quantity: 3 }]).itemCount).toBe(5);
  });

  it('getShippingCost respeta el umbral y el carrito vacío', () => {
    expect(getShippingCost(0)).toBe(0);
    expect(getShippingCost(10)).toBe(SHIPPING_COST);
    expect(getShippingCost(FREE_SHIPPING_THRESHOLD)).toBe(0);
  });
});

describe('umbrales configurables desde el panel', () => {
  afterEach(() => {
    resetPricingConfig();
  });

  it('arranca con los valores por defecto', () => {
    expect(getPricingConfig()).toEqual(DEFAULT_PRICING);
  });

  it('aplica los umbrales que configure el administrador', () => {
    configurePricing({ tier2From: 3000, tier3From: 6000, freeShippingFrom: 1500, shippingCost: 99 });

    expect(getTier(3000)).toBe(2);
    expect(getTier(6000)).toBe(3);
    expect(amountToNextTier(0)).toBe(3000);

    const totales = computeCartTotals([{ ...producto, quantity: 1 }]);
    expect(totales.shipping).toBe(99);
    expect(computeCartTotals([{ ...producto, quantity: 2 }]).shipping).toBe(0);
  });

  it('ignora valores inválidos y conserva los anteriores', () => {
    configurePricing({ tier2From: 'muchos', shippingCost: -5 });
    expect(getPricingConfig().tier2From).toBe(DEFAULT_PRICING.tier2From);
    expect(getPricingConfig().shippingCost).toBe(DEFAULT_PRICING.shippingCost);
  });

  it('nunca deja el nivel 3 por debajo del nivel 2', () => {
    configurePricing({ tier2From: 8000, tier3From: 2000 });
    expect(getPricingConfig().tier3From).toBe(8000);
  });

  it('resetPricingConfig vuelve a los valores de fábrica', () => {
    configurePricing({ tier2From: 1 });
    expect(resetPricingConfig()).toEqual(DEFAULT_PRICING);
  });
});
