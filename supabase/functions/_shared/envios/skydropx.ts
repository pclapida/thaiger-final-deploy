/**
 * Skydropx PRO (https://pro.skydropx.com) — cotización y generación de guías.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CONTRATO A VERIFICAR CON EL SANDBOX.                                     │
 * │                                                                          │
 * │ Este adaptador se escribió a partir de la documentación pública          │
 * │ (docs.skydropx.com) sin credenciales para probarlo en vivo. El flujo     │
 * │ (token OAuth → POST /quotations → GET /quotations/:id hasta              │
 * │ is_completed → POST /shipments con quotation_id + rate_id) es el         │
 * │ documentado; los NOMBRES EXACTOS de campo se concentran en               │
 * │ `armarCotizacion`, `leerTarifas`, `armarEnvio` y `leerGuia` para que     │
 * │ ajustarlos con la primera respuesta real sea cosa de minutos. La lectura │
 * │ de la respuesta busca las claves por nombre a cualquier profundidad     │
 * │ (`buscarClave`), así que tolera cambios de forma.                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Secretos: SKYDROPX_CLIENT_ID, SKYDROPX_CLIENT_SECRET,
 *           SKYDROPX_BASE_URL (opcional; sandbox: https://sb-pro.skydropx.com)
 */
import type { Cotizacion, Direccion, Guia, Paquete, Proveedor, Tarifa } from './tipos.ts';
import { buscarClave } from './paquete.ts';

const BASE_POR_DEFECTO = 'https://pro.skydropx.com';
const ESPERA_MS = 1500;
const INTENTOS = 8;

interface Credenciales {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
}

// ---------------------------------------------------------------- mapeos

export function armarCotizacion({ origen, destino, paquete }: { origen: Direccion; destino: Direccion; paquete: Paquete }) {
  return {
    quotation: {
      address_from: {
        country_code: origen.country || 'MX',
        postal_code: origen.zip,
        area_level1: origen.state || '',
        area_level2: origen.city || '',
        area_level3: origen.neighborhood || '',
      },
      address_to: {
        country_code: destino.country || 'MX',
        postal_code: destino.zip,
        area_level1: destino.state || '',
        area_level2: destino.city || '',
        area_level3: destino.neighborhood || '',
      },
      parcels: [
        {
          length: paquete.length_cm,
          width: paquete.width_cm,
          height: paquete.height_cm,
          weight: paquete.weight_kg,
        },
      ],
    },
  };
}

/** El arreglo con ese nombre, esté donde esté en la respuesta. */
function buscarArreglo(objeto: unknown, clave: string, profundidad = 0): unknown[] | null {
  if (profundidad > 8 || objeto === null || typeof objeto !== 'object') return null;
  if (Array.isArray(objeto)) {
    for (const elemento of objeto) {
      const hallado = buscarArreglo(elemento, clave, profundidad + 1);
      if (hallado) return hallado;
    }
    return null;
  }
  const registro = objeto as Record<string, unknown>;
  if (Array.isArray(registro[clave])) return registro[clave] as unknown[];
  for (const valor of Object.values(registro)) {
    const hallado = buscarArreglo(valor, clave, profundidad + 1);
    if (hallado) return hallado;
  }
  return null;
}

/** Normaliza la lista de tarifas de Skydropx al formato de la tienda. */
export function leerTarifas(respuesta: unknown): Tarifa[] {
  const lista = buscarArreglo(respuesta, 'rates');
  if (!lista) return [];

  const tarifas: Tarifa[] = [];
  for (const cruda of lista) {
    const r = (cruda ?? {}) as Record<string, unknown>;
    // Skydropx marca con success=false las paqueterías que no cubren la ruta.
    if (r.success === false) continue;

    const monto = Number(r.total ?? r.amount ?? r.total_pricing ?? r.price);
    if (!Number.isFinite(monto) || monto <= 0) continue;

    tarifas.push({
      id: String(r.id ?? ''),
      carrier: String(r.provider_name ?? r.provider ?? r.carrier ?? r.provider_display_name ?? 'Paquetería'),
      service: String(r.provider_service_name ?? r.service_level_name ?? r.service ?? r.service_level_code ?? ''),
      amount: Math.round(monto * 100) / 100,
      currency: String(r.currency ?? r.currency_code ?? 'MXN'),
      days: Number.isFinite(Number(r.days)) ? Number(r.days) : null,
      raw: cruda,
    });
  }

  return tarifas.filter((t) => t.id).sort((a, b) => a.amount - b.amount);
}

function direccionCompleta(d: Direccion) {
  return {
    name: d.name || d.company || 'Tienda',
    company: d.company || '',
    street1: d.street || '',
    neighborhood: d.neighborhood || '',
    city: d.city || '',
    state: d.state || '',
    postal_code: d.zip,
    country_code: d.country || 'MX',
    phone: d.phone || '',
    email: d.email || '',
  };
}

export function armarEnvio({
  cotizacion,
  origen,
  destino,
  paquete,
}: {
  cotizacion: { provider_quote_id: string | null; rate: Tarifa };
  origen: Direccion;
  destino: Direccion;
  paquete: Paquete;
}) {
  return {
    shipment: {
      quotation_id: cotizacion.provider_quote_id,
      rate_id: cotizacion.rate.id,
      address_from: direccionCompleta(origen),
      address_to: direccionCompleta(destino),
      parcels: [
        {
          length: paquete.length_cm,
          width: paquete.width_cm,
          height: paquete.height_cm,
          weight: paquete.weight_kg,
          content: paquete.content || 'Suplementos alimenticios',
          declared_value: paquete.declared_value ?? 0,
        },
      ],
    },
  };
}

export function leerGuia(respuesta: unknown, tarifa: Tarifa): Guia {
  const tracking = buscarClave(respuesta, ['tracking_number', 'master_tracking_number', 'tracking']);
  const etiqueta = buscarClave(respuesta, ['label_url', 'label', 'pdf_url', 'label_pdf']);
  const rastreoUrl = buscarClave(respuesta, ['tracking_url', 'tracking_link']);
  const id = buscarClave(respuesta, ['id']);

  if (!tracking) throw new Error('Skydropx no devolvió número de rastreo; revisa la respuesta en los logs.');

  return {
    provider: 'skydropx',
    provider_shipment_id: id != null ? String(id) : null,
    carrier: tarifa.carrier,
    service: tarifa.service,
    tracking_number: String(tracking),
    tracking_url: rastreoUrl ? String(rastreoUrl) : null,
    label_url: etiqueta ? String(etiqueta) : null,
    created_at: new Date().toISOString(),
  };
}

// ------------------------------------------------------------------ HTTP

async function obtenerToken({ clientId, clientSecret, baseUrl }: Credenciales): Promise<string> {
  const respuesta = await fetch(`${baseUrl || BASE_POR_DEFECTO}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
  });
  const datos = await respuesta.json().catch(() => ({}));
  const token = buscarClave(datos, ['access_token']);
  if (!respuesta.ok || !token) throw new Error(`Skydropx no entregó token (${respuesta.status}).`);
  return String(token);
}

async function llamar(cred: Credenciales, token: string, ruta: string, init: RequestInit = {}) {
  const respuesta = await fetch(`${cred.baseUrl || BASE_POR_DEFECTO}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    console.error('skydropx', ruta, respuesta.status, JSON.stringify(datos).slice(0, 800));
    throw new Error(`Skydropx respondió ${respuesta.status} en ${ruta}.`);
  }
  return datos;
}

const dormir = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

export function proveedorSkydropx(cred: Credenciales): Proveedor {
  return {
    nombre: 'skydropx',

    async cotizar({ origen, destino, paquete }): Promise<Cotizacion> {
      const token = await obtenerToken(cred);
      let respuesta = await llamar(cred, token, '/api/v1/quotations', {
        method: 'POST',
        body: JSON.stringify(armarCotizacion({ origen, destino, paquete })),
      });

      const id = buscarClave(respuesta, ['id']);
      if (!id) throw new Error('Skydropx no devolvió el id de la cotización.');

      // La cotización se completa poco a poco: se consulta hasta que termine.
      for (let intento = 0; intento < INTENTOS; intento += 1) {
        const completa = buscarClave(respuesta, ['is_completed']);
        if (completa === true) break;
        await dormir(ESPERA_MS);
        respuesta = await llamar(cred, token, `/api/v1/quotations/${id}`);
      }

      const rates = leerTarifas(respuesta);
      if (rates.length === 0) throw new Error('Ninguna paquetería cubre esa ruta con ese paquete.');

      return {
        provider: 'skydropx',
        provider_quote_id: String(id),
        rates,
        // Skydropx mantiene las tarifas 24 h; se guarda con margen.
        expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      };
    },

    async generarGuia({ cotizacion, origen, destino, paquete }): Promise<Guia> {
      const token = await obtenerToken(cred);
      const respuesta = await llamar(cred, token, '/api/v1/shipments', {
        method: 'POST',
        body: JSON.stringify(armarEnvio({ cotizacion, origen, destino, paquete })),
      });
      return leerGuia(respuesta, cotizacion.rate);
    },
  };
}
