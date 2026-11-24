// ============================================================================
// Reglas de validación y sanitización centralizadas - ROAS Ingenieros
// ============================================================================
// Validación tanto en frontend (tiempo real y envío de formularios)
// como en la lógica de negocio compartida.
//
// Reglas principales requeridas:
// 1. Nombres: no se permiten números (solo letras, espacios, acentos, diéresis, ñ).
// 2. Teléfono: no se permiten letras (solo números y caracteres telefónicos válidos).
// 3. Apellidos: no se permiten números ni caracteres especiales (solo letras, acentos y espacios).
// 4. Correo electrónico: comprobación de formato estricto, detección de tipografías erróneas,
//    bloqueo de correos temporales/desechables y verificación de existencia de dominio.
// 5. Documentos SUNAT: DNI (8 dígitos) y RUC (11 dígitos).
// 6. Montos y cantidades: números positivos válidos.
// ============================================================================

import { supabase } from '../datos/supabase.ts';

export interface ResultadoValidacion {
  valido: boolean;
  error?: string;
  sugerencia?: string;
}

// ----------------------------------------------------------------------------
// Constantes y Expresiones Regulares
// ----------------------------------------------------------------------------

/** Letras en español con tildes, diéresis, ñ y espacios/separadores permitidos en nombres */
export const REGEX_SOLO_LETRAS_Y_ESPACIOS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]+$/;

/** Solo letras y espacios para apellidos (sin números ni caracteres especiales como @#$%&*) */
export const REGEX_APELLIDOS_ESTRICTO = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;

/** Detección de dígitos numéricos */
export const REGEX_TIENE_NUMEROS = /\d/;

/** Detección de letras */
export const REGEX_TIENE_LETRAS = /[a-zA-Z]/;

/** Caracteres no permitidos en teléfono */
export const REGEX_TELEFONO_CARACTERES_INVALIDOS = /[^0-9+\-\s()]/;

/** Celular peruano estándar: 9 dígitos comenzando con 9 */
export const REGEX_CELULAR_PERUANO = /^9\d{8}$/;

/** DNI peruano: exactamente 8 dígitos */
export const REGEX_DNI = /^\d{8}$/;

/** RUC peruano: exactamente 11 dígitos */
export const REGEX_RUC = /^\d{11}$/;

/** Formato RFC de correo electrónico con validación de TLD */
export const REGEX_CORREO_ESTRICTO =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/** Dominios temporales / desechables conocidos que deben rechazarse */
const DOMINIOS_DESECHABLES = new Set([
  'mailinator.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'dispostable.com',
  'fakeinbox.com',
  'mohmal.com',
  'sharklasers.com',
  'getairmail.com',
  'mytemp.email',
  'disposablemail.com',
  'crazymailing.com',
]);

/** Errores tipográficos comunes en dominios de correo con su corrección */
const ERRORES_TIPOGRAFICOS_CORREO: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahor.com': 'yahoo.com',
  'iclod.com': 'icloud.com',
};

// ----------------------------------------------------------------------------
// 1. Validación de Nombres
// ----------------------------------------------------------------------------

/**
 * Valida un nombre:
 * - No puede contener números.
 * - Solo puede contener letras y espacios (permite tildes, ñ, diéresis).
 * - Longitud mínima 2 caracteres.
 */
export function validarNombre(nombre: string | null | undefined, obligatorio = true): ResultadoValidacion {
  const texto = (nombre ?? '').trim();

  if (!texto) {
    return obligatorio
      ? { valido: false, error: 'El nombre es obligatorio.' }
      : { valido: true };
  }

  if (REGEX_TIENE_NUMEROS.test(texto)) {
    return { valido: false, error: 'El nombre no puede contener números.' };
  }

  if (!REGEX_SOLO_LETRAS_Y_ESPACIOS.test(texto)) {
    return { valido: false, error: 'El nombre solo puede contener letras y espacios.' };
  }

  if (texto.length < 2) {
    return { valido: false, error: 'El nombre debe tener al menos 2 caracteres.' };
  }

  if (texto.length > 80) {
    return { valido: false, error: 'El nombre no puede exceder los 80 caracteres.' };
  }

  return { valido: true };
}

// ----------------------------------------------------------------------------
// 2. Validación de Apellidos
// ----------------------------------------------------------------------------

/**
 * Valida apellidos:
 * - NO se puede poner números.
 * - NO se puede poner caracteres especiales (como @, #, $, %, etc.).
 * - Solo letras (con acentos/ñ), espacios y guion simple en apellidos compuestos.
 */
export function validarApellido(apellidos: string | null | undefined, obligatorio = true): ResultadoValidacion {
  const texto = (apellidos ?? '').trim();

  if (!texto) {
    return obligatorio
      ? { valido: false, error: 'Los apellidos son obligatorios.' }
      : { valido: true };
  }

  if (REGEX_TIENE_NUMEROS.test(texto)) {
    return { valido: false, error: 'Los apellidos no pueden contener números.' };
  }

  if (!REGEX_APELLIDOS_ESTRICTO.test(texto)) {
    return {
      valido: false,
      error: 'Los apellidos no pueden contener números ni caracteres especiales.',
    };
  }

  if (texto.length < 2) {
    return { valido: false, error: 'Los apellidos deben tener al menos 2 caracteres.' };
  }

  if (texto.length > 80) {
    return { valido: false, error: 'Los apellidos no pueden exceder los 80 caracteres.' };
  }

  return { valido: true };
}

// ----------------------------------------------------------------------------
// 3. Validación de Teléfono / Celular
// ----------------------------------------------------------------------------

/**
 * Valida un teléfono:
 * - NO se puede poner letras bajo ninguna circunstancia.
 * - Solo dígitos y separadores telefónicos (+, -, espacios, paréntesis).
 * - Si es celular peruano estricto: debe tener 9 dígitos y empezar con 9.
 */
export function validarTelefono(
  telefono: string | null | undefined,
  obligatorio = true,
  exigirCelularPeruano = false
): ResultadoValidacion {
  const texto = (telefono ?? '').trim();

  if (!texto) {
    return obligatorio
      ? { valido: false, error: 'El teléfono es obligatorio.' }
      : { valido: true };
  }

  if (REGEX_TIENE_LETRAS.test(texto)) {
    return { valido: false, error: 'El teléfono no puede contener letras.' };
  }

  if (REGEX_TELEFONO_CARACTERES_INVALIDOS.test(texto)) {
    return { valido: false, error: 'El teléfono contiene caracteres no válidos (solo números y signos +, -).' };
  }

  const digitos = texto.replace(/\D/g, '');

  if (exigirCelularPeruano) {
    // Si incluye código de país 51 (ej. +51 987654321 -> 11 dígitos)
    const esCelularValido =
      REGEX_CELULAR_PERUANO.test(digitos) || (digitos.startsWith('51') && REGEX_CELULAR_PERUANO.test(digitos.slice(2)));

    if (!esCelularValido) {
      return {
        valido: false,
        error: 'Ingresa un número celular peruano válido (9 dígitos, empieza con 9).',
      };
    }
  } else {
    // Teléfono general (fijo o móvil, nacional o internacional)
    if (digitos.length < 7 || digitos.length > 15) {
      return {
        valido: false,
        error: 'El teléfono debe contener entre 7 y 15 dígitos numéricos.',
      };
    }
  }

  return { valido: true };
}

// ----------------------------------------------------------------------------
// 4. Validación y Comprobación de Correo Electrónico
// ----------------------------------------------------------------------------

/**
 * Comprueba formato, estructura de dominio, tipografías y correos desechables.
 */
export function validarFormatoCorreo(correo: string | null | undefined, obligatorio = true): ResultadoValidacion {
  const texto = (correo ?? '').trim().toLowerCase();

  if (!texto) {
    return obligatorio
      ? { valido: false, error: 'El correo electrónico es obligatorio.' }
      : { valido: true };
  }

  if (!REGEX_CORREO_ESTRICTO.test(texto)) {
    return {
      valido: false,
      error: 'Ingresa un formato de correo válido (ejemplo: contacto@dominio.com).',
    };
  }

  if (texto.includes('..')) {
    return { valido: false, error: 'El correo no puede tener puntos consecutivos.' };
  }

  const partes = texto.split('@');
  if (partes.length !== 2) {
    return { valido: false, error: 'El correo debe tener un único símbolo @.' };
  }

  const [usuario, dominio] = partes;
  if (usuario.startsWith('.') || usuario.endsWith('.')) {
    return { valido: false, error: 'El nombre de usuario del correo no puede empezar ni terminar con un punto.' };
  }

  // Verificar extensión (TLD)
  const partesDominio = dominio.split('.');
  const tld = partesDominio[partesDominio.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]+$/i.test(tld)) {
    return { valido: false, error: 'El dominio del correo debe tener una extensión válida (ej. .com, .pe).' };
  }

  // Detección de errores comunes de tipeo
  if (ERRORES_TIPOGRAFICOS_CORREO[dominio]) {
    const sugerido = `${usuario}@${ERRORES_TIPOGRAFICOS_CORREO[dominio]}`;
    return {
      valido: false,
      error: `¿Quisiste escribir ${sugerido}? Revisa el dominio.`,
      sugerencia: sugerido,
    };
  }

  // Bloqueo de dominios temporales / desechables
  if (DOMINIOS_DESECHABLES.has(dominio)) {
    return {
      valido: false,
      error: 'No se permiten correos temporales o desechables. Usa un correo corporativo o personal real.',
    };
  }

  return { valido: true };
}

/**
 * Comprueba si el correo electrónico y su dominio existen realmente:
 * 1. Comprueba sintaxis RFC y ausencia de errores tipográficos.
 * 2. Bloquea dominios desechables/temporales.
 * 3. Realiza consulta DNS en vivo (registros MX y A) mediante DNS-over-HTTPS
 *    (Google DNS / Cloudflare) y la Edge Function de Supabase para confirmar
 *    que el dominio existe en internet y cuenta con servidores de correo activos.
 */
export async function comprobarCorreoExiste(correo: string): Promise<ResultadoValidacion> {
  const formato = validarFormatoCorreo(correo, true);
  if (!formato.valido) return formato;

  const partes = correo.trim().toLowerCase().split('@');
  if (partes.length !== 2) return { valido: false, error: 'Correo inválido.' };
  const dominio = partes[1];

  // Dominios de la empresa o pruebas autorizadas
  const DOMINIOS_AUTORIZADOS = new Set(['roasingenieros.com', 'roas.pe', 'localhost']);
  if (DOMINIOS_AUTORIZADOS.has(dominio)) {
    return { valido: true };
  }

  // 1. Verificación directa mediante DNS-over-HTTPS (DoH de Google DNS con CORS abierto)
  try {
    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), 4000);

    const respuestaDns = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(dominio)}&type=MX`,
      { signal: controlador.signal }
    );
    clearTimeout(timeout);

    if (respuestaDns.ok) {
      const dataDns = (await respuestaDns.json()) as {
        Status: number;
        Answer?: { name: string; type: number; data: string }[];
      };

      // Status 3 = NXDOMAIN: El dominio no existe en los servidores raíz de internet
      if (dataDns.Status === 3) {
        return {
          valido: false,
          error: `El correo no existe: el dominio @${dominio} no está registrado en internet.`,
        };
      }

      // Status 0 = NOERROR: Verificar si tiene servidores MX
      const tieneMx = Array.isArray(dataDns.Answer) && dataDns.Answer.some((a) => a.type === 15);
      if (tieneMx) {
        return { valido: true };
      }

      // Si no tiene registros MX, verificar si al menos el dominio tiene registro A (sitio web con correo directo)
      try {
        const resA = await fetch(
          `https://dns.google/resolve?name=${encodeURIComponent(dominio)}&type=A`
        );
        if (resA.ok) {
          const dataA = (await resA.json()) as { Status: number; Answer?: unknown[] };
          if (dataA.Status === 3 || !dataA.Answer || dataA.Answer.length === 0) {
            return {
              valido: false,
              error: `El dominio @${dominio} no tiene servidores de correo ni registros válidos.`,
            };
          }
        }
      } catch {
        // Continuar si la consulta secundaria no responde
      }
    }
  } catch {
    // Si Google DNS no responde o no hay conexión externa, recurrir a la Edge Function
  }

  // 2. Consulta de respaldo a la Edge Function de Supabase
  try {
    const { data, error } = await supabase.functions.invoke('verificar-correo', {
      body: { correo: correo.trim().toLowerCase() },
    });

    if (!error && data) {
      const res = data as { ok?: boolean; existe?: boolean; error?: string; sugerencia?: string };
      if (res.existe === false) {
        return {
          valido: false,
          error: res.error || `El dominio @${dominio} no puede recibir correos.`,
          sugerencia: res.sugerencia,
        };
      }
    }
  } catch {
    // Si ambos métodos remotos están temporalmente inaccesibles, no bloquear si el formato es válido
  }

  return { valido: true };
}

// ----------------------------------------------------------------------------
// 5. Validación de Documentos de Identidad (SUNAT)
// ----------------------------------------------------------------------------

/**
 * Valida DNI, RUC u otros según el código SUNAT o tipo seleccionado.
 */
export function validarDocumentoIdentidad(
  codigoSunat: string | undefined,
  numDocumento: string
): ResultadoValidacion {
  const num = (numDocumento ?? '').trim();

  if (!num) {
    return { valido: false, error: 'El número de documento es obligatorio.' };
  }

  // DNI: código SUNAT 1
  if (codigoSunat === '1') {
    if (!REGEX_DNI.test(num)) {
      return { valido: false, error: 'El DNI debe tener exactamente 8 dígitos numéricos (sin letras ni espacios).' };
    }
  }

  // RUC: código SUNAT 6
  if (codigoSunat === '6') {
    if (!REGEX_RUC.test(num)) {
      return { valido: false, error: 'El RUC debe tener exactamente 11 dígitos numéricos.' };
    }
    const prefijo = num.slice(0, 2);
    const prefijosValidos = ['10', '15', '17', '20'];
    if (!prefijosValidos.includes(prefijo)) {
      return {
        valido: false,
        error: 'El RUC debe comenzar con 10, 15, 17 o 20 (persona natural con negocio o persona jurídica).',
      };
    }
  }

  return { valido: true };
}

// ----------------------------------------------------------------------------
// 6. Validación de Contraseñas
// ----------------------------------------------------------------------------

export function validarContrasena(clave: string | null | undefined): ResultadoValidacion {
  const texto = clave ?? '';
  if (texto.length < 6) {
    return { valido: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
  }
  if (!REGEX_TIENE_LETRAS.test(texto) || !REGEX_TIENE_NUMEROS.test(texto)) {
    return {
      valido: false,
      error: 'La contraseña debe incluir al menos una letra y un número por seguridad.',
    };
  }
  return { valido: true };
}

// ----------------------------------------------------------------------------
// 7. Sanitizadores y Filtros en Tiempo Real (para eventos onChange)
// ----------------------------------------------------------------------------

/** Remueve cualquier dígito numérico (0-9) */
export function limpiarNumeros(valor: string): string {
  return valor.replace(/[0-9]/g, '');
}

/** Remueve cualquier letra (a-zA-Z) */
export function limpiarLetras(valor: string): string {
  return valor.replace(/[a-zA-Z]/g, '');
}

/** Deja únicamente dígitos numéricos */
export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Deja solo letras, tildes, diéresis, ñ y espacios para nombres */
export function limpiarParaNombre(valor: string): string {
  return valor.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]/g, '').replace(/[0-9]/g, '');
}

/** Deja solo letras, tildes, diéresis, ñ y espacios para apellidos (sin caracteres especiales) */
export function limpiarParaApellido(valor: string): string {
  return valor.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]/g, '').replace(/[0-9]/g, '');
}

/** Deja solo caracteres telefónicos válidos (+, -, espacios y números, sin letras) */
export function limpiarParaTelefono(valor: string): string {
  return valor.replace(/[a-zA-Z]/g, '').replace(/[^0-9+\-\s()]/g, '');
}
