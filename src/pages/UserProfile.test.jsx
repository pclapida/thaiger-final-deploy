// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserProfile from './UserProfile';
import { auth, orders } from '../services/localBackend';
import { makeImageFile, renderWithProviders, resetApp } from '../test/utils';

// Correo propio de las pruebas: `cliente@thaiger.mx` es una cuenta sembrada.
const CORREO = 'perfil.prueba@thaiger.mx';

async function crearCliente() {
  return auth.signUp(CORREO, 'secreto123', 'Cliente Thaiger');
}

beforeEach(async () => {
  await resetApp();
});

describe('perfil del usuario', () => {
  it('muestra el aviso cuando todavía no hay pedidos', async () => {
    await crearCliente();
    renderWithProviders(<UserProfile />, { route: '/profile' });

    expect(await screen.findByText(/aún no has guardado pedidos/i)).toBeInTheDocument();
    expect(screen.getByText(CORREO)).toBeInTheDocument();
  });

  it('lista los pedidos del usuario con su total y concepto SPEI', async () => {
    const cliente = await crearCliente();
    await orders.create({
      userId: cliente.id,
      shippingInfo: {
        fullName: 'Cliente Thaiger',
        phone: '5512345678',
        address: 'Calle Demo 1',
        city: 'CDMX',
        zip: '01000',
      },
      paymentInfo: { concepto: 'TH-4321', banco: 'BANCO DEMO' },
      items: [{ product_id: 3, quantity: 2 }],
    });

    renderWithProviders(<UserProfile />, { route: '/profile' });

    expect(await screen.findByText(/TH-4321/)).toBeInTheDocument();
    expect(screen.getByText(/1 artículo/i)).toBeInTheDocument();
  });

  it('no muestra los pedidos de otras personas', async () => {
    const cliente = await crearCliente();

    // El pedido de la cuenta sembrada no debe aparecer en este perfil.
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
      JSON.stringify([
        {
          id: 3,
          name: 'Creatina Monohidratada Micronizada 300 g',
          brand: 'THAIGER LABS',
          category: 'Creatina',
          price1: 599,
        },
      ])
    );

    renderWithProviders(<UserProfile />, { route: '/profile' });
    await user.click(await screen.findByRole('button', { name: /mis favoritos/i }));

    expect(await screen.findByText('Creatina Monohidratada Micronizada 300 g')).toBeInTheDocument();
  });

  it('guarda una dirección en la libreta (ya no dice «Próximamente»)', async () => {
    const user = userEvent.setup();
    await crearCliente();
    renderWithProviders(<UserProfile />, { route: '/profile' });

    await user.click(await screen.findByRole('button', { name: /^direcciones$/i }));
    expect(screen.queryByText(/próximamente/i)).toBeNull();

    // Abre el formulario de alta (la libreta vacía ofrece "Añadir la primera").
    await user.click(await screen.findByRole('button', { name: /añadir la primera/i }));

    const dialogo = await screen.findByRole('dialog');
    await user.type(within(dialogo).getByLabelText(/^alias/i), 'Casa');
    await user.type(within(dialogo).getByLabelText(/quién recibe/i), 'Cliente Thaiger');
    await user.type(within(dialogo).getByLabelText(/teléfono/i), '5512345678');
    await user.type(within(dialogo).getByLabelText(/calle y número/i), 'Av. Demo 123');
    await user.type(within(dialogo).getByLabelText(/^ciudad/i), 'CDMX');
    await user.type(within(dialogo).getByLabelText(/código postal/i), '01000');

    await user.click(within(dialogo).getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('Casa')).toBeInTheDocument();
  });

  it('el cambio de contraseña exige la actual', async () => {
    const user = userEvent.setup();
    await crearCliente();
    renderWithProviders(<UserProfile />, { route: '/profile' });

    await user.click(await screen.findByRole('button', { name: /detalles de cuenta/i }));

    const actual = await screen.findByLabelText(/^contraseña actual/i);
    await user.type(actual, 'equivocada1');
    await user.type(screen.getByLabelText(/^contraseña nueva/i), 'flamante123');
    await user.type(screen.getByLabelText(/^repite la contraseña nueva/i), 'flamante123');

    await user.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    expect(await screen.findByText(/no es correcta/i)).toBeInTheDocument();
  });
});
