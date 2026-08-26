// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Checkout from './Checkout';
import ThaigerLogin from '../components/ThaigerLogin';
import Register from './Register';
import { auth, orders, products, DEMO_ADMIN } from '../services/localBackend';
import { renderWithProviders, resetApp } from '../test/utils';

async function ponerEnCarrito(cantidad = 1) {
  const producto = await products.get(3); // BIOSPORT Creatine Monohydrate 1K
  window.localStorage.setItem('thaiger_cart', JSON.stringify([{ ...producto, quantity: cantidad }]));
  return producto;
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
    await user.type(screen.getByPlaceholderText('••••••••'), 'incorrecta');
    await user.click(screen.getByRole('button', { name: /^ingresar$/i }));

    expect(await screen.findByText(/correo o contraseña incorrectos/i)).toBeInTheDocument();
    expect(await auth.getSession()).toBeNull();
  });

  it('registra una cuenta nueva y deja la sesión abierta', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />, { route: '/register' });

    await user.type(await screen.findByPlaceholderText(/tu nombre/i), 'Cliente Nuevo');
    await user.type(screen.getByPlaceholderText(/usuario@ejemplo/i), 'cliente@thaiger.mx');

    const [password, confirmar] = screen.getAllByPlaceholderText('••••••••');
    await user.type(password, 'secreto123');
    await user.type(confirmar, 'secreto123');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(async () => {
      const sesion = await auth.getSession();
      expect(sesion?.email).toBe('cliente@thaiger.mx');
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
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
    expect(await auth.getSession()).toBeNull();
  });
});

describe('checkout', () => {
  it('registra el pedido, descuenta inventario y vacía el carrito', async () => {
    const user = userEvent.setup();
    const cliente = await auth.signUp('comprador@thaiger.mx', 'secreto123', 'Comprador');
    const producto = await ponerEnCarrito(2);

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

    // Nivel 1 (menos de $10,000 de lista) más $250 de envío por no llegar a $5,000.
    expect(pedido.total).toBeCloseTo(producto.price1 * 2 + 250, 2);

    // El inventario bajó y el carrito quedó limpio.
    expect((await products.get(producto.id)).stock).toBe(producto.stock - 2);
    expect(JSON.parse(window.localStorage.getItem('thaiger_cart'))).toEqual([]);
  });

  it('exige la dirección completa antes de cobrar', async () => {
    const user = userEvent.setup();
    const cliente = await auth.signUp('incompleto@thaiger.mx', 'secreto123');
    await ponerEnCarrito(1);

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
});
