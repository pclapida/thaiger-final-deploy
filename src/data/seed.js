import { PRODUCTS } from './products.js';

/**
 * El catálogo base (products.js) sólo trae marca, nombre, categoría y precios.
 * Aquí se completan los campos que usa la tienda (stock, foto, ofertas) de forma
 * determinista, para que la demo local se vea igual en cualquier navegador.
 */

// Fotos que ya vienen en el repo, nombradas por id de producto.
const LOCAL_IMAGE_IDS = new Set([1, 2, 4, 5, 6, 7]);

/**
 * El catálogo original trae la misma marca/categoría escrita de dos maneras,
 * lo que partía los filtros de la tienda en dos casillas distintas.
 */
const BRAND_ALIASES = {
  'PSYCHO PHARMA': 'PSYCHOPHARMA',
};

const CATEGORY_ALIASES = {
  Proteina: 'Proteína',
};

export function normalizeBrand(brand) {
  const value = String(brand || '').trim();
  return BRAND_ALIASES[value] || value;
}

export function normalizeCategory(category) {
  const value = String(category || '').trim();
  return CATEGORY_ALIASES[value] || value;
}

export function seedStockFor(id) {
  // ~6% del catálogo aparece agotado para poder probar ese flujo.
  if (id % 17 === 0) return 0;
  return 5 + ((id * 13) % 46);
}

export function seedSaleFor(id) {
  if (id % 11 !== 0) return { is_on_sale: false, discount_percent: 0 };
  return { is_on_sale: true, discount_percent: [10, 15, 20, 25][id % 4] };
}

export function seedImageFor(id) {
  return LOCAL_IMAGE_IDS.has(id) ? `/images/products/${id}.jpg` : null;
}

export function buildSeedProducts() {
  return PRODUCTS.map((product) => ({
    ...product,
    brand: normalizeBrand(product.brand),
    category: normalizeCategory(product.category),
    stock: seedStockFor(product.id),
    image_url: seedImageFor(product.id),
    description: '',
    ...seedSaleFor(product.id),
  }));
}

/** Catálogo listo para usar como respaldo de sólo lectura. */
export const SEED_PRODUCTS = buildSeedProducts();
