/**
 * Utilidades para subir fotos de producto/avatar desde el disco del usuario.
 * La imagen se redimensiona y se convierte a data URL (base local, IndexedDB)
 * o a un Blob ligero (Supabase Storage).
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

/**
 * Relleno por inundación desde el contorno: marca en `visto` los píxeles de
 * fondo (casi blancos, o transparentes) CONECTADOS con el borde. Devuelve la
 * cola de los marcados y cuántos son.
 */
function inundarFondo(pixeles, ancho, alto, tolerancia) {
  const total = ancho * alto;
  const esFondo = (i) => {
    const o = i * 4;
    if (pixeles[o + 3] < 16) return true;
    const r = pixeles[o];
    const g = pixeles[o + 1];
    const b = pixeles[o + 2];
    const minimo = Math.min(r, g, b);
    return minimo >= 255 - tolerancia && Math.max(r, g, b) - minimo <= 12;
  };

  const visto = new Uint8Array(total);
  const cola = new Int32Array(total);
  let inicio = 0;
  let fin = 0;
  const sembrar = (i) => {
    if (!visto[i] && esFondo(i)) {
      visto[i] = 1;
      cola[fin++] = i;
    }
  };

  for (let x = 0; x < ancho; x += 1) {
    sembrar(x);
    sembrar((alto - 1) * ancho + x);
  }
  for (let y = 0; y < alto; y += 1) {
    sembrar(y * ancho);
    sembrar(y * ancho + ancho - 1);
  }
  while (inicio < fin) {
    const i = cola[inicio++];
    const x = i % ancho;
    if (x > 0) sembrar(i - 1);
    if (x < ancho - 1) sembrar(i + 1);
    if (i >= ancho) sembrar(i - ancho);
    if (i < total - ancho) sembrar(i + ancho);
  }
  return { visto, cola, fin };
}

/**
 * ¿El relleno se coló al producto? En una foto de catálogo el producto ocupa
 * el centro: si el «fondo» cubre buena parte del recuadro central, lo que se
 * inundó fue el producto (uno blanco con el contorno tenue, por ejemplo).
 */
function seColoAlCentro(visto, ancho, alto) {
  const x0 = Math.floor(ancho * 0.35);
  const x1 = Math.ceil(ancho * 0.65);
  const y0 = Math.floor(alto * 0.35);
  const y1 = Math.ceil(alto * 0.65);
  let marcados = 0;
  let total = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      total += 1;
      if (visto[y * ancho + x]) marcados += 1;
    }
  }
  return total > 0 && marcados / total > 0.2;
}

/**
 * Pinta de negro el fondo blanco que rodea al producto en una foto.
 *
 * Las fotos de proveedor casi siempre vienen sobre blanco, y la tienda es
 * negra: el recuadro blanco se ve como un parche. Sólo cambia el blanco
 * CONECTADO con el borde: la etiqueta blanca de un bote, rodeada por el propio
 * bote, se queda como está. Lo transparente también cuenta como fondo.
 *
 * Con productos blancos o muy claros el relleno podía colarse por un hueco del
 * contorno y pintar el producto de negro. Ahora sólo cuenta como fondo el
 * blanco casi puro, y si aun así el relleno llega al centro de la foto se
 * reintenta más estricto; si sigue colándose, la foto se deja como está.
 *
 * Modifica `pixeles` (RGBA, como `ImageData.data`) y devuelve cuántos píxeles
 * pintó (0 = no tocó nada).
 */
export function quitarFondoClaro(pixeles, ancho, alto, { tolerancias = [10, 3] } = {}) {
  const total = ancho * alto;
  if (!total) return 0;

  let relleno = null;
  for (const tolerancia of tolerancias) {
    const intento = inundarFondo(pixeles, ancho, alto, tolerancia);
    if (intento.fin === 0) return 0;
    if (intento.fin / total <= 0.97 && !seColoAlCentro(intento.visto, ancho, alto)) {
      relleno = intento;
      break;
    }
  }
  if (!relleno) return 0;

  const { visto, cola, fin } = relleno;
  for (let k = 0; k < fin; k += 1) {
    const o = cola[k] * 4;
    pixeles[o] = 0;
    pixeles[o + 1] = 0;
    pixeles[o + 2] = 0;
    pixeles[o + 3] = 255;
  }

  // Contorno suave: los vecinos casi blancos (el antialias del borde del
  // producto) se oscurecen en proporción, o quedaría un halo blanco.
  for (let k = 0; k < fin; k += 1) {
    const i = cola[k];
    const x = i % ancho;
    const vecinos = [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i >= ancho ? i - ancho : -1, i < total - ancho ? i + ancho : -1];
    for (const v of vecinos) {
      if (v < 0 || visto[v]) continue;
      visto[v] = 2;
      const o = v * 4;
      const minimo = Math.min(pixeles[o], pixeles[o + 1], pixeles[o + 2]);
      if (minimo <= 200) continue;
      const factor = 1 - (minimo - 200) / (255 - 200);
      pixeles[o] = Math.round(pixeles[o] * factor);
      pixeles[o + 1] = Math.round(pixeles[o + 1] * factor);
      pixeles[o + 2] = Math.round(pixeles[o + 2] * factor);
    }
  }

  return fin;
}

/**
 * Dibuja la foto redimensionada sobre negro (el fondo de la tienda) y, si se
 * pide, le quita el fondo blanco. Devuelve `{ canvas, pintados }` (cuántos
 * píxeles de fondo cambió) o lanza si el navegador no puede decodificarla.
 * Acepta un File o un Blob.
 */
async function dibujarFoto(file, { maxSize, quitarFondo }) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSize);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let pintados = 0;
  if (quitarFondo) {
    const imagen = ctx.getImageData(0, 0, width, height);
    pintados = quitarFondoClaro(imagen.data, width, height);
    if (pintados > 0) ctx.putImageData(imagen, 0, 0);
  }
  return { canvas, pintados };
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
 * Con `quitarFondo`, el fondo blanco pasa a negro (ver `quitarFondoClaro`).
 */
export async function fileToOptimizedDataUrl(file, { maxSize = 900, quality = 0.85, quitarFondo = false } = {}) {
  const error = validateImageFile(file);
  if (error) throw new Error(error);

  const original = await readAsDataUrl(file);

  // Los GIF animados perderían la animación al pasar por canvas.
  if (file.type === 'image/gif') return original;

  try {
    const { canvas } = await dibujarFoto(file, { maxSize, quitarFondo });

    const candidatos = [canvas.toDataURL('image/jpeg', quality)];
    if (supportsWebp(canvas)) candidatos.push(canvas.toDataURL('image/webp', quality));
    // Sin quitar el fondo, el original también compite (a veces pesa menos);
    // quitándolo, no: el original trae el fondo blanco.
    if (!quitarFondo) candidatos.push(original);

    return candidatos.reduce((mejor, actual) => (actual.length < mejor.length ? actual : mejor));
  } catch {
    return original;
  }
}

function canvasABlob(canvas, tipo, quality) {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), tipo, quality));
}

/**
 * Versión para subir a Storage: devuelve `{ blob, extension }` ya
 * redimensionado (y sin fondo blanco si se pide), o `null` si no se puede
 * procesar; en ese caso se sube el archivo tal cual.
 */
export async function fileToOptimizedBlob(file, { maxSize = 1600, quality = 0.88, quitarFondo = false } = {}) {
  const error = validateImageFile(file);
  if (error) throw new Error(error);
  if (file.type === 'image/gif') return null;

  try {
    const { canvas } = await dibujarFoto(file, { maxSize, quitarFondo });
    const webp = await canvasABlob(canvas, 'image/webp', quality);
    if (webp?.type === 'image/webp') return { blob: webp, extension: 'webp' };
    const jpeg = await canvasABlob(canvas, 'image/jpeg', quality);
    return jpeg ? { blob: jpeg, extension: 'jpg' } : null;
  } catch {
    return null;
  }
}

/**
 * Para las fotos que YA están puestas: descarga la foto, le quita el fondo
 * blanco y devuelve un File listo para volver a subir. Devuelve `null` si no
 * había fondo que quitar o si no es una foto que se pueda procesar (SVG, GIF),
 * para no volver a subir en balde. Lanza si no se puede descargar (por
 * ejemplo, una dirección de otro sitio que no lo permite).
 */
export async function fotoSinFondoDesdeUrl(url, { maxSize = 1600, quality = 0.88 } = {}) {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`No se pudo descargar la foto (${respuesta.status}).`);
  const blob = await respuesta.blob();
  if (!/^image\/(jpeg|jpg|png|webp|avif)$/i.test(blob.type)) return null;

  const { canvas, pintados } = await dibujarFoto(blob, { maxSize, quitarFondo: true });
  if (pintados === 0) return null;

  const webp = await canvasABlob(canvas, 'image/webp', quality);
  const final = webp?.type === 'image/webp' ? webp : await canvasABlob(canvas, 'image/jpeg', quality);
  if (!final) return null;

  const extension = final.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([final], `sin-fondo.${extension}`, { type: final.type });
}
