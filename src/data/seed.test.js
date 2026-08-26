import { describe, it, expect } from 'vitest';
import { PRODUCTS } from './products.js';
import { buildSeedProducts, normalizeBrand, normalizeCategory, seedStockFor } from './seed.js';

const seed = buildSeedProducts();

describe('normalización del catálogo', () => {
  it('unifica las variantes de marca y categoría', () => {
    expect(normalizeBrand('PSYCHO PHARMA')).toBe('PSYCHOPHARMA');
    expect(normalizeCategory('Proteina')).toBe('Proteína');
    expect(normalizeBrand('MUTANT')).toBe('MUTANT');
  });

  it('ya no quedan categorías duplicadas por el acento', () => {
    const categorias = new Set(seed.map((p) => p.category));
    expect(categorias.has('Proteina')).toBe(false);
    expect(categorias.has('Proteína')).toBe(true);
  });

  it('ya no queda la marca duplicada por el espacio', () => {
    const marcas = new Set(seed.map((p) => p.brand));
    expect(marcas.has('PSYCHO PHARMA')).toBe(false);
    expect(marcas.has('PSYCHOPHARMA')).toBe(true);
  });
});

describe('datos sembrados', () => {
  it('conserva todos los productos originales', () => {
    expect(seed).toHaveLength(PRODUCTS.length);
    expect(new Set(seed.map((p) => p.id)).size).toBe(PRODUCTS.length);
  });

  it('todos traen los campos que usa la tienda', () => {
    for (const producto of seed) {
      expect(typeof producto.stock).toBe('number');
      expect(producto.stock).toBeGreaterThanOrEqual(0);
      expect(typeof producto.is_on_sale).toBe('boolean');
      expect(producto.price1).toBeGreaterThan(0);
    }
  });

  it('es determinista entre ejecuciones', () => {
    expect(buildSeedProducts()).toEqual(seed);
    expect(seedStockFor(17)).toBe(0);
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
});
