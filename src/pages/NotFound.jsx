import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Home, Search, Store } from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { fadeUp, resolveVariants, staggerContainer, staggerItem } from '../lib/motion';

/**
 * Página 404.
 *
 * En vez de un callejón sin salida ofrece las tres cosas que la persona
 * probablemente buscaba: el buscador, la tienda y las categorías más pedidas.
 */

// Categorías del catálogo. Se navega con `state.search` porque es lo que la
// tienda entiende (ver `filtersFromLocation` en src/lib/catalog.js).
const CATEGORIAS = ['Proteína', 'Creatina', 'Pre-Entreno', 'Aminos', 'Quemador', 'Salud'];

export default function NotFound() {
  useDocumentTitle(
    'Página no encontrada',
    'La página que buscas no existe. Vuelve a la tienda de Thaiger Supplements.'
  );

  const navigate = useNavigate();
  const location = useLocation();
  const reducido = useReducedMotion();
  const [busqueda, setBusqueda] = useState('');

  const buscar = (evento) => {
    evento.preventDefault();
    const termino = busqueda.trim();
    navigate('/shop', termino ? { state: { search: termino } } : undefined);
  };

  return (
    <motion.section
      variants={resolveVariants(staggerContainer(0.08), reducido)}
      initial="hidden"
      animate="visible"
      className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center sm:py-24"
    >
      {/* Marca de agua: decorativa, no la lee nadie con lector de pantalla. */}
      <motion.div variants={resolveVariants(fadeUp, reducido)} className="relative mb-8">
        <span
          aria-hidden="true"
          className="block select-none bg-gradient-to-b from-brand-500 to-brand-700/10 bg-clip-text text-[6rem] font-black italic leading-none tracking-tighter text-transparent sm:text-[9rem]"
        >
          404
        </span>
        <img
          src="/loader.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto h-24 w-24 object-contain opacity-15 mix-blend-screen sm:h-32 sm:w-32"
        />
      </motion.div>

      <motion.h1
        variants={resolveVariants(staggerItem, reducido)}
        className="titulo-seccion font-black uppercase tracking-tight text-white"
      >
        404 | Página no encontrada
      </motion.h1>

      <motion.p
        variants={resolveVariants(staggerItem, reducido)}
        className="mt-4 max-w-md text-sm leading-relaxed text-gray-400"
      >
        Esta dirección no existe, cambió de sitio o el producto ya no está en el catálogo.
        Prueba a buscar lo que necesitas.
      </motion.p>

      {location?.pathname && (
        <motion.p
          variants={resolveVariants(staggerItem, reducido)}
          className="mt-3 max-w-full truncate rounded-sm border border-carbon-600 bg-carbon-900 px-3 py-1.5 font-mono text-[11px] text-gray-400"
        >
          {location.pathname}
        </motion.p>
      )}

      {/* ------------------------------------------------------------ buscador */}
      <motion.form
        variants={resolveVariants(staggerItem, reducido)}
        role="search"
        onSubmit={buscar}
        className="mt-8 flex w-full max-w-md flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="busqueda-404" className="sr-only">
          Buscar productos en la tienda
        </label>
        <div className="relative flex-1">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            id="busqueda-404"
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Proteína, creatina, pre-entreno..."
            className="h-12 w-full rounded-sm border border-carbon-600 bg-carbon-900 pl-9 pr-3 text-base text-white placeholder:text-gray-400 focus:border-brand-500 focus:outline-none sm:text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-12 shrink-0 rounded-sm bg-brand-600 px-6 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
        >
          Buscar
        </button>
      </motion.form>

      {/* ------------------------------------------------------------ atajos */}
      <motion.div
        variants={resolveVariants(staggerItem, reducido)}
        className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center"
      >
        <Link
          to="/shop"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-carbon-600 px-6 text-xs font-bold uppercase tracking-widest text-gray-200 transition-colors hover:border-brand-500 hover:text-brand-500"
        >
          <Store size={16} aria-hidden="true" /> Ir a la tienda
        </Link>
        <Link
          to="/"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-carbon-600 px-6 text-xs font-bold uppercase tracking-widest text-gray-200 transition-colors hover:border-brand-500 hover:text-brand-500"
        >
          <Home size={16} aria-hidden="true" /> Volver al inicio
        </Link>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm px-6 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Atrás
        </button>
      </motion.div>

      {/* ------------------------------------------------------- categorías */}
      <motion.div variants={resolveVariants(staggerItem, reducido)} className="mt-12 w-full">
        <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400">
          O empieza por una categoría
        </h2>
        <ul className="flex flex-wrap justify-center gap-2">
          {CATEGORIAS.map((categoria) => (
            <li key={categoria}>
              <Link
                to="/shop"
                state={{ search: categoria }}
                className="inline-flex min-h-11 items-center rounded-full border border-carbon-600 px-5 text-xs font-bold uppercase tracking-wide text-gray-300 transition-colors hover:border-brand-500 hover:bg-brand-600/10 hover:text-brand-500"
              >
                {categoria}
              </Link>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.section>
  );
}
