import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import {
  supabase,
  formatoFecha,
  formatoSoles,
  mensajeErrorBD,
  type DetalleItem,
  type EstadoVenta,
  type Venta,
} from "../../../datos/supabase";
import { useAuthGestion } from "../AuthContext";
import { useIrA } from "../router";
import { Aviso, Badge, Boton, Cargando, Pagina, Vacio } from "../ui";

export function Ventas({ id }: { id?: string }) {
  const { puede } = useAuthGestion();
  const irA = useIrA();
  const puedeGestionar = puede("admin", "supervisor");

  const [lista, setLista] = useState<Venta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fEstado, setFEstado] = useState("");

  const [detalle, setDetalle] = useState<Venta | null>(null);
  const [items, setItems] = useState<DetalleItem[]>([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [accion, setAccion] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    let q = supabase
      .from("ventas")
      .select("*, cliente:id_cliente(id,nombre_razon_social,num_documento)")
      .order("fecha", { ascending: false })
      .limit(200);
    if (fEstado) q = q.eq("estado", fEstado);
    const { data, error: err } = await q;
    if (err) setError(mensajeErrorBD(err));
    setLista((data as Venta[]) || []);
    setCargando(false);
  }, [fEstado]);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const cargarDetalle = useCallback(async (idVenta: number) => {
    setCargandoDetalle(true);
    const [v, d] = await Promise.all([
      supabase
        .from("ventas")
        .select("*, cliente:id_cliente(id,nombre_razon_social,num_documento)")
        .eq("id", idVenta)
        .maybeSingle(),
      supabase
        .from("detalle_venta")
        .select("*, producto:id_producto(id,nombre,codigo,tipo)")
        .eq("id_venta", idVenta)
        .order("id"),
    ]);
    setDetalle((v.data as Venta) || null);
    setItems((d.data as DetalleItem[]) || []);
    setCargandoDetalle(false);
  }, []);

  useEffect(() => {
    void (async () => {
      if (id) await cargarDetalle(Number(id));
    })();
  }, [id, cargarDetalle]);

  const cambiarEstado = async (estado: EstadoVenta) => {
    if (!detalle) return;
    if (
      estado === "anulada" &&
      !window.confirm(
        "¿Anular esta venta? Si estaba confirmada, el stock se repone.",
      )
    )
      return;
    if (
      estado === "confirmada" &&
      !window.confirm(
        "¿Confirmar esta venta? Se descontará el stock de los productos.",
      )
    )
      return;

    setAccion(true);
    setError(null);

    try {
      // Si se desea confirmar la venta, verificar primero el stock disponible de cada producto físico
      if (estado === "confirmada") {
        const itemsProducto = items.filter(
          (it) => it.producto?.tipo === "producto" || (!it.producto?.tipo && it.id_producto),
        );

        if (itemsProducto.length > 0) {
          const ids = Array.from(new Set(itemsProducto.map((it) => it.id_producto)));
          const { data: prodsStock, error: errStock } = await supabase
            .from("productos")
            .select("id, nombre, stock_actual, tipo")
            .in("id", ids);

          if (!errStock && prodsStock) {
            const prodsMap = new Map(prodsStock.map((p) => [p.id, p]));
            const faltantes: string[] = [];

            for (const it of itemsProducto) {
              const p = prodsMap.get(it.id_producto);
              if (p && p.tipo === "producto") {
                const stockDisp = p.stock_actual ?? 0;
                if (stockDisp < it.cantidad) {
                  faltantes.push(
                    `"${p.nombre}" (Disponible: ${stockDisp}, Requerido: ${it.cantidad})`
                  );
                }
              }
            }

            if (faltantes.length > 0) {
              setAccion(false);
              setError(
                `Stock insuficiente para confirmar la venta:\n• ${faltantes.join("\n• ")}`
              );
              return;
            }
          }
        }
      }

      // Actualizar el estado en la base de datos
      const { error: err } = await supabase
        .from("ventas")
        .update({ estado })
        .eq("id", detalle.id);

      if (err) throw err;

      // Si la venta se confirmó, desactivar productos que hayan quedado sin stock
      if (estado === "confirmada") {
        try {
          await supabase
            .from("productos")
            .update({ activo: false, visible_web: false })
            .lte("stock_actual", 0)
            .eq("tipo", "producto");
        } catch {
          // Silencioso si no hay permisos directos o si lo maneja el trigger de base de datos
        }
      }
    } catch (err: unknown) {
      setAccion(false);
      setError(mensajeErrorBD(err));
      return;
    }

    setAccion(false);
    await cargarDetalle(detalle.id);
  };

  const eliminarVenta = async (
    idVenta: number,
    numVenta: string,
    volver = false,
  ) => {
    if (
      !window.confirm(
        `¿Estás seguro de que deseas eliminar permanentemente la orden de venta ${numVenta}?\nEsta acción eliminará la venta y sus ítems asociados. No se puede deshacer.`,
      )
    ) {
      return;
    }
    setAccion(true);
    setError(null);
    try {
      // 1. Verificar si tiene comprobantes o guías asociadas
      const [compCheck, guiaCheck] = await Promise.all([
        supabase
          .from("comprobantes")
          .select("id, serie, correlativo")
          .eq("id_venta", idVenta)
          .limit(1),
        supabase
          .from("guias_remision")
          .select("id, serie, correlativo")
          .eq("id_venta", idVenta)
          .limit(1),
      ]);

      if (compCheck.data && compCheck.data.length > 0) {
        throw new Error(
          `No se puede eliminar la orden de venta ${numVenta} porque tiene comprobantes asociados (${compCheck.data[0].serie}-${compCheck.data[0].correlativo}). Elimina o anula los comprobantes primero.`,
        );
      }

      if (guiaCheck.data && guiaCheck.data.length > 0) {
        throw new Error(
          `No se puede eliminar la orden de venta ${numVenta} porque tiene guías de remisión asociadas (${guiaCheck.data[0].serie}-${guiaCheck.data[0].correlativo}). Elimina las guías primero.`,
        );
      }

      // 2. Si la venta estaba confirmada, intentar anularla primero para reponer stock
      const ventaActual =
        detalle && detalle.id === idVenta
          ? detalle
          : lista.find((v) => v.id === idVenta);
      if (ventaActual?.estado === "confirmada") {
        try {
          await supabase.rpc("anular_orden_venta", { p_id_venta: idVenta });
        } catch {
          // Continuar si la RPC falla o no aplica
        }
      }

      // 3. Eliminar garantías vinculadas a los detalles de esta venta
      const { data: detallesVenta } = await supabase
        .from("detalle_venta")
        .select("id")
        .eq("id_venta", idVenta);

      if (detallesVenta && detallesVenta.length > 0) {
        const idsDetalle = detallesVenta.map((d) => d.id);
        await supabase
          .from("garantias")
          .delete()
          .in("id_detalle_venta", idsDetalle);
      }

      // 4. Eliminar partidas de detalle_venta
      await supabase.from("detalle_venta").delete().eq("id_venta", idVenta);

      // 5. Eliminar la orden de venta
      const { error: err } = await supabase
        .from("ventas")
        .delete()
        .eq("id", idVenta);
      if (err) throw err;

      if (volver) {
        irA("ventas");
      } else {
        await cargar();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : mensajeErrorBD(err));
    } finally {
      setAccion(false);
    }
  };

  if (id) {
    return (
      <Pagina
        titulo="Detalle de orden de venta"
        acciones={
          <Boton variante="fantasma" onClick={() => irA("ventas")}>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <ArrowLeft size={15} /> Volver
            </span>
          </Boton>
        }
      >
        <Aviso tipo="error">{error}</Aviso>
        {cargandoDetalle || !detalle ? (
          <Cargando />
        ) : (
          <div className="g-tarjeta">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <h2 className="g-titulo" style={{ marginBottom: 4 }}>
                  {detalle.num_venta}
                </h2>
                <p className="g-descripcion">
                  {detalle.cliente?.nombre_razon_social || "—"} ·{" "}
                  {detalle.cliente?.num_documento} ·{" "}
                  {formatoFecha(detalle.fecha)}
                </p>
                {detalle.orden_compra_cliente && (
                  <p className="g-descripcion">
                    OC del cliente: {detalle.orden_compra_cliente}
                  </p>
                )}
              </div>
              <div style={{ flexShrink: 0 }}>
                <Badge valor={detalle.estado} />
              </div>
            </div>

            <div className="g-tabla-wrap" style={{ marginTop: 16 }}>
              <table className="g-tabla">
                <thead>
                  <tr>
                    <th>Ítem</th>
                    <th>Cant.</th>
                    <th>P. unitario</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {d.producto?.nombre || "—"}{" "}
                        <span style={{ color: "var(--text-muted)" }}>
                          ({d.producto?.tipo})
                        </span>
                      </td>
                      <td>{d.cantidad}</td>
                      <td>{formatoSoles(d.precio_unitario)}</td>
                      <td>{formatoSoles(d.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 14,
              }}
            >
              <div style={{ minWidth: 220, fontSize: 14 }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>Subtotal</span>
                  <span>{formatoSoles(detalle.subtotal)}</span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>IGV (18 %)</span>
                  <span>{formatoSoles(detalle.igv)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    fontSize: 16,
                    marginTop: 6,
                  }}
                >
                  <span>Total</span>
                  <span>{formatoSoles(detalle.total)}</span>
                </div>
              </div>
            </div>

            {puedeGestionar && (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 18,
                  flexWrap: "wrap",
                }}
              >
                {detalle.estado === "pendiente" && (
                  <Boton
                    variante="exito"
                    onClick={() => void cambiarEstado("confirmada")}
                    disabled={accion}
                  >
                    Confirmar venta (descuenta stock)
                  </Boton>
                )}
                {detalle.estado !== "anulada" && (
                  <Boton
                    variante="peligro"
                    onClick={() => void cambiarEstado("anulada")}
                    disabled={accion}
                  >
                    Anular venta
                  </Boton>
                )}
                {detalle.estado === "confirmada" && (
                  <>
                    <Boton
                      variante="fantasma"
                      onClick={() => irA("comprobantes")}
                    >
                      Ir a comprobantes
                    </Boton>
                    <Boton variante="fantasma" onClick={() => irA("guias")}>
                      Ir a guías
                    </Boton>
                  </>
                )}
                <Boton
                  variante="peligro"
                  onClick={() =>
                    void eliminarVenta(detalle.id, detalle.num_venta, true)
                  }
                  disabled={accion}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Trash2 size={15} /> Eliminar orden de venta
                  </span>
                </Boton>
              </div>
            )}
          </div>
        )}
      </Pagina>
    );
  }

  return (
    <Pagina
      titulo="Órdenes de venta"
      descripcion="Se generan al convertir una cotización aprobada. Confirmar descuenta stock; anular lo repone."
    >
      <Aviso tipo="error">{error}</Aviso>
      <div className="g-tarjeta">
        <div style={{ marginBottom: 14 }}>
          <select
            className="g-select"
            value={fEstado}
            onChange={(e) => setFEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="confirmada">Confirmadas</option>
            <option value="anulada">Anuladas</option>
          </select>
        </div>

        {cargando ? (
          <Cargando />
        ) : lista.length === 0 ? (
          <Vacio />
        ) : (
          <div className="g-tabla-wrap">
            <table className="g-tabla">
              <thead>
                <tr>
                  <th>N.°</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>OC cliente</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.num_venta}</td>
                    <td>{formatoFecha(v.fecha)}</td>
                    <td>{v.cliente?.nombre_razon_social || "—"}</td>
                    <td>{v.orden_compra_cliente || "—"}</td>
                    <td>
                      <Badge valor={v.estado} />
                    </td>
                    <td>{formatoSoles(v.total)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button
                        className="g-btn g-btn-fantasma g-btn-mini"
                        onClick={() => irA(`ventas/${v.id}`)}
                      >
                        Ver
                      </button>
                      {puedeGestionar && (
                        <>
                          {" "}
                          <button
                            type="button"
                            className="g-btn g-btn-peligro g-btn-mini"
                            disabled={accion}
                            onClick={() =>
                              void eliminarVenta(v.id, v.num_venta)
                            }
                            title="Eliminar orden de venta"
                            aria-label={`Eliminar orden de venta ${v.num_venta}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Pagina>
  );
}
