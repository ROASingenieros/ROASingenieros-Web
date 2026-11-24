import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import {
  supabase,
  formatoFecha,
  mensajeErrorBD,
  type GuiaRemision,
  type Venta,
} from '../../../datos/supabase';
import { AVISO_MODO_PRUEBA } from '../../../externos/facturacion';
import { useAuthGestion } from '../AuthContext';
import { imprimirDocumento } from '../imprimir';
import { Aviso, Badge, Boton, Campo, Cargando, Modal, Pagina, Vacio } from '../ui';

export function Guias() {
  const { puede } = useAuthGestion();
  const puedeCrear = puede('admin', 'supervisor', 'secretaria');

  const [lista, setLista] = useState<GuiaRemision[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [abierto, setAbierto] = useState(false);
  const [idVenta, setIdVenta] = useState('');
  const [partida, setPartida] = useState('Av. Ate, Lima');
  const [llegada, setLlegada] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [accion, setAccion] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const [g, v] = await Promise.all([
      supabase
        .from('guias_remision')
        .select('*, venta:id_venta(id,num_venta,estado)')
        .order('id', { ascending: false })
        .limit(200),
      supabase.from('ventas').select('id, num_venta, estado, id_cliente').neq('estado', 'anulada').order('fecha', { ascending: false }),
    ]);
    if (g.error) setError(mensajeErrorBD(g.error));
    setLista((g.data as GuiaRemision[]) || []);
    setVentas((v.data as Venta[]) || []);
    setCargando(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const abrirNuevo = () => {
    setIdVenta('');
    setPartida('Av. Ate, Lima');
    setLlegada('');
    setFecha(new Date().toISOString().slice(0, 10));
    setFormError(null);
    setAbierto(true);
  };

  const crear = async () => {
    setFormError(null);
    if (!idVenta) return setFormError('Selecciona una venta.');
    if (!llegada.trim()) return setFormError('Indica el punto de llegada.');
    if (!fecha) return setFormError('Indica la fecha de traslado.');
    setGuardando(true);
    const { error: err } = await supabase.rpc('crear_guia_remision', {
      p_id_venta: Number(idVenta),
      p_punto_partida: partida.trim() || null,
      p_punto_llegada: llegada.trim(),
      p_fecha_traslado: fecha,
    });
    setGuardando(false);
    if (err) {
      setFormError(mensajeErrorBD(err));
      return;
    }
    setAbierto(false);
    await cargar();
  };

  const emitir = async (g: GuiaRemision) => {
    setError(null);
    setAviso(null);
    setAccion(g.id);
    const { error: err } = await supabase
      .from('guias_remision')
      .update({ estado: 'emitida', respuesta_sunat: { modo_prueba: true, proveedor: 'mock' } })
      .eq('id', g.id);
    setAccion(null);
    if (err) setError(mensajeErrorBD(err));
    else {
      setAviso(AVISO_MODO_PRUEBA);
      await cargar();
    }
  };

  const anular = async (g: GuiaRemision) => {
    if (!window.confirm('¿Anular esta guía de remisión?')) return;
    const { error: err } = await supabase.from('guias_remision').update({ estado: 'anulada' }).eq('id', g.id);
    if (err) setError(mensajeErrorBD(err));
    else await cargar();
  };

  const eliminarGuia = async (g: GuiaRemision) => {
    const numGuia = `${g.serie}-${String(g.correlativo).padStart(5, '0')}`;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la guía de remisión ${numGuia}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setError(null);
    setAviso(null);
    setAccion(g.id);
    const { error: err } = await supabase.from('guias_remision').delete().eq('id', g.id);
    setAccion(null);
    if (err) setError(mensajeErrorBD(err));
    else await cargar();
  };

  const imprimir = async (g: GuiaRemision) => {
    const v = await supabase
      .from('ventas')
      .select('*, cliente:id_cliente(nombre_razon_social,num_documento,direccion)')
      .eq('id', g.id_venta)
      .maybeSingle();
    const venta = v.data as (Venta & { cliente?: { nombre_razon_social: string; num_documento: string; direccion?: string | null } }) | null;

    imprimirDocumento(
      `Guía ${g.serie}-${g.correlativo}`,
      `
      <div class="marca">ROAS INGENIEROS E.I.R.L.</div>
      <div class="sub">RUC 20123456789 · Ate, Lima, Perú</div>
      <h1 style="margin-top:14px">GUÍA DE REMISIÓN REMITENTE</h1>
      <h2>${g.serie}-${String(g.correlativo).padStart(5, '0')}</h2>
      <div class="aviso">${AVISO_MODO_PRUEBA}</div>
      <p><strong>Destinatario:</strong> ${venta?.cliente?.nombre_razon_social || '—'} · ${venta?.cliente?.num_documento || ''}</p>
      <p><strong>Punto de partida:</strong> ${g.punto_partida || '—'}<br/>
         <strong>Punto de llegada:</strong> ${g.punto_llegada}<br/>
         <strong>Fecha de traslado:</strong> ${formatoFecha(g.fecha_traslado)}</p>
      <p class="sub">Venta asociada: ${venta?.num_venta || ''}</p>`,
    );
  };

  return (
    <Pagina
      titulo="Guías de remisión"
      descripcion="Se crean desde una venta (RN-09). Mientras se use el mock, la guía no tiene validez tributaria."
      acciones={
        puedeCrear ? (
          <Boton onClick={abrirNuevo}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Nueva guía
            </span>
          </Boton>
        ) : null
      }
    >
      <Aviso tipo="error">{error}</Aviso>
      <Aviso tipo="info">{aviso}</Aviso>

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
                  <th>Guía</th>
                  <th>Venta</th>
                  <th>Llegada</th>
                  <th>Traslado</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((g) => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>{g.serie}-{String(g.correlativo).padStart(5, '0')}</td>
                    <td>{g.venta?.num_venta || '—'}</td>
                    <td>{g.punto_llegada}</td>
                    <td>{formatoFecha(g.fecha_traslado)}</td>
                    <td><Badge valor={g.estado} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="g-btn g-btn-fantasma g-btn-mini" onClick={() => void imprimir(g)}>
                        <FileText size={13} /> PDF
                      </button>
                      {puedeCrear && g.estado === 'borrador' && (
                        <>
                          {' '}
                          <button className="g-btn g-btn-exito g-btn-mini" disabled={accion === g.id} onClick={() => void emitir(g)}>
                            Emitir
                          </button>
                        </>
                      )}
                      {puedeCrear && g.estado !== 'anulada' && (
                        <>
                          {' '}
                          <button className="g-btn g-btn-peligro g-btn-mini" onClick={() => void anular(g)}>Anular</button>
                        </>
                      )}
                      {puedeCrear && (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="g-btn g-btn-peligro g-btn-mini"
                            disabled={accion === g.id}
                            onClick={() => void eliminarGuia(g)}
                            title="Eliminar guía de remisión"
                            aria-label={`Eliminar guía ${g.serie}-${g.correlativo}`}
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
        <Modal titulo="Nueva guía de remisión" onCerrar={() => setAbierto(false)}>
          <Aviso tipo="error">{formError}</Aviso>
          <Campo label="Venta">
            <select className="g-select" value={idVenta} onChange={(e) => setIdVenta(e.target.value)}>
              <option value="">—</option>
              {ventas.map((v) => (
                <option key={v.id} value={v.id}>{v.num_venta} ({v.estado})</option>
              ))}
            </select>
          </Campo>
          <Campo label="Punto de partida">
            <input className="g-input" value={partida} onChange={(e) => setPartida(e.target.value)} />
          </Campo>
          <Campo label="Punto de llegada">
            <input className="g-input" value={llegada} onChange={(e) => setLlegada(e.target.value)} />
          </Campo>
          <Campo label="Fecha de traslado">
            <input className="g-input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Boton variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton>
            <Boton onClick={() => void crear()} disabled={guardando}>
              {guardando ? 'Creando…' : 'Crear guía'}
            </Boton>
          </div>
        </Modal>
      )}
    </Pagina>
  );
}
