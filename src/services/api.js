/**
 * Punto único de acceso a datos.
 *
 * - Con credenciales de Supabase en el .env  -> backend remoto.
 * - Sin credenciales                          -> backend local en IndexedDB.
 *
 * Las páginas importan siempre desde aquí y no saben cuál de los dos está activo.
 */

import { isSupabaseConfigured } from '../supabase';
import * as localBackend from './localBackend';
import * as supabaseBackend from './supabaseBackend';

const backend = isSupabaseConfigured ? supabaseBackend : localBackend;

export const BACKEND_MODE = backend.mode;
export const IS_LOCAL_MODE = BACKEND_MODE === 'local';
export const DEMO_ADMIN = localBackend.DEMO_ADMIN;

export const products = backend.products;
export const orders = backend.orders;
export const auth = backend.auth;

export default backend;
