// ============================================================================
// PATRÓN DE DISEÑO CREACIONAL: FACTORY METHOD (MÉTODO DE FÁBRICA)
// ============================================================================
//
// Módulo: frontend/src/externos/facturacion/comprobantefactory.ts
//
// Contexto y Propósito del Patrón:
// --------------------------------
// La emisión de comprobantes electrónicos en el Perú (normativa SUNAT) requiere
// manejar dos tipos principales de documentos con reglas tributarias, series,
// códigos y exigencias fiscales diferenciadas:
//   - Factura Electrónica (código SUNAT '01', serie 'F001', exige RUC '6' de 11 dígitos)
//   - Boleta de Venta Electrónica (código SUNAT '03', serie 'B001', exige DNI '1' de 8 dígitos
//     o permite venta simplificada sin documento para montos menores a S/ 700.00).
//
// Problema en la Interfaz de Usuario (UI):
// Sin este patrón, los componentes de vista (como `Comprobantes.tsx`) deben ensuciarse
// con múltiples bloques `if/else`, validaciones de longitud de documentos, desgloses
// manuales del IGV (18%), cálculo de base imponible y verificación de tolerancias de redondeo.
//
// Solución con Factory Method:
// Se centraliza la instanciación de los comprobantes delegándola a clases creadoras
// especializadas (`FacturaFactory` y `BoletaFactory`) que heredan de `ComprobanteFactory`.
// Cada producto concreto (`FacturaElectronica` y `BoletaElectronica`) encapsula:
//   1. El cálculo tributario automático (desglose del IGV del 18% y subtotal).
//   2. La asignación de series y códigos SUNAT por defecto.
//   3. Las reglas de validación fiscal específicas de cada documento.
//   4. La generación del payload estandarizado `DatosComprobante` para el proveedor OSE/PSE.
//
// Estructura de Participantes:
// ---------------------------
// 1. Product (Producto):           `IComprobanteElectronico` / `ComprobanteElectronicoBase`
// 2. ConcreteProducts:             `FacturaElectronica`, `BoletaElectronica`
// 3. Creator (Creador Base):       `ComprobanteFactory`
// 4. ConcreteCreators:             `FacturaFactory`, `BoletaFactory`
// 5. Factory Selector (Helper):    `ComprobanteFactory.crear()`, `ComprobanteFactory.crearSegunCliente()`
// ============================================================================

import {
  type DatosComprobante,
  type TipoComprobanteSunat,
  construirCadenaQrSunat,
} from './index';

/** Tasa oficial de IGV en el Perú (18%). */
export const TASA_IGV = 0.18;

/** Datos de emisor por defecto de ROAS Ingenieros. */
export const EMISOR_POR_DEFECTO = {
  ruc: '20608518931',
  razon_social: 'ROAS INGENIEROS S.A.C.',
};

// ----------------------------------------------------------------------------
// INTERFACES Y CONTRATOS
// ----------------------------------------------------------------------------

/** Datos de cliente normalizados para facturación. */
export interface ClienteComprobante {
  tipo_documento?: string; // '1' DNI, '6' RUC, '4' CE, '7' Pasaporte, '0' Sin Doc
  num_documento?: string;
  nombre: string;
  direccion?: string | null;
}

/** Ítem individual a facturar con desglose. */
export interface ItemFacturacion {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal?: number; // Calculado automáticamente si no se provee
}

/** Totales calculados tributariamente. */
export interface DesgloseTributario {
  subtotal: number;
  igv: number;
  total: number;
}

/** Resultado de validación fiscal específica del documento. */
export interface ResultadoValidacionFiscal {
  valido: boolean;
  errores: string[];
  advertencias?: string[];
}

/** Parámetros de entrada para solicitar la creación de un comprobante. */
export interface ParametrosCreacionComprobante {
  serie?: string;
  correlativo?: number;
  num_venta?: string;
  fecha?: string;
  emisor?: { ruc: string; razon_social: string };
  cliente: ClienteComprobante;
  items: ItemFacturacion[];
  /** Opcional: si los precios vienen con IGV incluido o como valor venta neto sin IGV. */
  modalidadPrecio?: 'sin_igv' | 'con_igv';
  /** Opcionales: valores precalculados si se desea respetar importes previos. */
  subtotal?: number;
  igv?: number;
  total?: number;
}

// ----------------------------------------------------------------------------
// 1. PRODUCT (INTERFAZ Y CLASE BASE)
// ----------------------------------------------------------------------------

/**
 * Interfaz que define el contrato común de cualquier Comprobante Electrónico (Product).
 */
export interface IComprobanteElectronico {
  readonly tipo: TipoComprobanteSunat;
  readonly codigoTipoSunat: '01' | '03';
  readonly serie: string;
  readonly correlativo: number;
  readonly numVenta: string;
  readonly fecha: string;
  readonly emisor: { ruc: string; razon_social: string };
  readonly cliente: ClienteComprobante;
  readonly items: ItemFacturacion[];
  readonly totales: DesgloseTributario;

  obtenerTitulo(): string;
  validarRequisitosFiscales(): ResultadoValidacionFiscal;
  aDatosComprobante(): DatosComprobante;
  generarCadenaQr(hash?: string): string;
}

/**
 * Clase Base abstracta que implementa la lógica común de cálculo tributario y formateo.
 */
export abstract class ComprobanteElectronicoBase implements IComprobanteElectronico {
  public abstract readonly tipo: TipoComprobanteSunat;
  public abstract readonly codigoTipoSunat: '01' | '03';
  public readonly serie: string;
  public readonly correlativo: number;
  public readonly numVenta: string;
  public readonly fecha: string;
  public readonly emisor: { ruc: string; razon_social: string };
  public readonly cliente: ClienteComprobante;
  public readonly items: ItemFacturacion[];
  public readonly totales: DesgloseTributario;

  constructor(params: ParametrosCreacionComprobante, seriePorDefecto: string) {
    this.serie = (params.serie || '').trim() || seriePorDefecto;
    this.correlativo = Number(params.correlativo) || 1;
    this.numVenta = (params.num_venta || '').trim();
    this.fecha = params.fecha || new Date().toISOString();
    this.emisor = params.emisor || EMISOR_POR_DEFECTO;
    this.cliente = {
      tipo_documento: (params.cliente?.tipo_documento || '').trim(),
      num_documento: (params.cliente?.num_documento || '').trim(),
      nombre: (params.cliente?.nombre || '').trim(),
      direccion: params.cliente?.direccion ?? null,
    };

    // Procesar ítems y calcular automáticamente el desglose tributario
    const { itemsProcesados, desglose } = this.calcularTotalesEItems(
      params.items || [],
      params.modalidadPrecio ?? 'sin_igv',
      params.subtotal,
      params.igv,
      params.total
    );

    this.items = itemsProcesados;
    this.totales = desglose;
  }

  public abstract obtenerTitulo(): string;
  public abstract validarRequisitosFiscales(): ResultadoValidacionFiscal;

  /**
   * Realiza el desglose tributario del IGV (18%) y redondeo financiero a 2 decimales.
   */
  protected calcularTotalesEItems(
    itemsEntrada: ItemFacturacion[],
    modalidad: 'sin_igv' | 'con_igv',
    subtotalFijo?: number,
    igvFijo?: number,
    totalFijo?: number
  ): { itemsProcesados: ItemFacturacion[]; desglose: DesgloseTributario } {
    // Si se enviaron totales fijos previamente calculados (ej. por triggers de BD)
    if (typeof totalFijo === 'number' && totalFijo > 0 && typeof subtotalFijo === 'number') {
      const subtotal = Math.round(subtotalFijo * 100) / 100;
      const total = Math.round(totalFijo * 100) / 100;
      const igv = typeof igvFijo === 'number'
        ? Math.round(igvFijo * 100) / 100
        : Math.round((total - subtotal) * 100) / 100;

      const itemsProcesados = itemsEntrada.map((it) => ({
        descripcion: it.descripcion || 'Ítem',
        cantidad: Number(it.cantidad) || 1,
        precio_unitario: Number(it.precio_unitario) || 0,
        subtotal: typeof it.subtotal === 'number'
          ? Math.round(it.subtotal * 100) / 100
          : Math.round((Number(it.cantidad || 1) * Number(it.precio_unitario || 0)) * 100) / 100,
      }));

      return { itemsProcesados, desglose: { subtotal, igv, total } };
    }

    // Cálculo dinámico de base imponible e IGV
    let subtotalAcumulado = 0;
    const itemsProcesados: ItemFacturacion[] = [];

    for (const item of itemsEntrada) {
      const cantidad = Number(item.cantidad) || 1;
      const precioUnit = Number(item.precio_unitario) || 0;

      let subtotalLinea: number;
      if (modalidad === 'con_igv') {
        // El precio unitario ya incluye IGV: valor base = precio / 1.18
        const precioSinIgv = precioUnit / (1 + TASA_IGV);
        subtotalLinea = Math.round(cantidad * precioSinIgv * 100) / 100;
      } else {
        // Modalidad estándar ROAS: el precio unitario es valor de venta sin IGV
        subtotalLinea = Math.round(cantidad * precioUnit * 100) / 100;
      }

      subtotalAcumulado += subtotalLinea;
      itemsProcesados.push({
        descripcion: (item.descripcion || 'Ítem').trim(),
        cantidad,
        precio_unitario: precioUnit,
        subtotal: subtotalLinea,
      });
    }

    const subtotal = Math.round(subtotalAcumulado * 100) / 100;
    const igv = Math.round(subtotal * TASA_IGV * 100) / 100;
    const total = Math.round((subtotal + igv) * 100) / 100;

    return {
      itemsProcesados,
      desglose: { subtotal, igv, total },
    };
  }

  /**
   * Transforma la instancia al payload estándar requerido por el proveedor de facturación.
   */
  public aDatosComprobante(): DatosComprobante {
    return {
      tipo: this.tipo,
      serie: this.serie,
      correlativo: this.correlativo,
      num_venta: this.numVenta,
      fecha: this.fecha,
      emisor: {
        ruc: this.emisor.ruc,
        razon_social: this.emisor.razon_social,
      },
      cliente: {
        tipo_documento: this.cliente.tipo_documento || (this.tipo === 'factura' ? '6' : '1'),
        num_documento: this.cliente.num_documento || '',
        nombre: this.cliente.nombre,
        direccion: this.cliente.direccion,
      },
      items: this.items.map((it) => ({
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.subtotal ?? it.cantidad * it.precio_unitario,
      })),
      subtotal: this.totales.subtotal,
      igv: this.totales.igv,
      total: this.totales.total,
    };
  }

  /**
   * Genera la cadena de texto oficial para el código QR según normativa SUNAT.
   */
  public generarCadenaQr(hash?: string): string {
    return construirCadenaQrSunat({
      rucEmisor: this.emisor.ruc,
      tipo: this.tipo,
      serie: this.serie,
      correlativo: this.correlativo,
      igv: this.totales.igv,
      total: this.totales.total,
      fecha: this.fecha,
      tipoDocCliente: this.cliente.tipo_documento,
      numDocCliente: this.cliente.num_documento,
      hash,
    });
  }
}

// ----------------------------------------------------------------------------
// 2. CONCRETE PRODUCTS (PRODUCTOS CONCRETOS)
// ----------------------------------------------------------------------------

/**
 * Producto Concreto: Factura Electrónica.
 * Código SUNAT: '01' | Serie por defecto: 'F001'.
 * Reglas: Exige cliente con RUC válido (código '6', 11 dígitos) y razón social.
 */
export class FacturaElectronica extends ComprobanteElectronicoBase {
  public readonly tipo: TipoComprobanteSunat = 'factura';
  public readonly codigoTipoSunat = '01' as const;

  constructor(params: ParametrosCreacionComprobante) {
    super(params, 'F001');
  }

  public obtenerTitulo(): string {
    return 'FACTURA ELECTRÓNICA';
  }

  public validarRequisitosFiscales(): ResultadoValidacionFiscal {
    const errores: string[] = [];
    const advertencias: string[] = [];
    const doc = (this.cliente.num_documento || '').replace(/\D/g, '');
    const codDoc = this.cliente.tipo_documento;

    // Validación estricta de RUC para Factura
    if (!doc) {
      errores.push('Una Factura requiere obligatoriamente el RUC del cliente.');
    } else if (doc.length !== 11) {
      errores.push(`El RUC del cliente debe tener 11 dígitos numéricos (se encontraron ${doc.length}).`);
    }

    if (codDoc && codDoc !== '6') {
      errores.push('El tipo de documento del cliente debe ser RUC (código SUNAT 6) para emitir Factura.');
    }

    if (!this.cliente.nombre) {
      errores.push('Falta la razón social o nombre comercial del cliente adquirente.');
    }

    if (!this.serie.toUpperCase().startsWith('F')) {
      advertencias.push(`La serie de la factura usualmente inicia con 'F' (actual: ${this.serie}).`);
    }

    if (this.totales.subtotal <= 0 || this.totales.total <= 0) {
      errores.push('El importe de la factura debe ser mayor a 0.');
    }

    return {
      valido: errores.length === 0,
      errores,
      advertencias,
    };
  }
}

/**
 * Producto Concreto: Boleta de Venta Electrónica.
 * Código SUNAT: '03' | Serie por defecto: 'B001'.
 * Reglas: Dirigida a personas naturales (DNI, CE, Pasaporte) o sin documento (< S/ 700).
 */
export class BoletaElectronica extends ComprobanteElectronicoBase {
  public readonly tipo: TipoComprobanteSunat = 'boleta';
  public readonly codigoTipoSunat = '03' as const;

  constructor(params: ParametrosCreacionComprobante) {
    super(params, 'B001');
  }

  public obtenerTitulo(): string {
    return 'BOLETA DE VENTA ELECTRÓNICA';
  }

  public validarRequisitosFiscales(): ResultadoValidacionFiscal {
    const errores: string[] = [];
    const advertencias: string[] = [];
    const doc = (this.cliente.num_documento || '').replace(/\D/g, '');
    const codDoc = this.cliente.tipo_documento;

    // Advertencia si se intenta emitir boleta a una empresa con RUC
    if (codDoc === '6' || doc.length === 11) {
      advertencias.push('El cliente tiene RUC. Según normativa tributaria SUNAT, corresponde emitir Factura (F001).');
    }

    // Regla de SUNAT para boletas mayores a S/ 700.00: identificación obligatoria
    if (this.totales.total >= 700) {
      if (!doc) {
        errores.push('Para boletas con importe igual o mayor a S/ 700.00, SUNAT exige consignar documento de identidad.');
      }
      if (!this.cliente.nombre) {
        errores.push('Para boletas con importe igual o mayor a S/ 700.00, SUNAT exige consignar nombres y apellidos completos.');
      }
    }

    // Validación de DNI si se indicó código '1'
    if (codDoc === '1' && doc && doc.length !== 8) {
      errores.push(`El DNI debe contener 8 dígitos numéricos (se encontraron ${doc.length}).`);
    }

    if (!this.serie.toUpperCase().startsWith('B')) {
      advertencias.push(`La serie de la boleta usualmente inicia con 'B' (actual: ${this.serie}).`);
    }

    if (this.totales.total <= 0) {
      errores.push('El total de la boleta debe ser mayor a 0.');
    }

    return {
      valido: errores.length === 0,
      errores,
      advertencias,
    };
  }
}

// ----------------------------------------------------------------------------
// 3. CREATOR (FÁBRICA ABSTRACTA)
// ----------------------------------------------------------------------------

/**
 * Creador Base (Creator).
 * Declara el Método de Fábrica (Factory Method) abstracto `crearComprobante()`.
 */
export abstract class ComprobanteFactory {
  /**
   * FACTORY METHOD: Cada fábrica concreta sobreescribe este método para instanciar
   * su respectivo producto (Factura o Boleta).
   */
  public abstract crearComprobante(params: ParametrosCreacionComprobante): IComprobanteElectronico;

  /**
   * Operación de plantilla (Template Operation):
   * Crea el comprobante mediante el Factory Method, valida sus requisitos fiscales
   * y devuelve el objeto `DatosComprobante` listo para enviarse al emisor OSE/PSE.
   */
  public prepararDatosEmision(params: ParametrosCreacionComprobante): {
    datos: DatosComprobante;
    validacion: ResultadoValidacionFiscal;
  } {
    const comprobante = this.crearComprobante(params);
    const validacion = comprobante.validarRequisitosFiscales();
    return {
      datos: comprobante.aDatosComprobante(),
      validacion,
    };
  }

  // --------------------------------------------------------------------------
  // SELECTORES ESTÁTICOS Y HELPERS DE CONVENIENCIA PARA LA UI (REACT)
  // --------------------------------------------------------------------------

  /**
   * Devuelve la fábrica concreta apropiada según el tipo ('boleta' | 'factura').
   */
  public static obtenerFabrica(tipo: TipoComprobanteSunat): ComprobanteFactory {
    if (tipo === 'factura') {
      return new FacturaFactory();
    }
    return new BoletaFactory();
  }

  /**
   * Helper directo: Instancia el comprobante adecuado sin que la UI conozca las clases hijas.
   */
  public static crear(
    tipo: TipoComprobanteSunat,
    params: ParametrosCreacionComprobante
  ): IComprobanteElectronico {
    const fabrica = ComprobanteFactory.obtenerFabrica(tipo);
    return fabrica.crearComprobante(params);
  }

  /**
   * Detección Automática Inteligente:
   * Evalúa el cliente (RUC vs DNI) y delega a la fábrica correspondiente de forma automática.
   * Si el cliente tiene RUC (11 dígitos o código SUNAT '6'), crea Factura; de lo contrario Boleta.
   */
  public static crearSegunCliente(params: ParametrosCreacionComprobante): IComprobanteElectronico {
    const numDoc = (params.cliente?.num_documento || '').replace(/\D/g, '');
    const codDoc = params.cliente?.tipo_documento;

    const esEmpresaRuc = codDoc === '6' || numDoc.length === 11;
    const tipo: TipoComprobanteSunat = esEmpresaRuc ? 'factura' : 'boleta';

    return ComprobanteFactory.crear(tipo, params);
  }
}

// ----------------------------------------------------------------------------
// 4. CONCRETE CREATORS (FÁBRICAS CONCRETAS)
// ----------------------------------------------------------------------------

/**
 * Creador Concreto para Facturas Electrónicas.
 */
export class FacturaFactory extends ComprobanteFactory {
  public crearComprobante(params: ParametrosCreacionComprobante): FacturaElectronica {
    return new FacturaElectronica(params);
  }
}

/**
 * Creador Concreto para Boletas de Venta Electrónicas.
 */
export class BoletaFactory extends ComprobanteFactory {
  public crearComprobante(params: ParametrosCreacionComprobante): BoletaElectronica {
    return new BoletaElectronica(params);
  }
}

// Exportación de instancias convenientes
export const facturaFactory = new FacturaFactory();
export const boletaFactory = new BoletaFactory();
