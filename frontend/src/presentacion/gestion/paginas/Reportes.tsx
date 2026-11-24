import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Sparkles } from 'lucide-react';
import {
  supabase,
  formatoFecha,
  formatoSoles,
  mensajeErrorBD,
} from '../../../datos/supabase';
import { useAuthGestion } from '../AuthContext';
import { Aviso, Cargando, Pagina } from '../ui';
import { imprimirDocumento } from '../imprimir';
import { enMayusculas } from '../../../negocio/texto';

interface VentaReporte {
  id: number;
  num_venta: string;
  fecha: string;
  cliente: string;
  documento: string;
  subtotal: number;
  igv: number;
  total: number;
}

interface PuntoMensual {
  mes: string;
  ventas_sin_igv: number;
}

type Periodo = 'semanal' | 'mensual';

function inicioPeriodo(tipo: Periodo): Date {
  const ahora = new Date();
  if (tipo === 'semanal') {
    const d = new Date(ahora);
    const dia = d.getDay() === 0 ? 7 : d.getDay();
    d.setDate(d.getDate() - (dia - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(ahora.getFullYear(), ahora.getMonth(), 1);
}

function exportarExcel(nombre: string, items: VentaReporte[], totales: { subtotal: number; igv: number; total: number }) {
  const columnas = ['N.° venta', 'Fecha', 'Cliente', 'Documento', 'Subtotal', 'IGV', 'Total'];
  const filas = items
    .map(
      it =>
        `<tr><td>${it.num_venta}</td><td>${formatoFecha(it.fecha)}</td><td>${it.cliente}</td><td>${it.documento}</td><td>${it.subtotal.toFixed(2)}</td><td>${it.igv.toFixed(2)}</td><td>${it.total.toFixed(2)}</td></tr>`
    )
    .join('');

  const html = `<html><head><meta charset="utf-8" /></head><body>
    <table border="1">
      <thead><tr>${columnas.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${filas}
        <tr><td colspan="4"><strong>TOTAL</strong></td><td><strong>${totales.subtotal.toFixed(2)}</strong></td>
        <td><strong>${totales.igv.toFixed(2)}</strong></td><td><strong>${totales.total.toFixed(2)}</strong></td></tr>
      </tbody>
    </table>
  </body></html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombre}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

async function resumirTendenciasIA(puntos: PuntoMensual[]): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('asistente', {
      body: { accion: 'tendencias', datos: { puntos } },
    });
    const res = data as { resumen?: string } | null;
    if (error || !res?.resumen) throw error || new Error('sin respuesta');
    return res.resumen;
  } catch {
    if (puntos.length === 0) return 'No hay ventas confirmadas para resumir.';
    const ord = [...puntos].sort((a, b) => a.mes.localeCompare(b.mes));
    const prim = Number(ord[0].ventas_sin_igv);
    const ult = Number(ord[ord.length - 1].ventas_sin_igv);
    const varPct = prim > 0 ? ((ult - prim) / prim) * 100 : 0;
    return `En ${ord.length} periodo(s), las ventas sin IGV pasaron de S/ ${prim.toFixed(2)} a S/ ${ult.toFixed(2)} (${varPct >= 0 ? 'crecimiento' : 'caída'} de ${Math.abs(varPct).toFixed(1)} %).`;
  }
}

export function Reportes() {
  const { rol } = useAuthGestion();
  const [periodo, setPeriodo] = useState<Periodo>('mensual');
  const [ventas, setVentas] = useState<VentaReporte[]>([]);
  const [puntos, setPuntos] = useState<PuntoMensual[]>([]);
  const [analisisIA, setAnalisisIA] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const desde = inicioPeriodo(periodo).toISOString();

    const [vRes, pRes] = await Promise.all([
      supabase
        .from('ventas')
        .select('id, num_venta, fecha, subtotal, igv, total, cliente:id_cliente(nombre_razon_social, num_documento)')
        .eq('estado', 'confirmada')
        .gte('fecha', desde)
        .order('fecha', { ascending: false }),
      supabase.from('v_ventas_mensual').select('mes, ventas_sin_igv').order('mes'),
    ]);

    setPuntos((pRes.data as PuntoMensual[]) || []);
    if (vRes.error) setError(mensajeErrorBD(vRes.error));

    const mapeados: VentaReporte[] = ((vRes.data || []) as unknown as Array<{ id: number; num_venta: string; fecha: string; subtotal: number | string; igv: number | string; total: number | string; cliente?: { nombre_razon_social: string; num_documento: string } | null }>).map(v => ({
      id: v.id,
      num_venta: v.num_venta,
      fecha: v.fecha,
      cliente: enMayusculas(v.cliente?.nombre_razon_social) || '—',
      documento: v.cliente?.num_documento || '',
      subtotal: Number(v.subtotal),
      igv: Number(v.igv),
      total: Number(v.total),
    }));

    setVentas(mapeados);
    setCargando(false);
  }, [periodo]);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const totales = ventas.reduce(
    (acc, v) => ({
      subtotal: acc.subtotal + v.subtotal,
      igv: acc.igv + v.igv,
      total: acc.total + v.total,
    }),
    { subtotal: 0, igv: 0, total: 0 }
  );

  const ticketPromedio = ventas.length ? totales.total / ventas.length : 0;
  const etiquetaPeriodo = periodo === 'semanal' ? 'semanal' : 'mensual';

  const manejarExcel = () => {
    exportarExcel(`reporte-${etiquetaPeriodo}-${new Date().toISOString().slice(0, 10)}`, ventas, totales);
  };

  const manejarPDF = () => {
    const filas = ventas
      .map(
        v =>
          `<tr><td>${v.num_venta}</td><td>${formatoFecha(v.fecha)}</td><td>${v.cliente}</td><td>${formatoSoles(v.subtotal)}</td><td>${formatoSoles(v.igv)}</td><td>${formatoSoles(v.total)}</td></tr>`
      )
      .join('');

    imprimirDocumento(
      `Reporte ${etiquetaPeriodo}`,
      `
      <div class="marca">ROAS INGENIEROS E.I.R.L.</div>
      <div class="sub">RUC 20123456789 · Ate, Lima, Perú</div>
      <h1 style="margin-top:14px">Reporte de ventas ${etiquetaPeriodo}</h1>
      <div class="sub">Generado el ${formatoFecha(new Date().toISOString())} · Emitido por: rol ${rol}</div>
      <p>Ventas: <strong>${ventas.length}</strong> · Ticket promedio: <strong>${formatoSoles(ticketPromedio)}</strong></p>
      <table>
        <thead><tr><th>N.°</th><th>Fecha</th><th>Cliente</th><th>Subtotal</th><th>IGV</th><th>Total</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="totales">
        <div><span>Subtotal</span><span>${formatoSoles(totales.subtotal)}</span></div>
        <div><span>IGV (18 %)</span><span>${formatoSoles(totales.igv)}</span></div>
        <div class="total"><span>Total</span><span>${formatoSoles(totales.total)}</span></div>
      </div>`
    );
  };

  const analizarIA = async () => {
    setAnalisisIA('Analizando…');
    const res = await resumirTendenciasIA(puntos);
    setAnalisisIA(res);
  };

  return (
    <Pagina
      titulo="Reportes"
      descripcion={`Reporte ${etiquetaPeriodo} de ventas confirmadas. Exporta a Excel o PDF.`}
      acciones={
        <>
          <select
            className="g-select"
            value={periodo}
            onChange={e => setPeriodo(e.target.value as Periodo)}
          >
            <option value="semanal">Semanal</option>
            <option value="mensual">Mensual</option>
          </select>
          <button
            className="g-btn g-btn-fantasma"
            onClick={manejarExcel}
            disabled={ventas.length === 0}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Download size={15} /> Excel
            </span>
          </button>
          <button className="g-btn" onClick={manejarPDF} disabled={ventas.length === 0}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FileText size={15} /> PDF
            </span>
          </button>
          <button className="g-btn g-btn-fantasma" onClick={() => void analizarIA()}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={15} /> Resumen IA
            </span>
          </button>
        </>
      }
    >
      <Aviso tipo="error">{error}</Aviso>
      {analisisIA && (
        <Aviso tipo="info">
          <strong>Tendencias (asistente IA):</strong> {analisisIA}
        </Aviso>
      )}

      <div className="g-kpis">
        <div className="g-kpi">
          <div className="g-kpi-valor">{ventas.length}</div>
          <div className="g-kpi-label">Ventas confirmadas</div>
        </div>
        <div className="g-kpi">
          <div className="g-kpi-valor">{formatoSoles(totales.subtotal)}</div>
          <div className="g-kpi-label">Ventas sin IGV</div>
        </div>
        <div className="g-kpi">
          <div className="g-kpi-valor">{formatoSoles(totales.igv)}</div>
          <div className="g-kpi-label">IGV (18 %)</div>
        </div>
        <div className="g-kpi">
          <div className="g-kpi-valor">{formatoSoles(totales.total)}</div>
          <div className="g-kpi-label">Total</div>
        </div>
        <div className="g-kpi">
          <div className="g-kpi-valor">{formatoSoles(ticketPromedio)}</div>
          <div className="g-kpi-label">Ticket promedio</div>
        </div>
      </div>

      <div className="g-tarjeta">
        {cargando ? (
          <Cargando />
        ) : ventas.length === 0 ? (
          <p className="g-vacio">Sin ventas confirmadas en el periodo.</p>
        ) : (
          <div className="g-tabla-wrap">
            <table className="g-tabla">
              <thead>
                <tr>
                  <th>N.°</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Subtotal</th>
                  <th>IGV</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.num_venta}</td>
                    <td>{formatoFecha(v.fecha)}</td>
                    <td>{v.cliente}</td>
                    <td>{formatoSoles(v.subtotal)}</td>
                    <td>{formatoSoles(v.igv)}</td>
                    <td>{formatoSoles(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Pagina>
  );
}

