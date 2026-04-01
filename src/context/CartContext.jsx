/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('thaiger_cart');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to parse cart", error);
      return [];
    }
  });

  // Guardar en localStorage cada vez que cambie el carrito
  useEffect(() => {
    localStorage.setItem('thaiger_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product, quantity = 1) => {
    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        // Enforce stock limit on existing item
        const newQuantity = existingItem.quantity + quantity;
        const finalQuantity = product.stock !== undefined ? Math.min(newQuantity, product.stock) : newQuantity;
        
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: finalQuantity }
            : item
        );
      }
      
      // Enforce stock limit on new item
      const finalQuantity = product.stock !== undefined ? Math.min(quantity, product.stock) : quantity;
      return [...prev, { ...product, quantity: finalQuantity }];
    });
  };

  const removeFromCart = (productId) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, newQuantity, stock) => {
    if (newQuantity < 1) {
       removeFromCart(productId);
       return;
    }

    // Enforce stock limit if stock is provided
    const finalQuantity = stock !== undefined ? Math.min(newQuantity, stock) : newQuantity;

    setCartItems(prev => 
      prev.map(item => 
        item.id === productId ? { ...item, quantity: finalQuantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem('thaiger_cart');
  };

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};
