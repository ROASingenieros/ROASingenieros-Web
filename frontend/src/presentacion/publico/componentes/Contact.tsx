import React, { useState } from 'react';
import { Phone, Mail, MapPin, Clock, CheckCircle, MessageCircle } from 'lucide-react';
import { ParallaxItem } from './ParallaxItem';
import { openWhatsApp } from '../../../externos/whatsapp';
import { registrarSolicitudWeb } from '../../../datos/supabase';
import {
  validarNombre,
  validarTelefono,
  validarFormatoCorreo,
  comprobarCorreoExiste,
} from '../../../negocio/validaciones';
import './Contact.css';

interface FormState {
  fullName: string;
  companyName: string;
  phone: string;
  email: string;
  serviceType: string;
  message: string;
}

interface FormErrors {
  fullName?: string;
  phone?: string;
  email?: string;
}

export const Contact: React.FC = () => {
  const [formData, setFormData] = useState<FormState>({
    fullName: '',
    companyName: '',
    phone: '',
    email: '',
    serviceType: 'electricidad',
    message: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [verificando, setVerificando] = useState<boolean>(false);

  const validateForm = async (): Promise<boolean> => {
    const tempErrors: FormErrors = {};
    let isValid = true;

    // 1. Nombre: no puede contener números
    const resNombre = validarNombre(formData.fullName, true);
    if (!resNombre.valido) {
      tempErrors.fullName = resNombre.error;
      isValid = false;
    }

    // 2. Teléfono: no puede contener letras (celular peruano válido)
    const resTelefono = validarTelefono(formData.phone, true, true);
    if (!resTelefono.valido) {
      tempErrors.phone = resTelefono.error;
      isValid = false;
    }

    // 3. Correo: formato y comprobación de existencia
    const resFormatoCorreo = validarFormatoCorreo(formData.email, true);
    if (!resFormatoCorreo.valido) {
      tempErrors.email = resFormatoCorreo.error;
      isValid = false;
    } else {
      // Comprobar existencia real del correo / dominio
      setVerificando(true);
      const resExiste = await comprobarCorreoExiste(formData.email);
      setVerificando(false);
      if (!resExiste.valido) {
        tempErrors.email = resExiste.error;
        isValid = false;
      }
    }

    setErrors(tempErrors);
    return isValid;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Validación inmediata en tiempo real para alertar al usuario
    if (name === 'fullName') {
      if (/\d/.test(value)) {
        setErrors((prev) => ({ ...prev, fullName: 'El nombre no puede contener números.' }));
      } else if (errors.fullName) {
        setErrors((prev) => ({ ...prev, fullName: undefined }));
      }
    } else if (name === 'phone') {
      if (/[a-zA-Z]/.test(value)) {
        setErrors((prev) => ({ ...prev, phone: 'El teléfono no puede contener letras.' }));
      } else if (errors.phone) {
        setErrors((prev) => ({ ...prev, phone: undefined }));
      }
    } else if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleEmailBlur = async () => {
    if (!formData.email.trim()) return;
    const resFormato = validarFormatoCorreo(formData.email, true);
    if (!resFormato.valido) {
      setErrors((prev) => ({ ...prev, email: resFormato.error }));
      return;
    }
    // Verificar si el dominio existe
    const resExiste = await comprobarCorreoExiste(formData.email);
    if (!resExiste.valido) {
      setErrors((prev) => ({ ...prev, email: resExiste.error }));
    }
  };

  // Send via WhatsApp instead of email
  const handleWhatsAppSubmit = async () => {
    const esValido = await validateForm();
    if (!esValido) return;

    const message = `*Nueva Cotización - ROAS Ingenieros*
    
*Nombre:* ${formData.fullName}
*Empresa:* ${formData.companyName || 'No especificada'}
*Teléfono:* ${formData.phone}
*Email:* ${formData.email}
*Servicio:* ${formData.serviceType}

*Mensaje:*
${formData.message || 'No especificado'}`;

    // Lead en la bandeja "Solicitudes web" del gerente (no bloquea el envío).
    void registrarSolicitudWeb(formData.fullName, formData.phone, [
      { name: `Consulta de servicio: ${formData.serviceType}`, qty: 1 },
    ]);

    openWhatsApp(message);
    setIsSubmitted(true);
    setFormData({
      fullName: '',
      companyName: '',
      phone: '',
      email: '',
      serviceType: 'electricidad',
      message: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleWhatsAppSubmit();
  };

  return (
    <section id="contact" className="contact-section">
      <div className="contact-container">
        <div className="section-header">
          <div className="section-eyebrow">
            <span className="eyebrow-pulse"></span>
            <span>ATENCIÓN TÉCNICA & COTIZACIONES</span>
          </div>
          <h1 className="section-title">Cotiza tu Proyecto</h1>
          <p className="section-description">
            Cuéntanos los requerimientos de tu empresa o residencia y un ingeniero colegiado especialista se pondrá en contacto para brindarte asesoría y presupuesto.
          </p>
        </div>

        <div className="contact-grid">
          {/* Info Side */}
          <ParallaxItem speed={0.08} clamp={20}>
          <div className="contact-info-panel">
            <h2>Atención Directa</h2>
            <p className="panel-subtitle">
              Soporte técnico y coordinación de proyectos de ingeniería eléctrica a nivel nacional.
            </p>

            <div className="info-items-list">
              <div className="info-item">
                <div className="info-icon-wrapper">
                  <Phone size={18} />
                </div>
                <div className="info-text">
                  <h3>Central Telefónica / WhatsApp</h3>
                  <p><a href="tel:+51932101907">932 101 907</a></p>
                </div>
              </div>

              <div className="info-item">
                <div className="info-icon-wrapper">
                  <Mail size={18} />
                </div>
                <div className="info-text">
                  <h3>Correo de Proyectos</h3>
                  <p><a href="mailto:proyectos@roasingenieros.com">proyectos@roasingenieros.com</a></p>
                </div>
              </div>

              <div className="info-item">
                <div className="info-icon-wrapper">
                  <MapPin size={18} />
                </div>
                <div className="info-text">
                  <h3>Sede Central</h3>
                  <p>Santiago de Surco, Lima, Perú</p>
                </div>
              </div>

              <div className="info-item">
                <div className="info-icon-wrapper">
                  <Clock size={18} />
                </div>
                <div className="info-text">
                  <h3>Horario de Atención</h3>
                  <p>Lunes a Viernes: 9:00 am – 6:00 pm</p>
                  <p>Sábados: 9:00 am – 1:00 pm</p>
                </div>
              </div>
            </div>

            {/* Direct WhatsApp link */}
            <div className="whatsapp-direct-card">
              <a 
                href="https://wa.me/51932101907" 
                target="_blank" 
                rel="noopener noreferrer"
                className="wp-direct-pill-btn"
              >
                <span className="wp-direct-icon"><MessageCircle size={16} /></span>
                <span>Chatear directamente por WhatsApp</span>
              </a>
            </div>

            {/* CIP credibility */}
            <div className="cip-advisory">
              <span className="cip-badge">CIP</span>
              <p>
                Proyectos certificados con firma de <strong>Ingenieros Colegiados y Habilitados</strong> ante el Colegio de Ingenieros del Perú.
              </p>
            </div>
          </div>
          </ParallaxItem>

          {/* Form Side — parallax hacia abajo para contraste */}
          <ParallaxItem speed={0.07} clamp={20} direction="down">
          <div className="contact-form-panel glass-panel" style={{ transitionDelay: '150ms' }}>
            {isSubmitted ? (
              <div className="form-success-wrapper">
                <CheckCircle size={64} className="success-icon" />
                <h2>¡Solicitud Enviada!</h2>
                <p>
                  Gracias por contactar a <strong>ROAS Ingenieros</strong>. 
                  Tu mensaje ha sido recibido y un ingeniero te contactará a la brevedad.
                </p>
                <div className="success-advisory">
                  <p>
                    <strong>¿Qué sigue?</strong> Un ingeniero especialista analizará tu caso y te contactará 
                    en menos de <strong>2 horas</strong> vía WhatsApp para afinar los detalles de tu cotización.
                  </p>
                </div>
                <button 
                  type="button" 
                  className="success-btn" 
                  onClick={() => setIsSubmitted(false)}
                >
                  Enviar otro mensaje
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="contact-form" noValidate>
                <h2>Solicitud de Cotización</h2>
                <p className="form-desc">Completa tus datos y recibe una respuesta rápida de nuestro equipo técnico.</p>

                <div className="form-group">
                  <label htmlFor="fullName" className="form-label">Nombre Completo *</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className={`form-input ${errors.fullName ? 'input-error' : ''}`}
                    placeholder="Ej. Carlos Mendoza"
                    required
                  />
                  {errors.fullName && <span className="error-message">{errors.fullName}</span>}
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label htmlFor="companyName" className="form-label">Empresa / Negocio</label>
                    <input
                      type="text"
                      id="companyName"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleInputChange}
                      className="form-input"
                      placeholder="Ej. Inversiones ROAS S.A.C."
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label htmlFor="phone" className="form-label">Celular / WhatsApp *</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className={`form-input ${errors.phone ? 'input-error' : ''}`}
                      placeholder="Ej. 987654321"
                      required
                    />
                    {errors.phone && <span className="error-message">{errors.phone}</span>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label htmlFor="email" className="form-label">Correo Electrónico *</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      onBlur={() => void handleEmailBlur()}
                      className={`form-input ${errors.email ? 'input-error' : ''}`}
                      placeholder="carlos@correo.com"
                      required
                    />
                    {errors.email && <span className="error-message">{errors.email}</span>}
                  </div>

                  <div className="form-group flex-1">
                    <label htmlFor="serviceType" className="form-label">Servicio Requerido</label>
                    <select
                      id="serviceType"
                      name="serviceType"
                      value={formData.serviceType}
                      onChange={handleInputChange}
                      className="form-input select-input"
                    >
                      <option value="electricidad">Electricidad General</option>
                      <option value="seguridad">Seguridad Electrónica</option>
                      <option value="pozos">Pozos a Tierra</option>
                      <option value="torres">Torres de Pararrayos y Comunicación</option>
                      <option value="domotica">Domótica (Próximamente)</option>
                      <option value="otros">Otros Proyectos</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="form-message" className="form-label">Detalles del Proyecto / Mensaje</label>
                  <textarea
                    id="form-message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    className="form-input textarea-input"
                    rows={4}
                    placeholder="Cuéntanos sobre tu proyecto: tipo de instalación, área aproximada, ubicación, etc."
                  ></textarea>
                </div>

                <button type="submit" className="form-submit-btn" disabled={verificando}>
                  <span className="form-submit-icon-circle">
                    <MessageCircle size={15} />
                  </span>
                  <span>{verificando ? 'Comprobando datos…' : 'Enviar Cotización por WhatsApp'}</span>
                </button>
                <p className="form-wp-note">
                  Se abrirá WhatsApp con tus especificaciones listas para confirmación inmediata.
                </p>
              </form>
            )}
          </div>
          </ParallaxItem>
        </div>
      </div>
    </section>
  );
};
