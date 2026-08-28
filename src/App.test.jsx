// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { auth } from './services/localBackend';
import { entrarComoAdmin, resetApp } from './test/utils';

/**
 * Humo: monta la aplicación completa en cada ruta para detectar errores de
 * importación o de render que las pruebas por página no verían.
 *
 * Las páginas se cargan con React.lazy, así que todas las esperas usan
 * `findBy*`: el primer render sólo trae el fallback de <Suspense>.
 */
function renderApp(route) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );
}

const ESPERA = { timeout: 15000 };

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
    const encontrados = await screen.findAllByText(textoEsperado, {}, ESPERA);
    expect(encontrados.length).toBeGreaterThan(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('una ruta inexistente muestra el 404', async () => {
    renderApp('/ruta-que-no-existe');
    expect(await screen.findByText(/404 \| página no encontrada/i, {}, ESPERA)).toBeInTheDocument();
  });

  it('el pie de página y la barra de navegación salen en todas las rutas', async () => {
    renderApp('/shop');
    await screen.findAllByText(/catálogo completo/i, {}, ESPERA);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    // El enlace de salto es lo primero para quien navega con teclado.
    expect(screen.getByRole('link', { name: /saltar al contenido/i })).toBeInTheDocument();
  });
});

describe('rutas protegidas', () => {
  it('el checkout manda al login si no hay sesión', async () => {
    renderApp('/checkout');
    expect(await screen.findByText(/iniciar sesion/i, {}, ESPERA)).toBeInTheDocument();
  });

  it('el perfil manda al login si no hay sesión', async () => {
    renderApp('/profile');
    expect(await screen.findByText(/iniciar sesion/i, {}, ESPERA)).toBeInTheDocument();
  });

  it('un cliente normal no entra al panel de administración', async () => {
    await auth.signUp('cliente.nuevo@thaiger.mx', 'secreto123', 'Cliente');
    renderApp('/dashboard');

    // AdminRoute lo redirige a la tienda.
    expect(await screen.findByText(/catálogo completo/i, {}, ESPERA)).toBeInTheDocument();
    expect(screen.queryByText(/dashboard general/i)).toBeNull();
  });

  it('el administrador sí entra al panel', async () => {
    await entrarComoAdmin();
    renderApp('/dashboard');

    expect(await screen.findByText(/dashboard general/i, {}, ESPERA)).toBeInTheDocument();
  });
});
