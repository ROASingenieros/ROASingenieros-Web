-- 1. TABLAS
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  brand TEXT,
  specs TEXT[] DEFAULT '{}',
  chip TEXT,
  color_class TEXT,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  location TEXT,
  last_restocked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEX
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(stock) WHERE stock < min_stock;

-- AUTO-UPDATE updated_at TRIGGER
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ROW LEVEL SECURITY
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- NOTE: admin_profiles NO tiene RLS activado porque las políticas de otras
-- tablas (products, categories, inventory) consultan admin_profiles para
-- verificar roles. Si admin_profiles tuviera RLS, se produciría el error:
-- "infinite recursion detected in policy for relation admin_profiles"
-- (Las políticas de admin_profiles consultarían admin_profiles, causando un loop infinito)

-- Public read access for active products and categories
CREATE POLICY "Public can view active products"
  ON products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public can view categories"
  ON categories FOR SELECT
  TO public
  USING (true);

-- Admin full access policies
-- Estas políticas consultan admin_profiles para verificar roles.
-- Como admin_profiles NO tiene RLS, no hay riesgo de recursión infinita.
CREATE POLICY "Admin can manage products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

CREATE POLICY "Admin can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

CREATE POLICY "Admin can view inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admin can manage inventory"
  ON inventory FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );


-- Insert categories
INSERT INTO categories (name, slug, description, icon) VALUES
  ('Electricidad', 'electricidad', 'Productos eléctricos domiciliarios e industriales', 'Zap'),
  ('Seguridad Electrónica', 'seguridad', 'Alarmas, CCTV, cercos eléctricos y barreras', 'Camera'),
  ('Pozos a Tierra', 'pozos-tierra', 'Materiales y equipos para sistemas de puesta a tierra', 'Cpu'),
  ('Torres', 'torres', 'Torres de pararrayos y comunicación', 'TowerControl')
ON CONFLICT (slug) DO NOTHING;

-- Insert sample products
INSERT INTO products (name, slug, category_id, subcategory, price, brand, specs, chip, color_class, description) 
SELECT 'Tablero Eléctrico General 24 polos', 'tablero-electrico-24p', id, 'Tableros Eléctricos', 450.00, 'ROAS / Schneider', ARRAY['Gabinete metálico IP65', 'Capacidad 24 polos', 'Barra de tierra y neutro', 'Puerta con chapa de seguridad'], 'TAB24', 'electric-color', 'Tablero eléctrico general para distribución de energía.'
FROM categories WHERE slug = 'electricidad';

INSERT INTO products (name, slug, category_id, subcategory, price, brand, specs, chip, color_class, description)
SELECT 'Panel de Alarma Contra Incendio 4Z', 'panel-alarma-4z', id, 'Alarmas Contra Incendio', 720.00, 'Mircom / Bosch', ARRAY['Central de control 4 zonas', 'Soporta detectores de humo', 'Salida de sirena 24V', 'Batería de respaldo'], 'PANEL', 'security-color', 'Panel de control para sistemas de alarma contra incendio.'
FROM categories WHERE slug = 'seguridad';

INSERT INTO products (name, slug, category_id, subcategory, price, brand, specs, chip, color_class, description)
SELECT 'Varilla Copperweld 5/8" x 1.5m', 'varilla-copperweld', id, 'Materiales', 85.00, 'ROAS Certified', ARRAY['Acero recubierto de cobre', 'Diámetro 5/8 pulgada', 'Longitud 1.50 metros', 'Conexión roscada'], 'COPP', 'ground-color', 'Varilla para sistemas de puesta a tierra.'
FROM categories WHERE slug = 'pozos-tierra';

INSERT INTO products (name, slug, category_id, subcategory, price, brand, specs, chip, color_class, description)
SELECT 'Torre Pararrayos 12m Autosoportada', 'torre-pararrayos-12m', id, 'Pararrayos', 3200.00, 'ROAS Towers', ARRAY['Torre autosoportada galvanizada', 'Altura 12 metros', 'Incluye punta Franklin', 'Anclaje a cimentación'], 'TOR12', 'tower-color', 'Torre pararrayos autosoportada de 12 metros.'
FROM categories WHERE slug = 'torres';

-- Insert initial inventory records
INSERT INTO inventory (product_id, stock, min_stock, location)
SELECT id, 10, 3, 'Almacén Principal' FROM products WHERE slug = 'tablero-electrico-24p';

INSERT INTO inventory (product_id, stock, min_stock, location)
SELECT id, 5, 2, 'Almacén Principal' FROM products WHERE slug = 'panel-alarma-4z';

INSERT INTO inventory (product_id, stock, min_stock, location)
SELECT id, 50, 10, 'Almacén Principal' FROM products WHERE slug = 'varilla-copperweld';

INSERT INTO inventory (product_id, stock, min_stock, location)
SELECT id, 3, 1, 'Almacén Externo' FROM products WHERE slug = 'torre-pararrayos-12m';

-- ============================================================================
-- 5. REGLAS Y RESTRICCIONES DE INTEGRIDAD EN BACKEND (POSTGRESQL CHECKS)
-- ============================================================================
-- Garantizan a nivel de motor de base de datos que no se puedan insertar
-- números en nombres, letras en teléfonos ni caracteres especiales en apellidos.

DO $$
BEGIN
  -- Restricciones para tabla empleados (si existe en el esquema activo)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'empleados') THEN
    ALTER TABLE empleados DROP CONSTRAINT IF EXISTS chk_empleados_nombres_sin_numeros;
    ALTER TABLE empleados ADD CONSTRAINT chk_empleados_nombres_sin_numeros 
      CHECK (nombres !~ '[0-9]');

    ALTER TABLE empleados DROP CONSTRAINT IF EXISTS chk_empleados_apellidos_limpios;
    ALTER TABLE empleados ADD CONSTRAINT chk_empleados_apellidos_limpios 
      CHECK (apellidos !~ '[0-9]' AND apellidos ~ '^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s''-]+$');

    ALTER TABLE empleados DROP CONSTRAINT IF EXISTS chk_empleados_telefono_sin_letras;
    ALTER TABLE empleados ADD CONSTRAINT chk_empleados_telefono_sin_letras 
      CHECK (telefono IS NULL OR telefono !~ '[a-zA-Z]');

    ALTER TABLE empleados DROP CONSTRAINT IF EXISTS chk_empleados_correo_formato;
    ALTER TABLE empleados ADD CONSTRAINT chk_empleados_correo_formato 
      CHECK (correo IS NULL OR correo ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;

  -- Restricciones para tabla clientes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clientes') THEN
    ALTER TABLE clientes DROP CONSTRAINT IF EXISTS chk_clientes_telefono_sin_letras;
    ALTER TABLE clientes ADD CONSTRAINT chk_clientes_telefono_sin_letras 
      CHECK (telefono IS NULL OR telefono !~ '[a-zA-Z]');

    ALTER TABLE clientes DROP CONSTRAINT IF EXISTS chk_clientes_apellidos_limpios;
    ALTER TABLE clientes ADD CONSTRAINT chk_clientes_apellidos_limpios 
      CHECK (apellidos IS NULL OR (apellidos !~ '[0-9]' AND apellidos ~ '^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s''-]+$'));

    ALTER TABLE clientes DROP CONSTRAINT IF EXISTS chk_clientes_correo_formato;
    ALTER TABLE clientes ADD CONSTRAINT chk_clientes_correo_formato 
      CHECK (correo IS NULL OR correo ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
    -- Si es persona natural (tiene apellidos registrados), el nombre no puede llevar números
    ALTER TABLE clientes DROP CONSTRAINT IF EXISTS chk_clientes_nombres_sin_numeros;
    ALTER TABLE clientes ADD CONSTRAINT chk_clientes_nombres_sin_numeros
      CHECK (apellidos IS NULL OR nombre_razon_social !~ '[0-9]');
  END IF;

  -- Restricciones para tabla proveedores
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedores') THEN
    ALTER TABLE proveedores DROP CONSTRAINT IF EXISTS chk_proveedores_ruc_11;
    ALTER TABLE proveedores ADD CONSTRAINT chk_proveedores_ruc_11 
      CHECK (ruc ~ '^[0-9]{11}$');

    ALTER TABLE proveedores DROP CONSTRAINT IF EXISTS chk_proveedores_telefono_sin_letras;
    ALTER TABLE proveedores ADD CONSTRAINT chk_proveedores_telefono_sin_letras 
      CHECK (telefono IS NULL OR telefono !~ '[a-zA-Z]');

    ALTER TABLE proveedores DROP CONSTRAINT IF EXISTS chk_proveedores_correo_formato;
    ALTER TABLE proveedores ADD CONSTRAINT chk_proveedores_correo_formato 
      CHECK (correo IS NULL OR correo ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;

  -- Restricciones para tabla perfiles (usuarios del panel)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'perfiles') THEN
    ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS chk_perfiles_nombre_sin_numeros;
    ALTER TABLE perfiles ADD CONSTRAINT chk_perfiles_nombre_sin_numeros 
      CHECK (nombre !~ '[0-9]');
  END IF;
END $$;

-- ============================================================================
-- 6. RPC: ELIMINAR SOLICITUD WEB (CON ELEVACIÓN DE PRIVILEGIOS SECURITY DEFINER)
-- ============================================================================
-- Resuelve el problema de permisos RLS al eliminar cotizaciones web y sus registros de auditoría
CREATE OR REPLACE FUNCTION eliminar_solicitud_web(p_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Eliminar de la tabla auditoria si la solicitud está registrada allí (como hace registrar_solicitud_web)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auditoria') THEN
    DELETE FROM auditoria WHERE id = p_id AND tabla = 'solicitud_web';
  END IF;

  -- 2. Eliminar de la tabla solicitudes_web si existe como tabla dedicada
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'solicitudes_web') THEN
    DELETE FROM solicitudes_web WHERE id = p_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION eliminar_solicitud_web(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION eliminar_solicitud_web(BIGINT) TO anon;

-- Política RLS para permitir eliminación de solicitudes web en auditoria si RLS está activo
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auditoria') THEN
    DROP POLICY IF EXISTS "Permitir eliminar auditoria" ON auditoria;
    CREATE POLICY "Permitir eliminar auditoria" ON auditoria
      FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================================
-- 7. TRIGGER: AUTO-DESACTIVAR PRODUCTOS SIN STOCK
-- ============================================================================
-- Cuando un producto se inserte o actualice con stock <= 0, se marca
-- automáticamente como inactivo (activo = false) y se oculta de la web (visible_web = false).
CREATE OR REPLACE FUNCTION desactivar_productos_sin_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'producto' AND COALESCE(NEW.stock_actual, 0) <= 0 THEN
    NEW.activo := false;
    NEW.visible_web := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'productos') THEN
    DROP TRIGGER IF EXISTS trg_desactivar_sin_stock ON productos;
    CREATE TRIGGER trg_desactivar_sin_stock
      BEFORE INSERT OR UPDATE OF stock_actual ON productos
      FOR EACH ROW
      EXECUTE FUNCTION desactivar_productos_sin_stock();
  END IF;
END $$;
