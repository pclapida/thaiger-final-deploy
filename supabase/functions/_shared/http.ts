/**
 * Respuestas HTTP de las Edge Functions.
 *
 * El navegador llama a las funciones desde el dominio de la tienda, así que
 * hace falta CORS. Si `SITE_URL` está definida se permite sólo ese origen; si
 * no, cualquiera (útil mientras se prueba).
 */

const ORIGEN_PERMITIDO = Deno.env.get('SITE_URL') ?? '*';

export const CABECERAS_CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': ORIGEN_PERMITIDO,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};

export function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CABECERAS_CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Error legible para la persona que está comprando (llega tal cual al toast). */
export function fallo(mensaje: string, status = 400): Response {
  return json({ error: mensaje }, status);
}

/** Responde al preflight de CORS, o null si no era un OPTIONS. */
export function preflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: CABECERAS_CORS });
}

/** Lee el JSON del cuerpo sin reventar si viene vacío o mal formado. */
export async function leerJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

/** Variable de entorno obligatoria: si falta, es un error de configuración, no del cliente. */
export function requerirEnv(nombre: string): string {
  const valor = Deno.env.get(nombre);
  if (!valor) throw new Error(`Falta configurar el secreto ${nombre} (supabase secrets set ${nombre}=...)`);
  return valor;
}
