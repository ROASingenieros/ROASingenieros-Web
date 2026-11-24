// ============================================================================
// Plantilla de cotización a partir del Excel real de la empresa.
// ============================================================================
// El archivo que maneja ROAS Ingenieros (`TENER EN CUENTA/PLANTILLA DE
// COTIZACION.xlsx`) ya tiene su formato: logos, bordes, combinaciones y los
// textos fijos del formulario. Este script NO lo reconstruye: le escribe las
// marcas {{...}} en las celdas que llevan datos y lo guarda como
// `frontend/public/plantillas/cotizacion.xlsx`, que es el que descarga el panel.
//
// Además:
//   · quita las fórmulas de la tabla de ítems y de los totales. El panel escribe
//     esos números ya calculados por la base, y así el bloque de líneas se puede
//     llenar o ampliar sin arrastrar fórmulas compartidas rotas.
//   · extrae los dos logos del encabezado a `frontend/public/documentos/` para que la
//     impresión/PDF de la cotización use el mismo membrete.
//
//   npm run plantilla:cotizacion
// ============================================================================
import ExcelJS from 'exceljs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');

/** Excel original de la empresa (fuente de verdad del formato). */
export const ORIGEN = join(RAIZ, '..', 'TENER EN CUENTA', 'PLANTILLA DE COTIZACION.xlsx');
/** Plantilla que sirve el panel en /plantillas/cotizacion.xlsx. */
export const DESTINO = join(RAIZ, 'frontend', 'public', 'plantillas', 'cotizacion.xlsx');
/** Logos del membrete, para la versión imprimible. */
export const DESTINO_IMAGENES = join(RAIZ, 'frontend', 'public', 'documentos');

/** Primera y última línea de la tabla de ítems del formulario. */
const ITEM_DESDE = 16;
const ITEM_HASTA = 36;

/**
 * Dónde va cada dato. Las claves son las mismas que arma
 * `frontend/src/externos/excel/documentos.ts`.
 */
const MARCAS = [
  // Encabezado derecho: ciudad fija en G9, y día, mes, año separados en H9, I9, J9.
  ['G9', 'LIMA,'],
  ['H9', '{{fecha_dia}}'],
  ['I9', '{{fecha_mes}}'],
  ['J9', '{{fecha_ano}}'],
  // Datos del cliente.
  ['C9', '{{cliente.nombre}}'],
  ['B10', '{{cliente.etiqueta_documento}}:'],
  ['C10', '{{cliente.documento}}'],
  ['C11', '{{cliente.direccion}}'],
  ['C12', '{{asunto}}'],
  // Número de la cotización.
  ['G10', 'COTIZACION Nº {{documento.numero}}'],
  // Fila modelo de la tabla de ítems (empieza directamente en fila 16, una fila por ítem).
  ['B16', '{{item.numero}}'],
  ['C16', '{{item.descripcion}}'],
  ['F16', '{{item.unidad}}'],
  ['G16', '{{item.cantidad}}'],
  ['H16', '{{item.precio}}'],
  ['I16', '{{item.total}}'],
  // Totales: los números los calcula la base, no el Excel.
  ['I38', '{{subtotal}}'],
  ['I39', '{{igv}}'],
  ['I40', '{{total}}'],
  // Forma de pago (celda combinada I42:J42)
  ['I42', '{{forma_pago}}'],
  // NOTAS:
  ['B43', '{{notas}}'],
];

/** Celdas con fórmula de la tabla de ítems y de los totales (se vacían). */
const FORMULAS = [
  ...Array.from({ length: ITEM_HASTA - ITEM_DESDE + 1 }, (_, i) => [ITEM_DESDE + i, ['I', 'J']]),
  [38, ['I', 'J']],
  [39, ['I', 'J']],
  [40, ['I', 'J']],
];

function esFormula(valor) {
  return !!valor && typeof valor === 'object' && ('formula' in valor || 'sharedFormula' in valor);
}

/** Escribe el texto de la marca conservando el estilo de la celda. */
function marcar(hoja, direccion, texto) {
  const celda = hoja.getCell(direccion);
  if (esFormula(celda.value)) {
    // No se pone la marca dentro de una fórmula: la celda pasa a ser texto.
    celda.value = null;
  }
  celda.value = texto;
}

/** Vacía las fórmulas indicadas (importante: ninguna puede quedar huérfana). */
function quitarFormulas(hoja) {
  let quitadas = 0;
  for (const [fila, columnas] of FORMULAS) {
    for (const columna of columnas) {
      const celda = hoja.getCell(`${columna}${fila}`);
      if (esFormula(celda.value)) {
        celda.value = null;
        quitadas += 1;
      }
    }
  }
  return quitadas;
}

/**
 * Imágenes del membrete con un nombre de archivo estable. La primera es el logo
 * de la izquierda; el resto (el sello de la derecha) van numeradas.
 */
function imagenesMembrete(wb) {
  return (wb.model.media || []).map((imagen, i) => ({
    nombre: i === 0 ? 'membrete-logo.png' : `membrete-${i + 1}.png`,
    buffer: imagen.buffer,
  }));
}

/**
 * Devuelve el libro de la empresa con las marcas ya puestas.
 * `hoja`: nombre de la hoja a adaptar (por defecto, la primera).
 */
export async function adaptarPlantilla({ buffer } = {}) {
  const datos = buffer ?? (await readFile(ORIGEN));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(datos);

  const hoja = wb.worksheets[0];
  if (!hoja) throw new Error(`La plantilla de cotización no tiene hojas: ${ORIGEN}`);
  hoja.name = 'COTIZACION';

  // 1. Quitar la combinación ancha de C16:J16 que actuaba de partida repetida,
  // y convertir la fila 16 en fila modelo estándar con C16:E16 e I16:J16 combinadas.
  try {
    hoja.unMergeCells('C16:J16');
  } catch {
    // Si ya no estaba combinada, no pasa nada
  }
  hoja.mergeCells('C16:E16');
  hoja.mergeCells('I16:J16');

  // Copiar estilos de la fila 17 a la fila 16 (alineaciones, bordes, formatos numéricos)
  for (let c = 2; c <= 10; c++) {
    const c17 = hoja.getRow(17).getCell(c);
    const c16 = hoja.getRow(16).getCell(c);
    if (c17.style) {
      c16.style = JSON.parse(JSON.stringify(c17.style));
    }
    c16.fill = { type: 'pattern', pattern: 'none' };
  }

  // Limpiar valores residuales preexistentes en filas de ítems (16 a 36)
  for (let r = ITEM_DESDE; r <= ITEM_HASTA; r++) {
    hoja.getCell(`B${r}`).value = null;
    hoja.getCell(`C${r}`).value = null;
    hoja.getCell(`F${r}`).value = null;
    hoja.getCell(`G${r}`).value = null;
    hoja.getCell(`H${r}`).value = null;
  }

  const formulasQuitadas = quitarFormulas(hoja);
  for (const [direccion, marca] of MARCAS) marcar(hoja, direccion, marca);

  return { wb, hoja, formulasQuitadas, media: wb.model.media || [] };
}

/** Genera frontend/public/plantillas/cotizacion.xlsx y los logos del membrete. */
export async function generarPlantillaCotizacion() {
  const { wb, formulasQuitadas, media } = await adaptarPlantilla();

  await mkdir(dirname(DESTINO), { recursive: true });
  const salida = await wb.xlsx.writeBuffer();
  await writeFile(DESTINO, Buffer.from(salida));

  const imagenes = imagenesMembrete(wb);
  await mkdir(DESTINO_IMAGENES, { recursive: true });
  const guardadas = [];
  for (const imagen of imagenes) {
    await writeFile(join(DESTINO_IMAGENES, imagen.nombre), Buffer.from(imagen.buffer));
    guardadas.push(imagen.nombre);
  }

  return { destino: DESTINO, formulasQuitadas, imagenes: guardadas, media: media.length };
}

const esEjecucionDirecta =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (esEjecucionDirecta) {
  const r = await generarPlantillaCotizacion();
  console.log(`✔ ${r.destino} (marcas: ${MARCAS.length}, fórmulas quitadas: ${r.formulasQuitadas})`);
  console.log(`✔ logos del membrete: ${r.imagenes.join(', ')}`);
  console.log('\nReemplaza TENER EN CUENTA/PLANTILLA DE COTIZACION.xlsx por el Excel actualizado de la empresa y vuelve a correr este script.');
}
