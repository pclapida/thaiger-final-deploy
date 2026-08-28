/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { computeCartTotals } from '../lib/pricing';

const CartContext = createContext(null);
const STORAGE_KEY = 'thaiger_cart';

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe usarse dentro de <CartProvider>.');
  return context;
};

/**
 * Sólo se guarda lo que el carrito necesita para pintarse y para pedir.
 * El precio definitivo lo recalcula el backend contra el catálogo, así que
 * lo de aquí es una copia de conveniencia, no la fuente de la verdad.
 */
function normalizeItem(raw) {
  const id = raw?.id;
  if (id === undefined || id === null) return null;

  const quantity = Math.floor(Number(raw.quantity));
  const price1 = Number(raw.price1);
  if (!Number.isFinite(quantity) || quantity < 1) return null;
  if (!Number.isFinite(price1) || price1 <= 0) return null;

  return {
    id,
    name: String(raw.name ?? ''),
    brand: String(raw.brand ?? ''),
    category: String(raw.category ?? ''),
    image_url: raw.image_url ?? null,
    price1,
    price2: Number(raw.price2) || price1,
    price3: Number(raw.price3) || price1,
    is_on_sale: Boolean(raw.is_on_sale),
    discount_percent: Number(raw.discount_percent) || 0,
    stock: raw.stock === undefined || raw.stock === null ? undefined : Number(raw.stock),
    quantity,
  };
}

function readStoredCart() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    // Un carrito corrupto (o de una versión vieja) se limpia en lugar de romper.
    return parsed.map(normalizeItem).filter(Boolean);
  } catch (error) {
    console.warn('No se pudo leer el carrito guardado; se empieza vacío.', error);
    return [];
  }
}

/** Nunca más unidades de las que hay en inventario. */
function capToStock(quantity, stock) {
  const limite = Number(stock);
  if (!Number.isFinite(limite)) return Math.max(1, quantity);
  return Math.max(0, Math.min(quantity, limite));
}

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(readStoredCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    } catch (error) {
      // Cuota llena o almacenamiento bloqueado: la compra sigue en esta pestaña.
      console.warn('No se pudo guardar el carrito.', error);
    }
  }, [cartItems]);

  // Si la persona tiene la tienda abierta en dos pestañas, el carrito se
  // mantiene igual en las dos.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      setCartItems(readStoredCart());
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addToCart = useCallback((product, quantity = 1) => {
    const entrada = normalizeItem({ ...product, quantity });
    if (!entrada) return;

    setCartItems((prev) => {
      const existente = prev.find((item) => item.id === entrada.id);

      if (existente) {
        const total = capToStock(existente.quantity + entrada.quantity, entrada.stock);
        if (total <= 0) return prev.filter((item) => item.id !== entrada.id);
        // Se refrescan precio, stock y foto por si el catálogo cambió.
        return prev.map((item) => (item.id === entrada.id ? { ...entrada, quantity: total } : item));
      }

      const inicial = capToStock(entrada.quantity, entrada.stock);
      if (inicial <= 0) return prev;
      return [...prev, { ...entrada, quantity: inicial }];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const updateQuantity = useCallback(
    (productId, newQuantity, stock) => {
      const cantidad = Math.floor(Number(newQuantity));

      if (!Number.isFinite(cantidad) || cantidad < 1) {
        removeFromCart(productId);
        return;
      }

      setCartItems((prev) =>
        prev.map((item) =>
          item.id === productId
            ? { ...item, quantity: capToStock(cantidad, stock !== undefined ? stock : item.stock) }
            : item
        )
      );
    },
    [removeFromCart]
  );

  const clearCart = useCallback(() => {
    setCartItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nada que hacer si el navegador lo bloquea */
    }
  }, []);

  const totals = useMemo(() => computeCartTotals(cartItems), [cartItems]);

  const value = useMemo(
    () => ({
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totals,
      cartCount: totals.itemCount,
      isInCart: (productId) => cartItems.some((item) => item.id === productId),
    }),
    [cartItems, addToCart, removeFromCart, updateQuantity, clearCart, totals]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
