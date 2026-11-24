import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './presentacion/publico/componentes/Header';
import { Hero } from './presentacion/publico/componentes/Hero';
import { ProductCatalog } from './presentacion/publico/componentes/ProductCatalog';
import { Services } from './presentacion/publico/componentes/Services';
import { Contact } from './presentacion/publico/componentes/Contact';
import { Footer } from './presentacion/publico/componentes/Footer';
import { PageTransition, type TransitionPhase } from './presentacion/publico/componentes/PageTransition';
import { ShoppingBag } from 'lucide-react';
import { WhatsAppFloat } from './presentacion/publico/componentes/WhatsAppFloat';
import { ParallaxSection } from './presentacion/publico/componentes/ParallaxSection';
import { CartDrawer } from './presentacion/publico/componentes/CartDrawer';
import { CartToast } from './presentacion/publico/componentes/CartToast';
import { useCart } from './presentacion/publico/contexto/CartContext';
import { CartProvider } from './presentacion/publico/contexto/CartProvider';
import { GestionApp } from './presentacion/gestion/GestionApp';
import { useTema } from './presentacion/publico/hooks/useTema';
import './App.css';

export type ScreenType = 'home' | 'services' | 'catalog' | 'contact';

/**
 * Public site only.
 *
 * The catalog and services are read-only: visitors browse products/services,
 * add what they want to a quote cart and send the list to WhatsApp (wa.me).
 * Everything else (admin, auth, online payments) lives outside this app.
 */
const PublicSite = () => {
  // El sitio y el panel de gestión guardan su tema por separado (ver lib/tema.ts).
  const { tema: theme, alternar: toggleTheme } = useTema('sitio');

  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle');
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  const handleNavigate = useCallback((screen: ScreenType) => {
    if (screen === currentScreen) return;
    if (transitionPhase !== 'idle') return; // don't queue while animating

    // Step 1: Start exit animation with old screen still visible
    setTransitionPhase('exiting');
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Step 2: After exit completes, swap screen + start enter
    exitTimerRef.current = setTimeout(() => {
      setCurrentScreen(screen);
      setTransitionPhase('entering');
    }, 180);
  }, [currentScreen, transitionPhase]);

  const onEnterComplete = useCallback(() => {
    setTransitionPhase('idle');
  }, []);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home': return <Hero onNavigate={handleNavigate} />;
      case 'services': return <Services />;
      case 'catalog': return <ProductCatalog />;
      case 'contact': return <Contact />;
      default: return <Hero onNavigate={handleNavigate} />;
    }
  };

  const showLoader = transitionPhase !== 'idle';

  return (
    <CartProvider>
      {/* Top progress bar during transitions */}
      <div className={`page-loader-bar ${showLoader ? 'page-loader-active' : ''}`}>
        <div className="page-loader-track"></div>
      </div>

      <Header currentScreen={currentScreen} onNavigate={handleNavigate} theme={theme} toggleTheme={toggleTheme} />

      <WhatsAppFloat />

      <main>
        <PageTransition
          phase={transitionPhase}
          onEnterComplete={onEnterComplete}
          exitDuration={180}
          enterDuration={240}
        >
          {transitionPhase === 'exiting' ? null : (
            <ParallaxSection>
              {renderScreen()}
            </ParallaxSection>
          )}
        </PageTransition>
      </main>

      <FloatingCartButton />

      <Footer onNavigate={handleNavigate} />

      <CartDrawer />
      <CartToast />
    </CartProvider>
  );
};

/* Floating cart button — visible from any screen when items > 0 */
const FloatingCartButton: React.FC = () => {
  const { totalItems, setIsCartOpen } = useCart();
  if (totalItems === 0) return null;
  return (
    <button
      type="button"
      className="floating-cart-bag"
      onClick={() => setIsCartOpen(true)}
      aria-label={`Carrito con ${totalItems} productos`}
    >
      <ShoppingBag size={24} />
      <span className="cart-badge-count">{totalItems}</span>
    </button>
  );
};

/**
 * El sitio público y el panel de gestión conviven en el mismo bundle pero
 * nunca a la vez: el panel ocupa `#/gestion...` y el resto es el catálogo.
 */
const PREFIJO_GESTION = '#/gestion';

function App() {
  const [esGestion, setEsGestion] = useState(() => window.location.hash.startsWith(PREFIJO_GESTION));

  useEffect(() => {
    const onHash = () => setEsGestion(window.location.hash.startsWith(PREFIJO_GESTION));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return esGestion ? <GestionApp /> : <PublicSite />;
}

export default App;
