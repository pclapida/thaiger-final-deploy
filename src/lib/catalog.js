/**
 * Filtrado, búsqueda y orden del catálogo.
 * Vive aparte de la página para poder probarlo sin montar React.
 */

import { getDisplayPrice } from './pricing';

export const PRICE_RANGES = ['Hasta $500', '$500 - $1000', '+$1000'];

export const EMPTY_FILTERS = { category: [], brand: [], price: [], search: '' };

/** Comparación laxa: marcas y categorías llegan con distinta capitalización. */
export function includesLoose(list, value) {
  return list.some((entry) => String(entry).toLowerCase() === String(value).toLowerCase());
}

export function matchesPriceRange(price, range) {
  if (range === 'Hasta $500') return price <= 500;
  if (range === '$500 - $1000') return price > 500 && price <= 1000;
  if (range === '+$1000') return price > 1000;
  return false;
}

/** Filtros iniciales a partir del `state` con el que se navegó a /shop. */
export function filtersFromLocation(state) {
  return {
    ...EMPTY_FILTERS,
    brand: state?.brand ? [state.brand] : [],
    search: state?.search || '',
  };
}

/** Alterna un valor dentro de un grupo de filtros. */
export function toggleFilter(filters, group, value) {
  const current = filters[group];
  return {
    ...filters,
    [group]: includesLoose(current, value)
      ? current.filter((entry) => String(entry).toLowerCase() !== String(value).toLowerCase())
      : [...current, value],
  };
}

export function hasActiveFilters(filters) {
  return (
    filters.category.length > 0 ||
    filters.brand.length > 0 ||
    filters.price.length > 0 ||
    filters.search.trim() !== ''
  );
}

/** Listas únicas de marcas y categorías presentes en el catálogo. */
export function buildFilterGroups(products) {
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort();

  return [
    { id: 'category', title: 'Categorías', items: categories },
    { id: 'brand', title: 'Marcas', items: brands },
    { id: 'price', title: 'Precio', items: PRICE_RANGES },
  ];
}

/** Aplica filtros y orden. El precio considerado es el de venta (con oferta). */
export function applyCatalogFilters(list, filters, sortBy = 'relevance') {
  const terms = String(filters.search || '')
    .toLowerCase()
    .split(' ')
    .filter((term) => term.trim() !== '');

  const result = list.filter((product) => {
    const categoryMatch =
      filters.category.length === 0 || includesLoose(filters.category, product.category);
    const brandMatch = filters.brand.length === 0 || includesLoose(filters.brand, product.brand || '');

    const price = getDisplayPrice(product);
    const priceMatch =
      filters.price.length === 0 || filters.price.some((range) => matchesPriceRange(price, range));

    const searchMatch =
      terms.length === 0 ||
      terms.every((term) =>
        [product.name, product.brand, product.category]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term))
      );

    return categoryMatch && brandMatch && priceMatch && searchMatch;
  });

  switch (sortBy) {
    case 'price_asc':
      return result.sort((a, b) => getDisplayPrice(a) - getDisplayPrice(b));
    case 'price_desc':
      return result.sort((a, b) => getDisplayPrice(b) - getDisplayPrice(a));
    case 'name_asc':
      return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    case 'name_desc':
      return result.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    default:
      return result;
  }
}

/** Marcas del catálogo con su conteo y una foto representativa. */
export function buildBrandSummary(products) {
  const map = new Map();

  for (const product of products) {
    const name = product.brand;
    if (!name) continue;

    if (!map.has(name)) map.set(name, { name, count: 0, image: null });
    const entry = map.get(name);
    entry.count += 1;
    if (!entry.image && product.image_url) entry.image = product.image_url;
  }

  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
