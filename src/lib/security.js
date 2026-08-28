/**
 * Utilidades de seguridad compartidas por la aplicación.
 *
 * Vive aparte de los backends para poder probarse sin IndexedDB y para que las
 * mismas reglas (contraseñas, sesiones, saneado de texto y de URLs) se apliquen
 * igual venga el dato de donde venga.
 *
 * Aviso honesto sobre el modo local: al no haber servidor, la base vive en el
 * navegador del visitante. El hashing con PBKDF2 y el bloqueo por intentos
 * fallidos evitan que una contraseña quede legible o se adivine a fuerza bruta,
 * pero no sustituyen a un backend real con Supabase (ver CLAUDE.md).
 */

// ------------------------------------------------------------------ políticas

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Intentos fallidos consecutivos antes de bloquear temporalmente una cuenta. */
export const MAX_LOGIN_ATTEMPTS = 5;
/** Duración del bloqueo tras agotar los intentos. */
export const LOGIN_LOCK_MS = 5 * 60 * 1000;

/** Duración de una sesión iniciada. Después hay que volver a entrar. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Coste del derivado de contraseña (recomendación OWASP para PBKDF2-SHA256). */
export const PBKDF2_ITERATIONS = 210000;
const PBKDF2_ALGO = 'pbkdf2-sha256';

// ----------------------------------------------------------------- aleatorios

function getCrypto() {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error('Este navegador no soporta Web Crypto; no es seguro guardar contraseñas aquí.');
  }
  return c;
}

export function randomId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(16)}-${randomToken(8)}`;
}

/** Cadena hexadecimal aleatoria de `bytes` bytes. */
export function randomToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    c.getRandomValues(buffer);
  } else {
    for (let i = 0; i < buffer.length; i += 1) buffer[i] = Math.floor(Math.random() * 256);
  }
  return toHex(buffer.buffer);
}

export function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Comparación en tiempo constante de dos cadenas hexadecimales.
 * Evita filtrar cuántos caracteres coinciden midiendo el tiempo de respuesta.
 */
export function timingSafeEqual(a, b) {
  const left = String(a ?? '');
  const right = String(b ?? '');
  // La longitud sí puede compararse: no revela el contenido del hash.
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

// --------------------------------------------------------------- contraseñas

/** Derivado PBKDF2-SHA256 en hexadecimal. */
export async function derivePasswordHash(password, salt, iterations = PBKDF2_ITERATIONS) {
  const c = getCrypto();
  const key = await c.subtle.importKey('raw', new TextEncoder().encode(String(password)), 'PBKDF2', false, [
    'deriveBits',
  ]);

  const bits = await c.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(String(salt)),
      iterations,
      hash: 'SHA-256',
    },
    key,
    256
  );

  return toHex(bits);
}

/** Hash heredado del backend anterior (SHA-256 con sal). Sólo para verificar. */
async function legacyHash(password, salt) {
  const c = getCrypto();
  const data = new TextEncoder().encode(`${salt}:${password}`);
  return toHex(await c.subtle.digest('SHA-256', data));
}

/** Crea el registro que se guarda junto al usuario (nunca la contraseña). */
export async function createPasswordRecord(password) {
  const salt = randomToken(16);
  return {
    password_algo: PBKDF2_ALGO,
    password_iterations: PBKDF2_ITERATIONS,
    salt,
    password_hash: await derivePasswordHash(password, salt, PBKDF2_ITERATIONS),
  };
}

/**
 * Verifica una contraseña contra el registro guardado.
 * Acepta el formato viejo (SHA-256) para no dejar fuera a cuentas ya creadas.
 */
export async function verifyPassword(password, record) {
  if (!record?.password_hash || !record?.salt) return false;

  if (record.password_algo === PBKDF2_ALGO) {
    const hash = await derivePasswordHash(password, record.salt, record.password_iterations || PBKDF2_ITERATIONS);
    return timingSafeEqual(hash, record.password_hash);
  }

  return timingSafeEqual(await legacyHash(password, record.salt), record.password_hash);
}

/** ¿El registro usa un algoritmo viejo y conviene regenerarlo al entrar? */
export function needsPasswordUpgrade(record) {
  return (
    record?.password_algo !== PBKDF2_ALGO ||
    Number(record?.password_iterations || 0) < PBKDF2_ITERATIONS
  );
}

/** Regla de contraseñas. Devuelve el mensaje de error o `null` si es válida. */
export function validatePassword(password) {
  const value = String(password ?? '');

  if (value.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `La contraseña no puede pasar de ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    return 'La contraseña debe combinar letras y números.';
  }
  return null;
}

/** Fuerza aproximada de una contraseña, para la barra del formulario. */
export function passwordStrength(password) {
  const value = String(password ?? '');
  if (!value) return { score: 0, label: 'Vacía' };

  let score = 0;
  if (value.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^a-zA-Z0-9]/.test(value)) score += 1;

  const labels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte', 'Excelente'];
  return { score, label: labels[Math.min(score, labels.length - 1)] };
}

// ---------------------------------------------------------- correo y texto

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isValidEmail(email) {
  const value = normalizeEmail(email);
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

const TAB = 9;
const LINE_FEED = 10;
const CARRIAGE_RETURN = 13;

/** Quita caracteres de control conservando tabulador y saltos de linea. */
export function stripControlChars(value) {
  let out = '';
  for (const char of String(value ?? '')) {
    const code = char.codePointAt(0);
    const isAllowedWhitespace = code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN;
    const isControl = code < 32 || (code >= 127 && code <= 159);
    if (isAllowedWhitespace || !isControl) out += char;
  }
  return out;
}

/**
 * Limpia texto escrito por una persona antes de guardarlo: quita caracteres de
 * control, normaliza espacios y recorta a una longitud máxima.
 */
export function sanitizeText(value, { maxLength = 200, allowNewlines = false } = {}) {
  let text = String(value ?? '');

  text = stripControlChars(text);

  if (allowNewlines) {
    text = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n');
  } else {
    text = text.replace(/\s+/g, ' ');
  }

  return text.trim().slice(0, maxLength);
}

/** Escapa texto para insertarlo en HTML sin riesgo de inyección. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ------------------------------------------------------------------- URLs

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Devuelve la URL si es segura para un enlace, o cadena vacía si no lo es.
 * Bloquea `javascript:`, `data:` y `vbscript:` (vectores clásicos de XSS).
 */
export function sanitizeLinkUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('/') || raw.startsWith('#')) return raw;

  try {
    const url = new URL(raw, 'https://thaiger.invalid');
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? raw : '';
  } catch {
    return '';
  }
}

/**
 * URL válida para el `src` de una imagen: sólo http(s) o un data URL de imagen.
 * Un `data:text/html` en un `<img>` no ejecuta nada, pero se filtra igual para
 * no guardar cargas útiles ajenas dentro de la base.
 */
export function isSafeImageUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  if (raw.startsWith('/')) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif|avif|svg\+xml);base64,/i.test(raw)) return true;

  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Igual que `isSafeImageUrl`, pero devolviendo la URL saneada o `null`. */
export function sanitizeImageUrl(value) {
  const raw = String(value ?? '').trim();
  return isSafeImageUrl(raw) ? raw : null;
}

// -------------------------------------------------- bloqueo por fuerza bruta

const attempts = new Map();

function attemptKey(email) {
  return normalizeEmail(email) || '<anonimo>';
}

/**
 * Estado del bloqueo de una cuenta.
 * `blocked` indica que hay que rechazar el intento sin siquiera comprobarlo.
 */
export function getLoginThrottle(email, now = Date.now()) {
  const entry = attempts.get(attemptKey(email));
  if (!entry) return { blocked: false, failures: 0, retryInMs: 0 };

  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { blocked: true, failures: entry.failures, retryInMs: entry.lockedUntil - now };
  }
  return { blocked: false, failures: entry.failures, retryInMs: 0 };
}

/** Registra un intento fallido y bloquea si se agotaron los permitidos. */
export function registerLoginFailure(email, now = Date.now()) {
  const key = attemptKey(email);
  const entry = attempts.get(key) || { failures: 0, lockedUntil: 0 };

  // Un bloqueo ya cumplido reinicia la cuenta de intentos.
  if (entry.lockedUntil && entry.lockedUntil <= now) entry.failures = 0;

  entry.failures += 1;
  if (entry.failures >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = now + LOGIN_LOCK_MS;
    entry.failures = 0;
  }

  attempts.set(key, entry);
  return getLoginThrottle(email, now);
}

export function clearLoginFailures(email) {
  attempts.delete(attemptKey(email));
}

/** Sólo para pruebas: olvida todos los bloqueos. */
export function _resetLoginThrottle() {
  attempts.clear();
}

/** Mensaje legible del tiempo que falta para volver a intentar. */
export function formatLockMessage(retryInMs) {
  const minutos = Math.max(1, Math.ceil(retryInMs / 60000));
  return `Demasiados intentos fallidos. Vuelve a intentarlo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`;
}

// ------------------------------------------------------------------ sesiones

/** Crea el registro de sesión que se guarda en el navegador. */
export function createSessionRecord(userId, { ttlMs = SESSION_TTL_MS, now = Date.now() } = {}) {
  return {
    token: randomToken(24),
    userId,
    issuedAt: now,
    expiresAt: now + ttlMs,
  };
}

export function isSessionValid(session, now = Date.now()) {
  return Boolean(
    session &&
      typeof session.userId === 'string' &&
      typeof session.token === 'string' &&
      Number(session.expiresAt) > now
  );
}
