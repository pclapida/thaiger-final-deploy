/**
 * Backend LOCAL (sin servidor).
 *
 * Guarda catálogo, usuarios y pedidos en IndexedDB del navegador. Se activa
 * automáticamente cuando no hay credenciales de Supabase configuradas, de modo
 * que la tienda (incluido el panel de administración) funciona de inmediato.
 */

import { idb } from '../lib/idb';
import { SEED_PRODUCTS } from '../data/seed';
import { fileToOptimizedDataUrl } from '../lib/image';

export const mode = 'local';

export const DEMO_ADMIN = {
  email: 'admin@thaiger.mx',
  password: 'admin123',
  name: 'Administrador Thaiger',
};

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

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-local`;
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Quita el hash antes de exponer un usuario a la aplicación. */
function publicUser(user) {
  if (!user) return null;
  const clean = { ...user };
  delete clean.password_hash;
  delete clean.salt;
  return clean;
}

// ------------------------------------------------------------------ arranque

let readyPromise = null;

export function ensureSeeded() {
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    if ((await idb.count('products')) === 0) {
      await idb.putMany('products', SEED_PRODUCTS);
    }
    if ((await idb.count('users')) === 0) {
      const salt = randomId();
      await idb.put('users', {
        id: randomId(),
        email: DEMO_ADMIN.email,
        name: DEMO_ADMIN.name,
        role: 'admin',
        avatar_url: null,
        salt,
        password_hash: await hashPassword(DEMO_ADMIN.password, salt),
        created_at: new Date().toISOString(),
      });
    }
  })();

  return readyPromise;
}

/** Sólo para pruebas: fuerza a re-sembrar en la siguiente llamada. */
export function _resetSeedState() {
  readyPromise = null;
}

// ------------------------------------------------------------------ productos

function sortByIdDesc(list) {
  return [...list].sort((a, b) => Number(b.id) - Number(a.id));
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
    const all = await idb.getAll('products');
    const nextId = all.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
    const product = { ...data, id: nextId };
    await idb.put('products', product);
    return product;
  },

  async update(id, patch) {
    await ensureSeeded();
    const current = await products.get(id);
    if (!current) throw new Error('El producto ya no existe.');
    const updated = { ...current, ...patch, id: current.id };
    await idb.put('products', updated);
    return updated;
  },

  async remove(id) {
    await ensureSeeded();
    const current = await products.get(id);
    if (current) await idb.remove('products', current.id);
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

export const orders = {
  async listAll() {
    await ensureSeeded();
    return sortByDateDesc(await attachItems(await idb.getAll('orders')));
  },

  async listByUser(userId) {
    const all = await orders.listAll();
    return all.filter((order) => order.user_id === userId);
  },

  async create({ userId, total, shippingInfo, paymentInfo, items }) {
    await ensureSeeded();

    const order = {
      id: randomId(),
      user_id: userId,
      status: 'Pago Pendiente',
      total,
      shipping_info: shippingInfo,
      payment_info: paymentInfo,
      created_at: new Date().toISOString(),
    };
    await idb.put('orders', order);

    const orderItems = items.map((item) => ({
      id: randomId(),
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price_at_purchase: item.price_at_purchase,
    }));
    await idb.putMany('order_items', orderItems);

    return { ...order, order_items: orderItems };
  },

  async updateStatus(orderId, status) {
    await ensureSeeded();
    const order = await idb.get('orders', orderId);
    if (!order) throw new Error('El pedido ya no existe.');
    await idb.put('orders', { ...order, status });
  },

  /** Descuenta inventario tras una compra. */
  async decrementStock(items) {
    await ensureSeeded();
    for (const item of items) {
      const product = await products.get(item.product_id);
      if (!product) continue;
      const stock = Number(product.stock);
      if (!Number.isFinite(stock)) continue;
      await idb.put('products', { ...product, stock: Math.max(0, stock - item.quantity) });
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

export const auth = {
  async getSession() {
    await ensureSeeded();
    const id = storage().getItem(SESSION_KEY);
    if (!id) return null;
    const user = await idb.get('users', id);
    if (!user) {
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
    const user = await findUserByEmail(email);
    if (!user) throw new Error('Invalid login credentials');

    const hash = await hashPassword(password, user.salt);
    if (hash !== user.password_hash) throw new Error('Invalid login credentials');

    storage().setItem(SESSION_KEY, user.id);
    const result = publicUser(user);
    notify(result);
    return result;
  },

  async signUp(email, password, name) {
    await ensureSeeded();
    if (String(password || '').length < 6) {
      throw new Error('Password should be at least 6 characters');
    }
    if (await findUserByEmail(email)) {
      throw new Error('User already registered');
    }

    const salt = randomId();
    const user = {
      id: randomId(),
      email: normalizeEmail(email),
      name: name || 'Usuario Thaiger',
      role: 'user',
      avatar_url: null,
      salt,
      password_hash: await hashPassword(password, salt),
      created_at: new Date().toISOString(),
    };
    await idb.put('users', user);

    storage().setItem(SESSION_KEY, user.id);
    const result = publicUser(user);
    notify(result);
    return result;
  },

  async signOut() {
    storage().removeItem(SESSION_KEY);
    notify(null);
  },

  async updateProfile(userId, updates) {
    await ensureSeeded();
    const user = await idb.get('users', userId);
    if (!user) throw new Error('La cuenta ya no existe.');

    const updated = {
      ...user,
      name: updates.name ?? user.name,
      avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : user.avatar_url,
    };
    await idb.put('users', updated);

    const result = publicUser(updated);
    notify(result);
    return result;
  },

  async uploadAvatar(file) {
    return fileToOptimizedDataUrl(file, { maxSize: 400 });
  },
};
