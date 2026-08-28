import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Rutas que exigen sesión iniciada (carrito pagado, perfil...).
 *
 * Guarda en el estado de navegación la ruta a la que se quería entrar para que
 * el login devuelva a la persona ahí y no la deje tirada en la portada.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
