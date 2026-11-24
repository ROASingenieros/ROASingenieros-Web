import { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp,
  FileText,
  AlertTriangle,
  Clock,
  ShieldAlert,
  DollarSign,
  Plus,
  Boxes,
  ShoppingCart,
  ArrowRight,
} from 'lucide-react';
import { supabase, formatoSoles, mensajeErrorBD } from '../../../datos/supabase';
import { useAuthGestion } from '../AuthContext';
import { useIrA } from '../router';
import { Aviso, Cargando, Pagina } from '../ui';
import {
  GraficoTendenciaVentas,
  GraficoPipelineDonut,
  GraficoTopProductos,
} from '../componentes/Graficos';

interface Kpis {
  cotizaciones: number;
  totalCotizado: number;
  ventas: number;
  totalVentasHistoricas: number;
  ticket: number;
  ventasSinIgv: number;
  solicitudes: number;
  garantiasPorVencer: number;
}

interface ConteoEstadosCotizacion {
  borrador: number;
  enviada: number;
  aprobada: number;
  rechazada: number;
  vencida: number;
  total: number;
}

interface ItemStockBajo {
  id: number;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
}

interface FilaMargen {
  nombre: string;
  unidades: number;
  ingreso: number;
  ganancia: number;
  pct_ganancia: number;
}

interface FilaMes {
  mes: string;
  n_ventas: number;
  ventas_sin_igv: number;
}

type Periodo = 'mensual' | 'semanal' | 'anual' | 'historico';

function inicioPeriodo(p: Periodo): Date | null {
  const hoy = new Date();
  if (p === 'historico') return null;
  if (p === 'anual') {
    return new Date(hoy.getFullYear(), 0, 1);
  }
  if (p === 'semanal') {
    const d = new Date(hoy);
    const dia = d.getDay() === 0 ? 7 : d.getDay();
    d.setDate(d.getDate() - (dia - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
}

function KpiModerno({
  valor,
  label,
  sub,
  color,
  icono,
}: {
  valor: string;
  label: string;
  sub?: string;
  color: string;
  icono: React.ReactNode;
}) {
  return (
    <div className="g-kpi-moderno" style={{ borderLeftColor: color }}>
      <div>
        <div className="g-kpi-valor">{valor}</div>
        <div className="g-kpi-label">{label}</div>
        {sub && <div className="g-kpi-sub">{sub}</div>}
      </div>
      <div
        className="g-kpi-icono-caja"
        style={{
          background: `${color}18`,
          color: color,
        }}
      >
        {icono}
      </div>
    </div>
  );
}

export function Panel() {
  const { rol } = useAuthGestion();
  const irA = useIrA();
  const esAdmin = rol === 'admin';

  const [periodo, setPeriodo] = useState<Periodo>('mensual');
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [pipeline, setPipeline] = useState<ConteoEstadosCotizacion>({
    borrador: 0,
    enviada: 0,
    aprobada: 0,
    rechazada: 0,
    vencida: 0,
    total: 0,
  });
  const [itemsStockBajo, setItemsStockBajo] = useState<ItemStockBajo[]>([]);
  const [margenes, setMargenes] = useState<FilaMargen[]>([]);
  const [meses, setMeses] = useState<FilaMes[]>([]);
  const [stockBajo, setStockBajo] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const fInicio = inicioPeriodo(periodo);
    const desde = fInicio ? fInicio.toISOString() : null;
    const limiteGarantia = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    let qCot = supabase.from('cotizaciones').select('id', { count: 'exact', head: true });
    let qVen = supabase.from('ventas').select('subtotal,total').eq('estado', 'confirmada');
    let qCotEstados = supabase.from('cotizaciones').select('estado, total');

    if (desde) {
      qCot = qCot.gte('fecha_emision', desde);
      qVen = qVen.gte('fecha', desde);
      qCotEstados = qCotEstados.gte('fecha_emision', desde);
    }

    const [cot, ven, venHist, sol, gar, sb, ma, me, cotEstados, sbDetalle] = await Promise.all([
      qCot,
      qVen,
      supabase.from('ventas').select('id', { count: 'exact', head: true }).eq('estado', 'confirmada'),
      esAdmin
        ? supabase.from('auditoria').select('id', { count: 'exact', head: true }).eq('tabla', 'solicitud_web')
        : Promise.resolve({ count: 0 }),
      supabase.from('garantias').select('id', { count: 'exact', head: true }).gte('fecha_caducidad', new Date().toISOString().slice(0, 10)).lte('fecha_caducidad', limiteGarantia),
      supabase.from('v_stock_bajo').select('id', { count: 'exact', head: true }),
      esAdmin
        ? supabase.from('v_margen_producto').select('*').order('ingreso', { ascending: false }).limit(8)
        : Promise.resolve({ data: [] }),
      supabase.from('v_ventas_mensual').select('*').order('mes', { ascending: false }).limit(6),
      qCotEstados,
      supabase.from('v_stock_bajo').select('id, nombre, stock_actual, stock_minimo').order('stock_actual').limit(4),
    ]);

    const ventasArr = (ven.data as { subtotal: number; total: number }[]) || [];
    const sumaSubtotal = ventasArr.reduce((s, v) => s + Number(v.subtotal), 0);
    const sumaTotal = ventasArr.reduce((s, v) => s + Number(v.total), 0);

    const cotList = (cotEstados.data as { estado: string; total: number }[]) || [];
    const conteoPipe: ConteoEstadosCotizacion = {
      borrador: 0,
      enviada: 0,
      aprobada: 0,
      rechazada: 0,
      vencida: 0,
      total: cotList.length,
    };
    let sumaCotizado = 0;
    for (const c of cotList) {
      sumaCotizado += Number(c.total || 0);
      if (c.estado in conteoPipe) {
        conteoPipe[c.estado as keyof Omit<ConteoEstadosCotizacion, 'total'>]++;
      }
    }

    setKpis({
      cotizaciones: cot.count ?? 0,
      totalCotizado: sumaCotizado,
      ventas: ventasArr.length,
      totalVentasHistoricas: venHist.count ?? 0,
      ticket: ventasArr.length ? sumaTotal / ventasArr.length : 0,
      ventasSinIgv: sumaSubtotal,
      solicitudes: Math.max(0, (sol.count ?? 0) - (() => {
        try {
          const r = localStorage.getItem('roas_solicitudes_descartadas');
          return r ? (JSON.parse(r) as unknown[]).length : 0;
        } catch {
          return 0;
        }
      })()),
      garantiasPorVencer: gar.count ?? 0,
    });
    setPipeline(conteoPipe);
    setItemsStockBajo((sbDetalle.data as ItemStockBajo[]) || []);
    setMargenes((ma.data as FilaMargen[]) || []);
    setMeses((me.data as FilaMes[]) || []);
    setStockBajo(sb.count ?? 0);
    if (ven.error) setError(mensajeErrorBD(ven.error));
    setCargando(false);
  }, [periodo, esAdmin]);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const tasaEfectividad = pipeline.total > 0
    ? Math.round((pipeline.aprobada / pipeline.total) * 100)
    : 0;

  return (
    <Pagina
      titulo="Panel de Control"
      descripcion={`Control operativo y financiero (${
        periodo === 'semanal'
          ? 'esta semana'
          : periodo === 'mensual'
          ? 'este mes'
          : periodo === 'anual'
          ? 'este año'
          : 'todo el historial'
      }).`}
      acciones={
        <select className="g-select" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
          <option value="mensual">Este mes</option>
          <option value="semanal">Esta semana</option>
          <option value="anual">Este año</option>
          <option value="historico">Todo el historial</option>
        </select>
      }
    >
      <Aviso tipo="error">{error}</Aviso>

      {/* --- Acciones Rápidas --- */}
      <div className="g-acciones-rapidas no-print">
        <button className="g-btn-rapido" onClick={() => irA('cotizaciones')}>
          <Plus size={15} style={{ color: 'var(--accent-blue)' }} /> Nueva cotización
        </button>
        <button className="g-btn-rapido" onClick={() => irA('ventas')}>
          <ShoppingCart size={15} style={{ color: 'var(--accent-green)' }} /> Registrar venta
        </button>
        <button
          className={`g-btn-rapido ${stockBajo > 0 ? 'g-btn-rapido-alerta' : ''}`}
          onClick={() => irA('inventario')}
        >
          <Boxes size={15} />
          {stockBajo > 0 ? `Alerta: ${stockBajo} en stock crítico` : 'Consultar inventario'}
        </button>
      </div>

      {cargando || !kpis ? (
        <Cargando />
      ) : (
        <>
          {/* --- Grid de KPIs --- */}
          <div className="g-kpis">
            <KpiModerno
              valor={formatoSoles(kpis.ventasSinIgv)}
              label="Ventas sin IGV"
              sub={
                periodo === 'historico'
                  ? `${kpis.ventas} ventas confirmadas en total`
                  : `${kpis.ventas} confirmadas este período (${kpis.totalVentasHistoricas} en total)`
              }
              color="#22c55e"
              icono={<DollarSign size={20} />}
            />
            <KpiModerno
              valor={String(kpis.cotizaciones)}
              label="Cotizaciones emitidas"
              sub={`Total: ${formatoSoles(kpis.totalCotizado)}`}
              color="#3b82f6"
              icono={<FileText size={20} />}
            />
            <KpiModerno
              valor={formatoSoles(kpis.ticket)}
              label="Ticket promedio"
              sub="Por orden confirmada"
              color="#8b5cf6"
              icono={<TrendingUp size={20} />}
            />
            <KpiModerno
              valor={String(stockBajo)}
              label="Productos bajo mínimo"
              sub={stockBajo > 0 ? 'Requieren reposición' : 'Nivel de almacén óptimo'}
              color={stockBajo > 0 ? '#ef4444' : '#eab308'}
              icono={<AlertTriangle size={20} />}
            />
            <KpiModerno
              valor={String(kpis.garantiasPorVencer)}
              label="Garantías por vencer"
              sub="En los próximos 30 días"
              color="#f97316"
              icono={<Clock size={20} />}
            />
            {esAdmin && (
              <KpiModerno
                valor={String(kpis.solicitudes)}
                label="Solicitudes web"
                sub="Mensajes por atender"
                color="#06b6d4"
                icono={<ShieldAlert size={20} />}
              />
            )}
          </div>

          {/* --- Alerta de Stock Crítico Inmediato --- */}
          {itemsStockBajo.length > 0 && (
            <div className="g-alerta-inventario">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-red)', fontWeight: 700 }}>
                  <AlertTriangle size={18} />
                  <span>Materiales con Stock Crítico en Almacén</span>
                </div>
                <button
                  className="g-btn g-btn-fantasma g-btn-mini"
                  style={{ color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                  onClick={() => irA('inventario')}
                >
                  Ver inventario completo <ArrowRight size={13} style={{ marginLeft: 4 }} />
                </button>
              </div>

              <div className="g-alerta-items">
                {itemsStockBajo.map((item) => (
                  <div className="g-alerta-item" key={item.id}>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }} title={item.nombre}>
                      {item.nombre}
                    </span>
                    <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>
                      {item.stock_actual} / mín {item.stock_minimo}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- Grid Principal de Gráficos: Tendencia de Ventas + Pipeline Donut --- */}
          <div className="g-charts-grid">
            <div className="g-tarjeta" style={{ marginBottom: 0 }}>
              <GraficoTendenciaVentas data={meses} />
            </div>

            <div className="g-tarjeta" style={{ marginBottom: 0 }}>
              <div className="g-tarjeta-header" style={{ marginBottom: 12 }}>
                <div>
                  <span className="g-chart-sub">Conversión comercial</span>
                  <h4 className="g-chart-titulo">Pipeline de Cotizaciones</h4>
                </div>
                <span className="g-badge g-badge-verde" style={{ fontSize: 11.5, padding: '4px 10px' }}>
                  {tasaEfectividad}% efectividad
                </span>
              </div>
              <GraficoPipelineDonut pipeline={pipeline} efectividad={tasaEfectividad} />
            </div>
          </div>

          {/* --- Top Productos por Ingreso y Margen (Gerencia / Admin) --- */}
          {esAdmin && (
            <div className="g-tarjeta">
              <div className="g-tarjeta-header">
                <div>
                  <span className="g-chart-sub">Métricas de rentabilidad comercial</span>
                  <h4 className="g-chart-titulo">Top Productos por Ingreso y Margen (Gerencia)</h4>
                </div>
                <span className="g-badge g-badge-morado" style={{ fontSize: 11.5, padding: '4px 10px' }}>
                  Reporte en tiempo real
                </span>
              </div>
              <GraficoTopProductos data={margenes} />
            </div>
          )}
        </>
      )}
    </Pagina>
  );
}

