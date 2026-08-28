// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Checkout from './Checkout';
import ThaigerLogin from '../components/ThaigerLogin';
import Register from './Register';
import { auth, orders, products, DEMO_ADMIN } from '../services/localBackend';
import { getUnitPrice, SHIPPING_COST } from '../lib/pricing';
import { ponerEnCarrito, renderWithProviders, resetApp } from '../test/utils';

/** Un producto con inventario de sobra, para que la compra no choque con el stock. */
async function productoDePrueba() {
  const lista = await products.list();
  return lista.find((p) => p.stock >= 5);
}

async function llenarEnvio(user) {
  await user.type(screen.getByPlaceholderText(/juan pérez/i), 'Juan Pérez');
  await user.type(screen.getByPlaceholderText(/\+52/), '5512345678');
  await user.type(screen.getByPlaceholderText(/av\. revolución/i), 'Av. Revolución 123');
  await user.type(screen.getByPlaceholderText(/cdmx/i), 'CDMX');
  await user.type(screen.getByPlaceholderText('00000'), '01000');
}

beforeEach(async () => {
  await resetApp();
});

describe('acceso a la cuenta', () => {
  it('permite entrar con la cuenta de administrador de demostración', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThaigerLogin />, { route: '/login' });

    await user.click(await screen.findByRole('button', { name: /rellenar datos/i }));
    await user.click(screen.getByRole('button', { name: /^ingresar$/i }));

    await waitFor(async () => {
      const sesion = await auth.getSession();
      expect(sesion?.role).toBe('admin');
      expect(sesion.email).toBe(DEMO_ADMIN.email);
    });
  });

  it('rechaza una contraseña incorrecta', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThaigerLogin />, { route: '/login' });

    await user.type(await screen.findByPlaceholderText(/usuario@ejemplo/i), DEMO_ADMIN.email);
    await user.type(screen.getByPlaceholderText('••••••••'), 'incorrecta1');
    await user.click(screen.getByRole('button', { name: /^ingresar$/i }));

    expect(await screen.findByText(/correo o contraseña incorrectos/i)).toBeInTheDocument();
    expect(await auth.getSession()).toBeNull();
  });

  it('registra una cuenta nueva y deja la sesión abierta', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />, { route: '/register' });

    await user.type(await screen.findByPlaceholderText(/tu nombre/i), 'Cliente Nuevo');
    await user.type(screen.getByPlaceholderText(/usuario@ejemplo/i), 'registro@thaiger.mx');

    const [password, confirmar] = screen.getAllByPlaceholderText('••••••••');
    await user.type(password, 'secreto123');
    await user.type(confirmar, 'secreto123');

    // La casilla de términos es obligatoria.
    const terminos = screen.queryByRole('checkbox');
    if (terminos) await user.click(terminos);

    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(async () => {
      const sesion = await auth.getSession();
      expect(sesion?.email).toBe('registro@thaiger.mx');
      expect(sesion.role).toBe('user');
    });
  });

  it('no registra si las contraseñas no coinciden', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />, { route: '/register' });

    await user.type(await screen.findByPlaceholderText(/tu nombre/i), 'Cliente');
    await user.type(screen.getByPlaceholderText(/usuario@ejemplo/i), 'otro@thaiger.mx');

    const [password, confirmar] = screen.getAllByPlaceholderText('••••••••');
    await user.type(password, 'secreto123');
    await user.type(confirmar, 'otracosa123');

    const terminos = screen.queryByRole('checkbox');
    if (terminos) await user.click(terminos);

    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
    expect(await auth.getSession()).toBeNull();
  });

  it('exige una contraseña con letras y números', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />, { route: '/register' });

    await user.type(await screen.findByPlaceholderText(/tu nombre/i), 'Cliente');
    await user.type(screen.getByPlaceholderText(/usuario@ejemplo/i), 'debil@thaiger.mx');

    const [password, confirmar] = screen.getAllByPlaceholderText('••••••••');
    await user.type(password, 'solopalabras');
    await user.type(confirmar, 'solopalabras');

    const terminos = screen.queryByRole('checkbox');
    if (terminos) await user.click(terminos);

    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText(/letras y números/i)).toBeInTheDocument();
    expect(await auth.getSession()).toBeNull();
  });
});

describe('checkout', () => {
  it('registra el pedido, descuenta inventario y vacía el carrito', async () => {
    const user = userEvent.setup();
    const cliente = await auth.signUp('comprador@thaiger.mx', 'secreto123', 'Comprador');
    const producto = await productoDePrueba();
    ponerEnCarrito(producto, 2);

    renderWithProviders(<Checkout />, { route: '/checkout' });
    await screen.findByRole('heading', { name: /finalizar compra/i });
    await llenarEnvio(user);
    await user.click(screen.getByRole('button', { name: /pagar ahora/i }));

    await waitFor(async () => expect(await orders.listByUser(cliente.id)).toHaveLength(1));

    const [pedido] = await orders.listByUser(cliente.id);
    expect(pedido.status).toBe('Pago Pendiente');
    expect(pedido.shipping_info).toMatchObject({ fullName: 'Juan Pérez', city: 'CDMX', zip: '01000' });
    expect(pedido.payment_info.method).toBe('SPEI');
    expect(pedido.order_items).toHaveLength(1);
    expect(pedido.order_items[0]).toMatchObject({ product_id: producto.id, quantity: 2 });

    // El total lo calcula la lógica de negocio, no la prueba: nivel 1 (menos de
    // $10,000 de lista) más el envío por no llegar al mínimo.
    expect(pedido.total).toBeCloseTo(getUnitPrice(producto, 1) * 2 + SHIPPING_COST, 2);

    // El inventario bajó y el carrito quedó limpio.
    expect((await products.get(producto.id)).stock).toBe(producto.stock - 2);
    expect(JSON.parse(window.localStorage.getItem('thaiger_cart'))).toEqual([]);
  });

  it('el precio no se acepta desde el navegador', async () => {
    const user = userEvent.setup();
    const cliente = await auth.signUp('listillo@thaiger.mx', 'secreto123', 'Listillo');
    const producto = await productoDePrueba();

    // Carrito manipulado a mano: precios a un peso.
    window.localStorage.setItem(
      'thaiger_cart',
      JSON.stringify([{ ...producto, price1: 1, price2: 1, price3: 1, quantity: 1 }])
    );

    renderWithProviders(<Checkout />, { route: '/checkout' });
    await screen.findByRole('heading', { name: /finalizar compra/i });
    await llenarEnvio(user);
    await user.click(screen.getByRole('button', { name: /pagar ahora/i }));

    await waitFor(async () => expect(await orders.listByUser(cliente.id)).toHaveLength(1));

    const [pedido] = await orders.listByUser(cliente.id);
    // El backend recalculó contra el catálogo.
    expect(pedido.order_items[0].price_at_purchase).toBeCloseTo(getUnitPrice(producto, 1), 2);
    expect(pedido.total).toBeGreaterThan(1);
  });

  it('exige la dirección completa antes de cobrar', async () => {
    const user = userEvent.setup();
    const cliente = await auth.signUp('incompleto@thaiger.mx', 'secreto123');
    ponerEnCarrito(await productoDePrueba(), 1);

    renderWithProviders(<Checkout />, { route: '/checkout' });
    await screen.findByRole('heading', { name: /finalizar compra/i });

    await user.type(screen.getByPlaceholderText(/juan pérez/i), 'Sólo el nombre');
    await user.click(screen.getByRole('button', { name: /pagar ahora/i }));

    expect(await screen.findByText(/completa tu dirección de envío/i)).toBeInTheDocument();
    expect(await orders.listByUser(cliente.id)).toHaveLength(0);
  });

  it('con el carrito vacío no deja continuar', async () => {
    await auth.signUp('vacio@thaiger.mx', 'secreto123');
    renderWithProviders(<Checkout />, { route: '/checkout' });

    expect(await screen.findByText(/el carrito está vacío/i)).toBeInTheDocument();
  });

  it('muestra los datos bancarios de la configuración, no escritos a mano', async () => {
    await auth.signUp('banco@thaiger.mx', 'secreto123');
    ponerEnCarrito(await productoDePrueba(), 1);

    renderWithProviders(<Checkout />, { route: '/checkout' });
    await screen.findByRole('heading', { name: /finalizar compra/i });

    // Los valores por defecto de src/data/settings.js.
    expect(await screen.findByText(/BANCO DEMO/i)).toBeInTheDocument();
    expect(screen.getByText(/000000000000000000/)).toBeInTheDocument();
    // Y el aviso de que la cuenta es de ejemplo (el texto vive en un <strong>
    // dentro de un <p>, así que hay más de una coincidencia).
    expect(screen.getAllByText(/cuenta de ejemplo/i).length).toBeGreaterThan(0);
  });
});
