// ============================================================================
// Asistente de IA (Fase 6) — cliente del panel
// ============================================================================
// Llama a la Edge Function `asistente` (la clave del proveedor vive en el
// servidor). Si la función no está desplegada o falla, se usan reglas locales
// equivalentes: la IA NUNCA debe bloquear el trabajo del panel.
//
// Privacidad: solo se envían los campos que el asistente revisa.
// ============================================================================
import { supabase } from '../datos/supabase';

export interface DatosFiscal {
  tipo_comprobante?: 'boleta' | 'factura';
  tipo_documento_cliente?: string; // '1' DNI, '6' RUC, '4' CE, '7' Pasaporte
  num_documento_cliente?: string;
  nombre_cliente?: string;
  subtotal?: number;
  igv?: number;
  total?: number;
}

export interface ResultadoFiscal {
  disponible: boolean;
  observaciones: string[];
}

function auditoriaFiscalLocal(d: DatosFiscal): string[] {
  const obs: string[] = [];
  const cod = d.tipo_documento_cliente;
  const doc = (d.num_documento_cliente || '').replace(/\D/g, '');
  const subtotal = Number(d.subtotal || 0);
  const igv = Number(d.igv || 0);
  const total = Number(d.total || 0);

  if (d.tipo_comprobante === 'factura' && cod !== '6')
    obs.push('Una factura requiere RUC del cliente; el documento no parece un RUC (código SUNAT 6).');
  if (d.tipo_comprobante === 'boleta' && cod === '6')
    obs.push('Hay RUC pero el comprobante es boleta; verifica si corresponde factura.');
  if (cod === '6' && doc.length !== 11) obs.push(`El RUC debe tener 11 dígitos (hay ${doc.length}).`);
  if (cod === '1' && doc.length !== 8) obs.push(`El DNI debe tener 8 dígitos (hay ${doc.length}).`);
  if (!d.nombre_cliente || !d.nombre_cliente.trim()) obs.push('Falta el nombre o razón social del cliente.');
  if (subtotal <= 0) obs.push('El subtotal debe ser mayor que 0.');
  if (total > 0 && Math.abs(total - (subtotal + igv)) > 0.05)
    obs.push(`El total (${total.toFixed(2)}) no coincide con subtotal + IGV (${(subtotal + igv).toFixed(2)}).`);
  if (subtotal > 0 && Math.abs(igv - Math.round(subtotal * 18) / 100) > 0.05)
    obs.push(`El IGV no corresponde al 18 % del subtotal (esperado ~${(subtotal * 0.18).toFixed(2)}).`);
  if (obs.length === 0) obs.push('Sin observaciones: los datos son coherentes.');
  return obs;
}

/** Auditoría fiscal previa a emitir. Sugiere, no corrige ni bloquea. */
export async function auditoriaFiscal(datos: DatosFiscal): Promise<ResultadoFiscal> {
  try {
    const { data, error } = await supabase.functions.invoke('asistente', {
      body: { accion: 'auditoria_fiscal', datos },
    });
    const res = data as { observaciones?: string[]; disponible?: boolean } | null;
    if (error || !res?.observaciones) throw error || new Error('sin respuesta');
    return { disponible: !!res.disponible, observaciones: res.observaciones };
  } catch {
    return { disponible: false, observaciones: auditoriaFiscalLocal(datos) };
  }
}

/** Resumen de tendencias de ventas a partir de los puntos del reporte. */
export async function resumenTendencias(puntos: { mes: string; ventas_sin_igv: number }[]): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('asistente', {
      body: { accion: 'tendencias', datos: { puntos } },
    });
    const res = data as { resumen?: string } | null;
    if (error || !res?.resumen) throw error || new Error('sin respuesta');
    return res.resumen;
  } catch {
    if (puntos.length === 0) return 'No hay ventas confirmadas para resumir.';
    const orden = [...puntos].sort((a, b) => a.mes.localeCompare(b.mes));
    const primero = Number(orden[0].ventas_sin_igv);
    const ultimo = Number(orden[orden.length - 1].ventas_sin_igv);
    const delta = primero > 0 ? ((ultimo - primero) / primero) * 100 : 0;
    return `En ${orden.length} periodo(s), las ventas sin IGV pasaron de S/ ${primero.toFixed(
      2,
    )} a S/ ${ultimo.toFixed(2)} (${delta >= 0 ? 'crecimiento' : 'caída'} de ${Math.abs(delta).toFixed(1)} %).`;
  }
}
