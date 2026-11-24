import React from 'react';
import { ArrowUp, Phone, MapPin, Award } from 'lucide-react';
import { Reveal, StaggerReveal } from './Reveal';
import logoSrc from '../../../assets/logo-roas-ingenieros.png';
import type { ScreenType } from '../../../App';
import './Footer.css';

interface FooterProps {
  onNavigate: (screen: ScreenType) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer" id="compliance">
      {/* Footer Top Call to Action Banner */}
      <Reveal>
        <div className="footer-top-banner">
          <div className="banner-container">
            <div className="banner-text">
              <h2>¿Listo para iniciar tu proyecto de ingeniería?</h2>
              <p>Consultoría técnica, diseño de planos y ejecución con garantía y firma de ingenieros colegiados.</p>
            </div>
            <a 
              href="#contact" 
              className="banner-btn"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('contact');
              }}
            >
              <span>Solicitar Cotización</span>
              <span className="banner-btn-icon">
                <ArrowUp size={14} style={{ transform: 'rotate(45deg)' }} />
              </span>
            </a>
          </div>
        </div>
      </Reveal>

      {/* Main Footer Content */}
      <Reveal delay={150}>
      <div className="footer-main">
        <div className="footer-container">
          <StaggerReveal staggerDelay={100} direction="up" className="footer-grid">
            {/* Brand Column */}
            <div className="footer-col brand-col">
              <div 
                className="footer-logo"
                style={{ cursor: 'pointer' }}
                onClick={() => onNavigate('home')}
              >
                <img 
                  src={logoSrc} 
                  alt="ROAS Ingenieros" 
                  className="footer-logo-img" 
                />
                <div className="footer-logo-text">
                  <span className="logo-title">ROAS</span>
                  <span className="logo-subtitle">INGENIEROS</span>
                </div>
              </div>
              <p className="brand-description">
                Empresa de ingeniería eléctrica especializada en instalaciones domiciliarias e industriales, 
                seguridad electrónica, pozos a tierra y torres de pararrayos y comunicación. 
                Comprometidos con la calidad, seguridad y cumplimiento normativo.
              </p>
              <div className="compliance-stamp-row">
                <div className="compliance-stamp" title="Habilitado Colegio de Ingenieros del Perú">
                  <Award size={14} />
                  <span>Ing. Habilitados CIP</span>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="footer-col links-col">
              <h3>Mapa del Sitio</h3>
              <ul className="footer-links">
                <li><a href="#home" onClick={(e) => { e.preventDefault(); onNavigate('home'); }}>Inicio</a></li>
                <li><a href="#services" onClick={(e) => { e.preventDefault(); onNavigate('services'); }}>Servicios</a></li>
                <li><a href="#catalog" onClick={(e) => { e.preventDefault(); onNavigate('catalog'); }}>Productos</a></li>
                <li><a href="#contact" onClick={(e) => { e.preventDefault(); onNavigate('contact'); }}>Contacto</a></li>
              </ul>
            </div>

            {/* Services Links */}
            <div className="footer-col links-col">
              <h3>Líneas de Negocio</h3>
              <ul className="footer-links">
                <li><a href="#services" onClick={(e) => { e.preventDefault(); onNavigate('services'); }}>Electricidad General</a></li>
                <li><a href="#services" onClick={(e) => { e.preventDefault(); onNavigate('services'); }}>Seguridad Electrónica</a></li>
                <li><a href="#services" onClick={(e) => { e.preventDefault(); onNavigate('services'); }}>Pozos a Tierra</a></li>
                <li><a href="#services" onClick={(e) => { e.preventDefault(); onNavigate('services'); }}>Torres de Pararrayos</a></li>
              </ul>
            </div>

            {/* Contact Column */}
            <div className="footer-col support-col">
              <h3>Central de Proyectos</h3>
              <div className="support-details">
                <div className="support-item">
                  <Phone size={16} style={{ color: '#3b82f6' }} />
                  <div>
                    <p className="support-label">WhatsApp / Celular</p>
                    <p className="support-val"><a href="tel:+51932101907">932 101 907</a></p>
                  </div>
                </div>

                <div className="support-item">
                  <MapPin size={16} style={{ color: '#3b82f6' }} />
                  <div>
                    <p className="support-label">Cobertura</p>
                    <p className="support-val">Lima y Provincias (Todo el Perú)</p>
                  </div>
                </div>
              </div>
            </div>
          </StaggerReveal>
        </div>
      </div>
      </Reveal>

      {/* Footer Bottom Bar */}
      <div className="footer-bottom">
        <div className="footer-container bottom-container">
          <p className="copyright">
            &copy; {currentYear} <strong>ROAS Ingenieros S.A.C.</strong> Todos los derechos reservados.
          </p>
          <button 
            type="button" 
            className="back-to-top-btn" 
            onClick={scrollToTop} 
            aria-label="Volver al inicio"
          >
            <span>Subir</span>
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </footer>
  );
};

