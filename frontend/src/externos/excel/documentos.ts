// ============================================================================
// De los datos de la base a las marcas de la plantilla Excel de la empresa.
// ============================================================================
// Las claves de `campos` son exactamente lo que está escrito entre {{ }} en
// `frontend/public/plantillas/cotizacion.xlsx` (el Excel real de ROAS, ver
// scripts/plantilla-cotizacion.mjs y el README → "Plantilla de cotización").
//
// Los comprobantes (facturas y boletas) NO se generan aquí: los emite SUNAT a
// través del OSE/PSE (`externos/facturacion/`), que devuelve su propio
// PDF/XML.
// ============================================================================
import JSZip from "jszip";
import { EMPRESA } from "../../negocio/empresa";
import {
  formatoFecha,
  type Cliente,
  type Cotizacion,
} from "../../datos/supabase";
import {
  generarExcel,
  cargarPlantillaDesdeBuffer,
  type DatosPlantilla,
  type ValorPlantilla,
} from "./plantilla";
import { numeroALetras } from "../../negocio/texto";
import { construirCadenaQrSunat } from "../facturacion";

/** Filas de la tabla de ítems del formulario de cotización (16 a 36: 21 filas). */
export const FILAS_ITEMS_COTIZACION = 21;

const BASE = import.meta.env.BASE_URL || "/";

/** Excel de la empresa con las marcas ya puestas (script `plantilla:cotizacion`). */
export const PLANTILLA_COTIZACION = `${BASE}plantillas/cotizacion.xlsx`;
/** Plantilla de comprobante de pago oficial (boleta / factura electrónica). */
export const PLANTILLA_BOLETA = `${BASE}plantillas/Plantilla_Boleta_ROAS.xlsx`;

/** Lo mínimo que necesita el documento por cada ítem (sirve cualquier detalle). */
export interface ItemDocumento {
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  producto?: {
    nombre?: string | null;
    codigo?: string | null;
    tipo?: string | null;
    unidad_medida?: string | null;
  } | null;
}

/** Cliente con lo que llevan los documentos (nombre, documento y contacto). */
export type ClienteDoc = Pick<
  Cliente,
  "nombre_razon_social" | "num_documento"
> &
  Partial<Pick<Cliente, "apellidos" | "direccion" | "telefono" | "correo">> & {
    tipo_documento?: Pick<
      NonNullable<Cliente["tipo_documento"]>,
      "descripcion" | "codigo_sunat"
    > | null;
  };

export type CotizacionDoc = Cotizacion & { cliente?: ClienteDoc | null };

/** Sigla que se imprime antes del número de documento (código SUNAT). */
export function etiquetaDocumento(
  cliente: ClienteDoc | null | undefined,
): string {
  const codigo = cliente?.tipo_documento?.codigo_sunat;
  if (codigo === "6") return "RUC";
  if (codigo === "1") return "DNI";
  if (codigo === "4") return "CE";
  if (codigo === "7") return "PAS";
  // Otro tipo (o cliente sin tipo cargado): etiqueta genérica.
  return "DOC";
}

/** Nombre completo: razón social, o nombres + apellidos si es persona natural. */
export function nombreCliente(cliente: ClienteDoc | null | undefined): string {
  if (!cliente) return "";
  const nombre = cliente.nombre_razon_social || "";
  return cliente.apellidos ? `${nombre} ${cliente.apellidos}`.trim() : nombre;
}

export function datosCliente(cliente: ClienteDoc | null | undefined) {
  return {
    nombre: nombreCliente(cliente),
    etiqueta_documento: etiquetaDocumento(cliente),
    documento: cliente?.num_documento || "",
    direccion: cliente?.direccion || "",
    telefono: cliente?.telefono || "",
    correo: cliente?.correo || "",
  };
}

export function datosEmpresa() {
  return {
    nombre: EMPRESA.nombre,
    razon_social: EMPRESA.razon_social,
    ruc: EMPRESA.ruc,
    direccion: EMPRESA.direccion,
  };
}

/** Componentes separados de la fecha (día, mes, año) para las celdas H9, I9, J9. */
export function componentesFecha(iso: string | null | undefined): {
  dia: string;
  mes: string;
  anio: string;
} {
  if (!iso) {
    const ahora = new Date();
    return {
      dia: String(ahora.getDate()).padStart(2, "0"),
      mes: String(ahora.getMonth() + 1).padStart(2, "0"),
      anio: String(ahora.getFullYear()),
    };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { dia: "", mes: "", anio: "" };
  }
  return {
    dia: d.toLocaleDateString("es-PE", {
      day: "2-digit",
      timeZone: "America/Lima",
    }),
    mes: d.toLocaleDateString("es-PE", {
      month: "2-digit",
      timeZone: "America/Lima",
    }),
    anio: d.toLocaleDateString("es-PE", {
      year: "numeric",
      timeZone: "America/Lima",
    }),
  };
}

/** Extrae asunto o forma de pago si fueron empaquetados en notas (retrocompatibilidad). */
export function extraerMetaNotas(notas: string | null | undefined): {
  asunto?: string;
  forma_pago?: string;
  notasLimpio: string;
} {
  if (!notas) return { notasLimpio: "" };
  let limpio = notas;
  let asunto: string | undefined;
  let forma_pago: string | undefined;

  const mAsunto = limpio.match(/\[ASUNTO:\s*([^\]]+)\]/i);
  if (mAsunto) {
    asunto = mAsunto[1].trim();
    limpio = limpio.replace(mAsunto[0], "").trim();
  }

  const mForma = limpio.match(/\[FORMA_PAGO:\s*([^\]]+)\]/i);
  if (mForma) {
    forma_pago = mForma[1].trim();
    limpio = limpio.replace(mForma[0], "").trim();
  }

  return { asunto, forma_pago, notasLimpio: limpio };
}

/** Ítems del detalle: cada fila numerada correlativamente 1, 2, 3... (sin filas partida intermedias). */
export function datosItems(
  detalle: ItemDocumento[],
): Record<string, ValorPlantilla>[] {
  return detalle.map((item, i) => {
    const codigo = item.producto?.codigo ? ` (${item.producto.codigo})` : "";
    return {
      numero: i + 1,
      n: i + 1,
      descripcion: `${item.producto?.nombre || "Ítem"}${codigo}`,
      codigo: item.producto?.codigo || "",
      tipo: item.producto?.tipo || "",
      unidad: item.producto?.unidad_medida || "unidad",
      cantidad: item.cantidad,
      precio: item.precio_unitario,
      total: item.subtotal,
      subtotal: item.subtotal,
    };
  });
}

/** Asunto del formulario: lo que se está cotizando, según los ítems (fallback si no se especificó). */
export function asuntoDeCotizacion(detalle: ItemDocumento[]): string {
  if (detalle.length === 0) return "Cotización de productos y servicios";
  const primero = detalle[0].producto?.nombre || "Ítem";
  const resto = detalle.length - 1;
  return resto > 0 ? `${primero} y ${resto} ítem(s) más` : primero;
}

export function datosDeCotizacion(
  cotizacion: CotizacionDoc,
  detalle: ItemDocumento[],
): DatosPlantilla {
  const { dia, mes, anio } = componentesFecha(cotizacion.fecha_emision);
  const meta = extraerMetaNotas(cotizacion.notas);
  const asuntoFinal = (
    cotizacion.asunto ||
    meta.asunto ||
    asuntoDeCotizacion(detalle)
  ).trim();
  const formaPagoFinal = (
    cotizacion.forma_pago ||
    meta.forma_pago ||
    EMPRESA.forma_pago ||
    "Contado"
  ).trim();
  const notasFinal = (meta.notasLimpio || cotizacion.notas || "").trim();

  return {
    campos: {
      empresa: datosEmpresa(),
      documento: {
        titulo: "COTIZACIÓN",
        numero: cotizacion.num_cotizacion,
      },
      cliente: datosCliente(cotizacion.cliente),
      fecha: formatoFecha(cotizacion.fecha_emision),
      fecha_emision: formatoFecha(cotizacion.fecha_emision),
      fecha_dia: dia,
      fecha_mes: mes,
      fecha_ano: anio,
      fecha_anio: anio,
      asunto: asuntoFinal,
      forma_pago: formaPagoFinal,
      estado: cotizacion.estado,
      origen: cotizacion.origen,
      notas: notasFinal,
      subtotal: cotizacion.subtotal,
      igv: cotizacion.igv,
      total: cotizacion.total,
    },
    items: datosItems(detalle),
    // El formulario ya trae su tabla dibujada (fila 16 a 36): no se clonan ni se quitan filas.
    filasItems: FILAS_ITEMS_COTIZACION,
  };
}

/**
 * Genera y descarga el Excel. Lanza un Error con un mensaje para el usuario si
 * falta la plantilla o si esta no tiene una fila de ítems marcada.
 */
export async function generarDocumento(
  plantilla: string,
  archivo: string,
  datos: DatosPlantilla,
): Promise<void> {
  const resultado = await generarExcel({ plantilla, archivo, datos });
  if (!resultado) {
    throw new Error(
      `No se encontró la plantilla ${plantilla}. Corre "npm run plantilla:cotizacion" para generarla desde el Excel de la empresa (ver README).`,
    );
  }
  if ((datos.items?.length ?? 0) > 0 && resultado.filasItem === 0) {
    throw new Error(
      "La plantilla no tiene una fila de ítems marcada: agrega {{item.descripcion}} (y las demás marcas item.*) en la fila que debe repetirse.",
    );
  }
}

/**
 * Genera y descarga el comprobante (Boleta o Factura) en formato Excel
 * rellenando la plantilla oficial Plantilla_Boleta_ROAS.xlsx.
 *
 * Estrategia: ExcelJS destruye las formas (rectángulos de esquinas redondeadas)
 * y los bordes decorativos de la plantilla original al guardar. Para preservarlos
 * se usa un flujo en dos fases:
 *
 *   1. Se abre la plantilla con ExcelJS **solo para editar celdas** (sin addImage).
 *   2. Se usa JSZip para restaurar el drawing1.xml original (formas, bordes) y
 *      reemplazar la imagen del QR de ejemplo (xl/media/image2.png) con el QR
 *      recién generado, que se renderiza cuadrado (width = height).
 */
export async function generarComprobanteExcel(opciones: {
  comprobante: {
    serie: string;
    correlativo: number;
    tipo: string;
    fecha?: string | null;
    hash_cpe?: string | null;
  };
  venta: {
    num_venta: string;
    fecha: string;
    subtotal: number;
    igv: number;
    total: number;
    orden_compra_cliente?: string | null;
  };
  cliente: ClienteDoc | null | undefined;
  items: ItemDocumento[];
  guiaRemision?: string | null;
  archivo?: string;
}): Promise<void> {
  const { comprobante, venta, cliente, items, guiaRemision, archivo } =
    opciones;

  // ── Obtener los bytes crudos de la plantilla ──────────────────────────────
  const respuesta = await fetch(PLANTILLA_BOLETA, { cache: "no-store" });
  if (!respuesta.ok) {
    throw new Error(
      `No se encontró la plantilla de comprobante en ${PLANTILLA_BOLETA}.`,
    );
  }
  const plantillaBytes = await respuesta.arrayBuffer();

  // ── Fase 1: preservar dibujos y medios originales con JSZip ───────────────
  const origZip = await JSZip.loadAsync(plantillaBytes);
  const origDrawingXml =
    (await origZip.file("xl/drawings/drawing1.xml")?.async("string")) ?? null;
  const origDrawingRels =
    (await origZip
      .file("xl/drawings/_rels/drawing1.xml.rels")
      ?.async("string")) ?? null;
  const origLogo =
    (await origZip.file("xl/media/image1.jpeg")?.async("uint8array")) ?? null;

  // ── Fase 2: editar solo celdas con ExcelJS ────────────────────────────────
  const wb = await cargarPlantillaDesdeBuffer(plantillaBytes);
  const ws = wb.getWorksheet(1);
  if (!ws) {
    throw new Error(
      "La plantilla de comprobante no tiene hojas de cálculo válidas.",
    );
  }

  const esFactura =
    comprobante.tipo === "factura" || comprobante.serie.startsWith("F");
  const tipoTitulo = esFactura
    ? "FACTURA ELECTRÓNICA"
    : "BOLETA DE VENTA ELECTRÓNICA";
  const numeroCompleto = `N° ${comprobante.serie}-${String(comprobante.correlativo).padStart(8, "0")}`;

  // 1. Encabezado
  ws.getCell("E2").value = tipoTitulo;
  ws.getCell("E4").value = numeroCompleto;

  // 2. Datos del cliente
  const nomCliente = nombreCliente(cliente);
  ws.getCell("A7").value = esFactura ? "Señor(es)" : "Cliente";
  ws.getCell("B7").value = `: ${nomCliente}`;
  ws.getCell("A8").value = "Dirección";
  ws.getCell("B8").value = `: ${cliente?.direccion || "—"}`;
  ws.getCell("A9").value = esFactura ? "RUC" : "DNI";
  ws.getCell("B9").value = `: ${cliente?.num_documento || "—"}`;

  // 3. Fechas y condiciones comerciales
  const fechaDoc = formatoFecha(comprobante.fecha || venta.fecha);
  ws.getCell("A13").value = fechaDoc;

  // C13 es Fecha de Vencimiento: por ahora «Sin vencimiento» en formato texto
  ws.getCell("C13").numFmt = "@";
  ws.getCell("C13").value = "Sin vencimiento";

  // D13 es Orden de Compra: si es numérico se almacena como número con formato "0"
  // para evitar la advertencia verde «número con formato de texto».
  // Si contiene letras o está vacío se guarda con formato "General".
  const ocStr = venta.orden_compra_cliente
    ? String(venta.orden_compra_cliente).trim()
    : "";
  if (ocStr && /^\d+$/.test(ocStr)) {
    ws.getCell("D13").numFmt = "0";
    ws.getCell("D13").value = Number(ocStr);
  } else {
    ws.getCell("D13").numFmt = "General";
    ws.getCell("D13").value = ocStr || "—";
  }

  ws.getCell("E13").numFmt = "@";
  ws.getCell("E13").value = guiaRemision || "—";

  ws.getCell("F13").value = "Contado";

  // Centrar horizontal y verticalmente todas las celdas de la fila 13
  for (const ref of ["A13", "B13", "C13", "D13", "E13", "F13", "G13"]) {
    const celda = ws.getCell(ref);
    celda.alignment = { horizontal: "center", vertical: "middle" };
  }

  // 4. Ítems del detalle (la plantilla trae 19 filas dibujadas: de la 15 a la 33)
  items.slice(0, 19).forEach((item, idx) => {
    const fila = 15 + idx;
    ws.getCell(`A${fila}`).value = item.cantidad;
    ws.getCell(`B${fila}`).value = item.producto?.unidad_medida || "NIU";
    ws.getCell(`C${fila}`).value = item.producto?.nombre || "Ítem";
    ws.getCell(`F${fila}`).value = item.precio_unitario;
    ws.getCell(`G${fila}`).value = item.subtotal;
  });

  // 5. Total en letras
  ws.getCell("A34").value = `SON: ${numeroALetras(venta.total)}`;

  // 6. Totales numéricos
  ws.getCell("G36").value = Number(venta.subtotal.toFixed(2));
  ws.getCell("G37").value = Number(venta.igv.toFixed(2));
  ws.getCell("G38").value = Number(venta.total.toFixed(2));

  // 7. Generación del código QR oficial SUNAT (imagen cuadrada)
  const hash = comprobante.hash_cpe || "MOCK";
  const cadenaSunat = construirCadenaQrSunat({
    rucEmisor: EMPRESA.ruc,
    tipo: comprobante.tipo,
    serie: comprobante.serie,
    correlativo: comprobante.correlativo,
    igv: venta.igv,
    total: venta.total,
    fecha: comprobante.fecha || venta.fecha,
    tipoDocCliente:
      cliente?.tipo_documento?.codigo_sunat || (esFactura ? "6" : "1"),
    numDocCliente: cliente?.num_documento,
    hash,
  });

  // 8. Pie de página legal
  ws.getCell("A42").value =
    `Representación impresa de la ${tipoTitulo}. Consulte su documento en www.sunat.gob.pe o con su proveedor autorizado. HASH: ${hash}`;

  // ── Fase 3: generar el buffer editado con ExcelJS ─────────────────────────
  const excelBuf = await wb.xlsx.writeBuffer();

  // ── Fase 4: restaurar formas y reemplazar QR con JSZip ────────────────────
  const modZip = await JSZip.loadAsync(excelBuf);

  // Restaurar drawing1.xml original preservando al 100% las 3 formas de esquinas
  // redondeadas (RUC, cliente y tabla de ítems) sin agregar bordes de celda.
  // Se localiza con precisión el ancla de Imagen 8 (el QR) para sustituirlo por
  // un oneCellAnchor estrictamente cuadrado (cx === cy: 1200000 EMU ≈ 3.2 cm)
  // en el recuadro A36:B40 sin tocar ninguna otra forma del dibujo.
  if (origDrawingXml) {
    const idx = origDrawingXml.indexOf('name="Imagen 8"');
    if (idx !== -1) {
      const startAnchor = origDrawingXml.lastIndexOf('<xdr:twoCellAnchor', idx);
      const endAnchor =
        origDrawingXml.indexOf('</xdr:twoCellAnchor>', idx) +
        '</xdr:twoCellAnchor>'.length;

      const qrCuadradoXml =
        `<xdr:oneCellAnchor editAs="oneCell">` +
        `<xdr:from>` +
        `<xdr:col>0</xdr:col>` +
        `<xdr:colOff>580000</xdr:colOff>` +
        `<xdr:row>35</xdr:row>` +
        `<xdr:rowOff>25000</xdr:rowOff>` +
        `</xdr:from>` +
        `<xdr:ext cx="1200000" cy="1200000"/>` +
        `<xdr:pic>` +
        `<xdr:nvPicPr>` +
        `<xdr:cNvPr id="9" name="Imagen 8">` +
        `<a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{79D980CD-ECE6-4333-91D7-D995F5D52A73}"/></a:ext></a:extLst>` +
        `</xdr:cNvPr>` +
        `<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>` +
        `</xdr:nvPicPr>` +
        `<xdr:blipFill>` +
        `<a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId2">` +
        `<a:extLst><a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}"><a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/></a:ext></a:extLst>` +
        `</a:blip>` +
        `<a:stretch><a:fillRect/></a:stretch>` +
        `</xdr:blipFill>` +
        `<xdr:spPr>` +
        `<a:xfrm>` +
        `<a:off x="580000" y="8800000"/>` +
        `<a:ext cx="1200000" cy="1200000"/>` +
        `</a:xfrm>` +
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
        `</xdr:spPr>` +
        `</xdr:pic>` +
        `<xdr:clientData/>` +
        `</xdr:oneCellAnchor>`;

      const drawingFix =
        origDrawingXml.slice(0, startAnchor) +
        qrCuadradoXml +
        origDrawingXml.slice(endAnchor);

      modZip.file("xl/drawings/drawing1.xml", drawingFix);
    }
  }
  if (origDrawingRels) {
    modZip.file("xl/drawings/_rels/drawing1.xml.rels", origDrawingRels);
  }

  // Restaurar el logo del membrete (image1.jpeg) que ExcelJS pudo degradar.
  if (origLogo) {
    modZip.file("xl/media/image1.jpeg", origLogo);
  }

  // Generar el nuevo QR cuadrado y reemplazar image2.png (el QR de ejemplo).
  try {
    const QRCodeMod = await import("qrcode");
    const QRCode = QRCodeMod.default ?? QRCodeMod;
    const qrDataUrl: string = await QRCode.toDataURL(cadenaSunat, {
      errorCorrectionLevel: "Q",
      margin: 1,
      width: 300,
    });
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
    const qrBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    modZip.file("xl/media/image2.png", qrBytes);
  } catch (err) {
    console.warn("No se pudo generar el código QR para el Excel:", err);
  }

  // ── Fase 5: descargar el archivo final ────────────────────────────────────
  const finalBuf = await modZip.generateAsync({ type: "arraybuffer" });
  const MIME_XLSX =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const blob = new Blob([finalBuf], { type: MIME_XLSX });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  const nombreFinal =
    archivo ||
    `${comprobante.serie}-${String(comprobante.correlativo).padStart(8, "0")}`;
  enlace.download = nombreFinal.toLowerCase().endsWith(".xlsx")
    ? nombreFinal
    : `${nombreFinal}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
