import { useState } from 'react';
import { Lock, Mail } from 'lucide-react';
import { supabase } from '../../../datos/supabase';
import { esCorreoValido } from '../../../negocio/texto';
import { useAuthGestion } from '../AuthContext';
import { Aviso, Boton, Campo } from '../ui';

/**
 * Login del panel de gestión. Los usuarios los crea el Gerente desde
 * "Usuarios y roles" (Edge Function con service_role); el registro público
 * está desactivado en Supabase Auth.
 */
export function Login() {
  const { entrar } = useAuthGestion();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!esCorreoValido(correo)) {
      setError('Ingresa un formato de correo válido (ejemplo: usuario@dominio.com).');
      return;
    }
    if (!clave.trim()) {
      setError('Ingresa tu contraseña.');
      return;
    }
    setEnviando(true);
    const err = await entrar(correo.trim(), clave);
    setEnviando(false);
    if (err) setError(err);
  };

  const recuperar = async () => {
    setError(null);
    setOk(null);
    if (!correo.trim()) {
      setError('Escribe tu correo primero para recibir el enlace de recuperación.');
      return;
    }
    if (!esCorreoValido(correo)) {
      setError('Ese correo no es válido (ejemplo: nombre@dominio.com).');
      return;
    }
    setEnviando(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(correo.trim(), {
      redirectTo: window.location.origin + window.location.pathname + '#/gestion',
    });
    setEnviando(false);
    if (err) setError(err.message);
    else setOk('Si el correo existe, revisa tu bandeja para restablecer la contraseña.');
  };

  return (
    <div className="g-login">
      <form className="g-login-caja" onSubmit={onSubmit}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div className="g-marca-titulo" style={{ fontSize: 22 }}>ROAS Ingenieros</div>
          <div className="g-marca-sub">Panel de gestión</div>
        </div>

        <Aviso tipo="error">{error}</Aviso>
        <Aviso tipo="ok">{ok}</Aviso>

        <Campo label="Correo">
          <div style={{ position: 'relative' }}>
            <Mail size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--text-muted)' }} />
            <input
              className="g-input"
              style={{ paddingLeft: 34, width: '100%' }}
              type="email"
              autoComplete="username"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
          </div>
        </Campo>

        <Campo label="Contraseña">
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--text-muted)' }} />
            <input
              className="g-input"
              style={{ paddingLeft: 34, width: '100%' }}
              type="password"
              autoComplete="current-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              required
            />
          </div>
        </Campo>

        <Boton tipo="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Boton>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button
            type="button"
            className="g-btn g-btn-fantasma g-btn-mini"
            onClick={() => void recuperar()}
            disabled={enviando}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <p className="g-descripcion" style={{ textAlign: 'center', marginTop: 18, fontSize: 12 }}>
          Solo personal autorizado. Un usuario inactivo no puede ingresar.
        </p>
      </form>
    </div>
  );
}
