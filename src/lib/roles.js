/**
 * Roles de cuenta y lo que cada uno puede hacer.
 *
 * - `user`: cliente de la tienda.
 * - `catalogo`: carga y edita productos (y sus fotos). Entra al panel, pero
 *   sólo ve la pestaña de productos: ni pedidos, ni cuentas, ni ajustes.
 * - `admin`: todo.
 *
 * En Supabase la frontera real es la RLS (`puede_editar_catalogo()` en
 * scripts/setup_supabase.sql); esto sólo decide qué pinta la aplicación.
 */
export const ROLES = ['user', 'catalogo', 'admin'];

export const ETIQUETAS_ROL = {
  user: 'Cliente',
  catalogo: 'Catálogo',
  admin: 'Administrador',
};

/** Cualquier valor desconocido se trata como cliente: nunca se asciende por error. */
export function normalizarRol(rol) {
  return ROLES.includes(rol) ? rol : 'user';
}

export function esAdmin(rol) {
  return rol === 'admin';
}

/** Admin y catálogo pueden crear, editar y borrar productos. */
export function puedeEditarCatalogo(rol) {
  return rol === 'admin' || rol === 'catalogo';
}

/** Quién puede abrir /dashboard (luego cada pestaña se filtra por rol). */
export function puedeEntrarAlPanel(rol) {
  return puedeEditarCatalogo(rol);
}
