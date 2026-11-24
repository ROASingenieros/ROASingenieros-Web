import { useCallback, useState } from 'react';
import {
  aplicarTema,
  leerTema,
  temaOpuesto,
  type AmbitoTema,
  type Tema,
} from '../../../negocio/tema';

/**
 * Tema de la pantalla actual. Se aplica al inicializar el estado (antes del
 * primer pintado) y al alternar, y recuerda la elección por ámbito: el panel de
 * gestión y el sitio público no se pisan el uno al otro.
 */
export function useTema(ambito: AmbitoTema): { tema: Tema; alternar: () => void } {
  const [tema, setTema] = useState<Tema>(() => {
    const inicial = leerTema(ambito);
    aplicarTema(inicial, ambito);
    return inicial;
  });

  const alternar = useCallback(() => {
    setTema((previo) => {
      const siguiente = temaOpuesto(previo);
      aplicarTema(siguiente, ambito);
      return siguiente;
    });
  }, [ambito]);

  return { tema, alternar };
}
