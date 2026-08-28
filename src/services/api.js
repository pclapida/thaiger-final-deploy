/**
 * Punto único de acceso a datos.
 *
 * - Con credenciales de Supabase en el .env  -> backend remoto.
 * - Sin credenciales                          -> backend local en IndexedDB.
 *
 * Las páginas importan siempre desde aquí y no saben cuál de los dos está
 * activo. Si añades una operación de datos, impleméntala en LOS DOS backends.
 */

import { isSupabaseConfigured } from '../supabase';
import * as localBackend from './localBackend';
import * as supabaseBackend from './supabaseBackend';

const backend = isSupabaseConfigured ? supabaseBackend : localBackend;

export const BACKEND_MODE = backend.mode;
export const IS_LOCAL_MODE = BACKEND_MODE === 'local';

/** Cuentas de demostración (vacías cuando el backend es Supabase). */
export const DEMO_ADMIN = backend.DEMO_ADMIN;
export const DEMO_CUSTOMER = backend.DEMO_CUSTOMER;
export const DEMO_ACCOUNTS = backend.DEMO_ACCOUNTS;

export const products = backend.products;
export const orders = backend.orders;
export const auth = backend.auth;
export const users = backend.users;
export const settings = backend.settings;
export const maintenance = backend.maintenance;

export default backend;
