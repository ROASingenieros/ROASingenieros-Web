import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

// ============================================================================
// Badges de estado (compartidos por cotizaciones, ventas, comprobantes…)
// ============================================================================
const COLORES: Record<string, string> = {
  // cotización
  borrador: "gris",
  enviada: "azul",
  aprobada: "verde",
  rechazada: "rojo",
  vencida: "amarillo",
  // venta / recepción
  pendiente: "amarillo",
  confirmada: "verde",
  anulada: "rojo",
  recibida: "verde",
  // comprobante / guía
  verificado: "azul",
  emitido: "verde",
  emitida: "verde",
  // catálogo
  activo: "verde",
  inactivo: "gris",
  // roles
  admin: "morado",
  supervisor: "azul",
  secretaria: "gris",
  // tipos de ítem
  producto: "azul",
  servicio: "morado",
};

export function Badge({ valor }: { valor: string }) {
  const color = COLORES[valor] || "gris";
  return <span className={`g-badge g-badge-${color}`}>{valor}</span>;
}

// ============================================================================
// Aviso (error / éxito / información)
// ============================================================================
export function Aviso({
  tipo,
  children,
}: {
  tipo: "error" | "ok" | "info";
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <div
      className={`g-aviso g-aviso-${tipo === "ok" ? "ok" : tipo === "error" ? "error" : "info"}`}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Estado vacío / cargando
// ============================================================================
export function Vacio({ texto }: { texto?: string }) {
  return <div className="g-vacio">{texto || "Sin registros por mostrar."}</div>;
}

export function Cargando({ texto }: { texto?: string }) {
  return <div className="g-cargando">{texto || "Cargando…"}</div>;
}

// ============================================================================
// Modal simple (escape y clic en el fondo cierran)
// ============================================================================
export function Modal({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  return (
    <div className="g-modal-overlay" onClick={onCerrar} role="presentation">
      <div
        className="g-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 className="g-modal-titulo">{titulo}</h3>
          <button
            type="button"
            className="g-btn g-btn-fantasma g-btn-mini"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Campos de formulario
// ============================================================================
export function Campo({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="g-campo">
      <label>{label}</label>
      {children}
    </div>
  );
}

// ============================================================================
// Botón con estado de carga
// ============================================================================
export function Boton({
  children,
  onClick,
  variante = "primario",
  disabled,
  tipo = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variante?: "primario" | "fantasma" | "peligro" | "exito";
  disabled?: boolean;
  tipo?: "button" | "submit";
  title?: string;
}) {
  const clase =
    variante === "primario"
      ? "g-btn"
      : variante === "fantasma"
        ? "g-btn g-btn-fantasma"
        : variante === "peligro"
          ? "g-btn g-btn-peligro"
          : "g-btn g-btn-exito";
  return (
    <button
      type={tipo}
      className={clase}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Encabezado de página
// ============================================================================
export function Pagina({
  titulo,
  descripcion,
  acciones,
  children,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="g-topbar no-print">
        <div>
          <h1 className="g-titulo">{titulo}</h1>
          {descripcion && <p className="g-descripcion">{descripcion}</p>}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {acciones}
        </div>
      </div>
      {children}
    </>
  );
}
