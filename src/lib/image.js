/**
 * Utilidades para subir fotos de producto/avatar desde el disco del usuario.
 * La imagen se redimensiona y se convierte a data URL para poder guardarse
 * en la base local (IndexedDB) sin necesidad de un servidor de archivos.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB de entrada
const ACCEPTED = /^image\/(jpeg|jpg|png|webp|gif|avif)$/i;

export function validateImageFile(file) {
  if (!file) return 'No se seleccionó ninguna imagen.';
  if (!ACCEPTED.test(file.type)) return 'Formato no soportado. Usa JPG, PNG, WEBP o AVIF.';
  if (file.size > MAX_UPLOAD_BYTES) return 'La imagen pesa más de 8 MB. Elige una más ligera.';
  return null;
}

/** Calcula el tamaño destino conservando la proporción. */
export function fitWithin(width, height, maxSize) {
  if (width <= maxSize && height <= maxSize) return { width, height };
  const ratio = width / height;
  return ratio >= 1
    ? { width: maxSize, height: Math.round(maxSize / ratio) }
    : { width: Math.round(maxSize * ratio), height: maxSize };
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

/** Tamaño real (en bytes) que ocupa un data URL en base64. */
export function estimateDataUrlBytes(dataUrl) {
  const texto = String(dataUrl ?? '');
  const coma = texto.indexOf(',');
  if (!texto.startsWith('data:') || coma === -1) return 0;

  const base64 = texto.slice(coma + 1);
  const relleno = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - relleno);
}

/** Tamaño legible: 1.4 MB, 320 kB... */
export function formatBytes(bytes) {
  const numero = Number(bytes);
  if (!Number.isFinite(numero) || numero <= 0) return '0 B';

  const unidades = ['B', 'kB', 'MB', 'GB'];
  const indice = Math.min(unidades.length - 1, Math.floor(Math.log(numero) / Math.log(1024)));
  const valor = numero / 1024 ** indice;

  return `${valor.toFixed(valor >= 10 || indice === 0 ? 0 : 1)} ${unidades[indice]}`;
}

/** ¿El navegador sabe escribir WebP? Se comprueba una sola vez. */
let soportaWebp = null;

function supportsWebp(canvas) {
  if (soportaWebp !== null) return soportaWebp;
  try {
    soportaWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    soportaWebp = false;
  }
  return soportaWebp;
}

/**
 * Convierte un File en un data URL redimensionado.
 *
 * Prefiere WebP cuando el navegador lo soporta: en modo local la foto vive
 * incrustada dentro de IndexedDB, así que cada kilobyte cuenta. Si el navegador
 * no puede decodificar la imagen, devuelve el archivo original en base64.
 */
export async function fileToOptimizedDataUrl(file, { maxSize = 900, quality = 0.85 } = {}) {
  const error = validateImageFile(file);
  if (error) throw new Error(error);

  const original = await readAsDataUrl(file);

  // Los GIF animados perderían la animación al pasar por canvas.
  if (file.type === 'image/gif') return original;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSize);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    // Fondo blanco: las fotos de producto se muestran sobre tarjeta blanca.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const candidatos = [canvas.toDataURL('image/jpeg', quality)];
    if (supportsWebp(canvas)) candidatos.push(canvas.toDataURL('image/webp', quality));

    // Nos quedamos con la versión más ligera, incluida la original.
    return [...candidatos, original].reduce((mejor, actual) =>
      actual.length < mejor.length ? actual : mejor
    );
  } catch {
    return original;
  }
}
