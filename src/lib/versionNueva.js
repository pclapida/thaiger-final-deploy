/**
 * Cuando se publica una versión nueva, los archivos de la anterior dejan de
 * existir (cada uno lleva un hash en el nombre). Una pestaña abierta desde
 * antes sigue pidiendo los viejos al entrar a una página que aún no cargaba
 * (el panel, el checkout...) y el navegador falla con «Failed to fetch
 * dynamically imported module». La salida es recargar: así baja la versión
 * nueva completa.
 */

/** Mensajes con los que Chrome, Firefox y Safari reportan ese fallo. */
const PATRONES = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /unable to preload css/i,
];

export function esErrorDeVersionNueva(error) {
  const texto = String(error?.message ?? error ?? '');
  return PATRONES.some((patron) => patron.test(texto));
}

const CLAVE = 'thaiger_recarga_por_version';
/** Si ya se recargó hace menos de esto y sigue fallando, no es la versión: no insistir. */
const ESPERA_MS = 30_000;

/**
 * Recarga la página una sola vez. Si ya se recargó hace poco (el fallo no era
 * por versión nueva, o el servidor no responde), devuelve `false` y no hace
 * nada: nunca entra en un ciclo de recargas.
 */
export function recargarUnaVez({ almacen = globalThis.sessionStorage, ahora = Date.now(), recargar } = {}) {
  let ultima = 0;
  try {
    ultima = Number(almacen?.getItem(CLAVE)) || 0;
  } catch {
    /* almacenamiento bloqueado: se recarga igual, una vez */
  }
  if (ahora - ultima < ESPERA_MS) return false;

  try {
    almacen?.setItem(CLAVE, String(ahora));
  } catch {
    /* sin almacenamiento no hay registro, pero sí recarga */
  }
  (recargar ?? (() => globalThis.location.reload()))();
  return true;
}
