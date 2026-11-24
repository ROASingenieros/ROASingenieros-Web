import { useEffect } from 'react';
import { useAuthGestion } from './AuthContext';
import { AuthGestionProvider } from './AuthGestionProvider';
import { useRutaGestion, useIrA } from './router';
import { Login } from './paginas/Login';
import { Panel } from './paginas/Panel';
import { Productos } from './paginas/Productos';
import { Catalogo } from './paginas/Catalogo';
import { Inventario } from './paginas/Inventario';
import { Clientes } from './paginas/Clientes';
import { Cotizaciones } from './paginas/Cotizaciones';
import { Solicitudes } from './paginas/Solicitudes';
import { Ventas } from './paginas/Ventas';
import { Comprobantes } from './paginas/Comprobantes';
import { Guias } from './paginas/Guias';
import { Garantias } from './paginas/Garantias';
import { Compras } from './paginas/Compras';
import { Personal } from './paginas/Personal';
import { Reportes } from './paginas/Reportes';
import { Usuarios } from './paginas/Usuarios';
import { Auditoria } from './paginas/Auditoria';
import type { RolUsuario } from '../../datos/supabase';
import './gestion.css';

// ============================================================================
// Menú por rol (matriz de permisos de PROMPT_ROAS.md)
// ============================================================================
interface ItemMenu {
  ruta: string;
  etiqueta: string;
  roles: RolUsuario[];
}

const MENU: { grupo: string; items: ItemMenu[] }[] = [
  {
    grupo: 'Operación diaria',
    items: [
      { ruta: 'panel', etiqueta: 'Panel', roles: ['admin', 'supervisor'] },
      { ruta: 'clientes', etiqueta: 'Clientes', roles: ['admin', 'supervisor', 'secretaria'] },
      { ruta: 'cotizaciones', etiqueta: 'Cotizaciones', roles: ['admin', 'supervisor', 'secretaria'] },
      { ruta: 'solicitudes', etiqueta: 'Solicitudes web', roles: ['admin'] },
      { ruta: 'ventas', etiqueta: 'Órdenes de venta', roles: ['admin', 'supervisor', 'secretaria'] },
      { ruta: 'comprobantes', etiqueta: 'Comprobantes', roles: ['admin', 'supervisor', 'secretaria'] },
      { ruta: 'guias', etiqueta: 'Guías de remisión', roles: ['admin', 'supervisor', 'secretaria'] },
      { ruta: 'garantias', etiqueta: 'Garantías', roles: ['admin', 'supervisor', 'secretaria'] },
    ],
  },
  {
    grupo: 'Catálogo e inventario',
    items: [
      { ruta: 'productos', etiqueta: 'Productos y servicios', roles: ['admin', 'supervisor', 'secretaria'] },
      { ruta: 'catalogo', etiqueta: 'Categorías / marcas', roles: ['admin', 'supervisor', 'secretaria'] },
      { ruta: 'inventario', etiqueta: 'Inventario', roles: ['admin', 'supervisor', 'secretaria'] },
    ],
  },
  {
    grupo: 'Gerencia',
    items: [
      { ruta: 'compras', etiqueta: 'Compras a proveedor', roles: ['admin'] },
      { ruta: 'personal', etiqueta: 'Personal y pagos', roles: ['admin'] },
      { ruta: 'reportes', etiqueta: 'Reportes', roles: ['admin', 'supervisor'] },
      { ruta: 'usuarios', etiqueta: 'Usuarios y roles', roles: ['admin'] },
      { ruta: 'auditoria', etiqueta: 'Auditoría', roles: ['admin'] },
    ],
  },
];

// ============================================================================
// Contenido según la ruta y el rol
// ============================================================================
function Contenido() {
  const { perfil, rol, cargando, salir, puede } = useAuthGestion();
  const [pagina, id] = useRutaGestion();
  const irA = useIrA();

  // El rol cambió o el usuario salió: volver al login (hash limpio).
  useEffect(() => {
    if (!cargando && !perfil) {
      // AuthContext ya se encargó; el render de Login ocurre abajo.
    }
  }, [cargando, perfil]);

  if (cargando) {
    return <div className="g-cargando">Verificando sesión…</div>;
  }

  if (!perfil) {
    return <Login />;
  }

  const itemVisible = (i: ItemMenu) => (rol ? i.roles.includes(rol) : false);

  return (
    <div className="g-shell">
      <aside className="g-sidebar no-print">
        <div className="g-marca">
          <div>
            <div className="g-marca-titulo">ROAS</div>
            <div className="g-marca-sub">Gestión</div>
          </div>
        </div>

        {MENU.map((grupo) => {
          const visibles = grupo.items.filter(itemVisible);
          if (visibles.length === 0) return null;
          return (
            <div key={grupo.grupo}>
              <div className="g-grupo-label">{grupo.grupo}</div>
              {visibles.map((item) => (
                <button
                  key={item.ruta}
                  type="button"
                  className={`g-nav-item ${pagina === item.ruta ? 'g-nav-item-activo' : ''}`}
                  onClick={() => irA(item.ruta)}
                >
                  {item.etiqueta}
                </button>
              ))}
              <div className="g-sep" />
            </div>
          );
        })}

        <div style={{ marginTop: 'auto', padding: '10px' }}>
          <div className="g-usuario" style={{ marginBottom: 10 }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{perfil.nombre}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{perfil.rol}</div>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="g-btn g-btn-fantasma g-btn-mini"
              style={{ width: '100%' }}
              onClick={() => { void salir(); irA(''); }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <main className="g-main">
        <RutaPagina pagina={pagina} id={id} puede={puede} />
      </main>
    </div>
  );
}

function RutaPagina({
  pagina,
  id,
  puede,
}: {
  pagina: string;
  id: string;
  puede: (...roles: RolUsuario[]) => boolean;
}) {
  switch (pagina) {
    case 'panel': return puede('admin', 'supervisor') ? <Panel /> : <Denegado />;
    case 'productos': return puede('admin', 'supervisor', 'secretaria') ? <Productos /> : <Denegado />;
    case 'catalogo': return puede('admin', 'supervisor', 'secretaria') ? <Catalogo /> : <Denegado />;
    case 'inventario': return puede('admin', 'supervisor', 'secretaria') ? <Inventario /> : <Denegado />;
    case 'clientes': return puede('admin', 'supervisor', 'secretaria') ? <Clientes /> : <Denegado />;
    case 'cotizaciones': return puede('admin', 'supervisor', 'secretaria') ? <Cotizaciones id={id} /> : <Denegado />;
    case 'solicitudes': return puede('admin') ? <Solicitudes /> : <Denegado />;
    case 'ventas': return puede('admin', 'supervisor', 'secretaria') ? <Ventas id={id} /> : <Denegado />;
    case 'comprobantes': return puede('admin', 'supervisor', 'secretaria') ? <Comprobantes /> : <Denegado />;
    case 'guias': return puede('admin', 'supervisor', 'secretaria') ? <Guias /> : <Denegado />;
    case 'garantias': return puede('admin', 'supervisor', 'secretaria') ? <Garantias /> : <Denegado />;
    case 'compras': return puede('admin') ? <Compras /> : <Denegado />;
    case 'personal': return puede('admin') ? <Personal /> : <Denegado />;
    case 'reportes': return puede('admin', 'supervisor') ? <Reportes /> : <Denegado />;
    case 'usuarios': return puede('admin') ? <Usuarios /> : <Denegado />;
    case 'auditoria': return puede('admin') ? <Auditoria /> : <Denegado />;
    default: return puede('admin', 'supervisor') ? <Panel /> : <Denegado />;
  }
}

function Denegado() {
  return (
    <div className="g-vacio" style={{ paddingTop: 80 }}>
      No tienes permiso para esta sección. Tu rol no incluye este módulo.
    </div>
  );
}

/** Punto de entrada del panel: se monta bajo #/gestion. */
export function GestionApp() {
  return (
    <AuthGestionProvider>
      <Contenido />
    </AuthGestionProvider>
  );
}
