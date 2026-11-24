import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  alphaSpeed: number;
  pulsePhase: number;
}

interface MousePos {
  x: number;
  y: number;
}

const COLORS = [
  '59, 130, 246',
  '249, 115, 22',
  '99, 102, 241',
];

const CONNECTION_DISTANCE = 100;
const MOUSE_REPEL_RADIUS = 120;
const MOUSE_REPEL_STRENGTH = 0.5;

const PARTICLE_COUNT = 25;

export const HeroParticles: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef<MousePos>({ x: -9999, y: -9999 });
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const createParticles = (w: number, h: number) => {
      const particles: Particle[] = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -(Math.random() * 0.2 + 0.08),
          radius: Math.random() * 2 + 0.8,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          alpha: Math.random() * 0.4 + 0.15,
          alphaSpeed: Math.random() * 0.004 + 0.001,
          pulsePhase: Math.random() * Math.PI * 2,
        });
      }
      particlesRef.current = particles;
    };

    const resize = () => {
      if (!canvas) return;
      const prevWidth = canvas.width;
      const prevHeight = canvas.height;
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      if (prevWidth > 0 && prevHeight > 0) {
        const scaleX = canvas.width / prevWidth;
        const scaleY = canvas.height / prevHeight;
        const p = particlesRef.current;
        for (let i = 0; i < p.length; i++) {
          p[i].x *= scaleX;
          p[i].y *= scaleY;
        }
      }
    };

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    const animate = (timestamp: number) => {
      if (!canvas || !ctx) return;
      const dt = Math.min(timestamp - lastTimeRef.current, 50) / 16;
      lastTimeRef.current = timestamp;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;
      const mouse = mouseRef.current;
      const w = canvas.width;
      const h = canvas.height;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Mouse repulsion
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = dx * dx + dy * dy;
        if (dist < MOUSE_REPEL_RADIUS * MOUSE_REPEL_RADIUS && dist > 0) {
          const d = Math.sqrt(dist);
          const force = (MOUSE_REPEL_RADIUS - d) / MOUSE_REPEL_RADIUS;
          p.vx += (dx / d) * force * MOUSE_REPEL_STRENGTH * dt;
          p.vy += (dy / d) * force * MOUSE_REPEL_STRENGTH * dt;
        }

        p.vx *= 0.97;
        p.vy *= 0.97;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.x < -20) p.x = w + 20;
        else if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        else if (p.y > h + 20) p.y = -20;

        p.pulsePhase += p.alphaSpeed * dt;
        const currentAlpha = p.alpha * (0.6 + 0.4 * Math.sin(p.pulsePhase));

        // Glow (smaller radius)
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${currentAlpha * 0.1})`;
        ctx.fill();

        // Particle dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${currentAlpha})`;
        ctx.fill();
      }

      // Connection lines in a separate pass (batched for less state changes)
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
      ctx.lineWidth = 0.5;
      const maxDistSq = CONNECTION_DISTANCE * CONNECTION_DISTANCE;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;
          if (distSq < maxDistSq) {
            ctx.globalAlpha = 1 - Math.sqrt(distSq) / CONNECTION_DISTANCE;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      animFrameRef.current = requestAnimationFrame(animate);
    };

    resize();
    createParticles(canvas.width, canvas.height);
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouse);
    window.addEventListener('mouseleave', handleMouseLeave);

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('mouseleave', handleMouseLeave);
      particlesRef.current = [];
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="hero-particles-canvas"
      aria-hidden="true"
    />
  );
};
