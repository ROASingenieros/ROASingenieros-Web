import React, { useState } from 'react';
import { ShoppingBag, Trash2, Plus, Minus, MessageCircle, X } from 'lucide-react';
import { useCart } from '../contexto/CartContext';
import { openWhatsApp, generateQuoteMessage } from '../../../externos/whatsapp';
import { registrarSolicitudWeb } from '../../../datos/supabase';
import { validarNombre, validarTelefono } from '../../../negocio/validaciones';

export const CartDrawer: React.FC = () => {
  const { cart, removeFromCart, updateQuantity, totalPrice, isCartOpen, setIsCartOpen, clearCart } = useCart();
  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  if (!isCartOpen) return null;

  const handleSendQuote = () => {
    // Validar nombre (no permite números)
    const resNombre = validarNombre(nombre, true);
    if (!resNombre.valido) {
      setAviso(resNombre.error || 'Ingresa tu nombre.');
      return;
    }

    // Validar celular (no permite letras, 9 dígitos empezando con 9)
    const resCelular = validarTelefono(celular, true, true);
    if (!resCelular.valido) {
      setAviso(resCelular.error || 'Ingresa un celular válido.');
      return;
    }

    const celularLimpio = celular.replace(/\D/g, '');
    setAviso(null);
    setIsCartOpen(false);

    const items = cart.map(item => ({
      name: item.product.name,
      qty: item.quantity,
      price: item.product.price,
    }));

    // Lead en la bandeja "Solicitudes web" del gerente (no bloquea el envío).
    void registrarSolicitudWeb(nombre.trim(), celularLimpio, items);

    const message = generateQuoteMessage(items);
    openWhatsApp(message);
    clearCart();
    setNombre('');
    setCelular('');
  };

  return (
    <div className="cart-modal-overlay" onClick={() => setIsCartOpen(false)}>
      <div className="cart-modal" onClick={e => e.stopPropagation()}>
        <div className="cart-modal-header">
          <h2>Lista de Cotización</h2>
          <button 
            type="button" 
            className="close-cart-btn" 
            onClick={() => setIsCartOpen(false)}
            aria-label="Cerrar lista de cotización"
          >
            <X size={18} />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="cart-empty-state">
            <ShoppingBag size={48} style={{ color: '#94a3b8' }} />
            <p>Tu lista está vacía.</p>
            <p className="cart-empty-hint">Agrega productos desde el catálogo.</p>
          </div>
        ) : (
          <>
            <div className="cart-items-list">
              {cart.map(item => (
                <div key={item.product.id} className="cart-item-card">
                  <div className="cart-item-info">
                    <h4>{item.product.name}</h4>
                    <p className="cart-item-price">{item.product.price}</p>
                  </div>
                  <div className="cart-item-controls">
                    <button type="button" className="qty-btn" onClick={() => updateQuantity(item.product.id, -1)}>
                      <Minus size={12} />
                    </button>
                    <span className="qty-number">{item.quantity}</span>
                    <button type="button" className="qty-btn" onClick={() => updateQuantity(item.product.id, 1)}>
                      <Plus size={12} />
                    </button>
                    <button type="button" className="cart-delete-btn" onClick={() => removeFromCart(item.product.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-modal-footer">
              <div className="cart-total-row">
                <span>Total estimado (con IGV):</span>
                <strong style={{ color: '#3b82f6' }}>
                  S/ {totalPrice.toFixed(2)}
                </strong>
                <button
                  type="button"
                  className="cart-clear-btn"
                  onClick={() => clearCart()}
                  aria-label="Vaciar carrito"
                >
                  <Trash2 size={14} />
                  <span>Vaciar</span>
                </button>
              </div>

              {/* Datos de contacto: alimentan la bandeja de solicitudes web */}
              <div className="cart-contact-fields">
                <input
                  type="text"
                  className="cart-contact-input"
                  placeholder="Tu nombre *"
                  value={nombre}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNombre(val);
                    if (/\d/.test(val)) {
                      setAviso('El nombre no puede contener números.');
                    } else if (aviso && aviso.includes('nombre')) {
                      setAviso(null);
                    }
                  }}
                  aria-label="Nombre para la cotización"
                />
                <input
                  type="tel"
                  className="cart-contact-input"
                  placeholder="Celular (9 dígitos) *"
                  value={celular}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCelular(val);
                    if (/[a-zA-Z]/.test(val)) {
                      setAviso('El celular no puede contener letras.');
                    } else if (aviso && aviso.includes('letras')) {
                      setAviso(null);
                    }
                  }}
                  aria-label="Celular para la cotización"
                  inputMode="numeric"
                />
              </div>
              {aviso && <p className="cart-contact-aviso">{aviso}</p>}

              <button type="button" className="cart-checkout-btn" onClick={handleSendQuote}>
                <span className="cart-checkout-icon-circle">
                  <MessageCircle size={15} />
                </span>
                <span>Cotizar por WhatsApp</span>
              </button>
              <p className="cart-whatsapp-note">
                Al hacer clic se abrirá WhatsApp con tu lista de productos pre-cargada.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

