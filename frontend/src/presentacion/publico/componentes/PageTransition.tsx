import React, { useEffect, useRef } from 'react';

export type TransitionPhase = 'idle' | 'exiting' | 'entering';

interface PageTransitionProps {
  children: React.ReactNode;
  phase: TransitionPhase;
  onEnterComplete?: () => void;
  exitDuration?: number;
  enterDuration?: number;
}

/**
 * PageTransition wraps each screen and animates exit/entrance.
 * The parent controls the phase: idle → exiting → (screen swap) → entering → idle
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  phase,
  onEnterComplete,
  exitDuration = 350,
  enterDuration = 500,
}) => {
  const [previousChildren, setPreviousChildren] = React.useState(children);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Ajuste de estado durante el render (patrón recomendado por React): mientras
  // dura la salida conservamos el contenido anterior; al entrar/idle pasamos al
  // nuevo. Evita el setState dentro de un efecto.
  if (phase !== 'exiting' && previousChildren !== children) {
    setPreviousChildren(children);
  }
  const displayChildren = phase === 'exiting' ? previousChildren : children;

  useEffect(() => {
    if (phase !== 'entering') return;
    // Al entrar, avisar que terminó la animación.
    enterTimerRef.current = setTimeout(() => {
      onEnterComplete?.();
    }, enterDuration);
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    };
  }, [phase, enterDuration, onEnterComplete]);

  const getAnimationClass = () => {
    switch (phase) {
      case 'exiting':
        return 'page-exit';
      case 'entering':
        return 'page-enter';
      default:
        return 'page-idle';
    }
  };

  return (
    <div
      className={`page-transition-wrap ${getAnimationClass()}`}
      style={{
        '--exit-duration': `${exitDuration}ms`,
        '--enter-duration': `${enterDuration}ms`,
      } as React.CSSProperties}
    >
      {displayChildren}
    </div>
  );
};

