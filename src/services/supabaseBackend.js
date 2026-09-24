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
import { SETTINGS_ID, buildDefaultSettings, withSettingsDefaults } from '../data/settings';
// Ya no se importa la aritmética de precios: en este backend la hace
// Postgres (create_order). Aquí sólo se sincronizan los umbrales para que
// el resumen del carrito coincida con lo que va a cobrar el servidor.
import { configurePricing } from '../lib/pricing';
import { normalizarRol } from '../lib/roles';
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
    weight_g: medidaPositiva(data.weight_g, 500),
    length_cm: medidaPositiva(data.length_cm, 20),
    width_cm: medidaPositiva(data.width_cm, 15),
    height_cm: medidaPositiva(data.height_cm, 10),
  };
}

function medidaPositiva(valor, defecto) {
  const n = Math.round(Number(valor));
  return Number.isFinite(n) && n > 0 ? n : defecto;
}

/**
 * Llama a una Edge Function y traduce su error a un mensaje legible: la
 * función responde `{ error: "..." }` en español, y supabase-js lo envuelve
 * en un FunctionsHttpError cuyo cuerpo hay que leer aparte.
 */
async function invocarFuncion(nombre, body) {
  const { data, error } = await supabase.functions.invoke(nombre, { body });
  if (!error) return data;

  let mensaje = error.message;
  try {
    const cuerpo = await error.context?.json?.();
    if (cuerpo?.error) mensaje = cuerpo.error;
  } catch {
    /* sin cuerpo JSON: se queda el mensaje genérico */
  }
  throw new Error(mensaje || `No se pudo llamar a ${nombre}.`);
}

// ------------------------------------------------------------------ productos

export const products = {
  // Sin red de seguridad a propósito. La versión anterior devolvía el catálogo
  // de demostración cuando la consulta fallaba o la tabla estaba vacía: en una
  // tienda real eso enseña mercancía que no existe, el cliente la mete al
  // carrito y se entera hasta el checkout. Mejor un error honesto.
  async list() {
    const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
    if (error) throw new Error(`No se pudo cargar el catálogo: ${error.message}`);
    return data || [];
  },

  async get(id) {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`No se pudo cargar el producto: ${error.message}`);
    return data || null;
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

  // `userId` ya no se usa: el dueño del pedido lo decide auth.uid() en el
  // servidor, que es lo único que el navegador no puede falsificar.
  async create({ shippingInfo, paymentInfo, items, shippingRate }) {
    // Refresca los umbrales configurados: el resumen que ve el cliente debe
    // cuadrar con lo que calculará el servidor.
    await settings.get();

    // Validación de cortesía, para dar el error sin ir al servidor. La de
    // verdad está en create_order(): esta se puede saltar desde la consola.
    const envio = sanitizeShipping(shippingInfo);
    if (!envio.fullName || !envio.address || !envio.city || !envio.zip || !envio.phone) {
      throw new Error('Faltan datos de la dirección de envío.');
    }

    // TODO el pedido lo arma Postgres: precios, nivel, envío, total, estatus y
    // el descuento de inventario, en una sola transacción. El navegador sólo
    // dice qué y cuánto. No hay política de INSERT sobre `orders`, así que éste
    // es el único camino (ver scripts/setup_supabase.sql).
    const pedido = unwrap(
      await supabase.rpc('create_order', {
        p_items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        p_shipping: envio,
        p_payment: {
          provider: paymentInfo?.provider === 'mercadopago' ? 'mercadopago' : 'spei',
          concepto: sanitizeText(paymentInfo?.concepto, { maxLength: 24 }),
          banco: sanitizeText(paymentInfo?.banco, { maxLength: 60 }),
        },
        // Tarifa cotizada ({ quote_id, rate_id }): el precio lo lee Postgres de
        // shipping_quotes; aquí sólo se dice cuál eligió el cliente.
        p_shipping_rate: shippingRate?.quote_id ? { quote_id: shippingRate.quote_id, rate_id: shippingRate.rate_id } : null,
      })
    );

    if (!pedido?.id) {
      throw new Error('No se pudo confirmar el pedido. Vuelve a intentarlo.');
    }

    return { ...pedido, order_items: pedido.order_items ?? [] };
  },

  async updateStatus(orderId, status) {
    unwrap(await supabase.from('orders').update({ status: sanitizeText(status, { maxLength: 40 }) }).eq('id', orderId));
  },

  async remove(orderId) {
    unwrap(await supabase.from('order_items').delete().eq('order_id', orderId));
    unwrap(await supabase.from('orders').delete().eq('id', orderId));
  }
};

// ------------------------------------------------------------------- pagos

export const payments = {
  /** Crea la preferencia de Checkout Pro y devuelve la URL a la que mandar al cliente. */
  async start(orderId) {
    return invocarFuncion('crear-pago', { order_id: orderId });
  },
};

// ------------------------------------------------------------------ envíos

export const shipping = {
  /** Tarifas para el carrito y el C.P. Con proveedor manual, la tarifa fija. */
  async quote({ zip, items }) {
    return invocarFuncion('cotizar-envio', {
      zip: String(zip ?? '').replace(/\D/g, ''),
      items: (items || []).map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
    });
  },

  /**
   * Genera la guía con la paquetería, o captura una comprada fuera
   * (`{ trackingNumber, carrier, trackingUrl, labelUrl }`). Sólo administradores.
   */
  async createLabel(orderId, datos = {}) {
    const respuesta = await invocarFuncion('generar-guia', {
      order_id: orderId,
      rate_id: datos.rateId,
      tracking_number: datos.trackingNumber,
      carrier: datos.carrier,
      tracking_url: datos.trackingUrl,
      label_url: datos.labelUrl,
    });
    return respuesta?.shipment;
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
    role: normalizarRol(row?.role),
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
    // Este callback NO puede ser async ni llamar a Supabase directamente.
    // supabase-js lo ejecuta dentro de su cerrojo de sesión; toAppUser() hace
    // una consulta que necesita ese mismo cerrojo y se quedaba esperando para
    // siempre. Se notaba al volver a la tienda con una sesión de horas antes:
    // la renovación del token disparaba el aviso, la consulta se bloqueaba, y
    // con ella getSession(), así que «Cargando Thaiger» no terminaba nunca.
    // Por eso el trabajo se difiere con setTimeout, como pide la librería.
    //
    // Las consultas pueden resolver en otro orden que los avisos (un
    // SIGNED_OUT responde al instante; un SIGNED_IN anterior aún consulta el
    // perfil): sólo se entrega el resultado del aviso más reciente.
    let ultimo = 0;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const turno = ++ultimo;
      setTimeout(() => {
        toAppUser(session)
          .then((usuario) => {
            if (turno === ultimo) callback(usuario);
          })
          .catch((error) => console.error('No se pudo leer el perfil de la sesión:', error));
      }, 0);
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

    // El perfil de public.users lo crea el disparador crear_perfil_de_usuario
    // al nacer la cuenta, con el nombre de `options.data.name`. Hacerlo desde
    // aquí fallaba en silencio con la confirmación de correo activada: no hay
    // sesión todavía y la RLS rechaza el insert.

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

  /**
   * Pide el correo con el enlace para restablecer la contraseña.
   *
   * Responde igual exista o no la cuenta: si dijera "ese correo no está
   * registrado", cualquiera podría usar el formulario para averiguar quién
   * tiene cuenta en la tienda.
   */
  async requestPasswordReset(email) {
    const destino = normalizeEmail(email);
    if (!isValidEmail(destino)) throw new Error('El correo electrónico no es válido.');

    const { error } = await supabase.auth.resetPasswordForEmail(destino, {
      redirectTo: `${globalThis.location?.origin ?? ''}/reset-password`,
    });

    // Un fallo real se registra, pero no se le cuenta a quien está mirando.
    if (error) console.error('No se pudo enviar el correo de recuperación:', error.message);
    return { sent: true };
  },

  /** Fija la contraseña nueva usando la sesión temporal que trae el enlace. */
  async completePasswordReset(newPassword) {
    const error = validatePassword(newPassword);
    if (error) throw new Error(error);

    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      throw new Error('El enlace ya no sirve o caducó. Pide uno nuevo desde «Olvidé mi contraseña».');
    }

    unwrap(await supabase.auth.updateUser({ password: newPassword }));
    return true;
  },

  async uploadAvatar(file) {
    const { data: sesion } = await supabase.auth.getUser();
    if (!sesion?.user?.id) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

    const extension = file.name.split('.').pop();
    // La carpeta es el id de la cuenta: la política de Storage sólo deja
    // escribir dentro de la propia, así que nadie pisa la foto de otra persona.
    const fileName = `${sesion.user.id}/${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${extension}`;

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
    // navegador. Se hace desde el panel de Supabase o con scripts/create-admin.js.
    throw new Error(
      'Con Supabase, las cuentas se crean en su panel: Authentication → Users → Add user (con «Auto Confirm User»). Después, aquí le asignas el rol.'
    );
  },

  async setRole(userId, role) {
    const siguiente = normalizarRol(role);
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
