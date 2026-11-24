// ============================================================================
// Plantillas Excel: abre un .xlsx real (el de la empresa), reemplaza las
// marcas y devuelve el mismo archivo con los datos ya puestos.
// ============================================================================
// El archivo nunca se reconstruye: se abre y se editan solo las celdas, así que
// el logo, los colores, los bordes, las celdas combinadas y las fórmulas se
// conservan. Dos tipos de marca:
//
//   {{documento.numero}}   valor simple (texto, número o fecha)
//   {{item.descripcion}}   fila repetible: la fila que contiene marcas `item.*`
//                          se clona una vez por ítem. Si el documento no tiene
//                          ítems, esa fila se elimina.
//
// Las celdas con fórmula NO se tocan (las recalcula Excel al abrir); aquí solo
// se escriben datos. ExcelJS se carga con import() dinámico para que el sitio
// público no pague el peso de la librería.
//
// Con `filasItems` se usa el modo de líneas fijas, pensado para las plantillas
// que ya tienen su tabla dibujada (formulario de N líneas con combinaciones y
// bordes propios): los ítems se escriben desde la fila marcada hacia abajo, las
// líneas sobrantes se dejan en blanco y, si hay más ítems que líneas, el bloque
// crece copiando la última línea. En este modo nunca se quitan filas, así que el
// formulario (ni sus combinaciones) se desarma.
// ============================================================================
import type { Cell, Row, Workbook, Worksheet } from 'exceljs';

/** ExcelJS declara su propio `Buffer` (extiende ArrayBuffer), que no existe en el navegador. */
type BufferExcelJS = Awaited<ReturnType<Workbook['xlsx']['writeBuffer']>>;

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const RE_TOKEN = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;
const RE_TOKEN_UNICO = /^\{\{\s*([A-Za-z0-9_.]+)\s*\}\}$/;
const RE_TOKEN_ITEM = /\{\{\s*item\./i;

export type ValorPlantilla = string | number | boolean | Date | null | undefined;

export interface DatosPlantilla {
  /** Valores simples; admite claves anidadas (`{{cliente.nombre}}`). */
  campos: Record<string, unknown>;
  /** Elementos de la fila repetible (`{{item.campo}}`). */
  items?: Record<string, ValorPlantilla>[];
  /** Limita el reemplazo a una hoja concreta; si se omite, se aplica a todas. */
  hoja?: string;
  /**
   * Modo de líneas fijas: filas de la tabla de ítems que ya vienen dibujadas en
   * la plantilla (contando la fila marcada). Los ítems se escriben hacia abajo
   * sin clonar ni borrar filas; las sobrantes se dejan en blanco y, si hay más
   * ítems que filas, el bloque crece copiando la última línea del formulario.
   */
  filasItems?: number;
}

export interface ResultadoRellenado {
  hojas: number;
  /** Celdas con marcas que se reemplazaron. */
  marcas: number;
  /** Filas de ítems que trae la plantilla (normalmente 1). */
  filasItem: number;
  /** Filas de ítems que se escribieron con los datos. */
  itemsEscritos: number;
  /** Filas que se agregaron al bloque de ítems por exceso de datos. */
  filasAgregadas: number;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
/** Texto de la celda si contiene texto (cadena o texto enriquecido); si no, null. */
function textoDeCelda(celda: Cell): string | null {
  const valor = celda.value;
  if (typeof valor === 'string') return valor;
  if (valor && typeof valor === 'object' && 'richText' in valor) {
    return valor.richText.map((run) => run.text).join('');
  }
  return null;
}

function comoTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    return valor.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return String(valor);
}

/** Resuelve `cliente.nombre` en { cliente: { nombre } } (o la clave literal si existe). */
function resolver(campos: Record<string, unknown>, ruta: string): unknown {
  if (Object.prototype.hasOwnProperty.call(campos, ruta)) return campos[ruta];
  let actual: unknown = campos;
  for (const parte of ruta.split('.')) {
    if (!actual || typeof actual !== 'object') return undefined;
    actual = (actual as Record<string, unknown>)[parte];
  }
  return actual;
}

function escribirValor(celda: Cell, valor: unknown): void {
  if (valor === null || valor === undefined) {
    celda.value = '';
    return;
  }
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean' || valor instanceof Date) {
    celda.value = valor;
    return;
  }
  celda.value = comoTexto(valor);
}

/** Reemplaza las marcas de una celda; las fórmulas y números se dejan intactos. */
function rellenarCelda(celda: Cell, campos: Record<string, unknown>, contador: ResultadoRellenado): void {
  const valor = celda.value;

  if (typeof valor === 'string') {
    if (!valor.includes('{{')) return;
    const unico = valor.trim().match(RE_TOKEN_UNICO);
    if (unico) {
      const directo = resolver(campos, unico[1]);
      if (directo !== undefined) {
        escribirValor(celda, directo);
        contador.marcas += 1;
        return;
      }
    }
    celda.value = valor.replace(RE_TOKEN, (_todo, clave: string) => comoTexto(resolver(campos, clave)));
    contador.marcas += 1;
    return;
  }

  if (valor && typeof valor === 'object' && 'richText' in valor) {
    const texto = valor.richText.map((run) => run.text).join('');
    if (!texto.includes('{{')) return;
    const unico = texto.trim().match(RE_TOKEN_UNICO);
    if (unico) {
      const directo = resolver(campos, unico[1]);
      if (directo !== undefined) {
        escribirValor(celda, directo);
        contador.marcas += 1;
        return;
      }
    }
    // Se reemplaza dentro de cada tramo para no perder el formato por tramos.
    valor.richText.forEach((run) => {
      run.text = run.text.replace(RE_TOKEN, (_todo, clave: string) => comoTexto(resolver(campos, clave)));
    });
    contador.marcas += 1;
  }
  // Números, fechas y fórmulas: intactos.
}

function cadaCeldaConTexto(hoja: Worksheet, fn: (celda: Cell) => void): void {
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    fila.eachCell({ includeEmpty: false }, (celda) => fn(celda));
  });
}

function filasDeItems(hoja: Worksheet): number[] {
  const filas: number[] = [];
  hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
    let tieneItems = false;
    fila.eachCell({ includeEmpty: false }, (celda) => {
      const texto = textoDeCelda(celda);
      if (texto && RE_TOKEN_ITEM.test(texto)) tieneItems = true;
    });
    if (tieneItems) filas.push(numero);
  });
  return filas;
}

function rellenarFilaDeItem(hoja: Worksheet, numeroFila: number, item: Record<string, ValorPlantilla>, contador: ResultadoRellenado): void {
  const fila = hoja.getRow(numeroFila);
  fila.eachCell({ includeEmpty: false }, (celda) => {
    const texto = textoDeCelda(celda);
    if (texto && RE_TOKEN_ITEM.test(texto)) rellenarCelda(celda, { item }, contador);
  });
  contador.itemsEscritos += 1;
}

// ---------------------------------------------------------------------------
// Modo de líneas fijas (`filasItems`)
// ---------------------------------------------------------------------------
interface ColumnaItem {
  col: number;
  /** Texto de la celda modelo; sirve de patrón para las demás líneas. */
  patron: string;
}

/** Columnas con marcas `item.*` de la fila modelo. */
function columnasDeItems(fila: Row): ColumnaItem[] {
  const columnas: ColumnaItem[] = [];
  fila.eachCell({ includeEmpty: false }, (celda, col) => {
    const texto = textoDeCelda(celda);
    if (texto && RE_TOKEN_ITEM.test(texto)) columnas.push({ col, patron: texto });
  });
  return columnas;
}

/** Escribe el ítem en una línea aplicando el patrón de la fila modelo. */
function escribirItemDesdePatron(
  celda: Cell,
  patron: string,
  item: Record<string, ValorPlantilla>,
  contador: ResultadoRellenado,
): void {
  const unico = patron.trim().match(RE_TOKEN_UNICO);
  if (unico) {
    const directo = resolver({ item }, unico[1]);
    if (directo !== undefined) {
      escribirValor(celda, directo);
      contador.marcas += 1;
      return;
    }
  }
  celda.value = patron.replace(RE_TOKEN, (_todo, clave: string) => comoTexto(resolver({ item }, clave)));
  contador.marcas += 1;
}

/**
 * Deja una línea del formulario en blanco. Solo se quitan los valores: los
 * estilos, las celdas combinadas y las fórmulas (incluidas las compartidas, que
 * apuntan a una celda maestra) quedan intactos para no romper el archivo.
 */
function limpiarFila(hoja: Worksheet, numeroFila: number): void {
  hoja.getRow(numeroFila).eachCell({ includeEmpty: false }, (celda) => {
    const valor = celda.value;
    if (valor === null || valor === undefined) return;
    // Objetos = fórmula, celda combinada o texto enriquecido: no se tocan.
    if (typeof valor === 'object') return;
    celda.value = null;
  });
}

interface RangoCombinado {
  arriba: number;
  abajo: number;
  columnaInicial: number;
  columnaFinal: number;
}

const RE_RANGO = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/;

/** Número de columna (1 = A) a letra. */
function letraColumna(numero: number): string {
  let resto = numero;
  let letra = '';
  while (resto > 0) {
    const resto26 = (resto - 1) % 26;
    letra = String.fromCharCode(65 + resto26) + letra;
    resto = Math.floor((resto - 1) / 26);
  }
  return letra;
}

function numeroColumna(letra: string): number {
  let numero = 0;
  for (const caracter of letra) numero = numero * 26 + (caracter.charCodeAt(0) - 64);
  return numero;
}

function leerRangos(hoja: Worksheet): RangoCombinado[] {
  const rangos: RangoCombinado[] = [];
  for (const rango of hoja.model.merges || []) {
    const m = rango.match(RE_RANGO);
    if (!m) continue;
    rangos.push({
      arriba: Number(m[2]),
      abajo: Number(m[4]),
      columnaInicial: numeroColumna(m[1]),
      columnaFinal: numeroColumna(m[3]),
    });
  }
  return rangos;
}

function aRango({ arriba, abajo, columnaInicial, columnaFinal }: RangoCombinado): string {
  return `${letraColumna(columnaInicial)}${arriba}:${letraColumna(columnaFinal)}${abajo}`;
}

/**
 * Copia la última línea del bloque para las líneas extra del formulario.
 *
 * ExcelJS inserta la fila con sus valores y estilos pero deja sin tocar el
 * índice de celdas combinadas (`_merges`), así que los rangos de abajo quedarían
 * apuntando a las filas viejas. Aquí se rehace ese índice a mano: es la única
 * forma de mover combinaciones sin perder los estilos de las celdas (unmerge
 * devuelve las celdas a un estilo genérico). `mergeCellsWithoutStyle` conserva
 * los bordes y rellenos que ya tenía cada celda del formulario.
 */
function crecerBloque(hoja: Worksheet, ultimaFila: number, extra: number): void {
  const antes = leerRangos(hoja);
  const deLaUltimaFila = antes.filter((r) => r.arriba === ultimaFila && r.abajo === ultimaFila);

  hoja.duplicateRow(ultimaFila, extra, true);

  const indice = hoja as unknown as { _merges: Record<string, unknown> };
  indice._merges = {};

  for (const rango of antes) {
    const movido: RangoCombinado = {
      arriba: rango.arriba > ultimaFila ? rango.arriba + extra : rango.arriba,
      abajo: rango.abajo > ultimaFila ? rango.abajo + extra : rango.abajo,
      columnaInicial: rango.columnaInicial,
      columnaFinal: rango.columnaFinal,
    };
    hoja.mergeCellsWithoutStyle(aRango(movido));
  }

  for (let i = 1; i <= extra; i += 1) {
    const destino = ultimaFila + i;
    for (const rango of deLaUltimaFila) {
      hoja.mergeCellsWithoutStyle(
        aRango({ ...rango, arriba: destino, abajo: destino }),
      );
    }
  }
}

/** Rellena el bloque de líneas fijas: escribe los ítems y limpia las sobrantes. */
function rellenarBloqueFijo(
  hoja: Worksheet,
  filaModelo: number,
  filas: number,
  items: Record<string, ValorPlantilla>[],
  contador: ResultadoRellenado,
): void {
  const columnas = columnasDeItems(hoja.getRow(filaModelo));
  const necesarias = Math.max(filas, items.length);

  if (necesarias > filas) {
    crecerBloque(hoja, filaModelo + filas - 1, necesarias - filas);
    contador.filasAgregadas += necesarias - filas;
  }

  for (let i = 0; i < necesarias; i += 1) {
    const numeroFila = filaModelo + i;
    const item = items[i];
    if (!item) {
      limpiarFila(hoja, numeroFila);
      continue;
    }
    for (const { col, patron } of columnas) {
      escribirItemDesdePatron(hoja.getCell(numeroFila, col), patron, item, contador);
    }
    contador.itemsEscritos += 1;
  }
}

function hojasObjetivo(wb: Workbook, datos: DatosPlantilla): Worksheet[] {
  if (!datos.hoja) return wb.worksheets;
  const hoja = wb.getWorksheet(datos.hoja);
  return hoja ? [hoja] : [];
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
/** Clona la fila (o filas) de ítems de la plantilla y la llena con `items`. */
function expandirItems(
  hoja: Worksheet,
  items: Record<string, ValorPlantilla>[],
  filasFijas: number | undefined,
  contador: ResultadoRellenado,
): void {
  const modelo = filasDeItems(hoja);
  contador.filasItem += modelo.length;

  // Formulario de líneas fijas: se rellena el bloque tal cual, sin quitar filas.
  if (filasFijas) {
    if (modelo.length > 0) rellenarBloqueFijo(hoja, modelo[0], filasFijas, items, contador);
    return;
  }

  // De abajo hacia arriba: así los índices de las filas restantes no se mueven.
  for (const numeroFila of [...modelo].reverse()) {
    if (items.length === 0) {
      hoja.spliceRows(numeroFila, 1);
      continue;
    }
    if (items.length > 1) hoja.duplicateRow(numeroFila, items.length - 1, true);
    items.forEach((item, i) => rellenarFilaDeItem(hoja, numeroFila + i, item, contador));
  }
}

export function rellenarPlantilla(wb: Workbook, datos: DatosPlantilla): ResultadoRellenado {
  const contador: ResultadoRellenado = { hojas: 0, marcas: 0, filasItem: 0, itemsEscritos: 0, filasAgregadas: 0 };
  const items = datos.items ?? [];

  for (const hoja of hojasObjetivo(wb, datos)) {
    contador.hojas += 1;
    expandirItems(hoja, items, datos.filasItems, contador);
    // Marcas simples, incluidas las de las filas de ítems ya clonadas.
    cadaCeldaConTexto(hoja, (celda) => rellenarCelda(celda, datos.campos, contador));
  }

  // Que Excel recalcule los totales/fórmulas de la plantilla al abrir el archivo.
  wb.calcProperties.fullCalcOnLoad = true;
  return contador;
}

/**
 * ExcelJS es un paquete CommonJS: en Node el constructor llega dentro de
 * `default` y en el navegador Vite lo expone como export nombrado. Se aceptan
 * las dos formas.
 */
async function cargarExcelJS(): Promise<typeof Workbook> {
  const modulo = await import('exceljs');
  const Libro = modulo.Workbook ?? (modulo as unknown as { default?: typeof modulo }).default?.Workbook;
  if (!Libro) throw new Error('No se pudo cargar ExcelJS (dependencia del generador de Excel).');
  return Libro;
}

export async function cargarPlantillaDesdeBuffer(datos: ArrayBuffer): Promise<Workbook> {
  const Libro = await cargarExcelJS();
  const wb = new Libro();
  await wb.xlsx.load(datos as BufferExcelJS);
  return wb;
}

/** Devuelve null si la plantilla no existe en esa ruta (404). */
export async function cargarPlantilla(url: string): Promise<Workbook | null> {
  const respuesta = await fetch(url, { cache: 'no-store' });
  if (!respuesta.ok) return null;
  return cargarPlantillaDesdeBuffer(await respuesta.arrayBuffer());
}

export async function descargarExcel(wb: Workbook, nombreArchivo: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: MIME_XLSX });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo.toLowerCase().endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/** Ciclo completo: cargar la plantilla, rellenarla y descargarla. */
export async function generarExcel(opciones: {
  plantilla: string;
  archivo: string;
  datos: DatosPlantilla;
}): Promise<ResultadoRellenado | null> {
  const wb = await cargarPlantilla(opciones.plantilla);
  if (!wb) return null;
  const resultado = rellenarPlantilla(wb, opciones.datos);
  await descargarExcel(wb, opciones.archivo);
  return resultado;
}
