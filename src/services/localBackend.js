/**
 * Backend LOCAL (sin servidor).
 *
 * Guarda catálogo, usuarios, pedidos y configuración en IndexedDB del
 * navegador. Se activa automáticamente cuando no hay credenciales de Supabase,
 * de modo que la tienda —incluido el panel de administración— funciona de
 * inmediato con los datos de demostración.
 *
 * Sobre la seguridad: aquí no hay servidor, así que las comprobaciones de rol
 * son una barrera de la aplicación, no del sistema. Quien controle el navegador
 * controla su propia base. Lo que sí garantizamos: las contraseñas nunca se
 * guardan legibles (PBKDF2), las sesiones caducan, los intentos de acceso se
 * limitan y ningún precio ni total se acepta desde el cliente: se recalculan
 * aquí a partir del catálogo. La frontera real de seguridad es Supabase + RLS.
 */

import { idb, deleteDatabase } from '../lib/idb';
import {
  SEED_PRODUCTS,
  DEMO_ACCOUNTS,
  DEMO_ADMIN as SEED_ADMIN,
  DEMO_CUSTOMER,
  buildSeedOrders,
  normalizeBrand,
  normalizeCategory,
} from '../data/seed';
import { SETTINGS_ID, buildDefaultSettings, withSettingsDefaults } from '../data/settings';
import { fileToOptimizedDataUrl } from '../lib/image';
import { computeCartTotals, configurePricing, getUnitPrice } from '../lib/pricing';
import {
  clearLoginFailures,
  createPasswordRecord,
  createSessionRecord,
  formatLockMessage,
  getLoginThrottle,
  isSessionValid,
  isValidEmail,
  needsPasswordUpgrade,
  normalizeEmail,
  randomId,
  registerLoginFailure,
  sanitizeImageUrl,
  sanitizeText,
  validatePassword,
  verifyPassword,
} from '../lib/security';

export const mode = 'local';

/** Cuentas de demostración (las mismas que muestra la pantalla de acceso). */
export { DEMO_ACCOUNTS, DEMO_CUSTOMER };
export const DEMO_ADMIN = SEED_ADMIN;

const SESSION_KEY = 'thaiger_local_session';

// ---------------------------------------------------------------- utilidades

const memoryStorage = new Map();

const memoryStorageAdapter = {
  getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
  setItem: (key, value) => memoryStorage.set(key, value),
  removeItem: (key) => memoryStorage.delete(key),
};

/**
 * localStorage no siempre está disponible ni completo: navegación privada,
 * cookies bloqueadas o entornos sin DOM. En esos casos usamos memoria.
 */
function storage() {
  for (const candidate of [globalThis.window?.localStorage, globalThis.localStorage]) {
    try {
      if (
        candidate &&
        typeof candidate.getItem === 'function' &&
        typeof candidate.setItem === 'function' &&
        typeof candidate.removeItem === 'function'
      ) {
        return candidate;
      }
    } catch {
      /* el acceso puede lanzar si el navegador lo bloquea */
    }
  }
  return memoryStorageAdapter;
}

/** Quita el hash y la sal antes de exponer un usuario a la aplicación. */
function publicUser(user) {
  if (!user) return null;
  const clean = { ...user };
  delete clean.password_hash;
  delete clean.salt;
  delete clean.password_algo;
  delete clean.password_iterations;
  return clean;
}

function readStoredSession() {
  const raw = storage().getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    // Formato viejo (sólo el id): se descarta y se pide entrar de nuevo.
    storage().removeItem(SESSION_KEY);
    return null;
  }
}

function writeStoredSession(session) {
  storage().setItem(SESSION_KEY, JSON.stringify(session));
}

// ------------------------------------------------------------------ arranque

let readyPromise = null;

async function seedUsers() {
  const creados = [];

  for (const cuenta of DEMO_ACCOUNTS) {
    const user = {
      id: randomId(),
      email: normalizeEmail(cuenta.email),
      name: cuenta.name,
      role: cuenta.role,
      avatar_url: null,
      is_demo: true,
      created_at: new Date().toISOString(),
      ...(await createPasswordRecord(cuenta.password)),
    };
    await idb.put('users', user);
    creados.push(user);
  }

  return creados;
}

async function seedOrdersFor(clientId) {
  const pedidos = buildSeedOrders(clientId);

  for (const pedido of pedidos) {
    const { order_items: items, ...cabecera } = pedido;
    await idb.put('orders', cabecera);
    await idb.putMany('order_items', items.map((item) => ({ ...item, order_id: pedido.id })));
  }
}

export function ensureSeeded() {
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    if ((await idb.count('products')) === 0) {
      await idb.putMany('products', SEED_PRODUCTS);
    }

    if ((await idb.count('settings')) === 0) {
      await idb.put('settings', buildDefaultSettings());
    }

    if ((await idb.count('users')) === 0) {
      const creados = await seedUsers();
      const cliente = creados.find((u) => u.role === 'user');

      // Pedidos de ejemplo para que el panel arranque con datos que mirar.
      if (cliente && (await idb.count('orders')) === 0) {
        await seedOrdersFor(cliente.id);
      }
    }
  })();

  return readyPromise;
}

/** Sólo para pruebas: fuerza a re-sembrar en la siguiente llamada. */
export function _resetSeedState() {
  readyPromise = null;
}

// -------------------------------------------------------------- autorización

async function currentUser() {
  const session = readStoredSession();
  if (!isSessionValid(session)) return null;

  const user = await idb.get('users', session.userId);
  if (!user) return null;

  // La sesión debe seguir apuntando al token vigente de la cuenta.
  if (user.session_token && user.session_token !== session.token) return null;
  return user;
}

/**
 * Exige sesión de administrador para las operaciones de gestión.
 * En modo local es una barrera de la aplicación (ver la nota de arriba).
 */
async function requireAdmin() {
  const user = await currentUser();
  if (!user) throw new Error('Necesitas iniciar sesión para hacer esto.');
  if (user.role !== 'admin') throw new Error('Sólo un administrador puede hacer esto.');
  return user;
}

async function requireSession() {
  const user = await currentUser();
  if (!user) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  return user;
}

// ------------------------------------------------------------------ productos

function sortByIdDesc(list) {
  return [...list].sort((a, b) => Number(b.id) - Number(a.id));
}

/** Deja un producto en su forma canónica antes de guardarlo. */
function sanitizeProduct(data, catalogo = []) {
  const marcas = [...new Set(catalogo.map((p) => p.brand).filter(Boolean))];
  const categorias = [...new Set(catalogo.map((p) => p.category).filter(Boolean))];

  const price1 = Number(data.price1);
  const price2 = Number(data.price2);
  const price3 = Number(data.price3);
  const stock = Number(data.stock);
  const discount = Number(data.discount_percent);

  if (!(price1 > 0)) throw new Error('El precio público debe ser mayor a cero.');

  const name = sanitizeText(data.name, { maxLength: 140 });
  const brand = normalizeBrand(sanitizeText(data.brand, { maxLength: 60 }), marcas);
  const category = normalizeCategory(sanitizeText(data.category, { maxLength: 60 }), categorias);

  if (!name || !brand || !category) throw new Error('Nombre, marca y categoría son obligatorios.');

  return {
    name,
    brand,
    category,
    description: sanitizeText(data.description, { maxLength: 1200, allowNewlines: true }),
    price1,
    price2: price2 > 0 ? price2 : price1,
    price3: price3 > 0 ? price3 : price1,
    image_url: sanitizeImageUrl(data.image_url),
    stock: Number.isFinite(stock) && stock >= 0 ? Math.floor(stock) : 0,
    is_on_sale: Boolean(data.is_on_sale),
    discount_percent: data.is_on_sale && discount > 0 && discount < 100 ? Math.round(discount) : 0,
  };
}

export const products = {
  async list() {
    await ensureSeeded();
    return sortByIdDesc(await idb.getAll('products'));
  },

  async get(id) {
    await ensureSeeded();
    const all = await idb.getAll('products');
    return all.find((p) => String(p.id) === String(id)) || null;
  },

  async create(data) {
    await ensureSeeded();
    await requireAdmin();

    const all = await idb.getAll('products');
    const nextId = all.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
    const product = {
      ...sanitizeProduct(data, all),
      id: nextId,
      created_at: new Date().toISOString(),
    };

    await idb.put('products', product);
    return product;
  },

  async update(id, patch) {
    await ensureSeeded();
    await requireAdmin();

    const current = await products.get(id);
    if (!current) throw new Error('El producto ya no existe.');

    const all = await idb.getAll('products');
    const merged = sanitizeProduct({ ...current, ...patch }, all);
    const updated = { ...current, ...merged, id: current.id };

    await idb.put('products', updated);
    return updated;
  },

  async remove(id) {
    await ensureSeeded();
    await requireAdmin();

    const current = await products.get(id);
    if (current) await idb.remove('products', current.id);
  },

  /** Aplica el mismo cambio a varios productos (acciones masivas del panel). */
  async bulkUpdate(ids, patch) {
    await ensureSeeded();
    await requireAdmin();

    const all = await idb.getAll('products');
    const objetivo = new Set(ids.map(String));
    const actualizados = [];

    for (const product of all) {
      if (!objetivo.has(String(product.id))) continue;
      const merged = sanitizeProduct({ ...product, ...patch }, all);
      const updated = { ...product, ...merged, id: product.id };
      await idb.put('products', updated);
      actualizados.push(updated);
    }

    return actualizados;
  },

  async bulkRemove(ids) {
    await ensureSeeded();
    await requireAdmin();

    for (const id of ids) await idb.remove('products', Number(id));
    return ids.length;
  },

  /**
   * Renombra una marca o una categoría en todo el catálogo de una sola pasada.
   * Es la forma de arreglar duplicados sin editar producto por producto.
   */
  async renameGroup(campo, desde, hacia) {
    await ensureSeeded();
    await requireAdmin();

    if (campo !== 'brand' && campo !== 'category') throw new Error('Sólo se puede renombrar marca o categoría.');
    const destino = sanitizeText(hacia, { maxLength: 60 });
    if (!destino) throw new Error('El nombre nuevo no puede quedar vacío.');

    const all = await idb.getAll('products');
    let cambiados = 0;

    for (const product of all) {
      if (product[campo] !== desde) continue;
      await idb.put('products', { ...product, [campo]: destino });
      cambiados += 1;
    }

    return cambiados;
  },

  /** En modo local la foto se guarda incrustada como data URL. */
  async uploadImage(file) {
    return fileToOptimizedDataUrl(file);
  },
};

// -------------------------------------------------------------------- pedidos

async function attachItems(orderList) {
  const items = await idb.getAll('order_items');
  return orderList.map((order) => ({
    ...order,
    order_items: items.filter((item) => item.order_id === order.id),
  }));
}

function sortByDateDesc(list) {
  return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Reconstruye el pedido desde el catálogo guardado.
 * Nunca se confía en los precios ni en el total que manda el navegador: un
 * carrito manipulado en localStorage no puede cambiar lo que se cobra.
 */
async function buildOrderLines(items) {
  const catalogo = await idb.getAll('products');
  const porId = new Map(catalogo.map((p) => [String(p.id), p]));
  const lineas = [];

  for (const item of items) {
    const producto = porId.get(String(item.product_id));
    if (!producto) throw new Error(`El producto "${item.product_name || item.product_id}" ya no está disponible.`);

    const quantity = Math.floor(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) throw new Error('Hay una cantidad inválida en el carrito.');

    const stock = Number(producto.stock);
    if (Number.isFinite(stock) && quantity > stock) {
      throw new Error(`Sólo quedan ${stock} unidades de "${producto.name}".`);
    }

    lineas.push({ producto, quantity });
  }

  if (lineas.length === 0) throw new Error('El carrito está vacío.');

  const totales = computeCartTotals(lineas.map(({ producto, quantity }) => ({ ...producto, quantity })));

  return {
    totales,
    orderItems: lineas.map(({ producto, quantity }) => ({
      id: randomId(),
      product_id: producto.id,
      product_name: producto.name,
      quantity,
      price_at_purchase: Number(getUnitPrice(producto, totales.tier).toFixed(2)),
    })),
  };
}

function sanitizeShipping(info = {}) {
  return {
    fullName: sanitizeText(info.fullName, { maxLength: 90 }),
    phone: sanitizeText(info.phone, { maxLength: 25 }),
    address: sanitizeText(info.address, { maxLength: 160 }),
    city: sanitizeText(info.city, { maxLength: 60 }),
    zip: sanitizeText(info.zip, { maxLength: 10 }),
    notes: sanitizeText(info.notes, { maxLength: 300, allowNewlines: true }),
  };
}

export const orders = {
  async listAll() {
    await ensureSeeded();
    await requireAdmin();
    return sortByDateDesc(await attachItems(await idb.getAll('orders')));
  },

  async listByUser(userId) {
    await ensureSeeded();
    const all = await idb.getAll('orders');
    return sortByDateDesc(await attachItems(all.filter((order) => order.user_id === userId)));
  },

  async create({ userId, shippingInfo, paymentInfo, items }) {
    await ensureSeeded();
    // Refresca los umbrales configurados antes de calcular nada.
    await settings.get();

    const sesion = await currentUser();
    // Un pedido siempre se registra a nombre de quien tiene la sesión abierta.
    const dueño = sesion?.id || userId;
    if (!dueño) throw new Error('Necesitas iniciar sesión para comprar.');
    if (sesion && userId && sesion.id !== userId) throw new Error('El pedido no coincide con tu sesión.');

    const envio = sanitizeShipping(shippingInfo);
    if (!envio.fullName || !envio.address || !envio.city || !envio.zip || !envio.phone) {
      throw new Error('Faltan datos de la dirección de envío.');
    }

    const { totales, orderItems } = await buildOrderLines(items);

    const order = {
      id: randomId(),
      user_id: dueño,
      status: 'Pago Pendiente',
      subtotal: Number(totales.subtotal.toFixed(2)),
      shipping_cost: Number(totales.shipping.toFixed(2)),
      total: Number(totales.total.toFixed(2)),
      tier: totales.tier,
      shipping_info: envio,
      payment_info: {
        method: 'SPEI',
        concepto: sanitizeText(paymentInfo?.concepto, { maxLength: 24 }) || `TH-${randomId().slice(0, 4).toUpperCase()}`,
        banco: sanitizeText(paymentInfo?.banco, { maxLength: 60 }),
      },
      created_at: new Date().toISOString(),
    };

    await idb.put('orders', order);
    await idb.putMany('order_items', orderItems.map((item) => ({ ...item, order_id: order.id })));

    return { ...order, order_items: orderItems };
  },

  async updateStatus(orderId, status) {
    await ensureSeeded();
    await requireAdmin();

    const order = await idb.get('orders', orderId);
    if (!order) throw new Error('El pedido ya no existe.');
    await idb.put('orders', { ...order, status: sanitizeText(status, { maxLength: 40 }) });
  },

  async remove(orderId) {
    await ensureSeeded();
    await requireAdmin();

    const items = await idb.getAll('order_items');
    for (const item of items.filter((i) => i.order_id === orderId)) {
      await idb.remove('order_items', item.id);
    }
    await idb.remove('orders', orderId);
  },

  /** Descuenta inventario tras una compra. */
  async decrementStock(items) {
    await ensureSeeded();
    for (const item of items) {
      const product = await products.get(item.product_id);
      if (!product) continue;
      const stock = Number(product.stock);
      if (!Number.isFinite(stock)) continue;
      await idb.put('products', { ...product, stock: Math.max(0, stock - Number(item.quantity || 0)) });
    }
  },
};

// ---------------------------------------------------------------------- auth

const listeners = new Set();

function notify(user) {
  for (const listener of listeners) listener(user);
}

async function findUserByEmail(email) {
  const all = await idb.getAll('users');
  const target = normalizeEmail(email);
  return all.find((u) => normalizeEmail(u.email) === target) || null;
}

/** Abre sesión para un usuario ya verificado y avisa a los suscriptores. */
async function openSession(user) {
  const session = createSessionRecord(user.id);
  await idb.put('users', { ...user, session_token: session.token, last_login_at: new Date().toISOString() });
  writeStoredSession(session);

  const result = publicUser(user);
  notify(result);
  return result;
}

export const auth = {
  async getSession() {
    await ensureSeeded();

    const session = readStoredSession();
    if (!session) return null;

    if (!isSessionValid(session)) {
      storage().removeItem(SESSION_KEY);
      return null;
    }

    const user = await idb.get('users', session.userId);
    if (!user || (user.session_token && user.session_token !== session.token)) {
      storage().removeItem(SESSION_KEY);
      return null;
    }

    return publicUser(user);
  },

  onAuthStateChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  async signIn(email, password) {
    await ensureSeeded();

    const throttle = getLoginThrottle(email);
    if (throttle.blocked) throw new Error(formatLockMessage(throttle.retryInMs));

    const user = await findUserByEmail(email);
    const ok = user ? await verifyPassword(password, user) : false;

    if (!ok) {
      registerLoginFailure(email);
      // Mismo mensaje exista o no la cuenta: no confirmamos correos registrados.
      throw new Error('Invalid login credentials');
    }

    clearLoginFailures(email);

    // Cuenta creada con el hash viejo: se actualiza al vuelo, sin pedir nada.
    let cuenta = user;
    if (needsPasswordUpgrade(user)) {
      cuenta = { ...user, ...(await createPasswordRecord(password)) };
      await idb.put('users', cuenta);
    }

    return openSession(cuenta);
  },

  async signUp(email, password, name) {
    await ensureSeeded();

    if (!isValidEmail(email)) throw new Error('El correo electrónico no es válido.');

    const passwordError = validatePassword(password);
    if (passwordError) throw new Error(passwordError);

    if (await findUserByEmail(email)) throw new Error('User already registered');

    const user = {
      id: randomId(),
      email: normalizeEmail(email),
      name: sanitizeText(name, { maxLength: 60 }) || 'Usuario Thaiger',
      role: 'user',
      avatar_url: null,
      created_at: new Date().toISOString(),
      ...(await createPasswordRecord(password)),
    };

    await idb.put('users', user);
    return openSession(user);
  },

  async signOut() {
    const session = readStoredSession();
    if (session?.userId) {
      const user = await idb.get('users', session.userId).catch(() => null);
      // Invalida el token: una sesión copiada a mano deja de servir.
      if (user) await idb.put('users', { ...user, session_token: null });
    }

    storage().removeItem(SESSION_KEY);
    notify(null);
  },

  async updateProfile(userId, updates) {
    await ensureSeeded();

    const sesion = await requireSession();
    if (sesion.id !== userId && sesion.role !== 'admin') {
      throw new Error('Sólo puedes editar tu propio perfil.');
    }

    const user = await idb.get('users', userId);
    if (!user) throw new Error('La cuenta ya no existe.');

    const updated = {
      ...user,
      name: updates.name !== undefined ? sanitizeText(updates.name, { maxLength: 60 }) || user.name : user.name,
      avatar_url:
        updates.avatar_url !== undefined ? sanitizeImageUrl(updates.avatar_url) : user.avatar_url,
    };

    await idb.put('users', updated);

    const result = publicUser(updated);
    if (sesion.id === userId) notify(result);
    return result;
  },

  /** Cambio de contraseña del propio usuario (exige la actual). */
  async changePassword(currentPassword, newPassword) {
    const sesion = await requireSession();

    if (!(await verifyPassword(currentPassword, sesion))) {
      throw new Error('La contraseña actual no es correcta.');
    }

    const error = validatePassword(newPassword);
    if (error) throw new Error(error);

    const actualizado = { ...sesion, ...(await createPasswordRecord(newPassword)) };
    await idb.put('users', actualizado);
    return true;
  },

  async uploadAvatar(file) {
    return fileToOptimizedDataUrl(file, { maxSize: 400 });
  },
};

// ------------------------------------------------------------------ usuarios

export const users = {
  async list() {
    await ensureSeeded();
    await requireAdmin();
    const all = await idb.getAll('users');
    return all
      .map(publicUser)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  },

  async create({ email, password, name, role = 'user' }) {
    await ensureSeeded();
    await requireAdmin();

    if (!isValidEmail(email)) throw new Error('El correo electrónico no es válido.');
    const error = validatePassword(password);
    if (error) throw new Error(error);
    if (await findUserByEmail(email)) throw new Error('Ya existe una cuenta con ese correo.');

    const user = {
      id: randomId(),
      email: normalizeEmail(email),
      name: sanitizeText(name, { maxLength: 60 }) || 'Usuario Thaiger',
      role: role === 'admin' ? 'admin' : 'user',
      avatar_url: null,
      created_at: new Date().toISOString(),
      ...(await createPasswordRecord(password)),
    };

    await idb.put('users', user);
    return publicUser(user);
  },

  async setRole(userId, role) {
    await ensureSeeded();
    const admin = await requireAdmin();

    const user = await idb.get('users', userId);
    if (!user) throw new Error('La cuenta ya no existe.');

    const siguiente = role === 'admin' ? 'admin' : 'user';

    // Nadie puede quitarse a sí mismo el último acceso al panel.
    if (user.id === admin.id && siguiente !== 'admin') {
      throw new Error('No puedes quitarte tu propio rol de administrador.');
    }
    if (user.role === 'admin' && siguiente !== 'admin') {
      const admins = (await idb.getAll('users')).filter((u) => u.role === 'admin');
      if (admins.length <= 1) throw new Error('Debe quedar al menos un administrador.');
    }

    const updated = { ...user, role: siguiente };
    await idb.put('users', updated);
    return publicUser(updated);
  },

  async remove(userId) {
    await ensureSeeded();
    const admin = await requireAdmin();

    if (userId === admin.id) throw new Error('No puedes eliminar tu propia cuenta.');

    const user = await idb.get('users', userId);
    if (!user) return;

    if (user.role === 'admin') {
      const admins = (await idb.getAll('users')).filter((u) => u.role === 'admin');
      if (admins.length <= 1) throw new Error('Debe quedar al menos un administrador.');
    }

    await idb.remove('users', userId);
  },

  /** Restablece la contraseña de una cuenta desde el panel. */
  async setPassword(userId, newPassword) {
    await ensureSeeded();
    await requireAdmin();

    const error = validatePassword(newPassword);
    if (error) throw new Error(error);

    const user = await idb.get('users', userId);
    if (!user) throw new Error('La cuenta ya no existe.');

    // Al cambiar la contraseña se cierra cualquier sesión abierta de esa cuenta.
    await idb.put('users', { ...user, ...(await createPasswordRecord(newPassword)), session_token: null });
    return true;
  },
};

// ------------------------------------------------------------- configuración

/**
 * Los umbrales de envío y de nivel viven en los ajustes, pero quien los aplica
 * es `src/lib/pricing.js`. Hay que sincronizarlos en CADA camino que cambie la
 * configuración —leer, guardar y restaurar—, o el carrito seguiría calculando
 * con los valores viejos el resto de la sesión y el cliente vería un total
 * distinto del que se le cobra.
 */
function aplicarPreciosDeAjustes(config) {
  configurePricing({
    tier2From: config.tiers.tier2From,
    tier3From: config.tiers.tier3From,
    freeShippingFrom: config.shipping.freeFrom,
    shippingCost: config.shipping.cost,
  });
  return config;
}

export const settings = {
  async get() {
    await ensureSeeded();
    return aplicarPreciosDeAjustes(withSettingsDefaults(await idb.get('settings', SETTINGS_ID)));
  },

  async update(patch) {
    await ensureSeeded();
    await requireAdmin();

    const actual = await settings.get();
    const siguiente = withSettingsDefaults({ ...actual, ...patch });
    await idb.put('settings', siguiente);
    return aplicarPreciosDeAjustes(siguiente);
  },

  async reset() {
    await ensureSeeded();
    await requireAdmin();

    const base = buildDefaultSettings();
    await idb.put('settings', base);
    return aplicarPreciosDeAjustes(base);
  },
};

// -------------------------------------------------------------- mantenimiento

export const maintenance = {
  /** Copia de seguridad en JSON de todo lo que vive en el navegador. */
  async exportData() {
    await ensureSeeded();
    await requireAdmin();

    return {
      version: 2,
      exported_at: new Date().toISOString(),
      products: await idb.getAll('products'),
      orders: await idb.getAll('orders'),
      order_items: await idb.getAll('order_items'),
      settings: await idb.getAll('settings'),
      // Los usuarios salen sin credenciales: una copia no debe llevar hashes.
      users: (await idb.getAll('users')).map(publicUser),
    };
  },

  /** Restaura catálogo y configuración desde una copia. No toca las cuentas. */
  async importData(backup) {
    await ensureSeeded();
    await requireAdmin();

    if (!backup || !Array.isArray(backup.products)) {
      throw new Error('El archivo no tiene el formato esperado.');
    }

    const catalogo = await idb.getAll('products');
    await idb.clear('products');

    const limpios = backup.products.map((product, indice) => ({
      ...sanitizeProduct(product, catalogo),
      id: Number(product.id) || indice + 1,
      created_at: product.created_at || new Date().toISOString(),
    }));
    await idb.putMany('products', limpios);

    if (backup.settings?.[0]) {
      await idb.put('settings', withSettingsDefaults(backup.settings[0]));
    }

    return limpios.length;
  },

  /** Borra la base local y vuelve a sembrar los datos de demostración. */
  async resetDemo() {
    await requireAdmin();

    await auth.signOut();
    await deleteDatabase();
    _resetSeedState();
    await ensureSeeded();
  },
};
