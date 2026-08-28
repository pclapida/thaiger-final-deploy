// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Shop from './Shop';
import Cart from './Cart';
import { SEED_PRODUCTS } from '../data/seed';
import { getUnitPrice, formatPrice, SHIPPING_COST } from '../lib/pricing';
import { renderWithProviders, resetApp } from '../test/utils';

// El total del catálogo sale de la siembra: escribirlo a mano obliga a tocar la
// prueba cada vez que cambia un producto.
const TOTAL = SEED_PRODUCTS.length;

// CELSIUS ya no existe; en el catálogo de demostración usamos una marca con
// pocos productos para que la prueba sea rápida y legible.
const MARCA = 'ATLAS FOODS';
const DE_LA_MARCA = SEED_PRODUCTS.filter((p) => p.brand === MARCA);

const rutaMarca = (brand) => ({ pathname: '/shop', state: { brand } });

/** Un producto con stock de esa marca, para poder añadirlo al carrito. */
const CON_STOCK = DE_LA_MARCA.find((p) => p.stock > 0);

beforeEach(async () => {
  await resetApp();
});

describe('tienda', () => {
  it('aplica la marca con la que se navegó desde Marcas o el carrusel', async () => {
    renderWithProviders(<Shop />, { route: rutaMarca(MARCA) });

    await waitFor(() =>
      expect(screen.getByText(new RegExp(`mostrando ${DE_LA_MARCA.length} de ${TOTAL} productos`, 'i'))).toBeInTheDocument()
    );
    expect(screen.getByText(CON_STOCK.name)).toBeInTheDocument();
  });

  it('la marca funciona aunque cambie la capitalización', async () => {
    renderWithProviders(<Shop />, { route: rutaMarca(MARCA.toLowerCase()) });
    await waitFor(() =>
      expect(screen.getByText(new RegExp(`mostrando ${DE_LA_MARCA.length} de ${TOTAL}`, 'i'))).toBeInTheDocument()
    );
  });

  it('acepta también una categoría (así navega la portada)', async () => {
    const categoria = 'Creatina';
    const esperados = SEED_PRODUCTS.filter((p) => p.category === categoria).length;

    renderWithProviders(<Shop />, { route: { pathname: '/shop', state: { category: [categoria] } } });
    await waitFor(() =>
      expect(screen.getByText(new RegExp(`mostrando ${esperados} de ${TOTAL}`, 'i'))).toBeInTheDocument()
    );
  });

  it('muestra el término buscado y permite limpiar los filtros', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Shop />, { route: { pathname: '/shop', state: { search: 'creatina micronizada' } } });

    await waitFor(() => expect(screen.getByText(new RegExp(`de ${TOTAL} productos`, 'i'))).toBeInTheDocument());
    expect(screen.getByText(/creatina micronizada/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /limpiar todos los filtros/i }));
    await waitFor(() =>
      expect(screen.getByText(new RegExp(`mostrando ${TOTAL} de ${TOTAL} productos`, 'i'))).toBeInTheDocument()
    );
  });

  it('avisa cuando ninguna búsqueda coincide', async () => {
    renderWithProviders(<Shop />, { route: { pathname: '/shop', state: { search: 'no existe este producto' } } });
    expect(await screen.findByText(/no se encontraron productos/i)).toBeInTheDocument();
  });

  it('marca como agotados los productos sin stock', async () => {
    const agotado = SEED_PRODUCTS.find((p) => p.stock === 0);
    renderWithProviders(<Shop />, { route: { pathname: '/shop', state: { search: agotado.name } } });

    expect(await screen.findByText(agotado.name)).toBeInTheDocument();
    // El botón de agregar de un producto agotado no se puede pulsar.
    expect(screen.getByRole('button', { name: /sin stock|agotado/i })).toBeDisabled();
  });
});

describe('de la tienda al carrito', () => {
  /** Añade el primer producto con stock de la marca y abre el carrito. */
  async function comprarUno(user) {
    const { unmount } = renderWithProviders(<Shop />, {
      route: { pathname: '/shop', state: { search: CON_STOCK.name } },
    });

    await screen.findByText(CON_STOCK.name);
    await user.click(screen.getByRole('button', { name: /^agregar$/i }));

    unmount();
    renderWithProviders(<Cart />, { route: '/cart' });
  }

  it('agrega desde la tarjeta y calcula el total con envío', async () => {
    const user = userEvent.setup();
    await comprarUno(user);

    expect(await screen.findByText(CON_STOCK.name)).toBeInTheDocument();

    const resumen = screen.getByRole('heading', { name: /resumen del pedido/i }).closest('div');
    const unitario = getUnitPrice(CON_STOCK, 1);

    // El precio del carrito respeta la oferta: antes cobraba el de lista.
    expect(within(resumen).getByText(formatPrice(unitario))).toBeInTheDocument();
    expect(within(resumen).getByText(formatPrice(unitario + SHIPPING_COST))).toBeInTheDocument();
    expect(within(resumen).getByText(/nivel de precios actual/i)).toBeInTheDocument();
  });

  it('el carrito vacío invita a volver a la tienda', async () => {
    renderWithProviders(<Cart />, { route: '/cart' });
    expect(await screen.findByText(/tu carrito está vacío/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir a la tienda/i })).toBeInTheDocument();
  });

  it('respeta el stock al subir la cantidad', async () => {
    const user = userEvent.setup();
    await comprarUno(user);

    const cantidad = await screen.findByRole('spinbutton');
    const disponibles = Number(screen.getByText(/disponibles:/i).textContent.match(/\d+/)[0]);

    await user.clear(cantidad);
    await user.type(cantidad, String(disponibles + 50));

    // Nunca se puede pedir más de lo que hay en inventario.
    await waitFor(() => expect(Number(cantidad.value)).toBeLessThanOrEqual(disponibles));
  });

  it('vacía el carrito tras confirmarlo', async () => {
    const user = userEvent.setup();
    await comprarUno(user);

    await user.click(await screen.findByRole('button', { name: /vaciar carrito/i }));

    // Ya no usa window.confirm: hay un diálogo propio que hay que confirmar.
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: /sí, vaciarlo/i }));

    expect(await screen.findByText(/tu carrito está vacío/i)).toBeInTheDocument();
  });
});
