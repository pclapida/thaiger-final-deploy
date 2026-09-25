import { describe, it, expect } from 'vitest';
import { ESTADOS_MX, lineaDireccion } from './estados';

describe('estados y dirección', () => {
  it('son las 32 entidades, sin repetir', () => {
    expect(ESTADOS_MX).toHaveLength(32);
    expect(new Set(ESTADOS_MX).size).toBe(32);
  });

  it('arma la dirección en una línea con colonia y estado', () => {
    expect(
      lineaDireccion({ address: 'Av. Juárez 10', neighborhood: 'Centro', city: 'Monterrey', state: 'Nuevo León', zip: '64000' })
    ).toBe('Av. Juárez 10, Col. Centro, Monterrey, Nuevo León, C.P. 64000');
  });

  it('los pedidos viejos, sin colonia ni estado, se siguen leyendo bien', () => {
    expect(lineaDireccion({ address: 'Calle 1', city: 'CDMX', zip: '01000' })).toBe('Calle 1, CDMX, C.P. 01000');
  });
});
