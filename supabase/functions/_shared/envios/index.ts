/**
 * Elige el proveedor de envíos según los ajustes de la tienda.
 * Para añadir uno (Envia.com, Pakke...): un archivo con la interfaz Proveedor
 * y una rama aquí.
 */
import type { Direccion, Proveedor } from './tipos.ts';
import { proveedorManual } from './manual.ts';
import { proveedorSkydropx } from './skydropx.ts';

export function proveedorDeEnvios(ajustes: Record<string, any>): Proveedor {
  const nombre = String(ajustes?.shipping?.provider ?? 'manual');

  if (nombre === 'skydropx') {
    const clientId = Deno.env.get('SKYDROPX_CLIENT_ID');
    const clientSecret = Deno.env.get('SKYDROPX_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new Error('Skydropx está activado en los ajustes pero faltan SKYDROPX_CLIENT_ID / SKYDROPX_CLIENT_SECRET.');
    }
    return proveedorSkydropx({ clientId, clientSecret, baseUrl: Deno.env.get('SKYDROPX_BASE_URL') });
  }

  return proveedorManual({
    cost: Number(ajustes?.shipping?.cost),
    freeFrom: Number(ajustes?.shipping?.freeFrom),
    storeName: ajustes?.store?.name,
  });
}

/** La dirección desde la que sale todo, capturada en el panel. */
export function origenDeLaTienda(ajustes: Record<string, any>): Direccion {
  const o = ajustes?.shipping?.origin ?? {};
  return {
    name: o.name || ajustes?.store?.name || 'Tienda',
    company: o.company || ajustes?.store?.name || '',
    street: o.street || '',
    neighborhood: o.neighborhood || '',
    city: o.city || '',
    state: o.state || '',
    zip: String(o.zip || ''),
    phone: o.phone || ajustes?.store?.phone || '',
    email: o.email || ajustes?.store?.email || '',
    country: 'MX',
  };
}
