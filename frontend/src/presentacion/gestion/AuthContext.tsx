import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Perfil, RolUsuario } from '../../datos/supabase';

/**
 * Sesión del panel de gestión: usuario de Supabase Auth + su perfil (rol).
 * Regla de negocio: un perfil sin fila en `perfiles` o con activo=false
 * NO entra (la RLS además lo bloquea a nivel de datos).
 */
export interface AuthGestionValue {
  session: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  /** Rol efectivo (null si aún no hay perfil). */
  rol: RolUsuario | null;
  puede: (...roles: RolUsuario[]) => boolean;
  entrar: (correo: string, clave: string) => Promise<string | null>;
  salir: () => Promise<void>;
  /** Recarga el perfil (útil tras cambiar el propio nombre). */
  refrescar: () => Promise<void>;
}

export const AuthGestionContext = createContext<AuthGestionValue | null>(null);

export function useAuthGestion(): AuthGestionValue {
  const ctx = useContext(AuthGestionContext);
  if (!ctx) throw new Error('useAuthGestion debe usarse dentro de AuthGestionProvider');
  return ctx;
}
