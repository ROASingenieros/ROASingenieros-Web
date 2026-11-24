import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Upload } from 'lucide-react';
import {
  supabase,
  formatoSoles,
  mensajeErrorBD,
  UNIDADES_MEDIDA,
  type Producto,
  type Categoria,
  type Marca,
  type Modelo,
  type TipoItem,
} from '../../../datos/supabase';
import { useAuthGestion } from '../AuthContext';
import { Aviso, Badge, Boton, Campo, Cargando, Modal, Pagina, Vacio } from '../ui';

// ============================================================================
// Formulario (alta / edición)
// ============================================================================
interface FormState {
  tipo: TipoItem;
  codigo: string;
  nombre: string;
  descripcion: string;
  imagen_url: string;
  id_categoria: string;
  id_marca: string;
  id_modelo: string;
  unidad_medida: string;
  precio_unitario: string;
  stock_actual: string;
  stock_minimo: string;
  stock_maximo: string;
  visible_web: boolean;
  activo: boolean;
  precio_costo: string;
}

const VACIO: FormState = {
  tipo: 'producto',
  codigo: '',
  nombre: '',
  descripcion: '',
  imagen_url: '',
  id_categoria: '',
  id_marca: '',
  id_modelo: '',
  unidad_medida: 'unidad',
  precio_unitario: '',
  stock_actual: '0',
  stock_minimo: '0',
  stock_maximo: '',
  visible_web: true,
  activo: true,
  precio_costo: '',
};

function aForm(p: Producto, costo?: number | null): FormState {
  return {
    tipo: p.tipo,
    codigo: p.codigo ?? '',
    nombre: p.nombre,
    descripcion: p.descripcion ?? '',
    imagen_url: p.imagen_url ?? '',
    id_categoria: String(p.id_categoria ?? ''),
    id_marca: p.id_marca ? String(p.id_marca) : '',
    id_modelo: p.id_modelo ? String(p.id_modelo) : '',
    unidad_medida: p.unidad_medida ?? 'unidad',
    precio_unitario: String(p.precio_unitario ?? ''),
    stock_actual: String(p.stock_actual ?? 0),
    stock_minimo: String(p.stock_minimo ?? 0),
    stock_maximo: p.stock_maximo != null ? String(p.stock_maximo) : '',
    visible_web: p.visible_web,
    activo: p.activo,
    precio_costo: costo != null ? String(costo) : '',
  };
}

// ============================================================================
// Página
// ============================================================================
export function Productos() {
  const { puede } = useAuthGestion();
  const esAdmin = puede('admin');
  const puedeEscribir = puede('admin', 'supervisor');

  const [lista, setLista] = useState<Producto[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [costos, setCostos] = useState<Record<number, number>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fActivo, setFActivo] = useState('');

  const [editando, setEditando] = useState<Producto | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState<FormState>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const [p, c, m, mo, co] = await Promise.all([
      supabase
        .from('productos')
        .select('*, categoria:id_categoria(id,nombre), marca:id_marca(id,nombre)')
        .order('creado_en', { ascending: false }),
      supabase.from('categoria').select('*').order('nombre'),
      supabase.from('marca').select('*').order('nombre'),
      supabase.from('modelo').select('*').order('nombre'),
      esAdmin ? supabase.from('producto_costo').select('id_producto, precio_costo') : Promise.resolve({ data: [] }),
    ]);
    if (p.error) setError(mensajeErrorBD(p.error));
    setLista((p.data as Producto[]) || []);
    setCats((c.data as Categoria[]) || []);
    setMarcas((m.data as Marca[]) || []);
    setModelos((mo.data as Modelo[]) || []);
    const mapa: Record<number, number> = {};
    ((co.data as { id_producto: number; precio_costo: number }[]) || []).forEach((r) => {
      mapa[r.id_producto] = r.precio_costo;
    });
    setCostos(mapa);
    setCargando(false);
  }, [esAdmin]);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter((p) => {
      if (fTipo && p.tipo !== fTipo) return false;
      if (fActivo === 'activos' && !p.activo) return false;
      if (fActivo === 'inactivos' && p.activo) return false;
      if (q && !(`${p.nombre} ${p.codigo ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [lista, busca, fTipo, fActivo]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ ...VACIO, id_categoria: cats[0] ? String(cats[0].id) : '' });
    setFormError(null);
    setAbierto(true);
  };

  const abrirEditar = (p: Producto) => {
    setEditando(p);
    setForm(aForm(p, costos[p.id]));
    setFormError(null);
    setAbierto(true);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const subirImagen = async (file: File) => {
    setSubiendo(true);
    setFormError(null);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const ruta = `productos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: err } = await supabase.storage.from('productos').upload(ruta, file, { upsert: false });
      if (err) throw err;
      const { data } = supabase.storage.from('productos').getPublicUrl(ruta);
      set('imagen_url', data.publicUrl);
    } catch (e) {
      setFormError(
        'No se pudo subir la imagen (¿existe el bucket "productos"?). Puedes pegar una URL manualmente. ' +
          mensajeErrorBD(e),
      );
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    setFormError(null);
    if (!form.nombre.trim()) return setFormError('El nombre es obligatorio.');
    if (!form.id_categoria) return setFormError('Selecciona una categoría.');
    if (form.precio_unitario === '' || Number(form.precio_unitario) < 0)
      return setFormError('El precio sin IGV es obligatorio y no puede ser negativo.');
    if (form.tipo !== 'servicio' && form.stock_maximo !== '' && Number(form.stock_minimo) > Number(form.stock_maximo))
      return setFormError('El stock mínimo no puede ser mayor que el stock máximo.');

    const esServicio = form.tipo === 'servicio';
    const stockNum = Math.max(0, Math.trunc(Number(form.stock_actual) || 0));
    // Regla de negocio: sin stock se coloca como inactivo y no visible en la web
    const sinStock = !esServicio && stockNum <= 0;

    const payload = {
      tipo: form.tipo,
      codigo: form.codigo.trim() || null,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      imagen_url: form.imagen_url.trim() || null,
      id_categoria: Number(form.id_categoria),
      id_marca: form.id_marca ? Number(form.id_marca) : null,
      id_modelo: form.id_modelo ? Number(form.id_modelo) : null,
      unidad_medida: form.unidad_medida || 'unidad',
      precio_unitario: Number(form.precio_unitario),
      stock_minimo: esServicio ? 0 : Math.max(0, Math.trunc(Number(form.stock_minimo) || 0)),
      stock_maximo: esServicio || form.stock_maximo === '' ? null : Math.max(0, Math.trunc(Number(form.stock_maximo))),
      visible_web: sinStock ? false : form.visible_web,
      activo: sinStock ? false : form.activo,
    };

    setGuardando(true);
    let idProducto: number | null = editando ? editando.id : null;
    try {
      if (!editando) {
        const stockInicial = esServicio ? 0 : stockNum;
        const { data, error: err } = await supabase
          .from('productos')
          .insert({ ...payload, stock_actual: stockInicial })
          .select('id')
          .single();
        if (err) throw err;
        idProducto = (data as { id: number }).id;
      } else {
        const { error: err } = await supabase.from('productos').update(payload).eq('id', editando.id);
        if (err) throw err;
        // El stock no se edita directo: se registra un movimiento 'ajuste'.
        if (!esServicio) {
          const nuevo = stockNum;
          if (nuevo !== editando.stock_actual) {
            const { error: errAjuste } = await supabase.rpc('ajustar_stock', {
              p_id_producto: editando.id,
              p_nuevo_stock: nuevo,
              p_motivo: nuevo <= 0 ? 'producto sin stock (desactivado automáticamente)' : 'edición de producto en el panel',
            });
            if (errAjuste) throw errAjuste;
          }
        }
      }

      // El costo solo lo maneja el Gerente.
      if (esAdmin && form.precio_costo !== '' && idProducto != null) {
        const { error: errCosto } = await supabase
          .from('producto_costo')
          .upsert({ id_producto: idProducto, precio_costo: Number(form.precio_costo) });
        if (errCosto) throw errCosto;
      }

      setAbierto(false);
      await cargar();
    } catch (e) {
      setFormError(mensajeErrorBD(e));
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async (p: Producto) => {
    const { error: err } = await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id);
    if (err) setError(mensajeErrorBD(err));
    else await cargar();
  };

  return (
    <Pagina
      titulo="Productos y servicios"
      descripcion="Catálogo interno. Los servicios no manejan stock; lo inactivo o no visible no sale en la web."
      acciones={
        puedeEscribir ? (
          <Boton onClick={abrirNuevo}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Nuevo
            </span>
          </Boton>
        ) : null
      }
    >
      <Aviso tipo="error">{error}</Aviso>

      <div className="g-tarjeta">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--text-muted)' }} />
            <input
              className="g-input"
              style={{ paddingLeft: 34, width: '100%' }}
              placeholder="Buscar por nombre o código…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <select className="g-select" value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="producto">Productos</option>
            <option value="servicio">Servicios</option>
          </select>
          <select className="g-select" value={fActivo} onChange={(e) => setFActivo(e.target.value)}>
            <option value="">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </div>

        {cargando ? (
          <Cargando />
        ) : filtrados.length === 0 ? (
          <Vacio texto="No hay productos que coincidan con el filtro." />
        ) : (
          <div className="g-tabla-wrap">
            <table className="g-tabla">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Precio (sin IGV)</th>
                  {esAdmin && <th>Costo</th>}
                  <th>Stock</th>
                  <th>Web</th>
                  <th>Estado</th>
                  {puedeEscribir && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id}>
                    <td><Badge valor={p.tipo} /></td>
                    <td style={{ color: 'var(--text-muted)' }}>{p.codigo || '—'}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.nombre}</td>
                    <td>{p.categoria?.nombre || '—'}</td>
                    <td>{formatoSoles(p.precio_unitario)}</td>
                    {esAdmin && <td>{costos[p.id] != null ? formatoSoles(costos[p.id]) : '—'}</td>}
                    <td>
                      {p.tipo === 'servicio'
                        ? '—'
                        : `${p.stock_actual} (mín ${p.stock_minimo})`}
                    </td>
                    <td>{p.visible_web ? 'Sí' : 'No'}</td>
                    <td><Badge valor={p.activo ? 'activo' : 'inactivo'} /></td>
                    {puedeEscribir && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="g-btn g-btn-fantasma g-btn-mini"
                          onClick={() => abrirEditar(p)}
                          aria-label="Editar"
                        >
                          <Pencil size={13} />
                        </button>{' '}
                        <button
                          type="button"
                          className="g-btn g-btn-fantasma g-btn-mini"
                          onClick={() => void alternarActivo(p)}
                        >
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {abierto && (
        <Modal titulo={editando ? 'Editar producto' : 'Nuevo producto'} onCerrar={() => setAbierto(false)}>
          <Aviso tipo="error">{formError}</Aviso>

          <div className="g-grid-3">
            <Campo label="Tipo">
              <select
                className="g-select"
                value={form.tipo}
                onChange={(e) => set('tipo', e.target.value as TipoItem)}
              >
                <option value="producto">Producto</option>
                <option value="servicio">Servicio</option>
              </select>
            </Campo>
            <Campo label="Código">
              <input className="g-input" value={form.codigo} onChange={(e) => set('codigo', e.target.value)} />
            </Campo>
            <Campo label="Unidad de medida">
              <select
                className="g-select"
                value={form.unidad_medida}
                onChange={(e) => set('unidad_medida', e.target.value)}
              >
                {UNIDADES_MEDIDA.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo label="Nombre">
            <input className="g-input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
          </Campo>

          <Campo label="Descripción">
            <textarea
              className="g-textarea"
              rows={2}
              value={form.descripcion}
              onChange={(e) => set('descripcion', e.target.value)}
            />
          </Campo>

          <div className="g-grid-3">
            <Campo label="Categoría">
              <select
                className="g-select"
                value={form.id_categoria}
                onChange={(e) => set('id_categoria', e.target.value)}
              >
                <option value="">—</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Marca">
              <select className="g-select" value={form.id_marca} onChange={(e) => set('id_marca', e.target.value)}>
                <option value="">—</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Modelo">
              <select className="g-select" value={form.id_modelo} onChange={(e) => set('id_modelo', e.target.value)}>
                <option value="">—</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </Campo>
          </div>

          <div className="g-grid-2">
            <Campo label="Precio unitario sin IGV (S/)">
              <input
                className="g-input"
                type="number"
                min={0}
                step="0.01"
                value={form.precio_unitario}
                onChange={(e) => set('precio_unitario', e.target.value)}
              />
            </Campo>
            {esAdmin ? (
              <Campo label="Costo (S/ · solo Gerente)">
                <input
                  className="g-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.precio_costo}
                  onChange={(e) => set('precio_costo', e.target.value)}
                />
              </Campo>
            ) : (
              <div />
            )}
          </div>

          {form.tipo === 'producto' && (
            <div className="g-grid-3">
              <Campo label={editando ? 'Stock actual (genera ajuste)' : 'Stock inicial'}>
                <input
                  className="g-input"
                  type="number"
                  min={0}
                  value={form.stock_actual}
                  onChange={(e) => set('stock_actual', e.target.value)}
                />
              </Campo>
              <Campo label="Stock mínimo">
                <input
                  className="g-input"
                  type="number"
                  min={0}
                  value={form.stock_minimo}
                  onChange={(e) => set('stock_minimo', e.target.value)}
                />
              </Campo>
              <Campo label="Stock máximo">
                <input
                  className="g-input"
                  type="number"
                  min={0}
                  value={form.stock_maximo}
                  onChange={(e) => set('stock_maximo', e.target.value)}
                />
              </Campo>
            </div>
          )}

          <Campo label="Imagen">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="g-input"
                style={{ flex: 1, minWidth: 180 }}
                placeholder="https://…"
                value={form.imagen_url}
                onChange={(e) => set('imagen_url', e.target.value)}
              />
              <label className="g-btn g-btn-fantasma g-btn-mini" style={{ cursor: 'pointer' }}>
                <Upload size={13} /> {subiendo ? 'Subiendo…' : 'Subir'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void subirImagen(f);
                  }}
                />
              </label>
              {form.imagen_url && (
                <img
                  src={form.imagen_url}
                  alt="Vista previa"
                  style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }}
                />
              )}
            </div>
          </Campo>

          <div style={{ display: 'flex', gap: 18, margin: '4px 0 10px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: form.tipo === 'producto' && Number(form.stock_actual) <= 0 ? 0.6 : 1 }}>
              <input
                type="checkbox"
                checked={form.visible_web && (form.tipo === 'servicio' || Number(form.stock_actual) > 0)}
                disabled={form.tipo === 'producto' && Number(form.stock_actual) <= 0}
                onChange={(e) => set('visible_web', e.target.checked)}
              />
              Visible en la web
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: form.tipo === 'producto' && Number(form.stock_actual) <= 0 ? 0.6 : 1 }}>
              <input
                type="checkbox"
                checked={form.activo && (form.tipo === 'servicio' || Number(form.stock_actual) > 0)}
                disabled={form.tipo === 'producto' && Number(form.stock_actual) <= 0}
                onChange={(e) => set('activo', e.target.checked)}
              />
              Activo
            </label>
          </div>
          {form.tipo === 'producto' && Number(form.stock_actual) <= 0 && (
            <p className="g-descripcion" style={{ fontSize: 12, marginTop: 0, marginBottom: 16, color: '#f59e0b' }}>
              ⚠️ Sin stock disponible: el producto se guardará como inactivo y no aparecerá en la página web.
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Boton variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton>
            <Boton onClick={() => void guardar()} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </Modal>
      )}
    </Pagina>
  );
}
