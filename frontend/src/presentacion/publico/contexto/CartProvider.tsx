import React, { useState, useRef, useCallback, useMemo } from 'react';
import { CartContext, type CartProduct, type CartItem, type CartContextType } from './CartContext';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2200);
  }, []);

  const addToCart = useCallback((product: CartProduct) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === product.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { product, quantity: 1 }];
    });
    showToast('Producto añadido ✓');
  }, [showToast]);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const totalItems = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);

  const totalPrice = useMemo(
    () =>
      cart.reduce((acc, item) => {
        const raw = parseFloat(item.product.price.replace(/[S/ ,]/g, '')) || 0;
        return acc + raw * item.quantity;
      }, 0),
    [cart]
  );

  const value = useMemo<CartContextType>(
    () => ({
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      totalItems,
      totalPrice,
      isCartOpen,
      setIsCartOpen,
      clearCart,
      toastMessage,
    }),
    [cart, addToCart, removeFromCart, updateQuantity, totalItems, totalPrice, isCartOpen, setIsCartOpen, clearCart, toastMessage]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
