import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import ScrollProgress from './components/ScrollProgress';
import PageTransition from './components/PageTransition';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

// Home y NotFound van en el paquete inicial: son la primera pantalla y la
// pantalla de rescate. El resto se carga cuando hace falta.
import Home from './pages/Home';
import NotFound from './pages/NotFound';

const Shop = lazy(() => import('./pages/Shop'));
const Brands = lazy(() => import('./pages/Brands'));
const Offers = lazy(() => import('./pages/Offers'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const ThaigerLogin = lazy(() => import('./components/ThaigerLogin'));
const Register = lazy(() => import('./pages/Register'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Terms = lazy(() => import('./pages/Terms'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const Wholesale = lazy(() => import('./pages/Wholesale'));
const Refunds = lazy(() => import('./pages/Refunds'));

/** Espera mientras llega el trozo de código de una página. */
function PantallaDeCarga() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4"
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-spin rounded-full border-2 border-carbon-600 border-t-brand-500"
        />
        <img src="/logo.png" alt="" aria-hidden="true" className="latido-marca h-9 w-9 object-contain" />
      </div>
      <span className="text-[11px] font-bold uppercase tracking-[0.35em] text-gray-600">Cargando</span>
    </div>
  );
}

/** Consulta de medios reactiva (los avisos se colocan distinto en móvil). */
function useCoincideMedia(consulta) {
  const [coincide, setCoincide] = useState(() => {
    try {
      return Boolean(window.matchMedia?.(consulta)?.matches);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const lista = window.matchMedia?.(consulta);
    if (!lista) return undefined;

    const alCambiar = (evento) => setCoincide(evento.matches);
    lista.addEventListener?.('change', alCambiar);
    return () => lista.removeEventListener?.('change', alCambiar);
  }, [consulta]);

  return coincide;
}

/** Estructura común: barra, contenido con transición y pie. */
function Estructura() {
  const esMovil = useCoincideMedia('(max-width: 639px)');

  return (
    <>
      <a href="#contenido" className="salto-contenido">
        Saltar al contenido
      </a>

      <ScrollToTop />
      <ScrollProgress />

      <div className="flex min-h-screen flex-col bg-carbon-950">
        <Navbar />

        <main id="contenido" tabIndex={-1} className="flex-grow pt-navbar focus:outline-none">
          <ErrorBoundary>
            <PageTransition>
              <Suspense fallback={<PantallaDeCarga />}>
                <Routes>
                  {/* Públicas */}
                  <Route path="/" element={<Home />} />
                  <Route path="/home" element={<Navigate to="/" replace />} />
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/brands" element={<Brands />} />
                  <Route path="/offers" element={<Offers />} />
                  <Route path="/product/:id" element={<ProductDetails />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/login" element={<ThaigerLogin />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/about" element={<AboutUs />} />
                  <Route path="/wholesale" element={<Wholesale />} />
                  <Route path="/refunds" element={<Refunds />} />

                  {/* Requieren sesión */}
                  <Route
                    path="/checkout"
                    element={
                      <ProtectedRoute>
                        <Checkout />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <UserProfile />
                      </ProtectedRoute>
                    }
                  />

                  {/* Sólo administración */}
                  <Route
                    path="/dashboard"
                    element={
                      <AdminRoute>
                        <Dashboard />
                      </AdminRoute>
                    }
                  />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </PageTransition>
          </ErrorBoundary>
        </main>

        <Footer />
      </div>

      <Toaster
        position={esMovil ? 'top-center' : 'top-right'}
        containerClassName="no-imprimir"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#111111',
            color: '#ffffff',
            border: '1px solid #262626',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            padding: '0.75rem 1rem',
            boxShadow: '0 18px 45px -18px rgba(0, 0, 0, 0.9)',
          },
          success: { iconTheme: { primary: '#ea580c', secondary: '#ffffff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <WishlistProvider>
          <CartProvider>
            <Estructura />
          </CartProvider>
        </WishlistProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
