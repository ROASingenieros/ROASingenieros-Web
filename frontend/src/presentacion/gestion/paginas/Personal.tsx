import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase, formatoFecha, formatoSoles, mensajeErrorBD } from '../../../datos/supabase';
import {
  validarNombre,
  validarApellido,
  validarTelefono,
  validarFormatoCorreo,
  comprobarCorreoExiste,
} from '../../../negocio/validaciones';
import { Aviso, Badge, Boton, Campo, Cargando, Modal, Pagina, Vacio } from '../ui';

interface Cargo {
  id: number;
  nombre_cargo: string;
  descripcion: string | null;
}

interface Empleado {
  id: number;
  id_perfil: string | null;
  num_documento: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  correo: string | null;
  id_cargo: number | null;
  fecha_ingreso: string;
  activo: boolean;
  cargo?: Pick<Cargo, 'id' | 'nombre_cargo'> | null;
}

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
}

interface Pago {
  id: number;
  id_empleado: number;
  monto: number;
  fecha: string;
  concepto: string | null;
  empleado?: Pick<Empleado, 'id' | 'nombres' | 'apellidos'> | null;
}

type Tab = 'empleados' | 'cargos' | 'pagos';

export function Personal() {
  const [tab, setTab] = useState<Tab>('empleados');

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Empleado
  const [abiertoEmp, setAbiertoEmp] = useState(false);
  const [editandoEmp, setEditandoEmp] = useState<Empleado | null>(null);
  const [emp, setEmp] = useState({
    id_perfil: '',
    num_documento: '',
    nombres: '',
    apellidos: '',
    telefono: '',
    correo: '',
    id_cargo: '',
    fecha_ingreso: new Date().toISOString().slice(0, 10),
    activo: true,
  });
  const [guardandoEmp, setGuardandoEmp] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);

  // Cargo
  const [abiertoCargo, setAbiertoCargo] = useState(false);
  const [editandoCargo, setEditandoCargo] = useState<Cargo | null>(null);
  const [cargoForm, setCargoForm] = useState({ nombre_cargo: '', descripcion: '' });
  const [cargoError, setCargoError] = useState<string | null>(null);

  // Pago
  const [abiertoPago, setAbiertoPago] = useState(false);
  const [pago, setPago] = useState({ id_empleado: '', monto: '', fecha: new Date().toISOString().slice(0, 10), concepto: '' });
  const [pagoError, setPagoError] = useState<string | null>(null);
  const [guardandoPago, setGuardandoPago] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const [e, c, p, pg] = await Promise.all([
      supabase.from('empleados').select('*, cargo:id_cargo(id,nombre_cargo)').order('apellidos'),
      supabase.from('cargo').select('*').order('nombre_cargo'),
      supabase.from('perfiles').select('id, nombre, rol').order('nombre'),
      supabase.from('pagos_personal').select('*, empleado:id_empleado(id,nombres,apellidos)').order('fecha', { ascending: false }),
    ]);
    if (e.error) setError(mensajeErrorBD(e.error));
    setEmpleados((e.data as Empleado[]) || []);
    setCargos((c.data as Cargo[]) || []);
    setPerfiles((p.data as Perfil[]) || []);
    setPagos((pg.data as Pago[]) || []);
    setCargando(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const nombreEmpleado = useMemo(
    () => (p: Pago) => (p.empleado ? `${p.empleado.nombres} ${p.empleado.apellidos}` : '—'),
    [],
  );

  // --- Empleados ----------------------------------------------------------
  const abrirEmp = (e?: Empleado) => {
    setEditandoEmp(e || null);
    setEmp(
      e
        ? {
            id_perfil: e.id_perfil ?? '',
            num_documento: e.num_documento,
            nombres: e.nombres,
            apellidos: e.apellidos,
            telefono: e.telefono ?? '',
            correo: e.correo ?? '',
            id_cargo: e.id_cargo ? String(e.id_cargo) : '',
            fecha_ingreso: e.fecha_ingreso,
            activo: e.activo,
          }
        : {
            id_perfil: '',
            num_documento: '',
            nombres: '',
            apellidos: '',
            telefono: '',
            correo: '',
            id_cargo: cargos[0] ? String(cargos[0].id) : '',
            fecha_ingreso: new Date().toISOString().slice(0, 10),
            activo: true,
          },
    );
    setEmpError(null);
    setAbiertoEmp(true);
  };

  const guardarEmp = async () => {
    setEmpError(null);
    const doc = emp.num_documento.trim();
    if (!doc) return setEmpError('El número de documento es obligatorio.');
    if (!/^\d{8}$/.test(doc)) return setEmpError('El documento (DNI) debe tener exactamente 8 dígitos numéricos.');

    // Nombres: no puede contener números
    const resNom = validarNombre(emp.nombres, true);
    if (!resNom.valido) return setEmpError(resNom.error || 'Nombres inválidos.');

    // Apellidos: no puede contener números ni caracteres especiales
    const resApe = validarApellido(emp.apellidos, true);
    if (!resApe.valido) return setEmpError(resApe.error || 'Apellidos inválidos.');

    // Teléfono: no puede contener letras
    if (emp.telefono.trim()) {
      const resTel = validarTelefono(emp.telefono, false, false);
      if (!resTel.valido) return setEmpError(resTel.error || 'Teléfono inválido.');
    }

    // Correo: formato y comprobación
    if (emp.correo.trim()) {
      const resCor = validarFormatoCorreo(emp.correo, true);
      if (!resCor.valido) return setEmpError(resCor.error || 'Correo inválido.');
      const resExiste = await comprobarCorreoExiste(emp.correo);
      if (!resExiste.valido) return setEmpError(resExiste.error || 'El correo no existe.');
    }

    setGuardandoEmp(true);
    const payload = {
      id_perfil: emp.id_perfil || null,
      num_documento: doc,
      nombres: emp.nombres.trim(),
      apellidos: emp.apellidos.trim(),
      telefono: emp.telefono.trim() || null,
      correo: emp.correo.trim().toLowerCase() || null,
      id_cargo: emp.id_cargo ? Number(emp.id_cargo) : null,
      fecha_ingreso: emp.fecha_ingreso,
      activo: emp.activo,
    };
    const { error: err } = editandoEmp
      ? await supabase.from('empleados').update(payload).eq('id', editandoEmp.id)
      : await supabase.from('empleados').insert(payload);
    setGuardandoEmp(false);
    if (err) setEmpError(mensajeErrorBD(err));
    else {
      setAbiertoEmp(false);
      await cargar();
    }
  };

  // --- Cargos -------------------------------------------------------------
  const abrirCargo = (c?: Cargo) => {
    setEditandoCargo(c || null);
    setCargoForm({ nombre_cargo: c?.nombre_cargo ?? '', descripcion: c?.descripcion ?? '' });
    setCargoError(null);
    setAbiertoCargo(true);
  };

  const guardarCargo = async () => {
    setCargoError(null);
    if (!cargoForm.nombre_cargo.trim()) return setCargoError('El nombre del cargo es obligatorio.');
    const payload = { nombre_cargo: cargoForm.nombre_cargo.trim(), descripcion: cargoForm.descripcion.trim() || null };
    const { error: err } = editandoCargo
      ? await supabase.from('cargo').update(payload).eq('id', editandoCargo.id)
      : await supabase.from('cargo').insert(payload);
    if (err) setCargoError(mensajeErrorBD(err));
    else {
      setAbiertoCargo(false);
      await cargar();
    }
  };

  // --- Pagos --------------------------------------------------------------
  const abrirPago = () => {
    setPago({
      id_empleado: '',
      monto: '',
      fecha: new Date().toISOString().slice(0, 10),
      concepto: '',
    });
    setPagoError(null);
    setAbiertoPago(true);
  };

  const guardarPago = async () => {
    setPagoError(null);
    if (!pago.id_empleado) return setPagoError('Selecciona un empleado.');
    if (Number(pago.monto) <= 0) return setPagoError('El monto debe ser mayor que 0.');
    if (new Date(pago.fecha).getTime() > Date.now() + 24 * 3600 * 1000)
      return setPagoError('La fecha no puede ser futura.');
    setGuardandoPago(true);
    const { error: err } = await supabase.from('pagos_personal').insert({
      id_empleado: Number(pago.id_empleado),
      monto: Number(pago.monto),
      fecha: pago.fecha,
      concepto: pago.concepto.trim() || null,
    });
    setGuardandoPago(false);
    if (err) setPagoError(mensajeErrorBD(err));
    else {
      setAbiertoPago(false);
      await cargar();
    }
  };

  const eliminarPago = async (idPago: number, monto: number) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar este registro de pago de ${formatoSoles(monto)}?`)) return;
    setError(null);
    try {
      const { error: err } = await supabase.from('pagos_personal').delete().eq('id', idPago);
      if (err) throw err;
      await cargar();
    } catch (e) {
      setError(mensajeErrorBD(e));
    }
  };

  const accionNuevo = () =>
    tab === 'empleados' ? abrirEmp() : tab === 'cargos' ? abrirCargo() : abrirPago();

  return (
    <Pagina
      titulo="Personal y pagos"
      descripcion="Empleados, cargos y pagos de personal. Solo Gerente."
      acciones={
        <Boton onClick={accionNuevo}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} />
            {tab === 'empleados' ? 'Nuevo empleado' : tab === 'cargos' ? 'Nuevo cargo' : 'Nuevo pago'}
          </span>
        </Boton>
      }
    >
      <Aviso tipo="error">{error}</Aviso>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['empleados', 'cargos', 'pagos'] as Tab[]).map((t) => (
          <button key={t} className={`g-btn g-btn-mini ${tab === t ? '' : 'g-btn-fantasma'}`} onClick={() => setTab(t)}>
            {t === 'empleados' ? 'Empleados' : t === 'cargos' ? 'Cargos' : 'Pagos'}
          </button>
        ))}
      </div>

      <div className="g-tarjeta">
        {cargando ? (
          <Cargando />
        ) : tab === 'empleados' ? (
          empleados.length === 0 ? <Vacio /> : (
            <div className="g-tabla-wrap">
              <table className="g-tabla">
                <thead><tr><th>Documento</th><th>Nombre</th><th>Cargo</th><th>Ingreso</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {empleados.map((e) => (
                    <tr key={e.id}>
                      <td>{e.num_documento}</td>
                      <td style={{ fontWeight: 600 }}>{e.nombres} {e.apellidos}</td>
                      <td>{e.cargo?.nombre_cargo || '—'}</td>
                      <td>{formatoFecha(e.fecha_ingreso)}</td>
                      <td><Badge valor={e.activo ? 'activo' : 'inactivo'} /></td>
                      <td><button className="g-btn g-btn-fantasma g-btn-mini" onClick={() => abrirEmp(e)}>Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'cargos' ? (
          cargos.length === 0 ? <Vacio /> : (
            <div className="g-tabla-wrap">
              <table className="g-tabla">
                <thead><tr><th>Cargo</th><th>Descripción</th><th></th></tr></thead>
                <tbody>
                  {cargos.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.nombre_cargo}</td>
                      <td>{c.descripcion || '—'}</td>
                      <td><button className="g-btn g-btn-fantasma g-btn-mini" onClick={() => abrirCargo(c)}>Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : pagos.length === 0 ? <Vacio /> : (
          <div className="g-tabla-wrap">
            <table className="g-tabla">
              <thead><tr><th>Fecha</th><th>Empleado</th><th>Concepto</th><th>Monto</th><th></th></tr></thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td>{formatoFecha(p.fecha)}</td>
                    <td>{nombreEmpleado(p)}</td>
                    <td>{p.concepto || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{formatoSoles(p.monto)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="g-btn g-btn-peligro g-btn-mini"
                        onClick={() => void eliminarPago(p.id, p.monto)}
                        title="Eliminar pago"
                        aria-label="Eliminar pago"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {abiertoEmp && (
        <Modal titulo={editandoEmp ? 'Editar empleado' : 'Nuevo empleado'} onCerrar={() => setAbiertoEmp(false)}>
          <Aviso tipo="error">{empError}</Aviso>
          <div className="g-grid-2">
            <Campo label="Documento">
              <input className="g-input" value={emp.num_documento} onChange={(e) => setEmp({ ...emp, num_documento: e.target.value })} />
            </Campo>
            <Campo label="Cargo">
              <select className="g-select" value={emp.id_cargo} onChange={(e) => setEmp({ ...emp, id_cargo: e.target.value })}>
                <option value="">—</option>
                {cargos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre_cargo}</option>
                ))}
              </select>
            </Campo>
          </div>
          <div className="g-grid-2">
            <Campo label="Nombres">
              <input className="g-input" value={emp.nombres} onChange={(e) => setEmp({ ...emp, nombres: e.target.value })} />
            </Campo>
            <Campo label="Apellidos">
              <input className="g-input" value={emp.apellidos} onChange={(e) => setEmp({ ...emp, apellidos: e.target.value })} />
            </Campo>
          </div>
          <div className="g-grid-2">
            <Campo label="Teléfono">
              <input className="g-input" value={emp.telefono} onChange={(e) => setEmp({ ...emp, telefono: e.target.value })} />
            </Campo>
            <Campo label="Correo">
              <input className="g-input" type="email" value={emp.correo} onChange={(e) => setEmp({ ...emp, correo: e.target.value })} />
            </Campo>
          </div>
          <div className="g-grid-2">
            <Campo label="Fecha de ingreso">
              <input className="g-input" type="date" value={emp.fecha_ingreso} onChange={(e) => setEmp({ ...emp, fecha_ingreso: e.target.value })} />
            </Campo>
            <Campo label="Usuario vinculado (opcional)">
              <select className="g-select" value={emp.id_perfil} onChange={(e) => setEmp({ ...emp, id_perfil: e.target.value })}>
                <option value="">—</option>
                {perfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} ({p.rol})</option>
                ))}
              </select>
            </Campo>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 16 }}>
            <input type="checkbox" checked={emp.activo} onChange={(e) => setEmp({ ...emp, activo: e.target.checked })} /> Activo
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Boton variante="fantasma" onClick={() => setAbiertoEmp(false)}>Cancelar</Boton>
            <Boton onClick={() => void guardarEmp()} disabled={guardandoEmp}>{guardandoEmp ? 'Guardando…' : 'Guardar'}</Boton>
          </div>
        </Modal>
      )}

      {abiertoCargo && (
        <Modal titulo={editandoCargo ? 'Editar cargo' : 'Nuevo cargo'} onCerrar={() => setAbiertoCargo(false)}>
          <Aviso tipo="error">{cargoError}</Aviso>
          <Campo label="Nombre del cargo">
            <input className="g-input" value={cargoForm.nombre_cargo} onChange={(e) => setCargoForm({ ...cargoForm, nombre_cargo: e.target.value })} />
          </Campo>
          <Campo label="Descripción">
            <textarea className="g-textarea" rows={2} value={cargoForm.descripcion} onChange={(e) => setCargoForm({ ...cargoForm, descripcion: e.target.value })} />
          </Campo>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Boton variante="fantasma" onClick={() => setAbiertoCargo(false)}>Cancelar</Boton>
            <Boton onClick={() => void guardarCargo()}>Guardar</Boton>
          </div>
        </Modal>
      )}

      {abiertoPago && (
        <Modal titulo="Nuevo pago de personal" onCerrar={() => setAbiertoPago(false)}>
          <Aviso tipo="error">{pagoError}</Aviso>
          <Campo label="Empleado">
            <select className="g-select" value={pago.id_empleado} onChange={(e) => setPago({ ...pago, id_empleado: e.target.value })}>
              <option value="">—</option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id}>{e.nombres} {e.apellidos}</option>
              ))}
            </select>
          </Campo>
          <div className="g-grid-2">
            <Campo label="Monto (S/)">
              <input className="g-input" type="number" min={0} step="0.01" value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} />
            </Campo>
            <Campo label="Fecha">
              <input className="g-input" type="date" value={pago.fecha} onChange={(e) => setPago({ ...pago, fecha: e.target.value })} />
            </Campo>
          </div>
          <Campo label="Concepto">
            <input className="g-input" value={pago.concepto} onChange={(e) => setPago({ ...pago, concepto: e.target.value })} />
          </Campo>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Boton variante="fantasma" onClick={() => setAbiertoPago(false)}>Cancelar</Boton>
            <Boton onClick={() => void guardarPago()} disabled={guardandoPago}>{guardandoPago ? 'Guardando…' : 'Registrar pago'}</Boton>
          </div>
        </Modal>
      )}
    </Pagina>
  );
}
