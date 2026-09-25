import { describe, it, expect } from 'vitest';
import { MAX_FOTOS_EXTRA, fotosDeProducto, normalizarGaleria } from './galeria';

const foto = (n) => `https://cdn.thaiger.mx/p/${n}.webp`;

describe('galería de producto', () => {
  it('quita URLs peligrosas, vacías, repetidas y la foto principal', () => {
    const galeria = normalizarGaleria(
      [foto(2), 'javascript:alert(1)', '', foto(2), foto(1), null, foto(3)],
      foto(1)
    );
    expect(galeria).toEqual([foto(2), foto(3)]);
  });

  it('no pasa del máximo de fotos adicionales', () => {
    const muchas = Array.from({ length: MAX_FOTOS_EXTRA + 5 }, (_, i) => foto(i + 10));
    expect(normalizarGaleria(muchas)).toHaveLength(MAX_FOTOS_EXTRA);
  });

  it('acepta fotos incrustadas (modo local)', () => {
    expect(normalizarGaleria(['data:image/webp;base64,AAAA'])).toEqual(['data:image/webp;base64,AAAA']);
  });

  it('cualquier cosa que no sea lista es una galería vacía', () => {
    expect(normalizarGaleria(undefined)).toEqual([]);
    expect(normalizarGaleria('https://x.mx/a.png')).toEqual([]);
  });

  it('junta la principal con las adicionales, la principal primero', () => {
    expect(fotosDeProducto({ image_url: foto(1), gallery: [foto(2), foto(1)] })).toEqual([foto(1), foto(2)]);
    expect(fotosDeProducto({ image_url: null, gallery: [foto(2)] })).toEqual([foto(2)]);
    expect(fotosDeProducto({})).toEqual([]);
  });
});
