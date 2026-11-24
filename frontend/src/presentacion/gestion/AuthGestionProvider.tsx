import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Perfil, type RolUsuario } from '../../datos/supabase';
import { AuthGestionContext, type AuthGestionValue } from './AuthContext';

export function AuthGestionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarPerfil = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setPerfil(null);
      return;
    }
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre, rol, activo, creado_en')
      .eq('id', userId)
      .maybeSingle();
    // Un usuario sin perfil activo no opera en el panel.
    setPerfil(data && data.activo ? (data as Perfil) : null);
  }, []);

  useEffect(() => {
    let vivo = true;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;
      setSession(data.session ?? null);
      await cargarPerfil(data.session?.user.id);
      if (vivo) setCargando(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evento, nueva) => {
      if (!vivo) return;
      setSession(nueva ?? null);
      await cargarPerfil(nueva?.user.id);
      setCargando(false);
    });

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [cargarPerfil]);

  const entrar = useCallback(async (correo: string, clave: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
    if (error) {
      return error.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : error.message;
    }
    await cargarPerfil(data.user?.id);
    return null;
  }, [cargarPerfil]);

  const salir = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setPerfil(null);
  }, []);

  const refrescar = useCallback(async () => {
    await cargarPerfil(session?.user.id);
  }, [cargarPerfil, session?.user.id]);

  const value = useMemo<AuthGestionValue>(() => ({
    session,
    perfil,
    cargando,
    rol: perfil?.rol ?? null,
    puede: (...roles: RolUsuario[]) => !!perfil && roles.includes(perfil.rol),
    entrar,
    salir,
    refrescar,
  }), [session, perfil, cargando, entrar, salir, refrescar]);

  return (
    <AuthGestionContext.Provider value={value}>
      {children}
    </AuthGestionContext.Provider>
  );
}
