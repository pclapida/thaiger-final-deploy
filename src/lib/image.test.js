import { describe, it, expect } from 'vitest';
import { estimateDataUrlBytes, fitWithin, formatBytes, validateImageFile, MAX_UPLOAD_BYTES } from './image';

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
