import { describe, it, expect, beforeEach } from 'vitest';
import { idb, STORES } from '../lib/idb';
import { auth, orders, products, ensureSeeded, _resetSeedState, DEMO_ADMIN } from './localBackend';
import { SEED_PRODUCTS } from '../data/seed';

async function limpiarBase() {
  for (const store of STORES) await idb.clear(store);
  _resetSeedState();
  await auth.signOut();
}

beforeEach(async () => {
  await limpiarBase();
  await ensureSeeded();
});

describe('siembra inicial', () => {
  it('carga el catálogo completo una sola vez', async () => {
    const lista = await products.list();
    expect(lista).toHaveLength(SEED_PRODUCTS.length);

    _resetSeedState();
    await ensureSeeded();
    expect(await products.list()).toHaveLength(SEED_PRODUCTS.length);
  });

  it('crea la cuenta de administrador de demostración', async () => {
    const usuario = await auth.signIn(DEMO_ADMIN.email, DEMO_ADMIN.password);
    expect(usuario.role).toBe('admin');
  });
});

describe('productos', () => {
  it('crea un producto nuevo con id consecutivo', async () => {
    const nuevo = await products.create({
      name: 'Producto Manual',
      brand: 'THAIGER',
      category: 'Pruebas',
      price1: 100,
      price2: 90,
      price3: 80,
      stock: 5,
      image_url: 'data:image/jpeg;base64,AAA',
    });

    expect(nuevo.id).toBe(SEED_PRODUCTS.length + 1);

    const guardado = await products.get(nuevo.id);
    expect(guardado.name).toBe('Producto Manual');
    expect(guardado.image_url).toBe('data:image/jpeg;base64,AAA');
  });

  it('la lista devuelve primero lo más reciente', async () => {
    const nuevo = await products.create({ name: 'Recién creado', brand: 'X', category: 'Y', price1: 1 });
    const lista = await products.list();
    expect(lista[0].id).toBe(nuevo.id);
  });

  it('busca por id sin importar si es texto o número', async () => {
    const porNumero = await products.get(1);
    const porTexto = await products.get('1');
    expect(porTexto).toEqual(porNumero);
  });

  it('actualiza sin cambiar el id', async () => {
    const actualizado = await products.update(1, { stock: 99, is_on_sale: true, discount_percent: 30 });
    expect(actualizado.id).toBe(1);
    expect(actualizado.stock).toBe(99);
    expect((await products.get(1)).discount_percent).toBe(30);
  });

  it('avisa si se edita un producto inexistente', async () => {
    await expect(products.update(999999, { stock: 1 })).rejects.toThrow(/ya no existe/);
  });

  it('elimina un producto', async () => {
    await products.remove(1);
    expect(await products.get(1)).toBeNull();
  });

  it('eliminar dos veces no revienta', async () => {
    await products.remove(1);
    await expect(products.remove(1)).resolves.toBeUndefined();
  });
});

describe('cuentas', () => {
  it('registra y deja la sesión abierta', async () => {
    const usuario = await auth.signUp('nuevo@thaiger.mx', 'secreto123', 'Nuevo');
    expect(usuario.role).toBe('user');
    expect(usuario.email).toBe('nuevo@thaiger.mx');

    const sesion = await auth.getSession();
    expect(sesion.id).toBe(usuario.id);
  });

  it('nunca expone la contraseña', async () => {
    const usuario = await auth.signUp('seguro@thaiger.mx', 'secreto123', 'Seguro');
    expect(usuario.password_hash).toBeUndefined();
    expect(usuario.salt).toBeUndefined();
  });

  it('rechaza contraseñas cortas y correos repetidos', async () => {
    await expect(auth.signUp('corto@thaiger.mx', '123')).rejects.toThrow(/6 characters/);

    await auth.signUp('repetido@thaiger.mx', 'secreto123');
    await expect(auth.signUp('REPETIDO@thaiger.mx', 'secreto123')).rejects.toThrow(/already registered/);
  });

  it('el login distingue la contraseña pero no el correo', async () => {
    await auth.signUp('login@thaiger.mx', 'secreto123', 'Login');
    await auth.signOut();

    await expect(auth.signIn('login@thaiger.mx', 'incorrecta')).rejects.toThrow(/Invalid login/);
    await expect(auth.signIn('nadie@thaiger.mx', 'secreto123')).rejects.toThrow(/Invalid login/);

    const usuario = await auth.signIn('LOGIN@thaiger.mx', 'secreto123');
    expect(usuario.name).toBe('Login');
  });

  it('cerrar sesión limpia la sesión guardada', async () => {
    await auth.signUp('salir@thaiger.mx', 'secreto123');
    await auth.signOut();
    expect(await auth.getSession()).toBeNull();
  });

  it('avisa a los suscriptores al entrar y salir', async () => {
    const eventos = [];
    const unsubscribe = auth.onAuthStateChange((usuario) => eventos.push(usuario?.email ?? null));

    await auth.signUp('evento@thaiger.mx', 'secreto123');
    await auth.signOut();
    unsubscribe();
    await auth.signIn(DEMO_ADMIN.email, DEMO_ADMIN.password);

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
});

describe('pedidos', () => {
  const carrito = [
    { product_id: 1, product_name: 'Playeras', quantity: 2, price_at_purchase: 174 },
    { product_id: 3, product_name: 'Creatina', quantity: 1, price_at_purchase: 638 },
  ];

  async function crearPedido(userId = 'user-1', extra = {}) {
    return orders.create({
      userId,
      total: 986,
      shippingInfo: { fullName: 'Juan Pérez', city: 'CDMX', zip: '00000' },
      paymentInfo: { method: 'SPEI', concepto: 'TH-1234' },
      items: carrito,
      ...extra,
    });
  }

  it('guarda el pedido con sus artículos', async () => {
    const pedido = await crearPedido();
    expect(pedido.status).toBe('Pago Pendiente');
    expect(pedido.order_items).toHaveLength(2);

    const todos = await orders.listAll();
    expect(todos).toHaveLength(1);
    expect(todos[0].order_items).toHaveLength(2);
    expect(todos[0].shipping_info.fullName).toBe('Juan Pérez');
  });

  it('cada usuario sólo ve sus pedidos', async () => {
    await crearPedido('user-1');
    await crearPedido('user-2');

    expect(await orders.listByUser('user-1')).toHaveLength(1);
    expect(await orders.listByUser('user-3')).toHaveLength(0);
  });

  it('cambia el estatus del pedido', async () => {
    const pedido = await crearPedido();
    await orders.updateStatus(pedido.id, 'Enviado');

    const [guardado] = await orders.listAll();
    expect(guardado.status).toBe('Enviado');
  });

  it('avisa si el pedido no existe', async () => {
    await expect(orders.updateStatus('inexistente', 'Enviado')).rejects.toThrow(/ya no existe/);
  });

  it('descuenta el inventario y nunca lo deja negativo', async () => {
    const antes = await products.get(1);
    await orders.decrementStock(carrito);
    expect((await products.get(1)).stock).toBe(antes.stock - 2);

    await orders.decrementStock([{ product_id: 1, quantity: 99999 }]);
    expect((await products.get(1)).stock).toBe(0);
  });

  it('ignora productos que ya no están en el catálogo', async () => {
    await expect(orders.decrementStock([{ product_id: 999999, quantity: 1 }])).resolves.toBeUndefined();
  });
});
