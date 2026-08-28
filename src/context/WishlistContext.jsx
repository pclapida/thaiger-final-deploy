/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const WishlistContext = createContext(null);
const STORAGE_KEY = 'thaiger_wishlist';

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist debe usarse dentro de <WishlistProvider>.');
  return context;
};

/** Se guarda lo justo para pintar la tarjeta del favorito. */
function normalizeItem(raw) {
  const id = raw?.id;
  if (id === undefined || id === null) return null;

  const price1 = Number(raw.price1);

  return {
    id,
    name: String(raw.name ?? ''),
    brand: String(raw.brand ?? ''),
    category: String(raw.category ?? ''),
    image_url: raw.image_url ?? null,
    price1: Number.isFinite(price1) ? price1 : 0,
    price2: Number(raw.price2) || price1 || 0,
    price3: Number(raw.price3) || price1 || 0,
    is_on_sale: Boolean(raw.is_on_sale),
    discount_percent: Number(raw.discount_percent) || 0,
    stock: raw.stock === undefined || raw.stock === null ? undefined : Number(raw.stock),
  };
}

function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeItem).filter(Boolean);
  } catch (error) {
    console.warn('No se pudo leer la lista de deseos; se empieza vacía.', error);
    return [];
  }
}

export const WishlistProvider = ({ children }) => {
  const [wishlistItems, setWishlistItems] = useState(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlistItems));
    } catch (error) {
      console.warn('No se pudo guardar la lista de deseos.', error);
    }
  }, [wishlistItems]);

  // La lista se mantiene igual entre pestañas abiertas.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      setWishlistItems(readStored());
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleWishlist = useCallback((product) => {
    const entrada = normalizeItem(product);
    if (!entrada) return;

    setWishlistItems((prev) => {
      if (prev.some((item) => item.id === entrada.id)) {
        toast.success('Eliminado de tu lista de deseos');
        return prev.filter((item) => item.id !== entrada.id);
      }

      toast.success('Añadido a tu lista de deseos');
      return [...prev, entrada];
    });
  }, []);

  const removeFromWishlist = useCallback((productId) => {
    setWishlistItems((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const clearWishlist = useCallback(() => setWishlistItems([]), []);

  const value = useMemo(
    () => ({
      wishlistItems,
      toggleWishlist,
      removeFromWishlist,
      clearWishlist,
      isInWishlist: (productId) => wishlistItems.some((item) => item.id === productId),
      wishlistCount: wishlistItems.length,
    }),
    [wishlistItems, toggleWishlist, removeFromWishlist, clearWishlist]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};
