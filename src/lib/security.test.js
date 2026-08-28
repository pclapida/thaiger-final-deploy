import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearLoginFailures,
  createPasswordRecord,
  createSessionRecord,
  escapeHtml,
  formatLockMessage,
  getLoginThrottle,
  isSafeImageUrl,
  isSessionValid,
  isValidEmail,
  needsPasswordUpgrade,
  normalizeEmail,
  passwordStrength,
  randomToken,
  registerLoginFailure,
  sanitizeImageUrl,
  sanitizeLinkUrl,
  sanitizeText,
  stripControlChars,
  timingSafeEqual,
  validatePassword,
  verifyPassword,
  LOGIN_LOCK_MS,
  MAX_LOGIN_ATTEMPTS,
  PASSWORD_MIN_LENGTH,
  SESSION_TTL_MS,
  _resetLoginThrottle,
} from './security';

beforeEach(() => {
  _resetLoginThrottle();
});

describe('contraseñas', () => {
  it('nunca guarda la contraseña, sólo su derivado', async () => {
    const registro = await createPasswordRecord('secreto123');

    expect(registro.password_hash).toBeTypeOf('string');
    expect(registro.password_hash).not.toContain('secreto123');
    expect(registro.password_hash).toHaveLength(64);
    expect(registro.salt).toBeTypeOf('string');
    expect(registro.password_algo).toBe('pbkdf2-sha256');
    expect(registro.password_iterations).toBeGreaterThanOrEqual(100000);
  });

  it('dos cuentas con la misma contraseña dan hashes distintos', async () => {
    const a = await createPasswordRecord('secreto123');
    const b = await createPasswordRecord('secreto123');
    expect(a.password_hash).not.toBe(b.password_hash);
  });

  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const registro = await createPasswordRecord('secreto123');

    expect(await verifyPassword('secreto123', registro)).toBe(true);
    expect(await verifyPassword('secreto124', registro)).toBe(false);
    expect(await verifyPassword('', registro)).toBe(false);
    expect(await verifyPassword('secreto123', null)).toBe(false);
    expect(await verifyPassword('secreto123', { password_hash: 'x' })).toBe(false);
  });

  it('acepta cuentas creadas con el hash viejo y pide actualizarlas', async () => {
    // Formato anterior del proyecto: SHA-256 de "sal:contraseña".
    const salt = 'sal-vieja';
    const data = new TextEncoder().encode(`${salt}:secreto123`);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const antiguo = { salt, password_hash: hex };

    expect(await verifyPassword('secreto123', antiguo)).toBe(true);
    expect(await verifyPassword('otra', antiguo)).toBe(false);
    expect(needsPasswordUpgrade(antiguo)).toBe(true);
    expect(needsPasswordUpgrade(await createPasswordRecord('secreto123'))).toBe(false);
  });
});

describe('política de contraseñas', () => {
  it('exige longitud mínima', () => {
    expect(validatePassword('abc1')).toMatch(new RegExp(String(PASSWORD_MIN_LENGTH)));
    expect(validatePassword('abcdefg1')).toBeNull();
  });

  it('exige letras y números', () => {
    expect(validatePassword('solopalabras')).toMatch(/letras y números/i);
    expect(validatePassword('12345678')).toMatch(/letras y números/i);
  });

  it('rechaza contraseñas absurdamente largas', () => {
    expect(validatePassword('a1'.repeat(200))).toMatch(/no puede pasar/i);
  });

  it('mide la fuerza de forma creciente', () => {
    expect(passwordStrength('').score).toBe(0);
    const debil = passwordStrength('abcd1234').score;
    const fuerte = passwordStrength('Abcd1234!largo').score;
    expect(fuerte).toBeGreaterThan(debil);
  });
});

describe('comparación en tiempo constante', () => {
  it('compara igual que ===, sin filtrar por longitud del prefijo', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual(null, undefined)).toBe(true);
  });
});

describe('correos', () => {
  it('normaliza espacios y mayúsculas', () => {
    expect(normalizeEmail('  Persona@Thaiger.MX ')).toBe('persona@thaiger.mx');
    expect(normalizeEmail(undefined)).toBe('');
  });

  it('valida el formato', () => {
    expect(isValidEmail('persona@thaiger.mx')).toBe(true);
    expect(isValidEmail('persona@thaiger')).toBe(false);
    expect(isValidEmail('sin-arroba.mx')).toBe(false);
    expect(isValidEmail('con espacio@thaiger.mx')).toBe(false);
    expect(isValidEmail(`${'a'.repeat(250)}@thaiger.mx`)).toBe(false);
  });
});

describe('saneado de texto', () => {
  it('quita caracteres de control pero deja los saltos de línea', () => {
    const conControl = `hola${String.fromCharCode(0)}mundo${String.fromCharCode(7)}`;
    expect(stripControlChars(conControl)).toBe('holamundo');
    expect(stripControlChars('linea1\nlinea2\ttab')).toBe('linea1\nlinea2\ttab');
  });

  it('colapsa espacios y recorta a la longitud pedida', () => {
    expect(sanitizeText('  hola    mundo  ')).toBe('hola mundo');
    expect(sanitizeText('abcdefghij', { maxLength: 4 })).toBe('abcd');
    expect(sanitizeText(null)).toBe('');
  });

  it('conserva los párrafos cuando se piden saltos de línea', () => {
    expect(sanitizeText('uno\n\n\n\ndos', { allowNewlines: true })).toBe('uno\n\ndos');
    expect(sanitizeText('uno\ndos', { allowNewlines: false })).toBe('uno dos');
  });

  it('escapa el HTML peligroso', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml('a & "b" y \'c\'')).toBe('a &amp; &quot;b&quot; y &#39;c&#39;');
  });
});

describe('URLs', () => {
  it('acepta enlaces normales y rutas internas', () => {
    expect(sanitizeLinkUrl('https://ejemplo.com')).toBe('https://ejemplo.com');
    expect(sanitizeLinkUrl('mailto:hola@thaiger.mx')).toBe('mailto:hola@thaiger.mx');
    expect(sanitizeLinkUrl('/shop')).toBe('/shop');
    expect(sanitizeLinkUrl('#seccion')).toBe('#seccion');
  });

  it('bloquea los esquemas peligrosos', () => {
    expect(sanitizeLinkUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeLinkUrl('JavaScript:alert(1)')).toBe('');
    expect(sanitizeLinkUrl('data:text/html,<script>')).toBe('');
    expect(sanitizeLinkUrl('vbscript:msgbox')).toBe('');
    expect(sanitizeLinkUrl('')).toBe('');
  });

  it('acepta como imagen sólo http(s), rutas locales y data URLs de imagen', () => {
    expect(isSafeImageUrl('https://cdn.ejemplo.com/foto.jpg')).toBe(true);
    expect(isSafeImageUrl('/images/products/1.svg')).toBe(true);
    expect(isSafeImageUrl('data:image/jpeg;base64,AAAA')).toBe(true);

    expect(isSafeImageUrl('data:text/html;base64,AAAA')).toBe(false);
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('')).toBe(false);
    expect(isSafeImageUrl(null)).toBe(false);
  });

  it('sanitizeImageUrl devuelve null en lugar de guardar basura', () => {
    expect(sanitizeImageUrl('  https://ejemplo.com/a.png  ')).toBe('https://ejemplo.com/a.png');
    expect(sanitizeImageUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('bloqueo por intentos fallidos', () => {
  it('empieza sin bloqueo', () => {
    expect(getLoginThrottle('a@b.mx')).toMatchObject({ blocked: false, failures: 0 });
  });

  it('bloquea al agotar los intentos permitidos', () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i += 1) {
      expect(registerLoginFailure('a@b.mx').blocked).toBe(false);
    }
    expect(registerLoginFailure('a@b.mx').blocked).toBe(true);
    expect(getLoginThrottle('a@b.mx').retryInMs).toBeGreaterThan(0);
  });

  it('el bloqueo caduca solo', () => {
    const ahora = 1_000_000;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i += 1) registerLoginFailure('a@b.mx', ahora);

    expect(getLoginThrottle('a@b.mx', ahora).blocked).toBe(true);
    expect(getLoginThrottle('a@b.mx', ahora + LOGIN_LOCK_MS + 1).blocked).toBe(false);
  });

  it('no confunde cuentas distintas y se limpia al acertar', () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i += 1) registerLoginFailure('a@b.mx');

    expect(getLoginThrottle('a@b.mx').blocked).toBe(true);
    expect(getLoginThrottle('otra@b.mx').blocked).toBe(false);

    clearLoginFailures('a@b.mx');
    expect(getLoginThrottle('a@b.mx').blocked).toBe(false);
  });

  it('el aviso dice cuántos minutos faltan', () => {
    expect(formatLockMessage(60_000)).toMatch(/1 minuto\b/);
    expect(formatLockMessage(5 * 60_000)).toMatch(/5 minutos/);
  });
});

describe('sesiones', () => {
  it('crea una sesión con token aleatorio y caducidad', () => {
    const ahora = 1_000_000;
    const sesion = createSessionRecord('usuario-1', { now: ahora });

    expect(sesion.userId).toBe('usuario-1');
    expect(sesion.token).toHaveLength(48);
    expect(sesion.expiresAt).toBe(ahora + SESSION_TTL_MS);
    expect(isSessionValid(sesion, ahora)).toBe(true);
  });

  it('una sesión caducada deja de valer', () => {
    const ahora = 1_000_000;
    const sesion = createSessionRecord('usuario-1', { now: ahora });
    expect(isSessionValid(sesion, ahora + SESSION_TTL_MS + 1)).toBe(false);
  });

  it('rechaza sesiones incompletas o inventadas', () => {
    expect(isSessionValid(null)).toBe(false);
    expect(isSessionValid({ userId: 'x' })).toBe(false);
    expect(isSessionValid({ token: 'x', expiresAt: Date.now() + 1000 })).toBe(false);
  });

  it('los tokens no se repiten', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomToken(16)));
    expect(tokens.size).toBe(50);
  });
});
