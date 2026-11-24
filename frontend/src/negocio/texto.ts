// ============================================================================
// Reglas de texto compartidas por el panel.
//
// - `esCorreoValido`: un único criterio de correo para clientes, proveedores,
//   empleados, usuarios y la recuperación de contraseña. Antes cada pantalla
//   lo miraba distinto (o directamente no lo miraba).
// - `enMayusculas`: los nombres de personas y empresas se imprimen en
//   MAYÚSCULAS en los reportes (Excel y PDF). Es una regla de presentación:
//   el dato se guarda tal como lo escribió el usuario.
// ============================================================================

/**
 * usuario@dominio.tld
 * - sin espacios ni arrobas dobles;
 * - el punto no puede ir al inicio, al final ni repetido;
 * - la extensión final es de dos letras o más (`.com`, `.pe`, `.com.pe`).
 */
import { validarFormatoCorreo } from './validaciones';

/**
 * ¿El texto tiene forma de correo válido y dominio verificado?
 * Valida formato RFC, ausencia de puntos consecutivos, extensión TLD válida
 * y rechaza correos temporales/desechables.
 */
export function esCorreoValido(correo: string | null | undefined): boolean {
  return validarFormatoCorreo(correo, true).valido;
}

/** Texto en MAYÚSCULAS para los reportes. Nulo o vacío → ''. */
export function enMayusculas(texto: string | null | undefined): string {
  return (texto ?? '').trim().toUpperCase();
}

/** Convierte un importe numérico a su expresión en letras para comprobantes SUNAT (ej. "SON: CIENTO DIEZ CON 00/100 SOLES") */
export function numeroALetras(monto: number): string {
  const entero = Math.floor(Math.abs(monto));
  const centavos = Math.round((Math.abs(monto) - entero) * 100);
  const centavosStr = String(centavos).padStart(2, '0');

  function convertirGrupo(n: number): string {
    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    if (n < 10) return unidades[n];
    if (n >= 10 && n < 20) return especiales[n - 10];
    if (n === 20) return 'VEINTE';
    if (n > 20 && n < 30) return 'VEINTI' + unidades[n - 20];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return decenas[d] + (u > 0 ? ' Y ' + unidades[u] : '');
    }
    const c = Math.floor(n / 100);
    const resto = n % 100;
    return centenas[c] + (resto > 0 ? ' ' + convertirGrupo(resto) : '');
  }

  function convertirEntero(num: number): string {
    if (num === 0) return 'CERO';
    if (num === 1) return 'UN';
    let res = '';
    const millones = Math.floor(num / 1000000);
    const miles = Math.floor((num % 1000000) / 1000);
    const resto = num % 1000;

    if (millones > 0) {
      if (millones === 1) res += 'UN MILLÓN ';
      else res += convertirEntero(millones) + ' MILLONES ';
    }
    if (miles > 0) {
      if (miles === 1) res += 'MIL ';
      else res += convertirEntero(miles) + ' MIL ';
    }
    if (resto > 0) {
      res += convertirGrupo(resto);
    }
    return res.trim();
  }

  const textoEntero = convertirEntero(entero);
  return `${textoEntero} CON ${centavosStr}/100 SOLES`;
}

export * from './validaciones';
