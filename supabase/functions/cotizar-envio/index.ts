/**
 * POST /functions/v1/cotizar-envio
 *   { zip, neighborhood, city, state, items: [{ product_id, quantity }] }
 *
 * Colonia, ciudad y estado del destino son obligatorios para la paquetería:
 * Skydropx responde 422 si falta cualquiera (area_level1/2/3).
 *
 * Pide tarifas a la paquetería para el carrito y el código postal del cliente,
 * y las guarda en shipping_quotes con caducidad. El checkout enseña las
 * tarifas; al confirmar, create_order() lee el precio de la tabla, no del
 * navegador.
 *
 * Con el proveedor "manual" devuelve la tarifa fija de la tienda sin guardar
 * nada (quote_id null): el pedido se crea con la regla de siempre.
 */
import { fallo, json, leerJson, preflight } from '../_shared/http.ts';
import { clienteAdmin, leerAjustes, usuarioActual } from '../_shared/supabase.ts';
import { armarPaquete } from '../_shared/envios/paquete.ts';
import { origenDeLaTienda, proveedorDeEnvios } from '../_shared/envios/index.ts';

interface Cuerpo {
  zip?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  items?: Array<{ product_id: number | string; quantity: number }>;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fallo('Método no permitido.', 405);

  try {
    const usuario = await usuarioActual(req);
    if (!usuario) return fallo('Necesitas iniciar sesión para cotizar el envío.', 401);

    const { zip, items, neighborhood, city, state } = await leerJson<Cuerpo>(req);
    const texto = (valor: unknown, max: number) => String(valor ?? '').trim().slice(0, max);
    const colonia = texto(neighborhood, 80);
    const ciudad = texto(city, 60);
    const estado = texto(state, 40);
    const cp = String(zip ?? '').replace(/\D/g, '');
    if (cp.length !== 5) return fallo('El código postal debe tener 5 dígitos.');
    if (!Array.isArray(items) || items.length === 0) return fallo('El carrito está vacío.');

    const ajustes = await leerAjustes();
    const proveedor = proveedorDeEnvios(ajustes);
    if (proveedor.nombre !== 'manual' && (!colonia || !ciudad || !estado)) {
      return fallo('Completa colonia, ciudad y estado para cotizar el envío.');
    }

    // Peso y medidas reales del catálogo, nunca los que mande el navegador.
    const admin = clienteAdmin();
    const ids = items.map((i) => i.product_id);
    const { data: productos, error } = await admin
      .from('products')
      .select('id, name, price1, weight_g, length_cm, width_cm, height_cm')
      .in('id', ids);
    if (error) return fallo(`No se pudo leer el catálogo: ${error.message}`, 500);

    const porId = new Map((productos ?? []).map((p) => [String(p.id), p]));
    const lineas = items.map((item) => {
      const p = porId.get(String(item.product_id));
      if (!p) throw new Error(`El producto ${item.product_id} ya no está disponible.`);
      return { ...p, quantity: Number(item.quantity) || 0 };
    });

    const paquete = armarPaquete(lineas);
    const valorDeclarado = lineas.reduce((acc, l) => acc + Number(l.price1) * l.quantity, 0);

    const cotizacion = await proveedor.cotizar({
      origen: origenDeLaTienda(ajustes),
      destino: { zip: cp, neighborhood: colonia, city: ciudad, state: estado, country: 'MX' },
      paquete: { ...paquete, declared_value: valorDeclarado, content: 'Suplementos alimenticios' },
    });

    // La tarifa fija no se guarda: create_order() ya la conoce.
    if (cotizacion.provider === 'manual') {
      return json({ quote_id: null, provider: 'manual', rates: cotizacion.rates, package: paquete, expires_at: null });
    }

    const { data: guardada, error: errorGuardar } = await admin
      .from('shipping_quotes')
      .insert({
        user_id: usuario.id,
        provider: cotizacion.provider,
        destination_zip: cp,
        package: { ...paquete, provider_quote_id: cotizacion.provider_quote_id },
        // Sin `raw`: la tabla guarda lo que la tienda necesita, no el volcado.
        rates: cotizacion.rates.map(({ raw: _raw, ...tarifa }) => tarifa),
        expires_at: cotizacion.expires_at,
      })
      .select('id, rates, expires_at')
      .single();
    if (errorGuardar) return fallo(`No se pudo guardar la cotización: ${errorGuardar.message}`, 500);

    return json({
      quote_id: guardada.id,
      provider: cotizacion.provider,
      rates: guardada.rates,
      package: paquete,
      expires_at: guardada.expires_at,
    });
  } catch (error) {
    console.error('cotizar-envio:', error);
    return fallo((error as Error).message || 'No se pudo cotizar el envío.', 500);
  }
});
