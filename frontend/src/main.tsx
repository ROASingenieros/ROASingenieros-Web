import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { aplicarTemaInicial } from './negocio/tema';

// Antes del primer render: el sitio y el panel tienen su propio tema guardado.
// Sin esto, una carga directa de `#/gestion` no fijaba `data-theme` y la página
// salía con los colores por defecto del navegador (texto claro sobre blanco).
aplicarTemaInicial();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
