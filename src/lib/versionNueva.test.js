import { describe, it, expect, vi } from 'vitest';
import { esErrorDeVersionNueva, recargarUnaVez } from './versionNueva';

function almacenFalso() {
  const datos = new Map();
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v) };
}

describe('versión nueva publicada', () => {
  it('reconoce el fallo de módulo en Chrome, Firefox y Safari', () => {
    expect(
      esErrorDeVersionNueva(
        new TypeError('Failed to fetch dynamically imported module: https://www.thaigersupplements.com/assets/Dashboard-CUUsT5j5.js')
      )
    ).toBe(true);
    expect(esErrorDeVersionNueva(new Error('error loading dynamically imported module'))).toBe(true);
    expect(esErrorDeVersionNueva(new TypeError('Importing a module script failed.'))).toBe(true);
  });

  it('no confunde otros errores', () => {
    expect(esErrorDeVersionNueva(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(esErrorDeVersionNueva(null)).toBe(false);
  });

  it('recarga una vez y no vuelve a hacerlo enseguida (sin ciclos)', () => {
    const almacen = almacenFalso();
    const recargar = vi.fn();

    expect(recargarUnaVez({ almacen, ahora: 1_000_000, recargar })).toBe(true);
    expect(recargarUnaVez({ almacen, ahora: 1_010_000, recargar })).toBe(false);
    expect(recargar).toHaveBeenCalledTimes(1);

    // Pasado el margen (otra publicación más tarde), vuelve a poder recargar.
    expect(recargarUnaVez({ almacen, ahora: 1_100_000, recargar })).toBe(true);
    expect(recargar).toHaveBeenCalledTimes(2);
  });
});
