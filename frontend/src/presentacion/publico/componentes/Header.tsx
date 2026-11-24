import React, { useState } from 'react';
import { Menu, X, PhoneCall, ShoppingBag, Sun, Moon } from 'lucide-react';
import logoSrc from '../../../assets/logo-roas-ingenieros.png';
import { useThrottledScroll } from '../hooks/useThrottle';
import { useCart } from '../contexto/CartContext';
import type { ScreenType } from '../../../App';
import './Header.css';

interface HeaderProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentScreen, onNavigate, theme, toggleTheme }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { totalItems, setIsCartOpen } = useCart();

  useThrottledScroll((scrollY) => {
    setIsScrolled(scrollY > 20);
  });

  const handleLinkClick = (screen: ScreenType) => {
    setIsMenuOpen(false);
    onNavigate(screen);
  };

  return (
    <header className={`header ${isScrolled ? 'header-scrolled' : ''}`}>
      <div className="header-container">
        {/* LOGO */}
        <a 
          href="#home" 
          className="logo" 
          aria-label="ROAS Ingenieros Home"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('home');
          }}
        >
          <img 
            src={logoSrc} 
            alt="ROAS Ingenieros" 
            className="header-logo-img" 
          />
          <div className="logo-text">
            <span className="logo-title">ROAS</span>
            <span className="logo-subtitle">INGENIEROS</span>
          </div>
        </a>

        {/* DESKTOP NAVIGATION */}
        <nav className="desktop-nav" aria-label="Navegación Principal">
          <a 
            href="#services" 
            className={`nav-link ${currentScreen === 'services' ? 'nav-link-active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('services');
            }}
          >
            Servicios
          </a>
          <a 
            href="#catalog" 
            className={`nav-link ${currentScreen === 'catalog' ? 'nav-link-active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('catalog');
            }}
          >
            Productos
          </a>
          <a 
            href="#contact" 
            className={`nav-link ${currentScreen === 'contact' ? 'nav-link-active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('contact');
            }}
          >
            Contacto
          </a>
        </nav>

        {/* ACTION ITEMS */}
        <div className="header-actions">
          {toggleTheme && (
            <button 
              type="button" 
              className="theme-toggle-header"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          )}

          <button 
            type="button" 
            className="cart-toggle-header"
            onClick={() => setIsCartOpen(true)}
            aria-label={`Carrito de cotización con ${totalItems} productos`}
          >
            <ShoppingBag size={17} />
            {totalItems > 0 && <span className="cart-toggle-badge">{totalItems}</span>}
          </button>

          <a href="tel:+51932101907" className="call-cta-btn" aria-label="Llamar a central telefónica">
            <span className="call-cta-icon-wrapper">
              <PhoneCall size={14} />
            </span>
            <span>Central 24/7</span>
          </a>

          <button 
            type="button" 
            className="mobile-menu-toggle" 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* MOBILE NAVIGATION */}
      <div className={`mobile-nav-overlay ${isMenuOpen ? 'mobile-nav-open' : ''}`}>
        <nav className="mobile-nav" aria-label="Navegación Móvil">
          <a 
            href="#services" 
            className={`mobile-nav-link ${currentScreen === 'services' ? 'mobile-nav-link-active' : ''}`} 
            onClick={(e) => { e.preventDefault(); handleLinkClick('services'); }}
          >
            Servicios
          </a>
          <a 
            href="#catalog" 
            className={`mobile-nav-link ${currentScreen === 'catalog' ? 'mobile-nav-link-active' : ''}`} 
            onClick={(e) => { e.preventDefault(); handleLinkClick('catalog'); }}
          >
            Productos
          </a>
          <a 
            href="#contact" 
            className={`mobile-nav-link ${currentScreen === 'contact' ? 'mobile-nav-link-active' : ''}`} 
            onClick={(e) => { e.preventDefault(); handleLinkClick('contact'); }}
          >
            Contacto
          </a>
          
          <a href="tel:+51932101907" className="mobile-call-btn" onClick={() => setIsMenuOpen(false)}>
            <PhoneCall size={18} />
            <span>Central: 932 101 907</span>
          </a>
        </nav>
      </div>
    </header>
  );
};
