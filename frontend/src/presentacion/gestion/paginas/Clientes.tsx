import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  supabase,
  formatoFecha,
  formatoSoles,
  mensajeErrorBD,
  type Cliente,
  type TipoDocumento,
} from '../../../datos/supabase';
import {
  validarNombre,
  validarApellido,
  validarTelefono,
  validarFormatoCorreo,
  comprobarCorreoExiste,
  validarDocumentoIdentidad,
} from '../../../negocio/validaciones';
import { useAuthGestion } from '../AuthContext';
import { Aviso, Badge, Boton, Campo, Cargando, Modal, Pagina, Vacio } from '../ui';

interface Ubicacion {
  id: number;
  departamento: string;
  provincia: string;
  distrito: string;
}

interface Historial {
  cotizaciones: { id: number; num_cotizacion: string; estado: string; total: number; fecha_emision: string }[];
  ventas: { id: number; num_venta: string; estado: string; total: number; fecha: string }[];
}

interface FormState {
  id_tipo_documento: string;
  num_documento: string;
  nombre_razon_social: string;
  apellidos: string;
  telefono: string;
  correo: string;
  direccion: string;
  id_ubicacion: string;
  activo: boolean;
}

const VACIO: FormState = {
  id_tipo_documento: '',
  num_documento: '',
  nombre_razon_social: '',
  apellidos: '',
  telefono: '',
  correo: '',
  direccion: '',
  id_ubicacion: '',
  activo: true,
};

export function Clientes() {
  const { puede } = useAuthGestion();
  const puedeEscribir = puede('admin', 'supervisor', 'secretaria');

  const [lista, setLista] = useState<Cliente[]>([]);
  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<FormState>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [historialDe, setHistorialDe] = useState<Cliente | null>(null);
  const [historial, setHistorial] = useState<Historial | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const [c, t, u] = await Promise.all([
      supabase
        .from('clientes')
        .select('*, tipo_documento:id_tipo_documento(id,descripcion,codigo_sunat)')
        .order('nombre_razon_social'),
      supabase.from('tipo_documento').select('*').eq('activo', true).order('id'),
      supabase.from('ubicacion').select('*').order('departamento'),
    ]);
    if (c.error) setError(mensajeErrorBD(c.error));
    setLista((c.data as Cliente[]) || []);
    setTipos((t.data as TipoDocumento[]) || []);
    setUbicaciones((u.data as Ubicacion[]) || []);
    setCargando(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((c) =>
      `${c.nombre_razon_social} ${c.apellidos ?? ''} ${c.num_documento}`.toLowerCase().includes(q),
    );
  }, [lista, busca]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ ...VACIO, id_tipo_documento: tipos[0] ? String(tipos[0].id) : '' });
    setFormError(null);
    setAbierto(true);
  };

  const abrirEditar = (c: Cliente) => {
    setEditando(c);
    setForm({
      id_tipo_documento: String(c.id_tipo_documento),
      num_documento: c.num_documento,
      nombre_razon_social: c.nombre_razon_social,
      apellidos: c.apellidos ?? '',
      telefono: c.telefono ?? '',
      correo: c.correo ?? '',
      direccion: c.direccion ?? '',
      id_ubicacion: c.id_ubicacion ? String(c.id_ubicacion) : '',
      activo: c.activo,
    });
    setFormError(null);
    setAbierto(true);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Con DNI / carné / pasaporte el cliente es una persona natural: no hay razón
  // social; solo el RUC (código SUNAT 6) la exige.
  const tipoSeleccionado = tipos.find((t) => String(t.id) === form.id_tipo_documento);
  const esRuc = tipoSeleccionado?.codigo_sunat === '6';

  const guardar = async () => {
    setFormError(null);
    if (!form.id_tipo_documento) return setFormError('Selecciona el tipo de documento.');
    const num = form.num_documento.trim();
    const tipo = tipos.find((t) => String(t.id) === form.id_tipo_documento);

    // 1. Validar documento de identidad según SUNAT (DNI 8 dígitos, RUC 11 dígitos)
    const resDoc = validarDocumentoIdentidad(tipo?.codigo_sunat, num);
    if (!resDoc.valido) return setFormError(resDoc.error || 'Documento no válido.');

    // 2. Nombres o Razón Social
    if (esRuc) {
      if (!form.nombre_razon_social.trim()) return setFormError('La razón social es obligatoria.');
      if (form.nombre_razon_social.trim().length < 3)
        return setFormError('La razón social debe tener al menos 3 caracteres.');
    } else {
      // Persona natural: en los nombres no se puede poner números
      const resNom = validarNombre(form.nombre_razon_social, true);
      if (!resNom.valido) return setFormError(resNom.error || 'El nombre no es válido.');
    }

    // 3. Apellidos: no se pueden poner números ni caracteres especiales
    if (form.apellidos.trim()) {
      const resApe = validarApellido(form.apellidos, false);
      if (!resApe.valido) return setFormError(resApe.error || 'Apellidos inválidos.');
    }

    // 4. Teléfono: en teléfono no se pueden poner letras
    if (form.telefono.trim()) {
      const resTel = validarTelefono(form.telefono, false, false);
      if (!resTel.valido) return setFormError(resTel.error || 'Teléfono inválido.');
    }

    // 5. Correo electrónico: comprobar formato y existencia
    if (form.correo.trim()) {
      const resCor = validarFormatoCorreo(form.correo, false);
      if (!resCor.valido) return setFormError(resCor.error || 'Correo no válido.');
      const resExiste = await comprobarCorreoExiste(form.correo);
      if (!resExiste.valido) return setFormError(resExiste.error || 'El correo no existe.');
    }

    const payload = {
      id_tipo_documento: Number(form.id_tipo_documento),
      num_documento: num,
      nombre_razon_social: form.nombre_razon_social.trim(),
      apellidos: form.apellidos.trim() || null,
      telefono: form.telefono.trim() || null,
      correo: form.correo.trim().toLowerCase() || null,
      direccion: form.direccion.trim() || null,
      id_ubicacion: form.id_ubicacion ? Number(form.id_ubicacion) : null,
      activo: form.activo,
    };

    setGuardando(true);
    try {
      if (editando) {
        const { error: err } = await supabase.from('clientes').update(payload).eq('id', editando.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('clientes').insert(payload);
        if (err) throw err;
      }
      setAbierto(false);
      await cargar();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === '23505' || /duplicate key/i.test(err.message || ''))
        setFormError('Ya existe un cliente con ese tipo y número de documento.');
      else setFormError(mensajeErrorBD(e));
    } finally {
      setGuardando(false);
    }
  };

  const verHistorial = async (c: Cliente) => {
    setHistorialDe(c);
    setHistorial(null);
    const [co, ve] = await Promise.all([
      supabase
        .from('cotizaciones')
        .select('id, num_cotizacion, estado, total, fecha_emision')
        .eq('id_cliente', c.id)
        .order('fecha_emision', { ascending: false }),
      supabase
        .from('ventas')
        .select('id, num_venta, estado, total, fecha')
        .eq('id_cliente', c.id)
        .order('fecha', { ascending: false }),
    ]);
    setHistorial({
      cotizaciones: (co.data as Historial['cotizaciones']) || [],
      ventas: (ve.data as Historial['ventas']) || [],
    });
  };

  const eliminarCliente = async (c: Cliente) => {
    const nombre = `${c.nombre_razon_social}${c.apellidos ? ' ' + c.apellidos : ''}`;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente al cliente "${nombre}"?`)) {
      return;
    }
    setError(null);
    try {
      // 1. Intentar eliminar físicamente
      const { error: err } = await supabase.from('clientes').delete().eq('id', c.id);
      if (err) {
        const esFk = /foreign key|viola|en uso/i.test(err.message || '') || (err as { code?: string }).code === '23503';
        if (esFk) {
          const desactivar = window.confirm(
            `El cliente "${nombre}" no se puede eliminar físicamente porque tiene cotizaciones o ventas vinculadas.\n\n¿Deseas DESACTIVARLO para archivarlo y evitar que se use en nuevas operaciones?`
          );
          if (desactivar) {
            const { error: errDesact } = await supabase
              .from('clientes')
              .update({ activo: false })
              .eq('id', c.id);
            if (errDesact) throw errDesact;
            setAbierto(false);
            await cargar();
          }
          return;
        }
        throw err;
      }
      setAbierto(false);
      await cargar();
    } catch (e) {
      setError(mensajeErrorBD(e));
    }
  };

  return (
    <Pagina
      titulo="Clientes"
      descripcion="Documento único por tipo (DNI/RUC)."
      acciones={
        puedeEscribir ? (
          <Boton onClick={abrirNuevo}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Nuevo cliente
            </span>
          </Boton>
        ) : null
      }
    >
      <Aviso tipo="error">{error}</Aviso>

      <div className="g-tarjeta">
        <div style={{ position: 'relative', marginBottom: 14, maxWidth: 360 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--text-muted)' }} />
          <input
            className="g-input"
            style={{ paddingLeft: 34, width: '100%' }}
            placeholder="Buscar por nombre o documento…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {cargando ? (
          <Cargando />
        ) : filtrados.length === 0 ? (
          <Vacio />
        ) : (
          <div className="g-tabla-wrap">
            <table className="g-tabla">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span style={{ color: 'var(--text-muted)' }}>{c.tipo_documento?.descripcion || ''}</span>{' '}
                      {c.num_documento}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {c.nombre_razon_social}
                      {c.apellidos ? ` ${c.apellidos}` : ''}
                    </td>
                    <td>{c.telefono || c.correo || '—'}</td>
                    <td><Badge valor={c.activo ? 'activo' : 'inactivo'} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="g-btn g-btn-fantasma g-btn-mini" onClick={() => void verHistorial(c)}>
                        Historial
                      </button>
                      {puedeEscribir && (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="g-btn g-btn-fantasma g-btn-mini"
                            onClick={() => abrirEditar(c)}
                            title="Editar cliente"
                            aria-label={`Editar cliente ${c.nombre_razon_social}`}
                          >
                            <Pencil size={13} />
                          </button>
                          {' '}
                          <button
                            type="button"
                            className="g-btn g-btn-peligro g-btn-mini"
                            onClick={() => void eliminarCliente(c)}
                            title="Eliminar cliente"
                            aria-label={`Eliminar cliente ${c.nombre_razon_social}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {abierto && (
        <Modal titulo={editando ? 'Editar cliente' : 'Nuevo cliente'} onCerrar={() => setAbierto(false)}>
          <Aviso tipo="error">{formError}</Aviso>
          <div className="g-grid-2">
            <Campo label="Tipo de documento">
              <select
                className="g-select"
                value={form.id_tipo_documento}
                onChange={(e) => set('id_tipo_documento', e.target.value)}
              >
                <option value="">—</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>{t.descripcion}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Número de documento">
              <input className="g-input" value={form.num_documento} onChange={(e) => set('num_documento', e.target.value)} />
            </Campo>
          </div>
          <div className="g-grid-2">
            <Campo label={esRuc ? 'Razón social' : 'Nombres' }>
              <input
                className="g-input"
                placeholder={esRuc ? 'Ej. CONSTRUCTORA LIMA S.A.C.' : 'Ej. Juan Carlos'}
                value={form.nombre_razon_social}
                onChange={(e) => set('nombre_razon_social', e.target.value)}
              />
            </Campo>
            <Campo label={esRuc ? 'Apellidos (opcional)' : 'Apellidos'}>
              <input
                className="g-input"
                value={form.apellidos}
                onChange={(e) => set('apellidos', e.target.value)}
              />
            </Campo>
          </div>
          <p className="g-descripcion" style={{ fontSize: 12, marginTop: -6, marginBottom: 12 }}>
            {esRuc
              ? 'Documento con RUC: la razón social es la que figura en SUNAT.'
              : 'Documento de persona natural: basta el nombre (y apellidos si los tiene).'}
          </p>
          <div className="g-grid-2">
            <Campo label="Teléfono">
              <input className="g-input" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
            </Campo>
            <Campo label="Correo">
              <input className="g-input" type="email" value={form.correo} onChange={(e) => set('correo', e.target.value)} />
            </Campo>
          </div>
          <Campo label="Dirección">
            <input className="g-input" value={form.direccion} onChange={(e) => set('direccion', e.target.value)} />
          </Campo>
          <Campo label="Ubigeo (opcional)">
            <select className="g-select" value={form.id_ubicacion} onChange={(e) => set('id_ubicacion', e.target.value)}>
              <option value="">—</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.departamento} / {u.provincia} / {u.distrito}
                </option>
              ))}
            </select>
          </Campo>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 16 }}>
            <input type="checkbox" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} /> Activo
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              {editando && puedeEscribir && (
                <button
                  type="button"
                  className="g-btn g-btn-peligro g-btn-mini"
                  onClick={() => void eliminarCliente(editando)}
                >
                  <Trash2 size={13} style={{ marginRight: 4 }} /> Eliminar cliente
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Boton variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton>
              <Boton onClick={() => void guardar()} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </Boton>
            </div>
          </div>
        </Modal>
      )}

      {historialDe && (
        <Modal titulo={`Historial · ${historialDe.nombre_razon_social}`} onCerrar={() => setHistorialDe(null)}>
          {historial === null ? (
            <Cargando />
          ) : (
            <>
              <h4 style={{ margin: '0 0 8px' }}>Cotizaciones ({historial.cotizaciones.length})</h4>
              {historial.cotizaciones.length === 0 ? (
                <p className="g-descripcion">Sin cotizaciones.</p>
              ) : (
                <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13 }}>
                  {historial.cotizaciones.map((c) => (
                    <li key={c.id}>
                      {c.num_cotizacion} · {formatoFecha(c.fecha_emision)} · <Badge valor={c.estado} /> ·{' '}
                      {formatoSoles(c.total)}
                    </li>
                  ))}
                </ul>
              )}
              <h4 style={{ margin: '0 0 8px' }}>Órdenes de venta ({historial.ventas.length})</h4>
              {historial.ventas.length === 0 ? (
                <p className="g-descripcion">Sin ventas.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {historial.ventas.map((v) => (
                    <li key={v.id}>
                      {v.num_venta} · {formatoFecha(v.fecha)} · <Badge valor={v.estado} /> · {formatoSoles(v.total)}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Modal>
      )}
    </Pagina>
  );
}
