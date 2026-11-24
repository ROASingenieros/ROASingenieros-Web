import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Zap, ArrowUpRight, Building2, Cpu, TowerControl, Camera, Flame, Phone } from 'lucide-react';
import { HeroParticles } from './HeroParticles';
import type { ScreenType } from '../../../App';
import './Hero.css';

interface HeroProps {
  onNavigate: (screen: ScreenType) => void;
}

/* Counter animation hook */
function useCountUp(target: number, isVisible: boolean, duration = 1800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isVisible, target, duration]);
  return count;
}

const pillars = [
  {
    icon: <Zap size={18} />,
    label: 'Electricidad General',
    desc: 'Domiciliaria · Industrial · Tableros',
    color: 'var(--accent-blue)',
  },
  {
    icon: <Camera size={18} />,
    label: 'Seguridad Electrónica',
    desc: 'CCTV · Alarmas · Cercos · NFPA',
    color: 'var(--accent-orange)',
  },
  {
    icon: <Cpu size={18} />,
    label: 'Pozos a Tierra',
    desc: 'Instalación · Medición · Certificación',
    color: 'var(--accent-green)',
  },
  {
    icon: <TowerControl size={18} />,
    label: 'Torres Especializadas',
    desc: 'Pararrayos · Comunicación · Nacional',
    color: 'var(--accent-indigo)',
  },
];

const certBadges = [
  { label: 'CIP', sub: 'Colegiados' },
  { label: 'CNE', sub: 'Normativa' },
  { label: 'NFPA', sub: 'Certificación' },
];

export const Hero: React.FC<HeroProps> = ({ onNavigate }) => {
  const heroRef = useRef<HTMLElement>(null);

  const statsRevealRef = useRef<HTMLDivElement>(null);
  const [statsRevealed, setStatsRevealed] = useState(false);

  useEffect(() => {
    const el = statsRevealRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setStatsRevealed(true);
        obs.unobserve(el);
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const yearsCount = useCountUp(8, statsRevealed);
  const projectsCount = useCountUp(200, statsRevealed);
  const clientsCount = useCountUp(85, statsRevealed);

  return (
    <section id="home" className="hero-section" ref={heroRef}>
      {/* ── Background Orbs ── */}
      <div className="hero-bg-layer" aria-hidden="true">
        <div className="bg-orb orb-electric animate-float" />
        <div className="bg-orb orb-shield animate-float-delayed" />
        <div className="hero-grid-overlay" />
      </div>

      {/* ── Particle System ── */}
      <div className="hero-particles-layer" aria-hidden="true">
        <HeroParticles />
      </div>

      {/* ── MAIN CONTENT — Asymmetric Split ── */}
      <div className="hero-container">
        {/* LEFT: Editorial column */}
        <div className="hero-left">
          {/* Eyebrow pill */}
          <div className="hero-badge hero-badge--animate">
            <span className="eyebrow-pulse" />
            <span className="hero-badge-tag">
              <Zap size={11} />
              INGENIERÍA ELÉCTRICA
            </span>
            <span className="hero-badge-divider" />
            <span className="hero-badge-text">Lima &amp; Provincias</span>
          </div>

          {/* Main heading — editorial large */}
          <h1 className="hero-title">
            Potencia tu<br />
            <span className="text-glow-electric animate-gradient-text">Empresa</span>{' '}
            con Ingeniería
          </h1>

          <p className="hero-description">
            Soluciones integrales en <strong>instalaciones eléctricas</strong>,{' '}
            <strong>sistemas de seguridad</strong> y <strong>pozos a tierra</strong>.
            Ingenieros CIP colegiados con más de 8 años de experiencia.
          </p>

          {/* Action row */}
          <div className="hero-actions">
            <a
              href="#services"
              className="hero-btn-primary"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('services');
              }}
            >
              <span className="hero-btn-icon-circle">
                <ArrowUpRight size={14} />
              </span>
              <span>Explorar Servicios</span>
            </a>
            <a
              href="tel:+51932101907"
              className="hero-btn-secondary"
            >
              <Phone size={15} />
              <span>Llamar Ahora</span>
            </a>
          </div>

          {/* Stats counter row */}
          <div className="hero-stats-row" ref={statsRevealRef}>
            <div className="stat-item">
              <span className="stat-number">{yearsCount}+</span>
              <span className="stat-label">Años</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-number">{projectsCount}+</span>
              <span className="stat-label">Proyectos</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-number">{clientsCount}%</span>
              <span className="stat-label">Satisfacción</span>
            </div>
          </div>

          {/* Trust badges row */}
          <div className="hero-trust-row">
            <div className="trust-item">
              <ShieldCheck size={14} className="trust-icon-inline text-green" />
              <span>Ingenieros CIP Colegiados</span>
            </div>
            <div className="trust-item">
              <Building2 size={14} className="trust-icon-inline text-orange" />
              <span>Cobertura Nacional</span>
            </div>
            <div className="trust-item">
              <Flame size={14} className="trust-icon-inline text-red" />
              <span>Soporte 24/7</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Spec glass panel */}
        <div className="hero-right" aria-hidden="false">
          <div className="spec-panel">
            {/* Panel header */}
            <div className="spec-panel-header">
              <span className="spec-panel-dot spec-panel-dot--green" />
              <span className="spec-panel-dot spec-panel-dot--yellow" />
              <span className="spec-panel-dot spec-panel-dot--red" />
              <span className="spec-panel-label">Líneas de Servicio</span>
            </div>

            {/* Pillar rows */}
            <div className="spec-pillar-list">
              {pillars.map((p, i) => (
                <button
                  key={i}
                  className="spec-pillar-row"
                  style={{ '--pillar-color': p.color } as React.CSSProperties}
                  onClick={() => onNavigate('services')}
                  aria-label={p.label}
                >
                  <span className="spec-pillar-icon" style={{ color: p.color }}>
                    {p.icon}
                  </span>
                  <div className="spec-pillar-text">
                    <span className="spec-pillar-name">{p.label}</span>
                    <span className="spec-pillar-desc">{p.desc}</span>
                  </div>
                  <ArrowUpRight size={14} className="spec-pillar-arrow" />
                </button>
              ))}
            </div>

            {/* Certification badges */}
            <div className="spec-cert-row">
              {certBadges.map((b, i) => (
                <div key={i} className="cert-badge">
                  <span className="cert-badge-label">{b.label}</span>
                  <span className="cert-badge-sub">{b.sub}</span>
                </div>
              ))}
            </div>

            {/* Active status */}
            <div className="spec-status-bar">
              <span className="status-pulse" />
              <span className="status-text">Sistema operativo — Respuesta inmediata</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
