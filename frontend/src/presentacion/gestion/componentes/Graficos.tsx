import { useState } from 'react';
import { TrendingUp, PieChart, Award, ShoppingBag } from 'lucide-react';
import { formatoSoles } from '../../../datos/supabase';

// ============================================================================
// Tipos para los gráficos
// ============================================================================
export interface FilaMes {
  mes: string;
  n_ventas: number;
  ventas_sin_igv: number;
}

const NOMBRES_MES: Record<string, string> = {
  '01': 'Ene.',
  '02': 'Feb.',
  '03': 'Mar.',
  '04': 'Abr.',
  '05': 'May.',
  '06': 'Jun.',
  '07': 'Jul.',
  '08': 'Ago.',
  '09': 'Set.',
  '10': 'Oct.',
  '11': 'Nov.',
  '12': 'Dic.',
};

export function formatearMes(mesStr: string, conAnio = false): string {
  if (!mesStr) return '';
  const partes = mesStr.slice(0, 7).split('-');
  if (partes.length >= 2) {
    const anio = partes[0];
    const mm = partes[1].padStart(2, '0');
    const nom = NOMBRES_MES[mm] || mm;
    return conAnio ? `${nom} ${anio}` : nom;
  }
  return mesStr;
}

function obtenerMesesTendencia(data: FilaMes[]): FilaMes[] {
  const mapa = new Map<string, FilaMes>();
  for (const f of data) {
    if (f.mes) {
      const m = f.mes.slice(0, 7);
      mapa.set(m, {
        mes: m,
        n_ventas: Number(f.n_ventas) || 0,
        ventas_sin_igv: Number(f.ventas_sin_igv) || 0,
      });
    }
  }

  const hoy = new Date();
  const meses: FilaMes[] = [];

  // Muestra una ventana continua de los últimos 6 meses hasta el mes actual
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const clave = `${yyyy}-${mm}`;
    const existente = mapa.get(clave);
    meses.push(
      existente || {
        mes: clave,
        n_ventas: 0,
        ventas_sin_igv: 0,
      }
    );
  }

  return meses;
}

export interface ConteoEstadosCotizacion {
  borrador: number;
  enviada: number;
  aprobada: number;
  rechazada: number;
  vencida: number;
  total: number;
}

export interface FilaMargen {
  nombre: string;
  unidades: number;
  ingreso: number;
  ganancia: number;
  pct_ganancia: number;
}

// ============================================================================
// Utilidad: Curva Bézier suave para gráfico de área / spline
// ============================================================================
function generarSpline(puntos: { x: number; y: number }[]): string {
  if (puntos.length === 0) return '';
  if (puntos.length === 1) return `M ${puntos[0].x} ${puntos[0].y}`;
  if (puntos.length === 2) {
    return `M ${puntos[0].x} ${puntos[0].y} L ${puntos[1].x} ${puntos[1].y}`;
  }

  let d = `M ${puntos[0].x} ${puntos[0].y}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[i === 0 ? 0 : i - 1];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[i + 2 < puntos.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// ============================================================================
// 1. Gráfico de Tendencia de Ventas (Spline Area con gradiente y tooltips)
// ============================================================================
export function GraficoTendenciaVentas({ data }: { data: FilaMes[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Orden cronológico continuo (últimos 6 meses hasta el actual)
  const items = obtenerMesesTendencia(data);

  if (items.length === 0) {
    return (
      <div className="g-chart-vacio">
        <TrendingUp size={28} className="g-chart-vacio-icono" />
        <p>Aún no hay ventas confirmadas registradas en el historial.</p>
      </div>
    );
  }

  const svgWidth = 620;
  const svgHeight = 220;
  const padLeft = 68;
  const padRight = 32;
  const padTop = 26;
  const padBottom = 42;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const valores = items.map((m) => Number(m.ventas_sin_igv) || 0);
  const maxRaw = Math.max(...valores, 1);
  // Redondear techo para escala limpia
  const maxValor = Math.ceil(maxRaw / 1000) * 1000 || 1000;

  const puntos = items.map((item, idx) => {
    const x = items.length === 1
      ? padLeft + chartW / 2
      : padLeft + (idx / (items.length - 1)) * chartW;
    const y = padTop + chartH - (Number(item.ventas_sin_igv) / maxValor) * chartH;
    return { x, y, item };
  });

  const splineD = generarSpline(puntos);
  const primerPunto = puntos[0];
  const ultimoPunto = puntos[puntos.length - 1];
  const baseAreaY = padTop + chartH;
  const areaD = `${splineD} L ${ultimoPunto.x} ${baseAreaY} L ${primerPunto.x} ${baseAreaY} Z`;

  // 3 líneas de cuadrícula horizontales
  const lineasGuia = [
    { valor: maxValor, y: padTop },
    { valor: maxValor / 2, y: padTop + chartH / 2 },
    { valor: 0, y: baseAreaY },
  ];

  const itemActivo = hoverIndex !== null ? puntos[hoverIndex] : null;

  return (
    <div className="g-chart-wrap">
      <div className="g-chart-header">
        <div>
          <span className="g-chart-sub">Facturación neta histórica</span>
          <h4 className="g-chart-titulo">Tendencia de Ventas (sin IGV)</h4>
        </div>
        {itemActivo && (
          <div className="g-chart-tooltip-badge">
            <span className="g-chart-badge-mes">
              {formatearMes(itemActivo.item.mes, true)}:
            </span>
            <strong className="g-chart-badge-monto">
              {formatoSoles(itemActivo.item.ventas_sin_igv)}
            </strong>
            <span className="g-chart-badge-count">
              ({itemActivo.item.n_ventas} {itemActivo.item.n_ventas === 1 ? 'venta' : 'ventas'})
            </span>
          </div>
        )}
      </div>

      <div className="g-chart-svg-container">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="g-chart-svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="areaGradientVentas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
              <stop offset="50%" stopColor="#0369a1" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineaGradientVentas" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            <filter id="glowFiltro" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Líneas guía horizontales */}
          {lineasGuia.map((g, idx) => (
            <g key={idx} className="g-chart-guia">
              <line
                x1={padLeft}
                y1={g.y}
                x2={svgWidth - padRight}
                y2={g.y}
                stroke="var(--glass-border)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
                y={g.y + 4}
                textAnchor="end"
                className="g-chart-eje-texto"
              >
                {formatoSoles(g.valor).replace(',00', '')}
              </text>
            </g>
          ))}

          {/* Relleno con gradiente */}
          <path d={areaD} fill="url(#areaGradientVentas)" />

          {/* Línea curva spline */}
          <path
            d={splineD}
            fill="none"
            stroke="url(#lineaGradientVentas)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glowFiltro)"
          />

          {/* Puntos y etiquetas de eje X */}
          {puntos.map((pt, idx) => {
            const fechaStr = formatearMes(pt.item.mes);
            const isHover = hoverIndex === idx;

            return (
              <g
                key={idx}
                className="g-chart-punto-grupo"
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Zona de hover invisible para facilitar interacción */}
                <rect
                  x={pt.x - 24}
                  y={padTop}
                  width="48"
                  height={chartH + 20}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                />

                {/* Línea vertical en hover */}
                {isHover && (
                  <line
                    x1={pt.x}
                    y1={padTop}
                    x2={pt.x}
                    y2={baseAreaY}
                    stroke="var(--accent-blue)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.8"
                  />
                )}

                {/* Círculo del punto */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHover ? 6 : 4}
                  className="g-chart-punto"
                  style={{
                    fill: isHover ? '#38bdf8' : 'var(--bg-primary)',
                    stroke: isHover ? '#ffffff' : '#38bdf8',
                    strokeWidth: isHover ? 2.5 : 2,
                    transition: 'all 160ms ease-out',
                  }}
                />

                {/* Texto del mes en el eje X */}
                <text
                  x={pt.x}
                  y={baseAreaY + 20}
                  textAnchor="middle"
                  className={`g-chart-eje-x ${isHover ? 'g-chart-eje-x-activo' : ''}`}
                >
                  {fechaStr.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ============================================================================
// 2. Gráfico Donut de Pipeline Comercial (con desglose y hover interactivo)
// ============================================================================
export function GraficoPipelineDonut({
  pipeline,
  efectividad,
}: {
  pipeline: ConteoEstadosCotizacion;
  efectividad: number;
}) {
  const [activoKey, setActivoKey] = useState<string | null>(null);

  const segmentos = [
    { key: 'aprobada', label: 'Aprobadas', valor: pipeline.aprobada, color: '#22c55e' },
    { key: 'enviada', label: 'Enviadas', valor: pipeline.enviada, color: '#38bdf8' },
    { key: 'borrador', label: 'Borradores', valor: pipeline.borrador, color: '#94a3b8' },
    { key: 'vencida', label: 'Vencidas', valor: pipeline.vencida, color: '#f59e0b' },
    { key: 'rechazada', label: 'Rechazadas', valor: pipeline.rechazada, color: '#ef4444' },
  ];

  const total = pipeline.total || segmentos.reduce((s, x) => s + x.valor, 0);

  // Parámetros del Donut SVG
  const size = 160;
  const strokeWidth = 18;
  const radio = (size - strokeWidth) / 2;
  const centro = size / 2;
  const circunferencia = 2 * Math.PI * radio;

  let acumulado = 0;
  const arcos = segmentos.map((seg) => {
    const fraccion = total > 0 ? seg.valor / total : 0;
    const strokeDasharray = `${fraccion * circunferencia} ${circunferencia}`;
    const strokeDashoffset = -acumulado * circunferencia;
    acumulado += fraccion;
    return {
      ...seg,
      fraccion,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="g-donut-panel">
      <div className="g-donut-grafico-lado">
        <div className="g-donut-svg-wrap">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="g-donut-svg">
            {/* Pista de fondo */}
            <circle
              cx={centro}
              cy={centro}
              r={radio}
              fill="transparent"
              stroke="var(--glass-border)"
              strokeWidth={strokeWidth}
            />

            {/* Arcos de datos */}
            {arcos.map((arco) => {
              if (arco.valor === 0) return null;
              const isHighlight = activoKey === arco.key;
              return (
                <circle
                  key={arco.key}
                  cx={centro}
                  cy={centro}
                  r={radio}
                  fill="transparent"
                  stroke={arco.color}
                  strokeWidth={isHighlight ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={arco.strokeDasharray}
                  strokeDashoffset={arco.strokeDashoffset}
                  strokeLinecap="round"
                  style={{
                    transform: 'rotate(-90deg)',
                    transformOrigin: 'center',
                    cursor: 'pointer',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    opacity: activoKey && !isHighlight ? 0.35 : 1,
                  }}
                  onMouseEnter={() => setActivoKey(arco.key)}
                  onMouseLeave={() => setActivoKey(null)}
                />
              );
            })}
          </svg>

          {/* Centro del Donut */}
          <div className="g-donut-centro">
            <span className="g-donut-centro-num">{efectividad}%</span>
            <span className="g-donut-centro-label">Efectividad</span>
          </div>
        </div>
      </div>

      {/* Leyenda y desglose a la derecha */}
      <div className="g-donut-leyenda">
        <div className="g-donut-leyenda-header">
          <PieChart size={15} style={{ color: 'var(--accent-blue)' }} />
          <span>Distribución comercial ({total} {total === 1 ? 'cotización' : 'cotizaciones'})</span>
        </div>
        <div className="g-donut-lista">
          {segmentos.map((seg) => {
            const pct = total > 0 ? Math.round((seg.valor / total) * 100) : 0;
            const isHover = activoKey === seg.key;
            return (
              <div
                key={seg.key}
                className={`g-donut-item ${isHover ? 'g-donut-item-activo' : ''}`}
                onMouseEnter={() => setActivoKey(seg.key)}
                onMouseLeave={() => setActivoKey(null)}
              >
                <div className="g-donut-item-izq">
                  <span className="g-donut-punto" style={{ background: seg.color }} />
                  <span className="g-donut-item-label">{seg.label}</span>
                </div>
                <div className="g-donut-item-der">
                  <strong className="g-donut-item-val">{seg.valor}</strong>
                  <span className="g-donut-item-pct">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. Gráfico de Top Productos por Ingreso y Margen (Ranking Gerencial)
// ============================================================================
export function GraficoTopProductos({ data }: { data: FilaMargen[] }) {
  if (data.length === 0) {
    return (
      <div className="g-chart-vacio">
        <ShoppingBag size={28} className="g-chart-vacio-icono" />
        <p>Sin datos de margen (requiere ventas confirmadas con costo de producto registrado).</p>
      </div>
    );
  }

  const maxIngreso = Math.max(1, ...data.map((m) => m.ingreso));

  return (
    <div className="g-top-productos-wrap">
      {data.map((item, idx) => {
        const pctBarra = Math.min(100, Math.max(4, (item.ingreso / maxIngreso) * 100));
        const esTop3 = idx < 3;
        const colorMedalla = idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#f97316' : 'var(--text-muted)';

        return (
          <div className="g-top-producto-fila" key={item.nombre}>
            {/* Medalla / Posición */}
            <div className="g-top-posicion" style={{ color: colorMedalla }}>
              {esTop3 ? <Award size={16} /> : <span className="g-top-num">#{idx + 1}</span>}
            </div>

            {/* Nombre y barra */}
            <div className="g-top-cuerpo">
              <div className="g-top-info">
                <span className="g-top-nombre" title={item.nombre}>
                  {item.nombre}
                </span>
                <span className="g-top-unidades">
                  {item.unidades} {item.unidades === 1 ? 'unidad' : 'unidades'} vendidas
                </span>
              </div>

              {/* Barra de progreso de ingresos */}
              <div className="g-top-track">
                <div
                  className="g-top-fill"
                  style={{
                    width: `${pctBarra}%`,
                    background:
                      idx === 0
                        ? 'linear-gradient(90deg, #38bdf8, #818cf8)'
                        : idx === 1
                        ? 'linear-gradient(90deg, #0ea5e9, #6366f1)'
                        : 'linear-gradient(90deg, #0284c7, #4f46e5)',
                  }}
                />
              </div>
            </div>

            {/* Métricas a la derecha */}
            <div className="g-top-metricas">
              <span className="g-top-ingreso">{formatoSoles(item.ingreso)}</span>
              <span className="g-top-margen-badge">
                +{Number(item.pct_ganancia).toFixed(1)}% margen
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

