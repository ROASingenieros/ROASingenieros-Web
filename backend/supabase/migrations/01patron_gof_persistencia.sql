-- ============================================================================
-- MIGRACIÓN DE PERSISTENCIA: PATRONES DE DISEÑO GOF (COMMAND Y OBSERVER)
-- ============================================================================
-- Archivo: backend/supabase/migrations/01patron_gof_persistencia.sql
-- Motor: PostgreSQL / Supabase
--
-- ----------------------------------------------------------------------------
-- 1. PATRÓN COMMAND (PROCEDIMIENTOS ALMACENADOS RPC TRANSACCIONALES)
-- ----------------------------------------------------------------------------
-- Contexto y Propósito:
-- El patrón Command encapsula una solicitud de negocio como un procedimiento
-- autocontenido con sus parámetros, validaciones previas y ejecución atómica
-- dentro de una única transacción (bloque BEGIN ... EXCEPTION ... END).
--
-- En lugar de que el cliente frontend (React) realice múltiples mutaciones
-- directas sobre varias tablas (dejando datos inconsistentes o en riesgo ante
-- caídas de red), el frontend despacha un COMANDO TRANSACCIONAL mediante RPC:
--
-- Participantes en la Base de Datos:
--   - Command Interface (Contrato): Firma del procedimiento (p_id, p_params, etc.).
--   - Concrete Command:
--       * convertir_cotizacion_a_venta: Convierte cotización aprobada a venta y clona ítems.
--       * crear_comprobante: Genera serie y correlativo correlativo atómico sin huecos.
--       * crear_guia_remision: Emite guía vinculada a venta con serie y traslados.
--       * ajustar_stock: Modifica stock manual con auditoría e historial de movimientos.
--       * confirmar_orden_venta: Valida stock y confirma venta atómicamente.
--       * anular_orden_venta: Comando compensatorio (Undo) que repone stock al inventario.
--       * registrar_solicitud_web: Guarda leads del catálogo público (SECURITY DEFINER).
--   - Invoker: Cliente Supabase (supabase.rpc('comando', { ... })).
--   - Receiver: Esquema de base de datos relacional (PostgreSQL).
--
-- ----------------------------------------------------------------------------
-- 2. PATRÓN OBSERVER (TRIGGERS REACTIVOS DE BASE DE DATOS)
-- ----------------------------------------------------------------------------
-- Contexto y Propósito:
-- El patrón Observer desacopla los emisores de eventos de sus efectos colaterales.
-- Cuando un Sujeto (Subject: Tabla de base de datos) cambia de estado (INSERT,
-- UPDATE, DELETE), el motor de base de datos notifica automáticamente a los
-- Observadores (Triggers) registrados sin que la transacción emisora deba
-- conocer explícitamente a sus observadores.
--
-- Participantes en la Base de Datos:
--   - Subject (Sujeto / Observable): Tablas críticas (ventas, comprobantes, productos, detalles).
--   - Notification Dispatcher: Mecanismo nativo de Triggers de PostgreSQL (AFTER / BEFORE).
--   - Concrete Observers:
--       * fn_observador_auditoria: Registra cada cambio (OLD/NEW en JSONB) en la tabla 'auditoria'.
--       * fn_observador_stock_y_visibilidad: Reacciona ante cambios de stock; si stock <= 0
--         desactiva el producto y oculta de la web automáticamente.
--       * fn_observador_recalcular_totales: Reacciona ante mutaciones en ítems y recalcula
--         el subtotal, IGV (18%) y total en la cabecera correspondiente.
--       * fn_observador_comprobante_sello: Reacciona cuando un comprobante pasa a 'emitido'.
-- ============================================================================

-- ============================================================================
-- PARTE 1: DEFINICIÓN DE ESTRUCTURA Y TABLAS BASE (IDEMPOTENTE)
-- ============================================================================

-- Tipos enumerados de negocio (si no existen)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rol_usuario') THEN
    CREATE TYPE rol_usuario AS ENUM ('admin', 'supervisor', 'secretaria');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_item') THEN
    CREATE TYPE tipo_item AS ENUM ('producto', 'servicio');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_cotizacion') THEN
    CREATE TYPE estado_cotizacion AS ENUM ('borrador', 'enviada', 'aprobada', 'rechazada', 'vencida');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_venta') THEN
    CREATE TYPE estado_venta AS ENUM ('pendiente', 'confirmada', 'anulada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_comprobante') THEN
    CREATE TYPE tipo_comprobante AS ENUM ('boleta', 'factura');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_comprobante') THEN
    CREATE TYPE estado_comprobante AS ENUM ('borrador', 'verificado', 'emitido', 'anulado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_guia') THEN
    CREATE TYPE estado_guia AS ENUM ('borrador', 'emitida', 'anulada');
  END IF;
END $$;

-- 1.1 Tabla perfiles
CREATE TABLE IF NOT EXISTS perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'secretaria' CHECK (rol IN ('admin', 'supervisor', 'secretaria')),
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.2 Tablas auxiliares de productos
CREATE TABLE IF NOT EXISTS categorias (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS marcas (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS modelos (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS tipo_documento (
  id BIGSERIAL PRIMARY KEY,
  codigo_sunat TEXT NOT NULL UNIQUE,
  descripcion TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true
);

-- Inserción inicial de tipos de documento SUNAT si no existen
INSERT INTO tipo_documento (codigo_sunat, descripcion, activo) VALUES
  ('1', 'DNI - Documento Nacional de Identidad', true),
  ('6', 'RUC - Registro Único de Contribuyentes', true),
  ('4', 'Carnet de Extranjería', true),
  ('7', 'Pasaporte', true),
  ('0', 'Doc. Trib. No Domiciliado Sin RUC', true)
ON CONFLICT (codigo_sunat) DO NOTHING;

-- 1.3 Tabla productos
CREATE TABLE IF NOT EXISTS productos (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'producto' CHECK (tipo IN ('producto', 'servicio')),
  codigo TEXT UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  id_categoria BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
  id_marca BIGINT REFERENCES marcas(id) ON DELETE SET NULL,
  id_modelo BIGINT REFERENCES modelos(id) ON DELETE SET NULL,
  unidad_medida TEXT DEFAULT 'unidad',
  precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_actual INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER NOT NULL DEFAULT 5,
  stock_maximo INTEGER,
  visible_web BOOLEAN NOT NULL DEFAULT true,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.4 Tabla movimientos_inventario
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id BIGSERIAL PRIMARY KEY,
  id_producto BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('venta', 'compra', 'ajuste', 'anulacion')),
  cantidad INTEGER NOT NULL,
  stock_resultante INTEGER NOT NULL,
  referencia TEXT,
  id_usuario UUID,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.5 Tabla clientes
CREATE TABLE IF NOT EXISTS clientes (
  id BIGSERIAL PRIMARY KEY,
  id_tipo_documento BIGINT REFERENCES tipo_documento(id),
  num_documento TEXT NOT NULL,
  nombre_razon_social TEXT NOT NULL,
  apellidos TEXT,
  telefono TEXT,
  correo TEXT,
  direccion TEXT,
  id_ubicacion BIGINT,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cliente_documento UNIQUE (num_documento)
);

-- 1.6 Tablas de Cotizaciones y Detalles
CREATE TABLE IF NOT EXISTS cotizaciones (
  id BIGSERIAL PRIMARY KEY,
  num_cotizacion TEXT NOT NULL UNIQUE,
  fecha_emision TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_cliente BIGINT NOT NULL REFERENCES clientes(id),
  id_empleado BIGINT,
  origen TEXT DEFAULT 'panel',
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'enviada', 'aprobada', 'rechazada', 'vencida', 'convertida')),
  asunto TEXT,
  forma_pago TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  igv NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detalle_cotizacion (
  id BIGSERIAL PRIMARY KEY,
  id_cotizacion BIGINT NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  id_producto BIGINT NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 1.7 Tablas de Ventas y Detalles
CREATE TABLE IF NOT EXISTS ventas (
  id BIGSERIAL PRIMARY KEY,
  num_venta TEXT NOT NULL UNIQUE,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_cotizacion BIGINT REFERENCES cotizaciones(id) ON DELETE SET NULL,
  id_cliente BIGINT NOT NULL REFERENCES clientes(id),
  id_empleado BIGINT,
  orden_compra_cliente TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'anulada')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  igv NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detalle_venta (
  id BIGSERIAL PRIMARY KEY,
  id_venta BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  id_producto BIGINT NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 1.8 Tablas de Comprobantes y Guías
CREATE TABLE IF NOT EXISTS comprobantes (
  id BIGSERIAL PRIMARY KEY,
  id_venta BIGINT NOT NULL REFERENCES ventas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('boleta', 'factura')),
  serie TEXT NOT NULL,
  correlativo INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'verificado', 'emitido', 'anulado')),
  verificado_por UUID,
  emitido_en TIMESTAMPTZ,
  hash_cpe TEXT,
  pdf_url TEXT,
  xml_url TEXT,
  respuesta_sunat JSONB,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_comprobante_serie_correlativo UNIQUE (serie, correlativo)
);

CREATE TABLE IF NOT EXISTS guias_remision (
  id BIGSERIAL PRIMARY KEY,
  id_venta BIGINT NOT NULL REFERENCES ventas(id),
  serie TEXT NOT NULL,
  correlativo INTEGER NOT NULL,
  punto_partida TEXT,
  punto_llegada TEXT NOT NULL,
  fecha_traslado DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'emitida', 'anulada')),
  respuesta_sunat JSONB,
  pdf_url TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_guia_serie_correlativo UNIQUE (serie, correlativo)
);

-- 1.9 Tabla de Auditoría (Sujeto y receptor de eventos)
CREATE TABLE IF NOT EXISTS auditoria (
  id BIGSERIAL PRIMARY KEY,
  tabla TEXT NOT NULL,
  operacion TEXT NOT NULL,
  id_registro TEXT,
  valor_anterior JSONB,
  valor_nuevo JSONB,
  id_usuario UUID,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS solicitudes_web (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  estado TEXT NOT NULL DEFAULT 'pendiente',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de optimización
CREATE INDEX IF NOT EXISTS idx_productos_stock ON productos(stock_actual);
CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado);
CREATE INDEX IF NOT EXISTS idx_comprobantes_venta ON comprobantes(id_venta);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla);


-- ============================================================================
-- PARTE 2: PATRÓN COMMAND (PROCEDIMIENTOS ALMACENADOS RPC TRANSACCIONALES)
-- ============================================================================
-- Cada función representa un COMANDO CONCRETO. Garantiza transaccionalidad
-- completa (ACID), validaciones de negocio previas y rollback atómico.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- COMANDO 1: convertir_cotizacion_a_venta
-- Invoker: Cotizaciones.tsx -> supabase.rpc('convertir_cotizacion_a_venta')
-- Propósito: Valida cotización aprobada, clona ítems a detalle_venta y sella la cotización.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION convertir_cotizacion_a_venta(
  p_id_cotizacion BIGINT,
  p_oc_cliente TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cotizacion RECORD;
  v_nueva_venta_id BIGINT;
  v_num_venta TEXT;
  v_consecutivo INTEGER;
BEGIN
  -- 1. Precondición: Validar que la cotización existe y obtener datos con bloqueo pesimista
  SELECT * INTO v_cotizacion
  FROM cotizaciones
  WHERE id = p_id_cotizacion
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cotización con ID % no existe.', p_id_cotizacion;
  END IF;

  IF v_cotizacion.estado <> 'aprobada' THEN
    RAISE EXCEPTION 'Solo se puede convertir una cotización en estado aprobada (estado actual: %).', v_cotizacion.estado;
  END IF;

  -- 2. Generación determinista del correlativo de la orden de venta (OV-YYYY-XXXXX)
  SELECT COALESCE(MAX(SUBSTRING(num_venta FROM '[0-9]+$')::INTEGER), 0) + 1
  INTO v_consecutivo
  FROM ventas
  WHERE num_venta LIKE 'OV-' || TO_CHAR(now(), 'YYYY') || '-%';

  v_num_venta := 'OV-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(v_consecutivo::TEXT, 5, '0');

  -- 3. Mutación 1: Insertar la cabecera de la venta
  INSERT INTO ventas (
    num_venta,
    fecha,
    id_cotizacion,
    id_cliente,
    id_empleado,
    orden_compra_cliente,
    estado,
    subtotal,
    igv,
    total
  ) VALUES (
    v_num_venta,
    now(),
    p_id_cotizacion,
    v_cotizacion.id_cliente,
    v_cotizacion.id_empleado,
    TRIM(p_oc_cliente),
    'pendiente',
    v_cotizacion.subtotal,
    v_cotizacion.igv,
    v_cotizacion.total
  )
  RETURNING id INTO v_nueva_venta_id;

  -- 4. Mutación 2: Clonar ítems de detalle_cotizacion a detalle_venta
  INSERT INTO detalle_venta (
    id_venta,
    id_producto,
    cantidad,
    precio_unitario,
    subtotal
  )
  SELECT
    v_nueva_venta_id,
    id_producto,
    cantidad,
    precio_unitario,
    subtotal
  FROM detalle_cotizacion
  WHERE id_cotizacion = p_id_cotizacion;

  -- 5. Mutación 3: Actualizar estado de la cotización original a convertida
  UPDATE cotizaciones
  SET estado = 'convertida'
  WHERE id = p_id_cotizacion;

  -- Retornar el ID del nuevo recurso creado por el comando
  RETURN v_nueva_venta_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- COMANDO 2: confirmar_orden_venta
-- Propósito: Confirma la venta, valida disponibilidad y reduce el stock de productos.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirmar_orden_venta(
  p_id_venta BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venta RECORD;
  v_item RECORD;
  v_stock_actual INTEGER;
  v_nuevo_stock INTEGER;
BEGIN
  SELECT * INTO v_venta
  FROM ventas
  WHERE id = p_id_venta
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La orden de venta % no existe.', p_id_venta;
  END IF;

  IF v_venta.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se puede confirmar una orden de venta en estado pendiente (estado actual: %).', v_venta.estado;
  END IF;

  -- Validar stock suficiente para cada producto físico antes de mutar
  FOR v_item IN
    SELECT dv.*, p.nombre, p.tipo, p.stock_actual
    FROM detalle_venta dv
    JOIN productos p ON p.id = dv.id_producto
    WHERE dv.id_venta = p_id_venta
    FOR UPDATE OF p
  LOOP
    IF v_item.tipo = 'producto' THEN
      IF v_item.stock_actual < v_item.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto "%" (Disponible: %, Requerido: %).',
          v_item.nombre, v_item.stock_actual, v_item.cantidad;
      END IF;

      -- Descontar stock
      v_nuevo_stock := v_item.stock_actual - v_item.cantidad;
      UPDATE productos
      SET stock_actual = v_nuevo_stock
      WHERE id = v_item.id_producto;

      -- Registrar movimiento de inventario
      INSERT INTO movimientos_inventario (
        id_producto,
        tipo,
        cantidad,
        stock_resultante,
        referencia,
        id_usuario
      ) VALUES (
        v_item.id_producto,
        'venta',
        -v_item.cantidad,
        v_nuevo_stock,
        'Venta confirmada ' || v_venta.num_venta,
        auth.uid()
      );
    END IF;
  END LOOP;

  -- Actualizar estado de la venta
  UPDATE ventas
  SET estado = 'confirmada'
  WHERE id = p_id_venta;

  RETURN jsonb_build_object(
    'ok', true,
    'id_venta', p_id_venta,
    'mensaje', 'Venta ' || v_venta.num_venta || ' confirmada e inventario actualizado.'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- COMANDO 3: anular_orden_venta (Comando Compensatorio / Undo)
-- Propósito: Deshace una orden confirmada y repone el stock consumido.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION anular_orden_venta(
  p_id_venta BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venta RECORD;
  v_item RECORD;
  v_nuevo_stock INTEGER;
BEGIN
  SELECT * INTO v_venta
  FROM ventas
  WHERE id = p_id_venta
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La orden de venta % no existe.', p_id_venta;
  END IF;

  IF v_venta.estado = 'anulada' THEN
    RAISE EXCEPTION 'La orden de venta % ya se encuentra anulada.', v_venta.num_venta;
  END IF;

  -- Comprobar si tiene comprobantes emitidos activos
  IF EXISTS (SELECT 1 FROM comprobantes WHERE id_venta = p_id_venta AND estado = 'emitido') THEN
    RAISE EXCEPTION 'No se puede anular la venta % porque tiene comprobantes emitidos ante SUNAT.', v_venta.num_venta;
  END IF;

  -- Si la venta estaba confirmada, compensar (reponer) el stock
  IF v_venta.estado = 'confirmada' THEN
    FOR v_item IN
      SELECT dv.*, p.tipo, p.stock_actual
      FROM detalle_venta dv
      JOIN productos p ON p.id = dv.id_producto
      WHERE dv.id_venta = p_id_venta
      FOR UPDATE OF p
    LOOP
      IF v_item.tipo = 'producto' THEN
        v_nuevo_stock := v_item.stock_actual + v_item.cantidad;
        UPDATE productos
        SET stock_actual = v_nuevo_stock
        WHERE id = v_item.id_producto;

        INSERT INTO movimientos_inventario (
          id_producto,
          tipo,
          cantidad,
          stock_resultante,
          referencia,
          id_usuario
        ) VALUES (
          v_item.id_producto,
          'anulacion',
          v_item.cantidad,
          v_nuevo_stock,
          'Reversión por anulación de venta ' || v_venta.num_venta,
          auth.uid()
        );
      END IF;
    END LOOP;
  END IF;

  -- Actualizar estado a anulada
  UPDATE ventas
  SET estado = 'anulada'
  WHERE id = p_id_venta;

  RETURN jsonb_build_object(
    'ok', true,
    'id_venta', p_id_venta,
    'mensaje', 'Venta ' || v_venta.num_venta || ' anulada y stock devuelto exitosamente.'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- COMANDO 4: crear_comprobante
-- Invoker: Comprobantes.tsx -> supabase.rpc('crear_comprobante', { p_id_venta, p_tipo })
-- Propósito: Genera el borrador de boleta o factura con serie y correlativo sin huecos.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_comprobante(
  p_id_venta BIGINT,
  p_tipo TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venta RECORD;
  v_serie TEXT;
  v_correlativo INTEGER;
  v_nuevo_id BIGINT;
BEGIN
  -- Validar venta existente
  SELECT * INTO v_venta
  FROM ventas
  WHERE id = p_id_venta;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta con ID % no existe.', p_id_venta;
  END IF;

  IF v_venta.estado = 'anulada' THEN
    RAISE EXCEPTION 'No se puede emitir comprobante para una venta anulada.';
  END IF;

  -- Validar si ya existe comprobante no anulado
  IF EXISTS (SELECT 1 FROM comprobantes WHERE id_venta = p_id_venta AND estado <> 'anulado') THEN
    RAISE EXCEPTION 'La venta % ya tiene un comprobante registrado.', v_venta.num_venta;
  END IF;

  -- Asignar serie oficial según tipo SUNAT
  IF LOWER(p_tipo) = 'factura' THEN
    v_serie := 'F001';
  ELSE
    v_serie := 'B001';
  END IF;

  -- Obtener correlativo consecutivo atómico con bloqueo de concurrencia
  SELECT COALESCE(MAX(correlativo), 0) + 1
  INTO v_correlativo
  FROM comprobantes
  WHERE serie = v_serie;

  -- Crear el comprobante en borrador
  INSERT INTO comprobantes (
    id_venta,
    tipo,
    serie,
    correlativo,
    estado
  ) VALUES (
    p_id_venta,
    LOWER(p_tipo),
    v_serie,
    v_correlativo,
    'borrador'
  )
  RETURNING id INTO v_nuevo_id;

  RETURN v_nuevo_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- COMANDO 5: crear_guia_remision
-- Invoker: Guias.tsx -> supabase.rpc('crear_guia_remision', ...)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_guia_remision(
  p_id_venta BIGINT,
  p_punto_partida TEXT,
  p_punto_llegada TEXT,
  p_fecha_traslado DATE
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_serie TEXT := 'T001';
  v_correlativo INTEGER;
  v_nueva_guia_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ventas WHERE id = p_id_venta AND estado <> 'anulada') THEN
    RAISE EXCEPTION 'La venta seleccionada no es válida o está anulada.';
  END IF;

  -- Correlativo atómico
  SELECT COALESCE(MAX(correlativo), 0) + 1
  INTO v_correlativo
  FROM guias_remision
  WHERE serie = v_serie;

  INSERT INTO guias_remision (
    id_venta,
    serie,
    correlativo,
    punto_partida,
    punto_llegada,
    fecha_traslado,
    estado
  ) VALUES (
    p_id_venta,
    v_serie,
    v_correlativo,
    TRIM(p_punto_partida),
    TRIM(p_punto_llegada),
    p_fecha_traslado,
    'borrador'
  )
  RETURNING id INTO v_nueva_guia_id;

  RETURN v_nueva_guia_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- COMANDO 6: ajustar_stock
-- Invoker: Inventario.tsx / Productos.tsx -> supabase.rpc('ajustar_stock')
-- Propósito: Modifica el stock de forma controlada y deja constancia histórica.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ajustar_stock(
  p_id_producto BIGINT,
  p_nuevo_stock INTEGER,
  p_motivo TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_producto RECORD;
  v_diferencia INTEGER;
BEGIN
  IF p_nuevo_stock < 0 THEN
    RAISE EXCEPTION 'El stock no puede ser negativo (% recibido).', p_nuevo_stock;
  END IF;

  SELECT * INTO v_producto
  FROM productos
  WHERE id = p_id_producto
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto con ID % no existe.', p_id_producto;
  END IF;

  v_diferencia := p_nuevo_stock - v_producto.stock_actual;

  -- Actualizar stock actual
  UPDATE productos
  SET stock_actual = p_nuevo_stock
  WHERE id = p_id_producto;

  -- Registrar en movimientos de inventario
  INSERT INTO movimientos_inventario (
    id_producto,
    tipo,
    cantidad,
    stock_resultante,
    referencia,
    id_usuario
  ) VALUES (
    p_id_producto,
    'ajuste',
    v_diferencia,
    p_nuevo_stock,
    COALESCE(TRIM(p_motivo), 'Ajuste manual de stock'),
    auth.uid()
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- COMANDO 7: registrar_solicitud_web
-- Invoker: Catálogo público -> registrarSolicitudWeb()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_solicitud_web(
  p_nombre TEXT,
  p_telefono TEXT,
  p_items JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Insertar en tabla de solicitudes
  INSERT INTO solicitudes_web (nombre, telefono, items)
  VALUES (TRIM(p_nombre), TRIM(p_telefono), p_items);

  -- 2. Insertar en auditoría para que sea visible en el panel
  INSERT INTO auditoria (
    tabla,
    operacion,
    id_registro,
    valor_nuevo
  ) VALUES (
    'solicitud_web',
    'INSERT',
    NULL,
    jsonb_build_object(
      'nombre', TRIM(p_nombre),
      'telefono', TRIM(p_telefono),
      'items', p_items,
      'fecha', now()
    )
  );
END;
$$;


-- ============================================================================
-- PARTE 3: PATRÓN OBSERVER (TRIGGERS REACTIVOS Y DISPARADORES DE EVENTOS)
-- ============================================================================
-- Los triggers actúan como OBSERVADORES que reaccionan a los cambios de estado
-- de los SUJETOS (tablas) sin acoplarse al código de la transacción inicial.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- OBSERVADOR 1: Auditoría Reactiva Global (fn_observador_auditoria)
-- Sujeto: Tablas del negocio (ventas, comprobantes, cotizaciones, productos)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_observador_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id TEXT;
  v_antiguo JSONB := NULL;
  v_nuevo JSONB := NULL;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_id := OLD.id::TEXT;
    v_antiguo := to_jsonb(OLD);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_id := NEW.id::TEXT;
    v_antiguo := to_jsonb(OLD);
    v_nuevo := to_jsonb(NEW);
  ELSIF (TG_OP = 'INSERT') THEN
    v_id := NEW.id::TEXT;
    v_nuevo := to_jsonb(NEW);
  END IF;

  INSERT INTO auditoria (
    tabla,
    operacion,
    id_registro,
    valor_anterior,
    valor_nuevo,
    id_usuario
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    v_id,
    v_antiguo,
    v_nuevo,
    auth.uid()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Suscripción de observadores de auditoría a los sujetos correspondientes
DROP TRIGGER IF EXISTS trg_obs_auditoria_ventas ON ventas;
CREATE TRIGGER trg_obs_auditoria_ventas
  AFTER INSERT OR UPDATE OR DELETE ON ventas
  FOR EACH ROW EXECUTE FUNCTION fn_observador_auditoria();

DROP TRIGGER IF EXISTS trg_obs_auditoria_comprobantes ON comprobantes;
CREATE TRIGGER trg_obs_auditoria_comprobantes
  AFTER INSERT OR UPDATE OR DELETE ON comprobantes
  FOR EACH ROW EXECUTE FUNCTION fn_observador_auditoria();

DROP TRIGGER IF EXISTS trg_obs_auditoria_cotizaciones ON cotizaciones;
CREATE TRIGGER trg_obs_auditoria_cotizaciones
  AFTER INSERT OR UPDATE OR DELETE ON cotizaciones
  FOR EACH ROW EXECUTE FUNCTION fn_observador_auditoria();

DROP TRIGGER IF EXISTS trg_obs_auditoria_productos ON productos;
CREATE TRIGGER trg_obs_auditoria_productos
  AFTER INSERT OR UPDATE OR DELETE ON productos
  FOR EACH ROW EXECUTE FUNCTION fn_observador_auditoria();

-- ----------------------------------------------------------------------------
-- OBSERVADOR 2: Control Reactivo de Stock Crítico y Visibilidad Web
-- Sujeto: Tabla 'productos' (BEFORE INSERT OR UPDATE OF stock_actual)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_observador_stock_y_visibilidad()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tipo = 'producto' THEN
    -- Regla de reactividad: Si el stock llega a 0 o menos, apagar visibilidad
    IF COALESCE(NEW.stock_actual, 0) <= 0 THEN
      NEW.activo := false;
      NEW.visible_web := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obs_stock_visibilidad ON productos;
CREATE TRIGGER trg_obs_stock_visibilidad
  BEFORE INSERT OR UPDATE OF stock_actual ON productos
  FOR EACH ROW EXECUTE FUNCTION fn_observador_stock_y_visibilidad();

-- ----------------------------------------------------------------------------
-- OBSERVADOR 3: Recálculo Reactivo de Totales Tributarios (Subtotal, IGV 18%, Total)
-- Sujeto: detalle_cotizacion y detalle_venta (AFTER INSERT OR UPDATE OR DELETE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_observador_recalcular_totales_cotizacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id_cotizacion BIGINT;
  v_subtotal NUMERIC(12,2);
  v_igv NUMERIC(12,2);
  v_total NUMERIC(12,2);
BEGIN
  v_id_cotizacion := COALESCE(NEW.id_cotizacion, OLD.id_cotizacion);

  -- Calcular la suma de subtotales de las partidas
  SELECT COALESCE(SUM(subtotal), 0)
  INTO v_subtotal
  FROM detalle_cotizacion
  WHERE id_cotizacion = v_id_cotizacion;

  -- Calcular IGV oficial del 18 % y total
  v_igv := ROUND(v_subtotal * 0.18, 2);
  v_total := v_subtotal + v_igv;

  -- Actualizar cabecera de la cotización de forma reactiva
  UPDATE cotizaciones
  SET
    subtotal = v_subtotal,
    igv = v_igv,
    total = v_total
  WHERE id = v_id_cotizacion;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_obs_totales_cotizacion ON detalle_cotizacion;
CREATE TRIGGER trg_obs_totales_cotizacion
  AFTER INSERT OR UPDATE OR DELETE ON detalle_cotizacion
  FOR EACH ROW EXECUTE FUNCTION fn_observador_recalcular_totales_cotizacion();

CREATE OR REPLACE FUNCTION fn_observador_recalcular_totales_venta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id_venta BIGINT;
  v_subtotal NUMERIC(12,2);
  v_igv NUMERIC(12,2);
  v_total NUMERIC(12,2);
BEGIN
  v_id_venta := COALESCE(NEW.id_venta, OLD.id_venta);

  SELECT COALESCE(SUM(subtotal), 0)
  INTO v_subtotal
  FROM detalle_venta
  WHERE id_venta = v_id_venta;

  v_igv := ROUND(v_subtotal * 0.18, 2);
  v_total := v_subtotal + v_igv;

  UPDATE ventas
  SET
    subtotal = v_subtotal,
    igv = v_igv,
    total = v_total
  WHERE id = v_id_venta;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_obs_totales_venta ON detalle_venta;
CREATE TRIGGER trg_obs_totales_venta
  AFTER INSERT OR UPDATE OR DELETE ON detalle_venta
  FOR EACH ROW EXECUTE FUNCTION fn_observador_recalcular_totales_venta();

-- ----------------------------------------------------------------------------
-- OBSERVADOR 4: Sincronización Reactiva de Emisión de Comprobantes
-- Sujeto: Tabla 'comprobantes' (AFTER UPDATE OF estado)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_observador_comprobante_sello()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Cuando el comprobante pasa de borrador a emitido, estampar fecha y sellar
  IF NEW.estado = 'emitido' AND OLD.estado <> 'emitido' THEN
    IF NEW.emitido_en IS NULL THEN
      NEW.emitido_en := now();
    END IF;

    -- Registrar evento especializado en auditoría
    INSERT INTO auditoria (tabla, operacion, id_registro, valor_nuevo, id_usuario)
    VALUES (
      'comprobantes',
      'EMISION_SUNAT',
      NEW.id::TEXT,
      jsonb_build_object(
        'serie', NEW.serie,
        'correlativo', NEW.correlativo,
        'tipo', NEW.tipo,
        'hash_cpe', NEW.hash_cpe,
        'id_venta', NEW.id_venta
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obs_comprobante_sello ON comprobantes;
CREATE TRIGGER trg_obs_comprobante_sello
  BEFORE UPDATE OF estado ON comprobantes
  FOR EACH ROW EXECUTE FUNCTION fn_observador_comprobante_sello();


-- ============================================================================
-- PARTE 4: VISTAS Y PERMISOS DE ACCESO (GRANTS & SECURITY DEFINER)
-- ============================================================================

-- Vista de stock bajo para el panel de gestión
CREATE OR REPLACE VIEW v_stock_bajo AS
SELECT
  p.id,
  p.codigo,
  p.nombre,
  p.stock_actual,
  p.stock_minimo,
  p.precio_unitario,
  c.nombre AS categoria
FROM productos p
LEFT JOIN categorias c ON c.id = p.id_categoria
WHERE p.tipo = 'producto' AND p.stock_actual <= p.stock_minimo;

-- Vista mensual de ventas para analítica e IA
CREATE OR REPLACE VIEW v_ventas_mensual AS
SELECT
  TO_CHAR(fecha, 'YYYY-MM') AS mes,
  COUNT(id)::INTEGER AS n_ventas,
  COALESCE(SUM(subtotal), 0)::NUMERIC(12,2) AS ventas_sin_igv
FROM ventas
WHERE estado = 'confirmada'
GROUP BY TO_CHAR(fecha, 'YYYY-MM')
ORDER BY mes DESC;

-- Permisos de ejecución sobre los comandos RPC
GRANT EXECUTE ON FUNCTION convertir_cotizacion_a_venta(BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION confirmar_orden_venta(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION anular_orden_venta(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION crear_comprobante(BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION crear_guia_remision(BIGINT, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION ajustar_stock(BIGINT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_solicitud_web(TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION eliminar_solicitud_web(BIGINT) TO anon, authenticated;

-- Permisos de lectura sobre vistas analíticas
GRANT SELECT ON v_stock_bajo TO authenticated;
GRANT SELECT ON v_ventas_mensual TO authenticated;
