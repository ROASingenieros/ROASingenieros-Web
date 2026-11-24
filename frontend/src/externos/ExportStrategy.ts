// ============================================================================
// PATRÓN DE DISEÑO DE COMPORTAMIENTO: STRATEGY (ESTRATEGIA)
// ============================================================================
//
// Módulo Orquestador: frontend/src/externos/ExportStrategy.ts
//
// Contexto y Propósito del Patrón:
// --------------------------------
// En el sistema de ROAS Ingenieros, una cotización aprobada o en borrador debe
// poder despacharse a través de tres canales o salidas completamente distintas:
//   1. Salida PDF / Impresión: Renderizado en ventana web con estilos corporativos
//      y diálogo de impresión / guardado como PDF (`cotizacion-html.ts` e `imprimir.ts`).
//   2. Salida Excel (XLSX): Generación y descarga directa del archivo binario
//      utilizando la plantilla oficial con marcas (`excel/documentos.ts` y `plantilla.ts`).
//   3. Salida WhatsApp: Formateo de mensaje estructurado con partidas, precios y
//      apertura directa del protocolo `wa.me` (`whatsapp.ts`).
//
// Problema:
// Si los componentes de la interfaz de usuario (como `Cotizaciones.tsx`) manejan
// directamente los detalles de implementación de cada salida, el código se acopla,
// se repite la preparación de datos y agregar un nuevo canal (como Email o Facturación)
// requeriría modificar múltiples vistas.
//
// Solución con el Patrón Strategy:
// Se define una familia de algoritmos de exportación, se encapsula cada uno en una
// clase independiente que implementa un contrato común (`IExportStrategy`) y se
// orquesta su ejecución en tiempo de ejecución a través de `ExportContext`.
//
// Estructura de Participantes:
// ---------------------------
// 1. Strategy (Interfaz Común):   `IExportStrategy`
// 2. Concrete Strategies:
//      - `PdfExportStrategy`:     Estrategia de impresión y exportación a PDF.
//      - `ExcelExportStrategy`:   Estrategia de descarga de libro Excel XLSX.
//      - `WhatsAppExportStrategy`: Estrategia de despacho por mensaje de WhatsApp.
// 3. Context (Contexto Orquestador): `ExportContext`
// 4. Registry & Helpers:          `ExportStrategyRegistry`, `exportarCotizacion()`
// ============================================================================

import {
  type CotizacionDoc,
  type ItemDocumento,
  PLANTILLA_COTIZACION,
  datosDeCotizacion,
  generarDocumento,
} from './excel/documentos';

import { htmlCotizacion, ESTILOS_COTIZACION } from './documentos/cotizacion-html';
import { imprimirDocumento } from '../presentacion/gestion/imprimir';
import { openWhatsApp } from './whatsapp';
import { formatoSoles } from '../datos/supabase';
import { EMPRESA } from '../negocio/empresa';

// ----------------------------------------------------------------------------
// CONTRATOS, TIPOS Y MODELOS DE DATOS
// ----------------------------------------------------------------------------

/** Canales de exportación soportados por el sistema. */
export type TipoExportacion = 'pdf' | 'excel' | 'whatsapp';

/** Datos consolidados de la cotización que consumen las estrategias. */
export interface DatosExportacionCotizacion {
  cotizacion: CotizacionDoc;
  items: ItemDocumento[];
  titulo?: string;
}

/** Opciones configurables para la exportación. */
export interface OpcionesExportacion {
  nombreArchivo?: string;
  plantilla?: string;
  telefonoDestino?: string;
  mensajePersonalizado?: string;
  estilosExtra?: string;
}

/** Resultado uniforme devuelto por cualquier estrategia de exportación. */
export interface ResultadoExportacion {
  exito: boolean;
  canal: TipoExportacion;
  mensaje: string;
  url?: string;
  detalles?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// 1. STRATEGY (INTERFAZ COMÚN DE ESTRATEGIA)
// ----------------------------------------------------------------------------

/**
 * Interfaz que define el contrato común para todos los algoritmos de exportación.
 */
export interface IExportStrategy {
  readonly tipo: TipoExportacion;
  readonly nombre: string;
  readonly descripcion: string;

  /**
   * Ejecuta la exportación de la cotización según el canal de la estrategia.
   */
  exportar(
    datos: DatosExportacionCotizacion,
    opciones?: OpcionesExportacion
  ): Promise<ResultadoExportacion>;
}

// ----------------------------------------------------------------------------
// 2. CONCRETE STRATEGIES (ESTRATEGIAS CONCRETAS)
// ----------------------------------------------------------------------------

/**
 * ESTRATEGIA 1: Exportación / Impresión en PDF.
 * Genera el documento HTML con el membrete corporativo y abre la ventana de impresión/PDF.
 */
export class PdfExportStrategy implements IExportStrategy {
  public readonly tipo: TipoExportacion = 'pdf';
  public readonly nombre: string = 'Imprimir / PDF';
  public readonly descripcion: string =
    'Genera el documento imprimible con membrete oficial para impresión física o guardado en PDF.';

  public async exportar(
    datos: DatosExportacionCotizacion,
    opciones?: OpcionesExportacion
  ): Promise<ResultadoExportacion> {
    try {
      const titulo =
        opciones?.nombreArchivo ||
        datos.titulo ||
        `Cotización ${datos.cotizacion.num_cotizacion || 'S/N'}`;

      const cuerpoHtml = htmlCotizacion(datos.cotizacion, datos.items);
      const estilos = opciones?.estilosExtra
        ? `${ESTILOS_COTIZACION}\n${opciones.estilosExtra}`
        : ESTILOS_COTIZACION;

      // Invocación a la utilidad existente de impresión sin alterar su implementación
      imprimirDocumento(titulo, cuerpoHtml, estilos);

      return {
        exito: true,
        canal: this.tipo,
        mensaje: `Documento ${titulo} enviado a impresión / PDF exitosamente.`,
      };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido al generar PDF.';
      return {
        exito: false,
        canal: this.tipo,
        mensaje: `Fallo al exportar PDF: ${mensaje}`,
      };
    }
  }
}

/**
 * ESTRATEGIA 2: Exportación a Excel (XLSX).
 * Rellena las marcas de la plantilla oficial de ROAS Ingenieros y descarga el archivo .xlsx.
 */
export class ExcelExportStrategy implements IExportStrategy {
  public readonly tipo: TipoExportacion = 'excel';
  public readonly nombre: string = 'Hoja de Cálculo Excel';
  public readonly descripcion: string =
    'Genera y descarga el archivo Excel oficial (.xlsx) respetando fórmulas, marcas y partidas.';

  public async exportar(
    datos: DatosExportacionCotizacion,
    opciones?: OpcionesExportacion
  ): Promise<ResultadoExportacion> {
    try {
      const rutaPlantilla = opciones?.plantilla || PLANTILLA_COTIZACION;
      const nombreArchivo =
        opciones?.nombreArchivo || `cotizacion-${datos.cotizacion.num_cotizacion || 'nueva'}`;

      const datosPlantilla = datosDeCotizacion(datos.cotizacion, datos.items);

      // Invocación a la utilidad de generación de Excel existente sin dañarla
      await generarDocumento(rutaPlantilla, nombreArchivo, datosPlantilla);

      return {
        exito: true,
        canal: this.tipo,
        mensaje: `Archivo Excel ${nombreArchivo}.xlsx generado y descargado con éxito.`,
      };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error al procesar la plantilla Excel.';
      return {
        exito: false,
        canal: this.tipo,
        mensaje: `Fallo al exportar Excel: ${mensaje}`,
      };
    }
  }
}

/**
 * ESTRATEGIA 3: Despacho / Notificación vía WhatsApp.
 * Formula un mensaje estructurado con las partidas y abre la conversación de WhatsApp con texto precargado.
 */
export class WhatsAppExportStrategy implements IExportStrategy {
  public readonly tipo: TipoExportacion = 'whatsapp';
  public readonly nombre: string = 'Enviar por WhatsApp';
  public readonly descripcion: string =
    'Prepara un mensaje formateado con las partidas y totales para abrir en WhatsApp Web / Móvil.';

  /**
   * Construye el cuerpo del mensaje estructurado para WhatsApp.
   */
  public construirMensaje(
    datos: DatosExportacionCotizacion,
    opciones?: OpcionesExportacion
  ): string {
    if (opciones?.mensajePersonalizado) {
      return opciones.mensajePersonalizado;
    }

    const { cotizacion, items } = datos;
    const clienteNombre = cotizacion.cliente?.nombre_razon_social || 'Estimado Cliente';
    const numCot = cotizacion.num_cotizacion || 'Borrador';

    const lineasPartidas = items.map((it, idx) => {
      const descripcion = it.producto?.nombre || `Ítem ${idx + 1}`;
      const precio = formatoSoles(Number(it.precio_unitario || 0));
      const subtotal = formatoSoles(Number(it.subtotal || 0));
      return `• ${it.cantidad}x ${descripcion} (${precio} c/u) = ${subtotal}`;
    }).join('\n');

    const subtotal = formatoSoles(Number(cotizacion.subtotal || 0));
    const igv = formatoSoles(Number(cotizacion.igv || 0));
    const total = formatoSoles(Number(cotizacion.total || 0));

    const bloques = [
      `*${EMPRESA.razon_social}*`,
      `*Cotización:* ${numCot}`,
      `*Cliente:* ${clienteNombre}`,
      '',
      '*Detalle de la cotización:*',
      lineasPartidas || '• (Sin partidas especificadas)',
      '',
      `Subtotal: ${subtotal}`,
      `IGV (18%): ${igv}`,
      `*Total: ${total}*`,
      cotizacion.forma_pago ? `Forma de pago: ${cotizacion.forma_pago}` : '',
      '',
      '_Documento emitido formalmente por ROAS Ingenieros. Quedamos atentos a su respuesta._',
    ];

    return bloques.filter(Boolean).join('\n');
  }

  public async exportar(
    datos: DatosExportacionCotizacion,
    opciones?: OpcionesExportacion
  ): Promise<ResultadoExportacion> {
    try {
      const mensaje = this.construirMensaje(datos, opciones);

      // Si se especificó un número de teléfono destino (o viene del cliente)
      const telefonoDirecto = (
        opciones?.telefonoDestino ||
        datos.cotizacion.cliente?.telefono ||
        ''
      ).replace(/\D/g, '');

      if (telefonoDirecto) {
        // Formato internacional de Perú si tiene 9 dígitos móviles
        const telInternacional =
          telefonoDirecto.length === 9 && telefonoDirecto.startsWith('9')
            ? `51${telefonoDirecto}`
            : telefonoDirecto;

        const encoded = encodeURIComponent(mensaje.trim());
        window.open(`https://wa.me/${telInternacional}?text=${encoded}`, '_blank');
      } else {
        // Enlace por defecto a la central de ROAS Ingenieros
        openWhatsApp(mensaje);
      }

      return {
        exito: true,
        canal: this.tipo,
        mensaje: 'Mensaje de WhatsApp preparado y abierto en el navegador.',
      };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error al abrir WhatsApp.';
      return {
        exito: false,
        canal: this.tipo,
        mensaje: `Fallo al exportar WhatsApp: ${mensaje}`,
      };
    }
  }
}

// ----------------------------------------------------------------------------
// 3. CONTEXT (CONTEXTO ORQUESTADOR)
// ----------------------------------------------------------------------------

/**
 * Clase Contexto del Patrón Strategy.
 * 
 * Mantiene la referencia a una estrategia de exportación concreta y permite
 * cambiarla dinámicamente en tiempo de ejecución sin alterar el código cliente.
 */
export class ExportContext {
  private estrategia: IExportStrategy;

  constructor(estrategiaInicial?: IExportStrategy) {
    this.estrategia = estrategiaInicial ?? new PdfExportStrategy();
  }

  /**
   * Permite inyectar o sustituir la estrategia activa.
   */
  public setEstrategia(estrategia: IExportStrategy): void {
    this.estrategia = estrategia;
  }

  /**
   * Permite cambiar la estrategia activa indicando su tipo ('pdf' | 'excel' | 'whatsapp').
   */
  public setEstrategiaPorTipo(tipo: TipoExportacion): void {
    this.estrategia = ExportStrategyRegistry.obtener(tipo);
  }

  /**
   * Obtiene la estrategia actualmente seleccionada.
   */
  public getEstrategiaActual(): IExportStrategy {
    return this.estrategia;
  }

  /**
   * Ejecuta el algoritmo de exportación correspondiente a la estrategia configurada.
   */
  public async ejecutarExportacion(
    datos: DatosExportacionCotizacion,
    opciones?: OpcionesExportacion
  ): Promise<ResultadoExportacion> {
    return await this.estrategia.exportar(datos, opciones);
  }
}

// ----------------------------------------------------------------------------
// 4. REGISTRY Y HELPERS GLOBALES DE CONVENIENCIA
// ----------------------------------------------------------------------------

/**
 * Catálogo / Registro de estrategias disponibles para facilitar su descubrimiento y uso.
 */
export class ExportStrategyRegistry {
  private static readonly catalogo = new Map<TipoExportacion, IExportStrategy>([
    ['pdf', new PdfExportStrategy()],
    ['excel', new ExcelExportStrategy()],
    ['whatsapp', new WhatsAppExportStrategy()],
  ]);

  /**
   * Obtiene la instancia de estrategia para el tipo indicado.
   */
  public static obtener(tipo: TipoExportacion): IExportStrategy {
    const estrategia = this.catalogo.get(tipo);
    if (!estrategia) {
      throw new Error(`Canal de exportación no reconocido: ${tipo}`);
    }
    return estrategia;
  }

  /**
   * Retorna la lista de todas las estrategias disponibles.
   */
  public static listar(): IExportStrategy[] {
    return Array.from(this.catalogo.values());
  }
}

// Instancia singleton por defecto del contexto orquestador
export const exportContextDefault = new ExportContext();

/**
 * Función helper de alto nivel para exportar una cotización en una sola llamada:
 * ```typescript
 * await exportarCotizacion('excel', { cotizacion, items });
 * await exportarCotizacion('pdf', { cotizacion, items });
 * await exportarCotizacion('whatsapp', { cotizacion, items });
 * ```
 */
export async function exportarCotizacion(
  tipo: TipoExportacion,
  datos: DatosExportacionCotizacion,
  opciones?: OpcionesExportacion
): Promise<ResultadoExportacion> {
  const contexto = new ExportContext(ExportStrategyRegistry.obtener(tipo));
  return await contexto.ejecutarExportacion(datos, opciones);
}
