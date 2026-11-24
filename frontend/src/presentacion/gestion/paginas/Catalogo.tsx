import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase, mensajeErrorBD } from '../../../datos/supabase';
import { useAuthGestion } from '../AuthContext';
import { Aviso, Badge, Boton, Campo, Cargando, Modal, Pagina, Vacio } from '../ui';

interface ElementoCatalogo {
  id: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
}

type TipoCatalogo = 'categoria' | 'marca' | 'modelo';

const TIPOS: Record<TipoCatalogo, string> = {
  categoria: 'Categorías',
  marca: 'Marcas',
  modelo: 'Modelos',
};

export function Catalogo() {
  const { puede } = useAuthGestion();
  const puedeEditar = puede('admin', 'supervisor');

  const [tipo, setTipo] = useState<TipoCatalogo>('categoria');
  const [items, setItems] = useState<ElementoCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [seleccionado, setSeleccionado] = useState<ElementoCatalogo | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const { data, error: err } = await supabase.from(tipo).select('*').order('nombre');
    if (err) setError(mensajeErrorBD(err));
    setItems((data as ElementoCatalogo[]) || []);
    setCargando(false);
  }, [tipo]);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  const abrirNuevo = () => {
    setSeleccionado(null);
    setNombre('');
    setDescripcion('');
    setFormError(null);
    setModalAbierto(true);
  };

  const abrirEditar = (item: ElementoCatalogo) => {
    setSeleccionado(item);
    setNombre(item.nombre);
    setDescripcion(item.descripcion ?? '');
    setFormError(null);
    setModalAbierto(true);
  };

  const guardar = async () => {
    setFormError(null);
    if (!nombre.trim()) {
      setFormError('El nombre es obligatorio.');
      return;
    }
    setGuardando(true);
    try {
      const payload: { nombre: string; descripcion?: string | null } = {
        nombre: nombre.trim(),
      };
      if (tipo !== 'marca') {
        payload.descripcion = descripcion.trim() || null;
      }
      if (seleccionado) {
        const { error: err } = await supabase.from(tipo).update(payload).eq('id', seleccionado.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from(tipo).insert(payload);
        if (err) throw err;
      }
      setModalAbierto(false);
      await cargar();
    } catch (err) {
      setFormError(mensajeErrorBD(err));
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async (item: ElementoCatalogo) => {
    const { error: err } = await supabase.from(tipo).update({ activo: !item.activo }).eq('id', item.id);
    if (err) setError(mensajeErrorBD(err));
    else await cargar();
  };

  const eliminar = async (item: ElementoCatalogo) => {
    const { error: err } = await supabase.from(tipo).delete().eq('id', item.id);
    if (err) {
      const msg = /foreign key|viola/i.test(err.message || '')
        ? `No se puede eliminar "${item.nombre}": tiene productos asociados. Desactívalo en su lugar (RN-14).`
        : mensajeErrorBD(err);
      setError(msg);
    } else {
      await cargar();
    }
  };

  return (
    <Pagina
      titulo="Categorías, marcas y modelos"
      acciones={
        puedeEditar ? (
          <Boton onClick={abrirNuevo}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Nuevo
            </span>
          </Boton>
        ) : null
      }
    >
      <Aviso tipo="error">{error}</Aviso>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(Object.keys(TIPOS) as TipoCatalogo[]).map(t => (
          <button
            key={t}
            type="button"
            className={`g-btn g-btn-mini ${tipo === t ? '' : 'g-btn-fantasma'}`}
            onClick={() => setTipo(t)}
          >
            {TIPOS[t]}
          </button>
        ))}
      </div>

      <div className="g-tarjeta">
        {cargando ? (
          <Cargando />
        ) : items.length === 0 ? (
          <Vacio />
        ) : (
          <div className="g-tabla-wrap">
            <table className="g-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  {tipo !== 'marca' && <th>Descripción</th>}
                  <th>Estado</th>
                  {puedeEditar && <th />}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.nombre}</td>
                    {tipo !== 'marca' && <td>{item.descripcion || '—'}</td>}
                    <td>
                      <Badge valor={item.activo ? 'activo' : 'inactivo'} />
                    </td>
                    {puedeEditar && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="g-btn g-btn-fantasma g-btn-mini"
                          onClick={() => abrirEditar(item)}
                        >
                          Editar
                        </button>{' '}
                        <button
                          className="g-btn g-btn-fantasma g-btn-mini"
                          onClick={() => void alternarActivo(item)}
                        >
                          {item.activo ? 'Desactivar' : 'Activar'}
                        </button>{' '}
                        <button
                          className="g-btn g-btn-peligro g-btn-mini"
                          onClick={() => void eliminar(item)}
                          aria-label="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <Modal
          titulo={`${seleccionado ? 'Editar' : 'Nuevo'} · ${TIPOS[tipo]}`}
          onCerrar={() => setModalAbierto(false)}
        >
          <Aviso tipo="error">{formError}</Aviso>
          <Campo label="Nombre">
            <input
              className="g-input"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
            />
          </Campo>
          {tipo !== 'marca' && (
            <Campo label="Descripción">
              <textarea
                className="g-textarea"
                rows={2}
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
              />
            </Campo>
          )}
          <div style={{ display: 'flex', justifyItems: 'flex-end', justifyContent: 'flex-end', gap: 10 }}>
            <Boton variante="fantasma" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Boton>
            <Boton onClick={() => void guardar()} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </Modal>
      )}
    </Pagina>
  );
}

