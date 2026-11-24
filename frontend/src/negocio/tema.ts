// ============================================================================
// Tema claro/oscuro compartido por el sitio público y el panel de gestión.
// ============================================================================
// El atributo `data-theme` en <html> es el que manda: index.css define los
// colores bajo `:root[data-theme='dark']` y `:root[data-theme='light']`.
//
// Cada uno guarda su preferencia en una clave distinta para que el panel no
// herede el tema del sitio (era la causa de que el panel apareciera en claro
// "solo" y de botones con texto claro sobre fondo blanco):
//
//   'theme'        → sitio público (por defecto claro)
//   'tema-gestion' → panel de gestión (por defecto oscuro)
//
// `aplicarTemaInicial()` se llama en main.tsx antes del primer render, así el
// documento nunca se queda sin tema (sin `data-theme`, las variables CSS no
// existen y el navegador pinta fondos y textos por defecto).
// ============================================================================

export type Tema = 'light' | 'dark';

/** Dónde se está aplicando: define en qué clave se guarda la preferencia. */
export type AmbitoTema = 'sitio' | 'gestion';

const CLAVES: Record<AmbitoTema, string> = {
  sitio: 'theme',
  gestion: 'tema-gestion',
};

export const TEMA_POR_DEFECTO: Record<AmbitoTema, Tema> = {
  sitio: 'dark',
  gestion: 'dark',
};

function esTema(valor: string | null): valor is Tema {
  return valor === 'light' || valor === 'dark';
}

/** Lee la preferencia guardada; si no hay o no es válida, usa la de por defecto (dark). */
export function leerTema(ambito: AmbitoTema): Tema {
  try {
    const guardado = localStorage.getItem(CLAVES[ambito]);
    return esTema(guardado) ? guardado : TEMA_POR_DEFECTO[ambito];
  } catch {
    // localStorage puede estar bloqueado (modo privado): se usa el de por defecto.
    return TEMA_POR_DEFECTO[ambito];
  }
}

/** Escribe el tema en el documento (y lo recuerda) para el ámbito indicado. */
export function aplicarTema(tema: Tema, ambito: AmbitoTema): void {
  const raiz = document.documentElement;
  raiz.setAttribute('data-theme', tema);
  // Los controles nativos (select, checkbox, barras) siguen al tema; si no,
  // un <select> oscuro puede abrir una lista blanca con texto invisible.
  raiz.style.colorScheme = tema;
  try {
    localStorage.setItem(CLAVES[ambito], tema);
  } catch {
    // Sin persistencia: el tema sigue aplicándose en esta sesión.
  }
}

/** Ámbito que corresponde a la URL actual (`#/gestion...` es el panel). */
export function ambitoActual(): AmbitoTema {
  return window.location.hash.startsWith('#/gestion') ? 'gestion' : 'sitio';
}

/**
 * Aplica el tema que corresponde a la URL antes de montar React: evita el
 * parpadeo y el estado "sin tema" en una carga directa de `#/gestion`.
 */
export function aplicarTemaInicial(): Tema {
  const ambito = ambitoActual();
  const tema = leerTema(ambito);
  aplicarTema(tema, ambito);
  return tema;
}

/** El otro tema (para el botón de alternar). */
export function temaOpuesto(tema: Tema): Tema {
  return tema === 'dark' ? 'light' : 'dark';
}
