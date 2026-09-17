/**
 * Proveedor "manual": la tarifa fija de la tienda, sin API de paquetería.
 *
 * Es el modo con el que se lanza: la tienda cobra el envío configurado en los
 * ajustes, compra la guía donde quiera (Solo Envíos, la sucursal...) y captura
 * el número de rastreo a mano en el panel.
 */
import type { Cotizacion, Proveedor } from './tipos.ts';

export function proveedorManual(ajustes: { cost?: number; freeFrom?: number; storeName?: string }): Proveedor {
  return {
    nombre: 'manual',

    async cotizar(): Promise<Cotizacion> {
      return {
        provider: 'manual',
        provider_quote_id: null,
        rates: [
          {
            id: 'tarifa-fija',
            carrier: ajustes.storeName || 'Envío estándar',
            service: 'Envío a domicilio',
            amount: Number(ajustes.cost) || 0,
            currency: 'MXN',
            days: null,
          },
        ],
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    },

    async generarGuia() {
      throw new Error(
        'El proveedor manual no genera guías: compra la guía con tu paquetería y captura el número de rastreo en el pedido.'
      );
    },
  };
}
