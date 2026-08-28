import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Heart,
  Layers,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
  ZoomIn,
} from 'lucide-react';
import toast from 'react-hot-toast';

import ProductCard from '../components/ProductCard';
import Reveal from '../components/ui/Reveal';
import EmptyState from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { TextAreaField } from '../components/ui/Field';
import useDocumentTitle from '../hooks/useDocumentTitle';

import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import { useWishlist } from '../context/WishlistContext';
import { products as productsApi } from '../services/api';
import {
  formatPrice,
  getDiscountPercent,
  getDisplayPrice,
  getPricingConfig,
  getTierBasePrice,
  getUnitPrice,
  hasDiscount,
} from '../lib/pricing';
import { sanitizeText } from '../lib/security';
import { fadeUp, resolveVariants, scaleIn, staggerContainer, staggerItem, viewportOnce } from '../lib/motion';

/* ------------------------------------------------------------------ opiniones
   Siguen viviendo en el navegador de cada visitante (no hay moderación ni
   servidor), pero el texto se sanea antes de guardarlo y cada persona sólo
   puede dejar una opinión por producto: si vuelve, edita la suya. */

const CLAVE_OPINIONES = 'thaiger_reviews';
const LIMITE_TEXTO = 500;
const LIMITE_NOMBRE = 60;

function leerOpiniones(productoId) {
  try {
    const todas = JSON.parse(localStorage.getItem(CLAVE_OPINIONES) || '{}');
    const lista = todas?.[productoId];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function guardarOpiniones(productoId, lista) {
  try {
    const todas = JSON.parse(localStorage.getItem(CLAVE_OPINIONES) || '{}');
    todas[productoId] = lista;
    localStorage.setItem(CLAVE_OPINIONES, JSON.stringify(todas));
  } catch {
    // El almacenamiento puede estar lleno o bloqueado: la opinión se queda en
    // pantalla durante la visita, pero no rompemos la ficha por esto.
  }
}

const ZOOM_APAGADO = { activo: false, x: 50, y: 50 };
const BORRADOR_VACIO = { texto: '', estrellas: 5 };

/** Devuelve el número de los ajustes o el de la configuración de precios. */
function numero(valor, alterno) {
  if (valor === null || valor === undefined || valor === '') return alterno;
  const convertido = Number(valor);
  return Number.isFinite(convertido) && convertido >= 0 ? convertido : alterno;
}

/**
 * Fila de estrellas de sólo lectura.
 *
 * Los iconos son puramente visuales. Donde ya hay un texto con la nota al lado
 * (el resumen) basta con ocultarlos; en la tarjeta de cada opinión son la
 * ÚNICA representación de la calificación, así que ahí se pide `etiquetado` y
 * la fila lleva su equivalente en texto para los lectores de pantalla.
 */
function Estrellas({ valor, size = 14, className = '', etiquetado = false }) {
  const llenas = Math.round(Number(valor) || 0);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((punto) => (
          <Star
            key={punto}
            size={size}
            className={punto <= llenas ? 'fill-brand-500 text-brand-500' : 'text-gray-700'}
          />
        ))}
      </span>
      {etiquetado && <span className="sr-only">{`${llenas} de 5 estrellas`}</span>}
    </span>
  );
}

/** Esqueleto con la forma de la ficha, para no mover la página al cargar. */
function EsqueletoFicha() {
  return (
    <div role="status" aria-label="Cargando el producto" className="grid gap-10 lg:grid-cols-2">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <div className="space-y-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-52" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="flex gap-3">
          <Skeleton className="h-14 flex-1 rounded-sm" />
          <Skeleton className="h-14 flex-1 rounded-sm" />
          <Skeleton className="h-14 w-14 rounded-sm" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const reducido = useReducedMotion();

  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();
  const { settings } = useSettings();

  const [producto, setProducto] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState('');
  const [reintento, setReintento] = useState(0);

  const [cantidad, setCantidad] = useState(1);
  const [fotoRota, setFotoRota] = useState(false);
  const [zoom, setZoom] = useState(ZOOM_APAGADO);
  const [anadido, setAnadido] = useState(false);

  const [opiniones, setOpiniones] = useState(() => leerOpiniones(id));
  const [borrador, setBorrador] = useState(BORRADOR_VACIO);
  const [errorOpinion, setErrorOpinion] = useState('');

  // Al pasar de un producto a otro se reinicia todo DURANTE el render, en lugar
  // de encadenar setState dentro de un efecto (lo prohíbe ESLint y provoca un
  // parpadeo con los datos del producto anterior).
  const [idCargado, setIdCargado] = useState(id);
  if (idCargado !== id) {
    setIdCargado(id);
    setProducto(null);
    setCargando(true);
    setFallo('');
    setCantidad(1);
    setFotoRota(false);
    setZoom(ZOOM_APAGADO);
    setAnadido(false);
    setOpiniones(leerOpiniones(id));
    setBorrador(BORRADOR_VACIO);
    setErrorOpinion('');
  }

  useEffect(() => {
    let activo = true;

    Promise.all([productsApi.get(id), productsApi.list()])
      .then(([ficha, lista]) => {
        if (!activo) return;
        setProducto(ficha || null);
        setCatalogo(Array.isArray(lista) ? lista : []);
      })
      .catch(() => {
        if (activo) setFallo('No pudimos cargar este producto. Revisa tu conexión e inténtalo de nuevo.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [id, reintento]);

  // El aviso de "¡Añadido!" se apaga solo; el temporizador se limpia al salir.
  const temporizador = useRef(0);
  useEffect(() => () => clearTimeout(temporizador.current), []);

  const enOferta = hasDiscount(producto);
  const precioLista = producto ? getTierBasePrice(producto, 1) : 0;
  const precioFinal = producto ? getDisplayPrice(producto) : 0;

  const stock = Number(producto?.stock);
  const hayDatoStock = Number.isFinite(stock);
  const agotado = hayDatoStock && stock <= 0;
  const pocasUnidades = hayDatoStock && stock > 0 && stock <= 5;
  const maximo = hayDatoStock && stock > 0 ? stock : 99;

  useDocumentTitle(
    producto ? `${producto.name}` : 'Producto',
    producto ? `${producto.name} de ${producto.brand} — ${formatPrice(precioFinal)} en Thaiger Supplements.` : undefined
  );

  // Los montos "desde" salen de los ajustes vivos: `getPricingConfig()` sólo se
  // refresca al leer la configuración, así que por sí solo seguía enseñando los
  // umbrales viejos el resto de la sesión si el panel los cambiaba.
  const niveles = useMemo(() => {
    const base = getPricingConfig();
    const tier2From = numero(settings?.tiers?.tier2From, base.tier2From);
    const tier3From = numero(settings?.tiers?.tier3From, base.tier3From);
    return [
      { nivel: 1, desde: 0, precio: producto ? getUnitPrice(producto, 1) : 0, lista: getTierBasePrice(producto, 1) },
      { nivel: 2, desde: tier2From, precio: producto ? getUnitPrice(producto, 2) : 0, lista: getTierBasePrice(producto, 2) },
      { nivel: 3, desde: tier3From, precio: producto ? getUnitPrice(producto, 3) : 0, lista: getTierBasePrice(producto, 3) },
    ];
  }, [producto, settings]);

  const recomendados = useMemo(() => {
    if (!producto) return [];
    const otros = catalogo.filter((item) => String(item.id) !== String(producto.id));
    const mismaMarca = otros.filter((item) => item.brand === producto.brand);
    const mismaCategoria = otros.filter((item) => item.category === producto.category);

    const vistos = new Set();
    const salida = [];
    for (const item of [...mismaMarca, ...mismaCategoria]) {
      if (salida.length >= 4) break;
      if (vistos.has(item.id)) continue;
      vistos.add(item.id);
      salida.push(item);
    }
    return salida;
  }, [catalogo, producto]);

  const resumenOpiniones = useMemo(() => {
    const total = opiniones.length;
    const suma = opiniones.reduce((acumulado, opinion) => acumulado + (Number(opinion.rating) || 0), 0);
    return {
      total,
      promedio: total > 0 ? suma / total : 0,
      desglose: [5, 4, 3, 2, 1].map((estrellas) => ({
        estrellas,
        cuenta: opiniones.filter((opinion) => Number(opinion.rating) === estrellas).length,
      })),
    };
  }, [opiniones]);

  const miOpinion = useMemo(
    () => (user ? opiniones.find((opinion) => opinion.userId && opinion.userId === user.id) || null : null),
    [opiniones, user]
  );

  // Mismo patrón de estado espejo: cuando aparece (o cambia) mi opinión, el
  // formulario pasa a editarla sin necesidad de un efecto.
  const [idOpinionPropia, setIdOpinionPropia] = useState(miOpinion?.id ?? null);
  if ((miOpinion?.id ?? null) !== idOpinionPropia) {
    setIdOpinionPropia(miOpinion?.id ?? null);
    setBorrador(
      miOpinion ? { texto: miOpinion.text || '', estrellas: Number(miOpinion.rating) || 5 } : BORRADOR_VACIO
    );
  }

  /* ------------------------------------------------------------- acciones */

  const ajustarCantidad = (valor) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return setCantidad(1);
    return setCantidad(Math.min(Math.max(1, Math.trunc(numero)), maximo));
  };

  const anadirAlCarrito = () => {
    if (!producto || agotado) return;
    addToCart(producto, cantidad);
    setAnadido(true);
    toast.success(`${cantidad} x ${producto.name} en el carrito`);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAnadido(false), 1600);
  };

  const comprarAhora = () => {
    if (!producto || agotado) return;
    addToCart(producto, cantidad);
    navigate('/cart');
  };

  const moverZoom = (evento) => {
    if (evento.pointerType !== 'mouse' || reducido) return;
    const caja = evento.currentTarget.getBoundingClientRect();
    setZoom({
      activo: true,
      x: ((evento.clientX - caja.left) / caja.width) * 100,
      y: ((evento.clientY - caja.top) / caja.height) * 100,
    });
  };

  const apagarZoom = () => setZoom((previo) => (previo.activo ? { ...previo, activo: false } : previo));

  const publicarOpinion = (evento) => {
    evento.preventDefault();
    if (!user) {
      setErrorOpinion('Debes iniciar sesión para opinar.');
      return;
    }

    const texto = sanitizeText(borrador.texto, { maxLength: LIMITE_TEXTO, allowNewlines: true });
    if (!texto) {
      setErrorOpinion('Escribe tu opinión antes de publicarla.');
      return;
    }

    const opinion = {
      id: miOpinion?.id || `op-${Date.now()}`,
      userId: user.id,
      user: sanitizeText(user.name || user.email?.split('@')[0] || 'Cliente', { maxLength: LIMITE_NOMBRE }),
      text: texto,
      rating: Math.min(5, Math.max(1, Number(borrador.estrellas) || 5)),
      date: new Date().toLocaleDateString('es-MX'),
    };

    const siguientes = miOpinion
      ? opiniones.map((entrada) => (entrada.id === miOpinion.id ? opinion : entrada))
      : [opinion, ...opiniones];

    setOpiniones(siguientes);
    guardarOpiniones(id, siguientes);
    setErrorOpinion('');
    toast.success(miOpinion ? 'Actualizamos tu opinión' : '¡Gracias por tu opinión!');
  };

  /* --------------------------------------------------------------- estados */

  if (cargando) {
    return (
      <div className="min-h-screen bg-carbon-950 pb-20 text-white">
        <div className="container mx-auto px-4 py-10">
          <EsqueletoFicha />
        </div>
      </div>
    );
  }

  if (fallo) {
    return (
      <div className="min-h-screen bg-carbon-950 pb-20 text-white">
        <div className="container mx-auto px-4 py-16">
          <EmptyState
            icon={AlertTriangle}
            title="No se pudo cargar la ficha"
            message={fallo}
            actionLabel="Reintentar"
            onAction={() => {
              setFallo('');
              setCargando(true);
              setReintento((valor) => valor + 1);
            }}
          />
        </div>
      </div>
    );
  }

  if (!producto) {
    return (
      <div className="min-h-screen bg-carbon-950 pb-20 text-white">
        <div className="container mx-auto px-4 py-16">
          <h1 className="titulo-pagina mb-6 text-center font-extrabold uppercase text-brand-500">
            Producto No Encontrado
          </h1>
          <EmptyState
            as="h2"
            icon={Package}
            title="Este producto ya no está disponible"
            message="Puede que se haya retirado del catálogo o que el enlace esté mal escrito."
            actionLabel="Volver a la tienda"
            actionTo="/shop"
          />
        </div>
      </div>
    );
  }

  const descripcion =
    producto.description && producto.description.length > 10
      ? producto.description
      : `Suplemento de ${producto.category} de ${producto.brand}, seleccionado para entrenamientos exigentes. Producto sellado y original.`;

  const zoomActivo = zoom.activo && !reducido;
  const enFavoritos = isInWishlist(producto.id);

  return (
    <div className="min-h-screen bg-carbon-950 pb-20 text-white">
      <div className="container mx-auto px-4 py-8 lg:py-12">
        {/* ------------------------------------------------- migas de pan */}
        <nav aria-label="Migas de pan" className="mb-8 overflow-x-auto">
          <ol className="flex items-center gap-1 whitespace-nowrap text-xs uppercase tracking-widest text-gray-400">
            <li>
              <Link to="/" className="transition-colors hover:text-brand-500">
                Inicio
              </Link>
            </li>
            <ChevronRight size={12} aria-hidden="true" className="text-gray-700" />
            <li>
              <Link to="/shop" className="transition-colors hover:text-brand-500">
                Tienda
              </Link>
            </li>
            {producto.category && (
              <>
                <ChevronRight size={12} aria-hidden="true" className="text-gray-700" />
                <li>
                  <Link
                    to="/shop"
                    state={{ search: producto.category }}
                    className="transition-colors hover:text-brand-500"
                  >
                    {producto.category}
                  </Link>
                </li>
              </>
            )}
            <ChevronRight size={12} aria-hidden="true" className="text-gray-700" />
            <li aria-current="page" className="max-w-[12rem] truncate text-gray-300 sm:max-w-none">
              {producto.name}
            </li>
          </ol>
        </nav>

        {/* --------------------------------------------- galería + compra */}
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <motion.div
            variants={resolveVariants(scaleIn, reducido)}
            initial="hidden"
            animate="visible"
            className="lg:sticky lg:top-[calc(var(--alto-cabecera,5rem)+0.5rem)] lg:self-start"
          >
            <div
              className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white"
              onPointerMove={moverZoom}
              onPointerLeave={apagarZoom}
            >
              {producto.image_url && !fotoRota ? (
                <img
                  src={producto.image_url}
                  alt={producto.name}
                  onError={() => setFotoRota(true)}
                  className="h-full w-full object-contain p-6"
                  style={{
                    transform: zoomActivo ? 'scale(1.9)' : 'scale(1)',
                    transformOrigin: `${zoom.x}% ${zoom.y}%`,
                    transition: reducido ? 'none' : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-gray-400">
                  <Package size={72} className="opacity-40" aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Sin fotografía</span>
                </div>
              )}

              {enOferta && (
                <span className="absolute left-4 top-4 rounded-sm bg-red-600 px-3 py-1 text-xs font-black uppercase tracking-wider text-white">
                  -{getDiscountPercent(producto)}% OFF
                </span>
              )}

              {agotado && (
                <span className="absolute right-4 top-4 rounded-sm bg-carbon-950/85 px-3 py-1 text-xs font-black uppercase tracking-wider text-white">
                  Agotado
                </span>
              )}
            </div>

            <p className="mt-3 hidden items-center justify-center gap-2 text-[11px] uppercase tracking-widest text-gray-400 lg:flex">
              <ZoomIn size={12} aria-hidden="true" /> Pasa el cursor sobre la foto para ampliarla
            </p>
          </motion.div>

          <motion.div
            variants={resolveVariants(fadeUp, reducido)}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-6"
          >
            <div>
              <Link
                to="/shop"
                state={{ brand: producto.brand }}
                className="text-sm font-bold uppercase tracking-[0.25em] text-brand-500 transition-colors hover:text-brand-400"
              >
                {producto.brand}
              </Link>
              <h1 className="titulo-pagina mt-2 font-extrabold uppercase">{producto.name}</h1>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {producto.category && (
                  <span className="rounded-sm bg-brand-600/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-500">
                    {producto.category}
                  </span>
                )}
                <a href="#opiniones" className="flex items-center gap-2 text-xs text-gray-400 hover:text-white">
                  <Estrellas valor={resumenOpiniones.promedio} />
                  {resumenOpiniones.total > 0
                    ? `${resumenOpiniones.promedio.toFixed(1)} de 5 · ${resumenOpiniones.total} opinión${resumenOpiniones.total === 1 ? '' : 'es'}`
                    : 'Sin opiniones todavía'}
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <p className="text-4xl font-extrabold tracking-tight text-brand-500 sm:text-5xl">
                {formatPrice(precioFinal)}
              </p>
              {enOferta && (
                <>
                  <span className="text-xl text-gray-400 line-through">{formatPrice(precioLista)}</span>
                  <span className="rounded-sm bg-red-600 px-2 py-1 text-xs font-black uppercase tracking-wider text-white">
                    Ahorras {formatPrice(precioLista - precioFinal)}
                  </span>
                </>
              )}
            </div>

            <p className="max-w-prose leading-relaxed text-gray-400">{descripcion}</p>

            {/* Inventario real */}
            <div className="superficie flex items-start gap-4 rounded-xl p-5">
              <Package className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
              <div>
                <h2 className="font-bold text-white">
                  {agotado ? 'Producto agotado' : 'Disponible en inventario'}
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  {agotado
                    ? 'Se agotó temporalmente. Escríbenos y te avisamos en cuanto vuelva.'
                    : hayDatoStock
                      ? `Disponibles: ${stock} unidades.`
                      : 'Disponible bajo pedido.'}
                </p>
                {pocasUnidades && (
                  <p className="mt-2 flex items-center gap-2 text-sm font-bold text-amber-500" role="status">
                    <AlertTriangle size={14} aria-hidden="true" />
                    ¡Últimas {stock} unidades!
                  </p>
                )}
              </div>
            </div>

            {/* Cantidad */}
            {!agotado && (
              <div className="flex flex-wrap items-center gap-4">
                <span id="etiqueta-cantidad" className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Cantidad
                </span>
                <div className="flex items-center rounded-sm border border-gray-700 bg-carbon-900">
                  <button
                    type="button"
                    aria-label="Quitar una unidad"
                    onClick={() => ajustarCantidad(cantidad - 1)}
                    disabled={cantidad <= 1}
                    className="flex h-12 w-12 items-center justify-center text-gray-400 transition-colors hover:text-white disabled:text-gray-700"
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={maximo}
                    value={cantidad}
                    aria-labelledby="etiqueta-cantidad"
                    onChange={(evento) => ajustarCantidad(evento.target.value)}
                    className="sin-flechas h-12 w-16 bg-transparent text-center font-bold text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Añadir una unidad"
                    onClick={() => ajustarCantidad(cantidad + 1)}
                    disabled={cantidad >= maximo}
                    className="flex h-12 w-12 items-center justify-center text-gray-400 transition-colors hover:text-white disabled:text-gray-700"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>
                <p className="text-sm text-gray-400">
                  Total: <span className="font-bold text-white">{formatPrice(precioFinal * cantidad)}</span>
                </p>
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-wrap gap-3">
              <motion.button
                type="button"
                onClick={anadirAlCarrito}
                disabled={agotado}
                whileTap={reducido ? undefined : { scale: 0.97 }}
                className={`min-h-[3.25rem] flex-1 basis-48 rounded-sm px-6 text-sm font-bold uppercase tracking-widest transition-colors ${
                  agotado
                    ? 'cursor-not-allowed bg-carbon-700 text-gray-400'
                    : anadido
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-black hover:bg-gray-200'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  {anadido && <Check size={16} aria-hidden="true" />}
                  {agotado ? 'Agotado' : anadido ? '¡Añadido!' : 'Añadir al Carrito'}
                </span>
              </motion.button>

              <motion.button
                type="button"
                onClick={comprarAhora}
                disabled={agotado}
                whileTap={reducido ? undefined : { scale: 0.97 }}
                className={`min-h-[3.25rem] flex-1 basis-48 rounded-sm px-6 text-sm font-bold uppercase tracking-widest transition-colors ${
                  agotado
                    ? 'cursor-not-allowed bg-carbon-700 text-gray-400'
                    : 'resplandor-marca bg-brand-600 text-white hover:bg-brand-700'
                }`}
              >
                {agotado ? 'Sin stock' : 'Comprar ahora'}
              </motion.button>

              <button
                type="button"
                onClick={() => toggleWishlist(producto)}
                aria-pressed={enFavoritos}
                aria-label={enFavoritos ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                className={`flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-sm border-2 transition-colors ${
                  enFavoritos
                    ? 'border-red-500 bg-red-500/10 text-red-500'
                    : 'border-gray-700 text-gray-400 hover:border-brand-500 hover:text-brand-500'
                }`}
              >
                <Heart size={20} className={enFavoritos ? 'fill-current' : ''} aria-hidden="true" />
              </button>
            </div>

            {/* Confianza */}
            <ul className="grid grid-cols-1 gap-3 text-sm text-gray-400 sm:grid-cols-3">
              <li className="superficie flex items-center gap-3 rounded-lg p-3">
                <Truck size={18} className="shrink-0 text-brand-500" aria-hidden="true" /> Envío a todo México
              </li>
              <li className="superficie flex items-center gap-3 rounded-lg p-3">
                <ShieldCheck size={18} className="shrink-0 text-brand-500" aria-hidden="true" /> Producto original
              </li>
              <li className="superficie flex items-center gap-3 rounded-lg p-3">
                <RotateCcw size={18} className="shrink-0 text-brand-500" aria-hidden="true" /> Cambios en 5 días
              </li>
            </ul>
          </motion.div>
        </div>

        {/* ------------------------------------------- niveles de precio */}
        <Reveal className="mt-16">
          <div className="superficie rounded-xl p-6 lg:p-8">
            <div className="mb-6 flex items-start gap-3">
              <Layers className="mt-1 shrink-0 text-brand-500" aria-hidden="true" />
              <div>
                <h2 className="titulo-seccion font-extrabold uppercase">Precios por volumen</h2>
                <p className="mt-1 text-sm text-gray-400">
                  El nivel se calcula con el total de tu carrito, no con este producto solo. Al alcanzar el monto, el
                  precio baja automáticamente.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] text-left text-sm">
                <caption className="sr-only">Niveles de precio de {producto.name}</caption>
                <thead>
                  <tr className="border-b border-gray-800 text-xs uppercase tracking-widest text-gray-400">
                    <th scope="col" className="py-3 pr-4 font-bold">
                      Nivel
                    </th>
                    <th scope="col" className="py-3 pr-4 font-bold">
                      Carrito desde
                    </th>
                    <th scope="col" className="py-3 text-right font-bold">
                      Precio por unidad
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {niveles.map((fila) => (
                    <tr key={fila.nivel} className="border-b border-gray-800/70 last:border-0">
                      <th scope="row" className="py-4 pr-4 font-bold text-white">
                        Nivel {fila.nivel}
                      </th>
                      <td className="py-4 pr-4 text-gray-400">
                        {fila.desde === 0 ? 'Cualquier monto' : formatPrice(fila.desde)}
                      </td>
                      <td className="py-4 text-right">
                        <span className="font-extrabold text-brand-500">{formatPrice(fila.precio)}</span>
                        {enOferta && (
                          <span className="ml-2 text-xs text-gray-400 line-through">{formatPrice(fila.lista)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>

        {/* -------------------------------------------------- opiniones */}
        <section id="opiniones" className="mt-16 scroll-mt-28">
          <h2 className="titulo-seccion mb-6 font-extrabold uppercase">Opiniones de clientes</h2>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Promedio y desglose */}
            <div className="superficie rounded-xl p-6">
              <p className="text-5xl font-extrabold text-white">{resumenOpiniones.promedio.toFixed(1)}</p>
              <Estrellas valor={resumenOpiniones.promedio} size={18} className="mt-2" />
              <p className="mt-2 text-xs uppercase tracking-widest text-gray-400">
                {resumenOpiniones.total} opinión{resumenOpiniones.total === 1 ? '' : 'es'}
              </p>

              <ul className="mt-6 space-y-2">
                {resumenOpiniones.desglose.map((fila) => {
                  const porcentaje =
                    resumenOpiniones.total > 0 ? Math.round((fila.cuenta / resumenOpiniones.total) * 100) : 0;
                  return (
                    <li key={fila.estrellas} className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="w-10 shrink-0 font-bold text-gray-400">{fila.estrellas} ★</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-carbon-700">
                        <span
                          className="block h-full rounded-full bg-brand-500 transition-[width] duration-500"
                          style={{ width: `${porcentaje}%` }}
                        />
                      </span>
                      <span className="w-8 shrink-0 text-right tabular-nums">{fila.cuenta}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Lista */}
            <div className="lg:col-span-2">
              {opiniones.length === 0 ? (
                <div className="superficie rounded-xl p-8 text-center text-sm italic text-gray-400">
                  Todavía no hay opiniones de este producto. ¡Sé la primera persona en escribir una!
                </div>
              ) : (
                <motion.ul
                  variants={resolveVariants(staggerContainer(0.06), reducido)}
                  initial="hidden"
                  whileInView="visible"
                  viewport={viewportOnce}
                  className="space-y-3"
                >
                  <AnimatePresence initial={false}>
                    {opiniones.map((opinion) => (
                      <motion.li
                        key={opinion.id}
                        layout={!reducido}
                        variants={resolveVariants(staggerItem, reducido)}
                        exit="exit"
                        className="superficie rounded-xl p-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold text-white">
                            {opinion.user}
                            {miOpinion && opinion.id === miOpinion.id && (
                              <span className="ml-2 rounded-sm bg-brand-600/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-500">
                                Tu opinión
                              </span>
                            )}
                          </p>
                          <Estrellas valor={opinion.rating} etiquetado />
                        </div>
                        <p className="mt-1 text-xs text-gray-400">{opinion.date}</p>
                        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-300">{opinion.text}</p>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}

              {/* Formulario */}
              <div className="superficie mt-6 rounded-xl p-6">
                {user ? (
                  <form onSubmit={publicarOpinion} className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
                      {miOpinion ? 'Edita tu opinión' : 'Escribe tu opinión'}
                    </h3>

                    {/* Radios de verdad dentro de un fieldset: antes eran cinco
                        botones con `role="radio"` que prometían el patrón ARIA
                        sin cumplirlo (los cinco tabulaban y las flechas no
                        movían la selección). El nativo lo da hecho. */}
                    <fieldset className="border-0 p-0">
                      <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        Calificación
                      </legend>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((punto) => (
                          <label
                            key={punto}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm transition-colors hover:bg-carbon-700 focus-within:ring-2 focus-within:ring-brand-500"
                          >
                            <input
                              type="radio"
                              name="calificacion-opinion"
                              value={punto}
                              checked={borrador.estrellas === punto}
                              onChange={() => setBorrador((previo) => ({ ...previo, estrellas: punto }))}
                              className="sr-only"
                            />
                            <span className="sr-only">{`${punto} estrella${punto === 1 ? '' : 's'}`}</span>
                            <Star
                              size={22}
                              className={punto <= borrador.estrellas ? 'fill-brand-500 text-brand-500' : 'text-gray-700'}
                              aria-hidden="true"
                            />
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <TextAreaField
                      label="Tu opinión"
                      hint={`Máximo ${LIMITE_TEXTO} caracteres. Se publica con tu nombre.`}
                      error={errorOpinion || undefined}
                      value={borrador.texto}
                      maxLength={LIMITE_TEXTO}
                      rows={4}
                      placeholder="¿Qué tal te funcionó?"
                      onChange={(evento) => setBorrador((previo) => ({ ...previo, texto: evento.target.value }))}
                    />

                    <button
                      type="submit"
                      className="min-h-[3rem] w-full rounded-sm bg-brand-600 px-6 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700 sm:w-auto"
                    >
                      {miOpinion ? 'Actualizar mi opinión' : 'Publicar opinión'}
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-gray-400">
                    <Link to="/login" className="font-bold text-brand-500 hover:text-brand-400">
                      Inicia sesión
                    </Link>{' '}
                    para dejar tu opinión sobre este producto.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------- recomendaciones */}
        {recomendados.length > 0 && (
          <section className="mt-16">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-gray-800 pb-3">
              <h2 className="titulo-seccion font-extrabold uppercase">También te puede servir</h2>
              <Link to="/shop" className="text-xs font-bold uppercase tracking-widest text-brand-500 hover:text-white">
                Ver más productos
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {recomendados.map((sugerido, indice) => (
                <ProductCard key={sugerido.id} product={sugerido} index={indice} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
