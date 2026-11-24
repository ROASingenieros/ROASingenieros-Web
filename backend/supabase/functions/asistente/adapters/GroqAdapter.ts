/**
 * ============================================================================
 * PATRÓN DE DISEÑO: ADAPTER (ADAPTADOR)
 * ============================================================================
 *  Propósito:
 * --------------------
 * Si el cliente o el frontend consumieran directamente la respuesta de Groq,
 * quedarían fuertemente acoplados a la estructura propietaria de este proveedor.
 * 
 * El Patrón Adapter actúa como traductor e intermediario entre la API de Groq
 * (Adaptee) y las necesidades de la aplicación / frontend de React (Target),
 * garantizando que el frontend reciba estructuras de datos limpias, normalizadas
 * y agnósticas al proveedor de Inteligencia Artificial:
 * 
 *   - Auditoría fiscal: { disponible: boolean, observaciones: string[] }
 *   - Tendencias:       { disponible: boolean, resumen: string }
 * 
 * Participantes del Patrón:
 * -------------------------
 * 1. Target (Interfaz Objetivo):
 *    - `IAProviderAdapter`: Contrato estándar que define las operaciones que
 *      cualquier proveedor de IA debe implementar para el sistema.
 *    - `ResultadoFiscalEstandar`, `ResultadoTendenciasEstandar`: Formatos de
 *      salida estandarizados consumidos directamente por el frontend de React.
 * 
 * 2. Adaptee (Servicio Adaptado):
 *    - API de Groq Chat Completions (`https://api.groq.com/openai/v1/chat/completions`)
 *    - Representado por `GroqApiResponse`, `GroqChoice`, `GroqUsage`, etc.
 * 
 * 3. Adapter (Adaptador):
 *    - `GroqAdapter`: Implementa `IAProviderAdapter`. Traduce las solicitudes del
 *      dominio al formato de Groq, ejecuta la llamada HTTP, procesa y sanea la
 *      respuesta anidada de Groq, y la mapea a la estructura estándar limpia.
 * ============================================================================
// ----------------------------------------------------------------------------
// 1. ESTRUCTURAS OBJETIVO / ESTANDARIZADAS PARA EL FRONTEND (TARGET)
// ----------------------------------------------------------------------------

/** Estructura normalizada de respuesta para la auditoría fiscal que consume React. */
export interface ResultadoFiscalEstandar {
  disponible: boolean;
  observaciones: string[];
}

/** Estructura normalizada de respuesta para el análisis de tendencias que consume React. */
export interface ResultadoTendenciasEstandar {
  disponible: boolean;
  resumen: string;
}

/** Datos de entrada para la revisión fiscal. */
export interface DatosFiscalEntrada {
  tipo_comprobante?: string;
  tipo_documento_cliente?: string;
  num_documento_cliente?: string;
  nombre_cliente?: string;
  subtotal?: number;
  igv?: number;
  total?: number;
}

/** Punto mensual de ventas de entrada para el cálculo de tendencias. */
export interface PuntoTendenciaEntrada {
  mes?: string;
  ventas_sin_igv?: number;
}

/** Interfaz Target que desacopla el sistema de cualquier proveedor específico de IA. */
export interface IAProviderAdapter {
  consultarCrudo(sistema: string, usuario: string, maxTokens: number): Promise<GroqApiResponse>;
  consultar(sistema: string, usuario: string, maxTokens: number): Promise<string>;
  traducirRespuestaFiscal(respuestaGroq: GroqApiResponse | string): ResultadoFiscalEstandar;
  traducirRespuestaTendencias(respuestaGroq: GroqApiResponse | string): ResultadoTendenciasEstandar;
  auditarFiscal(datos: DatosFiscalEntrada, promptSistema: string): Promise<ResultadoFiscalEstandar>;
  generarTendencias(puntos: PuntoTendenciaEntrada[], promptSistema: string): Promise<ResultadoTendenciasEstandar>;
}

// ----------------------------------------------------------------------------
// 2. ESTRUCTURAS DE LA API EXTERNA DE GROQ (ADAPTEE)
// ----------------------------------------------------------------------------

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqChoice {
  index: number;
  message: GroqMessage;
  finish_reason: string;
}

export interface GroqUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/** Estructura de respuesta anidada y compleja que entrega la API de Groq / OpenAI. */
export interface GroqApiResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: GroqChoice[];
  usage?: GroqUsage;
  error?: {
    message: string;
    type?: string;
    code?: string | number;
  };
}

export interface GroqAdapterConfig {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  timeoutMs?: number;
}

// ----------------------------------------------------------------------------
// 3. CLASE ADAPTADOR: GroqAdapter (ADAPTER)
// ----------------------------------------------------------------------------

export class GroqAdapter implements IAProviderAdapter {
  private readonly apiUrl: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;
  private readonly apiKey?: string;

  constructor(config?: GroqAdapterConfig) {
    this.apiUrl = config?.apiUrl ?? 'https://api.groq.com/openai/v1/chat/completions';
    this.defaultModel = config?.model ?? (Deno.env.get('GROQ_MODEL') || 'llama-3.3-70b-versatile');
    this.timeoutMs = config?.timeoutMs ?? 15_000;
    this.apiKey = config?.apiKey ?? Deno.env.get('GROQ_API_KEY');
  }

  /**
   * Obtiene la clave de API activa de Groq o lanza un error si no está configurada.
   */
  private obtenerClaveApi(): string {
    const clave = this.apiKey ?? Deno.env.get('GROQ_API_KEY') ?? '';
    if (!clave) {
      throw new Error('Falta el secreto GROQ_API_KEY en Supabase.');
    }
    return clave;
  }

  /**
   * Extrae de forma segura el texto crudo del mensaje dentro de la estructura anidada de Groq.
   * Navega la jerarquía choices[0].message.content.
   */
  public extraerContenidoMensaje(respuestaGroq: GroqApiResponse): string {
    const contenido = respuestaGroq?.choices?.[0]?.message?.content;
    if (typeof contenido !== 'string' || !contenido.trim()) {
      throw new Error('Groq devolvió una respuesta vacía o sin el formato de choices esperado.');
    }
    return contenido;
  }

  /**
   * Limpia y extrae el primer objeto JSON incrustado en el texto de respuesta del LLM,
   * eliminando posibles delimitadores Markdown (```json ... ```) o texto conversacional.
   */
  public extraerJson(texto: string): Record<string, unknown> | null {
    const limpio = texto.replace(/```(?:json)?/gi, '').trim();
    const inicio = limpio.indexOf('{');
    const fin = limpio.lastIndexOf('}');
    if (inicio === -1 || fin <= inicio) return null;
    try {
      const valor = JSON.parse(limpio.slice(inicio, fin + 1));
      return valor && typeof valor === 'object' && !Array.isArray(valor)
        ? (valor as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  /**
   * Realiza la llamada HTTP a bajo nivel contra la API de Groq (Adaptee)
   * y devuelve el objeto JSON crudo y anidado.
   */
  public async consultarCrudo(
    sistema: string,
    usuario: string,
    maxTokens: number
  ): Promise<GroqApiResponse> {
    const clave = this.obtenerClaveApi();
    const modelo = Deno.env.get('GROQ_MODEL') || this.defaultModel;

    const respuesta = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: 'system', content: sistema },
          { role: 'user', content: usuario },
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!respuesta.ok) {
      const detalle = (await respuesta.text().catch(() => '')).slice(0, 160);
      throw new Error(`Groq respondió ${respuesta.status}. ${detalle}`);
    }

    const datos = (await respuesta.json()) as GroqApiResponse;
    if (datos.error) {
      throw new Error(`Error retornado por la API de Groq: ${datos.error.message}`);
    }

    return datos;
  }

  /**
   * Consulta a Groq y extrae directamente el string del mensaje.
   * Proporciona retrocompatibilidad y una vía rápida de obtención de texto.
   */
  public async consultar(
    sistema: string,
    usuario: string,
    maxTokens: number
  ): Promise<string> {
    const respuestaCruda = await this.consultarCrudo(sistema, usuario, maxTokens);
    return this.extraerContenidoMensaje(respuestaCruda);
  }

  // ==========================================================================
  // MÉTODOS DE ADAPTACIÓN Y TRADUCCIÓN (CORE DEL PATRÓN ADAPTER)
  // ==========================================================================

  /**
   * Adapta la respuesta compleja de Groq (ya sea el payload crudo GroqApiResponse
   * o el texto JSON devuelto) hacia la estructura estandarizada `ResultadoFiscalEstandar`.
   */
  public traducirRespuestaFiscal(
    respuestaGroq: GroqApiResponse | string
  ): ResultadoFiscalEstandar {
    const contenidoTexto = typeof respuestaGroq === 'string'
      ? respuestaGroq
      : this.extraerContenidoMensaje(respuestaGroq);

    const parsedJson = this.extraerJson(contenidoTexto);
    if (!parsedJson || !Array.isArray(parsedJson.observaciones)) {
      throw new Error('La respuesta del modelo Groq no cumple con el esquema esperado de auditoría fiscal.');
    }

    // Normaliza y sanea las observaciones para el frontend de React
    const observaciones = (parsedJson.observaciones as unknown[])
      .filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
      .map((o) => o.trim().slice(0, 200))
      .slice(0, 5);

    return {
      disponible: true,
      observaciones,
    };
  }

  /**
   * Adapta la respuesta compleja de Groq hacia la estructura estandarizada
   * `ResultadoTendenciasEstandar` que el frontend de React espera.
   */
  public traducirRespuestaTendencias(
    respuestaGroq: GroqApiResponse | string
  ): ResultadoTendenciasEstandar {
    const contenidoTexto = typeof respuestaGroq === 'string'
      ? respuestaGroq
      : this.extraerContenidoMensaje(respuestaGroq);

    const parsedJson = this.extraerJson(contenidoTexto);
    const resumen = typeof parsedJson?.resumen === 'string' ? parsedJson.resumen.trim() : '';

    if (!resumen) {
      throw new Error('La respuesta del modelo Groq no contiene un resumen válido de tendencias.');
    }

    return {
      disponible: true,
      resumen: resumen.slice(0, 600),
    };
  }

  // ==========================================================================
  // OPERACIONES COMPLETAS ADAPTADAS
  // ==========================================================================

  /**
   * Realiza todo el flujo adaptado para auditoría fiscal:
   * 1. Serializa los datos limpios.
   * 2. Llama a Groq.
   * 3. Adapta y traduce la respuesta anidada a la estructura de React.
   */
  public async auditarFiscal(
    datos: DatosFiscalEntrada,
    promptSistema: string
  ): Promise<ResultadoFiscalEstandar> {
    const contenido = await this.consultar(promptSistema, JSON.stringify(datos), 400);
    return this.traducirRespuestaFiscal(contenido);
  }

  /**
   * Realiza todo el flujo adaptado para el análisis de tendencias:
   * 1. Serializa los puntos de venta.
   * 2. Llama a Groq.
   * 3. Adapta y traduce la respuesta anidada a la estructura de React.
   */
  public async generarTendencias(
    puntos: PuntoTendenciaEntrada[],
    promptSistema: string
  ): Promise<ResultadoTendenciasEstandar> {
    const contenido = await this.consultar(promptSistema, JSON.stringify(puntos), 300);
    return this.traducirRespuestaTendencias(contenido);
  }
}

// Instancia singleton por defecto para facilitar uso inmediato
export const groqAdapterDefault = new GroqAdapter();
