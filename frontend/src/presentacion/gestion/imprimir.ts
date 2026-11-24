// ============================================================================
// Impresión / PDF: abre una ventana con un documento autocontenido.
// ============================================================================
// Evita que se imprima toda la interfaz del panel: solo el documento.
// ============================================================================
/**
 * `estilosExtra` permite que un documento (por ejemplo la cotización, que
 * replica el formato de la empresa) agregue sus propias reglas.
 */
export function imprimirDocumento(titulo: string, cuerpoHtml: string, estilosExtra = ''): void {
  const ventana = window.open('', '_blank', 'width=800,height=900');
  if (!ventana) {
    window.alert('Permite las ventanas emergentes para imprimir o guardar en PDF.');
    return;
  }
  ventana.document.write(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${titulo}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 32px; font-size: 13px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 0 0 12px; }
  .marca { font-weight: 800; letter-spacing: 1px; }
  .sub { color: #555; font-size: 12px; }
  .aviso { margin: 14px 0; padding: 8px 10px; border: 1px dashed #b45309; color: #92400e; background: #fffbeb; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 12px; }
  th { background: #f5f5f5; }
  .totales { margin-left: auto; width: 260px; }
  .totales div { display: flex; justify-content: space-between; padding: 3px 0; }
  .totales .total { font-weight: 700; font-size: 15px; border-top: 2px solid #111; margin-top: 4px; padding-top: 6px; }
  @media print { body { margin: 12mm; } }
${estilosExtra}
</style>
</head>
<body>${cuerpoHtml}</body>
</html>`);
  ventana.document.close();
  ventana.focus();
  setTimeout(() => ventana.print(), 300);
}
