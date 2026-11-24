import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  "";
const supabaseAnonKey =
  (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Supabase no configurado. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env\n" +
      "   Sin credenciales no se podrá cargar el catálogo de productos.",
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
);

// ============================================================================
// Tipos del esquema en español (TENER EN CUENTA/roas_schema.sql).
// Cuando se regeneren con la CLI (supabase gen types) se sustituyen aquí.
// ============================================================================

export type RolUsuario = "admin" | "supervisor" | "secretaria";
export type TipoItem = "producto" | "servicio";
export type EstadoCotizacion =
  | "borrador"
  | "enviada"
  | "aprobada"
  | "rechazada"
  | "vencida";
export type EstadoVenta = "pendiente" | "confirmada" | "anulada";
export type TipoComprobante = "boleta" | "factura";
export type EstadoComprobante =
  | "borrador"
  | "verificado"
  | "emitido"
  | "anulado";
export type EstadoGuia = "borrador" | "emitida" | "anulada";
export type EstadoRecepcion = "pendiente" | "recibida" | "anulada";

export interface Perfil {
  id: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  creado_en: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface Marca {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Modelo {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface TipoDocumento {
  id: number;
  codigo_sunat: string;
  descripcion: string;
  activo: boolean;
}

export interface Producto {
  id: number;
  tipo: TipoItem;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  id_categoria: number;
  id_marca: number | null;
  id_modelo: number | null;
  unidad_medida: string | null;
  precio_unitario: number; // sin IGV (la base agrega 18%)
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number | null;
  visible_web: boolean;
  activo: boolean;
  creado_en: string;
  // joins
  categoria?: Pick<Categoria, "id" | "nombre"> | null;
  marca?: Pick<Marca, "id" | "nombre"> | null;
  producto_costo?: { precio_costo: number }[] | null;
}

export interface Cliente {
  id: number;
  id_tipo_documento: number;
  num_documento: string;
  nombre_razon_social: string;
  apellidos: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  id_ubicacion: number | null;
  activo: boolean;
  creado_en: string;
  tipo_documento?: Pick<
    TipoDocumento,
    "id" | "descripcion" | "codigo_sunat"
  > | null;
}

export interface DetalleItem {
  id: number;
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  producto?: Pick<
    Producto,
    "id" | "nombre" | "codigo" | "tipo" | "unidad_medida"
  > | null;
}

export interface Cotizacion {
  id: number;
  num_cotizacion: string;
  fecha_emision: string;
  id_cliente: number;
  id_empleado: number | null;
  origen: string;
  estado: EstadoCotizacion;
  asunto?: string | null;
  forma_pago?: string | null;
  subtotal: number;
  igv: number;
  total: number;
  notas: string | null;
  /**
   * Para documentos (PDF/Excel) se piden también los datos de contacto del
   * cliente y su tipo de documento (RUC/DNI), que cambia la etiqueta impresa.
   */
  cliente?:
    | (Pick<
        Cliente,
        | "id"
        | "nombre_razon_social"
        | "num_documento"
        | "apellidos"
        | "direccion"
        | "telefono"
        | "correo"
      > & {
        tipo_documento?: Pick<
          TipoDocumento,
          "descripcion" | "codigo_sunat"
        > | null;
      })
    | null;
}

export interface Venta {
  id: number;
  num_venta: string;
  fecha: string;
  id_cotizacion: number | null;
  id_cliente: number;
  id_empleado: number | null;
  orden_compra_cliente: string | null;
  estado: EstadoVenta;
  subtotal: number;
  igv: number;
  total: number;
  cliente?: Pick<
    Cliente,
    | "id"
    | "nombre_razon_social"
    | "num_documento"
    | "direccion"
    | "telefono"
    | "correo"
  > | null;
}

export interface Comprobante {
  id: number;
  id_venta: number;
  tipo: TipoComprobante;
  serie: string;
  correlativo: number;
  estado: EstadoComprobante;
  verificado_por: string | null;
  emitido_en: string | null;
  hash_cpe: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  respuesta_sunat: Record<string, unknown> | null;
  venta?: Pick<Venta, "id" | "num_venta" | "total" | "estado"> | null;
}

export interface GuiaRemision {
  id: number;
  id_venta: number;
  serie: string;
  correlativo: number;
  punto_partida: string | null;
  punto_llegada: string;
  fecha_traslado: string;
  estado: EstadoGuia;
  respuesta_sunat: Record<string, unknown> | null;
  pdf_url: string | null;
  venta?: Pick<Venta, "id" | "num_venta" | "estado"> | null;
}

export interface Garantia {
  id: number;
  id_detalle_venta: number;
  meses: number;
  entidad_garante: string;
  fecha_inicio: string;
  fecha_caducidad: string;
  detalle?: {
    id: number;
    cantidad: number;
    producto?: Pick<Producto, "id" | "nombre"> | null;
    venta?: Pick<Venta, "id" | "num_venta"> | null;
  } | null;
}

export interface Proveedor {
  id: number;
  ruc: string;
  razon_social: string;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
}

export interface OrdenCompra {
  id: number;
  num_orden: string;
  fecha_emision: string;
  id_proveedor: number;
  id_empleado: number | null;
  estado: EstadoRecepcion;
  proveedor?: Pick<Proveedor, "id" | "razon_social" | "ruc"> | null;
}

export interface Empleado {
  id: number;
  id_perfil: string | null;
  num_documento: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  correo: string | null;
  id_cargo: number | null;
  fecha_ingreso: string;
  activo: boolean;
}

export interface MovimientoInventario {
  id: number;
  id_producto: number;
  tipo: "venta" | "compra" | "ajuste";
  cantidad: number;
  stock_resultante: number;
  referencia: string | null;
  id_usuario: string | null;
  creado_en: string;
  producto?: Pick<Producto, "id" | "nombre" | "codigo"> | null;
}

export interface Auditoria {
  id: number;
  tabla: string;
  operacion: string;
  id_registro: string | null;
  valor_anterior: Record<string, unknown> | null;
  valor_nuevo: Record<string, unknown> | null;
  id_usuario: string | null;
  creado_en: string;
}

export interface UsuarioLista {
  id: string;
  correo: string | null;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  creado_en: string;
  ultimo_acceso: string | null;
}

/** Unidades de medida sugeridas para el formulario de producto. */
export const UNIDADES_MEDIDA = [
  "unidad",
  "metro",
  "rollo",
  "caja",
  "juego",
  "servicio",
  "glob",
];

/** Formato de moneda en soles (Perú). */
export function formatoSoles(amount: number | null | undefined): string {
  return `S/ ${Number(amount ?? 0).toFixed(2)}`;
}

/** Fecha dd/mm/aaaa (America/Lima se maneja al parsear con offset; aquí se usa UTC local). */
export function formatoFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Registra una solicitud del catálogo público en `auditoria(tabla='solicitud_web')`
 * vía la RPC SECURITY DEFINER `registrar_solicitud_web` (visible solo para el
 * Gerente en la bandeja "Solicitudes web"). El envío real lo hace el usuario
 * por WhatsApp; esto solo deja el lead para seguimiento.
 */
export async function registrarSolicitudWeb(
  nombre: string,
  telefono: string,
  items: { name: string; qty: number; price?: string }[],
): Promise<void> {
  try {
    // Sanitización en backend/acceso a datos: nombres sin números y teléfonos sin letras
    const nombreLimpio =
      (nombre || "").replace(/[0-9]/g, "").trim() || "Sin nombre";
    const telefonoLimpio = (telefono || "").replace(/[a-zA-Z]/g, "").trim();

    const { error } = await supabase.rpc("registrar_solicitud_web", {
      p_nombre: nombreLimpio,
      p_telefono: telefonoLimpio,
      p_items: items,
    });
    if (error) throw error;
  } catch (e) {
    // Nunca bloquear el flujo de cotización por un fallo del lead.
    console.warn("No se pudo registrar la solicitud web:", e);
  }
}

/** Mensaje amigable para errores de RLS / restricciones de la base. */
export function mensajeErrorBD(error: unknown): string {
  const e = error as { message?: string; code?: string; details?: string; hint?: string } | null;
  const msg = e?.message || "Error inesperado";

  // Mensajes específicos de las RPCs de negocio (RAISE EXCEPTION) — mostrarlos tal cual
  if (/Stock insuficiente/i.test(msg)) {
    return msg;
  }
  if (/solo se puede confirmar/i.test(msg)) {
    return msg;
  }
  if (/solo se puede convertir/i.test(msg)) {
    return msg;
  }
  if (/no se puede anular/i.test(msg)) {
    return msg;
  }
  if (/no se puede emitir/i.test(msg)) {
    return msg;
  }
  if (/ya tiene un comprobante/i.test(msg)) {
    return msg;
  }
  if (/ya se encuentra anulada/i.test(msg)) {
    return msg;
  }
  if (/no es válida o está anulada/i.test(msg)) {
    return msg;
  }
  if (/no existe/i.test(msg) && /orden de venta|cotización|producto|venta/i.test(msg)) {
    return msg;
  }
  if (/stock no puede ser negativo/i.test(msg)) {
    return msg;
  }

  // Errores genéricos de PostgreSQL — traducirlos
  if (/row-level security|permission denied/i.test(msg)) {
    return "No tienes permiso para esta acción.";
  }
  if (e?.code === "23505" || /duplicate key|unique constraint/i.test(msg)) {
    return "Ya existe un registro con esos datos (duplicado).";
  }
  if (e?.code === "23503" || /foreign key/i.test(msg)) {
    return "No se puede completar: el registro está en uso por otro dato.";
  }
  if (/stock_no_negativo/i.test(msg) || (/check constraint/i.test(msg) && /stock/i.test(msg))) {
    return "Stock insuficiente: no hay suficiente stock disponible para completar la operación.";
  }
  if (/check constraint/i.test(msg)) {
    return `La operación no se pudo completar: viola una regla del negocio (${e?.details || msg}).`;
  }
  return msg;
}
