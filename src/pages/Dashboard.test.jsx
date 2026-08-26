// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from './Dashboard';
import { products } from '../services/localBackend';
import { renderWithProviders, resetApp, makeImageFile } from '../test/utils';

async function abrirPestanaProductos(user, { filtrar } = {}) {
  const [botonProductos] = await screen.findAllByRole('button', { name: /productos/i });
  await user.click(botonProductos);
  await screen.findByRole('heading', { name: /gestor de inventario/i });
  await waitFor(() => expect(screen.getByText(/244 resultados/i)).toBeInTheDocument());

  // Las consultas por rol recorren todo el DOM: con 244 filas en la tabla se
  // vuelven lentísimas, así que reducimos la tabla antes de abrir el modal.
  if (filtrar !== undefined) {
    await user.type(screen.getByPlaceholderText(/buscar por nombre/i), filtrar);
    await waitFor(() => expect(screen.queryByText(/244 resultados/i)).toBeNull());
  }
}

async function abrirModalNuevo(user) {
  await user.click(screen.getByRole('button', { name: /añadir producto/i }));
  return screen.findByRole('heading', { name: /nuevo producto/i });
}

beforeEach(async () => {
  await resetApp();
});

describe('panel de administración', () => {
  it('muestra el resumen con el inventario cargado', async () => {
    renderWithProviders(<Dashboard />);

    expect(await screen.findByRole('heading', { name: /dashboard general/i })).toBeInTheDocument();
    // 244 productos del catálogo base.
    await waitFor(() => expect(screen.getByText('244')).toBeInTheDocument());
    expect(screen.getByText(/sin ventas registradas todavía/i)).toBeInTheDocument();
  });

  it('lista el inventario y permite buscarlo', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);
    await abrirPestanaProductos(user, { filtrar: 'creatina de gomitas' });

    await waitFor(() => expect(screen.getByText(/1 resultados/i)).toBeInTheDocument());
    expect(screen.getByTitle('CREATINA DE GOMITAS')).toBeInTheDocument();
  });

  it('da de alta un producto manualmente con su foto', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);
    await abrirPestanaProductos(user, { filtrar: 'zzz-sin-coincidencias' });
    await abrirModalNuevo(user);

    await user.type(screen.getByLabelText(/nombre del producto/i), 'Proteína Thaiger 2kg');
    await user.type(screen.getByLabelText(/^marca/i), 'THAIGER');
    await user.type(screen.getByLabelText(/^categoría/i), 'Proteína');
    await user.type(screen.getByLabelText(/descripción/i), 'Aislado de suero, 60 servicios.');
    await user.clear(screen.getByLabelText(/stock/i));
    await user.type(screen.getByLabelText(/stock/i), '25');
    await user.type(screen.getByLabelText(/precio público/i), '1499.90');

    // Foto tomada del disco del usuario.
    await user.upload(screen.getByLabelText(/foto del producto/i), makeImageFile());
    await waitFor(() =>
      expect(screen.getByAltText(/vista previa/i)).toHaveAttribute('src', expect.stringContaining('data:image/jpeg'))
    );

    await user.click(screen.getByRole('button', { name: /crear producto/i }));

    // El modal se cierra y el producto queda guardado en la base local, con foto.
    await waitFor(() => expect(screen.queryByRole('heading', { name: /nuevo producto/i })).toBeNull());

    const guardados = await products.list();
    const creado = guardados.find((p) => p.name === 'Proteína Thaiger 2kg');
    expect(creado).toMatchObject({
      brand: 'THAIGER',
      category: 'Proteína',
      price1: 1499.9,
      stock: 25,
      description: 'Aislado de suero, 60 servicios.',
    });
    expect(creado.image_url).toMatch(/^data:image\//);
    // Sin niveles 2 y 3 capturados, se usa el precio público.
    expect(creado.price2).toBe(1499.9);
    expect(creado.price3).toBe(1499.9);
  });

  it('no guarda si faltan los campos obligatorios', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);
    await abrirPestanaProductos(user, { filtrar: 'zzz-sin-coincidencias' });
    await abrirModalNuevo(user);
    await user.type(screen.getByLabelText(/nombre del producto/i), 'Incompleto');
    await user.click(screen.getByRole('button', { name: /crear producto/i }));

    // El modal sigue abierto y no se creó nada.
    expect(screen.getByRole('heading', { name: /nuevo producto/i })).toBeInTheDocument();
    expect((await products.list()).some((p) => p.name === 'Incompleto')).toBe(false);
  });

  it('calcula los precios de mayoreo y distribuidor', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);
    await abrirPestanaProductos(user, { filtrar: 'zzz-sin-coincidencias' });
    await abrirModalNuevo(user);
    await user.type(screen.getByLabelText(/precio público/i), '1000');
    await user.click(screen.getByRole('button', { name: /calcular niveles/i }));

    expect(screen.getByLabelText(/precio mayoreo/i)).toHaveValue(900);
    expect(screen.getByLabelText(/precio distribuidor/i)).toHaveValue(800);
  });

  it('edita un producto existente', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);
    await abrirPestanaProductos(user, { filtrar: 'creatina de gomitas' });
    await waitFor(() => expect(screen.getByText(/1 resultados/i)).toBeInTheDocument());

    await user.click(screen.getByTitle('Editar'));
    expect(await screen.findByRole('heading', { name: /editar producto/i })).toBeInTheDocument();

    const stock = screen.getByLabelText(/stock/i);
    await user.clear(stock);
    await user.type(stock, '7');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: /editar producto/i })).toBeNull());
    const actualizado = (await products.list()).find((p) => p.name === 'CREATINA DE GOMITAS');
    expect(actualizado.stock).toBe(7);
  });

  it('activa y desactiva una oferta desde la tabla', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);
    await abrirPestanaProductos(user, { filtrar: 'creatina de gomitas' });
    await waitFor(() => expect(screen.getByText(/1 resultados/i)).toBeInTheDocument());

    const fila = screen.getByTitle('CREATINA DE GOMITAS').closest('tr');
    await user.click(within(fila).getByTitle(/activar o desactivar la oferta/i));

    await waitFor(async () => {
      const producto = (await products.list()).find((p) => p.name === 'CREATINA DE GOMITAS');
      expect(producto.is_on_sale).toBe(true);
      expect(producto.discount_percent).toBe(15);
    });
  });
});
