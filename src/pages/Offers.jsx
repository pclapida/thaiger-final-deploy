import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, BadgePercent, Flame, Tag } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonGrid } from '../components/ui/Skeleton';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { products as productsApi } from '../services/api';
import { getDiscountPercent, hasDiscount } from '../lib/pricing';
import { fadeUp, resolveVariants } from '../lib/motion';

/** Dato destacado de la cabecera. */
function Dato({ icon, valor, etiqueta }) {
  const Icono = icon;

  return (
    <div className="superficie flex items-center gap-3 rounded-xl px-5 py-4 text-left">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600/15 text-brand-500">
        <Icono size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-black leading-none text-white">{valor}</span>
        <span className="mt-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">
          {etiqueta}
        </span>
      </span>
    </div>
  );
}

export default function Offers() {
  useDocumentTitle(
    'Ofertas',
    'Descuentos vigentes en suplementos Thaiger: proteínas, pre-entrenos y combos con precio rebajado.'
  );

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
        setError('No pudimos cargar las ofertas. Revisa tu conexión e inténtalo otra vez.');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [intento]);

  // Sólo lo que el panel marcó como oferta, del mayor descuento al menor.
  const ofertas = useMemo(
    () =>
      productos
        .filter(hasDiscount)
        .sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a)),
    [productos]
  );

  const descuentoMaximo = ofertas.length > 0 ? getDiscountPercent(ofertas[0]) : 0;

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
          className="flex flex-col items-center text-center"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-600 text-white resplandor-marca">
            <Tag size={28} aria-hidden="true" />
          </span>

          <h1 className="titulo-pagina mt-6 font-black uppercase tracking-tight text-white">
            Ofertas y Combos Especiales
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">
            Descuentos de temporada sobre el precio del nivel que ya te toca: la rebaja se aplica
            también cuando tu pedido sube de escalón.
          </p>

          {!cargando && !error && ofertas.length > 0 && (
            <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
              <Dato icon={Flame} valor={`Hasta -${descuentoMaximo}%`} etiqueta="Descuento máximo" />
              <Dato
                icon={BadgePercent}
                valor={`${ofertas.length} ${ofertas.length === 1 ? 'producto' : 'productos'}`}
                etiqueta="Con descuento activo"
              />
            </div>
          )}
        </motion.header>

        {/* El listado necesita su propio encabezado: sin él, el h1 de la página
            quedaba seguido de los h3 de cada tarjeta y la jerarquía se saltaba
            un nivel. Visualmente sobra —la cabecera ya lo dice—, así que va
            oculto salvo para lectores de pantalla. */}
        <section aria-labelledby="titulo-listado-ofertas" className="mt-12">
          <h2 id="titulo-listado-ofertas" className="sr-only">
            Productos con descuento
          </h2>

          {cargando ? (
            <SkeletonGrid count={8} />
          ) : error ? (
            <EmptyState
              icon={AlertTriangle}
              title="No se pudieron cargar las ofertas"
              message={error}
              actionLabel="Reintentar"
              onAction={reintentar}
            />
          ) : ofertas.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No hay ofertas activas"
              message="Vuelve pronto: las promociones se publican cada temporada. Mientras tanto, todo el catálogo sigue disponible."
              actionLabel="Ver todo el catálogo"
              actionTo="/shop"
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {ofertas.map((producto, indice) => (
                <ProductCard key={producto.id} product={producto} delay={indice % 8} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
