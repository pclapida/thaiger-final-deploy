import { describe, it, expect } from 'vitest';
import { armarCotizacion, armarEnvio, leerGuia, leerTarifas } from './skydropx.ts';

const origen = { zip: '64000', city: 'Monterrey', state: 'Nuevo León', street: 'Av. Principal 1', name: 'Thaiger', phone: '8100000000' };
const destino = { zip: '01000', city: 'CDMX', street: 'Calle 2', name: 'Ana', phone: '5500000000' };
const paquete = { weight_kg: 1.2, length_cm: 20, width_cm: 15, height_cm: 12 };

describe('mapeo hacia Skydropx', () => {
  it('arma la cotización con códigos postales y un paquete', () => {
    const cuerpo = armarCotizacion({ origen, destino, paquete });
    expect(cuerpo.quotation.address_from.postal_code).toBe('64000');
    expect(cuerpo.quotation.address_to.postal_code).toBe('01000');
    expect(cuerpo.quotation.address_to.country_code).toBe('MX');
    expect(cuerpo.quotation.parcels).toEqual([{ length: 20, width: 15, height: 12, weight: 1.2 }]);
  });

  it('manda estado, ciudad y colonia del destino (sin ellos Skydropx responde 422)', () => {
    const cuerpo = armarCotizacion({
      origen,
      destino: { ...destino, neighborhood: 'Centro', state: 'Ciudad de México' },
      paquete,
    });
    expect(cuerpo.quotation.address_to).toMatchObject({
      area_level1: 'Ciudad de México',
      area_level2: 'CDMX',
      area_level3: 'Centro',
    });
  });

  it('arma el envío con la cotización, la tarifa y las dos direcciones completas', () => {
    const tarifa = { id: 'r1', carrier: 'Estafeta', service: 'Terrestre', amount: 150, currency: 'MXN', days: 3 };
    const cuerpo = armarEnvio({ cotizacion: { provider_quote_id: 'q1', rate: tarifa }, origen, destino, paquete });
    expect(cuerpo.shipment.quotation_id).toBe('q1');
    expect(cuerpo.shipment.rate_id).toBe('r1');
    expect(cuerpo.shipment.address_to.name).toBe('Ana');
    expect(cuerpo.shipment.address_from.postal_code).toBe('64000');
  });
});

describe('lectura de las respuestas de Skydropx', () => {
  it('normaliza y ordena las tarifas, descartando las que no cubren la ruta', () => {
    const respuesta = {
      id: 'q1',
      is_completed: true,
      rates: [
        { id: 'r-dhl', provider_name: 'DHL', provider_service_name: 'Express', total: '320.00', days: 1, success: true },
        { id: 'r-fedex', provider_name: 'FedEx', success: false },
        { id: 'r-est', provider_name: 'Estafeta', provider_service_name: 'Terrestre', total: 189.5, days: 3, success: true },
      ],
    };
    const tarifas = leerTarifas(respuesta);
    expect(tarifas.map((t) => t.id)).toEqual(['r-est', 'r-dhl']);
    expect(tarifas[0]).toMatchObject({ carrier: 'Estafeta', service: 'Terrestre', amount: 189.5, currency: 'MXN', days: 3 });
  });

  it('tolera que las tarifas vengan anidadas de otra forma', () => {
    const respuesta = { data: { attributes: { rates: [{ id: 'x', provider: 'Paquetexpress', amount: 99, currency_code: 'MXN' }] } } };
    expect(leerTarifas(respuesta)).toHaveLength(1);
    expect(leerTarifas({ nada: true })).toEqual([]);
  });

  it('extrae rastreo y etiqueta de la guía aunque vengan anidados', () => {
    const tarifa = { id: 'r1', carrier: 'Estafeta', service: 'Terrestre', amount: 150, currency: 'MXN', days: 3 };
    const respuesta = {
      data: { id: 'sh-1', attributes: { master_tracking_number: '7788', label: { label_url: 'https://pdf' } } },
    };
    const guia = leerGuia(respuesta, tarifa);
    expect(guia).toMatchObject({ provider: 'skydropx', provider_shipment_id: 'sh-1', tracking_number: '7788', label_url: 'https://pdf', carrier: 'Estafeta' });
  });

  it('avisa si no hay número de rastreo', () => {
    const tarifa = { id: 'r1', carrier: 'X', service: '', amount: 1, currency: 'MXN', days: null };
    expect(() => leerGuia({ data: {} }, tarifa)).toThrow(/rastreo/);
  });
});
