/**
 * Clientes de Supabase dentro de las Edge Functions.
 *
 * - `clienteDeUsuario(req)` lleva el JWT de quien llama: la RLS aplica igual
 *   que en el navegador, así que un cliente no puede leer pedidos ajenos.
 * - `clienteAdmin()` usa la service_role: salta la RLS. Sólo para lo que el
 *   servidor tiene que hacer a nombre de la tienda (marcar pagos, guardar
 *   cotizaciones, leer el correo de un usuario para avisarle).
 *
 * SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY las inyecta la
 * plataforma en toda Edge Function; no hay que configurarlas a mano.
 */
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

const URL_PROYECTO = Deno.env.get('SUPABASE_URL') ?? '';
const LLAVE_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const LLAVE_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export function clienteAdmin(): SupabaseClient {
  return createClient(URL_PROYECTO, LLAVE_SERVICIO, { auth: { persistSession: false } });
}

export function clienteDeUsuario(req: Request): SupabaseClient {
  return createClient(URL_PROYECTO, LLAVE_ANON, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
}

/** Quién llama, o null si no trae sesión válida. */
export async function usuarioActual(req: Request): Promise<User | null> {
  const { data, error } = await clienteDeUsuario(req).auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/** El rol vive en public.users, no en el JWT: se consulta con la service_role. */
export async function esAdmin(userId: string): Promise<boolean> {
  const { data } = await clienteAdmin().from('users').select('role').eq('id', userId).maybeSingle();
  return data?.role === 'admin';
}

/** La fila única de configuración de la tienda (settings.value). */
export async function leerAjustes(): Promise<Record<string, any>> {
  const { data } = await clienteAdmin().from('settings').select('value').eq('id', 'site').maybeSingle();
  return (data?.value as Record<string, any>) ?? {};
}

/** Referencia corta del pedido, igual que la que ve el cliente en la tienda. */
export function referenciaPedido(id: string): string {
  return `TH-${String(id).split('-')[0].toUpperCase()}`;
}

/** URL pública de otra función de este mismo proyecto. */
export function urlDeFuncion(nombre: string): string {
  return `${URL_PROYECTO}/functions/v1/${nombre}`;
}
