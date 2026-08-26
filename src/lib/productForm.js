/** Validación y normalización del formulario de productos del panel de administración. */

/** Normaliza y valida el formulario. Devuelve `{ payload }` o `{ error }`. */
export function buildProductPayload(form) {
  const name = String(form.name || '').trim();
  const brand = String(form.brand || '').trim();
  const category = String(form.category || '').trim();
  const price1 = Number(form.price1);

  if (!name || !brand || !category) {
    return { error: 'Nombre, marca y categoría son obligatorios.' };
  }
  if (!(price1 > 0)) {
    return { error: 'El precio público debe ser mayor a cero.' };
  }

  const stock = Number(form.stock);
  const discount = Number(form.discount_percent);
  const price2 = Number(form.price2);
  const price3 = Number(form.price3);

  return {
    payload: {
      name,
      brand,
      category,
      description: String(form.description || '').trim(),
      price1,
      // Si no se capturan los niveles 2 y 3, se cobra el precio público.
      price2: price2 > 0 ? price2 : price1,
      price3: price3 > 0 ? price3 : price1,
      image_url: form.image_url || null,
      stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
      is_on_sale: Boolean(form.is_on_sale),
      discount_percent: form.is_on_sale && discount > 0 ? discount : 0,
    },
  };
}
