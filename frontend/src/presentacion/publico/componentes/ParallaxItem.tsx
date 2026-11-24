import React, { useState } from 'react';
import { useParallax } from '../hooks/useParallax';

interface ParallaxItemProps {
  children: React.ReactNode;
  /** Speed multiplier: higher = more movement (default: 0.1) */
  speed?: number;
  /** Max pixel displacement (default: 40) */
  clamp?: number;
  /** Direction: 'up' (default, moves up), 'down' (moves down), or 'none' */
  direction?: 'up' | 'down' | 'none';
  /** Optional className to forward */
  className?: string;
  /** Tag to render as (default: 'div'). Use this to avoid extra wrapper divs! */
  as?: React.ElementType;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** Event handlers & ARIA forwarded to the root element */
  onClick?: React.MouseEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  role?: string;
  'aria-expanded'?: boolean;
  tabIndex?: number;
}

/**
 * ParallaxItem — Applies a subtle translateY parallax to an element
 * based on scroll position. Uses CSS custom properties via
 * useParallax hook for zero re-renders during scroll.
 *
 * Note: Parallax is automatically disabled on mobile (< 768px) and
 * when the user prefers reduced motion.
 *
 * Tip: Use `as` + `className` instead of wrapping to avoid extra DOM nodes:
 *   <ParallaxItem as="div" className="my-card" speed={0.12}>
 *     ...content...
 *   </ParallaxItem>
 */
export const ParallaxItem: React.FC<ParallaxItemProps> = ({
  children,
  speed = 0.1,
  clamp = 40,
  direction = 'up',
  className = '',
  as: Tag = 'div',
  style,
  onClick,
  onKeyDown,
  role,
  'aria-expanded': ariaExpanded,
  tabIndex,
}) => {
  const [prefersReduced] = useState(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  const [isMobile] = useState(
    typeof window !== 'undefined'
      ? window.innerWidth < 768
      : false
  );

  const { ref } = useParallax<HTMLDivElement>({
    speed: direction === 'none' ? 0 : direction === 'down' ? -speed : speed,
    clamp,
  });

  // Disable parallax transform on mobile or when user prefers reduced motion
  if (prefersReduced || isMobile) {
    return (
      <Tag
        ref={ref}
        className={className}
        style={style}
        onClick={onClick}
        onKeyDown={onKeyDown}
        role={role}
        aria-expanded={ariaExpanded}
        tabIndex={tabIndex}
      >
        {children}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        transform: 'translateY(var(--parallax-y, 0px))',
        willChange: 'transform',
        ...style,
      }}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={role}
      aria-expanded={ariaExpanded}
      tabIndex={tabIndex}
    >
      {children}
    </Tag>
  );
};
