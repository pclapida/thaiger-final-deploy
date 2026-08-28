import { describe, it, expect } from 'vitest';
import { PRODUCTS, DEMO_BRANDS, DEMO_CATEGORIES } from './products.js';
import {
  buildSeedOrders,
  buildSeedProducts,
  canonicalize,
  comparisonKey,
  normalizeBrand,
  normalizeCategory,
  seedImageFor,
  seedStockFor,
  DEMO_ACCOUNTS,
  DEMO_ADMIN,
  DEMO_CUSTOMER,
  SEED_PRODUCTS,
} from './seed.js';

const seed = buildSeedProducts();

describe('catálogo de demostración', () => {
  it('trae los 32 productos de ejemplo, sin ids repetidos', () => {
    expect(seed).toHaveLength(PRODUCTS.length);
    expect(PRODUCTS).toHaveLength(32);
    expect(new Set(seed.map((p) => p.id)).size).toBe(PRODUCTS.length);
  });

  it('todas las marcas y categorías del catálogo están declaradas', () => {
    const marcas = new Set(DEMO_BRANDS.map((m) => m.name));
    const categorias = new Set(DEMO_CATEGORIES);

    for (const producto of seed) {
      expect(marcas.has(producto.brand)).toBe(true);
      expect(categorias.has(producto.category)).toBe(true);
    }
  });

  it('cubre las ocho categorías y las seis marcas', () => {
    expect(new Set(seed.map((p) => p.category)).size).toBe(DEMO_CATEGORIES.length);
    expect(new Set(seed.map((p) => p.brand)).size).toBe(DEMO_BRANDS.length);
  });

  it('los precios escalonados van de mayor a menor', () => {
    for (const producto of seed) {
      expect(producto.price1).toBeGreaterThan(0);
      expect(producto.price2).toBeLessThanOrEqual(producto.price1);
      expect(producto.price3).toBeLessThanOrEqual(producto.price2);
    }
  });

  it('todos traen los campos que usa la tienda', () => {
    for (const producto of seed) {
      expect(typeof producto.stock).toBe('number');
      expect(producto.stock).toBeGreaterThanOrEqual(0);
      expect(typeof producto.is_on_sale).toBe('boolean');
      expect(producto.description.length).toBeGreaterThan(0);
    }
  });

  it('todos tienen imagen: ya no quedan tarjetas con marcador', () => {
    for (const producto of seed) {
      expect(producto.image_url).toBe(`/images/products/${producto.id}.svg`);
    }
    expect(seedImageFor(7)).toBe('/images/products/7.svg');
  });

  it('es determinista entre ejecuciones', () => {
    expect(buildSeedProducts()).toEqual(seed);
    expect(seedStockFor(15)).toBe(0);
    expect(seedStockFor(1)).toBe(seedStockFor(1));
  });

  it('deja algunos agotados y algunos en oferta para poder probar esos flujos', () => {
    expect(seed.filter((p) => p.stock === 0).length).toBeGreaterThan(0);
    expect(seed.filter((p) => p.is_on_sale).length).toBeGreaterThan(0);
  });

  it('los productos en oferta tienen un porcentaje válido', () => {
    for (const producto of seed.filter((p) => p.is_on_sale)) {
      expect(producto.discount_percent).toBeGreaterThan(0);
      expect(producto.discount_percent).toBeLessThan(100);
    }
  });

  it('hay productos en los tres rangos de precio de los filtros', () => {
    expect(seed.some((p) => p.price1 <= 500)).toBe(true);
    expect(seed.some((p) => p.price1 > 500 && p.price1 <= 1000)).toBe(true);
    expect(seed.some((p) => p.price1 > 1000)).toBe(true);
  });

  it('SEED_PRODUCTS es la misma siembra ya calculada', () => {
    expect(SEED_PRODUCTS).toEqual(seed);
  });
});

describe('normalización de marcas y categorías', () => {
  it('la clave de comparación ignora acentos, espacios y mayúsculas', () => {
    expect(comparisonKey('  Proteína  ')).toBe(comparisonKey('PROTEINA'));
    expect(comparisonKey('Pre  Entreno')).toBe('pre entreno');
  });

  it('devuelve el valor canónico del catálogo', () => {
    // El bug histórico: "Proteina" y "Proteína" salían como dos casillas.
    expect(normalizeCategory('proteina')).toBe('Proteína');
    expect(normalizeCategory('PROTEÍNA')).toBe('Proteína');
    expect(normalizeBrand('iron peak')).toBe('IRON PEAK');
    expect(normalizeBrand('  Volt   Supps ')).toBe('VOLT SUPPS');
  });

  it('respeta un valor nuevo que no está en la lista', () => {
    expect(normalizeBrand('MARCA NUEVA')).toBe('MARCA NUEVA');
    expect(canonicalize('  algo   raro ', [])).toBe('algo raro');
    expect(canonicalize('   ', ['X'])).toBe('');
  });
});

describe('cuentas de demostración', () => {
  it('define un administrador y un cliente', () => {
    expect(DEMO_ACCOUNTS).toHaveLength(2);
    expect(DEMO_ADMIN.role).toBe('admin');
    expect(DEMO_CUSTOMER.role).toBe('user');
  });

  it('sus contraseñas cumplen la política de seguridad', async () => {
    const { validatePassword } = await import('../lib/security.js');
    for (const cuenta of DEMO_ACCOUNTS) {
      expect(validatePassword(cuenta.password)).toBeNull();
    }
  });
});

describe('pedidos de demostración', () => {
  const referencia = Date.parse('2026-08-27T12:00:00.000Z');
  const pedidos = buildSeedOrders('cliente-1', SEED_PRODUCTS, referencia);

  it('crea varios pedidos repartidos en el tiempo', () => {
    expect(pedidos.length).toBeGreaterThanOrEqual(5);
    const fechas = pedidos.map((p) => new Date(p.created_at).getTime());
    expect(new Set(fechas).size).toBe(pedidos.length);
    expect(Math.max(...fechas)).toBeLessThanOrEqual(referencia);
  });

  it('todos pertenecen al cliente indicado', () => {
    for (const pedido of pedidos) expect(pedido.user_id).toBe('cliente-1');
  });

  it('el total cuadra con los artículos más el envío', () => {
    for (const pedido of pedidos) {
      const subtotal = pedido.order_items.reduce(
        (acc, item) => acc + item.price_at_purchase * item.quantity,
        0
      );
      const envio = subtotal >= 5000 ? 0 : 250;
      expect(pedido.total).toBeCloseTo(subtotal + envio, 2);
      expect(pedido.order_items.length).toBeGreaterThan(0);
    }
  });

  it('cubre varios estados para que el panel tenga qué mostrar', () => {
    const estados = new Set(pedidos.map((p) => p.status));
    expect(estados.size).toBeGreaterThanOrEqual(3);
    expect(estados.has('Entregado')).toBe(true);
    expect(estados.has('Pago Pendiente')).toBe(true);
  });

  it('es determinista con la misma referencia de tiempo', () => {
    expect(buildSeedOrders('cliente-1', SEED_PRODUCTS, referencia)).toEqual(pedidos);
  });

  it('ignora artículos de productos que ya no existen', () => {
    const sinCatalogo = buildSeedOrders('cliente-1', [], referencia);
    for (const pedido of sinCatalogo) expect(pedido.order_items).toHaveLength(0);
  });
});
