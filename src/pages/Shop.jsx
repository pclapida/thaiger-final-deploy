import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { inputClasses } from '../components/ui/Field';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { products as productsApi } from '../services/api';
import {
  EMPTY_FILTERS,
  applyCatalogFilters,
  buildFilterGroups,
  filtersFromLocation,
  hasActiveFilters,
  includesLoose,
  toggleFilter,
} from '../lib/catalog';
import { backdrop, drawer, fadeUp, resolveVariants } from '../lib/motion';

const ORDENES = [
  { valor: 'relevance', etiqueta: 'Relevancia' },
  { valor: 'price_asc', etiqueta: 'Precio: menor a mayor' },
  { valor: 'price_desc', etiqueta: 'Precio: mayor a menor' },
  { valor: 'name_asc', etiqueta: 'Nombre: A - Z' },
  { valor: 'name_desc', etiqueta: 'Nombre: Z - A' },
];

const NOMBRE_GRUPO = { brand: 'Marca', category: 'Categoría', price: 'Precio' };

/** Mismo selector que usa `ui/Modal.jsx` para atrapar el tabulador. */
const FOCALIZABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Acepta un valor suelto o una lista y siempre devuelve una lista limpia. */
function comoLista(valor) {
  if (Array.isArray(valor)) return valor.filter(Boolean);
  return valor ? [valor] : [];
}

/**
 * Filtros con los que arranca la página.
 *
 * `filtersFromLocation` entiende marca y búsqueda; el inicio además navega con
 * una o varias categorías (`state.category`), así que se completan aquí sin
 * tocar la librería de catálogo.
 */
function filtrosIniciales(state) {
  return {
    ...filtersFromLocation(state),
    brand: comoLista(state?.brand),
    category: comoLista(state?.category),
  };
}

function contarFiltros(filtros) {
  return (
    filtros.brand.length +
    filtros.category.length +
    filtros.price.length +
    (filtros.search.trim() ? 1 : 0)
  );
}

/** Id estable y válido para asociar cada casilla con su etiqueta. */
function claveId(valor) {
  return String(valor)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Panel de casillas. Se pinta dos veces —barra lateral en escritorio y cajón en
 * móvil—, de ahí el prefijo: dos casillas nunca comparten el mismo `id`.
 */
function PanelFiltros({ grupos, filtros, alAlternar, prefijo }) {
  if (grupos.length === 0) {
    return <p className="text-sm text-gray-400">Los filtros aparecerán cuando cargue el catálogo.</p>;
  }

  return (
    <div className="space-y-4">
      {grupos.map((grupo) => (
        <fieldset key={grupo.id} className="superficie rounded-xl px-4 py-4">
          <legend className="px-1 text-xs font-black uppercase tracking-widest text-brand-500">
            {grupo.title}
          </legend>

          <ul className="custom-scrollbar mt-2 max-h-64 space-y-0.5 overflow-y-auto pr-1">
            {grupo.items.map((item) => {
              const id = `${prefijo}-${grupo.id}-${claveId(item)}`;
              const activo = includesLoose(filtros[grupo.id], item);

              return (
                <li key={item}>
                  <label
                    htmlFor={id}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-2 text-sm transition-colors hover:bg-carbon-700 ${
                      activo ? 'font-semibold text-white' : 'text-gray-400'
                    }`}
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={activo}
                      onChange={() => alAlternar(grupo.id, item)}
                      className="h-4 w-4 shrink-0 accent-brand-600"
                    />
                    <span className="min-w-0 flex-1 truncate">{item}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}

export default function Shop() {
  useDocumentTitle(
    'Catálogo',
    'Todo el catálogo de suplementos Thaiger: proteína, creatina, pre-entrenos y más, con envío a todo México.'
  );

  const location = useLocation();
  const reduced = useReducedMotion();

  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [orden, setOrden] = useState('relevance');
  const [filtros, setFiltros] = useState(() => filtrosIniciales(location.state));
  const [panelAbierto, setPanelAbierto] = useState(false);

  // El cajón de filtros es una capa modal: necesita el panel y el botón que lo
  // abrió para llevar y devolver el foco.
  const cajonRef = useRef(null);
  const disparadorRef = useRef(null);

  // Al volver a /shop con otra marca o búsqueda (desde Marcas, el inicio o el
  // buscador) los filtros se resincronizan durante el render, sin efectos.
  const [ultimaNavegacion, setUltimaNavegacion] = useState(location.key);
  if (location.key !== ultimaNavegacion) {
    setUltimaNavegacion(location.key);
    setFiltros(filtrosIniciales(location.state));
    setPanelAbierto(false);
  }

  useEffect(() => {
    let vivo = true;

    productsApi
      .list()
      .then((lista) => {
        if (!vivo) return;
        setProductos(Array.isArray(lista) ? lista : []);
        setError('');
      })
      .catch(() => {
        if (!vivo) return;
        setProductos([]);
        setError('No pudimos cargar el catálogo. Revisa tu conexión e inténtalo otra vez.');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [intento]);

  // El botón flotante de filtros está fuera del flujo y tapaba la última fila
  // del pie, que se pinta después de <main>: la compensación va en el <body>.
  useEffect(() => {
    document.body.classList.add('con-barra-inferior');
    return () => document.body.classList.remove('con-barra-inferior');
  }, []);

  // El cajón de filtros se comporta como cualquier otra capa modal del sitio
  // (mismo patrón que `ui/Modal.jsx`): al abrirse se lleva el foco al panel,
  // el tabulador no se escapa al catálogo de detrás —que `aria-modal` ya
  // esconde a los lectores—, Escape cierra y al cerrar el foco vuelve al botón
  // que lo abrió.
  useEffect(() => {
    if (!panelAbierto) return undefined;

    // Se guarda el nodo, no la referencia: al desmontarse el cajón `.current`
    // ya podría apuntar a otra cosa y el foco acabaría en cualquier parte.
    const disparador = disparadorRef.current;
    cajonRef.current?.focus?.();

    const alPulsar = (evento) => {
      if (evento.key === 'Escape') {
        setPanelAbierto(false);
        return;
      }

      if (evento.key !== 'Tab') return;

      const focalizables = cajonRef.current?.querySelectorAll(FOCALIZABLES);
      if (!focalizables || focalizables.length === 0) return;

      const primero = focalizables[0];
      const ultimo = focalizables[focalizables.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    const scrollPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', alPulsar, true);

    return () => {
      document.body.style.overflow = scrollPrevio;
      document.removeEventListener('keydown', alPulsar, true);
      disparador?.focus?.();
    };
  }, [panelAbierto]);

  const grupos = useMemo(() => buildFilterGroups(productos), [productos]);
  const filtrados = useMemo(
    () => applyCatalogFilters(productos, filtros, orden),
    [productos, filtros, orden]
  );

  const activos = contarFiltros(filtros);
  const hayFiltros = hasActiveFilters(filtros);

  const alternar = (grupo, valor) => setFiltros((previos) => toggleFilter(previos, grupo, valor));
  const limpiar = () => setFiltros(EMPTY_FILTERS);

  const reintentar = () => {
    setCargando(true);
    setError('');
    setIntento((n) => n + 1);
  };

  // Fichas de lo que está filtrando ahora mismo, cada una con su forma de quitarse.
  const fichas = [];
  if (filtros.search.trim()) {
    fichas.push({
      clave: 'busqueda',
      grupo: 'Búsqueda',
      valor: `“${filtros.search.trim()}”`,
      quitar: () => setFiltros((previos) => ({ ...previos, search: '' })),
    });
  }
  for (const grupo of ['brand', 'category', 'price']) {
    for (const valor of filtros[grupo]) {
      fichas.push({
        clave: `${grupo}-${valor}`,
        grupo: NOMBRE_GRUPO[grupo],
        valor,
        quitar: () => alternar(grupo, valor),
      });
    }
  }

  return (
    <div className="min-h-screen bg-carbon-900 text-white">
      <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-10 sm:px-6 lg:px-8 lg:pb-20">
        <motion.header
          variants={resolveVariants(fadeUp, reduced)}
          initial="hidden"
          animate="visible"
          className="text-center"
        >
          <p className="text-xs font-black uppercase tracking-[0.35em] text-brand-500">Tienda</p>
          <h1 className="titulo-pagina mt-3 font-black uppercase tracking-tight text-white">
            Catálogo Completo
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">
            Suplementación original con precios que bajan solos conforme crece tu pedido. Filtra por
            marca, categoría o presupuesto.
          </p>
        </motion.header>

        <div className="mt-10 flex flex-col gap-8 lg:flex-row">
          {/* -------------------------------------------- filtros en escritorio */}
          <aside className="hidden w-72 shrink-0 lg:block">
            <div className="custom-scrollbar lg:sticky lg:top-[calc(var(--alto-cabecera,5rem)+0.5rem)] lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
              <div className="mb-4 flex items-baseline gap-2">
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Filtros</h2>
                {activos > 0 && (
                  <span className="text-xs font-bold text-brand-500">({activos} activos)</span>
                )}
              </div>

              <PanelFiltros
                grupos={grupos}
                filtros={filtros}
                alAlternar={alternar}
                prefijo="escritorio"
              />
            </div>
          </aside>

          {/* ------------------------------------------------------- resultados */}
          <main className="min-w-0 flex-1">
            <div className="superficie flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <label htmlFor="buscador-tienda" className="sr-only">
                  Buscar productos
                </label>
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  id="buscador-tienda"
                  type="search"
                  value={filtros.search}
                  onChange={(evento) =>
                    setFiltros((previos) => ({ ...previos, search: evento.target.value }))
                  }
                  placeholder="Buscar por producto, marca o categoría"
                  className={inputClasses({ extra: 'h-12 pl-9' })}
                />
              </div>

              <div className="shrink-0">
                <label htmlFor="orden-tienda" className="sr-only">
                  Ordenar productos
                </label>
                <select
                  id="orden-tienda"
                  value={orden}
                  onChange={(evento) => setOrden(evento.target.value)}
                  className="h-12 w-full rounded-sm border border-gray-700 bg-carbon-900 px-3 text-base text-gray-200 transition-colors focus:border-brand-500 focus:outline-none sm:w-56 sm:text-sm"
                >
                  {ORDENES.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p role="status" aria-live="polite" className="mt-4 text-sm text-gray-400">
              {`Mostrando ${filtrados.length} de ${productos.length} productos`}
            </p>

            {fichas.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {fichas.map((ficha) => (
                  <button
                    key={ficha.clave}
                    type="button"
                    onClick={ficha.quitar}
                    aria-label={`Quitar filtro ${ficha.grupo}: ${ficha.valor}`}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-gray-700 bg-carbon-800 py-1 pl-3 pr-2 text-xs text-gray-200 transition-colors hover:border-brand-600 hover:text-white"
                  >
                    <span className="font-bold uppercase tracking-wider text-gray-400">
                      {ficha.grupo}
                    </span>
                    {ficha.valor}
                    <X size={14} aria-hidden="true" className="text-gray-500" />
                  </button>
                ))}

                <button
                  type="button"
                  onClick={limpiar}
                  className="min-h-9 px-2 text-xs font-bold uppercase tracking-wider text-brand-500 underline-offset-4 hover:underline"
                >
                  Limpiar todos los filtros
                </button>
              </div>
            )}

            <div className="mt-6">
              {cargando ? (
                <SkeletonGrid count={8} />
              ) : error ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="No se pudo cargar el catálogo"
                  message={error}
                  actionLabel="Reintentar"
                  onAction={reintentar}
                />
              ) : filtrados.length === 0 ? (
                <EmptyState
                  icon={PackageSearch}
                  title="No se encontraron productos"
                  message={
                    hayFiltros
                      ? 'Prueba con menos filtros o revisa la búsqueda: puede que lo que buscas esté con otro nombre.'
                      : 'Todavía no hay productos publicados en la tienda.'
                  }
                  actionLabel={hayFiltros ? 'Limpiar filtros' : 'Volver al inicio'}
                  actionTo={hayFiltros ? undefined : '/'}
                  onAction={hayFiltros ? limpiar : undefined}
                />
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtrados.map((producto, indice) => (
                    <ProductCard key={producto.id} product={producto} delay={indice % 8} />
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* ------------------------------------------------- filtros en móvil */}
      <div className="no-imprimir area-segura-inferior pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 lg:hidden">
        <button
          ref={disparadorRef}
          type="button"
          onClick={() => setPanelAbierto(true)}
          aria-expanded={panelAbierto}
          aria-label={
            activos > 0 ? `Filtrar productos, ${activos} filtros activos` : 'Filtrar productos'
          }
          className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-600 px-6 text-xs font-black uppercase tracking-widest text-white shadow-[0_18px_45px_-18px_rgba(255,140,0,0.9)] transition-colors hover:bg-brand-700"
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          Filtrar
          {activos > 0 && (
            <span className="rounded-full bg-black/30 px-2 py-0.5 text-[11px]">{activos}</span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {panelAbierto && (
          <>
            <motion.div
              key="fondo-filtros"
              className="fixed inset-0 z-40 bg-black/70 lg:hidden"
              variants={resolveVariants(backdrop, reduced)}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setPanelAbierto(false)}
              aria-hidden="true"
            />

            <motion.div
              key="cajon-filtros"
              ref={cajonRef}
              role="dialog"
              aria-modal="true"
              aria-label="Filtros del catálogo"
              tabIndex={-1}
              className="fixed inset-0 z-50 flex flex-col bg-carbon-900 outline-none lg:hidden"
              variants={resolveVariants(drawer, reduced)}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-white">
                  Filtros{activos > 0 ? ` (${activos})` : ''}
                </h2>
                <button
                  type="button"
                  onClick={() => setPanelAbierto(false)}
                  aria-label="Cerrar filtros"
                  className="grid h-11 w-11 place-items-center rounded-full text-gray-400 transition-colors hover:bg-carbon-700 hover:text-white"
                >
                  <X size={22} aria-hidden="true" />
                </button>
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5">
                <PanelFiltros
                  grupos={grupos}
                  filtros={filtros}
                  alAlternar={alternar}
                  prefijo="movil"
                />
              </div>

              <div className="area-segura-inferior flex items-center gap-3 border-t border-gray-800 px-4 pt-4">
                <button
                  type="button"
                  onClick={limpiar}
                  disabled={!hayFiltros}
                  className="min-h-12 flex-1 rounded-sm border border-gray-700 text-xs font-bold uppercase tracking-widest text-gray-300 transition-colors hover:border-brand-600 hover:text-white disabled:opacity-40"
                >
                  Limpiar filtros
                </button>
                <button
                  type="button"
                  onClick={() => setPanelAbierto(false)}
                  className="min-h-12 flex-1 rounded-sm bg-brand-600 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
                >
                  Ver {filtrados.length} productos
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
