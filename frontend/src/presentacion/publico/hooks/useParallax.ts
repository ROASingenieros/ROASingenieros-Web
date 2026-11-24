import { useEffect, useRef } from 'react';

interface ParallaxOptions {
  /** Speed multiplier relative to scroll. 0.5 = half speed, 1 = same, -0.3 = opposite direction */
  speed?: number;
  /** Offset in px to start the effect from */
  offset?: number;
  /** When true, element fades out as it scrolls past the viewport (default: false) */
  fadeOut?: boolean;
  /** Clamp the parallax translation to this max px (default: Infinity) */
  clamp?: number;
}

/**
 * useParallax — Applies CSS custom properties to the ref'd element
 * via requestAnimationFrame for jank-free scrolling.
 *
 * Usage:
 *   const { ref } = useParallax<HTMLDivElement>({ speed: 0.4 });
 *   <div ref={ref} style={{ transform: `translateY(var(--parallax-y))` }} />
 *
 * CSS vars set on the element:
 *   --parallax-y          : translated px value
 *   --parallax-progress   : 0 → 1 as element scrolls through viewport
 *   --parallax-opacity    : 0 → 1 (only set when fadeOut=true)
 */
export function useParallax<T extends HTMLElement = HTMLElement>(
  options: ParallaxOptions = {}
) {
  const { speed = 0.3, offset = 0, fadeOut = false, clamp = Infinity } = options;
  const ref = useRef<T | null>(null);
  const rafId = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el!.getBoundingClientRect();
      const vh = window.innerHeight;
      const elH = rect.height;

      // Center of element relative to viewport center: -0.5 → 0.5 (0 = centred)
      const centerOffset = (rect.top + elH / 2) / vh - 0.5;

      // Progress 0→1 from element entering bottom to leaving top
      const total = vh + elH;
      const scrolled = vh - rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / total));

      // Translate
      let y = centerOffset * speed * vh + offset;
      if (Math.abs(y) > clamp) y = Math.sign(y) * clamp;

      el!.style.setProperty('--parallax-y', `${y.toFixed(1)}px`);
      el!.style.setProperty('--parallax-progress', progress.toFixed(3));
      el!.style.setProperty('--parallax-opacity', String(1 - progress));
      if (fadeOut) {
        el!.style.setProperty('--parallax-opacity', String(progress < 0.5 ? 1 : Math.max(0, 1 - (progress - 0.5) * 2)));
      }
    };

    update();

    const onScroll = () => {
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(() => {
          update();
          rafId.current = 0;
        });
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [speed, offset, fadeOut, clamp]);

  return { ref };
}
