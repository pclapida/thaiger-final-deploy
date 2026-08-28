/**
 * Backend SUPABASE.
 *
 * Se activa cuando VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY están definidas.
 * Expone exactamente la misma API que `localBackend`, para que las páginas no
 * tengan que saber contra qué están hablando.
 *
 * Tablas esperadas: products, users, orders, order_items, settings
 * (ver scripts/setup_supabase.sql, que además trae las políticas RLS).
 *
 * Aquí la autorización de verdad la hace la base de datos con RLS: aunque una
 * página pidiera algo que no le toca, Postgres lo rechaza. Las comprobaciones
 * de este archivo son sólo para dar mensajes claros.
 */

import { supabase } from '../supabase';
import { SEED_PRODUCTS } from '../data/seed';
import { SETTINGS_ID, buildDefaultSettings, withSettingsDefaults } from '../data/settings';
import { computeCartTotals, configurePricing, getUnitPrice } from '../lib/pricing';
import {
  isValidEmail,
  normalizeEmail,
  sanitizeImageUrl,
  sanitizeText,
  validatePassword,
} from '../lib/security';

export const mode = 'supabase';

const IMAGE_BUCKET = 'product-images';
const AVATAR_BUCKET = 'avatars';

/** En Supabase las cuentas se crean de verdad; no hay credenciales de demo. */
export const DEMO_ACCOUNTS = [];
export const DEMO_ADMIN = null;
export const DEMO_CUSTOMER = null;

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

function sanitizeProductPayload(data) {
  const price1 = Number(data.price1);
  if (!(price1 > 0)) throw new Error('El precio público debe ser mayor a cero.');

  const price2 = Number(data.price2);
  const price3 = Number(data.price3);
  const stock = Number(data.stock);
  const discount = Number(data.discount_percent);

  const name = sanitizeText(data.name, { maxLength: 140 });
  const brand = sanitizeText(data.brand, { maxLength: 60 });
  const category = sanitizeText(data.category, { maxLength: 60 });
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

// ------------------------------------------------------------------ productos

export const products = {
  async list() {
    const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
    // Si la tabla no existe o el proyecto está caído, la tienda sigue navegable.
    if (error || !data || data.length === 0) return SEED_PRODUCTS;
    return data;
  },

  async get(id) {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
    if (error || !data) return SEED_PRODUCTS.find((p) => String(p.id) === String(id)) || null;
    return data;
  },

  async create(data) {
    const rows = unwrap(await supabase.from('products').insert([sanitizeProductPayload(data)]).select());
    return rows?.[0] ?? data;
  },

  async update(id, patch) {
    const actual = await products.get(id);
    if (!actual) throw new Error('El producto ya no existe.');

    const rows = unwrap(
      await supabase.from('products').update(sanitizeProductPayload({ ...actual, ...patch })).eq('id', id).select()
    );
    return rows?.[0] ?? { ...actual, ...patch, id };
  },

  async remove(id) {
    unwrap(await supabase.from('products').delete().eq('id', id));
  },

  async bulkUpdate(ids, patch) {
    const actualizados = [];
    for (const id of ids) actualizados.push(await products.update(id, patch));
    return actualizados;
  },

  async bulkRemove(ids) {
    unwrap(await supabase.from('products').delete().in('id', ids));
    return ids.length;
  },

  async renameGroup(campo, desde, hacia) {
    if (campo !== 'brand' && campo !== 'category') throw new Error('Sólo se puede renombrar marca o categoría.');
    const destino = sanitizeText(hacia, { maxLength: 60 });
    if (!destino) throw new Error('El nombre nuevo no puede quedar vacío.');

    const filas = unwrap(await supabase.from('products').update({ [campo]: destino }).eq(campo, desde).select('id'));
    return filas?.length ?? 0;
  },

  async uploadImage(file) {
    const extension = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${extension}`;

    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(fileName, file);
    if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  },
};

// -------------------------------------------------------------------- pedidos

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
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async listByUser(userId) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async create({ userId, shippingInfo, paymentInfo, items }) {
    // Refresca los umbrales configurados antes de calcular nada.
    await settings.get();

    const envio = sanitizeShipping(shippingInfo);
    if (!envio.fullName || !envio.address || !envio.city || !envio.zip || !envio.phone) {
      throw new Error('Faltan datos de la dirección de envío.');
    }

    // Los precios se recalculan contra el catálogo: nunca se cobra lo que
    // diga el navegador (ver la misma nota en localBackend.js).
    const ids = items.map((item) => item.product_id);
    const catalogo = unwrap(await supabase.from('products').select('*').in('id', ids));
    const porId = new Map((catalogo || []).map((p) => [String(p.id), p]));

    const lineas = items.map((item) => {
      const producto = porId.get(String(item.product_id));
      if (!producto) throw new Error(`El producto "${item.product_name || item.product_id}" ya no está disponible.`);

      const quantity = Math.floor(Number(item.quantity));
      if (!Number.isFinite(quantity) || quantity < 1) throw new Error('Hay una cantidad inválida en el carrito.');

      const stock = Number(producto.stock);
      if (Number.isFinite(stock) && quantity > stock) {
        throw new Error(`Sólo quedan ${stock} unidades de "${producto.name}".`);
      }
      return { producto, quantity };
    });

    const totales = computeCartTotals(lineas.map(({ producto, quantity }) => ({ ...producto, quantity })));

    const createdOrders = unwrap(
      await supabase
        .from('orders')
        .insert({
          user_id: userId,
          subtotal: Number(totales.subtotal.toFixed(2)),
          shipping_cost: Number(totales.shipping.toFixed(2)),
          total: Number(totales.total.toFixed(2)),
          tier: totales.tier,
          shipping_info: envio,
          payment_info: {
            method: 'SPEI',
            concepto: sanitizeText(paymentInfo?.concepto, { maxLength: 24 }),
            banco: sanitizeText(paymentInfo?.banco, { maxLength: 60 }),
          },
          status: 'Pago Pendiente',
        })
        .select()
    );

    if (!createdOrders || createdOrders.length === 0) {
      throw new Error('No se pudo confirmar el pedido (revisa las políticas RLS de la tabla orders).');
    }

    const order = createdOrders[0];
    const orderItems = lineas.map(({ producto, quantity }) => ({
      order_id: order.id,
      product_id: producto.id,
      product_name: producto.name,
      quantity,
      price_at_purchase: Number(getUnitPrice(producto, totales.tier).toFixed(2)),
    }));

    unwrap(await supabase.from('order_items').insert(orderItems));

    return { ...order, order_items: orderItems };
  },

  async updateStatus(orderId, status) {
    unwrap(await supabase.from('orders').update({ status: sanitizeText(status, { maxLength: 40 }) }).eq('id', orderId));
  },

  async remove(orderId) {
    unwrap(await supabase.from('order_items').delete().eq('order_id', orderId));
    unwrap(await supabase.from('orders').delete().eq('id', orderId));
  },

  async decrementStock(items) {
    for (const item of items) {
      const { error } = await supabase.rpc('decrement_stock', {
        product_id: item.product_id,
        qty: item.quantity,
      });

      if (error) {
        // Respaldo si la función RPC no está instalada.
        const current = await products.get(item.product_id);
        const stock = Number(current?.stock);
        if (!Number.isFinite(stock)) continue;
        await supabase
          .from('products')
          .update({ stock: Math.max(0, stock - item.quantity) })
          .eq('id', item.product_id);
      }
    }
  },
};

// ---------------------------------------------------------------------- auth

/** Combina la sesión de Supabase Auth con el perfil de public.users. */
async function toAppUser(session) {
  if (!session?.user) return null;
  const sbUser = session.user;

  const profile = await supabase.from('users').select('*').eq('id', sbUser.id).maybeSingle();
  const row = profile.data;

  return {
    id: sbUser.id,
    email: sbUser.email,
    name: row?.name || sbUser.user_metadata?.name || 'Usuario Thaiger',
    role: row?.role || 'user',
    avatar_url: row?.avatar_url || sbUser.user_metadata?.avatar_url || null,
    created_at: row?.created_at || sbUser.created_at,
  };
}

export const auth = {
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return toAppUser(data.session);
  },

  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      callback(await toAppUser(session));
    });
    return () => data.subscription.unsubscribe();
  },

  async signIn(email, password) {
    const data = unwrap(await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password }));
    return toAppUser(data);
  },

  async signUp(email, password, name) {
    if (!isValidEmail(email)) throw new Error('El correo electrónico no es válido.');

    const error = validatePassword(password);
    if (error) throw new Error(error);

    const limpio = sanitizeText(name, { maxLength: 60 }) || 'Usuario Thaiger';
    const data = unwrap(
      await supabase.auth.signUp({
        email: normalizeEmail(email),
        password,
        options: { data: { name: limpio } },
      })
    );

    if (data.user) {
      const { error: perfilError } = await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email,
        name: limpio,
        role: 'user',
      });
      if (perfilError) console.error('No se pudo guardar el perfil en public.users:', perfilError.message);
    }

    return toAppUser(data.session);
  },

  async signOut() {
    unwrap(await supabase.auth.signOut());
  },

  async updateProfile(userId, updates) {
    const name = updates.name !== undefined ? sanitizeText(updates.name, { maxLength: 60 }) : undefined;
    const avatar = updates.avatar_url !== undefined ? sanitizeImageUrl(updates.avatar_url) : undefined;

    unwrap(await supabase.auth.updateUser({ data: { name, avatar_url: avatar } }));
    unwrap(await supabase.from('users').update({ name, avatar_url: avatar }).eq('id', userId));
    return { id: userId, name, avatar_url: avatar };
  },

  async changePassword(currentPassword, newPassword) {
    const error = validatePassword(newPassword);
    if (error) throw new Error(error);

    // Supabase pide la sesión vigente; comprobamos la actual reautenticando.
    const { data } = await supabase.auth.getUser();
    if (!data?.user?.email) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

    const check = await supabase.auth.signInWithPassword({ email: data.user.email, password: currentPassword });
    if (check.error) throw new Error('La contraseña actual no es correcta.');

    unwrap(await supabase.auth.updateUser({ password: newPassword }));
    return true;
  },

  async uploadAvatar(file) {
    const extension = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${extension}`;

    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(fileName, file);
    if (error) throw new Error(`No se pudo subir la foto: ${error.message}`);

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  },
};

// ------------------------------------------------------------------ usuarios

export const users = {
  async list() {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async create() {
    // Crear cuentas ajenas requiere la service_role key, que jamás va en el
    // navegador. Se hace desde scripts/create-admin.js o el panel de Supabase.
    throw new Error('Con Supabase, las cuentas se crean desde el registro o con scripts/create-admin.js.');
  },

  async setRole(userId, role) {
    const siguiente = role === 'admin' ? 'admin' : 'user';
    const rows = unwrap(await supabase.from('users').update({ role: siguiente }).eq('id', userId).select());
    return rows?.[0] ?? { id: userId, role: siguiente };
  },

  async remove(userId) {
    unwrap(await supabase.from('users').delete().eq('id', userId));
  },

  async setPassword() {
    throw new Error('Con Supabase, la contraseña se restablece por correo desde el panel de Supabase.');
  },
};

// ------------------------------------------------------------- configuración

/** Sincroniza la aritmética de precios con lo que diga la configuración. */
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
    const { data, error } = await supabase.from('settings').select('*').eq('id', SETTINGS_ID).maybeSingle();
    const guardados = error || !data ? buildDefaultSettings() : withSettingsDefaults(data.value ?? data);
    return aplicarPreciosDeAjustes(guardados);
  },

  async update(patch) {
    const actual = await settings.get();
    const siguiente = withSettingsDefaults({ ...actual, ...patch });
    unwrap(await supabase.from('settings').upsert({ id: SETTINGS_ID, value: siguiente }));
    return aplicarPreciosDeAjustes(siguiente);
  },

  async reset() {
    const base = buildDefaultSettings();
    unwrap(await supabase.from('settings').upsert({ id: SETTINGS_ID, value: base }));
    return aplicarPreciosDeAjustes(base);
  },
};

// -------------------------------------------------------------- mantenimiento

export const maintenance = {
  async exportData() {
    return {
      version: 2,
      exported_at: new Date().toISOString(),
      products: await products.list(),
      orders: await orders.listAll(),
      settings: [await settings.get()],
      users: await users.list(),
    };
  },

  async importData(backup) {
    if (!backup || !Array.isArray(backup.products)) {
      throw new Error('El archivo no tiene el formato esperado.');
    }

    const limpios = backup.products.map((product) => ({
      ...sanitizeProductPayload(product),
      id: Number(product.id) || undefined,
    }));

    unwrap(await supabase.from('products').upsert(limpios));
    if (backup.settings?.[0]) await settings.update(backup.settings[0]);
    return limpios.length;
  },

  async resetDemo() {
    throw new Error('Restablecer la demo sólo está disponible en modo local.');
  },
};
