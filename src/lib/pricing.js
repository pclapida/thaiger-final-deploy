/**
 * Lógica única de precios de Thaiger.
 *
 * Reglas:
 *  - Precios escalonados por monto del carrito: Nivel 1 (price1), Nivel 2 (price2), Nivel 3 (price3).
 *  - Un producto "en oferta" aplica su porcentaje de descuento sobre el precio del nivel vigente.
 *  - Envío gratis a partir del umbral configurado.
 *
 * Los umbrales son configurables desde el panel de administración: al arrancar,
 * `services/api` llama a `configurePricing()` con lo guardado en los ajustes.
 * Aquí sólo vive la aritmética, para poder probarla sin montar React.
 */

/** Valores con los que arranca una instalación limpia. */
export const DEFAULT_PRICING = {
  tier2From: 10000,
  tier3From: 20000,
  freeShippingFrom: 5000,
  shippingCost: 250,
};

// Compatibilidad: siguen exportándose como constantes de referencia.
export const TIER_2_THRESHOLD = DEFAULT_PRICING.tier2From;
export const TIER_3_THRESHOLD = DEFAULT_PRICING.tier3From;
export const FREE_SHIPPING_THRESHOLD = DEFAULT_PRICING.freeShippingFrom;
export const SHIPPING_COST = DEFAULT_PRICING.shippingCost;

let config = { ...DEFAULT_PRICING };

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

/** Aplica los umbrales guardados en los ajustes de la tienda. */
export function configurePricing(patch = {}) {
  config = {
    tier2From: positiveNumber(patch.tier2From, config.tier2From),
    tier3From: positiveNumber(patch.tier3From, config.tier3From),
    freeShippingFrom: positiveNumber(patch.freeShippingFrom, config.freeShippingFrom),
    shippingCost: positiveNumber(patch.shippingCost, config.shippingCost),
  };

  // El nivel 3 nunca puede pedir menos dinero que el nivel 2.
  if (config.tier3From < config.tier2From) config.tier3From = config.tier2From;

  return getPricingConfig();
}

export function getPricingConfig() {
  return { ...config };
}

/** Sólo para pruebas y para el botón de "restaurar" del panel. */
export function resetPricingConfig() {
  config = { ...DEFAULT_PRICING };
  return getPricingConfig();
}

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
  if (listTotal >= config.tier3From) return 3;
  if (listTotal >= config.tier2From) return 2;
  return 1;
}

/** Monto que falta para desbloquear el siguiente nivel (0 si ya está en el máximo). */
export function amountToNextTier(listTotal) {
  if (listTotal >= config.tier3From) return 0;
  const target = listTotal >= config.tier2From ? config.tier3From : config.tier2From;
  return Math.max(0, target - listTotal);
}

/** Costo de envío para un subtotal dado. */
export function getShippingCost(subtotal) {
  if (subtotal === 0) return 0;
  return subtotal >= config.freeShippingFrom ? 0 : config.shippingCost;
}

/** Cuánto falta para el envío gratis (0 si ya lo alcanzó). */
export function amountToFreeShipping(subtotal) {
  return Math.max(0, config.freeShippingFrom - subtotal);
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

  const shipping = getShippingCost(subtotal);

  // Lo que el cliente se ahorra frente al precio público sin oferta.
  const savings = items.reduce((acc, item) => {
    const publicPrice = getTierBasePrice(item, 1);
    const paid = getUnitPrice(item, tier);
    return acc + Math.max(0, publicPrice - paid) * (Number(item.quantity) || 0);
  }, 0);

  return {
    listTotal,
    tier,
    subtotal,
    shipping,
    savings,
    total: subtotal + shipping,
    missingForNextTier: amountToNextTier(listTotal),
    missingForFreeShipping: amountToFreeShipping(subtotal),
    itemCount: items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0),
  };
}
