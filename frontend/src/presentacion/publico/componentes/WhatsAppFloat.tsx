import React, { useState } from 'react';
import { MessageCircle, X, ChevronDown } from 'lucide-react';
import { useThrottledScroll } from '../hooks/useThrottle';
import { openWhatsApp } from '../../../externos/whatsapp';

const QUICK_OPTIONS = [
  { label: 'Cotizar Electricidad', msg: 'Hola ROAS Ingenieros, quiero una cotización para un proyecto de electricidad general.' },
  { label: 'Cotizar Seguridad', msg: 'Hola ROAS Ingenieros, quiero una cotización para seguridad electrónica.' },
  { label: 'Cotizar Pozos a Tierra', msg: 'Hola ROAS Ingenieros, quiero una cotización para instalación de pozo a tierra.' },
  { label: 'Cotizar Torres', msg: 'Hola ROAS Ingenieros, quiero una cotización para torres de pararrayos o comunicación.' },
  { label: 'Hablar con Ingeniero', msg: 'Hola ROAS Ingenieros, tengo una consulta técnica y quisiera hablar con un ingeniero.' },
];

export const WhatsAppFloat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useThrottledScroll((scrollY) => {
    setIsVisible(scrollY > 600);
  });

  const handleOption = (msg: string) => {
    openWhatsApp(msg);
    setIsOpen(false);
  };

  return (
    <div className={`whatsapp-float ${isVisible ? 'wf-visible' : ''}`}>
      {/* Quick options panel */}
      <div className={`wf-panel ${isOpen ? 'wf-panel-open' : ''}`}>
        <div className="wf-panel-header">
          <MessageCircle size={20} />
          <span>¿En qué podemos ayudarte?</span>
          <button className="wf-panel-close" onClick={() => setIsOpen(false)}>
            <X size={16} />
          </button>
        </div>
        <div className="wf-panel-body">
          {QUICK_OPTIONS.map((opt, i) => (
            <button
              key={i}
              className="wf-option-btn"
              onClick={() => handleOption(opt.msg)}
            >
              <span>{opt.label}</span>
              <ChevronDown size={14} className="wf-option-arrow" />
            </button>
          ))}
        </div>
        <div className="wf-panel-footer">
          <a
            href="https://wa.me/51932101907"
            target="_blank"
            rel="noopener noreferrer"
            className="wf-direct-link"
          >
            Abrir WhatsApp directo &rarr;
          </a>
        </div>
      </div>

      {/* Main floating button */}
      <button
        className="wf-main-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="WhatsApp"
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
      </button>
    </div>
  );
};
