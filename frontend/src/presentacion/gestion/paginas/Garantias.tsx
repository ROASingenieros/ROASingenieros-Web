import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  supabase,
  formatoFecha,
  mensajeErrorBD,
  type Garantia,
} from "../../../datos/supabase";
import { useAuthGestion } from "../AuthContext";
import {
  Aviso,
  Badge,
  Boton,
  Campo,
  Cargando,
  Modal,
  Pagina,
  Vacio,
} from "../ui";

interface DetalleVentaGarantia {
  id: number;
  cantidad: number;
  producto?: { id: number; nombre: string } | null;
  venta?: {
    id: number;
    num_venta: string;
    estado?: string;
    fecha?: string;
  } | null;
}

interface GarantiaExtendida extends Garantia {
  detalle?: DetalleVentaGarantia | null;
}

export function Garantias() {
  const { puede } = useAuthGestion();
  const puedeOperar = puede("admin", "supervisor", "secretaria");

  const [garantias, setGarantias] = useState<GarantiaExtendida[]>([]);
  const [detalles, setDetalles] = useState<DetalleVentaGarantia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(0);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [idDetalle, setIdDetalle] = useState("");
  const [meses, setMeses] = useState("6");
  const [entidadGarante, setEntidadGarante] = useState("Fabricante");
  const [fechaInicio, setFechaInicio] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const [gRes, dRes] = await Promise.all([
      supabase
        .from("garantias")
        .select(
          "*, detalle:id_detalle_venta(id, cantidad, producto:id_producto(id,nombre), venta:id_venta(id,num_venta))",
        )
        .order("fecha_caducidad"),
      supabase
        .from("detalle_venta")
        .select(
          "id, cantidad, producto:id_producto(nombre), venta:id_venta(num_venta, estado, fecha)",
        )
        .order("id", { ascending: false })
        .limit(300),
    ]);

    if (gRes.error) setError(mensajeErrorBD(gRes.error));
    setGarantias((gRes.data as GarantiaExtendida[]) || []);
    setDetalles(
      ((dRes.data as unknown as DetalleVentaGarantia[]) || []).filter(
        (d) => d.venta?.estado === "confirmada",
      ),
    );
    setAhora(Date.now());
    setCargando(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const itemsConGarantia = useMemo(
    () => new Set(garantias.map((g) => g.id_detalle_venta)),
    [garantias],
  );

  const detallesDisponibles = useMemo(
    () => detalles.filter((d) => !itemsConGarantia.has(d.id)),
    [detalles, itemsConGarantia],
  );

  const porVencer = useMemo(() => {
    const en30Dias = ahora + 720 * 3600 * 1000;
    return garantias.filter((g) => {
      const t = new Date(g.fecha_caducidad).getTime();
      return t >= ahora && t <= en30Dias;
    });
  }, [garantias, ahora]);

  const abrirNuevo = () => {
    setIdDetalle("");
    setMeses("6");
    setEntidadGarante("Fabricante");
    setFechaInicio(new Date().toISOString().slice(0, 10));
    setFormError(null);
    setModalAbierto(true);
  };

  const guardar = async () => {
    setFormError(null);
    if (!idDetalle) {
      setFormError("Selecciona el ítem vendido.");
      return;
    }
    const m = Number(meses);
    if (!Number.isInteger(m) || m < 6 || m > 12) {
      setFormError("La garantía debe ser de 6 a 12 meses (RN-06).");
      return;
    }
    if (!entidadGarante.trim()) {
      setFormError("Indica la entidad garante (fabricante).");
      return;
    }
    if (!fechaInicio) {
      setFormError("Indica la fecha de inicio de la garantía.");
      return;
    }
    setGuardando(true);
    const { error: err } = await supabase.from("garantias").insert({
      id_detalle_venta: Number(idDetalle),
      meses: m,
      entidad_garante: entidadGarante.trim(),
      fecha_inicio: fechaInicio,
    });
    setGuardando(false);
    if (err) {
      setFormError(mensajeErrorBD(err));
      return;
    }
    setModalAbierto(false);
    await cargar();
  };

  const eliminarGarantia = async (g: GarantiaExtendida) => {
    const prod = g.detalle?.producto?.nombre
      ? ` del producto "${g.detalle.producto.nombre}"`
      : "";
    const numVenta = g.detalle?.venta?.num_venta
      ? ` (Venta ${g.detalle.venta.num_venta})`
      : "";
    if (
      !window.confirm(
        `¿Estás seguro de que deseas eliminar permanentemente esta garantía${prod}${numVenta}?`,
      )
    ) {
      return;
    }
    setError(null);
    const { error: err } = await supabase
      .from("garantias")
      .delete()
      .eq("id", g.id);
    if (err) {
      setError(mensajeErrorBD(err));
    } else {
      await cargar();
    }
  };

  return (
    <Pagina
      titulo="Garantías"
      descripcion="Por ítem vendido. Plazo de 6 a 12 meses; la fecha de caducidad la calcula la base (RN-06/RN-07)."
      acciones={
        puedeOperar ? (
          <Boton onClick={abrirNuevo}>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={15} /> Nueva garantía
            </span>
          </Boton>
        ) : null
      }
    >
      <Aviso tipo="error">{error}</Aviso>

      {porVencer.length > 0 && (
        <div
          className="g-tarjeta"
          style={{ borderLeft: "4px solid var(--accent-yellow)" }}
        >
          <strong>{porVencer.length}</strong> garantía(s) vencen en los próximos
          30 días.
        </div>
      )}

      <div className="g-tarjeta">
        {cargando ? (
          <Cargando />
        ) : garantias.length === 0 ? (
          <Vacio />
        ) : (
          <div className="g-tabla-wrap">
            <table className="g-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Venta</th>
                  <th>Meses</th>
                  <th>Garante</th>
                  <th>Inicio</th>
                  <th>Caducidad</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {garantias.map((g) => {
                  const t = new Date(g.fecha_caducidad).getTime();
                  const vencida = t < ahora;
                  const alerta = !vencida && t <= ahora + 720 * 3600 * 1000;
                  return (
                    <tr key={g.id}>
                      <td style={{ fontWeight: 600 }}>
                        {g.detalle?.producto?.nombre || "—"}
                      </td>
                      <td>{g.detalle?.venta?.num_venta || "—"}</td>
                      <td>{g.meses}</td>
                      <td>{g.entidad_garante}</td>
                      <td>{formatoFecha(g.fecha_inicio)}</td>
                      <td>
                        {formatoFecha(g.fecha_caducidad)}{" "}
                        {vencida ? (
                          <Badge valor="vencida" />
                        ) : alerta ? (
                          <span
                            style={{
                              color: "var(--accent-yellow)",
                              fontSize: 11,
                            }}
                          >
                            por vencer
                          </span>
                        ) : null}
                      </td>
                      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                        {puedeOperar && (
                          <button
                            type="button"
                            className="g-btn g-btn-peligro g-btn-mini"
                            onClick={() => void eliminarGarantia(g)}
                            title="Eliminar garantía"
                            aria-label={`Eliminar garantía de ${g.detalle?.producto?.nombre || "ítem"}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <Modal titulo="Nueva garantía" onCerrar={() => setModalAbierto(false)}>
          <Aviso tipo="error">{formError}</Aviso>
          <Campo label="Ítem vendido (venta confirmada)">
            <select
              className="g-select"
              value={idDetalle}
              onChange={(e) => setIdDetalle(e.target.value)}
            >
              <option value="">—</option>
              {detallesDisponibles.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.venta?.num_venta} · {d.producto?.nombre} x{d.cantidad}
                </option>
              ))}
            </select>
          </Campo>
          <div className="g-grid-2">
            <Campo label="Meses (6 a 12)">
              <input
                className="g-input"
                type="number"
                min={6}
                max={12}
                value={meses}
                onChange={(e) => setMeses(e.target.value)}
              />
            </Campo>
            <Campo label="Entidad garante">
              <input
                className="g-input"
                value={entidadGarante}
                onChange={(e) => setEntidadGarante(e.target.value)}
              />
            </Campo>
          </div>
          <Campo label="Fecha de inicio">
            <input
              className="g-input"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </Campo>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Boton variante="fantasma" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Boton>
            <Boton onClick={() => void guardar()} disabled={guardando}>
              {guardando ? "Guardando…" : "Registrar garantía"}
            </Boton>
          </div>
        </Modal>
      )}
    </Pagina>
  );
}
