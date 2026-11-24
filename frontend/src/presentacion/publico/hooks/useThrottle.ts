import { useEffect, useRef } from 'react';

/**
 * Throttles a scroll handler to run at most once per animation frame,
 * aligning updates with the browser's paint cycle.
 */
export function useThrottledScroll(callback: (scrollY: number) => void) {
  const callbackRef = useRef(callback);
  const ticking = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(() => {
          callbackRef.current(window.scrollY);
          ticking.current = false;
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
}
