/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        handleSession(session);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSession = async (session) => {
    if (session && session.user) {
      const sbUser = session.user;
      try {
        const { data: userDoc, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', sbUser.id)
          .single();
          
        let role = 'user';
        let name = sbUser.user_metadata?.name || 'Usuario Thaiger';
        let avatar_url = sbUser.user_metadata?.avatar_url || null;

        if (userDoc) {
          role = userDoc.role || 'user';
          if (userDoc.name) name = userDoc.name;
          if (userDoc.avatar_url) avatar_url = userDoc.avatar_url;
        }

        setIsAuthenticated(true);
        setCurrentUser(sbUser);
        setUser({
          uid: sbUser.id,
          email: sbUser.email,
          name: name,
          role: role,
          avatar_url: avatar_url
        });
      } catch (err) {
        console.error("Error al obtener perfil desde public.users", err);
        setIsAuthenticated(true);
        setCurrentUser(sbUser);
        setUser({
          uid: sbUser.id,
          email: sbUser.email,
          name: sbUser.user_metadata?.name || 'Usuario Thaiger',
          role: 'user',
          avatar_url: sbUser.user_metadata?.avatar_url || null
        });
      }
    } else {
      setIsAuthenticated(false);
      setUser(null);
      setCurrentUser(null);
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const register = async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || 'Usuario Thaiger'
        }
      }
    });

    if (error) throw error;
    
    // Insert into public.users if the registration provides a user ID
    if (data.user) {
      const { error: dbError } = await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email,
        name: name || 'Usuario Thaiger',
        role: 'user'
      });
      if (dbError) console.error("Error guardando en public.users:", dbError);
    }

    return data;
  };

  const updateProfile = async (updates) => {
    try {
      // 1. Update Supabase Auth metadata
      const { data: authData, error: authError } = await supabase.auth.updateUser({
        data: {
          name: updates.name || user.name,
          avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : user.avatar_url
        }
      });
      if (authError) throw authError;

      // 2. Update public.users table
      const { error: dbError } = await supabase.from('users').update({
        name: updates.name || user.name,
        avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : user.avatar_url
      }).eq('id', user.uid);
      if (dbError) throw dbError;

      // 3. Update local state immediately
      setCurrentUser(authData.user);
      setUser(prev => ({
        ...prev,
        name: updates.name || prev.name,
        avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : prev.avatar_url
      }));

      return { success: true };
    } catch (error) {
      console.error("Error updating profile:", error);
      return { success: false, error };
    }
  };

  const logout = async () => {
    return supabase.auth.signOut();
  };

  if (loading) {
      return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500">Cargando Thaiger...</div>;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, currentUser, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);