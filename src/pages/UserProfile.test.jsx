// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserProfile from './UserProfile';
import { auth, orders } from '../services/localBackend';
import { renderWithProviders, resetApp, makeImageFile } from '../test/utils';

async function crearCliente() {
  return auth.signUp('cliente@thaiger.mx', 'secreto123', 'Cliente Thaiger');
}

beforeEach(async () => {
  await resetApp();
});

describe('perfil del usuario', () => {
  it('muestra el aviso cuando todavía no hay pedidos', async () => {
    await crearCliente();
    renderWithProviders(<UserProfile />, { route: '/profile' });

    expect(await screen.findByText(/aún no has guardado pedidos/i)).toBeInTheDocument();
    expect(screen.getByText('cliente@thaiger.mx')).toBeInTheDocument();
  });

  it('lista los pedidos del usuario con su total y concepto SPEI', async () => {
    const cliente = await crearCliente();
    await orders.create({
      userId: cliente.id,
      total: 1526,
      shippingInfo: { fullName: 'Cliente Thaiger', city: 'CDMX', zip: '01000' },
      paymentInfo: { method: 'SPEI', concepto: 'TH-4321' },
      items: [{ product_id: 3, product_name: 'Creatina', quantity: 2, price_at_purchase: 638 }],
    });

    renderWithProviders(<UserProfile />, { route: '/profile' });

    expect(await screen.findByText('$1,526.00')).toBeInTheDocument();
    expect(screen.getByText(/TH-4321/)).toBeInTheDocument();
    expect(screen.getByText(/1 artículos/i)).toBeInTheDocument();
  });

  it('no muestra los pedidos de otras personas', async () => {
    const cliente = await crearCliente();
    await orders.create({
      userId: 'otra-persona',
      total: 999,
      shippingInfo: {},
      paymentInfo: {},
      items: [],
    });

    expect(await orders.listByUser(cliente.id)).toHaveLength(0);
    renderWithProviders(<UserProfile />, { route: '/profile' });
    expect(await screen.findByText(/aún no has guardado pedidos/i)).toBeInTheDocument();
  });

  it('guarda una foto de perfil subida desde el disco', async () => {
    const user = userEvent.setup();
    const cliente = await crearCliente();
    renderWithProviders(<UserProfile />, { route: '/profile' });

    await user.click(await screen.findByRole('button', { name: /detalles de cuenta/i }));
    await user.upload(await screen.findByLabelText(/^foto de perfil$/i), makeImageFile('avatar.jpg'));

    await waitFor(() =>
      expect(screen.getByAltText(/vista previa/i)).toHaveAttribute('src', expect.stringContaining('data:image/'))
    );

    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText(/perfil actualizado con éxito/i)).toBeInTheDocument();
    await waitFor(async () => {
      const sesion = await auth.getSession();
      expect(sesion.id).toBe(cliente.id);
      expect(sesion.avatar_url).toMatch(/^data:image\//);
    });
  });

  it('permite cambiar el nombre público', async () => {
    const user = userEvent.setup();
    await crearCliente();
    renderWithProviders(<UserProfile />, { route: '/profile' });

    await user.click(await screen.findByRole('button', { name: /detalles de cuenta/i }));

    const nombre = screen.getByPlaceholderText(/tu nombre completo o apodo/i);
    await user.clear(nombre);
    await user.type(nombre, 'Nombre Nuevo');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(async () => expect((await auth.getSession()).name).toBe('Nombre Nuevo'));
    // El encabezado del perfil refleja el cambio de inmediato.
    expect(await screen.findByRole('heading', { name: /nombre nuevo/i })).toBeInTheDocument();
  });

  it('muestra los favoritos guardados', async () => {
    const user = userEvent.setup();
    await crearCliente();
    window.localStorage.setItem(
      'thaiger_wishlist',
      JSON.stringify([{ id: 3, name: 'Creatina Monohidratada', brand: 'BIO-SPORT', category: 'Creatina', price1: 638 }])
    );

    renderWithProviders(<UserProfile />, { route: '/profile' });
    await user.click(await screen.findByRole('button', { name: /mis favoritos/i }));

    expect(await screen.findByText('Creatina Monohidratada')).toBeInTheDocument();
    expect(screen.getByText('$638.00')).toBeInTheDocument();
  });
});
