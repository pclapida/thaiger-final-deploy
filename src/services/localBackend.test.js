import { describe, it, expect, beforeEach } from 'vitest';
import { idb, STORES } from '../lib/idb';
import {
  auth,
  ensureSeeded,
  maintenance,
  orders,
  products,
  settings,
  users,
  _resetSeedState,
  DEMO_ADMIN,
  DEMO_CUSTOMER,
} from './localBackend';
import { SEED_PRODUCTS } from '../data/seed';
import { resetPricingConfig } from '../lib/pricing';
import { _resetLoginThrottle, MAX_LOGIN_ATTEMPTS } from '../lib/security';

async function limpiarBase() {
  for (const store of STORES) await idb.clear(store);
  _resetSeedState();
  _resetLoginThrottle();
  resetPricingConfig();
  await auth.signOut();
}

/** Muchas operaciones exigen sesión de administrador. */
function entrarComoAdmin() {
  return auth.signIn(DEMO_ADMIN.email, DEMO_ADMIN.password);
}

beforeEach(async () => {
  await limpiarBase();
  await ensureSeeded();
});

describe('siembra inicial', () => {
  it('carga el catálogo de demostración una sola vez', async () => {
    expect(await products.list()).toHaveLength(SEED_PRODUCTS.length);

    _resetSeedState();
    await ensureSeeded();
    expect(await products.list()).toHaveLength(SEED_PRODUCTS.length);
  });

  it('crea las dos cuentas de demostración', async () => {
    const admin = await auth.signIn(DEMO_ADMIN.email, DEMO_ADMIN.password);
    expect(admin.role).toBe('admin');

    const cliente = await auth.signIn(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    expect(cliente.role).toBe('user');
  });

  it('siembra pedidos de ejemplo para que el panel arranque con datos', async () => {
    await entrarComoAdmin();
    const pedidos = await orders.listAll();

    expect(pedidos.length).toBeGreaterThanOrEqual(5);
    expect(pedidos[0].order_items.length).toBeGreaterThan(0);
    // Vienen del más reciente al más antiguo.
    expect(new Date(pedidos[0].created_at) >= new Date(pedidos[1].created_at)).toBe(true);
  });

  it('deja la configuración por defecto lista', async () => {
    const config = await settings.get();
    expect(config.store.name).toBe('Thaiger Supplements');
    expect(config.hero.length).toBeGreaterThan(0);
    expect(config.payment.isDemo).toBe(true);
  });
});

describe('productos: quién puede tocarlos', () => {
  it('cualquiera puede leer el catálogo', async () => {
    expect((await products.list()).length).toBeGreaterThan(0);
    expect(await products.get(1)).toMatchObject({ id: 1 });
  });

  it('sin sesión no se puede crear, editar ni borrar', async () => {
    await expect(products.create({ name: 'X', brand: 'Y', category: 'Z', price1: 1 })).rejects.toThrow(
      /iniciar sesión/i
    );
    await expect(products.update(1, { stock: 5 })).rejects.toThrow(/iniciar sesión/i);
    await expect(products.remove(1)).rejects.toThrow(/iniciar sesión/i);
  });

  it('un cliente normal tampoco puede', async () => {
    await auth.signIn(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    await expect(products.update(1, { stock: 5 })).rejects.toThrow(/administrador/i);
    await expect(products.bulkRemove([1])).rejects.toThrow(/administrador/i);
  });
});

describe('productos: gestión como administrador', () => {
  beforeEach(async () => {
    await entrarComoAdmin();
  });

  it('crea un producto nuevo con id consecutivo', async () => {
    const nuevo = await products.create({
      name: 'Producto Manual',
      brand: 'THAIGER LABS',
      category: 'Proteína',
      price1: 100,
      price2: 90,
      price3: 80,
      stock: 5,
      image_url: 'data:image/jpeg;base64,AAA',
    });

    expect(nuevo.id).toBe(SEED_PRODUCTS.length + 1);
    expect((await products.get(nuevo.id)).image_url).toBe('data:image/jpeg;base64,AAA');
  });

  it('rechaza un producto sin datos obligatorios o con precio inválido', async () => {
    await expect(products.create({ name: 'Sólo nombre', price1: 10 })).rejects.toThrow(/obligatorios/i);
    await expect(
      products.create({ name: 'A', brand: 'B', category: 'C', price1: 0 })
    ).rejects.toThrow(/mayor a cero/i);
  });

  it('sanea el texto y descarta imágenes con esquemas peligrosos', async () => {
    const creado = await products.create({
      name: `  Nombre${String.fromCharCode(0)}   con   basura  `,
      brand: 'THAIGER LABS',
      category: 'Salud',
      price1: 100,
      image_url: 'javascript:alert(1)',
    });

    expect(creado.name).toBe('Nombre con basura');
    expect(creado.image_url).toBeNull();
  });

  it('unifica marcas y categorías escritas de otra forma', async () => {
    const creado = await products.create({
      name: 'Whey de prueba',
      brand: 'iron peak',
      category: 'proteina',
      price1: 100,
    });

    // Sin esto volverían a aparecer casillas duplicadas en los filtros.
    expect(creado.brand).toBe('IRON PEAK');
    expect(creado.category).toBe('Proteína');
  });

  it('completa los niveles 2 y 3 con el precio público si faltan', async () => {
    const creado = await products.create({
      name: 'Sin niveles',
      brand: 'PURE CORE',
      category: 'Salud',
      price1: 250,
    });

    expect(creado.price2).toBe(250);
    expect(creado.price3).toBe(250);
  });

  it('la lista devuelve primero lo más reciente', async () => {
    const nuevo = await products.create({ name: 'Recién creado', brand: 'X', category: 'Y', price1: 1 });
    expect((await products.list())[0].id).toBe(nuevo.id);
  });

  it('busca por id sin importar si es texto o número', async () => {
    expect(await products.get('1')).toEqual(await products.get(1));
  });

  it('actualiza sin cambiar el id', async () => {
    const actualizado = await products.update(1, { stock: 99, is_on_sale: true, discount_percent: 30 });
    expect(actualizado.id).toBe(1);
    expect(actualizado.stock).toBe(99);
    expect((await products.get(1)).discount_percent).toBe(30);
  });

  it('una oferta sin activar no guarda porcentaje', async () => {
    const actualizado = await products.update(1, { is_on_sale: false, discount_percent: 40 });
    expect(actualizado.discount_percent).toBe(0);
  });

  it('avisa si se edita un producto inexistente', async () => {
    await expect(products.update(999999, { stock: 1 })).rejects.toThrow(/ya no existe/);
  });

  it('elimina un producto y eliminar dos veces no revienta', async () => {
    await products.remove(1);
    expect(await products.get(1)).toBeNull();
    await expect(products.remove(1)).resolves.toBeUndefined();
  });

  it('aplica un cambio a varios productos de una vez', async () => {
    const actualizados = await products.bulkUpdate([1, 2, 3], { is_on_sale: true, discount_percent: 25 });

    expect(actualizados).toHaveLength(3);
    for (const id of [1, 2, 3]) {
      expect((await products.get(id)).discount_percent).toBe(25);
    }
  });

  it('borra varios productos de una vez', async () => {
    await products.bulkRemove([1, 2]);
    expect(await products.get(1)).toBeNull();
    expect(await products.get(2)).toBeNull();
    expect((await products.list()).length).toBe(SEED_PRODUCTS.length - 2);
  });

  it('renombra una marca en todo el catálogo de una pasada', async () => {
    const antes = (await products.list()).filter((p) => p.brand === 'IRON PEAK').length;
    const cambiados = await products.renameGroup('brand', 'IRON PEAK', 'IRON PEAK MX');

    expect(cambiados).toBe(antes);
    expect((await products.list()).some((p) => p.brand === 'IRON PEAK')).toBe(false);
    expect((await products.list()).filter((p) => p.brand === 'IRON PEAK MX')).toHaveLength(antes);
  });

  it('no renombra campos que no toca', async () => {
    await expect(products.renameGroup('name', 'a', 'b')).rejects.toThrow(/marca o categoría/i);
    await expect(products.renameGroup('brand', 'IRON PEAK', '   ')).rejects.toThrow(/no puede quedar vacío/i);
  });
});

describe('cuentas', () => {
  it('registra y deja la sesión abierta', async () => {
    const usuario = await auth.signUp('nuevo@thaiger.mx', 'secreto123', 'Nuevo');

    expect(usuario.role).toBe('user');
    expect(usuario.email).toBe('nuevo@thaiger.mx');
    expect((await auth.getSession()).id).toBe(usuario.id);
  });

  it('nunca expone la contraseña ni la sal', async () => {
    const usuario = await auth.signUp('seguro@thaiger.mx', 'secreto123', 'Seguro');

    expect(usuario.password_hash).toBeUndefined();
    expect(usuario.salt).toBeUndefined();
    expect(usuario.password_algo).toBeUndefined();
    expect((await auth.getSession()).password_hash).toBeUndefined();
  });

  it('aplica la política de contraseñas y valida el correo', async () => {
    await expect(auth.signUp('corto@thaiger.mx', 'abc1')).rejects.toThrow(/al menos 8/i);
    await expect(auth.signUp('flojo@thaiger.mx', 'solopalabras')).rejects.toThrow(/letras y números/i);
    await expect(auth.signUp('no-es-correo', 'secreto123')).rejects.toThrow(/no es válido/i);
  });

  it('rechaza correos repetidos aunque cambie la capitalización', async () => {
    await auth.signUp('repetido@thaiger.mx', 'secreto123');
    await expect(auth.signUp('REPETIDO@thaiger.mx', 'secreto123')).rejects.toThrow(/already registered/);
  });

  it('el login distingue la contraseña pero no el correo', async () => {
    await auth.signUp('login@thaiger.mx', 'secreto123', 'Login');
    await auth.signOut();

    await expect(auth.signIn('login@thaiger.mx', 'incorrecta1')).rejects.toThrow(/Invalid login/);
    await expect(auth.signIn('nadie@thaiger.mx', 'secreto123')).rejects.toThrow(/Invalid login/);

    expect((await auth.signIn('LOGIN@thaiger.mx', 'secreto123')).name).toBe('Login');
  });

  it('bloquea la cuenta tras demasiados intentos fallidos', async () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i += 1) {
      await expect(auth.signIn(DEMO_ADMIN.email, 'incorrecta1')).rejects.toThrow();
    }

    // Aun con la contraseña buena, el bloqueo se respeta.
    await expect(auth.signIn(DEMO_ADMIN.email, DEMO_ADMIN.password)).rejects.toThrow(/Demasiados intentos/i);
  });

  it('acertar la contraseña limpia los intentos fallidos', async () => {
    await expect(auth.signIn(DEMO_ADMIN.email, 'incorrecta1')).rejects.toThrow();
    await entrarComoAdmin();
    await auth.signOut();

    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i += 1) {
      await expect(auth.signIn(DEMO_ADMIN.email, 'incorrecta1')).rejects.toThrow(/Invalid login/);
    }
  });

  it('cerrar sesión invalida el token guardado', async () => {
    const usuario = await auth.signUp('salir@thaiger.mx', 'secreto123');
    await auth.signOut();

    expect(await auth.getSession()).toBeNull();

    // El token queda anulado en la cuenta: una sesión copiada ya no sirve.
    expect((await idb.get('users', usuario.id)).session_token).toBeNull();
  });

  it('avisa a los suscriptores al entrar y salir', async () => {
    const eventos = [];
    const unsubscribe = auth.onAuthStateChange((usuario) => eventos.push(usuario?.email ?? null));

    await auth.signUp('evento@thaiger.mx', 'secreto123');
    await auth.signOut();
    unsubscribe();
    await entrarComoAdmin();

    expect(eventos).toEqual(['evento@thaiger.mx', null]);
  });

  it('actualiza nombre y foto del perfil', async () => {
    const usuario = await auth.signUp('perfil@thaiger.mx', 'secreto123', 'Antes');
    const actualizado = await auth.updateProfile(usuario.id, {
      name: 'Después',
      avatar_url: 'data:image/jpeg;base64,BBB',
    });

    expect(actualizado.name).toBe('Después');
    expect((await auth.getSession()).avatar_url).toBe('data:image/jpeg;base64,BBB');
  });

  it('nadie edita el perfil de otra persona', async () => {
    const otro = await auth.signUp('otro@thaiger.mx', 'secreto123', 'Otro');
    await auth.signOut();
    await auth.signUp('yo@thaiger.mx', 'secreto123', 'Yo');

    await expect(auth.updateProfile(otro.id, { name: 'Robado' })).rejects.toThrow(/tu propio perfil/i);
  });

  it('cambiar la contraseña exige la actual y respeta la política', async () => {
    await auth.signUp('cambio@thaiger.mx', 'secreto123', 'Cambio');

    await expect(auth.changePassword('equivocada1', 'nueva12345')).rejects.toThrow(/no es correcta/i);
    await expect(auth.changePassword('secreto123', 'corta')).rejects.toThrow(/al menos 8/i);

    expect(await auth.changePassword('secreto123', 'nueva12345')).toBe(true);

    await auth.signOut();
    await expect(auth.signIn('cambio@thaiger.mx', 'secreto123')).rejects.toThrow(/Invalid login/);
    expect((await auth.signIn('cambio@thaiger.mx', 'nueva12345')).email).toBe('cambio@thaiger.mx');
  });
});

describe('usuarios (panel de administración)', () => {
  it('sólo un administrador puede listarlos y tocarlos', async () => {
    await expect(users.list()).rejects.toThrow(/iniciar sesión/i);

    await auth.signIn(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    await expect(users.list()).rejects.toThrow(/administrador/i);
  });

  it('lista las cuentas sin credenciales', async () => {
    await entrarComoAdmin();
    const lista = await users.list();

    expect(lista.length).toBe(2);
    for (const usuario of lista) {
      expect(usuario.password_hash).toBeUndefined();
      expect(usuario.salt).toBeUndefined();
    }
  });

  it('crea una cuenta desde el panel', async () => {
    await entrarComoAdmin();
    const creado = await users.create({
      email: 'nuevo.admin@thaiger.mx',
      password: 'secreto123',
      name: 'Segundo Admin',
      role: 'admin',
    });

    expect(creado.role).toBe('admin');
    expect(creado.password_hash).toBeUndefined();
    expect((await users.list())).toHaveLength(3);
  });

  it('cambia el rol de una cuenta', async () => {
    await entrarComoAdmin();
    const cliente = (await users.list()).find((u) => u.role === 'user');

    expect((await users.setRole(cliente.id, 'admin')).role).toBe('admin');
    expect((await users.setRole(cliente.id, 'user')).role).toBe('user');
  });

  it('nunca deja la tienda sin administrador', async () => {
    const admin = await entrarComoAdmin();

    await expect(users.setRole(admin.id, 'user')).rejects.toThrow(/tu propio rol/i);
    await expect(users.remove(admin.id)).rejects.toThrow(/tu propia cuenta/i);
  });

  it('elimina una cuenta de cliente', async () => {
    await entrarComoAdmin();
    const cliente = (await users.list()).find((u) => u.role === 'user');

    await users.remove(cliente.id);
    expect(await users.list()).toHaveLength(1);
  });

  it('restablece la contraseña y cierra la sesión de esa cuenta', async () => {
    await entrarComoAdmin();
    const cliente = (await users.list()).find((u) => u.role === 'user');

    await expect(users.setPassword(cliente.id, 'corta')).rejects.toThrow(/al menos 8/i);
    expect(await users.setPassword(cliente.id, 'flamante123')).toBe(true);

    await auth.signOut();
    expect((await auth.signIn(DEMO_CUSTOMER.email, 'flamante123')).id).toBe(cliente.id);
  });
});

describe('configuración de la tienda', () => {
  it('cualquiera puede leerla, sólo el administrador la cambia', async () => {
    expect((await settings.get()).store.name).toBeTruthy();
    await expect(settings.update({ store: { name: 'Pirata' } })).rejects.toThrow(/iniciar sesión/i);
  });

  it('guarda los cambios y completa los campos que falten', async () => {
    await entrarComoAdmin();
    const guardado = await settings.update({ store: { name: 'Tienda Nueva' } });

    expect(guardado.store.name).toBe('Tienda Nueva');
    // Los demás campos siguen ahí aunque el parche sólo traiga uno.
    expect(guardado.store.email).toBeTruthy();
    expect(guardado.payment.bank).toBeTruthy();
  });

  it('guardar los umbrales los aplica de inmediato a la aritmética de precios', async () => {
    const { getPricingConfig } = await import('../lib/pricing');

    await entrarComoAdmin();
    // Sin volver a leer: si `update` no sincronizara, el carrito seguiría
    // calculando con los valores viejos el resto de la sesión.
    await settings.update({ shipping: { freeFrom: 1200, cost: 80 }, tiers: { tier2From: 2500, tier3From: 4000 } });

    expect(getPricingConfig()).toMatchObject({
      freeShippingFrom: 1200,
      shippingCost: 80,
      tier2From: 2500,
      tier3From: 4000,
    });
  });

  it('leer la configuración también sincroniza los umbrales', async () => {
    const { getPricingConfig, resetPricingConfig: reiniciar } = await import('../lib/pricing');

    await entrarComoAdmin();
    await settings.update({ shipping: { freeFrom: 999, cost: 33 } });

    reiniciar();
    expect(getPricingConfig().freeShippingFrom).toBe(5000);

    await settings.get();
    expect(getPricingConfig().freeShippingFrom).toBe(999);
  });

  it('restaura los valores por defecto y los vuelve a aplicar', async () => {
    const { getPricingConfig } = await import('../lib/pricing');

    await entrarComoAdmin();
    await settings.update({ store: { name: 'Otra cosa' }, shipping: { freeFrom: 10, cost: 5 } });

    expect((await settings.reset()).store.name).toBe('Thaiger Supplements');
    expect(getPricingConfig().freeShippingFrom).toBe(5000);
  });
});

describe('pedidos', () => {
  const envio = {
    fullName: 'Juan Pérez',
    phone: '5512345678',
    address: 'Av. Demo 123',
    city: 'CDMX',
    zip: '01000',
  };

  async function comprar(items, extra = {}) {
    return orders.create({
      shippingInfo: envio,
      paymentInfo: { concepto: 'TH-1234', banco: 'BANCO DEMO' },
      items,
      ...extra,
    });
  }

  it('sin sesión no se puede comprar', async () => {
    await expect(comprar([{ product_id: 1, quantity: 1 }])).rejects.toThrow(/iniciar sesión/i);
  });

  it('guarda el pedido con sus artículos', async () => {
    const cliente = await auth.signIn(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    const pedido = await comprar([
      { product_id: 1, quantity: 2 },
      { product_id: 3, quantity: 1 },
    ]);

    expect(pedido.status).toBe('Pago Pendiente');
    expect(pedido.order_items).toHaveLength(2);
    expect(pedido.user_id).toBe(cliente.id);
    expect(pedido.shipping_info.fullName).toBe('Juan Pérez');
  });

  it('recalcula los precios: un carrito manipulado no cambia el cobro', async () => {
    await auth.signIn(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    const catalogo = await products.get(1);

    const pedido = await comprar([
      // El navegador manda un precio ridículo a propósito.
      { product_id: 1, quantity: 1, price_at_purchase: 1, product_name: 'Regalo' },
    ]);

    expect(pedido.order_items[0].price_at_purchase).toBeCloseTo(catalogo.price1, 2);
    expect(pedido.order_items[0].product_name).toBe(catalogo.name);
    expect(pedido.total).toBeCloseTo(catalogo.price1 + 250, 2);
  });

  it('rechaza más unidades de las que hay en inventario', async () => {
    await auth.signIn(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    const producto = await products.get(1);

    await expect(comprar([{ product_id: 1, quantity: producto.stock + 1 }])).rejects.toThrow(/Sólo quedan/i);
  });

  it('rechaza cantidades inválidas, productos inexistentes y carritos vacíos', async () => {
    await auth.signIn(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);

    await expect(comprar([{ product_id: 1, quantity: 0 }])).rejects.toThrow(/cantidad inválida/i);
    await expect(comprar([{ product_id: 99999, quantity: 1 }])).rejects.toThrow(/ya no está disponible/i);
    await expect(comprar([])).rejects.toThrow(/carrito está vacío/i);
  });

  it('exige la dirección completa', async () => {
    await auth.signIn(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);

    await expect(
      orders.create({
        shippingInfo: { fullName: 'Sólo el nombre' },
        paymentInfo: {},
        items: [{ product_id: 1, quantity: 1 }],
      })
    ).rejects.toThrow(/dirección de envío/i);
  });

  it('cada usuario sólo ve sus pedidos', async () => {
    const cliente = await auth.signIn(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    const antes = (await orders.listByUser(cliente.id)).length;

    await comprar([{ product_id: 1, quantity: 1 }]);

    expect(await orders.listByUser(cliente.id)).toHaveLength(antes + 1);
    expect(await orders.listByUser('otra-persona')).toHaveLength(0);
  });

  it('sólo el administrador ve todos los pedidos', async () => {
    await auth.signIn(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    await expect(orders.listAll()).rejects.toThrow(/administrador/i);
  });

  it('cambia el estatus del pedido', async () => {
    await entrarComoAdmin();
    const [pedido] = await orders.listAll();

    await orders.updateStatus(pedido.id, 'Enviado');
    expect((await orders.listAll()).find((o) => o.id === pedido.id).status).toBe('Enviado');
  });

  it('avisa si el pedido no existe', async () => {
    await entrarComoAdmin();
    await expect(orders.updateStatus('inexistente', 'Enviado')).rejects.toThrow(/ya no existe/);
  });

  it('elimina un pedido junto con sus artículos', async () => {
    await entrarComoAdmin();
    const [pedido] = await orders.listAll();

    await orders.remove(pedido.id);

    expect((await orders.listAll()).some((o) => o.id === pedido.id)).toBe(false);
    expect((await idb.getAll('order_items')).some((i) => i.order_id === pedido.id)).toBe(false);
  });

  it('descuenta el inventario y nunca lo deja negativo', async () => {
    const antes = await products.get(1);
    await orders.decrementStock([{ product_id: 1, quantity: 2 }]);
    expect((await products.get(1)).stock).toBe(antes.stock - 2);

    await orders.decrementStock([{ product_id: 1, quantity: 99999 }]);
    expect((await products.get(1)).stock).toBe(0);
  });

  it('ignora productos que ya no están en el catálogo', async () => {
    await expect(orders.decrementStock([{ product_id: 999999, quantity: 1 }])).resolves.toBeUndefined();
  });
});

describe('mantenimiento', () => {
  it('sólo el administrador puede exportar o importar', async () => {
    await expect(maintenance.exportData()).rejects.toThrow(/iniciar sesión/i);
  });

  it('la copia de seguridad nunca lleva contraseñas', async () => {
    await entrarComoAdmin();
    const copia = await maintenance.exportData();

    expect(copia.products).toHaveLength(SEED_PRODUCTS.length);
    expect(copia.users.length).toBe(2);
    for (const usuario of copia.users) {
      expect(usuario.password_hash).toBeUndefined();
      expect(usuario.salt).toBeUndefined();
    }
  });

  it('importa un catálogo saneado', async () => {
    await entrarComoAdmin();

    const importados = await maintenance.importData({
      products: [
        { id: 1, name: 'Importado', brand: 'THAIGER LABS', category: 'Salud', price1: 300 },
        { id: 2, name: 'Otro', brand: 'PURE CORE', category: 'Salud', price1: 400, image_url: 'javascript:alert(1)' },
      ],
    });

    expect(importados).toBe(2);
    expect(await products.list()).toHaveLength(2);
    expect((await products.get(2)).image_url).toBeNull();
  });

  it('rechaza un archivo con otro formato', async () => {
    await entrarComoAdmin();
    await expect(maintenance.importData({ cosas: [] })).rejects.toThrow(/formato esperado/i);
    await expect(maintenance.importData(null)).rejects.toThrow(/formato esperado/i);
  });
});
