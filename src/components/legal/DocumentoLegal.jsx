import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import Reveal from '../ui/Reveal';
import { fadeUp, resolveVariants } from '../../lib/motion';
import { DOCUMENTOS_LEGALES, VIGENCIA_LEGAL } from '../../lib/legal';

/** Marca en el índice la sección que se está leyendo. */
function useSeccionActiva(ids) {
  const [activa, setActiva] = useState(ids[0]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observador = new IntersectionObserver(
      (entradas) => {
        const visibles = entradas
          .filter((entrada) => entrada.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visibles.length > 0) setActiva(visibles[0].target.id);
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: 0 }
    );

    const nodos = ids.map((id) => document.getElementById(id)).filter(Boolean);
    nodos.forEach((nodo) => observador.observe(nodo));

    return () => observador.disconnect();
  }, [ids]);

  return activa;
}

/** Una sección numerada del documento, con su icono. */
export function SeccionLegal({ id, titulo, icono, children }) {
  const Icono = icono;

  return (
    <Reveal as="section" id={id} className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
      <h2 className="mb-5 flex items-center gap-3 text-lg font-bold uppercase tracking-wide text-white sm:text-xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-500">
          <Icono size={20} aria-hidden="true" />
        </span>
        {titulo}
      </h2>
      <div className="space-y-4 text-sm leading-relaxed text-gray-400 [&_strong]:text-gray-200 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </Reveal>
  );
}

/**
 * Armazón común de las páginas legales: cabecera, índice (plegado en móvil,
 * pegajoso en escritorio), las secciones y los enlaces a los demás documentos.
 *
 * `secciones` es `[{ id, titulo }]` y sólo alimenta el índice; el contenido
 * llega como hijos, una `<SeccionLegal>` por entrada.
 */
export default function DocumentoLegal({ titulo, intro, secciones, children }) {
  const reduced = useReducedMotion();
  const [ids] = useState(() => secciones.map((seccion) => seccion.id));
  const activa = useSeccionActiva(ids);

  return (
    <div className="min-h-screen bg-carbon-900 text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <motion.header
          variants={resolveVariants(fadeUp, reduced)}
          initial="hidden"
          animate="visible"
          className="max-w-3xl"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-brand-500">Documentos legales</p>
          <h1 className="titulo-pagina mt-3 font-black uppercase text-white">{titulo}</h1>
          {intro && <p className="mt-5 text-base leading-relaxed text-gray-400">{intro}</p>}
          <p className="mt-3 text-xs uppercase tracking-widest text-gray-400">Última actualización: {VIGENCIA_LEGAL}</p>
        </motion.header>

        {/* Índice en móvil: plegado, para no empujar el contenido. */}
        <details className="group mt-8 rounded-xl border border-gray-800 bg-carbon-800 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] text-gray-300 [&::-webkit-details-marker]:hidden">
            <span>Ir a una sección</span>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className="shrink-0 text-brand-500 transition-transform duration-300 group-open:rotate-180"
            />
          </summary>
          <nav aria-label="Índice de la página" className="px-2 pb-3">
            <ul>
              {secciones.map((seccion) => (
                <li key={seccion.id}>
                  <a
                    href={`#${seccion.id}`}
                    className="block rounded-lg px-3 py-3 text-sm text-gray-400 transition-colors hover:bg-carbon-700 hover:text-white"
                  >
                    {seccion.titulo}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </details>

        <div className="mt-10 grid gap-10 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-14">
          {/* Índice pegajoso en escritorio */}
          <nav aria-label="Índice de la página" className="hidden lg:block">
            <div className="sticky top-[calc(var(--alto-cabecera,5rem)+0.5rem)]">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">En esta página</p>
              <ul className="border-l border-gray-800">
                {secciones.map((seccion) => {
                  const esActiva = activa === seccion.id;
                  return (
                    <li key={seccion.id}>
                      <a
                        href={`#${seccion.id}`}
                        aria-current={esActiva ? 'true' : undefined}
                        className={`-ml-px block border-l-2 py-2 pl-4 text-sm transition-colors ${
                          esActiva
                            ? 'border-brand-500 font-bold text-brand-400'
                            : 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-300'
                        }`}
                      >
                        {seccion.titulo}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>

          <div className="max-w-3xl space-y-8">
            {children}

            <nav aria-label="Otros documentos legales" className="border-t border-gray-800 pt-8">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">Otros documentos</p>
              <ul className="flex flex-wrap gap-2">
                {DOCUMENTOS_LEGALES.map((documento) => (
                  <li key={documento.to}>
                    <Link
                      to={documento.to}
                      className="flex min-h-11 items-center rounded-sm border border-gray-800 px-4 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-brand-600 hover:text-white"
                    >
                      {documento.etiqueta}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
