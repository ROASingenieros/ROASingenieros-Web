import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShoppingBag, Tag, Zap, Camera, Cpu, TowerControl, Flame, Shield, Building2, Star } from 'lucide-react';
import { supabase } from '../../../datos/supabase';
import { Reveal } from './Reveal';
import { ProductSkeleton } from './ProductSkeleton';
import { ParallaxItem } from './ParallaxItem';
import { useCart } from '../contexto/CartContext';
import './ProductCatalog.css';

interface Product {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: string;
  brand: string;
  specs: string[];
  chip: string;
  colorClass: string;
  imageUrl: string | null;
}

interface DbCategory {
  id: number;
  nombre: string;
}

/** Fila cruda de `productos` tal como la devuelve el select del catálogo. */
interface DbProducto {
  id: number;
  nombre: string;
  tipo: string;
  codigo: string | null;
  imagen_url: string | null;
  precio_unitario: number;
  stock_actual: number;
  unidad_medida: string | null;
  categoria?: { nombre: string } | null;
  marca?: { nombre: string } | null;
}

const iconMap: Record<string, React.ReactNode> = {
  Zap: <Zap size={14} />,
  Camera: <Camera size={14} />,
  Cpu: <Cpu size={14} />,
  TowerControl: <TowerControl size={14} />,
  Flame: <Flame size={14} />,
  Shield: <Shield size={14} />,
  Building2: <Building2 size={14} />,
};

/** Mapea el nombre de la categoría a la clase de color del avatar de respaldo. */
function colorDeCategoria(nombre: string): string {
  const n = (nombre || '').toLowerCase();
  if (n.includes('seguridad') || n.includes('alarma') || n.includes('cctv')) return 'security-color';
  if (n.includes('tierra') || n.includes('pozo') || n.includes('copper')) return 'ground-color';
  if (n.includes('torre') || n.includes('pararray')) return 'tower-color';
  return 'electric-color';
}

/** Icono sugerido por palabra clave del nombre de la categoría. */
function iconoDeCategoria(nombre: string): React.ReactNode {
  const n = (nombre || '').toLowerCase();
  if (n.includes('seguridad') || n.includes('alarma')) return iconMap.Camera;
  if (n.includes('tierra') || n.includes('pozo')) return iconMap.Cpu;
  if (n.includes('torre') || n.includes('pararray')) return iconMap.TowerControl;
  if (n.includes('incendio') || n.includes('fuego')) return iconMap.Flame;
  if (n.includes('electric') || n.includes('cable')) return iconMap.Zap;
  return null;
}

/** Letras del producto para el avatar de respaldo (cuando no hay imagen). */
function iniciales(nombre: string): string {
  const partes = (nombre || '').trim().split(/\s+/).slice(0, 2);
  return partes.map((p) => p.charAt(0).toUpperCase()).join('') || 'RO';
}

export const ProductCatalog: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [isDbReady, setIsDbReady] = useState(false);
  const [isConnected] = useState(!!import.meta.env.VITE_SUPABASE_URL);
  const [isLoading, setIsLoading] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [addingId, setAddingId] = useState<string | null>(null);
  const { addToCart } = useCart();
  const addTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleImgError = useCallback((productId: string) => {
    setImgErrors(prev => ({ ...prev, [productId]: true }));
  }, []);

  const handleAddToCart = useCallback((product: Product) => {
    addToCart(product);
    setAddingId(product.id);
    if (addTimeoutRef.current) clearTimeout(addTimeoutRef.current);
    addTimeoutRef.current = setTimeout(() => setAddingId(null), 800);
  }, [addToCart]);

  useEffect(() => {
    return () => {
      if (addTimeoutRef.current) clearTimeout(addTimeoutRef.current);
    };
  }, []);

  // Categorías activas (anon solo ve las activas por RLS).
  useEffect(() => {
    if (!isConnected) return;
    const loadCategories = async () => {
      const { data } = await supabase
        .from('categoria')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      if (data) setCategories(data as DbCategory[]);
    };
    loadCategories();
  }, [isConnected]);

  // Productos visibles en la web (RLS: activo AND visible_web; aquí además stock > 0).
  useEffect(() => {
    const loadFromDb = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);

        const { data, error } = await supabase
          .from('productos')
          .select('id, nombre, tipo, codigo, descripcion, imagen_url, precio_unitario, stock_actual, unidad_medida, id_categoria, categoria(nombre), marca(nombre)')
          .eq('activo', true)
          .eq('visible_web', true)
          .eq('tipo', 'producto')
          .gt('stock_actual', 0)
          .order('nombre');

        if (error) throw error;
        if (data) {
          const mapped = (data as unknown as DbProducto[])
            .filter((p) => (p.stock_actual ?? 0) > 0)
            .map((p) => {
            const catNombre = p.categoria?.nombre || 'Electricidad';
            return {
              id: String(p.id),
              name: p.nombre,
              category: catNombre,
              subcategory: p.unidad_medida || '',
              // El sitio muestra el precio final: precio unitario sin IGV + IGV 18 %.
              price: `S/ ${(Number(p.precio_unitario) * 1.18).toFixed(2)}`,
              brand: p.marca?.nombre || '',
              specs: [
                p.codigo ? `Cód. ${p.codigo}` : null,
                p.stock_actual > 0 ? `${p.stock_actual} disp.` : null,
              ].filter(Boolean) as string[],
              chip: iniciales(p.nombre),
              colorClass: colorDeCategoria(catNombre),
              imageUrl: p.imagen_url || null,
            };
          });
          setProducts(mapped);
          setIsDbReady(true);
        }
      } catch (e) {
        console.error('Error loading from Supabase:', e);
      } finally {
        setIsLoading(false);
      }
    };
    void (async () => {
      if (isConnected) await loadFromDb();
      else setIsLoading(false);
    })();
  }, [isConnected]);

  // Pestañas: "Todos" + categorías activas que tengan productos visibles.
  const categoriasConProductos = new Set(products.map((p) => p.category));
  const tabs = [
    { id: 'todos', label: 'Todos', icon: null as React.ReactNode },
    ...categories
      .filter((cat) => categoriasConProductos.has(cat.nombre))
      .map((cat) => ({
        id: cat.nombre,
        label: cat.nombre,
        icon: iconoDeCategoria(cat.nombre),
      })),
  ];

  const filteredProducts =
    activeCategory === 'todos'
      ? products
      : products.filter((p) => p.category === activeCategory);

  return (
    <section id="catalog" className="catalog-section">
      <div className="catalog-container">
        <div className="section-header">
          <div className="section-eyebrow">
            <span className="eyebrow-pulse"></span>
            <span>CATÁLOGO TÉCNICO & SUMINISTROS</span>
          </div>
          <h1 className="section-title">Tienda de Ingeniería Eléctrica</h1>
          <p className="section-description">
            Suministro de materiales y equipos para instalaciones eléctricas, seguridad electrónica,{' '}
            pozos a tierra y torres especializadas. Precios con IGV incluido.{' '}
            {isDbReady ? 'Catálogo sincronizado desde el sistema.' : ''}
          </p>
        </div>

        <Reveal delay={200}>
          <ParallaxItem speed={0.05} clamp={12}>
            <div className="catalog-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`tab-pill ${activeCategory === tab.id ? 'tab-pill-active' : ''}`}
                  onClick={() => setActiveCategory(tab.id)}
                >
                  {tab.icon && <span className="tab-icon">{tab.icon}</span>}
                  {tab.label}
                </button>
              ))}
            </div>
          </ParallaxItem>
        </Reveal>

        <div className="products-grid">
            {isLoading ? (
              <ProductSkeleton count={8} />
            ) : !isConnected ? (
              <div className="catalog-empty-db">
                <p>Conecta Supabase para ver los productos.</p>
                <p className="catalog-empty-hint">
                  Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="catalog-empty-db">
                <p>No hay productos disponibles en este momento.</p>
                <p className="catalog-empty-hint">
                  El catálogo se alimenta desde el sistema de gestión de ROAS Ingenieros.
                </p>
              </div>
            ) : (
              filteredProducts.map((product, pIdx) => (
                <ParallaxItem
                  key={product.id}
                  as="div"
                  className="product-card glass-panel"
                  speed={0.08 + (pIdx % 4) * 0.03}
                  clamp={20}
                >
                  {/* IMAGE AREA - Full width, prominent */}
                  <div className="product-image-section">
                    {product.imageUrl && !imgErrors[product.id] ? (
                      <div className="product-image-wrapper">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="product-image"
                          loading="lazy"
                          onError={() => handleImgError(product.id)}
                        />
                        <div className="product-image-shimmer" />
                      </div>
                    ) : (
                      <div className={`product-avatar-fallback ${product.colorClass}`}>
                        <span className="avatar-chip">{product.chip}</span>
                      </div>
                    )}
                    {/* Brand badge overlay */}
                    {product.brand && (
                      <div className="product-brand-badge">
                        <Tag size={10} />
                        <span>{product.brand}</span>
                      </div>
                    )}
                    {/* Subcategory badge */}
                    {product.subcategory && (
                      <div className="product-subcategory-badge">
                        {product.subcategory}
                      </div>
                    )}
                  </div>

                  {/* INFO AREA */}
                  <div className="product-info-area">
                    <h3 className="product-name">{product.name}</h3>

                    <div className="product-price-row">
                      <span className="product-price">{product.price}</span>
                    </div>

                    {product.specs.length > 0 && (
                      <div className="product-specs-chips">
                        {product.specs.slice(0, 3).map((spec, i) => (
                          <span key={i} className="spec-chip">{spec}</span>
                        ))}
                        {product.specs.length > 3 && (
                          <span className="spec-chip spec-chip-more">+{product.specs.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ADD TO CART BUTTON */}
                  <button
                    type="button"
                    className={`add-to-cart-btn ${addingId === product.id ? 'add-to-cart-adding' : ''}`}
                    onClick={() => handleAddToCart(product)}
                    disabled={addingId === product.id}
                  >
                    <span className="btn-content">
                      <ShoppingBag size={14} className="btn-cart-icon" />
                      <span className="btn-text">Añadir a Cotización</span>
                      <span className="btn-check">
                        <Star size={14} />
                      </span>
                    </span>
                  </button>
                </ParallaxItem>
              ))
            )}
          </div>
      </div>
    </section>
  );
};
