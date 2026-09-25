import { describe, it, expect } from 'vitest';
import { estimateDataUrlBytes, fitWithin, formatBytes, quitarFondoClaro, validateImageFile, MAX_UPLOAD_BYTES } from './image';

describe('peso de las imágenes guardadas', () => {
  it('calcula los bytes reales de un data URL', () => {
    // "AAAA" en base64 son 3 bytes; "AA==" es 1.
    expect(estimateDataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(3);
    expect(estimateDataUrlBytes('data:image/jpeg;base64,AA==')).toBe(1);
    expect(estimateDataUrlBytes('/images/products/1.svg')).toBe(0);
    expect(estimateDataUrlBytes(null)).toBe(0);
  });

  it('formatea el tamaño de forma legible', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 kB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(-3)).toBe('0 B');
  });
});

describe('validación de imágenes', () => {
  it('acepta los formatos habituales', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validateImageFile({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validateImageFile({ type: 'image/webp', size: 1000 })).toBeNull();
  });

  it('rechaza otros tipos de archivo', () => {
    expect(validateImageFile({ type: 'application/pdf', size: 10 })).toMatch(/Formato/);
    expect(validateImageFile(null)).toMatch(/ninguna imagen/);
  });

  it('rechaza archivos demasiado pesados', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: MAX_UPLOAD_BYTES + 1 })).toMatch(/8 MB/);
    expect(validateImageFile({ type: 'image/jpeg', size: MAX_UPLOAD_BYTES })).toBeNull();
  });
});

describe('redimensionado', () => {
  it('no agranda imágenes pequeñas', () => {
    expect(fitWithin(400, 300, 900)).toEqual({ width: 400, height: 300 });
  });

  it('conserva la proporción en horizontal y vertical', () => {
    expect(fitWithin(1800, 900, 900)).toEqual({ width: 900, height: 450 });
    expect(fitWithin(900, 1800, 900)).toEqual({ width: 450, height: 900 });
    expect(fitWithin(1000, 1000, 900)).toEqual({ width: 900, height: 900 });
  });
});

describe('quitar el fondo blanco', () => {
  const BLANCO = [255, 255, 255, 255];
  const NARANJA = [234, 88, 12, 255];

  /** Lienzo de `ancho`×`alto` con `pintar(x, y)` → color RGBA. */
  function lienzo(ancho, alto, pintar) {
    const pixeles = new Uint8ClampedArray(ancho * alto * 4);
    for (let y = 0; y < alto; y += 1) {
      for (let x = 0; x < ancho; x += 1) pixeles.set(pintar(x, y), (y * ancho + x) * 4);
    }
    return pixeles;
  }
  const color = (pixeles, ancho, x, y) => Array.from(pixeles.slice((y * ancho + x) * 4, (y * ancho + x) * 4 + 4));

  it('pinta de negro el blanco que toca el borde, pero no la etiqueta blanca del bote', () => {
    // Fondo blanco; un bote naranja en el centro (2..7) con etiqueta blanca (4..5).
    const pixeles = lienzo(10, 10, (x, y) => {
      const bote = x >= 2 && x <= 7 && y >= 2 && y <= 7;
      const etiqueta = x >= 4 && x <= 5 && y >= 4 && y <= 5;
      return etiqueta ? BLANCO : bote ? NARANJA : BLANCO;
    });

    const pintados = quitarFondoClaro(pixeles, 10, 10);

    expect(pintados).toBe(100 - 36);
    expect(color(pixeles, 10, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(color(pixeles, 10, 3, 3)).toEqual(NARANJA);
    expect(color(pixeles, 10, 4, 4)).toEqual(BLANCO);
  });

  it('lo transparente también es fondo', () => {
    const pixeles = lienzo(4, 4, (x) => (x === 0 ? [0, 0, 0, 0] : NARANJA));
    quitarFondoClaro(pixeles, 4, 4);
    expect(color(pixeles, 4, 0, 2)).toEqual([0, 0, 0, 255]);
  });

  it('si casi toda la foto parece fondo, no toca nada', () => {
    const pixeles = lienzo(10, 10, () => BLANCO);
    expect(quitarFondoClaro(pixeles, 10, 10)).toBe(0);
    expect(color(pixeles, 10, 5, 5)).toEqual(BLANCO);
  });

  it('un producto blanco con contorno tenue no se pinta de negro (el relleno no se cuela)', () => {
    // Bote casi blanco (248) con contorno gris claro (232) y un hueco en el
    // contorno: con la primera versión el relleno entraba por ahí y el bote
    // quedaba negro.
    const pixeles = lienzo(40, 40, (x, y) => {
      const dentro = x > 10 && x < 30 && y > 6 && y < 34;
      const borde = dentro && (x < 12 || x > 28 || y < 8 || y > 32);
      const hueco = y > 18 && y < 21 && x === 11;
      if (hueco) return [250, 250, 250, 255];
      if (borde) return [232, 232, 232, 255];
      if (dentro) return [248, 248, 248, 255];
      return BLANCO;
    });

    expect(quitarFondoClaro(pixeles, 40, 40)).toBeGreaterThan(0);
    expect(color(pixeles, 40, 20, 20)).toEqual([248, 248, 248, 255]);
    expect(color(pixeles, 40, 0, 0)).toEqual([0, 0, 0, 255]);
  });

  it('si el producto es tan blanco como el fondo, no toca la foto', () => {
    // Sin contorno: no hay forma de separar producto y fondo.
    const pixeles = lienzo(40, 40, (x, y) => (x > 10 && x < 30 && y > 6 && y < 34 && y % 7 === 0 ? [30, 30, 30, 255] : BLANCO));
    expect(quitarFondoClaro(pixeles, 40, 40)).toBe(0);
    expect(color(pixeles, 40, 0, 0)).toEqual(BLANCO);
  });

  it('una foto sin fondo blanco se queda igual', () => {
    const pixeles = lienzo(6, 6, () => NARANJA);
    expect(quitarFondoClaro(pixeles, 6, 6)).toBe(0);
  });
});
