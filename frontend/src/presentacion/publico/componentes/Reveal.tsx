import React from 'react';
import { useReveal } from '../hooks/useReveal';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number; // delay in ms
  direction?: 'up' | 'down' | 'left' | 'right' | 'fade';
  duration?: number;
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  as?: React.ElementType;
}

export const Reveal: React.FC<RevealProps> = ({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  duration = 700,
  threshold,
  rootMargin,
  triggerOnce,
  as: Tag = 'div',
}) => {
  const { ref, isVisible } = useReveal<HTMLDivElement>({ threshold, rootMargin, triggerOnce });

  const getTransform = () => {
    switch (direction) {
      case 'up': return 'translateY(40px)';
      case 'down': return 'translateY(-40px)';
      case 'left': return 'translateX(-40px)';
      case 'right': return 'translateX(40px)';
      case 'fade': return 'translateY(0)';
      default: return 'translateY(40px)';
    }
  };

  const style: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0) translateX(0)' : getTransform(),
    transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
    transitionDelay: `${delay}ms`,
    willChange: isVisible ? 'auto' : 'opacity, transform',
  };

  return (
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
};

/// Stagger wrapper — animates children one after another
interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'fade';
  duration?: number;
  threshold?: number;
  as?: React.ElementType;
}

export const StaggerReveal: React.FC<StaggerProps> = ({
  children,
  className = '',
  staggerDelay = 100,
  direction = 'up',
  duration = 600,
  threshold,
  as: Tag = 'div',
}) => {
  const { ref, isVisible } = useReveal<HTMLDivElement>({ threshold });

  const getTransform = () => {
    switch (direction) {
      case 'up': return 'translateY(30px)';
      case 'down': return 'translateY(-30px)';
      case 'left': return 'translateX(-30px)';
      case 'right': return 'translateX(30px)';
      case 'fade': return 'scale(0.95)';
      default: return 'translateY(30px)';
    }
  };

  const cloneChild = (child: React.ReactNode, index: number): React.ReactNode => {
    if (!React.isValidElement<{ style?: React.CSSProperties }>(child)) return child;

    const delay = index * staggerDelay;
    const childStyle: React.CSSProperties = {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'translateY(0) translateX(0) scale(1)' : getTransform(),
      transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
      transitionDelay: `${delay}ms`,
      willChange: isVisible ? 'auto' : 'opacity, transform',
    };

    return React.cloneElement(child, {
      style: { ...child.props.style, ...childStyle },
    });
  };

  return (
    <Tag ref={ref} className={className}>
      {React.Children.map(children, (child, i) => cloneChild(child, i))}
    </Tag>
  );
};
