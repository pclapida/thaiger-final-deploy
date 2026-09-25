/**
 * Fotos de un producto.
 *
 * `image_url` sigue siendo la foto principal: la usan la tarjeta del catálogo,
 * el carrito, los favoritos y los correos, así que nada de eso cambia.
 * `gallery` son las fotos adicionales que se ven en la ficha del producto.
 */
import { sanitizeImageUrl } from './security';

/** Fotos adicionales por producto (sin contar la principal). */
export const MAX_FOTOS_EXTRA = 8;

/**
 * Deja la galería lista para guardar: sólo URLs seguras, sin repetidas, sin
 * la foto principal y como mucho `MAX_FOTOS_EXTRA`.
 */
export function normalizarGaleria(lista, principal = null) {
  if (!Array.isArray(lista)) return [];
  const vistas = new Set(principal ? [principal] : []);
  const limpias = [];

  for (const valor of lista) {
    const url = sanitizeImageUrl(valor);
    if (!url || vistas.has(url)) continue;
    vistas.add(url);
    limpias.push(url);
    if (limpias.length === MAX_FOTOS_EXTRA) break;
  }
  return limpias;
}

/** Todas las fotos de un producto, la principal primero. */
export function fotosDeProducto(producto) {
  const principal = sanitizeImageUrl(producto?.image_url);
  const extra = normalizarGaleria(producto?.gallery, principal);
  return principal ? [principal, ...extra] : extra;
}

/**
 * Pasa cada foto de un producto por `transformar(url)` —que devuelve la URL
 * nueva, o `null` si esa foto se queda igual— y arma el cambio a guardar.
 *
 * Una foto que falla se queda como estaba: nunca se pierde una foto por un
 * error a medio camino. Devuelve `{ cambio, cambiadas, fallidas }`; `cambio`
 * es `null` si no hubo nada que guardar.
 */
export async function transformarFotos(producto, transformar) {
  const principal = sanitizeImageUrl(producto?.image_url);
  const nuevas = [];
  let cambiadas = 0;
  let fallidas = 0;

  for (const url of fotosDeProducto(producto)) {
    try {
      const nueva = await transformar(url);
      if (nueva) {
        nuevas.push(nueva);
        cambiadas += 1;
      } else {
        nuevas.push(url);
      }
    } catch {
      nuevas.push(url);
      fallidas += 1;
    }
  }

  if (cambiadas === 0) return { cambio: null, cambiadas, fallidas };
  const cambio = principal ? { image_url: nuevas[0], gallery: nuevas.slice(1) } : { gallery: nuevas };
  return { cambio, cambiadas, fallidas };
}
