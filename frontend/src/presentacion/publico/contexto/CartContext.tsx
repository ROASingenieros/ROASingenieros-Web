import { createContext, useContext } from 'react';

export interface CartProduct {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
  price: string;
  brand?: string;
  specs?: string[];
  chip?: string;
  colorClass?: string;
  imageUrl?: string | null;
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
}

export interface CartContextType {
  cart: CartItem[];
  addToCart: (product: CartProduct) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  clearCart: () => void;
  toastMessage: string | null;
}

export const CartContext = createContext<CartContextType | null>(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};
