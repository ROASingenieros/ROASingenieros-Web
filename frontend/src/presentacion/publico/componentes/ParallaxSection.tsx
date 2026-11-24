import React, { useState, useEffect } from 'react';
import { useParallax } from '../hooks/useParallax';
import './ParallaxSection.css';

interface ParallaxSectionProps {
  children: React.ReactNode;
  /** Speed factor for the main content (default: 0.15) — subtle */
  speed?: number;
  /** Optional className forwarded to the wrapper */
  className?: string;
  /** Direction of movement: 'up' (default), 'down', or 'none' for the main content */
  direction?: 'up' | 'down' | 'none';
}

/**
 * ParallaxSection — Wraps any section and adds a subtle parallax
 * movement to the main content plus a deeper parallax background layer.
 *
 * The effect is significantly reduced on mobile (< 768px) to prevent
 * elements from overlapping each other.
 */
export const ParallaxSection: React.FC<ParallaxSectionProps> = ({
  children,
  speed = 0.15,
  className = '',
  direction = 'up',
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // On mobile: reduce speed to 20% and clamp to a tiny value so parallax
  // is barely perceptible and won't cause overlap
  const adjustedSpeed = isMobile ? speed * 0.2 : speed;
  const clamp = isMobile ? 10 : 60;

  const { ref } = useParallax<HTMLDivElement>({
    speed: direction === 'none' ? 0 : direction === 'down' ? -adjustedSpeed : adjustedSpeed,
    clamp,
  });

  return (
    <div ref={ref} className={`parallax-section ${className}`}>
      <div
        className="parallax-content"
        style={{
          transform: isMobile ? 'none' : 'translateY(var(--parallax-y, 0px))',
          willChange: isMobile ? 'auto' : 'transform',
        }}
      >
        {children}
      </div>
      {/* Deep background decorative layer — disabled on mobile */}
      {!isMobile && (
        <div
          className="parallax-depth-bg"
          style={{
            transform: 'translateY(calc(var(--parallax-y, 0px) * -2.5))',
            willChange: 'transform',
            opacity: 'var(--parallax-opacity, 0.4)',
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};
