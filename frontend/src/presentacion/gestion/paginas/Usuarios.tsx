import { useCallback, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { supabase, formatoFecha, mensajeErrorBD, type RolUsuario, type UsuarioLista } from '../../../datos/supabase';
import {
  validarNombre,
  validarFormatoCorreo,
  comprobarCorreoExiste,
  validarContrasena,
} from '../../../negocio/validaciones';
import { Aviso, Badge, Boton, Campo, Cargando, Modal, Pagina, Vacio } from '../ui';

const ROLES: RolUsuario[] = ['admin', 'supervisor', 'secretaria'];

export function Usuarios() {
  const [lista, setLista] = useState<UsuarioLista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [accion, setAccion] = useState<string | null>(null);

  const [abierto, setAbierto] = useState(false);
  const [correo, setCorreo] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<RolUsuario>('secretaria');
  const [clave, setClave] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('listar_usuarios');
    if (err) setError(mensajeErrorBD(err));
    setLista((data as UsuarioLista[]) || []);
    setCargando(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const abrirNuevo = () => {
    setCorreo('');
    setNombre('');
    setRol('secretaria');
    setClave('');
    setFormError(null);
    setAbierto(true);
  };

  const crear = async () => {
    setFormError(null);

    // 1. Nombre: no puede contener números
    const resNom = validarNombre(nombre, true);
    if (!resNom.valido) return setFormError(resNom.error || 'Nombre inválido.');

    // 2. Correo: formato y comprobación de existencia
    const resCor = validarFormatoCorreo(correo, true);
    if (!resCor.valido) return setFormError(resCor.error || 'Correo inválido.');

    const resExiste = await comprobarCorreoExiste(correo);
    if (!resExiste.valido) return setFormError(resExiste.error || 'El correo no existe.');

    // 3. Contraseña: requisitos de seguridad
    const resClave = validarContrasena(clave);
    if (!resClave.valido) return setFormError(resClave.error || 'Contraseña insegura.');

    setGuardando(true);
    const { data, error: err } = await supabase.functions.invoke('usuarios', {
      body: { accion: 'crear', correo: correo.trim().toLowerCase(), nombre: nombre.trim(), rol, clave },
    });
    setGuardando(false);
    if (err || (data as { error?: string })?.error) {
      setFormError((data as { error?: string })?.error || mensajeErrorBD(err));
      return;
    }
    setAbierto(false);
    setAviso(`Usuario ${correo.trim()} creado con rol ${rol}.`);
    await cargar();
  };

  const cambiarRol = async (u: UsuarioLista, nuevo: RolUsuario) => {
    setAccion(u.id);
    const { error: err } = await supabase.from('perfiles').update({ rol: nuevo }).eq('id', u.id);
    setAccion(null);
    if (err) setError(mensajeErrorBD(err));
    else await cargar();
  };

  const alternarActivo = async (u: UsuarioLista) => {
    setAccion(u.id);
    const { error: err } = await supabase.from('perfiles').update({ activo: !u.activo }).eq('id', u.id);
    setAccion(null);
    if (err) setError(mensajeErrorBD(err));
    else await cargar();
  };

  return (
    <Pagina
      titulo="Usuarios y roles"
      descripcion="Crear usuario, asignar rol y activar/desactivar. La creación usa una Edge Function con service_role (nunca el navegador)."
      acciones={
        <Boton onClick={abrirNuevo}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <UserPlus size={15} /> Invitar usuario
          </span>
        </Boton>
      }
    >
      <Aviso tipo="error">{error}</Aviso>
      <Aviso tipo="ok">{aviso}</Aviso>

      <div className="g-tarjeta">
        {cargando ? (
          <Cargando />
        ) : lista.length === 0 ? (
          <Vacio />
        ) : (
          <div className="g-tabla-wrap">
            <table className="g-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Último acceso</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                    <td>{u.correo || '—'}</td>
                    <td>
                      <select
                        className="g-select"
                        value={u.rol}
                        disabled={accion === u.id}
                        onChange={(e) => void cambiarRol(u, e.target.value as RolUsuario)}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td>{u.ultimo_acceso ? formatoFecha(u.ultimo_acceso) : 'Nunca'}</td>
                    <td><Badge valor={u.activo ? 'activo' : 'inactivo'} /></td>
                    <td>
                      <button className="g-btn g-btn-fantasma g-btn-mini" disabled={accion === u.id} onClick={() => void alternarActivo(u)}>
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {abierto && (
        <Modal titulo="Invitar usuario" onCerrar={() => setAbierto(false)}>
          <Aviso tipo="error">{formError}</Aviso>
          <div className="g-grid-2">
            <Campo label="Nombre">
              <input className="g-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Campo>
            <Campo label="Rol">
              <select className="g-select" value={rol} onChange={(e) => setRol(e.target.value as RolUsuario)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo label="Correo">
            <input className="g-input" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </Campo>
          <Campo label="Contraseña temporal">
            <input className="g-input" type="text" value={clave} onChange={(e) => setClave(e.target.value)} />
          </Campo>
          <p className="g-descripcion" style={{ fontSize: 12 }}>
            Comparte la contraseña temporal; el usuario podrá cambiarla con “¿Olvidaste tu contraseña?”.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Boton variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton>
            <Boton onClick={() => void crear()} disabled={guardando}>{guardando ? 'Creando…' : 'Crear usuario'}</Boton>
          </div>
        </Modal>
      )}
    </Pagina>
  );
}
