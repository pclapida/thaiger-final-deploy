import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Apple,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Droplets,
  Dumbbell,
  FlaskConical,
  Flame,
  Headphones,
  HeartPulse,
  Milk,
  Package,
  Tag,
  Truck,
  Zap,
} from 'lucide-react';
import HeroCarousel from '../components/HeroCarousel';
import ProductCard from '../components/ProductCard';
import Reveal from '../components/ui/Reveal';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { products as productosApi } from '../services/api';
import { buildBrandSummary } from '../lib/catalog';
import { formatPrice, hasDiscount } from '../lib/pricing';
import { useSettings } from '../context/SettingsContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

/**
 * Portada de la tienda.
 *
 * Todo lo que se ve aquí sale del catálogo real y de los ajustes del panel:
 * las categorías se cuentan de los productos y las marcas de `buildBrandSummary`.
 * Nada está escrito a mano, que fue justo el bug de la versión anterior —
 * el carrusel anunciaba marcas que no existían y "Ver productos" llevaba a una
 * tienda vacía.
 */

// Rango de marcas diacríticas, sin escapes Unicode en el fuente (igual que seed.js).
const DIACRITICOS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');

/** Clave comparable: sin acentos, en minúsculas. */
function clave(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .trim()
    .toLowerCase();
}

/** Nombre de archivo del logotipo de una marca: "IRON PEAK" -> "iron-peak". */
function slugDeMarca(nombre) {
  return clave(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Icono por categoría; si aparece una nueva, cae en el genérico. */
const ICONOS_CATEGORIA = {
  proteina: Milk,
  creatina: FlaskConical,
  'pre-entreno': Zap,
  aminos: Droplets,
  quemador: Flame,
  salud: HeartPulse,
  comida: Apple,
  accesorios: Dumbbell,
};

/** Encabezado común de las secciones de la portada. */
function Encabezado({ id, kicker, titulo, enlaceTexto, enlaceA, enlaceState }) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {kicker && (
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-500">{kicker}</p>
        )}
        <h2 id={id} className="titulo-seccion mt-2 font-black uppercase italic text-white">
          {titulo}
        </h2>
      </div>

      {enlaceTexto && (
        <Link
          to={enlaceA}
          state={enlaceState}
          className="inline-flex min-h-[44px] items-center gap-2 self-start text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-brand-500 sm:self-auto"
        >
          {enlaceTexto} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/** Tarjeta de marca con su logotipo; si el archivo no existe, queda el nombre. */
function TarjetaMarca({ marca }) {
  const [sinLogo, setSinLogo] = useState(false);
  const logo = `/images/brands/${slugDeMarca(marca.name)}.svg`;

  return (
    <Link
      to="/shop"
      state={{ brand: marca.name }}
      className="superficie group flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-xl px-3 py-5 text-center transition-colors hover:border-brand-600/60 hover:bg-carbon-700"
    >
      {sinLogo ? (
        <span className="text-sm font-black uppercase italic text-gray-300 transition-colors group-hover:text-brand-500">
          {marca.name}
        </span>
      ) : (
        <img
          src={logo}
          alt={marca.name}
          loading="lazy"
          onError={() => setSinLogo(true)}
          className="h-10 w-full max-w-[140px] object-contain opacity-70 transition-opacity group-hover:opacity-100"
        />
      )}
      <span className="text-[11px] uppercase tracking-widest text-gray-500">
        {marca.count} {marca.count === 1 ? 'producto' : 'productos'}
      </span>
    </Link>
  );
}

export default function Home() {
  const { settings } = useSettings();
  useDocumentTitle(
    'Inicio',
    settings?.store?.description || settings?.store?.tagline || 'Suplementación deportiva'
  );

  const [catalogo, setCatalogo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;

    productosApi
      .list()
      .then((lista) => {
        if (!activo) return;
        setCatalogo(Array.isArray(lista) ? lista : []);
        setError('');
      })
      .catch(() => {
        // Sin console.error: al visitante le sirve más un aviso con reintento.
        if (activo) setError('No pudimos cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [intento]);

  const reintentar = () => {
    setError('');
    setCargando(true);
    setIntento((numero) => numero + 1);
  };

  // La lista llega ordenada por id descendente: los primeros son los más nuevos.
  const destacados = useMemo(() => catalogo.slice(0, 4), [catalogo]);
  const promociones = useMemo(() => catalogo.filter(hasDiscount).slice(0, 4), [catalogo]);
  const marcas = useMemo(() => buildBrandSummary(catalogo), [catalogo]);

  const categorias = useMemo(() => {
    const conteo = new Map();
    for (const producto of catalogo) {
      const nombre = producto?.category;
      if (!nombre) continue;
      conteo.set(nombre, (conteo.get(nombre) || 0) + 1);
    }
    return [...conteo.entries()]
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
  }, [catalogo]);

  const envioGratisDesde = Number(settings?.shipping?.freeFrom) || 0;
  const textosInicio = settings?.home || {};

  const confianza = [
    {
      icono: Truck,
      titulo: 'Envío gratis',
      texto: envioGratisDesde
        ? `En pedidos desde ${formatPrice(envioGratisDesde)}.`
        : 'Envíos a toda la República Mexicana.',
    },
    {
      icono: Banknote,
      titulo: 'Pago por transferencia',
      texto: 'Transferencia SPEI con concepto propio para cada pedido.',
    },
    {
      icono: BadgeCheck,
      titulo: 'Producto original',
      texto: 'Cada marca del catálogo se surte con proveedor identificado.',
    },
    {
      icono: Headphones,
      titulo: 'Atención directa',
      texto: settings?.store?.hours || 'Te respondemos en horario de oficina.',
    },
  ];

  return (
    <div className="bg-black text-white">
      <HeroCarousel slides={settings?.hero || []} />

      {/* Franja de identidad: el texto de distribuidor sigue siendo el gancho. */}
      <Reveal as="section" className="border-y border-white/10 bg-carbon-900">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-5 py-5 text-center sm:flex-row sm:justify-between sm:text-left lg:px-12">
          <p className="border-l-4 border-brand-600 pl-3 text-sm font-bold uppercase tracking-[0.25em] text-white">
            Distribuidores Oficiales Thaiger
          </p>
          {settings?.store?.shippingNote && (
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
              {settings.store.shippingNote}
            </p>
          )}
        </div>
      </Reveal>

      <div className="mx-auto max-w-7xl px-5 lg:px-12">
        {/* --------------------------------------------------------- destacados */}
        <section className="py-14 sm:py-16" aria-labelledby="titulo-destacados">
          <Reveal>
            <Encabezado
              id="titulo-destacados"
              kicker="Recién llegados"
              titulo={textosInicio.featuredTitle || 'Destacados'}
              enlaceTexto="Ver toda la tienda"
              enlaceA="/shop"
            />
          </Reveal>

          {error ? (
            <div
              role="alert"
              className="superficie flex flex-col items-center gap-4 rounded-xl px-6 py-12 text-center"
            >
              <p className="text-sm text-gray-300">{error}</p>
              <button
                type="button"
                onClick={reintentar}
                className="min-h-[44px] rounded-sm bg-brand-600 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
              >
                Reintentar
              </button>
            </div>
          ) : cargando ? (
            <SkeletonGrid count={4} />
          ) : destacados.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {destacados.map((producto, posicion) => (
                <ProductCard key={producto.id} product={producto} delay={posicion} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Package}
              title="Catálogo vacío"
              message="Todavía no hay productos publicados en la tienda."
              actionLabel="Ir a la tienda"
              actionTo="/shop"
            />
          )}
        </section>

        {/* ------------------------------------------------------- promociones */}
        {!error && (
          <section className="pb-14 sm:pb-16" aria-labelledby="titulo-promociones">
            <Reveal>
              <Encabezado
                id="titulo-promociones"
                kicker="Precio rebajado"
                titulo={textosInicio.promoTitle || 'Promociones'}
                enlaceTexto="Ver todas las ofertas"
                enlaceA="/offers"
              />
            </Reveal>

            {cargando ? (
              <SkeletonGrid count={4} />
            ) : promociones.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {promociones.map((producto, posicion) => (
                  <ProductCard key={producto.id} product={producto} delay={posicion} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Tag}
                title="Sin ofertas activas"
                message="Ahora mismo no hay descuentos vigentes. Mientras tanto, el catálogo completo te espera."
                actionLabel="Ver catálogo"
                actionTo="/shop"
              />
            )}
          </section>
        )}

        {/* -------------------------------------------------------- categorías */}
        {categorias.length > 0 && (
          <section className="pb-14 sm:pb-16" aria-labelledby="titulo-categorias">
            <Reveal>
              <Encabezado id="titulo-categorias" kicker="Por objetivo" titulo="Categorías" />
            </Reveal>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {categorias.map((categoria, posicion) => {
                const Icono = ICONOS_CATEGORIA[clave(categoria.nombre)] || Package;
                return (
                  <Reveal key={categoria.nombre} index={posicion}>
                    <Link
                      to="/shop"
                      state={{ category: [categoria.nombre] }}
                      className="superficie group flex h-full min-h-[120px] flex-col justify-between rounded-xl p-4 transition-colors hover:border-brand-600/60 hover:bg-carbon-700 sm:p-5"
                    >
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-600/10 text-brand-500 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                        <Icono size={20} aria-hidden="true" />
                      </span>
                      <span className="mt-4 block">
                        <span className="block truncate text-sm font-bold uppercase tracking-wide text-white">
                          {categoria.nombre}
                        </span>
                        <span className="mt-1 block text-[11px] uppercase tracking-widest text-gray-500">
                          {categoria.total} {categoria.total === 1 ? 'producto' : 'productos'}
                        </span>
                      </span>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------ marcas */}
        {textosInicio.showBrandStrip !== false && marcas.length > 0 && (
          <section className="pb-14 sm:pb-16" aria-labelledby="titulo-marcas">
            <Reveal>
              <Encabezado
                id="titulo-marcas"
                kicker="Catálogo por marca"
                titulo={textosInicio.brandsTitle || 'Marcas más populares'}
                enlaceTexto="Ver todas las marcas"
                enlaceA="/brands"
              />
            </Reveal>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {marcas.map((marca, posicion) => (
                <Reveal key={marca.name} index={posicion}>
                  <TarjetaMarca marca={marca} />
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* --------------------------------------------------------- confianza */}
        <section className="pb-16 sm:pb-20" aria-labelledby="titulo-confianza">
          <h2 id="titulo-confianza" className="sr-only">
            Por qué comprar en Thaiger
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {confianza.map((bloque, posicion) => {
              const Icono = bloque.icono;
              return (
              <Reveal key={bloque.titulo} index={posicion}>
                <div className="superficie flex h-full items-start gap-4 rounded-xl p-5">
                  <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600/10 text-brand-500">
                    <Icono size={20} aria-hidden="true" />
                  </span>
                  <span className="block">
                    <span className="block text-sm font-bold uppercase tracking-wide text-white">
                      {bloque.titulo}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-gray-400">
                      {bloque.texto}
                    </span>
                  </span>
                </div>
              </Reveal>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
