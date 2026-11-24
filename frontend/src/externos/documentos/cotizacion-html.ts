// ============================================================================
// Cotización imprimible (Imprimir / PDF) con el formato del Excel de la
// empresa: mismo membrete, mismas secciones y mismos datos que la plantilla
// `frontend/public/plantillas/cotizacion.xlsx`.
// ============================================================================
// Los logos del membrete se extraen del propio Excel con
// `npm run plantilla:cotizacion` (van a frontend/public/documentos/).
// ============================================================================
import { EMPRESA } from '../../negocio/empresa';
import { formatoSoles } from '../../datos/supabase';
import {
  asuntoDeCotizacion,
  componentesFecha,
  datosCliente,
  datosItems,
  extraerMetaNotas,
  type CotizacionDoc,
  type ItemDocumento,
} from '../excel/documentos';

const BASE = import.meta.env.BASE_URL || '/';

/** CSS propio de la cotización (se suma al de la ventana de impresión). */
export const ESTILOS_COTIZACION = `
  .cot { font-size: 12px; }
  .cot-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .cot-cab img { display: block; }
  .cot-logo { height: 62px; width: auto; }
  .cot-sello { height: 58px; width: auto; }
  .cot-ciudad { text-align: right; font-weight: 700; margin: 6px 0 14px; }
  .cot-fila { display: flex; gap: 8px; margin-bottom: 3px; }
  .cot-etq { font-weight: 700; color: #b91c1c; min-width: 82px; }
  .cot-val { flex: 1; }
  .cot-intro { margin: 12px 0 10px; border-bottom: 2px solid #111; padding-bottom: 8px; }
  .cot-tabla { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .cot-tabla th, .cot-tabla td { border: 1px solid #94a3b8; padding: 4px 6px; font-size: 11.5px; }
  .cot-tabla th { background: #f1f5f9; text-align: center; }
  .cot-num { text-align: right; white-space: nowrap; }
  .cot-centro { text-align: center; }
  .cot-pie { display: flex; gap: 20px; margin-top: 12px; }
  .cot-pie > div { flex: 1; }
  .cot-pie > div:last-child { flex: 0 0 300px; }
  .cot-fijo { color: #b91c1c; font-weight: 700; }
  .cot-total { font-weight: 700; border-top: 2px solid #111; }
  .cot-cierre { margin-top: 16px; }
  @media print { .cot { font-size: 11px; } }
`;

function fila(etiqueta: string, valor: string): string {
  return `<div class="cot-fila"><span class="cot-etq">${etiqueta}</span><span class="cot-val">${valor}</span></div>`;
}

/** Cuerpo HTML de la cotización (lo que se ve al Imprimir / Guardar como PDF). */
export function htmlCotizacion(cotizacion: CotizacionDoc, detalle: ItemDocumento[]): string {
  const cliente = datosCliente(cotizacion.cliente);
  const items = datosItems(detalle);
  const { dia, mes, anio } = componentesFecha(cotizacion.fecha_emision);
  const meta = extraerMetaNotas(cotizacion.notas);
  const asunto = (cotizacion.asunto || meta.asunto || asuntoDeCotizacion(detalle)).trim();
  const formaPago = (cotizacion.forma_pago || meta.forma_pago || EMPRESA.forma_pago || 'Contado').trim();
  const notas = (meta.notasLimpio || cotizacion.notas || '').trim();

  const filasItems = items
    .map(
      (item) => `<tr>
        <td class="cot-centro">${item.numero}</td>
        <td>${item.descripcion}</td>
        <td class="cot-centro">${item.unidad}</td>
        <td class="cot-centro">${item.cantidad}</td>
        <td class="cot-num">${formatoSoles(Number(item.precio))}</td>
        <td class="cot-num">${formatoSoles(Number(item.total))}</td>
      </tr>`,
    )
    .join('');

  return `
  <div class="cot">
    <div class="cot-cab">
      <img class="cot-logo" src="${BASE}documentos/membrete-logo.png" alt="${EMPRESA.nombre}" />
      <img class="cot-sello" src="${BASE}documentos/membrete-2.png" alt="" />
    </div>

    <div class="cot-ciudad">${EMPRESA.ciudad}, ${dia}/${mes}/${anio}</div>

    ${fila('SEÑOR(ES):', cliente.nombre)}
    ${fila(`${cliente.etiqueta_documento}:`, cliente.documento)}
    ${fila('DIRECCION:', cliente.direccion)}
    ${fila('ASUNTO:', asunto)}
    ${fila('ATENCION:', cliente.telefono || cliente.correo || '')}

    <p class="cot-intro">En atención a su amable solicitud, y de acuerdo a lo conversado, nos es grato alcanzarles nuestra cotización por el siguiente producto, servicio o asesoría:</p>

    <table class="cot-tabla">
      <thead>
        <tr>
          <th style="width:46px">ITEM</th>
          <th>DESCRIPCION</th>
          <th style="width:64px">UNIDAD</th>
          <th style="width:64px">CANTIDAD</th>
          <th style="width:92px">COSTO UNITARIO</th>
          <th style="width:92px">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${filasItems || '<tr><td class="cot-centro">1</td><td colspan="5">Sin ítems registrados.</td></tr>'}
      </tbody>
    </table>

    <div class="cot-pie">
      <div>
        <div><span class="cot-fijo">TIEMPO DE EJECUCION:</span> según disponibilidad de stock.</div>
        <div style="margin-top:6px"><span class="cot-fijo">PERFIL DEL ING. ELECTRICISTA ENCARGADO DEL TRABAJO:</span></div>
        <div>* Especialista y Asesor en Inspecciones Técnicas de Seguridad.</div>
        <div>* Inspector Especializado CENEPRED (DS N° 002-2018 PCM).</div>
        <div style="margin-top:8px"><span class="cot-fijo">NOTAS:</span> ${notas || 'Ninguna.'}</div>
      </div>
      <div>
        <div class="cot-fila"><span class="cot-etq">SUB TOTAL</span><span class="cot-num">${formatoSoles(cotizacion.subtotal)}</span></div>
        <div class="cot-fila"><span class="cot-etq">IGV 18%</span><span class="cot-num">${formatoSoles(cotizacion.igv)}</span></div>
        <div class="cot-fila cot-total"><span class="cot-etq">TOTAL</span><span class="cot-num">${formatoSoles(cotizacion.total)}</span></div>
        <div class="cot-fila" style="margin-top:8px"><span class="cot-etq">FORMA DE PAGO</span><span>${formaPago}</span></div>
        <div class="cot-fila"><span class="cot-etq">CUENTA INTERBANK</span><span>${EMPRESA.cuenta_interbank}</span></div>
        <div class="cot-fila"><span class="cot-etq">CUENTA INTERBANCARIA</span><span>${EMPRESA.cuenta_interbancaria}</span></div>
        <div class="cot-fila"><span class="cot-etq">TITULAR</span><span>${EMPRESA.razon_social}</span></div>
      </div>
    </div>

    <div class="cot-cierre">
      <div>A la espera de sus gratas órdenes, quedamos de Ustedes.</div>
      <div style="margin-top:10px">Atentamente.</div>
    </div>
  </div>`;
}
