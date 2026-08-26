// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { auth } from './services/localBackend';
import { resetApp } from './test/utils';

/**
 * Humo: monta la aplicación completa en cada ruta para detectar errores de
 * importación o de render que las pruebas por página no verían.
 */
function renderApp(route) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );
}

let errorSpy;

beforeEach(async () => {
  await resetApp();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

const RUTAS_PUBLICAS = [
  ['/', /distribuidores oficiales thaiger/i],
  ['/shop', /catálogo completo/i],
  ['/brands', /nuestras marcas/i],
  ['/offers', /ofertas y combos/i],
  ['/product/3', /añadir al carrito|producto no encontrado/i],
  ['/cart', /tu carrito de compras/i],
  ['/login', /iniciar sesion/i],
  ['/register', /únete a/i],
  ['/terms', /^términos y condiciones$/i],
  ['/about', /^quiénes somos$/i],
  ['/wholesale', /^programa de mayoreo$/i],
  ['/refunds', /^políticas de devolución$/i],
];

describe('rutas de la aplicación', () => {
  it.each(RUTAS_PUBLICAS)('la ruta %s carga sin errores', async (ruta, textoEsperado) => {
    renderApp(ruta);
    // findAllBy: varios textos (Términos, Mayoreo...) también viven en el Footer.
    const encontrados = await screen.findAllByText(textoEsperado, {}, { timeout: 10000 });
    expect(encontrados.length).toBeGreaterThan(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('una ruta inexistente muestra el 404', async () => {
    renderApp('/ruta-que-no-existe');
    expect(await screen.findByText(/404 \| página no encontrada/i)).toBeInTheDocument();
  });
});

describe('rutas protegidas', () => {
  it('el checkout manda al login si no hay sesión', async () => {
    renderApp('/checkout');
    expect(await screen.findByText(/iniciar sesion/i)).toBeInTheDocument();
  });

  it('el perfil manda al login si no hay sesión', async () => {
    renderApp('/profile');
    expect(await screen.findByText(/iniciar sesion/i)).toBeInTheDocument();
  });

  it('un cliente normal no entra al panel de administración', async () => {
    await auth.signUp('cliente@thaiger.mx', 'secreto123', 'Cliente');
    renderApp('/dashboard');

    // AdminRoute lo redirige a la tienda.
    expect(await screen.findByText(/catálogo completo/i, {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.queryByText(/dashboard general/i)).toBeNull();
  });

  it('el administrador sí entra al panel', async () => {
    await auth.signIn('admin@thaiger.mx', 'admin123');
    renderApp('/dashboard');

    expect(await screen.findByText(/dashboard general/i, {}, { timeout: 10000 })).toBeInTheDocument();
  });
});
