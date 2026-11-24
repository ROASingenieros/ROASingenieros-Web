import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  Plus,
  Trash2,
  Eye,
  FileText,
  Search,
  Lock,
  X,
  Sparkles,
} from "lucide-react";
import {
  supabase,
  formatoFecha,
  formatoSoles,
  mensajeErrorBD,
  UNIDADES_MEDIDA,
  type Cliente,
  type Cotizacion,
  type DetalleItem,
  type EstadoCotizacion,
  type Producto,
  type TipoItem,
} from "../../../datos/supabase";
import {
  PLANTILLA_COTIZACION,
  datosDeCotizacion,
  extraerMetaNotas,
  generarDocumento,
} from "../../../externos/excel/documentos";
import {
  ESTILOS_COTIZACION,
  htmlCotizacion,
} from "../../../externos/documentos/cotizacion-html";
import { useAuthGestion } from "../AuthContext";
import { imprimirDocumento } from "../imprimir";
import { useIrA } from "../router";
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

interface ItemForm {
  id_producto: string;
  cantidad: string;
  precio_unitario: string; // Determinado exclusivamente por el catálogo de productos (no editable)
  busqueda?: string;
  mostrarDropdown?: boolean;
}

const ITEM_VACIO: ItemForm = {
  id_producto: "",
  cantidad: "1",
  precio_unitario: "",
  busqueda: "",
  mostrarDropdown: false,
};

interface ItemManualForm {
  nombre: string;
  tipo: TipoItem;
  unidad_medida: string;
  cantidad: string;
  precio_unitario: string;
}

const ITEM_MANUAL_VACIO: ItemManualForm = {
  nombre: "",
  tipo: "servicio",
  unidad_medida: "servicio",
  cantidad: "1",
  precio_unitario: "",
};

const ESTADOS: EstadoCotizacion[] = [
  "borrador",
  "enviada",
  "aprobada",
  "rechazada",
  "vencida",
];

export function Cotizaciones({ id }: { id?: string }) {
  const { puede } = useAuthGestion();
  const irA = useIrA();
  const puedeEscribir = puede("admin", "supervisor", "secretaria");
  const puedeConvertir = puede("admin", "supervisor");

  const [pestana, setPestana] = useState<"gestion" | "vistaPrevia">("gestion");
  const [lista, setLista] = useState<Cotizacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<{ id: number; nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fEstado, setFEstado] = useState("");

  const [abierto, setAbierto] = useState(false);
  const [abiertoPersonalizada, setAbiertoPersonalizada] = useState(false);
  const [idCliente, setIdCliente] = useState("");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [dropdownClienteAbierto, setDropdownClienteAbierto] = useState(false);
  const [origen, setOrigen] = useState("interno");
  const [idCategoriaPersonalizada, setIdCategoriaPersonalizada] = useState("");
  const [asunto, setAsunto] = useState("");
  const [formaPago, setFormaPago] = useState("Contado");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<ItemForm[]>([{ ...ITEM_VACIO }]);
  const [itemsManuales, setItemsManuales] = useState<ItemManualForm[]>([
    { ...ITEM_MANUAL_VACIO },
  ]);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Detalle
  const [detalle, setDetalle] = useState<Cotizacion | null>(null);
  const [detalleItems, setDetalleItems] = useState<DetalleItem[]>([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [generandoExcel, setGenerandoExcel] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    let q = supabase
      .from("cotizaciones")
      .select("*, cliente:id_cliente(id,nombre_razon_social,num_documento)")
      .order("fecha_emision", { ascending: false })
      .limit(200);
    if (fEstado) q = q.eq("estado", fEstado);
    const [c, cl, p, cat] = await Promise.all([
      q,
      supabase
        .from("clientes")
        .select("id, nombre_razon_social, apellidos, num_documento")
        .eq("activo", true)
        .order("nombre_razon_social"),
      supabase
        .from("productos")
        .select("id, nombre, codigo, tipo, precio_unitario, unidad_medida")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("categoria")
        .select("id, nombre")
        .order("nombre"),
    ]);
    if (c.error) setError(mensajeErrorBD(c.error));
    setLista((c.data as Cotizacion[]) || []);
    setClientes((cl.data as Cliente[]) || []);
    setProductos((p.data as Producto[]) || []);
    setCategorias((cat.data as { id: number; nombre: string }[]) || []);
    setCargando(false);
  }, [fEstado]);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const cargarDetalle = useCallback(async (idCot: number) => {
    setCargandoDetalle(true);
    const [c, d] = await Promise.all([
      supabase
        .from("cotizaciones")
        .select(
          "*, cliente:id_cliente(id,nombre_razon_social,num_documento,apellidos,direccion,telefono,correo,tipo_documento:id_tipo_documento(descripcion,codigo_sunat))",
        )
        .eq("id", idCot)
        .maybeSingle(),
      supabase
        .from("detalle_cotizacion")
        .select("*, producto:id_producto(id,nombre,codigo,tipo,unidad_medida)")
        .eq("id_cotizacion", idCot)
        .order("id"),
    ]);
    setDetalle((c.data as Cotizacion) || null);
    setDetalleItems((d.data as DetalleItem[]) || []);
    setCargandoDetalle(false);
  }, []);

  useEffect(() => {
    void (async () => {
      if (id) await cargarDetalle(Number(id));
    })();
  }, [id, cargarDetalle]);

  const totalLocal = useMemo(
    () =>
      items.reduce(
        (s, i) =>
          s + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0),
        0,
      ),
    [items],
  );

  const totalLocalManual = useMemo(
    () =>
      itemsManuales.reduce(
        (s, i) =>
          s + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0),
        0,
      ),
    [itemsManuales],
  );

  const clienteSeleccionado = useMemo(
    () => clientes.find((c) => String(c.id) === idCliente),
    [clientes, idCliente],
  );

  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.toLowerCase().trim();
    if (!q) return clientes.slice(0, 8);
    return clientes
      .filter((c) => {
        const doc = (c.num_documento || "").toLowerCase();
        const nom = (c.nombre_razon_social || "").toLowerCase();
        const ape = (c.apellidos || "").toLowerCase();
        return doc.includes(q) || nom.includes(q) || ape.includes(q);
      })
      .slice(0, 10);
  }, [clientes, busquedaCliente]);

  const abrirNuevo = () => {
    setIdCliente("");
    setBusquedaCliente("");
    setDropdownClienteAbierto(false);
    setOrigen("interno");
    setAsunto("");
    setFormaPago("Contado");
    setNotas("");
    setItems([{ ...ITEM_VACIO }]);
    setFormError(null);
    setAbierto(true);
  };

  const setItem = (
    idx: number,
    campo: keyof ItemForm,
    valor: string | boolean,
  ) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        if (campo === "id_producto") {
          const prod = productos.find((x) => String(x.id) === valor);
          return {
            ...it,
            id_producto: String(valor),
            precio_unitario: prod ? String(prod.precio_unitario) : "",
            busqueda: "",
            mostrarDropdown: false,
          };
        }
        return { ...it, [campo]: valor };
      }),
    );
  };

  const obtenerSiguienteNumCotizacion = async (): Promise<string> => {
    try {
      const { data } = await supabase
        .from("cotizaciones")
        .select("num_cotizacion");

      let maxNum = 0;
      const fuentes = [data, lista];
      for (const fuente of fuentes) {
        if (Array.isArray(fuente)) {
          for (const item of fuente) {
            if (!item?.num_cotizacion) continue;
            const match = item.num_cotizacion.match(/COT-(\d+)/i);
            if (match) {
              const val = parseInt(match[1], 10);
              if (!isNaN(val) && val > maxNum) {
                maxNum = val;
              }
            }
          }
        }
      }
      return `COT-${String(maxNum + 1).padStart(4, "0")}`;
    } catch {
      return `COT-0001`;
    }
  };

  const insertarCotizacionConCorrelativo = async (
    idClienteNum: number,
    origenVal: string,
    asuntoVal: string,
    formaPagoVal: string,
    notasVal: string,
  ): Promise<{ id: number }> => {
    let intentos = 0;
    let cot: { id: number } | null = null;
    let errCot: { code?: string; message?: string } | null = null;
    let numCot = await obtenerSiguienteNumCotizacion();

    while (intentos < 10) {
      let insertPayload: Record<string, unknown> = {
        num_cotizacion: numCot,
        id_cliente: idClienteNum,
        origen: origenVal,
        asunto: asuntoVal.trim() || null,
        forma_pago: formaPagoVal.trim() || "Contado",
        notas: notasVal.trim() || null,
      };

      let res = await supabase
        .from("cotizaciones")
        .insert(insertPayload)
        .select("id")
        .single();

      cot = res.data as { id: number } | null;
      errCot = res.error;

      // Si las columnas asunto o forma_pago aún no existen en la BD (error 42703), fallback a notas
      if (
        errCot &&
        ((errCot as { code?: string }).code === "42703" ||
          /column .* does not exist/i.test(errCot.message || ""))
      ) {
        const metaTags: string[] = [];
        if (asuntoVal.trim()) metaTags.push(`[ASUNTO: ${asuntoVal.trim()}]`);
        if (formaPagoVal.trim())
          metaTags.push(`[FORMA_PAGO: ${formaPagoVal.trim()}]`);
        const notasCombinadas = [...metaTags, notasVal.trim()]
          .filter(Boolean)
          .join("\n");

        insertPayload = {
          num_cotizacion: numCot,
          id_cliente: idClienteNum,
          origen: origenVal,
          notas: notasCombinadas || null,
        };

        const resFallback = await supabase
          .from("cotizaciones")
          .insert(insertPayload)
          .select("id")
          .single();

        cot = resFallback.data as { id: number } | null;
        errCot = resFallback.error;
      }

      // Si fue error de duplicado (código 23505), avanzamos el correlativo y reintentamos
      if (
        errCot &&
        ((errCot as { code?: string }).code === "23505" ||
          /duplicate key|unique constraint/i.test(errCot.message || ""))
      ) {
        const match = numCot.match(/COT-(\d+)/i);
        const currentN = match ? parseInt(match[1], 10) : 0;
        numCot = `COT-${String(currentN + 1).padStart(4, "0")}`;
        intentos++;
        continue;
      }

      break;
    }

    if (errCot) throw errCot;
    if (!cot) throw new Error("No se pudo obtener el identificador de la cotización creada.");
    return cot;
  };

  const guardar = async () => {
    setFormError(null);
    if (!idCliente) return setFormError("Selecciona un cliente.");
    // Cada fila con producto elegido debe quedar completa: antes se descartaba
    // en silencio y el usuario no sabía qué fila estaba mal.
    for (const [i, it] of items.entries()) {
      if (!it.id_producto) continue;
      const cant = Number(it.cantidad);
      const precio = Number(it.precio_unitario);
      if (!Number.isInteger(cant) || cant < 1)
        return setFormError(
          `Ítem ${i + 1}: la cantidad debe ser un entero mayor que 0.`,
        );
      if (!Number.isFinite(precio) || precio < 0)
        return setFormError(
          `Ítem ${i + 1}: el precio unitario no es un número válido.`,
        );
    }
    const validos = items.filter((i) => i.id_producto);
    if (validos.length === 0)
      return setFormError("Agrega al menos un ítem válido.");

    setGuardando(true);
    try {
      const cot = await insertarCotizacionConCorrelativo(
        Number(idCliente),
        origen,
        asunto,
        formaPago,
        notas,
      );

      const filas = validos.map((i) => ({
        id_cotizacion: cot.id,
        id_producto: Number(i.id_producto),
        cantidad: Math.trunc(Number(i.cantidad)),
        precio_unitario: Number(i.precio_unitario),
      }));
      const { error: errDet } = await supabase
        .from("detalle_cotizacion")
        .insert(filas);
      if (errDet) throw errDet;

      setAbierto(false);
      await cargar();
      irA(`cotizaciones/${cot.id}`);
    } catch (e) {
      setFormError(mensajeErrorBD(e));
    } finally {
      setGuardando(false);
    }
  };

  const abrirPersonalizada = () => {
    setIdCliente("");
    setBusquedaCliente("");
    setDropdownClienteAbierto(false);
    setOrigen("interno");
    setAsunto("");
    setFormaPago("Contado");
    setNotas("");
    const catSugerida =
      categorias.find((c) => /servicio|personaliz|general|otro/i.test(c.nombre)) || categorias[0];
    setIdCategoriaPersonalizada(catSugerida ? String(catSugerida.id) : "");
    setItemsManuales([{ ...ITEM_MANUAL_VACIO }]);
    setFormError(null);
    setAbiertoPersonalizada(true);
  };

  const setItemManual = (
    idx: number,
    campo: keyof ItemManualForm,
    valor: string,
  ) => {
    setItemsManuales((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        if (campo === "tipo") {
          const nuevoTipo = valor as TipoItem;
          const nuevaUnidad =
            it.unidad_medida === "servicio" && nuevoTipo === "producto"
              ? "unidad"
              : it.unidad_medida === "unidad" && nuevoTipo === "servicio"
                ? "servicio"
                : it.unidad_medida;
          return { ...it, tipo: nuevoTipo, unidad_medida: nuevaUnidad };
        }
        return { ...it, [campo]: valor };
      }),
    );
  };

  const guardarPersonalizada = async () => {
    setFormError(null);
    if (!idCliente) return setFormError("Selecciona un cliente.");

    const validos = itemsManuales.filter((i) => i.nombre.trim());
    if (validos.length === 0) {
      return setFormError(
        "Ingresa al menos un ítem con su descripción o nombre.",
      );
    }

    for (const [idx, it] of itemsManuales.entries()) {
      if (!it.nombre.trim()) continue;
      const cant = Number(it.cantidad);
      const precio = Number(it.precio_unitario);
      if (!Number.isInteger(cant) || cant < 1) {
        return setFormError(
          `Ítem ${idx + 1} ("${it.nombre}"): la cantidad debe ser un entero mayor que 0.`,
        );
      }
      if (!Number.isFinite(precio) || precio < 0) {
        return setFormError(
          `Ítem ${idx + 1} ("${it.nombre}"): el precio unitario no es un número válido.`,
        );
      }
    }

    setGuardando(true);
    try {
      // Resolver categoría requerida por la base de datos (id_categoria NOT NULL)
      let idCatFinal = Number(idCategoriaPersonalizada);
      if (!idCatFinal) {
        if (categorias.length > 0) {
          const pref =
            categorias.find((c) => /servicio|personaliz|general|otro/i.test(c.nombre)) || categorias[0];
          idCatFinal = pref.id;
        } else {
          const { data: cData } = await supabase.from('categoria').select('id, nombre').limit(5);
          if (cData && cData.length > 0) {
            const pref = cData.find((c: { id: number; nombre: string }) => /servicio|personaliz|general|otro/i.test(c.nombre)) || cData[0];
            idCatFinal = pref.id;
          } else {
            const { data: pData } = await supabase
              .from('productos')
              .select('id_categoria')
              .not('id_categoria', 'is', null)
              .limit(1);
            if (pData && pData.length > 0 && pData[0].id_categoria) {
              idCatFinal = pData[0].id_categoria;
            }
          }
        }
      }

      if (!idCatFinal) {
        return setFormError(
          'No se encontró una categoría válida en el sistema para asociar los productos. Crea una categoría en el catálogo antes de continuar.',
        );
      }

      // 1. Registrar los ítems manuales como productos no visibles en web
      const partidasCreadas: {
        id_producto: number;
        cantidad: number;
        precio_unitario: number;
      }[] = [];

      for (const it of validos) {
        const payloadProd = {
          nombre: it.nombre.trim(),
          tipo: it.tipo || "servicio",
          id_categoria: idCatFinal,
          unidad_medida:
            it.unidad_medida ||
            (it.tipo === "servicio" ? "servicio" : "unidad"),
          precio_unitario: Number(it.precio_unitario),
          stock_actual: 0,
          stock_minimo: 0,
          visible_web: false,
          activo: true,
          descripcion: "Ítem personalizado para cotización",
        };

        const { data: prodData, error: prodErr } = await supabase
          .from("productos")
          .insert(payloadProd)
          .select("id")
          .single();

        if (prodErr) throw prodErr;

        partidasCreadas.push({
          id_producto: (prodData as { id: number }).id,
          cantidad: Math.trunc(Number(it.cantidad)),
          precio_unitario: Number(it.precio_unitario),
        });
      }

      // 2. Insertar la cotización con correlativo automático anti-colisión
      const cot = await insertarCotizacionConCorrelativo(
        Number(idCliente),
        origen,
        asunto,
        formaPago,
        notas,
      );

      // 3. Insertar las partidas en detalle_cotizacion
      const filasDetalle = partidasCreadas.map((p) => ({
        id_cotizacion: cot.id,
        id_producto: p.id_producto,
        cantidad: p.cantidad,
        precio_unitario: p.precio_unitario,
      }));

      const { error: errDet } = await supabase
        .from("detalle_cotizacion")
        .insert(filasDetalle);
      if (errDet) throw errDet;

      setAbiertoPersonalizada(false);
      await cargar();
      irA(`cotizaciones/${cot.id}`);
    } catch (e) {
      setFormError(mensajeErrorBD(e));
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (estado: EstadoCotizacion) => {
    if (!detalle) return;
    const { error: err } = await supabase
      .from("cotizaciones")
      .update({ estado })
      .eq("id", detalle.id);
    if (err) setError(mensajeErrorBD(err));
    else await cargarDetalle(detalle.id);
  };

  const convertir = async () => {
    if (!detalle) return;
    const oc = window.prompt("N.° de orden de compra del cliente (RN-12):");
    if (oc === null) return;
    if (!oc.trim()) {
      setError("Falta la orden de compra del cliente.");
      return;
    }
    setConvirtiendo(true);
    const { data, error: err } = await supabase.rpc(
      "convertir_cotizacion_a_venta",
      {
        p_id_cotizacion: detalle.id,
        p_oc_cliente: oc.trim(),
      },
    );
    setConvirtiendo(false);
    if (err) {
      setError(mensajeErrorBD(err));
      return;
    }
    irA(`ventas/${data as number}`);
  };

  const exportarExcel = async () => {
    if (!detalle) return;
    setGenerandoExcel(true);
    setError(null);
    try {
      await generarDocumento(
        PLANTILLA_COTIZACION,
        `cotizacion-${detalle.num_cotizacion}`,
        datosDeCotizacion(detalle, detalleItems),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el Excel.");
    } finally {
      setGenerandoExcel(false);
    }
  };

  const eliminarCotizacion = async (
    idCot: number,
    numCot: string,
    volver = false,
  ) => {
    if (
      !window.confirm(
        `¿Estás seguro de que deseas eliminar permanentemente la cotización ${numCot}?\nEsta acción eliminará sus partidas asociadas y no se puede deshacer.`,
      )
    ) {
      return;
    }
    setEliminando(true);
    setError(null);
    try {
      // 1. Eliminar primero las partidas / ítems en detalle_cotizacion
      const { error: errDetalle } = await supabase
        .from("detalle_cotizacion")
        .delete()
        .eq("id_cotizacion", idCot);
      if (errDetalle) throw errDetalle;

      // 2. Eliminar la cotización
      const { error: err } = await supabase
        .from("cotizaciones")
        .delete()
        .eq("id", idCot);
      if (err) {
        if (/foreign key|viola/i.test(err.message || "")) {
          throw new Error(
            `No se puede eliminar la cotización ${numCot} porque ya fue convertida a orden de venta u otro documento.`,
          );
        }
        throw err;
      }
      if (volver) {
        irA("cotizaciones");
      } else {
        await cargar();
      }
    } catch (e) {
      setError(mensajeErrorBD(e));
    } finally {
      setEliminando(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Vista de detalle
  // ---------------------------------------------------------------------------
  if (id) {
    return (
      <Pagina
        titulo="Detalle de cotización"
        acciones={
          <Boton variante="fantasma" onClick={() => irA("cotizaciones")}>
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
          <>
            <div className="g-pestanas no-print">
              <button
                type="button"
                className={`g-pestana ${pestana === "gestion" ? "g-pestana-activa" : ""}`}
                onClick={() => setPestana("gestion")}
              >
                <FileText size={15} /> Tabla de Gestión
              </button>
              <button
                type="button"
                className={`g-pestana ${pestana === "vistaPrevia" ? "g-pestana-activa" : ""}`}
                onClick={() => setPestana("vistaPrevia")}
              >
                <Eye size={15} /> Vista Previa Oficial (ROAS)
              </button>
            </div>

            {pestana === "vistaPrevia" ? (
              <div className="g-tarjeta">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <h3 className="g-titulo" style={{ fontSize: 16 }}>
                      Formato Oficial de Cotización
                    </h3>
                    <p className="g-descripcion">
                      Previsualización fiel del documento oficial de cotización
                      con membrete, partidas y totales.
                    </p>
                  </div>
                  <div
                    className="no-print"
                    style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                  >
                    <Boton
                      variante="fantasma"
                      onClick={() =>
                        imprimirDocumento(
                          `Cotización ${detalle.num_cotizacion}`,
                          htmlCotizacion(detalle, detalleItems),
                          ESTILOS_COTIZACION,
                        )
                      }
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Printer size={15} /> Imprimir / PDF
                      </span>
                    </Boton>
                    <Boton
                      variante="fantasma"
                      onClick={() => void exportarExcel()}
                      disabled={generandoExcel}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <FileSpreadsheet size={15} />{" "}
                        {generandoExcel ? "Generando…" : "Generar Excel"}
                      </span>
                    </Boton>
                  </div>
                </div>

                <div className="g-hoja-wrap">
                  <div className="g-hoja-oficial">
                    <style>{ESTILOS_COTIZACION}</style>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: htmlCotizacion(detalle, detalleItems),
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="g-tarjeta">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <h2 className="g-titulo" style={{ marginBottom: 4 }}>
                      {detalle.num_cotizacion}
                    </h2>
                    <p className="g-descripcion">
                      {detalle.cliente?.nombre_razon_social || "—"} ·{" "}
                      {detalle.cliente?.num_documento} ·{" "}
                      {formatoFecha(detalle.fecha_emision)} · origen{" "}
                      {detalle.origen}
                    </p>
                    {(() => {
                      const meta = extraerMetaNotas(detalle.notas);
                      const asu = (detalle.asunto || meta.asunto || "").trim();
                      const fp = (
                        detalle.forma_pago ||
                        meta.forma_pago ||
                        "Contado"
                      ).trim();
                      return (
                        <p className="g-descripcion" style={{ marginTop: 4 }}>
                          <strong>Asunto:</strong> {asu || "—"} &nbsp;·&nbsp;{" "}
                          <strong>Forma de pago:</strong> {fp}
                        </p>
                      );
                    })()}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Badge valor={detalle.estado} />
                    <div style={{ marginTop: 8 }}>
                      <label className="g-descripcion" style={{ fontSize: 11 }}>
                        Cambiar estado
                      </label>
                      <select
                        className="g-select"
                        value={detalle.estado}
                        disabled={!puedeEscribir}
                        onChange={(e) =>
                          void cambiarEstado(e.target.value as EstadoCotizacion)
                        }
                      >
                        {ESTADOS.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
                    </div>
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
                      {detalleItems.map((d) => (
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
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>Subtotal</span>
                      <span>{formatoSoles(detalle.subtotal)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
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

                {detalle.notas && (
                  <p className="g-descripcion" style={{ marginTop: 14 }}>
                    Notas: {detalle.notas}
                  </p>
                )}

                <div
                  className="no-print"
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 18,
                    flexWrap: "wrap",
                  }}
                >
                  <Boton
                    variante="fantasma"
                    onClick={() =>
                      imprimirDocumento(
                        `Cotización ${detalle.num_cotizacion}`,
                        htmlCotizacion(detalle, detalleItems),
                        ESTILOS_COTIZACION,
                      )
                    }
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Printer size={15} /> Imprimir / PDF
                    </span>
                  </Boton>
                  <Boton
                    variante="fantasma"
                    onClick={() => void exportarExcel()}
                    disabled={generandoExcel}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <FileSpreadsheet size={15} />{" "}
                      {generandoExcel ? "Generando…" : "Generar Excel"}
                    </span>
                  </Boton>
                  {puedeConvertir && detalle.estado === "aprobada" && (
                    <Boton
                      onClick={() => void convertir()}
                      disabled={convirtiendo}
                    >
                      {convirtiendo
                        ? "Convirtiendo…"
                        : "Convertir a orden de venta"}
                    </Boton>
                  )}
                  {puedeEscribir && (
                    <Boton
                      variante="peligro"
                      onClick={() =>
                        void eliminarCotizacion(
                          detalle.id,
                          detalle.num_cotizacion,
                          true,
                        )
                      }
                      disabled={eliminando}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Trash2 size={15} />{" "}
                        {eliminando ? "Eliminando…" : "Eliminar cotización"}
                      </span>
                    </Boton>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Pagina>
    );
  }

  // ---------------------------------------------------------------------------
  // Lista
  // ---------------------------------------------------------------------------
  return (
    <Pagina
      titulo="Cotizaciones"
      descripcion="El IGV y el total los recalcula la base (trigger). Aquí solo se muestran."
      acciones={
        puedeEscribir ? (
          <div
            style={{
              display: "inline-flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Boton variante="fantasma" onClick={abrirPersonalizada}>
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Sparkles size={15} style={{ color: "var(--accent-blue)" }} />{" "}
                Cotización personalizada
              </span>
            </Boton>
            <Boton onClick={abrirNuevo}>
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={15} /> Nueva cotización
              </span>
            </Boton>
          </div>
        ) : null
      }
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
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
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
                  <th>Origen</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.num_cotizacion}</td>
                    <td>{formatoFecha(c.fecha_emision)}</td>
                    <td>{c.cliente?.nombre_razon_social || "—"}</td>
                    <td>
                      <Badge valor={c.origen} />
                    </td>
                    <td>
                      <Badge valor={c.estado} />
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {formatoSoles(c.total)}
                    </td>
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <button
                          type="button"
                          className="g-btn g-btn-fantasma g-btn-mini"
                          onClick={() => irA(`cotizaciones/${c.id}`)}
                          title="Ver cotización"
                        >
                          Ver
                        </button>
                        {puedeEscribir && (
                          <button
                            type="button"
                            className="g-btn g-btn-peligro g-btn-mini"
                            onClick={() =>
                              void eliminarCotizacion(c.id, c.num_cotizacion)
                            }
                            title="Eliminar cotización"
                            aria-label={`Eliminar cotización ${c.num_cotizacion}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {abierto && (
        <Modal titulo="Nueva cotización" onCerrar={() => setAbierto(false)}>
          <Aviso tipo="error">{formError}</Aviso>
          <div className="g-grid-2">
            <Campo label="Cliente">
              {clienteSeleccionado ? (
                <div className="g-seleccion-chip">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      overflow: "hidden",
                    }}
                  >
                    <span className="g-badge g-badge-azul">
                      {clienteSeleccionado.num_documento}
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {clienteSeleccionado.nombre_razon_social}{" "}
                      {clienteSeleccionado.apellidos || ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="g-btn g-btn-fantasma g-btn-mini"
                    onClick={() => {
                      setIdCliente("");
                      setBusquedaCliente("");
                    }}
                    title="Cambiar cliente"
                  >
                    <X size={13} /> Cambiar
                  </button>
                </div>
              ) : (
                <div style={{ position: "relative", width: "100%" }}>
                  <div style={{ position: "relative", width: "100%" }}>
                    <input
                      className="g-input"
                      type="text"
                      placeholder="Buscar por DNI/RUC, nombre o apellido..."
                      style={{ paddingRight: 32 }}
                      value={busquedaCliente}
                      onChange={(e) => {
                        setBusquedaCliente(e.target.value);
                        setDropdownClienteAbierto(true);
                      }}
                      onFocus={() => setDropdownClienteAbierto(true)}
                    />
                    <Search
                      size={15}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-muted)",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                  {dropdownClienteAbierto && (
                    <div className="g-buscador-dropdown">
                      {clientesFiltrados.length === 0 ? (
                        <div className="g-buscador-vacio">
                          No se encontró ningún cliente con ese criterio.
                        </div>
                      ) : (
                        clientesFiltrados.map((c) => (
                          <div
                            key={c.id}
                            className="g-buscador-item"
                            onMouseDown={() => {
                              setIdCliente(String(c.id));
                              setBusquedaCliente("");
                              setDropdownClienteAbierto(false);
                            }}
                          >
                            <div>
                              <div className="g-buscador-item-titulo">
                                {c.nombre_razon_social} {c.apellidos || ""}
                              </div>
                              <div className="g-buscador-item-sub">
                                Documento: <strong>{c.num_documento}</strong>
                              </div>
                            </div>
                            <span
                              className="g-badge g-badge-azul"
                              style={{ fontSize: 10 }}
                            >
                              Seleccionar
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </Campo>
            <Campo label="Origen">
              <select
                className="g-select"
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
              >
                <option value="interno">Interno</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </Campo>
          </div>

          <div className="g-grid-2">
            <Campo label="Asunto de la cotización">
              <input
                className="g-input"
                type="text"
                placeholder="Ej. Suministro e instalación de pozo a tierra"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
              />
            </Campo>
            <Campo label="Forma de pago">
              <input
                className="g-input"
                type="text"
                list="formas-pago-sugerencias"
                placeholder="Contado"
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value)}
              />
              <datalist id="formas-pago-sugerencias">
                <option value="Contado" />
                <option value="Crédito" />
                <option value="Crédito 15 días" />
                <option value="Crédito 30 días" />
                <option value="50% adelanto, 50% contra entrega" />
                <option value="Contra entrega" />
              </datalist>
              <div className="g-chips">
                {[
                  "Contado",
                  "Crédito 15 días",
                  "Crédito 30 días",
                  "50% adelanto, 50% contra entrega",
                ].map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={`g-chip ${formaPago === opt ? "g-chip-activo" : ""}`}
                    onClick={() => setFormaPago(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </Campo>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <label
              className="g-campo-label"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              Ítems de la cotización
            </label>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Lock size={11} /> Precios oficiales de catálogo (fijos, no
              modificables aquí)
            </span>
          </div>

          {/* Encabezados de columnas de partidas */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 76px 125px 36px",
              gap: 8,
              marginBottom: 6,
              padding: "0 2px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            <div>Producto o servicio</div>
            <div>Cant.</div>
            <div style={{ textAlign: "right", paddingRight: 6 }}>
              P. Unitario
            </div>
            <div style={{ textAlign: "center" }}>Quitar</div>
          </div>

          {items.map((it, idx) => {
            const prodSeleccionado = productos.find(
              (x) => String(x.id) === it.id_producto,
            );
            const qProd = (it.busqueda || "").toLowerCase().trim();
            const prodsFiltrados = productos
              .filter((p) => {
                if (!qProd) return true;
                return (
                  String(p.id) === qProd ||
                  String(p.id).includes(qProd) ||
                  (p.codigo && p.codigo.toLowerCase().includes(qProd)) ||
                  p.nombre.toLowerCase().includes(qProd)
                );
              })
              .slice(0, 8);

            return (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 76px 125px 36px",
                  gap: 8,
                  marginBottom: 8,
                  alignItems: "center",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                {prodSeleccionado ? (
                  <div
                    className="g-seleccion-chip"
                    style={{ height: 42, padding: "0 10px" }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={prodSeleccionado.nombre}
                    >
                      <span
                        className="g-badge g-badge-morado"
                        style={{ marginRight: 6, fontSize: 10 }}
                      >
                        ID {prodSeleccionado.id}
                      </span>
                      {prodSeleccionado.nombre}{" "}
                      {prodSeleccionado.codigo
                        ? `(${prodSeleccionado.codigo})`
                        : ""}
                    </span>
                    <button
                      type="button"
                      className="g-btn g-btn-fantasma g-btn-mini"
                      onClick={() => setItem(idx, "id_producto", "")}
                      title="Cambiar producto"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div
                    style={{ position: "relative", width: "100%", minWidth: 0 }}
                  >
                    <div style={{ position: "relative", width: "100%" }}>
                      <input
                        className="g-input"
                        type="text"
                        placeholder="Buscar por ID, código o nombre..."
                        style={{ paddingRight: 32 }}
                        value={it.busqueda || ""}
                        onChange={(e) => {
                          setItem(idx, "busqueda", e.target.value);
                          setItem(idx, "mostrarDropdown", true);
                        }}
                        onFocus={() => setItem(idx, "mostrarDropdown", true)}
                      />
                      <Search
                        size={14}
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--text-muted)",
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                    {it.mostrarDropdown && (
                      <div className="g-buscador-dropdown">
                        {prodsFiltrados.length === 0 ? (
                          <div className="g-buscador-vacio">
                            No hay productos que coincidan.
                          </div>
                        ) : (
                          prodsFiltrados.map((p) => (
                            <div
                              key={p.id}
                              className="g-buscador-item"
                              onMouseDown={() => {
                                setItem(idx, "id_producto", String(p.id));
                              }}
                            >
                              <div>
                                <div className="g-buscador-item-titulo">
                                  <span
                                    className="g-badge g-badge-morado"
                                    style={{ marginRight: 6, fontSize: 10 }}
                                  >
                                    ID {p.id}
                                  </span>
                                  {p.nombre}
                                </div>
                                <div className="g-buscador-item-sub">
                                  {p.codigo ? `Cód: ${p.codigo} · ` : ""}
                                  {p.unidad_medida || "UND"} · {p.tipo}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: "var(--accent-blue)",
                                    fontSize: 12,
                                  }}
                                >
                                  {formatoSoles(p.precio_unitario)}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Cantidad */}
                <input
                  className="g-input"
                  type="number"
                  min={1}
                  value={it.cantidad}
                  onChange={(e) => setItem(idx, "cantidad", e.target.value)}
                  style={{ textAlign: "center", padding: "0 4px" }}
                  title="Cantidad de unidades"
                />

                {/* Precio unitario (Fijo del catálogo oficial, NO editable) */}
                <div
                  style={{ position: "relative", width: "100%", minWidth: 0 }}
                >
                  <input
                    className="g-input"
                    type="text"
                    readOnly
                    value={
                      it.precio_unitario
                        ? formatoSoles(Number(it.precio_unitario))
                        : "S/ 0.00"
                    }
                    style={{
                      background: "var(--bg-tertiary)",
                      cursor: "not-allowed",
                      fontWeight: 600,
                      textAlign: "right",
                      paddingRight: 22,
                      paddingLeft: 6,
                      fontSize: 12.5,
                      color: "var(--text-primary)",
                    }}
                    title="Precio oficial del catálogo. Solo editable en el panel de Productos."
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Lock size={11} />
                  </span>
                </div>

                {/* Botón quitar */}
                <button
                  type="button"
                  className="g-btn g-btn-peligro g-btn-mini"
                  style={{
                    padding: 0,
                    width: 36,
                    height: 42,
                    justifyContent: "center",
                  }}
                  onClick={() => {
                    if (items.length > 1) {
                      setItems((prev) => prev.filter((_, i) => i !== idx));
                    } else {
                      setItems([{ ...ITEM_VACIO }]);
                    }
                  }}
                  title="Quitar ítem"
                  aria-label="Quitar partida"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              margin: "8px 0 14px",
            }}
          >
            <button
              type="button"
              className="g-btn g-btn-fantasma g-btn-mini"
              onClick={() => setItems((p) => [...p, { ...ITEM_VACIO }])}
            >
              <Plus size={13} /> Agregar ítem
            </button>
            {items.length > 1 && (
              <button
                type="button"
                className="g-btn g-btn-fantasma g-btn-mini"
                style={{
                  color: "var(--accent-red)",
                  borderColor: "rgba(239, 68, 68, 0.3)",
                }}
                onClick={() => setItems([{ ...ITEM_VACIO }])}
              >
                <Trash2 size={12} /> Limpiar partidas
              </button>
            )}
          </div>

          <Campo label="Notas">
            <textarea
              className="g-textarea"
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </Campo>

          <div className="g-resumen-caja">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              <span>Subtotal estimado:</span>
              <span style={{ fontWeight: 600 }}>
                {formatoSoles(totalLocal)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              <span>IGV estimado (18%):</span>
              <span style={{ fontWeight: 600 }}>
                {formatoSoles(totalLocal * 0.18)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--accent-blue)",
                borderTop: "1px solid var(--border-color)",
                paddingTop: 6,
                marginTop: 4,
              }}
            >
              <span>Total estimado:</span>
              <span>{formatoSoles(totalLocal * 1.18)}</span>
            </div>
            <p className="g-descripcion" style={{ fontSize: 11, marginTop: 6 }}>
              {items.filter((i) => i.id_producto).length}{" "}
              {items.filter((i) => i.id_producto).length === 1
                ? "partida agregada"
                : "partidas agregadas"}{" "}
              · El servidor recalcula los totales finales con precisión oficial.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
            }}
          >
            <button
              type="button"
              className="g-btn g-btn-fantasma g-btn-mini"
              style={{ color: "var(--text-muted)" }}
              onClick={() => {
                if (
                  window.confirm(
                    "¿Deseas restablecer todos los campos del formulario de cotización?",
                  )
                ) {
                  abrirNuevo();
                }
              }}
              title="Limpiar todo el formulario"
            >
              <Trash2 size={12} /> Limpiar formulario
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <Boton variante="fantasma" onClick={() => setAbierto(false)}>
                Cancelar
              </Boton>
              <Boton onClick={() => void guardar()} disabled={guardando}>
                {guardando ? "Guardando…" : "Crear cotización"}
              </Boton>
            </div>
          </div>
        </Modal>
      )}

      {abiertoPersonalizada && (
        <Modal
          titulo="Nueva cotización personalizada"
          onCerrar={() => setAbiertoPersonalizada(false)}
        >
          <Aviso tipo="error">{formError}</Aviso>

          <div
            className="g-tarjeta"
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              background: "rgba(59, 130, 246, 0.08)",
              borderColor: "rgba(59, 130, 246, 0.25)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: "var(--text-secondary)",
              }}
            >
              <Sparkles
                size={13}
                style={{
                  display: "inline",
                  marginRight: 6,
                  color: "var(--accent-blue)",
                  verticalAlign: "text-bottom",
                }}
              />
              <strong>Cotización a medida:</strong> Ingresa libremente el nombre
              del producto o servicio (ej. trabajos por piso, locales o
              proyectos específicos), su unidad de medida y precio sin necesidad
              de que esté registrado en el catálogo oficial.
            </p>
          </div>

          <Campo label="Cliente">
            {clienteSeleccionado ? (
              <div className="g-seleccion-chip">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    overflow: "hidden",
                  }}
                >
                  <span className="g-badge g-badge-azul">
                    {clienteSeleccionado.num_documento}
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {clienteSeleccionado.nombre_razon_social}{" "}
                    {clienteSeleccionado.apellidos || ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="g-btn g-btn-fantasma g-btn-mini"
                  onClick={() => {
                    setIdCliente("");
                    setBusquedaCliente("");
                  }}
                  title="Cambiar cliente"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <div style={{ position: "relative" }}>
                  <input
                    className="g-input"
                    type="text"
                    placeholder="Buscar por DNI/RUC o nombre..."
                    value={busquedaCliente}
                    onChange={(e) => {
                      setBusquedaCliente(e.target.value);
                      setDropdownClienteAbierto(true);
                    }}
                    onFocus={() => setDropdownClienteAbierto(true)}
                    style={{ paddingRight: 32 }}
                  />
                  <Search
                    size={14}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                      pointerEvents: "none",
                    }}
                  />
                </div>
                {dropdownClienteAbierto && (
                  <div className="g-buscador-dropdown">
                    {clientesFiltrados.length === 0 ? (
                      <div className="g-buscador-vacio">
                        No hay clientes con ese documento o nombre.
                      </div>
                    ) : (
                      clientesFiltrados.map((c) => (
                        <div
                          key={c.id}
                          className="g-buscador-item"
                          onMouseDown={() => {
                            setIdCliente(String(c.id));
                            setBusquedaCliente("");
                            setDropdownClienteAbierto(false);
                          }}
                        >
                          <div>
                            <div className="g-buscador-item-titulo">
                              {c.nombre_razon_social} {c.apellidos || ""}
                            </div>
                            <div className="g-buscador-item-sub">
                              Doc: {c.num_documento}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </Campo>

          <div className="g-grid-2">
            <Campo label="Origen">
              <select
                className="g-select"
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
              >
                <option value="interno">Interno (Gestión comercial)</option>
                <option value="visita_tecnica">Visita técnica / Campo</option>
                <option value="whatsapp">WhatsApp / Teléfono</option>
                <option value="web">Solicitud web</option>
              </select>
            </Campo>

            {categorias.length > 0 && (
              <Campo label="Categoría de catálogo">
                <select
                  className="g-select"
                  value={idCategoriaPersonalizada}
                  onChange={(e) => setIdCategoriaPersonalizada(e.target.value)}
                >
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>

          <div className="g-grid-2">
            <Campo label="Asunto o referencia">
              <input
                className="g-input"
                placeholder="Ej: Instalación eléctrica en Piso 1 - Local Miraflores"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
              />
            </Campo>
            <Campo label="Forma de pago">
              <select
                className="g-select"
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value)}
              >
                <option value="Contado">Contado</option>
                <option value="Crédito 15 días">Crédito 15 días</option>
                <option value="Crédito 30 días">Crédito 30 días</option>
                <option value="50% adelanto, 50% contraentrega">
                  50% adelanto, 50% contraentrega
                </option>
              </select>
            </Campo>
          </div>

          <div style={{ marginTop: 12 }}>
            <label
              className="g-label"
              style={{ marginBottom: 6, display: "block" }}
            >
              Productos / Partidas personalizadas
            </label>

            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 640 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(200px, 2fr) 95px 105px 75px 110px 95px 36px",
                    gap: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 6,
                    padding: "0 4px",
                  }}
                >
                  <span>Descripción / Nombre</span>
                  <span>Tipo</span>
                  <span>Unidad</span>
                  <span style={{ textAlign: "center" }}>Cant.</span>
                  <span style={{ textAlign: "right" }}>P. Unit. (S/)</span>
                  <span style={{ textAlign: "right" }}>Subtotal</span>
                  <span></span>
                </div>

                {itemsManuales.map((it, idx) => {
                  const subtotalFila =
                    (Number(it.cantidad) || 0) *
                    (Number(it.precio_unitario) || 0);
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(200px, 2fr) 95px 105px 75px 110px 95px 36px",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      {/* Nombre / Descripción */}
                      <input
                        className="g-input"
                        type="text"
                        placeholder="Ej: Cableado y puntos de red piso 1..."
                        value={it.nombre}
                        onChange={(e) =>
                          setItemManual(idx, "nombre", e.target.value)
                        }
                        style={{ fontSize: 13 }}
                      />

                      {/* Tipo */}
                      <select
                        className="g-select"
                        value={it.tipo}
                        onChange={(e) =>
                          setItemManual(idx, "tipo", e.target.value)
                        }
                        style={{ fontSize: 12, padding: "0 6px" }}
                      >
                        <option value="servicio">Servicio</option>
                        <option value="producto">Producto</option>
                      </select>

                      {/* Unidad de medida */}
                      <select
                        className="g-select"
                        value={it.unidad_medida}
                        onChange={(e) =>
                          setItemManual(idx, "unidad_medida", e.target.value)
                        }
                        style={{ fontSize: 12, padding: "0 6px" }}
                      >
                        {UNIDADES_MEDIDA.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>

                      {/* Cantidad */}
                      <input
                        className="g-input"
                        type="number"
                        min={1}
                        value={it.cantidad}
                        onChange={(e) =>
                          setItemManual(idx, "cantidad", e.target.value)
                        }
                        style={{
                          textAlign: "center",
                          padding: "0 4px",
                          fontSize: 13,
                        }}
                        title="Cantidad"
                      />

                      {/* Precio unitario */}
                      <input
                        className="g-input"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={it.precio_unitario}
                        onChange={(e) =>
                          setItemManual(idx, "precio_unitario", e.target.value)
                        }
                        style={{
                          textAlign: "right",
                          padding: "0 8px",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                        title="Precio unitario en soles sin IGV"
                      />

                      {/* Subtotal */}
                      <div
                        style={{
                          textAlign: "right",
                          fontWeight: 600,
                          fontSize: 12.5,
                          color: "var(--text-primary)",
                          paddingRight: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatoSoles(subtotalFila)}
                      </div>

                      {/* Botón quitar */}
                      <button
                        type="button"
                        className="g-btn g-btn-peligro g-btn-mini"
                        style={{
                          padding: 0,
                          width: 36,
                          height: 40,
                          justifyContent: "center",
                        }}
                        onClick={() => {
                          if (itemsManuales.length > 1) {
                            setItemsManuales((prev) =>
                              prev.filter((_, i) => i !== idx),
                            );
                          } else {
                            setItemsManuales([{ ...ITEM_MANUAL_VACIO }]);
                          }
                        }}
                        title="Quitar ítem"
                        aria-label="Quitar partida"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                margin: "8px 0 14px",
              }}
            >
              <button
                type="button"
                className="g-btn g-btn-fantasma g-btn-mini"
                onClick={() =>
                  setItemsManuales((p) => [...p, { ...ITEM_MANUAL_VACIO }])
                }
              >
                <Plus size={13} /> Agregar ítem
              </button>
              {itemsManuales.length > 1 && (
                <button
                  type="button"
                  className="g-btn g-btn-fantasma g-btn-mini"
                  style={{
                    color: "var(--accent-red)",
                    borderColor: "rgba(239, 68, 68, 0.3)",
                  }}
                  onClick={() => setItemsManuales([{ ...ITEM_MANUAL_VACIO }])}
                >
                  <Trash2 size={12} /> Limpiar partidas
                </button>
              )}
            </div>
          </div>

          <Campo label="Notas o condiciones comerciales">
            <textarea
              className="g-textarea"
              rows={2}
              placeholder="Ej: Validez de la oferta 15 días calendario. Incluye instalación y pruebas..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </Campo>

          <div className="g-resumen-caja">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              <span>Subtotal estimado:</span>
              <span style={{ fontWeight: 600 }}>
                {formatoSoles(totalLocalManual)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              <span>IGV estimado (18%):</span>
              <span style={{ fontWeight: 600 }}>
                {formatoSoles(totalLocalManual * 0.18)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--accent-blue)",
                borderTop: "1px solid var(--border-color)",
                paddingTop: 6,
                marginTop: 4,
              }}
            >
              <span>Total estimado:</span>
              <span>{formatoSoles(totalLocalManual * 1.18)}</span>
            </div>
            <p className="g-descripcion" style={{ fontSize: 11, marginTop: 6 }}>
              {itemsManuales.filter((i) => i.nombre.trim()).length}{" "}
              {itemsManuales.filter((i) => i.nombre.trim()).length === 1
                ? "partida personalizada"
                : "partidas personalizadas"}{" "}
              · El servidor recalcula los totales finales con precisión oficial.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
            }}
          >
            <button
              type="button"
              className="g-btn g-btn-fantasma g-btn-mini"
              style={{ color: "var(--text-muted)" }}
              onClick={() => {
                if (
                  window.confirm(
                    "¿Deseas restablecer todos los campos del formulario personalizado?",
                  )
                ) {
                  abrirPersonalizada();
                }
              }}
              title="Limpiar todo el formulario"
            >
              <Trash2 size={12} /> Limpiar formulario
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <Boton
                variante="fantasma"
                onClick={() => setAbiertoPersonalizada(false)}
              >
                Cancelar
              </Boton>
              <Boton
                onClick={() => void guardarPersonalizada()}
                disabled={guardando}
              >
                {guardando ? "Guardando…" : "Crear cotización personalizada"}
              </Boton>
            </div>
          </div>
        </Modal>
      )}
    </Pagina>
  );
}
