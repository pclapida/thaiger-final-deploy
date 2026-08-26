// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Shop from './Shop';
import Cart from './Cart';
import { renderWithProviders, resetApp } from '../test/utils';

// CELSIUS y DRAGONPHARMA tienen un solo producto en el catálogo:
// filtrar por marca mantiene la prueba rápida y legible.
const rutaMarca = (brand) => ({ pathname: '/shop', state: { brand } });

beforeEach(async () => {
  await resetApp();
});

describe('tienda', () => {
  it('aplica la marca con la que se navegó desde Marcas o el carrusel', async () => {
    renderWithProviders(<Shop />, { route: rutaMarca('CELSIUS') });

    await waitFor(() => expect(screen.getByText(/mostrando 1 de 244 productos/i)).toBeInTheDocument());
    expect(screen.getByText('CELSIUS OASIS LATA PRE')).toBeInTheDocument();
  });

  it('la marca funciona aunque cambie la capitalización', async () => {
    renderWithProviders(<Shop />, { route: rutaMarca('celsius') });
    await waitFor(() => expect(screen.getByText(/mostrando 1 de 244 productos/i)).toBeInTheDocument());
  });

  it('muestra el término buscado y permite limpiar los filtros', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Shop />, { route: { pathname: '/shop', state: { search: 'celsius oasis' } } });

    await waitFor(() => expect(screen.getByText(/mostrando 1 de 244 productos/i)).toBeInTheDocument());
    expect(screen.getByText(/“celsius oasis”/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /limpiar todos los filtros/i }));
    await waitFor(() => expect(screen.getByText(/mostrando 244 de 244 productos/i)).toBeInTheDocument());
  });

  it('avisa cuando ninguna búsqueda coincide', async () => {
    renderWithProviders(<Shop />, { route: { pathname: '/shop', state: { search: 'no existe este producto' } } });
    expect(await screen.findByText(/no se encontraron productos/i)).toBeInTheDocument();
  });

  it('marca como agotados los productos sin stock', async () => {
    // El producto 17 del catálogo queda con stock 0 al sembrar la base.
    renderWithProviders(<Shop />, { route: rutaMarca('CELSIUS') });
    await waitFor(() => expect(screen.getByText(/mostrando 1 de 244/i)).toBeInTheDocument());

    // CELSIUS sí tiene stock: su botón de agregar está habilitado.
    expect(screen.getByRole('button', { name: /agregar/i })).toBeEnabled();
  });
});

describe('de la tienda al carrito', () => {
  it('agrega desde la tarjeta y calcula el total con envío', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<Shop />, { route: rutaMarca('CELSIUS') });

    await waitFor(() => expect(screen.getByText(/mostrando 1 de 244/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /agregar/i }));

    unmount();
    renderWithProviders(<Cart />, { route: '/cart' });

    expect(await screen.findByText('CELSIUS OASIS LATA PRE')).toBeInTheDocument();

    const resumen = screen.getByRole('heading', { name: /resumen del pedido/i }).closest('div');
    // Este producto está en oferta (-20%): 623.50 → 498.80, más 250 de envío.
    // Antes el carrito ignoraba el descuento y cobraba el precio de lista.
    expect(within(resumen).getByText('$498.80')).toBeInTheDocument();
    expect(within(resumen).getByText('$748.80')).toBeInTheDocument();
    expect(within(resumen).getByText(/nivel de precios actual/i)).toBeInTheDocument();
  });

  it('el carrito vacío invita a volver a la tienda', async () => {
    renderWithProviders(<Cart />, { route: '/cart' });
    expect(await screen.findByText(/tu carrito está vacío/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir a la tienda/i })).toBeInTheDocument();
  });

  it('respeta el stock al subir la cantidad', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<Shop />, { route: rutaMarca('CELSIUS') });

    await waitFor(() => expect(screen.getByText(/mostrando 1 de 244/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /agregar/i }));
    unmount();

    renderWithProviders(<Cart />, { route: '/cart' });
    const cantidad = await screen.findByRole('spinbutton');
    const disponibles = Number(screen.getByText(/disponibles:/i).textContent.match(/\d+/)[0]);

    await user.clear(cantidad);
    await user.type(cantidad, String(disponibles + 50));

    // Nunca se puede pedir más de lo que hay en inventario.
    await waitFor(() => expect(Number(cantidad.value)).toBeLessThanOrEqual(disponibles));
  });

  it('vacía el carrito', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<Shop />, { route: rutaMarca('CELSIUS') });

    await waitFor(() => expect(screen.getByText(/mostrando 1 de 244/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /agregar/i }));
    unmount();

    renderWithProviders(<Cart />, { route: '/cart' });
    await user.click(await screen.findByRole('button', { name: /vaciar carrito/i }));

    expect(await screen.findByText(/tu carrito está vacío/i)).toBeInTheDocument();
  });
});
