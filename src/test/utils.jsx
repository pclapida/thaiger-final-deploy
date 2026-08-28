import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { WishlistProvider } from '../context/WishlistContext';
import { SettingsProvider } from '../context/SettingsContext';
import { idb, STORES } from '../lib/idb';
import { resetPricingConfig } from '../lib/pricing';
import { _resetLoginThrottle } from '../lib/security';
import { _resetSeedState, auth, DEMO_ADMIN, DEMO_CUSTOMER } from '../services/localBackend';

/** Deja el navegador simulado y la base local como recién instalados. */
export async function resetApp() {
  for (const store of STORES) await idb.clear(store);
  _resetSeedState();
  _resetLoginThrottle();
  resetPricingConfig();
  await auth.signOut();
  window.localStorage.clear();
  window.sessionStorage?.clear?.();
}

/** Abre sesión con la cuenta de administrador de la demo. */
export function entrarComoAdmin() {
  return auth.signIn(DEMO_ADMIN.email, DEMO_ADMIN.password);
}

/** Abre sesión con la cuenta de cliente de la demo. */
export function entrarComoCliente() {
  return auth.signIn(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
}

/** Monta un componente con todos los contextos y el router de la aplicación. */
export function renderWithProviders(ui, { route = '/' } = {}) {
  // `route` puede ser una cadena o una entrada de historial con `state`.
  const Wrapper = ({ children }) => (
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <SettingsProvider>
          <WishlistProvider>
            <CartProvider>
              {children}
              {/* Igual que en App.jsx: los avisos al usuario salen por aquí. */}
              <Toaster />
            </CartProvider>
          </WishlistProvider>
        </SettingsProvider>
      </AuthProvider>
    </MemoryRouter>
  );

  return render(ui, { wrapper: Wrapper });
}

/** Crea un File real a partir de bytes, para probar la subida de fotos. */
export function makeImageFile(name = 'foto.jpg', type = 'image/jpeg') {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  return new File([bytes], name, { type });
}

/** Deja un producto del catálogo en el carrito, como si se hubiera añadido. */
export function ponerEnCarrito(producto, cantidad = 1) {
  window.localStorage.setItem('thaiger_cart', JSON.stringify([{ ...producto, quantity: cantidad }]));
}
