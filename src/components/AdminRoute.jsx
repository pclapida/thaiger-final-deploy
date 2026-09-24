import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

/**
 * Rutas del panel de administración.
 *
 * Sin sesión manda al login recordando el destino; con una cuenta de cliente
 * avisa por qué no puede entrar antes de devolverla a la tienda —un salto mudo
 * se lee como un fallo de la página.
 *
 * Con `catalogo` también dejan pasar a las cuentas de catálogo (el panel les
 * muestra sólo la pestaña de productos).
 */
export default function AdminRoute({ children, catalogo = false }) {
  const { isAuthenticated, isAdmin, canManageCatalog } = useAuth();
  const location = useLocation();

  const sinPermiso = isAuthenticated && !(isAdmin || (catalogo && canManageCatalog));

  useEffect(() => {
    if (sinPermiso) {
      toast.error('No tienes permiso para entrar al panel de administración.', { id: 'admin-sin-permiso' });
    }
  }, [sinPermiso]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (sinPermiso) {
    return <Navigate to="/shop" replace />;
  }

  return children;
}
