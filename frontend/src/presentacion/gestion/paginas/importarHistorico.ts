import { supabase } from '../../../datos/supabase';

export interface ItemImportar {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  tipo: 'producto' | 'servicio';
}

export interface CotizacionImportar {
  archivo: string;
  fecha: string;
  cliente: {
    nombre: string;
    ruc: string;
    direccion: string;
  };
  asunto: string;
  subtotal: number;
  igv: number;
  total: number;
  convertir_a_venta: boolean;
  estado_venta: 'confirmada' | 'pendiente' | null;
  items: ItemImportar[];
}

export const DATOS_COTIZACIONES_HISTORICAS: CotizacionImportar[] = [
  {
    archivo: "COT 25 MERCOBUS SERTEVAL.xls",
    fecha: "2026-10-24T10:00:00Z",
    cliente: {
      nombre: "MERCOBUS S.A.C.",
      ruc: "20537348390",
      direccion: "AV. NICOLAS AYLLON 1580- SAN LUIS"
    },
    asunto: "SUMINISTRO E INSTALACION DE LUCES DE EMERGENCIA Y DETECTORES",
    subtotal: 680.0,
    igv: 122.4,
    total: 802.4,
    convertir_a_venta: true,
    estado_venta: "confirmada",
    items: [
      {
        codigo: "1.01",
        descripcion: "SUMINISTRO E INSTALACION DE LUZ DE EMERGENCIA PHILIPS EN TABLERO ELECTRICO",
        unidad: "unidad",
        cantidad: 1,
        precio_unitario: 220.0,
        subtotal: 220.0,
        tipo: "servicio"
      },
      {
        codigo: "1.02",
        descripcion: "SUMINISTRO E INSTALACION DE LUCES DE EMERGENCIA PHILIPS POR LUCES DAÑADAS",
        unidad: "unidad",
        cantidad: 2,
        precio_unitario: 130.0,
        subtotal: 260.0,
        tipo: "servicio"
      },
      {
        codigo: "1.03",
        descripcion: "SUMINISTRO E INSTALACION DE DETECTOR DE HUMO HAGROY O ACCERIS",
        unidad: "unidad",
        cantidad: 1,
        precio_unitario: 200.0,
        subtotal: 200.0,
        tipo: "servicio"
      }
    ]
  },
  {
    archivo: "COT 25 OFICINA 903 EL MIRADOR SAN ISIDRO.xls",
    fecha: "2026-10-27T11:30:00Z",
    cliente: {
      nombre: "EDIFICIO EL MIRADOR SAN ISIDRO",
      ruc: "20512847986",
      direccion: "OFICINA 903 - SAN ISIDRO, LIMA"
    },
    asunto: "COTIZACION DE INSTALACION DE DETECTORES DE HUMO SIMPLEX Y INSTALACIONES ELECTRICAS",
    subtotal: 4760.0,
    igv: 856.8,
    total: 5616.8,
    convertir_a_venta: true,
    estado_venta: "confirmada",
    items: [
      {
        codigo: "1.01",
        descripcion: "SUMINISTRO E INSTALACION DE DETECTORSES DE HUMO Y SENSOR DE TEMPERATURA DIRECCIONABLES SIMPLEX",
        unidad: "unid",
        cantidad: 4,
        precio_unitario: 460.0,
        subtotal: 1840.0,
        tipo: "servicio"
      },
      {
        codigo: "1.02",
        descripcion: "SUMINISTRO E INSTALACION DE 2 TOMAS HIDROBOX EN KITCHENNETE",
        unidad: "unid",
        cantidad: 2,
        precio_unitario: 60.0,
        subtotal: 120.0,
        tipo: "servicio"
      },
      {
        codigo: "1.03",
        descripcion: "SUMINISTRO E INSTALACION DE TOMAACORRIENTES CON LINEA DE TIERRA",
        unidad: "unid",
        cantidad: 11,
        precio_unitario: 30.0,
        subtotal: 330.0,
        tipo: "servicio"
      },
      {
        codigo: "1.04",
        descripcion: "SUMINISTRO E INSTALACION DE ENCHUFES S CON TIERRA",
        unidad: "unid",
        cantidad: 2,
        precio_unitario: 20.0,
        subtotal: 40.0,
        tipo: "servicio"
      },
      {
        codigo: "1.05",
        descripcion: "SUMINISTRO E INSTALACION DE LUCES DE EMERGENCIA PHILIPS, INCLUYE CABLEADO Y TUBERIA CONDUIT",
        unidad: "unid",
        cantidad: 5,
        precio_unitario: 230.0,
        subtotal: 1150.0,
        tipo: "servicio"
      },
      {
        codigo: "1.06",
        descripcion: "SUMINISTRO E INSTALACION DE 4 LLAVES TERMOMAGNETICAS Y PEINADO DE TABLERO",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 800.0,
        subtotal: 800.0,
        tipo: "servicio"
      },
      {
        codigo: "1.07",
        descripcion: "SUMINISTRO E INSTALACION DE LINEA DE TIERRA A RACK DE TELEVISION",
        unidad: "unid",
        cantidad: 1,
        precio_unitario: 80.0,
        subtotal: 80.0,
        tipo: "servicio"
      },
      {
        codigo: "1.08",
        descripcion: "PROGRAMACION DE PANEL DE ALARMAS Y EMISION DE CERTIFICADO",
        unidad: "unid",
        cantidad: 1,
        precio_unitario: 400.0,
        subtotal: 400.0,
        tipo: "servicio"
      }
    ]
  },
  {
    archivo: "cot 25- 610 SERTEVAL FOTOBEAM UL.xls",
    fecha: "2026-10-31T09:15:00Z",
    cliente: {
      nombre: "SERTEVAL E.I.R.L.",
      ruc: "20108539403",
      direccion: "JR. JOSE A. MORALES 1037 - SAN JUAN DE MIRAFLORES"
    },
    asunto: "SUMINISTRO E INSTALACION DE SACI CON SISTEMA FOTOBEAM",
    subtotal: 4830.0,
    igv: 869.4,
    total: 5699.4,
    convertir_a_venta: false,
    estado_venta: null,
    items: [
      {
        codigo: "1.01",
        descripcion: "PANEL DE ALARMAS CONVENCIONAL 5 ZONAS 2 HILOS 2 NACS EDWARDS",
        unidad: "unid",
        cantidad: 1,
        precio_unitario: 1400.0,
        subtotal: 1400.0,
        tipo: "producto"
      },
      {
        codigo: "1.02",
        descripcion: "BATERIAS 12V 7AH PARA PANEL",
        unidad: "unid",
        cantidad: 2,
        precio_unitario: 90.0,
        subtotal: 180.0,
        tipo: "producto"
      },
      {
        codigo: "1.03",
        descripcion: "FOTOBEAM CON ESPEJO HASTA 100 METROS 24V CONVENCIONAL",
        unidad: "unid",
        cantidad: 1,
        precio_unitario: 1400.0,
        subtotal: 1400.0,
        tipo: "producto"
      },
      {
        codigo: "1.04",
        descripcion: "SIRENA ESTROBOSCOPICA UL",
        unidad: "unid",
        cantidad: 2,
        precio_unitario: 250.0,
        subtotal: 500.0,
        tipo: "producto"
      },
      {
        codigo: "1.05",
        descripcion: "ESTACION MANUAL DE DOBLE ACCION CONVENCIONAL UL",
        unidad: "unid",
        cantidad: 2,
        precio_unitario: 200.0,
        subtotal: 400.0,
        tipo: "producto"
      },
      {
        codigo: "1.06",
        descripcion: "TUBERIA CONDUIT EMT 3/4 METALICA",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 500.0,
        subtotal: 500.0,
        tipo: "producto"
      },
      {
        codigo: "1.07",
        descripcion: "CABLE FPL UL CONTRA INCENDIO",
        unidad: "m",
        cantidad: 50,
        precio_unitario: 3.0,
        subtotal: 150.0,
        tipo: "producto"
      },
      {
        codigo: "1.08",
        descripcion: "MOVILIZACION DE EQUIPOS, ANDAMIOS Y ESCALERAS",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 300.0,
        subtotal: 300.0,
        tipo: "servicio"
      }
    ]
  },
  {
    archivo: "COT 25- ACI TIENDA MALL DEL SUR.xls",
    fecha: "2026-11-03T14:00:00Z",
    cliente: {
      nombre: "ARGOS CHANG E.I.R.L. (DOCET BACKPACK)",
      ruc: "20565976037",
      direccion: "TIENDA DOCET - CC. MALL DEL SUR, SJM"
    },
    asunto: "SUMINISTRO E INSTALACION DE SISTEMA DE AGUA CONTRA INCENDIOS ACI",
    subtotal: 6500.0,
    igv: 1170.0,
    total: 7670.0,
    convertir_a_venta: true,
    estado_venta: "confirmada",
    items: [
      {
        codigo: "1.01",
        descripcion: "SUMINISTRO E INSTALACION DE SISTEMA DE AGUA CONTRA INCENDIOS EN TIENDA",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 6500.0,
        subtotal: 6500.0,
        tipo: "servicio"
      }
    ]
  },
  {
    archivo: "COT 25- LE BUDGE.xls",
    fecha: "2026-11-05T16:00:00Z",
    cliente: {
      nombre: "RECTIFICACIONES Y FABRICACIONES MECANICAS BUDGE S.A.C.",
      ruc: "20503801575",
      direccion: "AV. ENRIQUE MEIGGS 273 - BELLAVISTA, CALLAO"
    },
    asunto: "COTIZACION DE EMISION DE CERTIFICADO DE LUCES DE EMERGENCIAS PLANTA 3",
    subtotal: 200.0,
    igv: 0.0,
    total: 200.0,
    convertir_a_venta: false,
    estado_venta: null,
    items: [
      {
        codigo: "1.01",
        descripcion: "CERTIFICADO DE OPERATIVIDAD DE LUCES DE EMERGENCIA FIRMADO POR INGENIERO COLEGIADO",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 200.0,
        subtotal: 200.0,
        tipo: "servicio"
      }
    ]
  },
  {
    archivo: "COT 25- MANT SERTEVAL.xls",
    fecha: "2026-11-07T10:30:00Z",
    cliente: {
      nombre: "SERTEVAL E.I.R.L.",
      ruc: "20108539403",
      direccion: "JR. JOSE A. MORALES 1037 - SAN JUAN DE MIRAFLORES"
    },
    asunto: "MANTENIMIENTO INTEGRAL DE SISTEMAS ELECTRICOS Y DE ALARMA",
    subtotal: 2650.0,
    igv: 477.0,
    total: 3127.0,
    convertir_a_venta: true,
    estado_venta: "confirmada",
    items: [
      {
        codigo: "1.01",
        descripcion: "Mantenimiento de sistema de alarma",
        unidad: "unid",
        cantidad: 1,
        precio_unitario: 400.0,
        subtotal: 400.0,
        tipo: "servicio"
      },
      {
        codigo: "1.02",
        descripcion: "Mantenimiento de 2 tableros eléctricos",
        unidad: "unid",
        cantidad: 2,
        precio_unitario: 400.0,
        subtotal: 800.0,
        tipo: "servicio"
      },
      {
        codigo: "1.03",
        descripcion: "Mantenimiento de 2 aires acondicionados",
        unidad: "unid",
        cantidad: 2,
        precio_unitario: 600.0,
        subtotal: 1200.0,
        tipo: "servicio"
      },
      {
        codigo: "1.04",
        descripcion: "Mantenimiento de luces de emergencia",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 250.0,
        subtotal: 250.0,
        tipo: "servicio"
      }
    ]
  },
  {
    archivo: "COT 25- MC DONALD`S EL POLO ANULACION MAC CAFE.xls",
    fecha: "2026-11-10T11:00:00Z",
    cliente: {
      nombre: "OPERACIONES ARCOS DORADOS DE PERU S.A.",
      ruc: "20376289215",
      direccion: "CC. EL POLO - SANTIAGO DE SURCO"
    },
    asunto: "SUMINISTRO E INSTALACION ELECTRICA - MODIFICACION DE TABLEROS",
    subtotal: 3050.0,
    igv: 549.0,
    total: 3599.0,
    convertir_a_venta: true,
    estado_venta: "confirmada",
    items: [
      {
        codigo: "1.01",
        descripcion: "ANULADO DE TABLERO MAC CAFE E INSTALACION DE CIRCUITOS EN TABLERO PRINCIPAL",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 3050.0,
        subtotal: 3050.0,
        tipo: "servicio"
      }
    ]
  },
  {
    archivo: "COT 25- SACI TIENDA MALL DEL SUR.xls",
    fecha: "2026-11-14T09:30:00Z",
    cliente: {
      nombre: "ARGOS CHANG E.I.R.L. (DOCET BACKPACK)",
      ruc: "20565976037",
      direccion: "TIENDA DOCET - CC. MALL DEL SUR, SJM"
    },
    asunto: "SUMINISTRO E INSTALACION DE ALARMA CONTRA INCENDIOS SACI",
    subtotal: 4390.0,
    igv: 790.2,
    total: 5180.2,
    convertir_a_venta: true,
    estado_venta: "confirmada",
    items: [
      {
        codigo: "1.01",
        descripcion: "SUMINISTRO E INSTALACION DE ALARMA CONTRA INCENDIOS SEGUN PLANO TIENDA",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 4390.0,
        subtotal: 4390.0,
        tipo: "servicio"
      }
    ]
  },
  {
    archivo: "COT 25- SACI VILLA JACARANDA TORRE 6.xls",
    fecha: "2026-11-16T15:00:00Z",
    cliente: {
      nombre: "JUNTA DE PROPIETARIOS VILLA JACARANDA TORRE 6",
      ruc: "20601245891",
      direccion: "VILLA JACARANDA - EL RETABLO, COMAS"
    },
    asunto: "MANTENIMIENTO PREVENTIVO DE SISTEMA DE ALARMA CONTRA INCENDIOS",
    subtotal: 1500.0,
    igv: 0.0,
    total: 1500.0,
    convertir_a_venta: false,
    estado_venta: null,
    items: [
      {
        codigo: "1.01",
        descripcion: "MANTENIMIENTO PREVENTIVO DE SISTEMA DE ALARMA CONTRA INCENDIOS TORRE 6",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 1500.0,
        subtotal: 1500.0,
        tipo: "servicio"
      }
    ]
  },
  {
    archivo: "COT 25- TOMACORRIENTES EMPOTRABLES LA MOLINA.xls",
    fecha: "2026-11-18T12:00:00Z",
    cliente: {
      nombre: "RESIDENCIAL LAS CASUARINAS LA MOLINA",
      ruc: "20492837162",
      direccion: "URB. LAS CASUARINAS - LA MOLINA, LIMA"
    },
    asunto: "COTIZACION DE SUMINISTRO DE TOMACORRIENTES EMPOTRABLES",
    subtotal: 279.99,
    igv: 0.0,
    total: 279.99,
    convertir_a_venta: true,
    estado_venta: "confirmada",
    items: [
      {
        codigo: "1.01",
        descripcion: "TOMACORRIENTES EMPOTRABLES ACABADO ACERO REBATIBLES INCLUYE INSTALACION",
        unidad: "unidad",
        cantidad: 3,
        precio_unitario: 93.33,
        subtotal: 279.99,
        tipo: "producto"
      }
    ]
  },
  {
    archivo: "COT MC DONALDS BAU.xls",
    fecha: "2026-11-21T16:30:00Z",
    cliente: {
      nombre: "OPERACIONES ARCOS DORADOS DE PERU S.A.",
      ruc: "20376289215",
      direccion: "AV. ALFREDO BENAVIDES 1791 - MIRAFLORES, LIMA"
    },
    asunto: "SUMINISTRO E INSTALACION DE DETECTORES DE HUMO Y TERMINALES",
    subtotal: 995.0,
    igv: 179.1,
    total: 1174.1,
    convertir_a_venta: true,
    estado_venta: "confirmada",
    items: [
      {
        codigo: "1.01",
        descripcion: "Detector de humo convencional marca HAGROY modelo HG-SD4/2 con base",
        unidad: "und",
        cantidad: 4,
        precio_unitario: 60.0,
        subtotal: 240.0,
        tipo: "producto"
      },
      {
        codigo: "1.02",
        descripcion: "Cable contra incendio FPL 4x22 AWG",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 125.0,
        subtotal: 125.0,
        tipo: "producto"
      },
      {
        codigo: "1.03",
        descripcion: "Terminales de conexión para baterías del panel SACI",
        unidad: "juego",
        cantidad: 1,
        precio_unitario: 60.0,
        subtotal: 60.0,
        tipo: "producto"
      },
      {
        codigo: "1.04",
        descripcion: "Accesorios y materiales menores para conexionado y fijación",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 45.0,
        subtotal: 45.0,
        tipo: "producto"
      },
      {
        codigo: "1.05",
        descripcion: "Mano de obra técnica para instalación de detectores y tendido de cableado",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 350.0,
        subtotal: 350.0,
        tipo: "servicio"
      },
      {
        codigo: "1.06",
        descripcion: "Adecuación de conexiones eléctricas y revisión de circuitos",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 75.0,
        subtotal: 75.0,
        tipo: "servicio"
      },
      {
        codigo: "1.07",
        descripcion: "Pruebas de funcionamiento, verificación de señales y puesta en servicio",
        unidad: "glob",
        cantidad: 1,
        precio_unitario: 100.0,
        subtotal: 100.0,
        tipo: "servicio"
      }
    ]
  }
];

export async function ejecutarImportacionHistorica(onProgreso?: (msg: string) => void): Promise<{ ok: boolean; mensaje: string }> {
  try {
    onProgreso?.('Iniciando importación...');

    // 1. Obtener o resolver categoría por defecto y tipo_documento para RUC
    const [{ data: categorias }, { data: tiposDoc }] = await Promise.all([
      supabase.from('categoria').select('id, nombre').limit(10),
      supabase.from('tipo_documento').select('id, codigo_sunat, descripcion').eq('activo', true)
    ]);
    const idCategoria = categorias?.[0]?.id || 1;
    const idTipoDocRuc = tiposDoc?.find(t => t.codigo_sunat === '6' || /RUC/i.test(t.descripcion))?.id || tiposDoc?.[0]?.id || 1;

    // 2. Obtener lista existente de clientes para no duplicar
    const { data: clientesExistentes } = await supabase.from('clientes').select('id, num_documento, nombre_razon_social');
    const mapaClientes = new Map<string, number>();
    (clientesExistentes || []).forEach(c => {
      if (c.num_documento) mapaClientes.set(c.num_documento.trim(), c.id);
      if (c.nombre_razon_social) mapaClientes.set(c.nombre_razon_social.trim().toUpperCase(), c.id);
    });

    // 3. Obtener cotizaciones existentes para no duplicar
    const { data: cotizacionesExistentes } = await supabase.from('cotizaciones').select('id, num_cotizacion, asunto');
    const setCotizaciones = new Set((cotizacionesExistentes || []).map(c => c.asunto?.trim().toUpperCase()));

    // 4. Obtener correlativo consecutivo más alto de cotizaciones, ventas y productos
    const [{ data: todasCot }, { data: todasVen }, { data: todosProds }] = await Promise.all([
      supabase.from('cotizaciones').select('num_cotizacion'),
      supabase.from('ventas').select('num_venta, orden_compra_cliente'),
      supabase.from('productos').select('codigo, tipo')
    ]);

    let maxCot = 0;
    (todasCot || []).forEach(c => {
      const match = c.num_cotizacion?.match(/COT-(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxCot) maxCot = n;
      }
    });

    let maxVen = 0;
    let maxOc = 0;
    (todasVen || []).forEach(v => {
      const matchVen = v.num_venta?.match(/OV-(\d+)/);
      if (matchVen) {
        const n = parseInt(matchVen[1], 10);
        if (n > maxVen) maxVen = n;
      }
      const ocStr = v.orden_compra_cliente?.trim();
      if (ocStr && /^\d+$/.test(ocStr)) {
        const n = parseInt(ocStr, 10);
        if (n > maxOc) maxOc = n;
      }
    });

    let maxPro = 0;
    let maxServ = 0;
    (todosProds || []).forEach(p => {
      const matchPro = p.codigo?.match(/^PRO-(\d+)/i);
      if (matchPro) {
        const n = parseInt(matchPro[1], 10);
        if (n > maxPro) maxPro = n;
      }
      const matchServ = p.codigo?.match(/^SERV-(\d+)/i);
      if (matchServ) {
        const n = parseInt(matchServ[1], 10);
        if (n > maxServ) maxServ = n;
      }
    });

    let cotCreadas = 0;
    let venCreadas = 0;

    for (const cot of DATOS_COTIZACIONES_HISTORICAS) {
      onProgreso?.(`Procesando cotización: ${cot.asunto.slice(0, 30)}...`);

      // Verificar si la cotización ya existe por asunto
      if (setCotizaciones.has(cot.asunto.trim().toUpperCase())) {
        continue;
      }

      // Asegurar cliente
      let idCliente = mapaClientes.get(cot.cliente.ruc) || mapaClientes.get(cot.cliente.nombre.trim().toUpperCase());
      if (!idCliente) {
        const { data: nuevoCli, error: errCli } = await supabase.from('clientes').insert({
          id_tipo_documento: idTipoDocRuc,
          num_documento: cot.cliente.ruc,
          nombre_razon_social: cot.cliente.nombre,
          direccion: cot.cliente.direccion,
          correo: 'contacto@' + cot.cliente.nombre.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) + '.com',
          telefono: '9' + Math.floor(10000000 + Math.random() * 90000000).toString().slice(0, 8),
          activo: true
        }).select('id').single();

        if (errCli || !nuevoCli) {
          throw new Error(`Error creando cliente ${cot.cliente.nombre}: ${errCli?.message}`);
        }
        idCliente = nuevoCli.id;
        mapaClientes.set(cot.cliente.ruc, nuevoCli.id);
        mapaClientes.set(cot.cliente.nombre.trim().toUpperCase(), nuevoCli.id);
      }

      // Asegurar productos
      const detalleConProductos = [];
      for (const it of cot.items) {
        // Buscar si el producto ya existe por nombre
        const { data: prodExistente } = await supabase
          .from('productos')
          .select('id, nombre, stock_actual')
          .ilike('nombre', it.descripcion.trim())
          .limit(1)
          .maybeSingle();

        let idProducto = prodExistente?.id;
        if (!idProducto) {
          // Generar código según estándar del sistema (PRO-X o SERV-X)
          let codGenerado = '';
          if (it.tipo === 'servicio') {
            maxServ++;
            codGenerado = `SERV-${String(maxServ).padStart(2, '0')}`;
          } else {
            maxPro++;
            codGenerado = `PRO-${maxPro}`;
          }

          const { data: nuevoProd, error: errProd } = await supabase.from('productos').insert({
            nombre: it.descripcion.trim(),
            codigo: codGenerado,
            tipo: it.tipo,
            unidad_medida: it.unidad === 'und' || it.unidad === 'unidad' ? 'und' : it.unidad === 'glob' ? 'glob' : it.unidad === 'juego' ? 'juego' : 'm',
            precio_unitario: it.precio_unitario,
            stock_actual: it.tipo === 'producto' ? 100 : 0, // Stock suficiente para ventas
            stock_minimo: it.tipo === 'producto' ? 5 : 0,
            id_categoria: idCategoria,
            activo: true,
            visible_web: false
          }).select('id').single();

          if (errProd || !nuevoProd) {
            throw new Error(`Error creando producto "${it.descripcion}": ${errProd?.message}`);
          }
          idProducto = nuevoProd.id;
        }

        detalleConProductos.push({
          id_producto: idProducto,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          subtotal: it.subtotal
        });
      }

      // Crear cotización
      maxCot++;
      const numCotizacion = `COT-${String(maxCot).padStart(4, '0')}`;
      const estadoCot = cot.convertir_a_venta ? 'aprobada' : 'enviada';

      let { data: nuevaCot, error: errCot } = await supabase.from('cotizaciones').insert({
        num_cotizacion: numCotizacion,
        id_cliente: idCliente,
        origen: 'interno',
        estado: estadoCot,
        fecha_emision: cot.fecha,
        asunto: cot.asunto,
        forma_pago: 'Contado',
        notas: `[ASUNTO: ${cot.asunto}]`
      }).select('id').single();

      if (errCot && (/asunto/i.test(errCot.message) || /forma_pago/i.test(errCot.message) || /column .* does not exist/i.test(errCot.message))) {
        const res = await supabase.from('cotizaciones').insert({
          num_cotizacion: numCotizacion,
          id_cliente: idCliente,
          origen: 'interno',
          estado: estadoCot,
          fecha_emision: cot.fecha,
          notas: `[ASUNTO: ${cot.asunto}]`
        }).select('id').single();
        nuevaCot = res.data;
        errCot = res.error;
      }

      if (errCot || !nuevaCot) {
        throw new Error(`Error creando cotización ${numCotizacion}: ${errCot?.message}`);
      }

      // Insertar detalle_cotizacion
      const itemsCot = detalleConProductos.map(it => ({
        id_cotizacion: (nuevaCot as { id: number }).id,
        id_producto: it.id_producto,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario
      }));
      await supabase.from('detalle_cotizacion').insert(itemsCot);
      setCotizaciones.add(cot.asunto.trim().toUpperCase());
      cotCreadas++;

      // Si se convierte a orden de venta
      if (cot.convertir_a_venta) {
        maxVen++;
        const numVenta = `OV-${String(maxVen).padStart(5, '0')}`;
        const { data: nuevaVenta, error: errVen } = await supabase.from('ventas').insert({
          num_venta: numVenta,
          fecha: cot.fecha,
          id_cotizacion: (nuevaCot as { id: number }).id,
          id_cliente: idCliente,
          orden_compra_cliente: String(++maxOc),
          estado: cot.estado_venta || 'confirmada'
        }).select('id').single();

        if (errVen || !nuevaVenta) {
          throw new Error(`Error creando orden de venta ${numVenta}: ${errVen?.message}`);
        }

        const itemsVen = detalleConProductos.map(it => ({
          id_venta: (nuevaVenta as { id: number }).id,
          id_producto: it.id_producto,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario
        }));
        await supabase.from('detalle_venta').insert(itemsVen);
        venCreadas++;
      }
    }

    // Normalizar automáticamente cualquier código previo que no cumpla el estándar
    onProgreso?.('Estandarizando códigos de productos y órdenes de compra...');
    await normalizarCodigosHistoricos();

    return {
      ok: true,
      mensaje: `¡Importación completada con éxito! Se registraron ${cotCreadas} nuevas cotizaciones y ${venCreadas} órdenes de venta desde el 24 de octubre al 21 de noviembre. Todos los códigos de productos (PRO-XX) y OC de clientes han sido estandarizados.`
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, mensaje: msg };
  }
}

export async function normalizarCodigosHistoricos(): Promise<{ ok: boolean; mensaje: string }> {
  try {
    // 1. Normalizar productos existentes que tengan código tipo 'P-'
    const { data: todosProds, error: errProds } = await supabase
      .from('productos')
      .select('id, codigo, tipo, nombre')
      .order('id', { ascending: true });

    if (errProds) throw errProds;

    let maxPro = 0;
    let maxServ = 0;

    (todosProds || []).forEach(p => {
      const matchPro = p.codigo?.match(/^PRO-(\d+)/i);
      if (matchPro) {
        const n = parseInt(matchPro[1], 10);
        if (n > maxPro) maxPro = n;
      }
      const matchServ = p.codigo?.match(/^SERV-(\d+)/i);
      if (matchServ) {
        const n = parseInt(matchServ[1], 10);
        if (n > maxServ) maxServ = n;
      }
    });

    let prodsActualizados = 0;
    for (const p of (todosProds || [])) {
      if (p.codigo && (p.codigo.startsWith('P-') || !/^(PRO|SERV)-/i.test(p.codigo))) {
        let nuevoCod = '';
        if (p.tipo === 'servicio') {
          maxServ++;
          nuevoCod = `SERV-${String(maxServ).padStart(2, '0')}`;
        } else {
          maxPro++;
          nuevoCod = `PRO-${maxPro}`;
        }
        await supabase.from('productos').update({ codigo: nuevoCod }).eq('id', p.id);
        prodsActualizados++;
      }
    }

    // 2. Normalizar ventas: ordenar cronológicamente por fecha y asignar números correlativos continuos (1, 2, 3...)
    const { data: todasVentas, error: errVentas } = await supabase
      .from('ventas')
      .select('id, num_venta, orden_compra_cliente, fecha')
      .order('fecha', { ascending: true })
      .order('id', { ascending: true });

    if (errVentas) throw errVentas;

    let ventasActualizadas = 0;
    let seq = 1;
    for (const v of (todasVentas || [])) {
      const nuevoOc = String(seq++);
      if (v.orden_compra_cliente !== nuevoOc) {
        const { error: vErr } = await supabase
          .from('ventas')
          .update({ orden_compra_cliente: nuevoOc })
          .eq('id', v.id);
        if (vErr) {
          console.warn('Error actualizando orden_compra_cliente de venta', v.id, vErr);
        } else {
          ventasActualizadas++;
        }
      }
    }

    return {
      ok: true,
      mensaje: `¡Códigos estandarizados con éxito! Se corrigieron ${prodsActualizados} códigos de productos (formato PRO-XX / SERV-XX) y ${ventasActualizadas} órdenes de compra de clientes (correlativos cronológicos 1 al ${seq - 1}).`
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, mensaje: msg };
  }
}
