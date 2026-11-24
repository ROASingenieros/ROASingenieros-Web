import React, { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../contexto/CartContext';

export const CartToast: React.FC = () => {
  const { toastMessage, setIsCartOpen } = useCart();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      // Mostrar en el siguiente frame para que corra la animación de entrada.
      const raf = requestAnimationFrame(() => {
        setMessage(toastMessage);
        setVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    }
    // Ocultar y limpiar el mensaje tras la animación de salida.
    const hideTimer = setTimeout(() => setVisible(false), 0);
    const clearTimer = setTimeout(() => setMessage(null), 300);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [toastMessage]);

  if (!message) return null;

  return (
    <div
      className={`cart-toast ${visible ? 'cart-toast-visible' : ''}`}
      onClick={() => setIsCartOpen(true)}
      role="button"
      tabIndex={0}
    >
      <ShoppingBag size={16} />
      <span>{message}</span>
    </div>
  );
};
