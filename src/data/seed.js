import { PRODUCTS, DEMO_BRANDS, DEMO_CATEGORIES } from './products.js';

/**
 * Siembra de la tienda de DEMOSTRACIÓN.
 *
 * `products.js` sólo trae marca, nombre, categoría, precios y descripción.
 * Aquí se completan los campos que usa la tienda (stock, foto, ofertas) y se
 * definen las cuentas y los pedidos de ejemplo, de forma determinista: la demo
 * se ve igual en cualquier navegador.
 */

// Rango de marcas diacríticas, escrito así para no meter escapes Unicode en el fuente.
const DIACRITICOS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');

/** Clave de comparación: sin acentos, sin espacios de más y en minúsculas. */
export function comparisonKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Devuelve el valor canónico de una lista si alguno coincide ignorando acentos
 * y capitalización. Así "proteina" y "PROTEINA" acaban siendo "Proteína" y no
 * aparecen tres casillas distintas en los filtros de la tienda.
 */
export function canonicalize(value, known = []) {
  const limpio = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio) return '';

  const clave = comparisonKey(limpio);
  const encontrado = known.find((entrada) => comparisonKey(entrada) === clave);
  return encontrado || limpio;
}

export function normalizeBrand(brand, known = DEMO_BRANDS.map((m) => m.name)) {
  return canonicalize(brand, known);
}

export function normalizeCategory(category, known = DEMO_CATEGORIES) {
  return canonicalize(category, known);
}

// --------------------------------------------------------------- inventario

/** Productos que arrancan agotados, para poder probar ese flujo. */
const AGOTADOS = new Set([15, 27]);

/** Ofertas iniciales: id -> porcentaje de descuento. */
const OFERTAS = new Map([
  [3, 20],
  [9, 15],
  [13, 10],
  [21, 25],
  [26, 15],
  [31, 20],
]);

export function seedStockFor(id) {
  if (AGOTADOS.has(id)) return 0;
  // Determinista y con variedad: algunos quedan en stock bajo (aviso amarillo).
  return 3 + ((id * 7) % 38);
}

export function seedSaleFor(id) {
  const percent = OFERTAS.get(id);
  if (!percent) return { is_on_sale: false, discount_percent: 0 };
  return { is_on_sale: true, discount_percent: percent };
}

/** Toda la demo tiene ilustración generada; ya no hay tarjetas sin foto. */
export function seedImageFor(id) {
  return `/images/products/${id}.svg`;
}

export function buildSeedProducts() {
  return PRODUCTS.map((product) => ({
    id: product.id,
    brand: normalizeBrand(product.brand),
    category: normalizeCategory(product.category),
    name: product.name,
    description: product.description || '',
    price1: product.price1,
    price2: product.price2,
    price3: product.price3,
    stock: seedStockFor(product.id),
    image_url: seedImageFor(product.id),
    ...seedSaleFor(product.id),
    created_at: '2026-01-01T00:00:00.000Z',
  }));
}

/** Catálogo listo para usar como respaldo de sólo lectura. */
export const SEED_PRODUCTS = buildSeedProducts();

// ------------------------------------------------------------------ cuentas

/**
 * Cuentas de DEMOSTRACIÓN. Se crean vacías en cada navegador y sus contraseñas
 * se guardan derivadas con PBKDF2 (ver src/lib/security.js), nunca en claro.
 */
export const DEMO_ACCOUNTS = [
  {
    email: 'admin@thaiger.mx',
    password: 'admin123',
    name: 'Admin de Prueba',
    role: 'admin',
  },
  {
    email: 'cliente@thaiger.mx',
    password: 'cliente123',
    name: 'Cliente de Prueba',
    role: 'user',
  },
];

/** La cuenta que el login ofrece rellenar en modo local. */
export const DEMO_ADMIN = DEMO_ACCOUNTS[0];
export const DEMO_CUSTOMER = DEMO_ACCOUNTS[1];

// ------------------------------------------------------------------ pedidos

/**
 * Pedidos de ejemplo del cliente de prueba, repartidos en los últimos meses
 * para que el panel arranque con una gráfica de ingresos que se pueda ver.
 * Las fechas se calculan a partir de `referencia` (hoy, salvo en pruebas).
 */
const PEDIDOS_DEMO = [
  { diasAtras: 96, status: 'Entregado', items: [[1, 2], [3, 1]] },
  { diasAtras: 74, status: 'Entregado', items: [[13, 1], [30, 3]] },
  { diasAtras: 51, status: 'Entregado', items: [[8, 2], [11, 1], [23, 2]] },
  { diasAtras: 33, status: 'Enviado', items: [[24, 1], [28, 1]] },
  { diasAtras: 12, status: 'En Proceso', items: [[19, 1], [20, 2], [31, 1]] },
  { diasAtras: 3, status: 'Pago Pendiente', items: [[4, 1], [6, 2]] },
];

const ENVIO_DEMO = {
  fullName: 'Cliente de Prueba',
  phone: '5500000000',
  address: 'Calle Demo 000, Int. 1',
  city: 'CDMX',
  zip: '01000',
};

/**
 * Arma los pedidos de ejemplo. Necesita el id del cliente y el catálogo ya
 * sembrado para copiar nombres y precios reales del momento de la compra.
 */
export function buildSeedOrders(userId, productos = SEED_PRODUCTS, referencia = Date.now()) {
  const porId = new Map(productos.map((p) => [p.id, p]));

  return PEDIDOS_DEMO.map((pedido, indice) => {
    const fecha = new Date(referencia - pedido.diasAtras * 24 * 60 * 60 * 1000);

    const items = pedido.items
      .map(([productId, quantity]) => {
        const producto = porId.get(productId);
        if (!producto) return null;
        return {
          id: `demo-item-${indice + 1}-${productId}`,
          product_id: producto.id,
          product_name: producto.name,
          quantity,
          price_at_purchase: producto.price1,
        };
      })
      .filter(Boolean);

    const subtotal = items.reduce((acc, item) => acc + item.price_at_purchase * item.quantity, 0);
    const envio = subtotal >= 5000 ? 0 : 250;

    return {
      id: `demo-order-${indice + 1}`,
      user_id: userId,
      status: pedido.status,
      total: Number((subtotal + envio).toFixed(2)),
      shipping_info: ENVIO_DEMO,
      payment_info: { method: 'SPEI', concepto: `TH-${9000 + indice}`, banco: 'BANCO DEMO' },
      created_at: fecha.toISOString(),
      is_demo: true,
      order_items: items,
    };
  });
}
