// ============================================================================
// Edge Function: usuarios (Arquitectura de Seguridad: Patrón Protection Proxy)
// ============================================================================
//
// Contexto y Justificación de Seguridad:
// ------------------------------------
// La creación de usuarios en Supabase Auth y la asignación directa de roles
// requieren la clave maestra `SUPABASE_SERVICE_ROLE_KEY`. Esta credencial posee
// privilegios totales de superusuario y omite automáticamente las políticas de
// Row Level Security (RLS) en la base de datos PostgreSQL.
//
// Regla de Oro de Seguridad:
// Jamás se debe exponer `SUPABASE_SERVICE_ROLE_KEY` en el cliente / navegador (React).
// Si un usuario malintencionado obtuviera esta clave pública desde el navegador,
// podría vulnerar, modificar o eliminar cualquier registro del sistema.
//
// Estructura de las 3 Capas del Patrón Protection Proxy:
// -----------------------------------------------------
// 1. [CLIENTE PRIVILEGIADO (Privileged Client)]:
//    - Representa el cliente que invoca la función (ej. el panel de administración
//      en React `Usuarios.tsx` operado por un usuario con sesión iniciada).
//    - Envía su token JWT personal firmado en la cabecera `Authorization: Bearer <token>`.
//    - No posee ni conoce la `SUPABASE_SERVICE_ROLE_KEY`.
//
// 2. [PROXY DE SEGURIDAD (Protection Proxy - UsuariosProtectionProxy)]:
//    - Actúa como intermediario y guardián estricto de seguridad.
//    - Intercepta la petición HTTP y valida:
//        a) Autenticación: Valida criptográficamente el JWT contra Supabase Auth (GoTrue).
//        b) Autorización (RBAC): Verifica en la base de datos que el perfil esté activo
//           (`activo === true`) y que tenga el rol adecuado (`admin` estricto para crear
//           usuarios, o `admin`/`supervisor` para gestionar solicitudes).
//    - Si la verificación falla, rechaza inmediatamente la petición (401 / 403 / error),
//      impidiendo cualquier acceso al Sujeto Real o uso no autorizado de service_role.
//
// 3. [SUJETO REAL (Real Subject - UsuariosRealService)]:
//    - Es el servicio privilegiado que vive en el entorno seguro del servidor.
//    - Custodia el cliente con `SUPABASE_SERVICE_ROLE_KEY`.
//    - Ejecuta las operaciones privilegiadas: creación de usuarios en Auth,
//      asignación de perfiles, rollback atómico en caso de fallo, validaciones
//      DNS en tiempo de ejecución y eliminación de solicitudes web.
// ============================================================================

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const ROLES = ['admin', 'supervisor', 'secretaria'] as const;
type RolValido = (typeof ROLES)[number];

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
// CONTRATOS E INTERFACES DEL PATRÓN PROTECTION PROXY
// ============================================================================

/** Datos de contexto de seguridad del usuario autenticado y verificado por el Proxy. */
export interface ContextoSeguridad {
  usuarioId: string;
  correo: string;
  rol: string;
  activo: boolean;
}

/**
 * Interfaz común del Sujeto (Subject Interface).
 * Define las operaciones privilegiadas que deben ser protegidas por el Proxy.
 */
export interface IUsuariosServiceSubject {
  crearUsuario(cuerpo: Record<string, unknown>): Promise<Response>;
  eliminarSolicitudWeb(cuerpo: Record<string, unknown>): Promise<Response>;
  listarUsuarios(): Promise<Response>;
  ejecutarAccion(accion: string, cuerpo: Record<string, unknown>): Promise<Response>;
}

// ============================================================================
// CAPA 3: SUJETO REAL (Real Subject)
// ============================================================================
/**
 * Clase que representa el Sujeto Real en el patrón Protection Proxy.
 * 
 * Contiene la implementación concreta de las operaciones privilegiadas en el servidor,
 * utilizando el cliente de Supabase instanciado con `SUPABASE_SERVICE_ROLE_KEY`.
 * Esta clase asume que quien la invoca ya ha superado con éxito las pruebas de
 * autenticación y autorización realizadas por el Proxy de Seguridad.
 */
export class UsuariosRealService implements IUsuariosServiceSubject {
  private readonly admin: SupabaseClient;

  constructor(adminClient: SupabaseClient) {
    this.admin = adminClient;
  }

  /**
   * Operación Privilegiada: Crear usuario en Supabase Auth y su registro en 'perfiles'.
   * Aplica validaciones estrictas de negocio, comprobación DNS y rollback compensatorio.
   */
  public async crearUsuario(cuerpo: Record<string, unknown>): Promise<Response> {
    const correo = String(cuerpo.correo ?? '').trim().toLowerCase();
    const nombre = String(cuerpo.nombre ?? '').trim();
    const rol = String(cuerpo.rol ?? '');
    const clave = String(cuerpo.clave ?? '');

    // 1. Validaciones de negocio en el backend
    if (!nombre) return json({ error: 'El nombre es obligatorio.' });
    if (/\d/.test(nombre)) return json({ error: 'El nombre no puede contener números.' });
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]+$/.test(nombre)) {
      return json({ error: 'El nombre solo puede contener letras y espacios.' });
    }
    if (nombre.length < 2) return json({ error: 'El nombre debe tener al menos 2 caracteres.' });

    // 2. Comprobar formato estricto de correo
    const regCorreo = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!regCorreo.test(correo) || correo.includes('..')) {
      return json({ error: 'Correo invalido (ejemplo: usuario@dominio.com).' });
    }

    const partesCorreo = correo.split('@');
    if (partesCorreo.length !== 2) return json({ error: 'Correo invalido.' });
    const dominio = partesCorreo[1];

    // 3. Rechazar dominios temporales / desechables
    const desechables = ['mailinator.com', '10minutemail.com', 'tempmail.com', 'yopmail.com', 'trashmail.com'];
    if (desechables.includes(dominio)) {
      return json({ error: 'No se permiten correos electronicos temporales o desechables.' });
    }

    // 4. Comprobación DNS en el entorno del servidor (verificar que el dominio pueda recibir correo)
    if (typeof Deno !== 'undefined' && typeof Deno.resolveDns === 'function') {
      try {
        const mx = await Deno.resolveDns(dominio, 'MX');
        if (!mx || mx.length === 0) {
          return json({ error: `El dominio ${dominio} no tiene servidores de correo configurados para recibir mensajes.` });
        }
      } catch {
        try {
          const a = await Deno.resolveDns(dominio, 'A');
          if (!a || a.length === 0) {
            return json({ error: `El dominio de correo ${dominio} no existe o no tiene resolucion DNS.` });
          }
        } catch {
          return json({ error: `El correo no existe: el dominio @${dominio} no se encuentra registrado.` });
        }
      }
    }

    // 5. Validación de contraseña temporal y rol
    if (clave.length < 6) return json({ error: 'La contraseña temporal debe tener al menos 6 caracteres.' });
    if (!/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) {
      return json({ error: 'La contrasena temporal debe incluir al menos una letra y un número por seguridad.' });
    }
    if (!ROLES.includes(rol as RolValido)) return json({ error: `Rol no valido: ${rol}.` });

    // 6. Invocación privilegiada con service_role en GoTrue Auth
    const { data: creado, error: errCrear } = await this.admin.auth.admin.createUser({
      email: correo,
      password: clave,
      email_confirm: true,
      user_metadata: { nombre },
    });

    if (errCrear || !creado?.user) {
      const mensaje = errCrear?.message ?? 'error desconocido';
      const yaExiste = /already|exist|registered/i.test(mensaje);
      return json({
        error: yaExiste ? `Ya existe una cuenta con el correo ${correo}.` : `No se pudo crear la cuenta: ${mensaje}`,
      });
    }

    // 7. Sincronización en la tabla 'perfiles'
    const { error: errFila } = await this.admin
      .from('perfiles')
      .upsert({ id: creado.user.id, nombre, rol, activo: true }, { onConflict: 'id' });

    if (errFila) {
      // Mecanismo de Rollback: eliminar cuenta huérfana en Auth si falla la inserción en la base de datos
      await this.admin.auth.admin.deleteUser(creado.user.id);
      return json({ error: `La cuenta no se pudo habilitar en el panel: ${errFila.message}` });
    }

    return json({ ok: true, id: creado.user.id, correo, nombre, rol });
  }

  /**
   * Operación Privilegiada: Eliminar solicitudes web puenteando Row Level Security (RLS).
   */
  public async eliminarSolicitudWeb(cuerpo: Record<string, unknown>): Promise<Response> {
    const id = Number(cuerpo?.id);
    if (!id) return json({ error: 'ID de solicitud invalido.' }, 400);

    // Intentar borrar de auditoria
    const { error: errDelAud } = await this.admin.from('auditoria').delete().eq('id', id);
    if (errDelAud) {
      // Si el delete directo fallara por FK, marcar para ocultar
      await this.admin.from('auditoria').update({ tabla: 'solicitud_web_descartada' }).eq('id', id);
    }

    // Eliminar de solicitudes_web
    await this.admin.from('solicitudes_web').delete().eq('id', id);

    return json({ ok: true, mensaje: 'Solicitud eliminada con exito.' });
  }

  /**
   * Operación Privilegiada: Listar usuarios del sistema utilizando privilegios administrativos.
   */
  public async listarUsuarios(): Promise<Response> {
    // Intenta ejecutar la RPC optimizada 'listar_usuarios'
    const { data, error: errRpc } = await this.admin.rpc('listar_usuarios');
    if (!errRpc && data) {
      return json({ ok: true, usuarios: data });
    }

    // Fallback: consulta a la tabla 'perfiles'
    const { data: perfiles, error: errPerfiles } = await this.admin
      .from('perfiles')
      .select('id, nombre, rol, activo, created_at')
      .order('nombre');

    if (errPerfiles) {
      return json({ error: `No se pudo obtener la lista de usuarios: ${errPerfiles.message}` });
    }

    return json({ ok: true, usuarios: perfiles || [] });
  }

  /**
   * Despacha la acción solicitada hacia la operación privilegiada adecuada.
   */
  public async ejecutarAccion(
    accion: string,
    cuerpo: Record<string, unknown>
  ): Promise<Response> {
    if (accion === 'crear') {
      return await this.crearUsuario(cuerpo);
    }
    if (accion === 'eliminar_solicitud_web') {
      return await this.eliminarSolicitudWeb(cuerpo);
    }
    if (accion === 'listar' || accion === 'listar_usuarios') {
      return await this.listarUsuarios();
    }
    return json({ error: `Accion no soportada: ${String(accion ?? '(vacía)')}.` });
  }
}

// ============================================================================
// CAPA 2: PROXY DE SEGURIDAD (Protection Proxy)
// ============================================================================
/**
 * Clase que implementa el Patrón Protection Proxy.
 * 
 * Actúa como la barrera de seguridad que custodia el acceso a `UsuariosRealService`.
 * Valida de forma rigurosa la autenticación y la autorización antes de instanciar
 * o conceder acceso al Sujeto Real con `SUPABASE_SERVICE_ROLE_KEY`.
 */
export class UsuariosProtectionProxy {
  /**
   * Punto de entrada del Proxy: intercepta la solicitud HTTP, ejecuta la
   * verificación en cascada y transfiere el control solo ante credenciales válidas.
   */
  public async validarAccesoYEjecutar(req: Request): Promise<Response> {
    // 1. Verificación previa de protocolo CORS y método HTTP
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CABECERAS_CORS });
    if (req.method !== 'POST') return json({ error: 'Método no permitido.' });

    // 2. Verificación de configuración segura en el entorno del servidor
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!url || !servicio) {
      return json({
        error: 'La funcion no esta configurada: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.',
      });
    }
    // 3. Extracción de credenciales del Cliente Privilegiado
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sesion no valida: vuelve a iniciar sesion.' });

    // Instancia el cliente administrativo temporal para validar identidad
    const admin = createClient(url, servicio, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 4. [PASO 1 DEL PROXY - AUTENTICACIÓN]:
    //    Verifica la identidad criptográfica del llamante contra GoTrue Auth.
    //    Nunca confía en datos provenientes del cuerpo de la solicitud.
    const { data: sesion, error: errSesion } = await admin.auth.getUser(token);
    if (errSesion || !sesion?.user) {
      return json({ error: 'Sesion no valida o vencida: vuelve a iniciar sesion.' });
    }

    // 5. [PASO 2 DEL PROXY - AUTORIZACIÓN Y ESTADO ACTIVO]:
    //    Consulta la base de datos para confirmar que el perfil exista y esté habilitado.
    const { data: perfil, error: errPerfil } = await admin
      .from('perfiles')
      .select('rol, activo')
      .eq('id', sesion.user.id)
      .maybeSingle();

    if (errPerfil) return json({ error: `No se pudo verificar tu perfil: ${errPerfil.message}` });
    if (!perfil || !perfil.activo) return json({ error: 'Tu perfil no está activo en el panel.' });

    // 6. Extracción y parseo seguro del cuerpo JSON
    let cuerpo: Record<string, unknown>;
    try {
      cuerpo = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'Solicitud invalida.' });
    }

    const accion = String(cuerpo?.accion ?? '');

    // 7. [PASO 3 DEL PROXY - CONTROL DE ACCESO BASADO EN ROLES (RBAC)]:
    //    Evaluación de la matriz de permisos según la sensibilidad de la operación:
    //
    //    a) Crear usuarios: Operación altamente privilegiada; exige rol estricto 'admin'.
    if (accion === 'crear' && perfil.rol !== 'admin') {
      return json({ error: 'Solo un administrador puede crear usuarios.' });
    }

    //    b) Eliminar solicitudes web: Operación de gestión; exige 'admin' o 'supervisor'.
    if (accion === 'eliminar_solicitud_web') {
      if (perfil.rol !== 'admin' && perfil.rol !== 'supervisor') {
        return json({ error: 'No tienes permisos suficientes para eliminar solicitudes.' });
      }
    }

    //    c) Listar usuarios: Requiere rol administrativo activo ('admin' o 'supervisor').
    if (accion === 'listar' || accion === 'listar_usuarios') {
      if (perfil.rol !== 'admin' && perfil.rol !== 'supervisor') {
        return json({ error: 'No tienes permisos suficientes para consultar la lista de usuarios.' });
      }
    }

    // 8. [DELEGACIÓN SEGURA AL SUJETO REAL]:
    //    Una vez que el Proxy de Protección ha validado la identidad y los privilegios,
    //    se delega la llamada al Sujeto Real (UsuariosRealService).
    const sujetoReal = new UsuariosRealService(admin);
    return await sujetoReal.ejecutarAccion(accion, cuerpo);
  }
}

// Instancia singleton del Proxy de Protección
export const usuariosProtectionProxy = new UsuariosProtectionProxy();

// ============================================================================
// CAPA 1: CLIENTE PRIVILEGIADO (Privileged Client) [DOCUMENTACIÓN DE FLUJO]
// ============================================================================
/**
 * Representación del Cliente Privilegiado:
 *
 * Flujo de Invocación desde el Cliente Frontend (ej. React / Usuarios.tsx):
 * ```typescript
 * // El cliente administrativo inicia sesión, obtiene su JWT y lo envía al Proxy:
 * const { data, error } = await supabase.functions.invoke('usuarios', {
 *   body: { accion: 'crear', correo, nombre, rol, clave },
 * });
 * ```
 *
 * Propiedades del Cliente Privilegiado:
 * - Se ejecuta en el navegador del usuario autenticado (administrador).
 * - Utiliza únicamente credenciales efímeras (JWT de sesión de usuario).
 * - No posee acceso ni puede ver la variable `SUPABASE_SERVICE_ROLE_KEY`.
 * - Confía en el `UsuariosProtectionProxy` para intermediar y ejecutar con seguridad
 *   las operaciones maestras en el servidor.
 */

// ============================================================================
// PUNTO DE ENTRADA DENO SERVE
// ============================================================================
// Toda solicitud entrante debe atravesar obligatoriamente el Proxy de Protección.
Deno.serve(async (req: Request) => {
  return await usuariosProtectionProxy.validarAccesoYEjecutar(req);
});
