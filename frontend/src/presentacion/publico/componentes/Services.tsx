import React, { useState } from 'react';
import { Zap, Camera, Cpu, TowerControl, ChevronDown, ChevronUp, CheckCircle2, Home, Building2, Factory, Wifi, Shield, Bell, Fence, Monitor, Gauge, Ruler, ClipboardCheck, Radio } from 'lucide-react';
import { ParallaxItem } from './ParallaxItem';
import './Services.css';

interface ServiceItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  shortDesc: string;
  subServices: { name: string; icon: React.ReactNode; items: string[] }[];
  tag: string;
  tagColor: string;
}

export const Services: React.FC = () => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedCard(expandedCard === id ? null : id);
  };

  const servicesData: ServiceItem[] = [
    {
      id: 'electricidad',
      icon: <Zap size={28} />,
      title: 'Electricidad General',
      shortDesc: 'Soluciones completas en instalaciones eléctricas domiciliarias e industriales, tableros eléctricos, automatización y domótica.',
      subServices: [
        {
          name: 'Electricidad Domiciliaria',
          icon: <Home size={18} />,
          items: [
            'Instalaciones eléctricas residenciales completas',
            'Tableros eléctricos de distribución',
            'Puntos de luz, tomacorrientes y conmutación',
            'Sistemas de puesta a tierra domiciliarios',
            'Diagnóstico y reparación de circuitos'
          ]
        },
        {
          name: 'Electricidad Industrial',
          icon: <Factory size={18} />,
          items: [
            'Instalaciones eléctricas industriales trifásicas',
            'Tableros eléctricos de fuerza y control',
            'Automatización de procesos industriales (PLC)',
            'Sistemas de compensación de energía reactiva',
            'Mantenimiento eléctrico industrial'
          ]
        },
        {
          name: 'Domótica (Próximamente)',
          icon: <Wifi size={18} />,
          items: [
            'Automatización de casas inteligentes',
            'Control de iluminación y climatización',
            'Sistemas de seguridad integrados',
            'Gestión energética inteligente',
            'Integración con asistentes de voz'
          ]
        }
      ],
      tag: 'Instalación • Mantenimiento • Automatización',
      tagColor: '#3b82f6'
    },
    {
      id: 'seguridad-electronica',
      icon: <Camera size={28} />,
      title: 'Seguridad Electrónica',
      shortDesc: 'Protege tu hogar o negocio con sistemas de seguridad electrónica de última generación: alarmas, cercos, barreras y automatización.',
      subServices: [
        {
          name: 'Alarmas Contra Incendio',
          icon: <Bell size={18} />,
          items: [
            'Centrales de alarma contra incendio',
            'Detectores de humo fotoeléctricos y térmicos',
            'Estaciones manuales y sirenas estroboscópicas',
            'Sistemas de rociadores y supresión',
            'Cumplimiento de norma NFPA'
          ]
        },
        {
          name: 'Alarmas Domiciliarias',
          icon: <Shield size={18} />,
          items: [
            'Alarmas de intrusión perimetral',
            'Sensores de apertura (puertas/ventanas)',
            'Sensores de movimiento volumétricos',
            'Panel de control y monitoreo 24/7',
            'Notificaciones al celular en tiempo real'
          ]
        },
        {
          name: 'Cercos Eléctricos y Barreras',
          icon: <Fence size={18} />,
          items: [
            'Cercos eléctricos perimetrales',
            'Barreras electrónicas infrarrojas',
            'Sensores de vibración en muros',
            'Vallas electrificadas para industrias',
            'Integración con sistemas CCTV'
          ]
        },
        {
          name: 'Automatización de Procesos',
          icon: <Monitor size={18} />,
          items: [
            'Control de accesos biométricos',
            'Sistemas de CCTV y videovigilancia',
            'Control de iluminación automatizada',
            'Sistemas de climatización inteligente',
            'Integración de sistemas BMS'
          ]
        }
      ],
      tag: 'Alarmas • CCTV • Cercos • Automatización',
      tagColor: '#3b82f6'
    },
    {
      id: 'pozos-tierra',
      icon: <Cpu size={28} />,
      title: 'Pozos a Tierra',
      shortDesc: 'Sistemas de puesta a tierra certificados para proteger equipos y personas. Instalación, medición, mantenimiento y certificación.',
      subServices: [
        {
          name: 'Instalación de Pozos a Tierra',
          icon: <Ruler size={18} />,
          items: [
            'Construcción de pozos tipo electrodo vertical',
            'Sistemas de malla de tierra',
            'Conexión a tableros generales',
            'Materiales certificados (varillas copperweld, soldadura exotérmica)',
            'Cumplimiento de norma IEC y CNE'
          ]
        },
        {
          name: 'Mantenimiento y Medición',
          icon: <Gauge size={18} />,
          items: [
            'Medición de resistencia de puesta a tierra (telurómetro)',
            'Mantenimiento correctivo y preventivo',
            'Reducción de resistencia con tratamientos químicos',
            'Registro histórico de mediciones',
            'Informe técnico detallado'
          ]
        },
        {
          name: 'Certificaciones',
          icon: <ClipboardCheck size={18} />,
          items: [
            'Certificación de sistemas de puesta a tierra',
            'Firma de ingeniero colegiado CIP',
            'Informes para Defensa Civil e INDECI',
            'Protocolos de prueba y medición',
            'Validez ante entidades fiscalizadoras'
          ]
        }
      ],
      tag: 'Instalación • Medición • Mantenimiento • Certificación',
      tagColor: '#3b82f6'
    },
    {
      id: 'torres',
      icon: <TowerControl size={28} />,
      title: 'Torres de Pararrayos y Comunicación',
      shortDesc: 'Diseño, suministro e instalación de torres de pararrayos y torres de comunicación para protección y conectividad.',
      subServices: [
        {
          name: 'Torres de Pararrayos',
          icon: <Zap size={18} />,
          items: [
            'Pararrayos tipo punta Franklin',
            'Pararrayos con dispositivo de cebado (PDC)',
            'Torres autosoportadas y arriostradas',
            'Sistema de bajada y puesta a tierra',
            'Protección contra descargas atmosféricas'
          ]
        },
        {
          name: 'Torres de Comunicación',
          icon: <Radio size={18} />,
          items: [
            'Torres para telecomunicaciones',
            'Torres para radio y microondas',
            'Mástiles y estructuras soporte',
            'Instalación de antenas y equipos',
            'Mantenimiento estructural y pintura'
          ]
        },
        {
          name: 'Suministro de Materiales',
          icon: <Building2 size={18} />,
          items: [
            'Venta de torres y estructuras metálicas',
            'Suministro de pararrayos y accesorios',
            'Cables, conectores y herrajes',
            'Sistemas de fijación y anclaje',
            'Materiales para puesta a tierra'
          ]
        }
      ],
      tag: 'Pararrayos • Torres • Suministro • Instalación',
      tagColor: '#3b82f6'
    }
  ];

  return (
    <section id="services" className="services-section">
      <div className="services-container">
        <div className="section-header">
          <div className="section-eyebrow">
            <span className="eyebrow-pulse"></span>
            <span>LÍNEAS DE INGENIERÍA</span>
          </div>
          <h1 className="section-title">Servicios de Ingeniería Especializada</h1>
          <p className="section-description">
            Soluciones integrales certificadas en ingeniería eléctrica, seguridad electrónica y sistemas de puesta a tierra, ejecutadas bajo normativas CNE, NFPA y respaldo de ingenieros colegiados CIP.
          </p>
        </div>

        <div className="services-bento-grid">
          {servicesData.map((service, sIdx) => {
            const isExpanded = expandedCard === service.id;
            const isHeroCard = sIdx === 0;
            const speeds = [0.1, 0.06, 0.12, 0.08];
            return (
              <ParallaxItem 
                key={service.id}
                as="div"
                className={`service-bento-card ${isHeroCard ? 'bento-card-hero' : ''} ${isExpanded ? 'card-expanded' : ''}`}
                speed={speeds[sIdx % speeds.length]}
                clamp={25}
                onClick={() => toggleExpand(service.id)}
                role="button"
                aria-expanded={isExpanded}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleExpand(service.id);
                  }
                }}
              >
                <div className="bento-card-inner">
                  <div className="card-top">
                    <div className="card-icon-wrapper" style={{ borderColor: `${service.tagColor}40`, color: service.tagColor }}>
                      {service.icon}
                    </div>
                    <div className="card-title-group">
                      <h3 className="card-title">{service.title}</h3>
                      <div className="service-tag" style={{ borderColor: `${service.tagColor}30`, color: service.tagColor }}>
                        {service.tag}
                      </div>
                    </div>
                  </div>

                  <p className="card-short-desc">{service.shortDesc}</p>

                  <div className="expand-trigger">
                    <span>{isExpanded ? 'Ocultar detalles técnicos' : 'Ver especificaciones y servicios'}</span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>

                  <div className={`card-details-wrapper ${isExpanded ? 'show-details' : ''}`}>
                    {service.subServices.map((sub, idx) => (
                      <div key={idx} className="sub-service-block">
                        <h4 className="sub-service-title">
                          {sub.icon}
                          <span>{sub.name}</span>
                        </h4>
                        <ul className="sub-service-list">
                          {sub.items.map((item, i) => (
                            <li key={i} className="sub-service-item">
                              <CheckCircle2 size={14} className="item-check" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </ParallaxItem>
            );
          })}
        </div>
      </div>
    </section>
  );
};
