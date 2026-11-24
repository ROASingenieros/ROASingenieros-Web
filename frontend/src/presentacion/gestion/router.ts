import { useCallback, useEffect, useState } from 'react';

/**
 * Router hash mínimo (sin dependencias): el panel vive en `#/gestion/<pagina>[/<id>]`.
 * El sitio público conserva su navegación de estado interno y solo cede el
 * control cuando el hash empieza con `#/gestion`.
 */
const PREFIJO = '#/gestion';

export function rutaActual(): string {
  const h = window.location.hash || '';
  if (!h.startsWith(PREFIJO)) return '';
  const resto = h.slice(PREFIJO.length).replace(/^\/+/, '');
  return resto;
}

export function irA(ruta: string): void {
  const limpio = ruta.replace(/^\/+/, '');
  window.location.hash = limpio ? `${PREFIJO}/${limpio}` : PREFIJO;
}

/** [pagina, id] — id es opcional (detalle). */
export function useRutaGestion(): [string, string] {
  const [ruta, setRuta] = useState<string>(rutaActual);

  useEffect(() => {
    const onHash = () => setRuta(rutaActual());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const [pagina, id = ''] = ruta.split('/');
  return [pagina || 'panel', id];
}

export function useIrA() {
  return useCallback((ruta: string) => irA(ruta), []);
}
