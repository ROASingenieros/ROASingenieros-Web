// ============================================================================
// Capa de facturación (Fase 4) — interfaz + implementación simulada (mock)
// ============================================================================
// El proveedor real (OSE/PSE como Nubefact u otro) aún no está decidido: la
// interfaz queda pluggable y el mock se usa mientras tanto. En producción la
// emisión debe pasar por la Edge Function `facturacion` (la clave del OSE/PSE
// vive solo en el servidor), que puede implementar esta misma interfaz.
//
// REGLA: mientras se use el mock los documentos NO son válidos ante SUNAT y
// deben rotularse con AVISO_MODO_PRUEBA.
// ============================================================================

export type TipoComprobanteSunat = 'boleta' | 'factura';

/** Datos mínimos que se envían al proveedor para emitir un comprobante. */
export interface DatosComprobante {
  tipo: TipoComprobanteSunat;
  serie: string;
  correlativo: number;
  num_venta: string;
  fecha: string;
  emisor: { ruc: string; razon_social: string };
  cliente: {
    tipo_documento: string;
    num_documento: string;
    nombre: string;
    direccion?: string | null;
  };
  items: { descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }[];
  subtotal: number;
  igv: number;
  total: number;
}

/** Datos mínimos para emitir una guía de remisión. */
export interface DatosGuia {
  serie: string;
  correlativo: number;
  num_venta: string;
  fecha_traslado: string;
  punto_partida: string | null;
  punto_llegada: string;
  emisor: { ruc: string; razon_social: string };
  destinatario: { num_documento: string; nombre: string; direccion?: string | null };
}

export interface RespuestaEmision {
  exito: boolean;
  /** true = el documento NO tiene validez tributaria (modo prueba). */
  modo_prueba: boolean;
  hash_cpe: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  mensaje: string;
  /** Respuesta cruda del proveedor; se guarda en *_sunat.respuesta. */
  crudo: Record<string, unknown>;
}

export interface RespuestaConsulta {
  estado: string;
  mensaje: string;
  crudo: Record<string, unknown>;
}

/** Contrato que debe cumplir cualquier OSE/PSE. */
export interface ProveedorFacturacion {
  emitirComprobante(datos: DatosComprobante): Promise<RespuestaEmision>;
  emitirGuia(datos: DatosGuia): Promise<RespuestaEmision>;
  consultarEstado(hashCpe: string): Promise<RespuestaConsulta>;
}

/** Texto obligatorio en todo documento generado con el mock. */
export const AVISO_MODO_PRUEBA = 'Documento no válido tributariamente (modo prueba)';

/**
 * Cadena de texto oficial para el código QR de comprobantes electrónicos según SUNAT
 * (Resolución de Superintendencia N.° 097-2012/SUNAT y modificatorias).
 * Orden de los 10 campos obligatorios separados por pleca (|):
 * 1. RUC del emisor
 * 2. Tipo de comprobante (01: Factura, 03: Boleta, 07: NC, 08: ND)
 * 3. Serie
 * 4. Correlativo
 * 5. Monto total de IGV
 * 6. Importe total
 * 7. Fecha de emisión (YYYY-MM-DD)
 * 8. Tipo de documento del adquirente (1: DNI, 6: RUC, 0: otros/sin doc)
 * 9. Número de documento del adquirente
 * 10. Código Hash (DigestValue del XML)
 */
export function construirCadenaQrSunat(datos: {
  rucEmisor: string;
  tipo: TipoComprobanteSunat | string;
  serie: string;
  correlativo: number | string;
  igv: number;
  total: number;
  fecha: string;
  tipoDocCliente?: string | null;
  numDocCliente?: string | null;
  hash?: string | null;
}): string {
  const codigoTipo = datos.tipo === 'factura' || datos.tipo === '01' ? '01' : '03';
  const tipoDoc = datos.tipoDocCliente || (codigoTipo === '01' ? '6' : '1');
  const numDoc = (datos.numDocCliente || '').trim() || '-';
  const fechaYmd = datos.fecha.slice(0, 10);
  const hash = datos.hash || 'MOCK';

  return [
    datos.rucEmisor,
    codigoTipo,
    datos.serie,
    datos.correlativo,
    Number(datos.igv || 0).toFixed(2),
    Number(datos.total || 0).toFixed(2),
    fechaYmd,
    tipoDoc,
    numDoc,
    hash,
  ].join('|');
}

// ============================================================================
// Implementación simulada
// ============================================================================
function hashSimulado(serie: string, correlativo: number, valor: number): string {
  const base = `${serie}-${String(correlativo).padStart(5, '0')}|${valor.toFixed(2)}`;
  // Hash determinista corto solo para pruebas (no es un CPE real).
  let h = 0;
  for (let i = 0; i < base.length; i += 1) h = (Math.imul(31, h) + base.charCodeAt(i)) | 0;
  return `MOCK-${(h >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
}

class FacturacionMock implements ProveedorFacturacion {
  async emitirComprobante(datos: DatosComprobante): Promise<RespuestaEmision> {
    const hash = hashSimulado(datos.serie, datos.correlativo, datos.total);
    return {
      exito: true,
      modo_prueba: true,
      hash_cpe: hash,
      pdf_url: null,
      xml_url: null,
      mensaje: `Emisión registrada: ${datos.tipo} ${datos.serie}-${datos.correlativo}.`,
      crudo: {
        modo_prueba: true,
        proveedor: 'mock',
        hash_cpe: hash,
        recibido_en: new Date().toISOString(),
      },
    };
  }

  async emitirGuia(datos: DatosGuia): Promise<RespuestaEmision> {
    const hash = hashSimulado(datos.serie, datos.correlativo, 0);
    return {
      exito: true,
      modo_prueba: true,
      hash_cpe: hash,
      pdf_url: null,
      xml_url: null,
      mensaje: `Emisión registrada: guía ${datos.serie}-${datos.correlativo}.`,
      crudo: {
        modo_prueba: true,
        proveedor: 'mock',
        hash_cpe: hash,
        recibido_en: new Date().toISOString(),
      },
    };
  }

  async consultarEstado(hashCpe: string): Promise<RespuestaConsulta> {
    return {
      estado: 'simulado',
      mensaje: `Consulta para ${hashCpe}.`,
      crudo: { modo_prueba: true, proveedor: 'mock' },
    };
  }
}

/**
 * Proveedor activo. Cuando se elija el OSE/PSE real, esta fábrica devolverá
 * el cliente que llama a la Edge Function `facturacion` en lugar del mock.
 */
export function proveedorFacturacion(): ProveedorFacturacion {
  return new FacturacionMock();
}

// ============================================================================
// PATRÓN FACTORY METHOD
// ============================================================================
// Centraliza la creación e instanciación de comprobantes (Boletas y Facturas),
// liberando a la UI de condicionales y del cálculo de desglose tributario del IGV.
export * from './comprobantefactory';

