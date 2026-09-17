/**
 * POST /functions/v1/generar-guia   (sólo administradores)
 *
 *   { order_id, rate_id? }                       → genera la guía con la paquetería
 *   { order_id, tracking_number, carrier?, tracking_url?, label_url? }
 *                                                → captura una guía comprada a mano
 *
 * Guarda el resultado en orders.shipment. No cambia el estatus: el admin
 * marca «Enviado» cuando el paquete sale de verdad, y ese cambio es el que
 * manda al cliente el correo con el rastreo.
 */
import { fallo, json, leerJson, preflight } from '../_shared/http.ts';
import { clienteAdmin, esAdmin, leerAjustes, usuarioActual } from '../_shared/supabase.ts';
import { armarPaquete } from '../_shared/envios/paquete.ts';
import { origenDeLaTienda, proveedorDeEnvios } from '../_shared/envios/index.ts';
import type { Guia, Tarifa } from '../_shared/envios/tipos.ts';

interface Cuerpo {
  order_id?: string;
  rate_id?: string;
  tracking_number?: string;
  carrier?: string;
  tracking_url?: string;
  label_url?: string;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fallo('Método no permitido.', 405);

  try {
    const usuario = await usuarioActual(req);
    if (!usuario) return fallo('Necesitas iniciar sesión.', 401);
    if (!(await esAdmin(usuario.id))) return fallo('Sólo un administrador puede generar guías.', 403);

    const cuerpo = await leerJson<Cuerpo>(req);
    if (!cuerpo.order_id) return fallo('Falta el pedido.');

    const admin = clienteAdmin();
    const { data: pedido, error } = await admin
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', cuerpo.order_id)
      .maybeSingle();
    if (error) return fallo(error.message, 500);
    if (!pedido) return fallo('El pedido no existe.', 404);

    let guia: Guia;

    if (cuerpo.tracking_number) {
      // Guía comprada fuera (Solo Envíos, sucursal...): sólo se anota.
      guia = {
        provider: 'manual',
        provider_shipment_id: null,
        carrier: String(cuerpo.carrier || 'Paquetería').slice(0, 60),
        service: '',
        tracking_number: String(cuerpo.tracking_number).slice(0, 80),
        tracking_url: cuerpo.tracking_url ? String(cuerpo.tracking_url).slice(0, 400) : null,
        label_url: cuerpo.label_url ? String(cuerpo.label_url).slice(0, 400) : null,
        created_at: new Date().toISOString(),
      };
    } else {
      const ajustes = await leerAjustes();
      const proveedor = proveedorDeEnvios(ajustes);
      if (proveedor.nombre === 'manual') {
        return fallo('La tienda está en modo manual: captura el número de rastreo de la guía que compraste.');
      }

      const origen = origenDeLaTienda(ajustes);
      if (!origen.zip || !origen.street) {
        return fallo('Falta la dirección de origen en Ajustes → Envíos: la paquetería la necesita para la guía.');
      }

      const destino = {
        name: pedido.shipping_info?.fullName,
        street: pedido.shipping_info?.address,
        city: pedido.shipping_info?.city,
        zip: String(pedido.shipping_info?.zip ?? ''),
        phone: pedido.shipping_info?.phone,
        country: 'MX',
      };

      // Peso y medidas desde el catálogo actual de las líneas del pedido.
      const ids = (pedido.order_items ?? []).map((l: { product_id: number }) => l.product_id).filter(Boolean);
      const { data: productos } = await admin.from('products').select('id, weight_g, length_cm, width_cm, height_cm').in('id', ids);
      const porId = new Map((productos ?? []).map((p) => [String(p.id), p]));
      const paquete = {
        ...armarPaquete(
          (pedido.order_items ?? []).map((l: { product_id: number; quantity: number }) => ({
            ...(porId.get(String(l.product_id)) ?? {}),
            quantity: l.quantity,
          }))
        ),
        declared_value: Number(pedido.subtotal) || 0,
        content: 'Suplementos alimenticios',
      };

      // La tarifa que eligió el cliente, si sigue vigente; si no, se recotiza
      // y se toma la que pida el admin o la más barata.
      let providerQuoteId: string | null = pedido.shipping_quote?.package?.provider_quote_id ?? null;
      let tarifa: Tarifa | null = pedido.shipping_quote?.rate ?? null;
      const cotizacionVigente =
        tarifa && pedido.shipping_quote?.provider === proveedor.nombre && !cuerpo.rate_id;

      if (!cotizacionVigente) {
        const nueva = await proveedor.cotizar({ origen, destino, paquete });
        providerQuoteId = nueva.provider_quote_id;
        tarifa = (cuerpo.rate_id && nueva.rates.find((r) => r.id === cuerpo.rate_id)) || nueva.rates[0] || null;
      }
      if (!tarifa) return fallo('No hay tarifas disponibles para este pedido.');

      guia = await proveedor.generarGuia({
        cotizacion: { provider_quote_id: providerQuoteId, rate: tarifa },
        origen,
        destino,
        paquete,
      });
    }

    const { error: errorGuardar } = await admin.from('orders').update({ shipment: guia }).eq('id', pedido.id);
    if (errorGuardar) return fallo(`La guía se generó pero no se pudo guardar: ${errorGuardar.message}`, 500);

    return json({ shipment: guia });
  } catch (error) {
    console.error('generar-guia:', error);
    return fallo((error as Error).message || 'No se pudo generar la guía.', 500);
  }
});
