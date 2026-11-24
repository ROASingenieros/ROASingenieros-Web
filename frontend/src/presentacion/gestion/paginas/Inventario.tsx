import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import {
  supabase,
  formatoFecha,
  mensajeErrorBD,
  type MovimientoInventario,
  type Producto,
} from '../../../datos/supabase';
import { useAuthGestion } from '../AuthContext';
import { Aviso, Badge, Boton, Campo, Cargando, Modal, Pagina, Vacio } from '../ui';

interface StockBajo {
  id: number;
  codigo: string | null;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
}

export function Inventario() {
  const { puede } = useAuthGestion();
  const puedeAjustar = puede('admin', 'supervisor');

  const [bajos, setBajos] = useState<StockBajo[]>([]);
  const [movs, setMovs] = useState<MovimientoInventario[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fTipo, setFTipo] = useState('');
  const [fProducto, setFProducto] = useState('');

  const [abierto, setAbierto] = useState(false);
  const [idProducto, setIdProducto] = useState('');
  const [nuevoStock, setNuevoStock] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    let consulta = supabase
      .from('movimientos_inventario')
      .select('*, producto:id_producto(id,nombre,codigo)')
      .order('creado_en', { ascending: false })
      .limit(200);
    if (fTipo) consulta = consulta.eq('tipo', fTipo);
    if (fProducto) consulta = consulta.eq('id_producto', Number(fProducto));

    const [b, m, p] = await Promise.all([
      supabase.from('v_stock_bajo').select('*').order('stock_actual'),
      consulta,
      supabase.from('productos').select('id, nombre, codigo, stock_actual, tipo, activo').order('nombre'),
    ]);
    if (m.error) setError(mensajeErrorBD(m.error));
    setBajos((b.data as StockBajo[]) || []);
    setMovs((m.data as MovimientoInventario[]) || []);
    setProductos((p.data as Producto[]) || []);
    setCargando(false);
  }, [fTipo, fProducto]);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const abrirAjuste = (prod?: Producto) => {
    setIdProducto(prod ? String(prod.id) : '');
    setNuevoStock(prod ? String(prod.stock_actual) : '');
    setMotivo('');
    setFormError(null);
    setAbierto(true);
  };

  const productoSeleccionado = productos.find((p) => String(p.id) === idProducto);

  const guardar = async () => {
    setFormError(null);
    if (!idProducto) return setFormError('Selecciona un producto.');
    if (nuevoStock === '' || Number(nuevoStock) < 0) return setFormError('El nuevo stock no puede ser negativo.');
    setGuardando(true);
    const cantStock = Math.trunc(Number(nuevoStock));
    const { error: err } = await supabase.rpc('ajustar_stock', {
      p_id_producto: Number(idProducto),
      p_nuevo_stock: cantStock,
      p_motivo: motivo.trim() || null,
    });
    if (err) {
      setGuardando(false);
      setFormError(mensajeErrorBD(err));
      return;
    }
    // Si el nuevo stock queda en 0 o menos, desactivar y ocultar de la web automáticamente
    if (cantStock <= 0) {
      await supabase
        .from('productos')
        .update({ activo: false, visible_web: false })
        .eq('id', Number(idProducto));
    }
    setGuardando(false);
    setAbierto(false);
    await cargar();
  };

  return (
    <Pagina
      titulo="Inventario"
      descripcion="Stock actual, alertas de mínimo y trazabilidad de movimientos. El ajuste manual registra un movimiento."
      acciones={
        puedeAjustar ? (
          <Boton onClick={() => abrirAjuste()}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Ajuste de stock
            </span>
          </Boton>
        ) : null
      }
    >
      <Aviso tipo="error">{error}</Aviso>

      {bajos.length > 0 && (
        <div className="g-tarjeta" style={{ borderLeft: '4px solid var(--accent-yellow)' }}>
          <h3 className="g-titulo" style={{ fontSize: 15, marginBottom: 10 }}>
            <AlertTriangle size={15} color="var(--accent-yellow)" style={{ verticalAlign: -2 }} /> Alertas de stock
            bajo ({bajos.length})
          </h3>
          <div className="g-tabla-wrap">
            <table className="g-tabla">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Stock actual</th>
                  <th>Stock mínimo</th>
                  {puedeAjustar && <th></th>}
                </tr>
              </thead>
              <tbody>
                {bajos.map((b) => (
                  <tr key={b.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{b.codigo || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{b.nombre}</td>
                    <td style={{ color: 'var(--accent-yellow)', fontWeight: 700 }}>{b.stock_actual}</td>
                    <td>{b.stock_minimo}</td>
                    {puedeAjustar && (
                      <td>
                        <button
                          className="g-btn g-btn-fantasma g-btn-mini"
                          onClick={() => {
                            const p = productos.find((x) => x.id === b.id);
                            if (p) abrirAjuste(p);
                          }}
                        >
                          Ajustar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="g-tarjeta">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <h3 className="g-titulo" style={{ fontSize: 15, flex: 1 }}>Historial de movimientos</h3>
          <select className="g-select" value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="venta">Ventas</option>
            <option value="compra">Compras</option>
            <option value="ajuste">Ajustes</option>
          </select>
          <select className="g-select" value={fProducto} onChange={(e) => setFProducto(e.target.value)}>
            <option value="">Todos los productos</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>

        {cargando ? (
          <Cargando />
        ) : movs.length === 0 ? (
          <Vacio texto="Sin movimientos que coincidan con el filtro." />
        ) : (
          <div className="g-tabla-wrap">
            <table className="g-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Stock resultante</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id}>
                    <td>{formatoFecha(m.creado_en)}</td>
                    <td>{m.producto?.nombre || '—'}</td>
                    <td><Badge valor={m.tipo} /></td>
                    <td style={{ color: m.cantidad < 0 ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: 600 }}>
                      {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                    </td>
                    <td>{m.stock_resultante}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{m.referencia || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {abierto && (
        <Modal titulo="Ajuste manual de stock" onCerrar={() => setAbierto(false)}>
          <Aviso tipo="error">{formError}</Aviso>
          <Campo label="Producto">
            <select className="g-select" value={idProducto} onChange={(e) => setIdProducto(e.target.value)}>
              <option value="">— seleccionar —</option>
              {productos
                .filter((p) => p.tipo === 'producto')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (actual: {p.stock_actual}){p.activo ? '' : ' — [Inactivo]'}
                  </option>
                ))}
            </select>
          </Campo>
          <Campo label="Nuevo stock">
            <input
              className="g-input"
              type="number"
              min={0}
              value={nuevoStock}
              onChange={(e) => setNuevoStock(e.target.value)}
            />
          </Campo>
          <Campo label="Motivo (queda en el movimiento)">
            <input
              className="g-input"
              placeholder="ej. conteo físico, merma, corrección"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Campo>
          {productoSeleccionado && (
            <p className="g-descripcion" style={{ fontSize: 12 }}>
              {productoSeleccionado.nombre}: {productoSeleccionado.stock_actual} → {nuevoStock || '—'}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Boton variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton>
            <Boton onClick={() => void guardar()} disabled={guardando}>
              {guardando ? 'Aplicando…' : 'Aplicar ajuste'}
            </Boton>
          </div>
        </Modal>
      )}
    </Pagina>
  );
}
