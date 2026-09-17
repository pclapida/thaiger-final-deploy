import { describe, it, expect } from 'vitest';
import { armarPaquete, buscarClave } from './paquete.ts';

describe('armarPaquete', () => {
  it('suma el peso y arma una caja con la base del artículo más grande', () => {
    const paquete = armarPaquete([
      { weight_g: 1000, length_cm: 20, width_cm: 15, height_cm: 10, quantity: 2 },
      { weight_g: 300, length_cm: 25, width_cm: 10, height_cm: 5, quantity: 1 },
    ]);

    expect(paquete.weight_kg).toBe(2.3);
    expect(paquete.length_cm).toBe(25);
    expect(paquete.width_cm).toBe(15);
    // Volumen total 2·(20·15·10) + 25·10·5 = 7250 cm³ sobre una base de 25×15.
    expect(paquete.height_cm).toBe(Math.ceil(7250 / (25 * 15)));
    expect(paquete.piezas).toBe(3);
  });

  it('usa los valores por defecto cuando el producto no tiene medidas', () => {
    const paquete = armarPaquete([{ quantity: 1 }]);
    expect(paquete).toMatchObject({ weight_kg: 0.5, length_cm: 20, width_cm: 15, height_cm: 10, piezas: 1 });
  });

  it('nunca pesa menos de 100 g ni acepta cantidades inválidas', () => {
    expect(armarPaquete([{ weight_g: 10, quantity: 1 }]).weight_kg).toBe(0.1);
    expect(armarPaquete([{ weight_g: 10, quantity: 0 }]).piezas).toBe(0);
    expect(armarPaquete([]).weight_kg).toBe(0.1);
  });
});

describe('buscarClave', () => {
  it('encuentra una clave a cualquier profundidad, también dentro de arreglos', () => {
    const respuesta = { data: { attributes: { included: [{ label: { label_url: 'https://pdf' } }] } } };
    expect(buscarClave(respuesta, ['label_url'])).toBe('https://pdf');
    expect(buscarClave(respuesta, ['no_existe'])).toBeUndefined();
  });

  it('prefiere el primer nombre de la lista y salta valores vacíos', () => {
    expect(buscarClave({ tracking_number: '', master_tracking_number: 'ABC' }, ['tracking_number', 'master_tracking_number'])).toBe('ABC');
  });
});
