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

/**
 * Convierte un File en un data URL redimensionado (JPEG por defecto).
 * Si el navegador no puede decodificar la imagen, devuelve el archivo original en base64.
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

    const optimized = canvas.toDataURL('image/jpeg', quality);
    return optimized.length < original.length ? optimized : original;
  } catch {
    return original;
  }
}
