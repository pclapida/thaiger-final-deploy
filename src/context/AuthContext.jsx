/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { auth } from '../services/api';

const AuthContext = createContext(null);

/** Pantalla mientras se recupera la sesión: la marca, no un texto pelado. */
function PantallaInicial() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black">
      <img src="/logo.png" alt="" aria-hidden="true" className="h-16 w-auto object-contain latido-marca" />
      <p role="status" className="text-xs font-bold uppercase tracking-[0.4em] text-brand-500">
        Cargando Thaiger
      </p>
    </div>
  );
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    auth
      .getSession()
      .then((session) => {
        if (active) setUser(session);
      })
      .catch((error) => {
        console.error('No se pudo recuperar la sesión:', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = auth.onAuthStateChange((nextUser) => {
      if (active) setUser(nextUser);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const nextUser = await auth.signIn(email, password);
    setUser(nextUser);
    return nextUser;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const nextUser = await auth.signUp(email, password, name);
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await auth.signOut();
    setUser(null);
  }, []);

  /** Vuelve a leer la sesión: útil tras un cambio de contraseña o de rol. */
  const refresh = useCallback(async () => {
    const session = await auth.getSession();
    setUser(session);
    return session;
  }, []);

  const updateProfile = useCallback(
    async (updates) => {
      if (!user) return { success: false, error: new Error('No hay sesión activa.') };

      try {
        await auth.updateProfile(user.id, {
          name: updates.name ?? user.name,
          avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : user.avatar_url,
        });

        // Reflejamos el cambio de inmediato (la foto del Navbar se actualiza al instante).
        setUser((prev) => ({
          ...prev,
          name: updates.name ?? prev.name,
          avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : prev.avatar_url,
        }));

        return { success: true };
      } catch (error) {
        console.error('Error al actualizar el perfil:', error);
        return { success: false, error };
      }
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      login,
      register,
      logout,
      refresh,
      updateProfile,
    }),
    [user, loading, login, register, logout, refresh, updateProfile]
  );

  if (loading) return <PantallaInicial />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return context;
};
