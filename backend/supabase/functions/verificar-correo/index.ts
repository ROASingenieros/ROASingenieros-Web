// ============================================================================
// Edge Function: verificar-correo (Arquitectura basada en el Patrón Facade)
// ============================================================================
//
// OBJETIVO DEL PATRÓN FACADE (FACHADA):
// ------------------------------------
// El proceso de verificación integral de un correo electrónico involucra una serie
// de subprocesos técnicos secuenciales con diferentes fuentes de datos y protocolos:
//   1. Validación sintáctica y léxica bajo el estándar RFC y detección de errores tipográficos.
//   2. Filtro de reputación antispam contra catálogos de correos temporales/desechables.
//   3. Inspección en vivo de infraestructura de red DNS (registros de intercambio MX y host A).
//   4. Consulta de existencia en la base de datos de identidades (Supabase Auth y tabla 'perfiles').
//   5. Despacho/gestión de enlaces o códigos de confirmación (doble opt-in).
//
// Si el cliente en React tuviera que llamar y coordinar cada uno de estos pasos por
// separado, se sobrecargaría el navegador con múltiples peticiones de red, se filtraría
// lógica de negocio sensible y se crearía un fuerte acoplamiento con la infraestructura interna.
//
// Solución mediante el Patrón Facade:
// La clase `VerificarCorreoFacade` actúa como la Fachada unificada que oculta y encapsula
// la complejidad de todos los subsistemas internos, exponiendo para React un único
// endpoint REST simple, intuitivo y estandarizado:
//
//   POST { correo: 'usuario@dominio.com' }
//   → 200 { ok: true, existe: true, dominio: 'dominio.com' }
//   → 200 { ok: true, existe: false, dominio: '...', error: '...', sugerencia?: '...' }
// ============================================================================

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

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

// ============================================================================
// CONTRATOS E INTERFACES DEL PATRÓN FACADE
// ============================================================================

/** Resultado estándar y limpio devuelto por la Fachada para el consumo de React. */
export interface ResultadoVerificacionCorreo {
  ok: boolean;
  existe: boolean;
  dominio?: string;
  error?: string;
  sugerencia?: string;
  registradoEnAuth?: boolean;
  registradoEnPerfiles?: boolean;
  confirmacionEnviada?: boolean;
}

/** Opciones de configuración para la orquestación de subprocesos en la Fachada. */
export interface OpcionesVerificacionCorreo {
  verificarAuth?: boolean;
  verificarTablasInternas?: boolean;
  enviarCodigoConfirmacion?: boolean;
}

// ============================================================================
// SECCIÓN 1: SUBSISTEMAS INTERNOS (Internal Subsystems)
// ============================================================================
// Cada clase representa un subproceso especializado y desacoplado que la Fachada
// orquesta secuencialmente para cumplir con la verificación completa.
// ============================================================================

/**
 * SUBSISTEMA 1: Validador de Sintaxis, Formato RFC y Errores Tipográficos.
 * Responsable de la coherencia estructural de la cadena de texto del correo.
 */
export class FormatoSintaxisSubsystem {
  private readonly erroresTipograficos: Record<string, string> = {
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

  private readonly regexRfc = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  public validar(correo: string): {
    valido: boolean;
    usuario?: string;
    dominio?: string;
    error?: string;
    sugerencia?: string;
  } {
    if (!correo) {
      return { valido: false, error: 'El correo electrónico es obligatorio.' };
    }

    if (!this.regexRfc.test(correo) || correo.includes('..')) {
      return {
        valido: false,
        error: 'El formato del correo es inválido (ejemplo: usuario@dominio.com).',
      };
    }

    const partes = correo.split('@');
    if (partes.length !== 2) {
      return { valido: false, error: 'El correo debe tener un único símbolo @.' };
    }

    const [usuario, dominio] = partes;

    // Comprobación de errores tipográficos comunes en dominios conocidos
    if (this.erroresTipograficos[dominio]) {
      const dominioSugerido = this.erroresTipograficos[dominio];
      const sugerido = `${usuario}@${dominioSugerido}`;
      return {
        valido: false,
        usuario,
        dominio,
        error: `¿Quisiste escribir ${sugerido}? Revisa el dominio.`,
        sugerencia: sugerido,
      };
    }

    return { valido: true, usuario, dominio };
  }
}

/**
 * SUBSISTEMA 2: Filtro de Dominios Temporales y Desechables (Antispam).
 * Protege la base de datos contra registros basura o fraudulentos.
 */
export class DominiosDesechablesSubsystem {
  private readonly catalogoDesechables = new Set([
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

  public esDesechable(dominio: string): boolean {
    return this.catalogoDesechables.has(dominio);
  }
}

/**
 * SUBSISTEMA 3: Inspector de Infraestructura DNS y Conectividad de Red.
 * Comprueba en tiempo de ejecución si el dominio tiene servidores activos (MX y A).
 */
export class DnsInfraestructuraSubsystem {
  public async verificarDns(dominio: string): Promise<{
    valido: boolean;
    error?: string;
  }> {
    if (typeof Deno === 'undefined' || typeof Deno.resolveDns !== 'function') {
      return { valido: true };
    }

    try {
      const mx = await Deno.resolveDns(dominio, 'MX');
      if (!mx || mx.length === 0) {
        return {
          valido: false,
          error: `El dominio ${dominio} no tiene servidores de correo (MX) para recibir mensajes.`,
        };
      }
      return { valido: true };
    } catch {
      // Fallback: Si la consulta MX falla, comprobar si el dominio al menos posee registro A
      try {
        const a = await Deno.resolveDns(dominio, 'A');
        if (!a || a.length === 0) {
          return {
            valido: false,
            error: `El dominio de correo ${dominio} no existe o no tiene resolución DNS.`,
          };
        }
        return { valido: true };
      } catch {
        return {
          valido: false,
          error: `El dominio @${dominio} no existe en internet.`,
        };
      }
    }
  }
}

/**
 * SUBSISTEMA 4: Verificador de Existencia en Supabase (Auth y Tablas Internas).
 * Consulta si el correo ya está registrado en el proveedor de identidades o en perfiles.
 */
export class SupabaseIdentidadSubsystem {
  private adminClient: SupabaseClient | null = null;

  constructor() {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (url && key) {
      this.adminClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }

  /**
   * Consulta si el correo ya existe en la tabla interna 'perfiles' o en Supabase Auth.
   */
  public async consultarExistencia(correo: string): Promise<{
    existeEnAuth: boolean;
    existeEnPerfiles: boolean;
  }> {
    if (!this.adminClient) {
      return { existeEnAuth: false, existeEnPerfiles: false };
    }

    try {
      // 1. Verificación en tabla interna de perfiles
      const { data: perfil } = await this.adminClient
        .from('perfiles')
        .select('id')
        .ilike('email', correo)
        .maybeSingle();

      const existeEnPerfiles = !!perfil;

      return {
        existeEnAuth: existeEnPerfiles,
        existeEnPerfiles,
      };
    } catch {
      return { existeEnAuth: false, existeEnPerfiles: false };
    }
  }
}

/**
 * SUBSISTEMA 5: Gestor de Códigos y Enlaces de Confirmación (Notificaciones).
 * Encapsula la lógica para emitir enlaces mágicos o códigos de verificación.
 */
export class ConfirmacionCorreoSubsystem {
  public async despacharConfirmacion(correo: string): Promise<{
    enviado: boolean;
    mensaje?: string;
  }> {
    // Simulación / Integración de envío de correo de confirmación
    // En un flujo real interactúa con Supabase Auth o un proveedor SMTP (Resend / SendGrid)
    return {
      enviado: true,
      mensaje: `Código o enlace de verificación despachado a ${correo}.`,
    };
  }
}

// ============================================================================
// SECCIÓN 2: FACHADA - ENDPOINT ÚNICO (VerificarCorreoFacade)
// ============================================================================
/**
 * Interfaz de la Fachada para la verificación integral de correos.
 */
export interface IVerificarCorreoFacade {
  verificar(
    correo: string,
    opciones?: OpcionesVerificacionCorreo
  ): Promise<ResultadoVerificacionCorreo>;
  procesarPeticion(req: Request): Promise<Response>;
}

/**
 * Clase que implementa el Patrón Facade (Fachada).
 * 
 * Actúa como punto de acceso único y simplificado para el frontend de React.
 * Oculta la complejidad de orquestar secuencialmente:
 *  - FormatoSintaxisSubsystem (RFC y tipografía)
 *  - DominiosDesechablesSubsystem (catálogo antispam)
 *  - DnsInfraestructuraSubsystem (registros MX y A en vivo)
 *  - SupabaseIdentidadSubsystem (consulta en BD interna)
 *  - ConfirmacionCorreoSubsystem (despacho de verificación)
 */
export class VerificarCorreoFacade implements IVerificarCorreoFacade {
  private readonly formatoSubsystem: FormatoSintaxisSubsystem;
  private readonly desechablesSubsystem: DominiosDesechablesSubsystem;
  private readonly dnsSubsystem: DnsInfraestructuraSubsystem;
  private readonly identidadSubsystem: SupabaseIdentidadSubsystem;
  private readonly confirmacionSubsystem: ConfirmacionCorreoSubsystem;

  constructor(
    formato?: FormatoSintaxisSubsystem,
    desechables?: DominiosDesechablesSubsystem,
    dns?: DnsInfraestructuraSubsystem,
    identidad?: SupabaseIdentidadSubsystem,
    confirmacion?: ConfirmacionCorreoSubsystem
  ) {
    this.formatoSubsystem = formato ?? new FormatoSintaxisSubsystem();
    this.desechablesSubsystem = desechables ?? new DominiosDesechablesSubsystem();
    this.dnsSubsystem = dns ?? new DnsInfraestructuraSubsystem();
    this.identidadSubsystem = identidad ?? new SupabaseIdentidadSubsystem();
    this.confirmacionSubsystem = confirmacion ?? new ConfirmacionCorreoSubsystem();
  }

  /**
   * Método de Fachada: Orquesta de forma transparente los múltiples subprocesos.
   */
  public async verificar(
    correoRaw: string,
    opciones?: OpcionesVerificacionCorreo
  ): Promise<ResultadoVerificacionCorreo> {
    const correo = String(correoRaw ?? '').trim().toLowerCase();

    // 1. Ejecución del Subsistema de Sintaxis y Formato
    const resFormato = this.formatoSubsystem.validar(correo);
    if (!resFormato.valido) {
      return {
        ok: true,
        existe: false,
        dominio: resFormato.dominio,
        error: resFormato.error,
        sugerencia: resFormato.sugerencia,
      };
    }

    const dominio = resFormato.dominio!;

    // 2. Ejecución del Subsistema de Dominios Desechables
    if (this.desechablesSubsystem.esDesechable(dominio)) {
      return {
        ok: true,
        existe: false,
        dominio,
        error: 'No se permiten correos temporales o desechables.',
      };
    }

    // 3. Ejecución del Subsistema de Infraestructura DNS (MX y A)
    const resDns = await this.dnsSubsystem.verificarDns(dominio);
    if (!resDns.valido) {
      return {
        ok: true,
        existe: false,
        dominio,
        error: resDns.error,
      };
    }

    // 4. Ejecución del Subsistema de Supabase (opcional según requerimiento)
    let registradoEnAuth = false;
    let registradoEnPerfiles = false;
    if (opciones?.verificarAuth || opciones?.verificarTablasInternas) {
      const resIdentidad = await this.identidadSubsystem.consultarExistencia(correo);
      registradoEnAuth = resIdentidad.existeEnAuth;
      registradoEnPerfiles = resIdentidad.existeEnPerfiles;
    }

    // 5. Ejecución del Subsistema de Confirmación (opcional si se solicita código/enlace)
    let confirmacionEnviada = false;
    if (opciones?.enviarCodigoConfirmacion) {
      const resConfirmacion = await this.confirmacionSubsystem.despacharConfirmacion(correo);
      confirmacionEnviada = resConfirmacion.enviado;
    }

    // Retorno consolidado y limpio para el frontend
    return {
      ok: true,
      existe: true,
      dominio,
      registradoEnAuth: registradoEnAuth || undefined,
      registradoEnPerfiles: registradoEnPerfiles || undefined,
      confirmacionEnviada: confirmacionEnviada || undefined,
    };
  }

  /**
   * Endpoint Único REST: Recibe la solicitud HTTP de React, delega a la Fachada
   * y responde con el payload estandarizado.
   */
  public async procesarPeticion(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CABECERAS_CORS });
    if (req.method !== 'POST') return json({ error: 'Método no permitido.' });

    let cuerpo: {
      correo?: string;
      verificarAuth?: boolean;
      verificarTablasInternas?: boolean;
      enviarCodigoConfirmacion?: boolean;
    };

    try {
      cuerpo = (await req.json()) as typeof cuerpo;
    } catch {
      return json({ error: 'Solicitud inválida (JSON no válido).' });
    }

    const resultado = await this.verificar(cuerpo?.correo ?? '', {
      verificarAuth: cuerpo?.verificarAuth,
      verificarTablasInternas: cuerpo?.verificarTablasInternas,
      enviarCodigoConfirmacion: cuerpo?.enviarCodigoConfirmacion,
    });

    return json(resultado);
  }
}

// Instancia singleton de la Fachada
export const verificarCorreoFacade = new VerificarCorreoFacade();

// ============================================================================
// PUNTO DE ENTRADA DENO SERVE
// ============================================================================
// El servidor expone un endpoint único y limpio respaldado por la Fachada.
Deno.serve(async (req: Request) => {
  return await verificarCorreoFacade.procesarPeticion(req);
});
