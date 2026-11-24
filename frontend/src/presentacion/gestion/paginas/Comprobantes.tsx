import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Mail,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import {
  supabase,
  formatoFecha,
  formatoSoles,
  mensajeErrorBD,
  type Comprobante,
  type DetalleItem,
  type Venta,
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
import { auditoriaFiscal } from "../../../externos/ia";
import {
  proveedorFacturacion,
  construirCadenaQrSunat,
  type TipoComprobanteSunat,
  ComprobanteFactory,
} from "../../../externos/facturacion";
import { EMPRESA } from "../../../negocio/empresa";
import {
  generarComprobanteExcel,
  type ClienteDoc,
  type ItemDocumento,
} from "../../../externos/excel/documentos";
import { imprimirDocumento } from "../imprimir";
import { numeroALetras } from "../../../negocio/texto";

const ESTADOS = ["borrador", "verificado", "emitido", "anulado"] as const;

type VentaConClienteExt = Omit<Venta, "cliente"> & {
  cliente?: {
    id: number;
    nombre_razon_social: string;
    num_documento: string;
    direccion?: string | null;
    telefono?: string | null;
    correo?: string | null;
    tipo_documento?: { codigo_sunat: string; descripcion?: string } | null;
  } | null;
};

type ComprobanteExtendido = Comprobante & {
  venta?: {
    id: number;
    num_venta: string;
    total: number;
    estado: string;
    id_cliente: number;
  } | null;
};

export function Comprobantes() {
  const { puede } = useAuthGestion();
  const puedeOperar = puede("admin", "supervisor", "secretaria");
  const puedeEmitir = puede("admin", "supervisor");

  const [comprobantes, setComprobantes] = useState<ComprobanteExtendido[]>([]);
  const [ventas, setVentas] = useState<VentaConClienteExt[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [observacionesFiscales, setObservacionesFiscales] = useState<string[]>(
    [],
  );
  const [filtroEstado, setFiltroEstado] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalEnvioAbierto, setModalEnvioAbierto] = useState(false);
  const [envioComp, setEnvioComp] = useState<ComprobanteExtendido | null>(null);
  const [envioVenta, setEnvioVenta] = useState<VentaConClienteExt | null>(null);
  const [destinatarioCorreo, setDestinatarioCorreo] = useState("");
  const [asuntoCorreo, setAsuntoCorreo] = useState("");
  const [cuerpoCorreo, setCuerpoCorreo] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [guardandoCorreo, setGuardandoCorreo] = useState(false);

  const [idVentaSeleccionada, setIdVentaSeleccionada] = useState("");
  const [tipo, setTipo] = useState<TipoComprobanteSunat>("boleta");
  const [creando, setCreando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    let consulta = supabase
      .from("comprobantes")
      .select("*, venta:id_venta(id,num_venta,total,estado,id_cliente)")
      .order("id", { ascending: false })
      .limit(200);

    if (filtroEstado) {
      consulta = consulta.eq("estado", filtroEstado);
    }

    const [compRes, ventasRes] = await Promise.all([
      consulta,
      supabase
        .from("ventas")
        .select(
          `
          id, num_venta, total, subtotal, igv, estado, id_cliente,
          cliente:id_cliente(id, nombre_razon_social, num_documento, direccion, correo, telefono, tipo_documento:id_tipo_documento(codigo_sunat, descripcion))
        `,
        )
        .neq("estado", "anulada")
        .order("fecha", { ascending: false }),
    ]);

    if (compRes.error) setError(mensajeErrorBD(compRes.error));
    setComprobantes((compRes.data as ComprobanteExtendido[]) || []);
    setVentas((ventasRes.data as unknown as VentaConClienteExt[]) || []);
    setCargando(false);
  }, [filtroEstado]);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  // Las ventas disponibles no deben incluir ventas con comprobantes vigentes (sí permite si está anulado o eliminado)
  const ventasDisponibles = useMemo(() => {
    const ventasConComp = new Set(
      comprobantes.filter((c) => c.estado !== "anulado").map((c) => c.id_venta),
    );
    return ventas.filter((v) => !ventasConComp.has(v.id));
  }, [ventas, comprobantes]);

  const ventaSeleccionada = useMemo(() => {
    return ventas.find((v) => String(v.id) === idVentaSeleccionada);
  }, [ventas, idVentaSeleccionada]);

  const abrirNuevo = () => {
    setIdVentaSeleccionada("");
    setTipo("boleta");
    setFormError(null);
    setModalAbierto(true);
  };

  const seleccionarVenta = (id: string) => {
    setIdVentaSeleccionada(id);
    setFormError(null);
    if (!id) return;

    const v = ventas.find((it) => String(it.id) === id);
    if (v?.cliente) {
      const cod = v.cliente.tipo_documento?.codigo_sunat;
      const num = (v.cliente.num_documento || "").replace(/\D/g, "");
      // Si el cliente tiene RUC (código 6 u 11 dígitos), SUNAT exige Factura
      if (cod === "6" || num.length === 11) {
        setTipo("factura");
      } else {
        setTipo("boleta");
      }
    }
  };

  const crearBorrador = async () => {
    setFormError(null);
    if (!idVentaSeleccionada) {
      setFormError("Selecciona una venta.");
      return;
    }

    if (ventaSeleccionada?.cliente) {
      const cod = ventaSeleccionada.cliente.tipo_documento?.codigo_sunat;
      const num = (ventaSeleccionada.cliente.num_documento || "").replace(
        /\D/g,
        "",
      );
      if (tipo === "boleta" && (cod === "6" || num.length === 11)) {
        setFormError(
          "El cliente seleccionado tiene RUC (empresa). Según normativa SUNAT debe emitirse Factura (F001). Cambia el tipo a Factura.",
        );
        return;
      }
      if (tipo === "factura" && cod !== "6" && num.length !== 11) {
        setFormError(
          "Para emitir Factura el cliente debe contar con RUC (11 dígitos). Si es persona natural con DNI, emite Boleta.",
        );
        return;
      }
    }

    setCreando(true);
    const { error: err } = await supabase.rpc("crear_comprobante", {
      p_id_venta: Number(idVentaSeleccionada),
      p_tipo: tipo,
    });
    setCreando(false);
    if (err) {
      setFormError(mensajeErrorBD(err));
      return;
    }
    setModalAbierto(false);
    await cargar();
  };

  const cambiarEstado = async (
    comp: ComprobanteExtendido,
    nuevoEstado: string,
  ) => {
    setError(null);
    setMensajeExito(null);

    if (nuevoEstado === "verificado" || nuevoEstado === "anulado") {
      setProcesandoId(comp.id);
      const { error: err } = await supabase
        .from("comprobantes")
        .update({ estado: nuevoEstado })
        .eq("id", comp.id);
      setProcesandoId(null);
      if (err) setError(mensajeErrorBD(err));
      else {
        setMensajeExito(
          `Comprobante ${comp.serie}-${comp.correlativo} marcado como ${nuevoEstado}.`,
        );
        await cargar();
      }
      return;
    }

    if (nuevoEstado === "emitido") {
      await emitir(comp);
    }
  };

  const anularComprobante = async (comp: ComprobanteExtendido) => {
    if (
      !window.confirm(
        `¿Anular el comprobante ${comp.serie}-${comp.correlativo}? Se cambiará su estado a anulado y la venta asociada quedará disponible para volver a emitir.`,
      )
    ) {
      return;
    }
    await cambiarEstado(comp, "anulado");
  };

  const eliminarComprobante = async (comp: ComprobanteExtendido) => {
    if (
      !window.confirm(
        `¿Eliminar definitivamente el comprobante ${comp.serie}-${comp.correlativo}? Esta acción lo borrará del sistema y liberará la venta asociada.`,
      )
    ) {
      return;
    }
    setError(null);
    setMensajeExito(null);
    setProcesandoId(comp.id);
    const { error: err } = await supabase
      .from("comprobantes")
      .delete()
      .eq("id", comp.id);
    setProcesandoId(null);
    if (err) {
      setError(mensajeErrorBD(err));
    } else {
      setMensajeExito(
        `Comprobante ${comp.serie}-${comp.correlativo} eliminado correctamente.`,
      );
      await cargar();
    }
  };

  const obtenerDatosComprobante = async (comp: ComprobanteExtendido) => {
    const [vRes, detRes] = await Promise.all([
      supabase
        .from("ventas")
        .select(
          `
          *,
          cliente:id_cliente(id, nombre_razon_social, num_documento, direccion, correo, telefono, tipo_documento:id_tipo_documento(codigo_sunat, descripcion))
        `,
        )
        .eq("id", comp.id_venta)
        .maybeSingle(),
      supabase
        .from("detalle_venta")
        .select(
          "*, producto:id_producto(id, nombre, codigo, tipo, unidad_medida)",
        )
        .eq("id_venta", comp.id_venta),
    ]);

    const venta = vRes.data as unknown as VentaConClienteExt;
    const items: ItemDocumento[] = (
      (detRes.data as unknown as DetalleItem[]) || []
    ).map((d) => ({
      cantidad: Number(d.cantidad || 0),
      precio_unitario: Number(d.precio_unitario || 0),
      subtotal: Number(d.subtotal || 0),
      producto: d.producto || undefined,
    }));

    return { venta, items };
  };

  const emitir = async (comp: ComprobanteExtendido) => {
    setError(null);
    setMensajeExito(null);
    setObservacionesFiscales([]);
    setProcesandoId(comp.id);

    try {
      const { venta, items } = await obtenerDatosComprobante(comp);

      const audit = await auditoriaFiscal({
        tipo_comprobante: comp.tipo as TipoComprobanteSunat,
        tipo_documento_cliente:
          venta?.cliente?.tipo_documento?.codigo_sunat || "",
        num_documento_cliente: venta?.cliente?.num_documento || "",
        nombre_cliente: venta?.cliente?.nombre_razon_social || "",
        subtotal: venta?.subtotal ?? 0,
        igv: venta?.igv ?? 0,
        total: venta?.total ?? 0,
      });
      setObservacionesFiscales(audit.observaciones);

      // [PATRÓN FACTORY METHOD]: Instanciación y cálculo tributario centralizado
      const comprobante = ComprobanteFactory.crear(comp.tipo as TipoComprobanteSunat, {
        serie: comp.serie,
        correlativo: comp.correlativo,
        num_venta: venta?.num_venta || "",
        fecha: new Date().toISOString(),
        emisor: { ruc: EMPRESA.ruc, razon_social: EMPRESA.razon_social },
        cliente: {
          tipo_documento: venta?.cliente?.tipo_documento?.codigo_sunat || "",
          num_documento: venta?.cliente?.num_documento || "",
          nombre: venta?.cliente?.nombre_razon_social || "",
          direccion: venta?.cliente?.direccion,
        },
        items: items.map((it) => ({
          descripcion: it.producto?.nombre || "Ítem",
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          subtotal: it.subtotal,
        })),
        subtotal: venta?.subtotal ?? 0,
        igv: venta?.igv ?? 0,
        total: venta?.total ?? 0,
      });

      const emision = await proveedorFacturacion().emitirComprobante(
        comprobante.aDatosComprobante()
      );

      const { error: updErr } = await supabase
        .from("comprobantes")
        .update({
          estado: "emitido",
          hash_cpe: emision.hash_cpe,
          pdf_url: emision.pdf_url,
          xml_url: emision.xml_url,
          respuesta_sunat: emision.crudo,
        })
        .eq("id", comp.id);

      if (updErr) throw updErr;

      setMensajeExito(`${emision.mensaje}`);
      await cargar();
    } catch (err) {
      setError(mensajeErrorBD(err));
    } finally {
      setProcesandoId(null);
    }
  };

  const descargarExcel = async (comp: ComprobanteExtendido) => {
    try {
      setError(null);
      setMensajeExito(
        `Generando Excel con código QR para ${comp.serie}-${comp.correlativo}...`,
      );
      const { venta, items } = await obtenerDatosComprobante(comp);

      await generarComprobanteExcel({
        comprobante: {
          serie: comp.serie,
          correlativo: comp.correlativo,
          tipo: comp.tipo,
          fecha: comp.emitido_en || venta?.fecha,
          hash_cpe: comp.hash_cpe,
        },
        venta: {
          num_venta: venta?.num_venta || "",
          fecha: venta?.fecha || new Date().toISOString(),
          subtotal: venta?.subtotal ?? 0,
          igv: venta?.igv ?? 0,
          total: venta?.total ?? 0,
          orden_compra_cliente: venta?.orden_compra_cliente,
        },
        cliente: venta?.cliente as unknown as ClienteDoc,
        items,
        archivo: `${comp.serie}-${String(comp.correlativo).padStart(8, "0")}`,
      });

      setMensajeExito(
        `Excel descargado con éxito: ${comp.serie}-${comp.correlativo}.xlsx`,
      );
    } catch (err) {
      setError(mensajeErrorBD(err));
    }
  };

  const imprimirComprobante = async (comp: ComprobanteExtendido) => {
    try {
      setError(null);
      const { venta, items } = await obtenerDatosComprobante(comp);
      const esFactura = comp.tipo === "factura" || comp.serie.startsWith("F");
      const tipoTitulo = esFactura
        ? "FACTURA ELECTRÓNICA"
        : "BOLETA DE VENTA ELECTRÓNICA";
      const hash = comp.hash_cpe || "MOCK";

      const cadenaSunat = construirCadenaQrSunat({
        rucEmisor: EMPRESA.ruc,
        tipo: comp.tipo,
        serie: comp.serie,
        correlativo: comp.correlativo,
        igv: venta?.igv ?? 0,
        total: venta?.total ?? 0,
        fecha: comp.emitido_en || venta?.fecha || new Date().toISOString(),
        tipoDocCliente:
          venta?.cliente?.tipo_documento?.codigo_sunat ||
          (esFactura ? "6" : "1"),
        numDocCliente: venta?.cliente?.num_documento,
        hash,
      });

      const QRCodeMod = await import("qrcode");
      const QRCode = QRCodeMod.default ?? QRCodeMod;
      const qrDataUrl = await QRCode.toDataURL(cadenaSunat, {
        errorCorrectionLevel: "Q",
        margin: 1,
      });

      const filasHtml = items
        .map(
          (it, idx) => `
        <tr>
          <td style="text-align:center; padding:6px; border-bottom:1px solid #e2e8f0;">${idx + 1}</td>
          <td style="text-align:center; padding:6px; border-bottom:1px solid #e2e8f0;">${it.cantidad}</td>
          <td style="text-align:center; padding:6px; border-bottom:1px solid #e2e8f0;">${it.producto?.unidad_medida || "NIU"}</td>
          <td style="padding:6px; border-bottom:1px solid #e2e8f0;">${it.producto?.nombre || "Ítem"}</td>
          <td style="text-align:right; padding:6px; border-bottom:1px solid #e2e8f0;">${formatoSoles(it.precio_unitario)}</td>
          <td style="text-align:right; padding:6px; border-bottom:1px solid #e2e8f0;">${formatoSoles(it.subtotal)}</td>
        </tr>
      `,
        )
        .join("");

      imprimirDocumento(
        `${tipoTitulo} ${comp.serie}-${comp.correlativo}`,
        `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
          <div>
            <h1 style="margin:0; font-size:18px; color:#0f172a;">${EMPRESA.razon_social}</h1>
            <div style="font-size:12px; color:#475569; margin-top:4px;">${EMPRESA.direccion}</div>
          </div>
          <div style="border:2px solid #0f172a; border-radius:6px; padding:12px 20px; text-align:center; min-width:230px;">
            <div style="font-size:13px; font-weight:bold;">R.U.C. ${EMPRESA.ruc}</div>
            <div style="font-size:14px; font-weight:bold; margin:6px 0; color:#0f172a;">${tipoTitulo}</div>
            <div style="font-size:14px; font-weight:bold; letter-spacing:1px;">N° ${comp.serie}-${String(comp.correlativo).padStart(8, "0")}</div>
          </div>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px; margin-bottom:16px; font-size:12px; line-height:1.6;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
            <div><strong>${esFactura ? "Señor(es):" : "Cliente:"}</strong> ${venta?.cliente?.nombre_razon_social || "—"}</div>
            <div><strong>${esFactura ? "RUC:" : "DNI:"}</strong> ${venta?.cliente?.num_documento || "—"}</div>
            <div><strong>Dirección:</strong> ${venta?.cliente?.direccion || "—"}</div>
            <div><strong>Fecha de emisión:</strong> ${formatoFecha(comp.emitido_en || venta?.fecha)}</div>
            <div><strong>Moneda:</strong> SOLES (S/)</div>
            <div><strong>Condición de pago:</strong> Contado</div>
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
          <thead>
            <tr style="background:#0f172a; color:#fff; font-size:11px;">
              <th style="padding:8px 6px; text-align:center; width:35px;">Ítem</th>
              <th style="padding:8px 6px; text-align:center; width:45px;">Cant.</th>
              <th style="padding:8px 6px; text-align:center; width:50px;">U.M</th>
              <th style="padding:8px 6px; text-align:left;">Descripción</th>
              <th style="padding:8px 6px; text-align:right; width:85px;">P. Unit.</th>
              <th style="padding:8px 6px; text-align:right; width:95px;">Importe</th>
            </tr>
          </thead>
          <tbody style="font-size:12px;">
            ${filasHtml}
          </tbody>
        </table>

        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-top:20px;">
          <div style="text-align:center;">
            <img src="${qrDataUrl}" alt="Código QR SUNAT" style="width:125px; height:125px; display:block; margin:0 auto;" />
            <div style="font-size:10px; color:#64748b; margin-top:4px;">Código QR SUNAT</div>
          </div>
          <div style="min-width:250px;">
            <div style="font-size:11px; margin-bottom:10px; color:#475569;">
              <strong>SON:</strong> ${numeroALetras(venta?.total ?? 0)}
            </div>
            <div style="border-top:1px solid #cbd5e1; padding-top:6px; font-size:12px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>Op. Gravada:</span>
                <strong>${formatoSoles(venta?.subtotal ?? 0)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>I.G.V. (18%):</span>
                <strong>${formatoSoles(venta?.igv ?? 0)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:14px; border-top:2px solid #0f172a; padding-top:4px; margin-top:4px;">
                <span>Total a Pagar:</span>
                <strong style="color:#0f172a;">${formatoSoles(venta?.total ?? 0)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div style="margin-top:24px; border-top:1px dashed #cbd5e1; padding-top:8px; font-size:10px; color:#64748b; text-align:center;">
          Representación impresa de la ${tipoTitulo}. Consulte su validez en www.sunat.gob.pe.<br/>
          Código Hash: <code>${hash}</code>
        </div>
        `,
      );
    } catch (err) {
      setError(mensajeErrorBD(err));
    }
  };

  const abrirModalEnvio = async (comp: ComprobanteExtendido) => {
    try {
      setProcesandoId(comp.id);
      setError(null);
      const { venta } = await obtenerDatosComprobante(comp);
      const cliente = venta?.cliente;
      const correo = (cliente?.correo || "").trim();
      const esFactura = comp.tipo === "factura" || comp.serie.startsWith("F");
      const tipoTitulo = esFactura
        ? "Factura Electrónica"
        : "Boleta de Venta Electrónica";
      const numeroCompleto = `${comp.serie}-${String(comp.correlativo).padStart(8, "0")}`;
      const totalSoles = formatoSoles(venta?.total ?? 0);
      const fecha = formatoFecha(
        comp.emitido_en || venta?.fecha || new Date().toISOString(),
      );

      const asunto = `${tipoTitulo} ${numeroCompleto} - ${EMPRESA.razon_social}`;
      const cuerpo = `Estimado(a) ${cliente?.nombre_razon_social || "Cliente"},

Le hacemos entrega de su comprobante de pago electrónico emitido por ${EMPRESA.razon_social}:

• Documento: ${tipoTitulo}
• Número: ${numeroCompleto}
• Fecha de emisión: ${fecha}
• Importe Total: ${totalSoles}

Adjuntamos su comprobante en formato digital.
Agradecemos su preferencia y confianza.

Atentamente,
${EMPRESA.razon_social}
R.U.C. ${EMPRESA.ruc}
${EMPRESA.direccion}`;

      setEnvioComp(comp);
      setEnvioVenta(venta);
      setDestinatarioCorreo(correo);
      setAsuntoCorreo(asunto);
      setCuerpoCorreo(cuerpo);
      setCopiado(false);
      setModalEnvioAbierto(true);
    } catch (err) {
      setError(mensajeErrorBD(err));
    } finally {
      setProcesandoId(null);
    }
  };

  const abrirGmail = () => {
    if (!destinatarioCorreo.trim()) {
      setError("Por favor ingresa un correo de destino para el cliente.");
      return;
    }
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(destinatarioCorreo.trim())}&su=${encodeURIComponent(asuntoCorreo)}&body=${encodeURIComponent(cuerpoCorreo)}`;
    window.open(url, "_blank");
  };

  const abrirMailto = () => {
    if (!destinatarioCorreo.trim()) {
      setError("Por favor ingresa un correo de destino para el cliente.");
      return;
    }
    window.location.href = `mailto:${encodeURIComponent(destinatarioCorreo.trim())}?subject=${encodeURIComponent(asuntoCorreo)}&body=${encodeURIComponent(cuerpoCorreo)}`;
  };

  const copiarMensaje = async () => {
    try {
      await navigator.clipboard.writeText(cuerpoCorreo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setError("No se pudo copiar el texto al portapapeles.");
    }
  };

  const guardarCorreoCliente = async () => {
    if (!envioVenta?.cliente?.id || !destinatarioCorreo.trim()) return;
    setGuardandoCorreo(true);
    try {
      const { error: err } = await supabase
        .from("clientes")
        .update({ correo: destinatarioCorreo.trim() })
        .eq("id", envioVenta.cliente.id);
      if (err) throw err;
      setMensajeExito(
        `Correo guardado para el cliente ${envioVenta.cliente.nombre_razon_social}.`,
      );
      await cargar();
    } catch (err) {
      setError(mensajeErrorBD(err));
    } finally {
      setGuardandoCorreo(false);
    }
  };

  return (
    <Pagina
      titulo="Comprobantes"
      descripcion="Boleta/factura desde una venta. La Secretaria crea el borrador; el Supervisor o el Gerente verifican y emiten (RN-08). La emisión ante SUNAT devuelve su PDF/XML oficial o se puede generar el Excel con QR oficial."
      acciones={
        puedeOperar ? (
          <Boton onClick={abrirNuevo}>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={15} /> Nuevo comprobante
            </span>
          </Boton>
        ) : null
      }
    >
      <Aviso tipo="error">{error}</Aviso>
      <Aviso tipo="info">{mensajeExito}</Aviso>
      {observacionesFiscales.length > 0 && (
        <Aviso tipo="info">
          <strong>
            Revisión fiscal previa (sugerencias, no bloquea la emisión):
          </strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {observacionesFiscales.map((obs, i) => (
              <li key={i}>{obs}</li>
            ))}
          </ul>
        </Aviso>
      )}

      <div className="g-tarjeta">
        <div style={{ marginBottom: 14 }}>
          <select
            className="g-select"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((est) => (
              <option key={est} value={est}>
                {est}
              </option>
            ))}
          </select>
        </div>

        {cargando ? (
          <Cargando />
        ) : comprobantes.length === 0 ? (
          <Vacio />
        ) : (
          <div className="g-tabla-wrap">
            <table className="g-tabla">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Venta</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Descargas / Impresión</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {comprobantes.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>
                      {c.serie}-{String(c.correlativo).padStart(5, "0")}
                    </td>
                    <td>{c.venta?.num_venta || "—"}</td>
                    <td>
                      <Badge valor={c.tipo} />
                    </td>
                    <td>
                      <Badge valor={c.estado} />
                    </td>
                    <td>{formatoSoles(c.venta?.total ?? 0)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {/* Botón Excel siempre disponible con plantilla y QR oficial */}
                      <button
                        className="g-btn g-btn-fantasma g-btn-mini"
                        onClick={() => void descargarExcel(c)}
                        title="Descargar comprobante en Excel con código QR"
                      >
                        <FileSpreadsheet size={13} /> Excel
                      </button>{" "}
                      {/* Impresión / PDF siempre disponible */}
                      <button
                        className="g-btn g-btn-fantasma g-btn-mini"
                        onClick={() => void imprimirComprobante(c)}
                        title="Ver representación impresa o guardar en PDF"
                      >
                        <Printer size={13} /> PDF
                      </button>{" "}
                      {/* Enviar comprobante al cliente por correo */}
                      <button
                        className="g-btn g-btn-fantasma g-btn-mini"
                        onClick={() => void abrirModalEnvio(c)}
                        title="Enviar comprobante al correo registrado del cliente"
                        style={{ color: "#0284c7" }}
                      >
                        <Mail size={13} /> Enviar al cliente
                      </button>{" "}
                      {/* Enlace al XML oficial si fue emitido */}
                      {c.xml_url && (
                        <a
                          className="g-btn g-btn-fantasma g-btn-mini"
                          href={c.xml_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          XML
                        </a>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {puedeEmitir && c.estado === "borrador" && (
                        <>
                          <button
                            className="g-btn g-btn-mini"
                            disabled={procesandoId === c.id}
                            onClick={() => void cambiarEstado(c, "verificado")}
                          >
                            Verificar
                          </button>{" "}
                        </>
                      )}
                      {puedeEmitir && c.estado === "verificado" && (
                        <>
                          <button
                            className="g-btn g-btn-exito g-btn-mini"
                            disabled={procesandoId === c.id}
                            onClick={() => void cambiarEstado(c, "emitido")}
                          >
                            {procesandoId === c.id ? "Emitiendo…" : "Emitir"}
                          </button>{" "}
                        </>
                      )}
                      {puedeEmitir && c.estado !== "anulado" && (
                        <>
                          <button
                            className="g-btn g-btn-peligro g-btn-mini"
                            disabled={procesandoId === c.id}
                            onClick={() => void anularComprobante(c)}
                            title="Anular comprobante"
                          >
                            Anular
                          </button>{" "}
                        </>
                      )}
                      {puedeEmitir && (
                        <button
                          className="g-btn g-btn-peligro g-btn-mini"
                          disabled={procesandoId === c.id}
                          onClick={() => void eliminarComprobante(c)}
                          title="Eliminar comprobante del sistema"
                          aria-label="Eliminar comprobante"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <Modal
          titulo="Nuevo comprobante"
          onCerrar={() => setModalAbierto(false)}
        >
          <Aviso tipo="error">{formError}</Aviso>
          <Campo label="Venta confirmada">
            <select
              className="g-select"
              value={idVentaSeleccionada}
              onChange={(e) => seleccionarVenta(e.target.value)}
            >
              <option value="">— seleccionar venta sin comprobante —</option>
              {ventasDisponibles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.num_venta} · {formatoSoles(v.total)}{" "}
                  {v.cliente ? `(${v.cliente.nombre_razon_social})` : ""}
                </option>
              ))}
            </select>
          </Campo>

          {ventaSeleccionada?.cliente && (
            <div
              style={{
                fontSize: 12,
                padding: "10px 12px",
                backgroundColor: "var(--bg-secundario, #f1f5f9)",
                borderRadius: 6,
                marginBottom: 14,
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <strong>Cliente:</strong>{" "}
                {ventaSeleccionada.cliente.nombre_razon_social}
              </div>
              <div>
                <strong>Documento:</strong>{" "}
                {ventaSeleccionada.cliente.tipo_documento?.codigo_sunat === "6"
                  ? "RUC"
                  : "DNI"}{" "}
                {ventaSeleccionada.cliente.num_documento}
              </div>
              {(ventaSeleccionada.cliente.tipo_documento?.codigo_sunat ===
                "6" ||
                (ventaSeleccionada.cliente.num_documento || "").length ===
                  11) &&
                tipo === "boleta" && (
                  <div
                    style={{ color: "#dc2626", marginTop: 4, fontWeight: 500 }}
                  >
                    ⚠️ Atención: El cliente tiene RUC. Según la normativa
                    tributaria de SUNAT debe emitirse Factura (F001).
                  </div>
                )}
            </div>
          )}

          <Campo label="Tipo de comprobante">
            <select
              className="g-select"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoComprobanteSunat)}
            >
              <option value="boleta">Boleta (B001)</option>
              <option value="factura">Factura (F001)</option>
            </select>
          </Campo>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 16,
            }}
          >
            <Boton variante="fantasma" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Boton>
            <Boton onClick={() => void crearBorrador()} disabled={creando}>
              {creando ? "Creando…" : "Crear borrador"}
            </Boton>
          </div>
        </Modal>
      )}

      {modalEnvioAbierto && envioComp && (
        <Modal
          titulo={`Enviar comprobante ${envioComp.serie}-${String(envioComp.correlativo).padStart(8, "0")} al cliente`}
          onCerrar={() => setModalEnvioAbierto(false)}
        >
          <div
            style={{
              fontSize: 13,
              color: "var(--muted, #64748b)",
              marginBottom: 12,
            }}
          >
            <strong>Cliente:</strong>{" "}
            {envioVenta?.cliente?.nombre_razon_social || "—"}
          </div>

          <Campo label="Correo del cliente">
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                className="g-input"
                placeholder="ejemplo@correo.com"
                value={destinatarioCorreo}
                onChange={(e) => setDestinatarioCorreo(e.target.value)}
                style={{ flex: 1 }}
              />
              {envioVenta?.cliente?.id &&
                destinatarioCorreo.trim() !==
                  (envioVenta.cliente.correo || "") && (
                  <button
                    type="button"
                    className="g-btn g-btn-fantasma g-btn-mini"
                    onClick={() => void guardarCorreoCliente()}
                    disabled={guardandoCorreo}
                    title="Guardar este correo en la ficha del cliente para futuros envíos"
                  >
                    {guardandoCorreo ? "Guardando…" : "Guardar en ficha"}
                  </button>
                )}
            </div>
            {!envioVenta?.cliente?.correo && (
              <div style={{ fontSize: 11, color: "#d97706", marginTop: 4 }}>
                ℹ️ El cliente no tenía un correo registrado. Puedes escribirlo
                aquí para enviárselo.
              </div>
            )}
          </Campo>

          <Campo label="Asunto del correo">
            <input
              type="text"
              className="g-input"
              value={asuntoCorreo}
              onChange={(e) => setAsuntoCorreo(e.target.value)}
            />
          </Campo>

          <Campo label="Mensaje">
            <textarea
              className="g-textarea"
              rows={8}
              value={cuerpoCorreo}
              onChange={(e) => setCuerpoCorreo(e.target.value)}
              style={{ fontSize: 12, lineHeight: 1.5, fontFamily: "inherit" }}
            />
          </Campo>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              padding: "10px 12px",
              backgroundColor: "var(--bg-secundario, #f8fafc)",
              borderRadius: 8,
              marginBottom: 16,
              border: "1px solid #e2e8f0",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--texto, #1e293b)",
              }}
            >
              Archivos del comprobante para adjuntar:
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="g-btn g-btn-fantasma g-btn-mini"
                onClick={() => void descargarExcel(envioComp)}
                title="Descargar Excel con QR oficial"
              >
                <FileSpreadsheet size={13} /> Descargar Excel
              </button>
              <button
                type="button"
                className="g-btn g-btn-fantasma g-btn-mini"
                onClick={() => void imprimirComprobante(envioComp)}
                title="Ver o guardar comprobante en PDF"
              >
                <Printer size={13} /> Guardar PDF
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 16,
            }}
          >
            <button
              type="button"
              className="g-btn g-btn-fantasma"
              onClick={() => void copiarMensaje()}
              title="Copiar texto para WhatsApp o cualquier otra app"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {copiado ? (
                <Check size={14} color="#16a34a" />
              ) : (
                <Copy size={14} />
              )}
              {copiado ? "¡Copiado!" : "Copiar mensaje"}
            </button>

            <div style={{ display: "flex", gap: 8 }}>
              <Boton
                variante="fantasma"
                onClick={() => setModalEnvioAbierto(false)}
              >
                Cerrar
              </Boton>
              <button
                type="button"
                className="g-btn g-btn-fantasma"
                onClick={abrirMailto}
                title="Abrir con Outlook, Thunderbird o la aplicación de correo de tu computadora"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Mail size={14} /> Outlook / Correo
              </button>
              <button
                type="button"
                className="g-btn g-btn-primario"
                onClick={abrirGmail}
                title="Abrir directamente en Gmail con todo listo para enviar"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <ExternalLink size={14} /> Enviar con Gmail
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Pagina>
  );
}
