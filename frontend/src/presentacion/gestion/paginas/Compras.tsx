import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  supabase,
  formatoFecha,
  formatoSoles,
  mensajeErrorBD,
  type OrdenCompra,
  type Producto,
  type Proveedor,
} from '../../../datos/supabase';
import {
  validarTelefono,
  validarFormatoCorreo,
  comprobarCorreoExiste,
  validarDocumentoIdentidad,
} from '../../../negocio/validaciones';
import { Aviso, Badge, Boton, Campo, Cargando, Modal, Pagina, Vacio } from '../ui';

interface ItemForm {
  id_producto: string;
  cantidad: string;
  precio_costo: string;
}

const ITEM_VACIO: ItemForm = { id_producto: '', cantidad: '1', precio_costo: '' };

interface DetalleCompra {
  id: number;
  cantidad: number;
  precio_costo: number;
  subtotal: number;
  producto?: { nombre: string } | null;
}

export function Compras() {
  const [tab, setTab] = useState<'ordenes' | 'proveedores'>('ordenes');

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [costos, setCostos] = useState<Record<number, number>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fEstado, setFEstado] = useState('');

  // Proveedor
  const [abiertoProv, setAbiertoProv] = useState(false);
  const [editandoProv, setEditandoProv] = useState<Proveedor | null>(null);
  const [prov, setProv] = useState({ ruc: '', razon_social: '', telefono: '', correo: '', activo: true });
  const [guardandoProv, setGuardandoProv] = useState(false);
  const [provError, setProvError] = useState<string | null>(null);

  // Orden
  const [abiertoOrden, setAbiertoOrden] = useState(false);
  const [idProveedor, setIdProveedor] = useState('');
  const [items, setItems] = useState<ItemForm[]>([{ ...ITEM_VACIO }]);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  const [ordenError, setOrdenError] = useState<string | null>(null);
  const [detalleOrden, setDetalleOrden] = useState<OrdenCompra | null>(null);
  const [detalleItems, setDetalleItems] = useState<DetalleCompra[]>([]);
  const [editandoDetalle, setEditandoDetalle] = useState(false);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [valoresDetalleEdit, setValoresDetalleEdit] = useState<{ id: number; cantidad: string; precio_costo: string }[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    let q = supabase
      .from('ordenes_compra')
      .select('*, proveedor:id_proveedor(id,razon_social,ruc)')
      .order('fecha_emision', { ascending: false })
      .limit(200);
    if (fEstado) q = q.eq('estado', fEstado);
    const [o, p, pr, co] = await Promise.all([
      q,
      supabase.from('proveedores').select('*').order('razon_social'),
      supabase.from('productos').select('id, nombre, codigo, tipo, precio_unitario').eq('activo', true).order('nombre'),
      supabase.from('producto_costo').select('id_producto, precio_costo'),
    ]);
    if (o.error) setError(mensajeErrorBD(o.error));
    setOrdenes((o.data as OrdenCompra[]) || []);
    setProveedores((p.data as Proveedor[]) || []);
    setProductos((pr.data as Producto[]) || []);
    const mapaCostos: Record<number, number> = {};
    ((co.data as { id_producto: number; precio_costo: number }[]) || []).forEach((r) => {
      mapaCostos[r.id_producto] = r.precio_costo;
    });
    setCostos(mapaCostos);
    setCargando(false);
  }, [fEstado]);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  // --- Proveedores --------------------------------------------------------
  const abrirProv = (p?: Proveedor) => {
    setEditandoProv(p || null);
    setProv(
      p
        ? { ruc: p.ruc, razon_social: p.razon_social, telefono: p.telefono ?? '', correo: p.correo ?? '', activo: p.activo }
        : { ruc: '', razon_social: '', telefono: '', correo: '', activo: true },
    );
    setProvError(null);
    setAbiertoProv(true);
  };

  const guardarProv = async () => {
    setProvError(null);
    const resRuc = validarDocumentoIdentidad('6', prov.ruc);
    if (!resRuc.valido) return setProvError(resRuc.error || 'RUC inválido.');

    if (!prov.razon_social.trim()) return setProvError('La razón social es obligatoria.');
    if (prov.razon_social.trim().length < 3) return setProvError('La razón social debe tener al menos 3 caracteres.');

    // Teléfono: no puede contener letras
    if (prov.telefono.trim()) {
      const resTel = validarTelefono(prov.telefono, false, false);
      if (!resTel.valido) return setProvError(resTel.error || 'Teléfono inválido.');
    }

    // Correo: comprobar formato y existencia
    if (prov.correo.trim()) {
      const resCor = validarFormatoCorreo(prov.correo, true);
      if (!resCor.valido) return setProvError(resCor.error || 'Correo inválido.');
      const resExiste = await comprobarCorreoExiste(prov.correo);
      if (!resExiste.valido) return setProvError(resExiste.error || 'El correo no existe.');
    }

    setGuardandoProv(true);
    const payload = {
      ruc: prov.ruc.trim(),
      razon_social: prov.razon_social.trim(),
      telefono: prov.telefono.trim() || null,
      correo: prov.correo.trim().toLowerCase() || null,
      activo: prov.activo,
    };
    const { error: err } = editandoProv
      ? await supabase.from('proveedores').update(payload).eq('id', editandoProv.id)
      : await supabase.from('proveedores').insert(payload);
    setGuardandoProv(false);
    if (err) setProvError(mensajeErrorBD(err));
    else {
      setAbiertoProv(false);
      await cargar();
    }
  };

  // --- Órdenes ------------------------------------------------------------
  const abrirOrden = () => {
    setIdProveedor('');
    setItems([{ ...ITEM_VACIO }]);
    setOrdenError(null);
    setAbiertoOrden(true);
  };

  const setItem = (idx: number, campo: keyof ItemForm, valor: string) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const nuevo = { ...it, [campo]: valor };
        if (campo === 'id_producto') {
          const idNum = Number(valor);
          const costoGuardado = costos[idNum];
          if (costoGuardado != null && Number.isFinite(costoGuardado)) {
            nuevo.precio_costo = String(costoGuardado);
          } else {
            const p = productos.find((x) => String(x.id) === valor);
            nuevo.precio_costo = p ? String(p.precio_unitario) : '';
          }
        }
        return nuevo;
      }),
    );
  };

  const totalEstimadoNuevaOrden = items.reduce((acc, it) => {
    const cant = Number(it.cantidad) || 0;
    const costo = Number(it.precio_costo) || 0;
    return acc + cant * costo;
  }, 0);

  const guardarOrden = async () => {
    setOrdenError(null);
    if (!idProveedor) return setOrdenError('Selecciona un proveedor.');
    // Cada fila con producto elegido debe quedar completa: antes se descartaba
    // en silencio y el usuario no sabía qué fila estaba mal.
    for (const [i, it] of items.entries()) {
      if (!it.id_producto) continue;
      const cant = Number(it.cantidad);
      const costo = Number(it.precio_costo);
      if (!Number.isInteger(cant) || cant < 1)
        return setOrdenError(`Ítem ${i + 1}: la cantidad debe ser un entero mayor que 0.`);
      if (!Number.isFinite(costo) || costo < 0)
        return setOrdenError(`Ítem ${i + 1}: el precio de costo no es un número válido.`);
    }
    const validos = items.filter((i) => i.id_producto);
    if (validos.length === 0) return setOrdenError('Agrega al menos un ítem.');

    setGuardandoOrden(true);
    try {
      const { data: oc, error: errOc } = await supabase
        .from('ordenes_compra')
        .insert({ id_proveedor: Number(idProveedor) })
        .select('id')
        .single();
      if (errOc) throw errOc;
      const { error: errDet } = await supabase.from('detalle_compra').insert(
        validos.map((i) => ({
          id_orden_compra: (oc as { id: number }).id,
          id_producto: Number(i.id_producto),
          cantidad: Math.trunc(Number(i.cantidad)),
          precio_costo: Number(i.precio_costo),
        })),
      );
      if (errDet) throw errDet;
      setAbiertoOrden(false);
      await cargar();
    } catch (e) {
      setOrdenError(mensajeErrorBD(e));
    } finally {
      setGuardandoOrden(false);
    }
  };

  const verOrden = async (o: OrdenCompra) => {
    setDetalleOrden(o);
    setEditandoDetalle(false);
    setDetalleItems([]);
    const { data } = await supabase
      .from('detalle_compra')
      .select('*, producto:id_producto(nombre)')
      .eq('id_orden_compra', o.id)
      .order('id');
    setDetalleItems((data as unknown as DetalleCompra[]) || []);
  };

  const iniciarEdicionDetalle = () => {
    setValoresDetalleEdit(
      detalleItems.map((d) => ({
        id: d.id,
        cantidad: String(d.cantidad),
        precio_costo: String(d.precio_costo),
      })),
    );
    setEditandoDetalle(true);
  };

  const guardarEdicionDetalle = async () => {
    if (!detalleOrden) return;
    setGuardandoEdicion(true);
    try {
      for (const item of valoresDetalleEdit) {
        const cant = Math.trunc(Number(item.cantidad));
        const costo = Number(item.precio_costo);
        if (!Number.isInteger(cant) || cant < 1) {
          throw new Error('La cantidad debe ser un entero mayor a 0');
        }
        if (!Number.isFinite(costo) || costo < 0) {
          throw new Error('El costo debe ser un número válido mayor o igual a 0');
        }
        const { error: err } = await supabase
          .from('detalle_compra')
          .update({ cantidad: cant, precio_costo: costo })
          .eq('id', item.id);
        if (err) throw err;
      }
      setEditandoDetalle(false);
      await verOrden(detalleOrden);
      await cargar();
    } catch (e) {
      setError(mensajeErrorBD(e));
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const eliminarOrden = async (o: OrdenCompra) => {
    if (!window.confirm(`¿Estás seguro de eliminar la orden ${o.num_orden}? Esta acción no se puede deshacer.`)) return;
    try {
      await supabase.from('detalle_compra').delete().eq('id_orden_compra', o.id);
      const { error: err } = await supabase.from('ordenes_compra').delete().eq('id', o.id);
      if (err) throw err;
      setDetalleOrden(null);
      await cargar();
    } catch (e) {
      setError(mensajeErrorBD(e));
    }
  };

  const cambiarEstado = async (o: OrdenCompra, estado: 'recibida' | 'anulada') => {
    if (estado === 'recibida' && !window.confirm('¿Marcar como recibida? El stock subirá según los ítems.')) return;
    const { error: err } = await supabase.from('ordenes_compra').update({ estado }).eq('id', o.id);
    if (err) setError(mensajeErrorBD(err));
    else {
      setDetalleOrden(null);
      await cargar();
    }
  };

  return (
    <Pagina
      titulo="Compras a proveedor"
      descripcion="Órdenes de compra a proveedor (no confundir con la OC del cliente). Al recibirlas sube el stock. Solo Gerente."
      acciones={
        tab === 'ordenes' ? (
          <Boton onClick={abrirOrden}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Nueva orden
            </span>
          </Boton>
        ) : (
          <Boton onClick={() => abrirProv()}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Nuevo proveedor
            </span>
          </Boton>
        )
      }
    >
      <Aviso tipo="error">{error}</Aviso>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className={`g-btn g-btn-mini ${tab === 'ordenes' ? '' : 'g-btn-fantasma'}`} onClick={() => setTab('ordenes')}>
          Órdenes de compra
        </button>
        <button className={`g-btn g-btn-mini ${tab === 'proveedores' ? '' : 'g-btn-fantasma'}`} onClick={() => setTab('proveedores')}>
          Proveedores
        </button>
      </div>

      {tab === 'proveedores' ? (
        <div className="g-tarjeta">
          {cargando ? (
            <Cargando />
          ) : proveedores.length === 0 ? (
            <Vacio />
          ) : (
            <div className="g-tabla-wrap">
              <table className="g-tabla">
                <thead>
                  <tr><th>RUC</th><th>Razón social</th><th>Contacto</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {proveedores.map((p) => (
                    <tr key={p.id}>
                      <td>{p.ruc}</td>
                      <td style={{ fontWeight: 600 }}>{p.razon_social}</td>
                      <td>{p.telefono || p.correo || '—'}</td>
                      <td><Badge valor={p.activo ? 'activo' : 'inactivo'} /></td>
                      <td>
                        <button className="g-btn g-btn-fantasma g-btn-mini" onClick={() => abrirProv(p)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="g-tarjeta">
          <div style={{ marginBottom: 14 }}>
            <select className="g-select" value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="recibida">Recibidas</option>
              <option value="anulada">Anuladas</option>
            </select>
          </div>
          {cargando ? (
            <Cargando />
          ) : ordenes.length === 0 ? (
            <Vacio />
          ) : (
            <div className="g-tabla-wrap">
              <table className="g-tabla">
                <thead>
                  <tr><th>N.°</th><th>Fecha</th><th>Proveedor</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {ordenes.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600 }}>{o.num_orden}</td>
                      <td>{formatoFecha(o.fecha_emision)}</td>
                      <td>{o.proveedor?.razon_social || '—'}</td>
                      <td><Badge valor={o.estado} /></td>
                      <td>
                        <button className="g-btn g-btn-fantasma g-btn-mini" onClick={() => void verOrden(o)}>Ver</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {abiertoProv && (
        <Modal titulo={editandoProv ? 'Editar proveedor' : 'Nuevo proveedor'} onCerrar={() => setAbiertoProv(false)}>
          <Aviso tipo="error">{provError}</Aviso>
          <div className="g-grid-2">
            <Campo label="RUC (11 dígitos)">
              <input className="g-input" value={prov.ruc} onChange={(e) => setProv({ ...prov, ruc: e.target.value })} />
            </Campo>
            <Campo label="Razón social">
              <input className="g-input" value={prov.razon_social} onChange={(e) => setProv({ ...prov, razon_social: e.target.value })} />
            </Campo>
          </div>
          <div className="g-grid-2">
            <Campo label="Teléfono">
              <input className="g-input" value={prov.telefono} onChange={(e) => setProv({ ...prov, telefono: e.target.value })} />
            </Campo>
            <Campo label="Correo">
              <input className="g-input" type="email" value={prov.correo} onChange={(e) => setProv({ ...prov, correo: e.target.value })} />
            </Campo>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 16 }}>
            <input type="checkbox" checked={prov.activo} onChange={(e) => setProv({ ...prov, activo: e.target.checked })} /> Activo
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Boton variante="fantasma" onClick={() => setAbiertoProv(false)}>Cancelar</Boton>
            <Boton onClick={() => void guardarProv()} disabled={guardandoProv}>
              {guardandoProv ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </Modal>
      )}

      {abiertoOrden && (
        <Modal titulo="Nueva orden de compra a proveedor" onCerrar={() => setAbiertoOrden(false)}>
          <Aviso tipo="error">{ordenError}</Aviso>
          <Campo label="Proveedor">
            <select className="g-select" value={idProveedor} onChange={(e) => setIdProveedor(e.target.value)}>
              <option value="">— Seleccionar proveedor —</option>
              {proveedores.filter((p) => p.activo).map((p) => (
                <option key={p.id} value={p.id}>{p.razon_social}</option>
              ))}
            </select>
          </Campo>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 75px 110px 34px', gap: 8, marginBottom: 4, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            <span>Producto</span>
            <span>Cant.</span>
            <span>Costo Unit. (S/)</span>
            <span></span>
          </div>
          {items.map((it, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 75px 110px 34px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select className="g-select" value={it.id_producto} onChange={(e) => setItem(idx, 'id_producto', e.target.value)}>
                <option value="">— Seleccionar producto —</option>
                {productos.filter((p) => p.tipo === 'producto').map((p) => {
                  const c = costos[p.id];
                  const infoCosto = c != null ? ` (Costo: S/ ${c})` : '';
                  return (
                    <option key={p.id} value={p.id}>{p.nombre}{infoCosto}</option>
                  );
                })}
              </select>
              <input className="g-input" type="number" min={1} value={it.cantidad} onChange={(e) => setItem(idx, 'cantidad', e.target.value)} />
              <input className="g-input" type="number" min={0} step="0.01" placeholder="0.00" value={it.precio_costo} onChange={(e) => setItem(idx, 'precio_costo', e.target.value)} />
              <button type="button" className="g-btn g-btn-peligro g-btn-mini" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} aria-label="Quitar">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <button type="button" className="g-btn g-btn-fantasma g-btn-mini" onClick={() => setItems((p) => [...p, { ...ITEM_VACIO }])}>
              <Plus size={13} /> Agregar ítem
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Total estimado: <strong style={{ color: 'var(--text-main)', fontSize: 14 }}>{formatoSoles(totalEstimadoNuevaOrden)}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <Boton variante="fantasma" onClick={() => setAbiertoOrden(false)}>Cancelar</Boton>
            <Boton onClick={() => void guardarOrden()} disabled={guardandoOrden}>
              {guardandoOrden ? 'Creando…' : 'Crear orden'}
            </Boton>
          </div>
        </Modal>
      )}

      {detalleOrden && (
        <Modal
          titulo={`Orden ${detalleOrden.num_orden}`}
          onCerrar={() => {
            setDetalleOrden(null);
            setEditandoDetalle(false);
          }}
        >
          <p className="g-descripcion">
            {detalleOrden.proveedor?.razon_social} · {formatoFecha(detalleOrden.fecha_emision)} ·{' '}
            <Badge valor={detalleOrden.estado} />
          </p>
          <div className="g-tabla-wrap">
            <table className="g-tabla">
              <thead><tr><th>Producto</th><th>Cant.</th><th>Costo Unit.</th><th>Subtotal</th></tr></thead>
              <tbody>
                {detalleItems.map((d) => {
                  const edit = valoresDetalleEdit.find((v) => v.id === d.id);
                  return (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 500 }}>{d.producto?.nombre || '—'}</td>
                      <td>
                        {editandoDetalle && edit ? (
                          <input
                            className="g-input"
                            type="number"
                            min={1}
                            style={{ width: 75, padding: '4px 6px' }}
                            value={edit.cantidad}
                            onChange={(e) =>
                              setValoresDetalleEdit((prev) =>
                                prev.map((v) => (v.id === d.id ? { ...v, cantidad: e.target.value } : v))
                              )
                            }
                          />
                        ) : (
                          d.cantidad
                        )}
                      </td>
                      <td>
                        {editandoDetalle && edit ? (
                          <input
                            className="g-input"
                            type="number"
                            min={0}
                            step="0.01"
                            style={{ width: 105, padding: '4px 6px' }}
                            value={edit.precio_costo}
                            onChange={(e) =>
                              setValoresDetalleEdit((prev) =>
                                prev.map((v) => (v.id === d.id ? { ...v, precio_costo: e.target.value } : v))
                              )
                            }
                          />
                        ) : (
                          formatoSoles(d.precio_costo)
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {editandoDetalle && edit
                          ? formatoSoles((Number(edit.cantidad) || 0) * (Number(edit.precio_costo) || 0))
                          : formatoSoles(d.subtotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {detalleOrden.estado === 'pendiente' && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <div>
                <Boton
                  variante="peligro"
                  onClick={() => void eliminarOrden(detalleOrden)}
                >
                  Eliminar orden
                </Boton>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {editandoDetalle ? (
                  <>
                    <Boton variante="fantasma" onClick={() => setEditandoDetalle(false)}>
                      Cancelar
                    </Boton>
                    <Boton onClick={() => void guardarEdicionDetalle()} disabled={guardandoEdicion}>
                      {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
                    </Boton>
                  </>
                ) : (
                  <>
                    <Boton variante="fantasma" onClick={iniciarEdicionDetalle}>
                      Editar costo / cant.
                    </Boton>
                    <Boton variante="peligro" onClick={() => void cambiarEstado(detalleOrden, 'anulada')}>
                      Anular
                    </Boton>
                    <Boton variante="exito" onClick={() => void cambiarEstado(detalleOrden, 'recibida')}>
                      Marcar recibida
                    </Boton>
                  </>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </Pagina>
  );
}
