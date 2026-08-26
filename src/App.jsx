import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

// Páginas
import ThaigerLogin from './components/ThaigerLogin';
import Register from './pages/Register';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Cart from './pages/Cart'; 
import ProductDetails from './pages/ProductDetails';
import UserProfile from './pages/UserProfile'; 
import Dashboard from './pages/Dashboard'; 
import Checkout from './pages/Checkout';
import Terms from './pages/Terms';
import Brands from './pages/Brands';
import Offers from './pages/Offers';
import AboutUs from './pages/AboutUs';
import Wholesale from './pages/Wholesale';
import Refunds from './pages/Refunds';

// IMPORTAMOS EL FOOTER NUEVO
import Footer from './components/Footer';

// Componente para proteger rutas (asumiendo que ProtectedRoute ahora es un componente externo)
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

import { Toaster } from 'react-hot-toast';


import ScrollToTop from './components/ScrollToTop';

export default function App() {
  return (
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
          <ScrollToTop />
          <div className="flex flex-col min-h-screen relative">
            <main className="flex-grow pt-20"> {/* El Navbar es fixed (h-20), añadimos pt-20 para evitar solapamiento */}
              <Routes>
                {/* RUTAS PÚBLICAS */}
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

                {/* RUTAS PROTEGIDAS */}
                <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />

                <Route path="*" element={<h1 className="text-white text-center mt-20">404 | Página no encontrada</h1>} />
              </Routes>
            </main>

            {/* EL FOOTER GLOBAL (Aparece en todas partes) */}
            <Footer />
            <Toaster position="top-right" />
          </div>
        </CartProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}