import { describe, it, expect } from 'vitest';
import { MAX_FOTOS_EXTRA, fotosDeProducto, normalizarGaleria, transformarFotos } from './galeria';

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

describe('transformar las fotos de un producto', () => {
  const producto = { image_url: foto(1), gallery: [foto(2), foto(3)] };

  it('cambia sólo las que el transformador devuelve y conserva el orden', async () => {
    const { cambio, cambiadas, fallidas } = await transformarFotos(producto, async (url) =>
      url === foto(2) ? null : `${url}?negro`
    );
    expect(cambio).toEqual({ image_url: `${foto(1)}?negro`, gallery: [foto(2), `${foto(3)}?negro`] });
    expect(cambiadas).toBe(2);
    expect(fallidas).toBe(0);
  });

  it('una foto que falla se queda como estaba', async () => {
    const { cambio, fallidas } = await transformarFotos(producto, async (url) => {
      if (url === foto(1)) throw new Error('sin permiso');
      return `${url}?negro`;
    });
    expect(cambio.image_url).toBe(foto(1));
    expect(cambio.gallery).toEqual([`${foto(2)}?negro`, `${foto(3)}?negro`]);
    expect(fallidas).toBe(1);
  });

  it('sin cambios no hay nada que guardar', async () => {
    const { cambio } = await transformarFotos(producto, async () => null);
    expect(cambio).toBeNull();
  });

  it('sin foto principal, todo va a la galería', async () => {
    const { cambio } = await transformarFotos({ image_url: null, gallery: [foto(2)] }, async (url) => `${url}?negro`);
    expect(cambio).toEqual({ gallery: [`${foto(2)}?negro`] });
  });
});
