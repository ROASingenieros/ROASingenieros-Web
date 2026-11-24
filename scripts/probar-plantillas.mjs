// ============================================================================
// Prueba de ida y vuelta de la plantilla de cotización.
// ============================================================================
// Empaqueta el motor real (frontend/src/externos/excel/*.ts) con rolldown, rellena la
// plantilla que sirve el panel con datos de ejemplo, vuelve a leer el .xlsx
// resultante y verifica que todo quedó donde debe: encabezado, datos del
// cliente (con RUC o DNI), tabla de 20 líneas, totales y notas.
//
//   npm run probar:plantillas
// ============================================================================
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { rolldown } from 'rolldown';
import { DESTINO, DESTINO_IMAGENES, ORIGEN, adaptarPlantilla } from './plantilla-cotizacion.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOTOR = join(RAIZ, '.tmp-motor.mjs');
const DOCS = join(RAIZ, '.tmp-documentos.mjs');

const TEMPORALES = [
  MOTOR,
  DOCS,
  join(RAIZ, '.tmp-salida-cotizacion.xlsx'),
  join(RAIZ, '.tmp-salida-dni.xlsx'),
  join(RAIZ, '.tmp-salida-vacia.xlsx'),
  join(RAIZ, '.tmp-salida-larga.xlsx'),
];

/** Empaqueta un módulo del panel con el mismo rolldown que usa Vite. */
async function empaquetar(entrada, salida) {
  const bundle = await rolldown({
    input: join(RAIZ, entrada),
    // exceljs, qrcode y jszip se dejan fuera para que la prueba use los de node_modules.
    external: ['exceljs', 'qrcode', 'jszip'],
    // documentos.ts lee import.meta.env.BASE_URL y supabase.ts las claves;
    // en la prueba no hacen falta valores reales.
    transform: {
      define: {
        'import.meta.env.BASE_URL': '"/"',
        'import.meta.env.VITE_SUPABASE_URL': '"http://localhost"',
        'import.meta.env.VITE_SUPABASE_ANON_KEY': '"prueba"',
      },
    },
  });
  await bundle.write({ file: salida, format: 'es', codeSplitting: false });
  await bundle.close();
}

/** ArrayBuffer limpio (el Buffer de readFileSync comparte memoria con el pool). */
function leerArrayBuffer(ruta) {
  const buf = readFileSync(ruta);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function leerExcel(ruta) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(leerArrayBuffer(ruta));
  return wb;
}

function celda(hoja, direccion) {
  return hoja.getCell(direccion).value;
}

/** Error si queda alguna marca sin reemplazar en el libro. */
function sinMarcas(hoja, etiqueta) {
  const sobrantes = [];
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    fila.eachCell({ includeEmpty: false }, (c) => {
      const texto = typeof c.value === 'string' ? c.value : c.value?.richText?.map((r) => r.text).join('') || '';
      if (texto.includes('{{')) sobrantes.push(`${c.address}: ${texto}`);
    });
  });
  assert.deepEqual(sobrantes, [], `${etiqueta}: quedaron marcas sin reemplazar`);
}

/** Mapa "dirección �  valor" de las celdas con contenido (para comparar libros). */
function mapaDeCeldas(hoja) {
  const mapa = {};
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    fila.eachCell({ includeEmpty: false }, (c) => {
      const v = c.value;
      const texto =
        v && typeof v === 'object' && 'formula' in v
          ? `=${v.formula}`
          : v && typeof v === 'object' && 'sharedFormula' in v
            ? `=(compartida ${v.sharedFormula})`
            : v && typeof v === 'object' && 'richText' in v
              ? v.richText.map((r) => r.text).join('')
              : v;
      if (texto !== null && texto !== undefined && texto !== '') mapa[c.address] = texto;
    });
  });
  return mapa;
}

function hojaUnica(wb, etiqueta) {
  const hojas = wb.worksheets.filter((h) => h.name === 'COTIZACION');
  assert.equal(hojas.length, 1, `${etiqueta}: falta la hoja COTIZACION`);
  return hojas[0];
}

async function generar(motor, docs, cotizacion, items, destino) {
  const wb = await motor.cargarPlantillaDesdeBuffer(leerArrayBuffer(destino.plantilla));
  assert.ok(wb, 'no se pudo cargar la plantilla de cotización');
  const res = motor.rellenarPlantilla(wb, docs.datosDeCotizacion(cotizacion, items));
  await writeFile(destino.archivo, Buffer.from(await wb.xlsx.writeBuffer()));
  return res;
}

// ----------------------------------------------------------------------------
// Datos de ejemplo
// ----------------------------------------------------------------------------
const CLIENTE_EMPRESA = {
  id: 5,
  nombre_razon_social: 'ACME SAC',
  num_documento: '20556677889',
  apellidos: null,
  direccion: 'Av. Siempre Viva 123, Lima',
  telefono: '999888777',
  correo: 'compras@acme.pe',
  tipo_documento: { descripcion: 'RUC', codigo_sunat: '6' },
};

const CLIENTE_PERSONA = {
  id: 6,
  nombre_razon_social: 'Juan',
  num_documento: '45678912',
  apellidos: 'Pérez Gómez',
  direccion: 'Calle Los Pinos 45, Ate',
  telefono: '988777666',
  correo: null,
  tipo_documento: { descripcion: 'DNI', codigo_sunat: '1' },
};

function cotizacionDe(cliente, sobrescribir = {}) {
  return {
    id: 1,
    num_cotizacion: 'COT-000123',
    // Mediodía en Perú: la fecha impresa (día local) es la misma en cualquier zona.
    fecha_emision: '2026-10-10T12:00:00-05:00',
    id_cliente: cliente.id,
    id_empleado: null,
    origen: 'interno',
    estado: 'enviada',
    subtotal: 1000,
    igv: 180,
    total: 1180,
    notas: 'Entrega en 5 días útiles.',
    cliente,
    ...sobrescribir,
  };
}

const ITEMS = [
  {
    id: 1,
    id_producto: 1,
    cantidad: 2,
    precio_unitario: 250,
    subtotal: 500,
    producto: { id: 1, nombre: 'Cable THW 10 mm', codigo: 'CAB-10', tipo: 'producto', unidad_medida: 'metro' },
  },
  {
    id: 2,
    id_producto: 2,
    cantidad: 1,
    precio_unitario: 500,
    subtotal: 500,
    producto: { id: 2, nombre: 'Tablero eléctrico 12 polos', codigo: null, tipo: 'producto', unidad_medida: 'unidad' },
  },
];

const ITEMS_LARGOS = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  id_producto: i + 1,
  cantidad: 1,
  precio_unitario: 10 + i,
  subtotal: 10 + i,
  producto: { id: i + 1, nombre: `Ítem de prueba ${i + 1}`, codigo: null, tipo: 'producto', unidad_medida: 'unidad' },
}));

const resultados = [];
function ok(nombre, detalle) {
  resultados.push(`  �S ${nombre}${detalle ? ` � ${detalle}` : ''}`);
}

try {
  // ==========================================================================
  // 0) La plantilla publicada está al día con el Excel de la empresa
  // ==========================================================================
  if (existsSync(ORIGEN)) {
    assert.ok(existsSync(DESTINO), `falta la plantilla publicada: ${DESTINO} (corre npm run plantilla:cotizacion)`);

    const { wb: wbAdaptado } = await adaptarPlantilla();
    const wbPublicado = await leerExcel(DESTINO);
    assert.deepEqual(
      mapaDeCeldas(hojaUnica(wbPublicado, 'publicada')),
      mapaDeCeldas(hojaUnica(wbAdaptado, 'adaptada')),
      'la plantilla publicada qued� desactualizada: vuelve a correr npm run plantilla:cotizacion',
    );
    assert.deepEqual(
      (hojaUnica(wbPublicado, 'publicada').model.merges || []).slice().sort(),
      (hojaUnica(wbAdaptado, 'adaptada').model.merges || []).slice().sort(),
      'las celdas combinadas de la plantilla publicada no coinciden con el Excel de la empresa',
    );
    ok('plantilla publicada = Excel de la empresa + marcas', 'mismas celdas y combinaciones');
  } else {
    assert.ok(existsSync(DESTINO), `falta la plantilla publicada: ${DESTINO}`);
    ok('plantilla publicada existente', `${DESTINO} (Excel original externo no disponible)`);
  }

  assert.ok(
    existsSync(join(DESTINO_IMAGENES, 'membrete-logo.png')),
    'falta el logo del membrete para la impresi�n (frontend/public/documentos/)',
  );
  ok('logos del membrete extraídos', 'frontend/public/documentos/membrete-logo.png');

  await empaquetar('frontend/src/externos/excel/plantilla.ts', MOTOR);
  await empaquetar('frontend/src/externos/excel/documentos.ts', DOCS);

  const motor = await import(pathToFileURL(MOTOR).href);
  const docs = await import(pathToFileURL(DOCS).href);

  // ==========================================================================
  // 1) Cotización de una empresa (RUC) con 2 ítems
  // ==========================================================================
  const archivoCot = join(RAIZ, '.tmp-salida-cotizacion.xlsx');
  const resCot = await generar(motor, docs, cotizacionDe(CLIENTE_EMPRESA), ITEMS, {
    plantilla: DESTINO,
    archivo: archivoCot,
  });
  assert.equal(resCot.filasItem, 1, 'la plantilla debe traer 1 fila modelo de ítems');
  assert.equal(resCot.itemsEscritos, 2);
  assert.equal(resCot.filasAgregadas, 0, 'con 2 ítems no debe crecer el bloque');
  assert.equal(resCot.hojas, 1);

  const h = hojaUnica(await leerExcel(archivoCot), 'cotización RUC');

  // Encabezado y datos del cliente.
  assert.equal(celda(h, 'G9'), 'LIMA,');
  assert.equal(celda(h, 'H9'), '10');
  assert.equal(celda(h, 'I9'), '10');
  assert.equal(celda(h, 'J9'), '2026');
  assert.equal(celda(h, 'C9'), 'ACME SAC');
  assert.equal(celda(h, 'B10'), 'RUC:');
  assert.equal(celda(h, 'C10'), '20556677889');
  assert.equal(celda(h, 'C11'), 'Av. Siempre Viva 123, Lima');
  assert.equal(celda(h, 'C12'), 'Cable THW 10 mm y 1 ítem(s) más');
  assert.equal(celda(h, 'G10'), 'COTIZACION Nº COT-000123');
  assert.equal(celda(h, 'I42'), 'Contado');
  ok('cotización: fecha (G9�J9), cliente, asunto, forma de pago y número', 'G9�J9, C9�C12, G10, I42');

  // Las 21 líneas del formulario (fila 16 a 36): 2 con datos (fila 16 y 17), el resto en blanco.
  assert.equal(celda(h, 'B16'), 1);
  assert.equal(celda(h, 'C16'), 'Cable THW 10 mm (CAB-10)');
  assert.equal(celda(h, 'F16'), 'metro');
  assert.equal(celda(h, 'G16'), 2);
  assert.equal(celda(h, 'H16'), 250);
  assert.equal(celda(h, 'I16'), 500);
  assert.equal(typeof celda(h, 'H16'), 'number', 'los montos deben ser números, no texto');
  assert.equal(celda(h, 'B17'), 2);
  assert.equal(celda(h, 'C17'), 'Tablero eléctrico 12 polos');
  assert.equal(celda(h, 'I17'), 500);
  assert.equal(celda(h, 'B18'), null, 'la línea 3 debe quedar en blanco');
  assert.equal(celda(h, 'C18'), null);
  assert.equal(celda(h, 'I18'), null);
  assert.equal(celda(h, 'B36'), null, 'la última línea del bloque también se limpia');
  ok('cotización: 2 líneas con datos y 19 en blanco', 'filas 16�36');

  // Totales y notas (los escribe la base, no fórmulas).
  assert.equal(celda(h, 'I38'), 1000);
  assert.equal(celda(h, 'I39'), 180);
  assert.equal(celda(h, 'I40'), 1180);
  assert.equal(celda(h, 'B43'), 'Entrega en 5 días útiles.');
  sinMarcas(h, 'cotización RUC');
  ok('cotización: totales y notas, sin marcas sobrantes', 'I38�I40, B43');

  // El bloque de ítems conserva sus combinaciones (tabla del formulario).
  for (const rango of ['C16:E16', 'I16:J16', 'C17:E17', 'I17:J17', 'C36:E36', 'I36:J36', 'B43:E43']) {
    assert.ok((h.model.merges || []).includes(rango), `se perdió la combinación ${rango}`);
  }
  ok('cotización: tabla y notas siguen combinadas', 'C17:E17, I17:J17, B43:E43');

  // El personal de la empresa abre el documento en Excel: no debe haber
  // fórmulas muertas ni referencias a la plantilla.
  const zip = await JSZip.loadAsync(readFileSync(archivoCot));
  const xmlHoja = await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.ok(!xmlHoja.includes('<f>'), 'el documento entregado no debe llevar fórmulas');
  assert.ok(zip.file('xl/workbook.xml'), 'falta xl/workbook.xml');
  ok('cotización: sin fórmulas en el documento entregado', 'xl/worksheets/sheet1.xml');

  // ==========================================================================
  // 2) Persona natural (DNI, sin RUC): etiqueta y nombre correctos
  // ==========================================================================
  const archivoDni = join(RAIZ, '.tmp-salida-dni.xlsx');
  await generar(motor, docs, cotizacionDe(CLIENTE_PERSONA), ITEMS, { plantilla: DESTINO, archivo: archivoDni });
  const hDni = hojaUnica(await leerExcel(archivoDni), 'cotización DNI');
  assert.equal(celda(hDni, 'B10'), 'DNI:');
  assert.equal(celda(hDni, 'C10'), '45678912');
  assert.equal(celda(hDni, 'C9'), 'Juan Pérez Gómez');
  sinMarcas(hDni, 'cotización DNI');
  ok('cotización sin RUC: etiqueta DNI y nombres', 'B10/C9/C10');

  // ==========================================================================
  // 3) Cotización sin ítems: las líneas quedan vacías
  // ==========================================================================
  const archivoVacio = join(RAIZ, '.tmp-salida-vacia.xlsx');
  const resVacia = await generar(motor, docs, cotizacionDe(CLIENTE_EMPRESA), [], {
    plantilla: DESTINO,
    archivo: archivoVacio,
  });
  assert.equal(resVacia.itemsEscritos, 0);
  const hVacia = hojaUnica(await leerExcel(archivoVacio), 'cotización vacía');
  for (const fila of [16, 17, 36]) {
    assert.equal(celda(hVacia, `B${fila}`), null, `la línea ${fila} debía quedar vacía`);
    assert.equal(celda(hVacia, `C${fila}`), null);
    assert.equal(celda(hVacia, `I${fila}`), null);
  }
  sinMarcas(hVacia, 'cotización vacía');
  ok('cotización sin ítems: 21 líneas en blanco');

  // ==========================================================================
  // 4) Cotización larga: el bloque crece y el pie baja con él
  // ==========================================================================
  const archivoLarga = join(RAIZ, '.tmp-salida-larga.xlsx');
  const resLarga = await generar(motor, docs, cotizacionDe(CLIENTE_EMPRESA), ITEMS_LARGOS, {
    plantilla: DESTINO,
    archivo: archivoLarga,
  });
  assert.equal(resLarga.itemsEscritos, 25);
  assert.equal(resLarga.filasAgregadas, 4, 'con 25 ítems deben agregarse 4 líneas (25 - 21)');

  const hLarga = hojaUnica(await leerExcel(archivoLarga), 'cotización larga');
  assert.equal(celda(hLarga, 'C16'), 'Ítem de prueba 1');
  assert.equal(celda(hLarga, 'C40'), 'Ítem de prueba 25', 'el ítem 25 va en la fila 40');
  assert.equal(celda(hLarga, 'I40'), 34);
  assert.equal(celda(hLarga, 'C41'), null, 'después del último ítem la línea queda vacía');
  assert.equal(celda(hLarga, 'B47'), 'Entrega en 5 días útiles.', 'el pie baja con las líneas extra');
  assert.deepEqual(
    (hLarga.model.merges || []).filter((r) => /^[CI](3[7-9]|4[0-1]):/.test(r)).sort(),
    ['C37:E37', 'C38:E38', 'C39:E39', 'C40:E40', 'I37:J37', 'I38:J38', 'I39:J39', 'I40:J40'],
    'las líneas agregadas deben conservar las combinaciones del formulario',
  );
  sinMarcas(hLarga, 'cotización larga');
  ok('cotización de 25 ítems: el bloque crece 4 líneas', 'filas 16�40 + pie');

  console.log('\nPlantilla de cotización � todas las comprobaciones pasaron:');
  console.log(resultados.join('\n'));
} finally {
  for (const ruta of TEMPORALES) rmSync(ruta, { force: true });
}

