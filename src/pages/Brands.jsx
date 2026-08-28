import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Package, Store } from 'lucide-react';
import Reveal from '../components/ui/Reveal';
import EmptyState from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { products as productsApi } from '../services/api';
import { buildBrandSummary } from '../lib/catalog';
import { formatPrice, getDisplayPrice, hasDiscount } from '../lib/pricing';
import { fadeUp, resolveVariants } from '../lib/motion';

const DIACRITICOS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');

/** "THAIGER LABS" -> "thaiger-labs", que es como se llaman los logotipos. */
function slugMarca(nombre) {
  return String(nombre)
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Logotipo de la marca; si el archivo no existe, se lee su nombre. */
function LogoMarca({ nombre, slug }) {
  const [roto, setRoto] = useState(false);

  if (roto || !slug) {
    return (
      <span className="px-2 text-center text-xl font-black uppercase leading-tight tracking-widest text-white">
        {nombre}
      </span>
    );
  }

  return (
    <img
      src={`/images/brands/${slug}.svg`}
      alt={nombre}
      loading="lazy"
      decoding="async"
      onError={() => setRoto(true)}
      className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
    />
  );
}

/** Silueta de carga con la forma de las tarjetas de marca. */
function EsqueletoMarcas() {
  return (
    <div
      role="status"
      aria-label="Cargando marcas"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, indice) => (
        <div key={indice} className="superficie rounded-2xl p-5">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="mt-5 h-5 w-40" />
          <Skeleton className="mt-3 h-3 w-24" />
          <Skeleton className="mt-3 h-3 w-32" />
          <Skeleton className="mt-6 h-11 w-full rounded-sm" />
        </div>
      ))}
    </div>
  );
}

export default function Brands() {
  useDocumentTitle(
    'Marcas',
    'Las marcas que distribuye Thaiger Supplements, con su catálogo, su rango de precios y sus ofertas.'
  );

  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

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
        setError('No pudimos cargar las marcas. Revisa tu conexión e inténtalo otra vez.');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [intento]);

  /**
   * Las marcas salen SIEMPRE del catálogo real, nunca de una lista escrita a
   * mano: cuando el carrusel anunciaba marcas inexistentes, "Ver Productos"
   * llevaba a una tienda vacía.
   */
  const marcas = useMemo(() => {
    const porMarca = new Map();
    for (const producto of productos) {
      if (!producto.brand) continue;
      if (!porMarca.has(producto.brand)) porMarca.set(producto.brand, []);
      porMarca.get(producto.brand).push(producto);
    }

    return buildBrandSummary(productos).map((marca) => {
      const suyos = porMarca.get(marca.name) || [];
      const precios = suyos.map(getDisplayPrice).filter((precio) => precio > 0);
      const categorias = [...new Set(suyos.map((producto) => producto.category).filter(Boolean))];

      return {
        ...marca,
        slug: slugMarca(marca.name),
        minimo: precios.length > 0 ? Math.min(...precios) : 0,
        maximo: precios.length > 0 ? Math.max(...precios) : 0,
        categorias: categorias.slice(0, 3),
        ofertas: suyos.filter(hasDiscount).length,
      };
    });
  }, [productos]);

  const reintentar = () => {
    setCargando(true);
    setError('');
    setIntento((n) => n + 1);
  };

  return (
    <div className="min-h-screen bg-carbon-900 text-white">
      <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <motion.header
          variants={resolveVariants(fadeUp, reduced)}
          initial="hidden"
          animate="visible"
          className="text-center"
        >
          <p className="text-xs font-black uppercase tracking-[0.35em] text-brand-500">Distribución</p>
          <h1 className="titulo-pagina mt-3 font-black uppercase tracking-tight text-white">
            Nuestras Marcas
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">
            Cada marca de esta página tiene producto en existencia hoy. Entra y verás su catálogo
            completo, no una tienda vacía.
          </p>
        </motion.header>

        <div className="mt-12">
          {cargando ? (
            <EsqueletoMarcas />
          ) : error ? (
            <EmptyState
              as="h2"
              icon={AlertTriangle}
              title="No se pudieron cargar las marcas"
              message={error}
              actionLabel="Reintentar"
              onAction={reintentar}
            />
          ) : marcas.length === 0 ? (
            <EmptyState
              as="h2"
              icon={Store}
              title="Todavía no hay marcas en el catálogo"
              message="En cuanto se publique el primer producto, su marca aparecerá aquí."
              actionLabel="Ir a la tienda"
              actionTo="/shop"
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {marcas.map((marca, indice) => (
                <Reveal key={marca.name} index={indice} className="h-full">
                  <article className="superficie group flex h-full flex-col rounded-2xl p-5 transition-[border-color,box-shadow] duration-300 hover:border-brand-600 hover:shadow-[0_18px_45px_-18px_rgba(255,140,0,0.6)]">
                    <div className="grid h-32 place-items-center overflow-hidden rounded-xl bg-carbon-700 p-4">
                      <LogoMarca nombre={marca.name} slug={marca.slug} />
                    </div>

                    <h2 className="mt-5 text-lg font-black uppercase tracking-wider text-white">
                      {marca.name}
                    </h2>

                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-widest text-brand-500">
                      <span className="inline-flex items-center gap-1">
                        <Package size={12} aria-hidden="true" />
                        {marca.count} {marca.count === 1 ? 'producto' : 'productos'}
                      </span>
                      {marca.ofertas > 0 && (
                        <span className="text-gray-400">
                          {marca.ofertas} en oferta
                        </span>
                      )}
                    </p>

                    <p className="mt-3 text-sm text-gray-400">
                      {marca.minimo === marca.maximo
                        ? formatPrice(marca.minimo)
                        : `${formatPrice(marca.minimo)} — ${formatPrice(marca.maximo)}`}
                    </p>

                    {marca.categorias.length > 0 && (
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {marca.categorias.map((categoria) => (
                          <li
                            key={categoria}
                            className="rounded-full border border-gray-700 px-3 py-1 text-[11px] uppercase tracking-wider text-gray-400"
                          >
                            {categoria}
                          </li>
                        ))}
                      </ul>
                    )}

                    <button
                      type="button"
                      onClick={() => navigate('/shop', { state: { brand: marca.name } })}
                      aria-label={`Ver productos de ${marca.name}`}
                      className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-brand-600/50 bg-brand-600/10 text-xs font-black uppercase tracking-widest text-brand-500 transition-colors hover:bg-brand-600 hover:text-white"
                    >
                      Ver Productos
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </article>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
