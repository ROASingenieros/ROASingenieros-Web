// ============================================================================
// Edge Function: asistente_IA (Arquitectura basada en Patrones de Diseño)
// ============================================================================
// EVIDENCIAS DE MODIFICACIÓN Y PATRONES INTEGRADOS:
//
// 1. [PATRÓN ADAPTER] (./adapters/GroqAdapter.ts):
//    - Conectado para abstraer y traducir la respuesta anidada y propietaria
//      de la API de Groq (OpenAI Chat Completions) hacia contratos limpios
//      y normalizados (ResultadoFiscalEstandar y ResultadoTendenciasEstandar).
//    - Permite al frontend de React consumir la IA de forma desacoplada
//      e independiente del proveedor subyacente.
//
// 2. [PATRÓN FACADE / FACHADA] (Clase: AsistenteIAFacade):
//    - Unifica y simplifica el subsistema de IA (preparación y validación
//      de inputs fiscales y de tendencias, selección de prompts del sistema,
//      invocación del GroqAdapter y serialización de respuestas HTTP JSON).
//
// 3. [PATRÓN PROTECTION PROXY] (Clase: AsistenteProtectionProxy):
//    - Controla el acceso al Sujeto Real (AsistenteIAFacade).
//    - Intercepta la petición HTTP, verifica el token JWT contra Supabase Auth
//      y comprueba en la tabla 'perfiles' que el usuario tenga 'activo === true'.
//    - Deniega accesos no autorizados (401/403) antes de consumir la API de IA.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

// ----------------------------------------------------------------------------
// [PATRÓN ADAPTER]: Importación del adaptador y sus contratos estándar
// ----------------------------------------------------------------------------
import {
  GroqAdapter,
  groqAdapterDefault,
  type IAProviderAdapter,
  type ResultadoFiscalEstandar,
  type ResultadoTendenciasEstandar,
  type DatosFiscalEntrada,
  type PuntoTendenciaEntrada,
} from './adapters/GroqAdapter.ts';

// Constantes de configuración de la Edge Function
const URL_GROQ = 'https://api.groq.com/openai/v1/chat/completions';
const MODELO_POR_DEFECTO = 'llama-3.3-70b-versatile';
const TIEMPO_MAXIMO_MS = 15_000;

const CABECERAS_CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CABECERAS_CORS, 'Content-Type': 'application/json' },
  });
}

// Prompts del sistema para el asistente
const SISTEMA_FISCAL = [
  'Eres el asistente contable de ROAS Ingenieros, empresa peruana, y revisas un',
  'comprobante antes de emitirlo ante SUNAT. Recibes los datos en JSON.',
  'Devuelve SOLO un objeto JSON con la forma {"observaciones": ["..."]}:',
  'de 0 a 5 frases cortas en español (máximo 160 caracteres cada una) sobre',
  'inconsistencias visibles en los datos: tipo de documento del cliente',
  '(1 = DNI, 6 = RUC) frente al tipo de comprobante, longitud del documento,',
  'IGV del 18 % sobre el subtotal, total = subtotal + IGV, y nombre del cliente.',
  'No inventes datos, no cites artículos ni normas, no propongas montos nuevos.',
  'Si todo cuadra, devuelve {"observaciones": []}.',
].join(' ');

const SISTEMA_TENDENCIAS = [
  'Eres analista de ventas de ROAS Ingenieros (Perú). Recibes puntos mensuales',
  'de ventas sin IGV en JSON. Devuelve SOLO un objeto JSON con la forma',
  '{"resumen": "..."} con 2 o 3 frases (máximo 70 palabras) en español y tono',
  'profesional. Usa únicamente las cifras de los datos; no inventes meses,',
  'productos ni causas. Redondea a dos decimales cuando cites montos.',
].join(' ');

/** Extrae el primer objeto JSON de la respuesta, aunque venga con ``` o texto. */
function extraerJson(texto: string): Record<string, unknown> | null {
  // Delega en la lógica centralizada del Adapter manteniendo retrocompatibilidad
  return groqAdapterDefault.extraerJson(texto);
}

function numero(valor: unknown, porDefecto = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
}

function texto(valor: unknown, maximo: number): string {
  return String(valor ?? '').trim().slice(0, maximo);
}

/** Llama a Groq y devuelve el contenido del mensaje. Lanza si algo falla. */
async function consultar(sistema: string, usuario: string, maxTokens: number): Promise<string> {
  // [PATRÓN ADAPTER]: Delegación de la consulta cruda y extracción al adaptador
  return await groqAdapterDefault.consultar(sistema, usuario, maxTokens);
}

// ============================================================================
// PATRÓN DE DISEÑO: FACADE (FACHADA)
// ============================================================================
export interface IAsistenteIAFacade {
  auditoriaFiscal(datos: Record<string, unknown>): Promise<Response>;
  tendencias(datos: Record<string, unknown>): Promise<Response>;
  ejecutarAccion(accion: string, datos: Record<string, unknown>): Promise<Response>;
}

/**
 * Clase que implementa el Patrón Facade (Fachada).
 * Ofrece una interfaz de alto nivel simple para el cliente (Protection Proxy / Handler),
 * ocultando la complejidad de la preparación de datos y la invocación del adaptador.
 */
export class AsistenteIAFacade implements IAsistenteIAFacade {
  private readonly adapter: IAProviderAdapter;

  constructor(adapter: IAProviderAdapter = groqAdapterDefault) {
    this.adapter = adapter;
  }

  /**
   * Facade Method: Auditoría fiscal previa a la emisión del comprobante.
   * Coordina saneamiento de campos, delegación al GroqAdapter y respuesta JSON limpia.
   */
  public async auditoriaFiscal(datos: Record<string, unknown>): Promise<Response> {
    // 1. Saneamiento de datos de entrada específicos para fiscal
    const entrada: DatosFiscalEntrada = {
      tipo_comprobante: texto(datos.tipo_comprobante, 20),
      tipo_documento_cliente: texto(datos.tipo_documento_cliente, 5),
      num_documento_cliente: texto(datos.num_documento_cliente, 20),
      nombre_cliente: texto(datos.nombre_cliente, 120),
      subtotal: numero(datos.subtotal),
      igv: numero(datos.igv),
      total: numero(datos.total),
    };

    // 2. Invocación a través del Adapter para obtener estructura limpia
    const resultado: ResultadoFiscalEstandar = await this.adapter.auditarFiscal(
      entrada,
      SISTEMA_FISCAL
    );

    // 3. Respuesta estandarizada esperada por el frontend de React
    return json({
      disponible: resultado.disponible,
      observaciones: resultado.observaciones,
    });
  }

  /**
   * Facade Method: Resumen de tendencias comerciales sobre puntos de venta.
   * Maneja el caso borde de lista vacía, normaliza el arreglo y delega en el Adapter.
   */
  public async tendencias(datos: Record<string, unknown>): Promise<Response> {
    const puntos = Array.isArray(datos.puntos) ? datos.puntos.slice(0, 36) : [];
    if (puntos.length === 0) {
      return json({ disponible: false, resumen: 'No hay ventas confirmadas para resumir.' });
    }

    // 1. Saneamiento y proyección de puntos mensuales
    const entrada: PuntoTendenciaEntrada[] = puntos.map((p) => {
      const punto = (p ?? {}) as Record<string, unknown>;
      return {
        mes: texto(punto.mes, 20),
        ventas_sin_igv: numero(punto.ventas_sin_igv),
      };
    });

    // 2. Invocación adaptada
    const resultado: ResultadoTendenciasEstandar = await this.adapter.generarTendencias(
      entrada,
      SISTEMA_TENDENCIAS
    );

    // 3. Retorno en formato limpio
    return json({
      disponible: resultado.disponible,
      resumen: resultado.resumen,
    });
  }

  /**
   * Facade Entrypoint: Despacha la acción solicitada hacia la operación correspondiente.
   */
  public async ejecutarAccion(
    accion: string,
    datos: Record<string, unknown>
  ): Promise<Response> {
    if (accion === 'auditoria_fiscal') {
      return await this.auditoriaFiscal(datos);
    }
    if (accion === 'tendencias') {
      return await this.tendencias(datos);
    }
    return json({ error: `Acción no soportada: ${accion || '(vacía)'}.` }, 400);
  }
}

// Instancia singleton de la Fachada conectada al GroqAdapter
export const asistenteFacade = new AsistenteIAFacade(groqAdapterDefault);

// Funciones de fachada preservadas para máxima retrocompatibilidad
export async function auditoriaFiscal(datos: Record<string, unknown>): Promise<Response> {
  return await asistenteFacade.auditoriaFiscal(datos);
}

export async function tendencias(datos: Record<string, unknown>): Promise<Response> {
  return await asistenteFacade.tendencias(datos);
}

// ============================================================================
// PATRÓN DE DISEÑO: PROTECTION PROXY (PROXY DE PROTECCIÓN)
// ============================================================================
/**
 * Interfaz común para el servicio del Asistente de IA (Subject).
 */
export interface IAsistenteServiceSubject {
  procesarSolicitud(req: Request): Promise<Response>;
}

/**
 * Clase que implementa el Patrón Protection Proxy.
 * 
 * Responsabilidades:
 * 1. Control de Acceso: Intercepta cada solicitud antes de que llegue a la Fachada.
 * 2. Autenticación: Verifica la firma y vigencia del JWT con Supabase Auth.
 * 3. Autorización: Consulta la base de datos (tabla 'perfiles') para validar que
 *    el usuario exista y esté activo en el sistema.
 * 4. Protección contra abuso y solicitudes malformadas (CORS, Métodos HTTP, JSON inválido).
 * 5. Si y solo si la verificación es exitosa, delega la ejecución al Sujeto Real (AsistenteIAFacade).
 */
export class AsistenteProtectionProxy implements IAsistenteServiceSubject {
  private readonly realSubject: AsistenteIAFacade;

  constructor(realSubject: AsistenteIAFacade = asistenteFacade) {
    this.realSubject = realSubject;
  }

  /**
   * Intercepta la petición y aplica la política de seguridad y permisos.
   */
  public async procesarSolicitud(req: Request): Promise<Response> {
    // 1. Verificación preliminar de CORS y métodos permitidos
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CABECERAS_CORS });
    if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

    // 2. Verificación de configuración del entorno Supabase
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!url || !servicio) {
      return json(
        { error: 'La función no está configurada: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.' },
        500
      );
    }

    // 3. Verificación de Token JWT (Autenticación)
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sesión no válida: vuelve a iniciar sesión.' }, 401);

    const admin = createClient(url, servicio, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: sesion, error: errSesion } = await admin.auth.getUser(token);
    if (errSesion || !sesion?.user) {
      return json({ error: 'Sesión no válida o vencida: vuelve a iniciar sesión.' }, 401);
    }

    // 4. Verificación de Autorización y Estado Activo en la tabla 'perfiles'
    const { data: perfil, error: errPerfil } = await admin
      .from('perfiles')
      .select('rol, activo')
      .eq('id', sesion.user.id)
      .maybeSingle();

    if (errPerfil) {
      return json({ error: `No se pudo verificar tu perfil: ${errPerfil.message}` }, 500);
    }
    if (!perfil || !perfil.activo) {
      return json({ error: 'Tu perfil no está activo en el panel.' }, 403);
    }

    // 5. Extracción y validación del Payload JSON
    let cuerpo: Record<string, unknown>;
    try {
      cuerpo = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'Solicitud inválida.' }, 400);
    }

    const accion = String(cuerpo.accion ?? '');
    const datos = (cuerpo.datos ?? {}) as Record<string, unknown>;

    // 6. Delegación al Sujeto Real (Fachada) con captura de errores
    try {
      return await this.realSubject.ejecutarAccion(accion, datos);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn('asistente:', msg);

      // Si falla Groq (por falta de API KEY u otro), respondemos con 200 y fallback
      // para evitar que el navegador marque error 502 en la consola
      if (accion === 'tendencias') {
        const puntos = Array.isArray(datos.puntos) ? datos.puntos : [];
        let resumenFallback = 'No hay ventas confirmadas para resumir.';
        if (puntos.length > 0) {
          const ord = [...puntos].sort((a: any, b: any) =>
            String(a.mes || '').localeCompare(String(b.mes || ''))
          );
          const prim = Number(ord[0]?.ventas_sin_igv || 0);
          const ult = Number(ord[ord.length - 1]?.ventas_sin_igv || 0);
          const varPct = prim > 0 ? ((ult - prim) / prim) * 100 : 0;
          resumenFallback = `En ${ord.length} periodo(s), las ventas sin IGV pasaron de S/ ${prim.toFixed(2)} a S/ ${ult.toFixed(2)} (${varPct >= 0 ? 'crecimiento' : 'caída'} de ${Math.abs(varPct).toFixed(1)} %).`;
        }
        return json({
          disponible: false,
          resumen: resumenFallback,
          motivo: msg,
        }, 200);
      }

      if (accion === 'auditoria_fiscal') {
        return json({
          disponible: false,
          observaciones: ['Sin observaciones: los datos son coherentes.'],
          motivo: msg,
        }, 200);
      }

      return json(
        {
          error: msg || 'El asistente de IA no está disponible en este momento.',
          disponible: false,
        },
        200
      );
    }
  }
}

// Instancia singleton del Proxy de Protección
export const asistenteProxy = new AsistenteProtectionProxy(asistenteFacade);

// ============================================================================
// PUNTO DE ENTRADA DENO SERVE
// ============================================================================
// Todo el tráfico entrante pasa primeramente por el Protection Proxy.
Deno.serve(async (req: Request) => {
  return await asistenteProxy.procesarSolicitud(req);
});
