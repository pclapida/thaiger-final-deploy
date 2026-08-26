import { describe, it, expect } from 'vitest';
import {
  applyCatalogFilters,
  buildBrandSummary,
  buildFilterGroups,
  EMPTY_FILTERS,
  filtersFromLocation,
  hasActiveFilters,
  includesLoose,
  matchesPriceRange,
  toggleFilter,
} from './catalog';

const catalogo = [
  { id: 1, name: 'Whey Vainilla', brand: 'MUTANT', category: 'Proteína', price1: 1200, image_url: '/a.jpg' },
  { id: 2, name: 'Creatina 300g', brand: 'MUTANT', category: 'Creatina', price1: 700 },
  { id: 3, name: 'Pre-entreno Uva', brand: 'INSANE LABZ', category: 'Pre-Entreno', price1: 450 },
  {
    id: 4,
    name: 'Quemador Extremo',
    brand: 'EVOGEN',
    category: 'Quemador',
    price1: 1000,
    is_on_sale: true,
    discount_percent: 50, // precio efectivo 500
  },
];

const filtros = (extra) => ({ ...EMPTY_FILTERS, ...extra });

describe('rangos de precio', () => {
  it('clasifica correctamente los límites', () => {
    expect(matchesPriceRange(500, 'Hasta $500')).toBe(true);
    expect(matchesPriceRange(500.01, 'Hasta $500')).toBe(false);
    expect(matchesPriceRange(1000, '$500 - $1000')).toBe(true);
    expect(matchesPriceRange(1000.01, '+$1000')).toBe(true);
    expect(matchesPriceRange(100, 'rango inexistente')).toBe(false);
  });
});

describe('comparación laxa', () => {
  it('no distingue mayúsculas', () => {
    expect(includesLoose(['MUTANT'], 'mutant')).toBe(true);
    expect(includesLoose(['MUTANT'], 'Nutrex')).toBe(false);
  });
});

describe('filtros del catálogo', () => {
  it('sin filtros devuelve todo', () => {
    expect(applyCatalogFilters(catalogo, EMPTY_FILTERS)).toHaveLength(4);
  });

  it('filtra por marca aunque cambie la capitalización', () => {
    const resultado = applyCatalogFilters(catalogo, filtros({ brand: ['mutant'] }));
    expect(resultado.map((p) => p.id)).toEqual([1, 2]);
  });

  it('filtra por categoría', () => {
    const resultado = applyCatalogFilters(catalogo, filtros({ category: ['Creatina'] }));
    expect(resultado.map((p) => p.id)).toEqual([2]);
  });

  it('usa el precio con descuento al filtrar por rango', () => {
    // El quemador cuesta 1000 de lista pero 500 con la oferta.
    const resultado = applyCatalogFilters(catalogo, filtros({ price: ['Hasta $500'] }));
    expect(resultado.map((p) => p.id).sort()).toEqual([3, 4]);
  });

  it('la búsqueda exige todas las palabras y mira nombre, marca y categoría', () => {
    expect(applyCatalogFilters(catalogo, filtros({ search: 'mutant whey' })).map((p) => p.id)).toEqual([1]);
    expect(applyCatalogFilters(catalogo, filtros({ search: 'proteína' })).map((p) => p.id)).toEqual([1]);
    expect(applyCatalogFilters(catalogo, filtros({ search: 'no existe' }))).toHaveLength(0);
  });

  it('combina varios filtros', () => {
    const resultado = applyCatalogFilters(catalogo, filtros({ brand: ['MUTANT'], price: ['+$1000'] }));
    expect(resultado.map((p) => p.id)).toEqual([1]);
  });

  it('ordena por precio de venta y por nombre', () => {
    const asc = applyCatalogFilters(catalogo, EMPTY_FILTERS, 'price_asc').map((p) => p.id);
    expect(asc).toEqual([3, 4, 2, 1]);

    const desc = applyCatalogFilters(catalogo, EMPTY_FILTERS, 'price_desc').map((p) => p.id);
    expect(desc).toEqual([1, 2, 4, 3]);

    const az = applyCatalogFilters(catalogo, EMPTY_FILTERS, 'name_asc').map((p) => p.name);
    expect(az[0]).toBe('Creatina 300g');
  });

  it('no muta el arreglo original al ordenar', () => {
    const copia = [...catalogo];
    applyCatalogFilters(catalogo, EMPTY_FILTERS, 'price_desc');
    expect(catalogo).toEqual(copia);
  });
});

describe('estado de los filtros', () => {
  it('arma los filtros iniciales desde la navegación', () => {
    expect(filtersFromLocation({ brand: 'MUTANT' }).brand).toEqual(['MUTANT']);
    expect(filtersFromLocation({ search: 'creatina' }).search).toBe('creatina');
    expect(filtersFromLocation(undefined)).toEqual(EMPTY_FILTERS);
  });

  it('alterna valores sin duplicar', () => {
    const uno = toggleFilter(EMPTY_FILTERS, 'brand', 'MUTANT');
    expect(uno.brand).toEqual(['MUTANT']);

    const dos = toggleFilter(uno, 'brand', 'mutant');
    expect(dos.brand).toEqual([]);
  });

  it('detecta si hay filtros activos', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters(filtros({ search: '   ' }))).toBe(false);
    expect(hasActiveFilters(filtros({ category: ['Salud'] }))).toBe(true);
  });
});

describe('agrupaciones', () => {
  it('arma las listas de filtros ordenadas y sin repetir', () => {
    const grupos = buildFilterGroups(catalogo);
    expect(grupos.find((g) => g.id === 'brand').items).toEqual(['EVOGEN', 'INSANE LABZ', 'MUTANT']);
    expect(grupos.find((g) => g.id === 'price').items).toHaveLength(3);
  });

  it('resume las marcas con conteo y foto', () => {
    const marcas = buildBrandSummary(catalogo);
    expect(marcas[0]).toMatchObject({ name: 'MUTANT', count: 2, image: '/a.jpg' });
    expect(marcas).toHaveLength(3);
  });

  it('ignora productos sin marca', () => {
    expect(buildBrandSummary([{ id: 9, name: 'Suelto' }])).toHaveLength(0);
  });
});
