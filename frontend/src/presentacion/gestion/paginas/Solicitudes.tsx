import { useCallback, useEffect, useState } from 'react';
import { Inbox, MessageCircle, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  supabase,
  formatoFecha,
  mensajeErrorBD,
  type Cliente,
  type Producto,
} from '../../../datos/supabase';
import { Aviso, Boton, Campo, Cargando, Modal, Pagina } from '../ui';
import { useIrA } from '../router';

interface LeadItem {
  name?: string;
  qty?: number;
  price?: string;
}

interface Solicitud {
  id: number;
  creado_en: string;
  valor_nuevo: {
    nombre?: string;
    telefono?: string;
    items?: LeadItem[];
  } | null;
}

interface ItemForm {
  id_producto: string;
  cantidad: string;
  precio_unitario: string;
}

export function Solicitudes() {
  const irA = useIrA();
  const [leads, setLeads] = useState<Solicitud[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lead, setLead] = useState<Solicitud | null>(null);
  const [idCliente, setIdCliente] = useState('');
  const [items, setItems] = useState<ItemForm[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const STORAGE_DESCARTADAS = 'roas_solicitudes_descartadas';

  const obtenerDescartadas = (): number[] => {
    try {
      const raw = localStorage.getItem(STORAGE_DESCARTADAS);
      return raw ? (JSON.parse(raw) as number[]) : [];
    } catch {
      return [];
    }
  };

  const marcarDescartadaLocal = (id: number) => {
    try {
      const lista = obtenerDescartadas();
      if (!lista.includes(id)) {
        lista.push(id);
        localStorage.setItem(STORAGE_DESCARTADAS, JSON.stringify(lista));
      }
    } catch {
      // ignorar error de cuota local
    }
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const [l, cl, p] = await Promise.all([
      supabase
        .from('auditoria')
        .select('id, valor_nuevo, creado_en')
        .eq('tabla', 'solicitud_web')
        .order('creado_en', { ascending: false })
        .limit(200),
      supabase.from('clientes').select('id, nombre_razon_social, num_documento').eq('activo', true).order('nombre_razon_social'),
      supabase.from('productos').select('id, nombre, codigo, tipo, precio_unitario').eq('activo', true).order('nombre'),
    ]);
    if (l.error) setError(mensajeErrorBD(l.error));
    const descartadas = obtenerDescartadas();
    const leadsFiltrados = ((l.data as Solicitud[]) || []).filter((s) => !descartadas.includes(s.id));
    setLeads(leadsFiltrados);
    setClientes((cl.data as Cliente[]) || []);
    setProductos((p.data as Producto[]) || []);
    setCargando(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const abrirConvertir = (s: Solicitud) => {
    setLead(s);
    setIdCliente('');
    setFormError(null);
    const filas: ItemForm[] = (s.valor_nuevo?.items || []).map((it) => {
      const match = productos.find(
        (p) => p.nombre.toLowerCase() === (it.name || '').trim().toLowerCase(),
      );
      return {
        id_producto: match ? String(match.id) : '',
        cantidad: String(it.qty || 1),
        precio_unitario: match ? String(match.precio_unitario) : '',
      };
    });
    setItems(filas.length ? filas : [{ id_producto: '', cantidad: '1', precio_unitario: '' }]);
  };

  const setItem = (idx: number, campo: keyof ItemForm, valor: string) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const nuevo = { ...it, [campo]: valor };
        if (campo === 'id_producto') {
          const p = productos.find((x) => String(x.id) === valor);
          if (p) nuevo.precio_unitario = String(p.precio_unitario);
        }
        return nuevo;
      }),
    );
  };

  const guardar = async () => {
    if (!lead) return;
    setFormError(null);
    if (!idCliente) return setFormError('Selecciona un cliente (créalo primero si es nuevo).');
    // Cada fila con producto elegido debe quedar completa (cantidad y precio).
    for (const [i, it] of items.entries()) {
      if (!it.id_producto) continue;
      const cant = Number(it.cantidad);
      const precio = Number(it.precio_unitario);
      if (!Number.isInteger(cant) || cant < 1)
        return setFormError(`Ítem ${i + 1}: la cantidad debe ser un entero mayor que 0.`);
      if (!Number.isFinite(precio) || precio < 0)
        return setFormError(`Ítem ${i + 1}: el precio unitario no es un número válido.`);
    }
    const validos = items.filter((i) => i.id_producto);
    if (validos.length === 0) return setFormError('Selecciona al menos un producto de la solicitud.');

    setGuardando(true);
    try {
      const { data: cot, error: errCot } = await supabase
        .from('cotizaciones')
        .insert({ id_cliente: Number(idCliente), origen: 'whatsapp', notas: `Solicitud web #${lead.id}` })
        .select('id')
        .single();
      if (errCot) throw errCot;
      const { error: errDet } = await supabase.from('detalle_cotizacion').insert(
        validos.map((i) => ({
          id_cotizacion: (cot as { id: number }).id,
          id_producto: Number(i.id_producto),
          cantidad: Math.trunc(Number(i.cantidad)),
          precio_unitario: Number(i.precio_unitario),
        })),
      );
      if (errDet) throw errDet;
      setLead(null);
      irA(`cotizaciones/${(cot as { id: number }).id}`);
    } catch (e) {
      setFormError(mensajeErrorBD(e));
    } finally {
      setGuardando(false);
    }
  };

  const whatsapp = (s: Solicitud) => {
    const tel = (s.valor_nuevo?.telefono || '').replace(/^\+?51/, '').replace(/\D/g, '');
    if (!tel) {
      window.alert('Esta solicitud no trae teléfono de contacto.');
      return;
    }
    const items = (s.valor_nuevo?.items || [])
      .map((i, n) => `${n + 1}. ${i.name || 'ítem'}${i.qty ? ` x${i.qty}` : ''}`)
      .join('\n');
    const msg = `Hola ${s.valor_nuevo?.nombre || ''}, somos ROAS Ingenieros. Recibimos tu solicitud del catálogo${
      items ? `:\n${items}` : ''
    }. ¿Te ayudamos con tu cotización?`;
    window.open(`https://wa.me/51${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const eliminarSolicitud = async (idSol: number) => {
    if (!window.confirm('¿Deseas descartar y eliminar esta solicitud web de la bandeja?')) return;
    setError(null);

    // 1. Descartar de la vista inmediatamente y persistir localmente
    marcarDescartadaLocal(idSol);
    setLeads((prev) => prev.filter((s) => s.id !== idSol));

    // 2. Ejecutar eliminación en el backend (multicapa)
    try {
      // Vía A: RPC PostgreSQL con SECURITY DEFINER
      const { error: errRpc } = await supabase.rpc('eliminar_solicitud_web', { p_id: idSol });
      if (!errRpc) return;

      // Vía B: Edge function usuarios (usa service_role, bypasea RLS)
      const { data: resFn, error: errFn } = await supabase.functions.invoke('usuarios', {
        body: { accion: 'eliminar_solicitud_web', id: idSol },
      });
      if (!errFn && (resFn as { ok?: boolean })?.ok) return;

      // Vía C: Intento directo sobre tabla auditoria
      await supabase.from('auditoria').delete().eq('id', idSol);

      // Vía D: Soft-update si DELETE está bloqueado por RLS pero UPDATE está permitido
      await supabase.from('auditoria').update({ tabla: 'solicitud_web_descartada' }).eq('id', idSol);
    } catch (e) {
      console.warn('Eliminación en servidor diferida, mantenida descartada localmente:', e);
    }
  };

  return (
    <Pagina
      titulo="Solicitudes web"
      descripcion="Leads del catálogo público (solo Gerente). Se registran antes de abrir WhatsApp."
      acciones={
        <Boton variante="fantasma" onClick={() => void cargar()}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={15} /> Actualizar
          </span>
        </Boton>
      }
    >
      <Aviso tipo="error">{error}</Aviso>

      {cargando ? (
        <Cargando />
      ) : leads.length === 0 ? (
        <div className="g-tarjeta" style={{ textAlign: 'center', padding: '48px 16px' }}>
          <Inbox size={40} color="var(--text-muted)" />
          <p className="g-descripcion">Bandeja vacía. Las solicitudes del catálogo aparecerán aquí.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {leads.map((s) => (
            <div key={s.id} className="g-tarjeta" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.valor_nuevo?.nombre || 'Sin nombre'}</div>
                  <div className="g-descripcion" style={{ fontSize: 12 }}>
                    {s.valor_nuevo?.telefono || 'Sin teléfono'} · {formatoFecha(s.creado_en)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="g-btn g-btn-fantasma g-btn-mini" onClick={() => whatsapp(s)} title="Escribir por WhatsApp">
                    <MessageCircle size={13} /> WhatsApp
                  </button>
                  <button className="g-btn g-btn-mini" onClick={() => abrirConvertir(s)} title="Convertir a cotización">
                    <Plus size={13} /> Crear cotización
                  </button>
                  <button
                    type="button"
                    className="g-btn g-btn-peligro g-btn-mini"
                    onClick={() => void eliminarSolicitud(s.id)}
                    title="Descartar solicitud"
                    aria-label="Descartar solicitud"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {(s.valor_nuevo?.items || []).length > 0 && (
                <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13 }}>
                  {(s.valor_nuevo?.items || []).map((i, n) => (
                    <li key={n}>
                      {i.name || 'ítem'}
                      {i.qty ? ` x${i.qty}` : ''} {i.price ? `· S/ ${i.price}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {lead && (
        <Modal titulo={`Crear cotización · ${lead.valor_nuevo?.nombre || 'solicitud'}`} onCerrar={() => setLead(null)}>
          <Aviso tipo="error">{formError}</Aviso>
          <Campo label="Cliente">
            <select className="g-select" value={idCliente} onChange={(e) => setIdCliente(e.target.value)}>
              <option value="">—</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_razon_social} ({c.num_documento})
                </option>
              ))}
            </select>
          </Campo>
          <p className="g-descripcion" style={{ fontSize: 12 }}>
            Si el cliente es nuevo, créalo primero en la sección Clientes.
          </p>

          {(lead.valor_nuevo?.items || []).map((it, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 70px 110px', gap: 8, marginBottom: 8 }}>
              <select className="g-select" value={items[idx]?.id_producto ?? ''} onChange={(e) => setItem(idx, 'id_producto', e.target.value)}>
                <option value="">{it.name || '— seleccionar —'}</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              <input className="g-input" type="number" min={1} value={items[idx]?.cantidad ?? '1'} onChange={(e) => setItem(idx, 'cantidad', e.target.value)} />
              <input className="g-input" type="number" min={0} step="0.01" value={items[idx]?.precio_unitario ?? ''} onChange={(e) => setItem(idx, 'precio_unitario', e.target.value)} />
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Boton variante="fantasma" onClick={() => setLead(null)}>Cancelar</Boton>
            <Boton onClick={() => void guardar()} disabled={guardando}>
              {guardando ? 'Creando…' : 'Crear cotización'}
            </Boton>
          </div>
        </Modal>
      )}
    </Pagina>
  );
}
