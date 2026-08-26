/**
 * Lógica única de precios de Thaiger.
 *
 * Reglas:
 *  - Precios escalonados por monto del carrito: Nivel 1 (price1), Nivel 2 (price2), Nivel 3 (price3).
 *  - Un producto "en oferta" aplica su porcentaje de descuento sobre el precio del nivel vigente.
 *  - Envío gratis a partir de FREE_SHIPPING_THRESHOLD.
 */

export const TIER_2_THRESHOLD = 10000;
export const TIER_3_THRESHOLD = 20000;
export const FREE_SHIPPING_THRESHOLD = 5000;
export const SHIPPING_COST = 250;

export function formatPrice(value) {
  const number = Number(value);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number.isFinite(number) ? number : 0);
}

/** ¿El producto tiene una oferta activa y válida? */
export function hasDiscount(product) {
  if (!product) return false;
  const percent = Number(product.discount_percent);
  return Boolean(product.is_on_sale) && Number.isFinite(percent) && percent > 0 && percent < 100;
}

export function getDiscountPercent(product) {
  return hasDiscount(product) ? Number(product.discount_percent) : 0;
}

/** Aplica el descuento de oferta (si existe) a un precio dado. */
export function applyDiscount(price, product) {
  const base = Number(price) || 0;
  if (!hasDiscount(product)) return base;
  return base * (1 - Number(product.discount_percent) / 100);
}

/** Precio de lista (sin oferta) del nivel indicado, con fallback a price1. */
export function getTierBasePrice(product, tier = 1) {
  if (!product) return 0;
  const candidates = [product.price1, product.price2, product.price3];
  const value = Number(candidates[tier - 1]);
  return Number.isFinite(value) && value > 0 ? value : Number(product.price1) || 0;
}

/** Precio final por unidad: nivel del carrito + oferta. */
export function getUnitPrice(product, tier = 1) {
  return applyDiscount(getTierBasePrice(product, tier), product);
}

/** Precio público mostrado en las tarjetas del catálogo (Nivel 1 con oferta). */
export function getDisplayPrice(product) {
  return getUnitPrice(product, 1);
}

/** Nivel de precios que corresponde a un subtotal de lista. */
export function getTier(listTotal) {
  if (listTotal >= TIER_3_THRESHOLD) return 3;
  if (listTotal >= TIER_2_THRESHOLD) return 2;
  return 1;
}

/** Monto que falta para desbloquear el siguiente nivel (0 si ya está en el máximo). */
export function amountToNextTier(listTotal) {
  if (listTotal >= TIER_3_THRESHOLD) return 0;
  const target = listTotal >= TIER_2_THRESHOLD ? TIER_3_THRESHOLD : TIER_2_THRESHOLD;
  return Math.max(0, target - listTotal);
}

/**
 * Totales del carrito.
 * El nivel se decide con los precios de lista (price1) para que el escalón no dependa del descuento.
 */
export function computeCartTotals(items = []) {
  const listTotal = items.reduce(
    (acc, item) => acc + (Number(item.price1) || 0) * (Number(item.quantity) || 0),
    0
  );
  const tier = getTier(listTotal);

  const subtotal = items.reduce(
    (acc, item) => acc + getUnitPrice(item, tier) * (Number(item.quantity) || 0),
    0
  );

  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

  return {
    listTotal,
    tier,
    subtotal,
    shipping,
    total: subtotal + shipping,
    missingForNextTier: amountToNextTier(listTotal),
  };
}
