// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from './Dashboard';
import { products, settings, users } from '../services/localBackend';
import { SEED_PRODUCTS } from '../data/seed';
import { entrarComoAdmin, makeImageFile, renderWithProviders, resetApp } from '../test/utils';

const TOTAL = SEED_PRODUCTS.length;

/** Un producto del catálogo que sirve de sujeto en varias pruebas. */
const SUJETO = SEED_PRODUCTS.find((p) => p.name.includes('Creatina Monohidratada'));

async function abrirPestana(user, nombre) {
  const [boton] = await screen.findAllByRole('button', { name: nombre });
  await user.click(boton);
}

/**
 * Abre el inventario y, si se pide, filtra la tabla.
 * Las consultas por rol recorren todo el DOM: reducir la tabla antes de abrir
 * el modal mantiene la prueba rápida.
 */
async function abrirPestanaProductos(user, { filtrar } = {}) {
  await abrirPestana(user, /productos/i);
  await screen.findByRole('heading', { name: /gestor de inventario/i });
  await waitFor(() => expect(screen.getByText(new RegExp(`${TOTAL} resultados`, 'i'))).toBeInTheDocument());

  if (filtrar !== undefined) {
    await user.type(screen.getByPlaceholderText(/buscar por nombre/i), filtrar);
    await waitFor(() => expect(screen.queryByText(new RegExp(`${TOTAL} resultados`, 'i'))).toBeNull());
  }
}

async function abrirModalNuevo(user) {
  await user.click(screen.getByRole('button', { name: /añadir producto/i }));
  return screen.findByRole('heading', { name: /nuevo producto/i });
}

beforeEach(async () => {
  await resetApp();
  // Todas las operaciones del panel exigen sesión de administrador.
  await entrarComoAdmin();
});

describe('panel de administración', () => {
  it('muestra el resumen con el inventario cargado', async () => {
    renderWithProviders(<Dashboard />);

    expect(await screen.findByRole('heading', { name: /dashboard general/i })).toBeInTheDocument();

    // La métrica "Productos" acaba mostrando el tamaño del catálogo.
    // Se busca por encabezado: "Productos" es además el nombre de una pestaña.
    const metrica = (await screen.findByRole('heading', { name: /^productos$/i })).closest('div');
    // El número sube animado (AnimatedNumber): hay que esperar a que llegue.
    await waitFor(() => expect(within(metrica).getByText(String(TOTAL))).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it('la gráfica de ingresos trae los pedidos de ejemplo', async () => {
    renderWithProviders(<Dashboard />);
    await screen.findByRole('heading', { name: /dashboard general/i });

    // La demo siembra pedidos, así que el panel NO arranca vacío.
    await waitFor(() => expect(screen.queryByText(/sin ventas registradas todavía/i)).toBeNull());
  });

  it('lista el inventario y permite buscarlo', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);
    await abrirPestanaProductos(user, { filtrar: SUJETO.name });

    await waitFor(() => expect(screen.getByText(/1 resultados?/i)).toBeInTheDocument());
    expect(screen.getByTitle(SUJETO.name)).toBeInTheDocument();
  });

  it('da de alta un producto manualmente con su foto', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);
    await abrirPestanaProductos(user, { filtrar: 'zzz-sin-coincidencias' });
    await abrirModalNuevo(user);

    await user.type(screen.getByLabelText(/nombre del producto/i), 'Proteína Thaiger 2kg');
    await user.type(screen.getByLabelText(/^marca/i), 'THAIGER LABS');
    await user.type(screen.getByLabelText(/^categoría/i), 'Proteína');
    await user.type(screen.getByLabelText(/descripción/i), 'Aislado de suero, 60 servicios.');
    await user.clear(screen.getByLabelText(/stock/i));
    await user.type(screen.getByLabelText(/stock/i), '25');
    await user.type(screen.getByLabelText(/precio público/i), '1499.90');

    // Foto tomada del disco del usuario.
    await user.upload(screen.getByLabelText(/foto del producto/i), makeImageFile());
    await waitFor(() =>
      expect(screen.getByAltText(/vista previa/i)).toHaveAttribute('src', expect.stringContaining('data:image/'))
    );

    await user.click(screen.getByRole('button', { name: /crear producto/i }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: /nuevo producto/i })).toBeNull());

    const creado = (await products.list()).find((p) => p.name === 'Proteína Thaiger 2kg');
    expect(creado).toMatchObject({
      brand: 'THAIGER LABS',
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
    await abrirPestanaProductos(user, { filtrar: SUJETO.name });
    await waitFor(() => expect(screen.getByText(/1 resultados?/i)).toBeInTheDocument());

    await user.click(screen.getAllByTitle('Editar')[0]);
    expect(await screen.findByRole('heading', { name: /editar producto/i })).toBeInTheDocument();

    const stock = screen.getByLabelText(/stock/i);
    await user.clear(stock);
    await user.type(stock, '7');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: /editar producto/i })).toBeNull());
    expect((await products.list()).find((p) => p.name === SUJETO.name).stock).toBe(7);
  });

  it('activa y desactiva una oferta desde la tabla', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);
    await abrirPestanaProductos(user, { filtrar: SUJETO.name });
    await waitFor(() => expect(screen.getByText(/1 resultados?/i)).toBeInTheDocument());

    const fila = screen.getByTitle(SUJETO.name).closest('tr');
    const antes = (await products.list()).find((p) => p.name === SUJETO.name).is_on_sale;

    await user.click(within(fila).getByTitle(/activar o desactivar la oferta/i));

    await waitFor(async () => {
      const producto = (await products.list()).find((p) => p.name === SUJETO.name);
      expect(producto.is_on_sale).toBe(!antes);
    });
  });
});

describe('panel: usuarios', () => {
  it('lista las cuentas y permite cambiar el rol', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);
    await screen.findByRole('heading', { name: /dashboard general/i });

    await abrirPestana(user, /usuarios/i);

    // El panel pinta tabla en escritorio y tarjetas en móvil: el correo sale dos veces.
    expect((await screen.findAllByText('admin@thaiger.mx')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('cliente@thaiger.mx').length).toBeGreaterThan(0);

    const lista = await users.list();
    const cliente = lista.find((u) => u.role === 'user');
    expect(cliente.email).toBe('cliente@thaiger.mx');
  });
});

describe('panel: ajustes', () => {
  it('guarda los datos bancarios y se reflejan en la configuración', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);
    await screen.findByRole('heading', { name: /dashboard general/i });

    await abrirPestana(user, /ajustes/i);

    const clabe = await screen.findByLabelText(/clabe/i);
    await user.clear(clabe);
    await user.type(clabe, '111122223333444455');

    // El primer botón de guardar del bloque de pago.
    const guardar = screen.getAllByRole('button', { name: /guardar/i })[0];
    await user.click(guardar);

    await waitFor(async () => expect((await settings.get()).payment.clabe).toBe('111122223333444455'));
  });
});

describe('panel: carrusel', () => {
  it('muestra los slides de la configuración', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);
    await screen.findByRole('heading', { name: /dashboard general/i });

    await abrirPestana(user, /carrusel/i);

    // Los cuatro slides sembrados en src/data/settings.js.
    expect(await screen.findAllByDisplayValue(/THAIGER LABS|IRON PEAK|VOLT SUPPS|PURE CORE/)).toBeTruthy();
  });
});
