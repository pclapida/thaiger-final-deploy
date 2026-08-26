/**
 * Backend SUPABASE.
 *
 * Se activa cuando VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY están definidas.
 * Expone exactamente la misma API que `localBackend`, para que las páginas no
 * tengan que saber contra qué están hablando.
 *
 * Tablas esperadas: products, users, orders, order_items (ver setup_supabase.sql).
 */

import { supabase } from '../supabase';
import { SEED_PRODUCTS } from '../data/seed';

export const mode = 'supabase';

const IMAGE_BUCKET = 'product-images';
const AVATAR_BUCKET = 'avatars';

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
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
    const rows = unwrap(await supabase.from('products').insert([data]).select());
    return rows?.[0] ?? data;
  },

  async update(id, patch) {
    const rows = unwrap(await supabase.from('products').update(patch).eq('id', id).select());
    return rows?.[0] ?? { ...patch, id };
  },

  async remove(id) {
    unwrap(await supabase.from('products').delete().eq('id', id));
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

  async create({ userId, total, shippingInfo, paymentInfo, items }) {
    const createdOrders = unwrap(
      await supabase
        .from('orders')
        .insert({
          user_id: userId,
          total,
          shipping_info: shippingInfo,
          payment_info: paymentInfo,
          status: 'Pago Pendiente',
        })
        .select()
    );

    if (!createdOrders || createdOrders.length === 0) {
      throw new Error('No se pudo confirmar el pedido (revisa las políticas RLS de la tabla orders).');
    }

    const order = createdOrders[0];
    unwrap(
      await supabase
        .from('order_items')
        .insert(items.map((item) => ({ ...item, order_id: order.id })))
    );

    return { ...order, order_items: items };
  },

  async updateStatus(orderId, status) {
    unwrap(await supabase.from('orders').update({ status }).eq('id', orderId));
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
    const data = unwrap(await supabase.auth.signInWithPassword({ email, password }));
    return toAppUser(data);
  },

  async signUp(email, password, name) {
    const data = unwrap(
      await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name || 'Usuario Thaiger' } },
      })
    );

    if (data.user) {
      const { error } = await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email,
        name: name || 'Usuario Thaiger',
        role: 'user',
      });
      if (error) console.error('No se pudo guardar el perfil en public.users:', error.message);
    }

    return toAppUser(data.session);
  },

  async signOut() {
    unwrap(await supabase.auth.signOut());
  },

  async updateProfile(userId, updates) {
    unwrap(
      await supabase.auth.updateUser({
        data: { name: updates.name, avatar_url: updates.avatar_url },
      })
    );
    unwrap(
      await supabase
        .from('users')
        .update({ name: updates.name, avatar_url: updates.avatar_url })
        .eq('id', userId)
    );
    return { id: userId, ...updates };
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
