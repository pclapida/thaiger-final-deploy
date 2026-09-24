import { describe, it, expect } from 'vitest';
import { datosLegales } from './legal';

const TIENDA = { name: 'Thaiger Supplements', address: 'Av. Tienda 1, CDMX', email: 'hola@thaiger.mx', phone: '55 1' };

describe('datos legales', () => {
  it('con los datos capturados, usa los legales', () => {
    const datos = datosLegales({
      store: TIENDA,
      legal: { businessName: 'Thaiger SA de CV', rfc: ' tsu260101ab1 ', fiscalAddress: 'Calle Fiscal 2', privacyEmail: 'privacidad@thaiger.mx' },
    });
    expect(datos).toMatchObject({
      responsable: 'Thaiger SA de CV',
      rfc: 'TSU260101AB1',
      domicilio: 'Calle Fiscal 2',
      correo: 'privacidad@thaiger.mx',
      pendientes: [],
    });
  });

  it('sin datos legales, cae en los de la tienda y dice qué falta', () => {
    const datos = datosLegales({ store: TIENDA, legal: {} });
    expect(datos.responsable).toBe('Thaiger Supplements');
    expect(datos.domicilio).toBe('Av. Tienda 1, CDMX');
    expect(datos.correo).toBe('hola@thaiger.mx');
    expect(datos.pendientes).toHaveLength(3);
  });

  it('sin configuración no revienta', () => {
    expect(datosLegales().responsable).toBe('Thaiger Supplements');
  });
});
