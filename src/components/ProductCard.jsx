import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Heart, ImageOff, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import {
  formatPrice,
  getDiscountPercent,
  getDisplayPrice,
  getTierBasePrice,
  hasDiscount,
} from '../lib/pricing';
import { fadeUp, resolveVariants, stepDelay, viewportOnce } from '../lib/motion';

/** A partir de esta cantidad ya no avisamos de "últimas piezas". */
const UMBRAL_STOCK_BAJO = 5;

/**
 * Tarjeta de producto del catálogo.
 *
 * Recibe el producto completo para que precio, oferta, stock y foto salgan
 * siempre de la misma fuente: cuando cada página armaba sus propias props, la
 * tarjeta anunciaba un descuento que el carrito no cobraba.
 *
 * La tarjeta NO es un enlace envolvente: el HTML prohíbe meter botones dentro
 * de un `<a>` y varios lectores de pantalla anunciaban la tarjeta como un único
 * enlace, dejando "favoritos" y "agregar al carrito" fuera de alcance. El ancla
 * envuelve sólo el título y se estira sobre toda la tarjeta con `after:inset-0`
 * (enlace extendido): se sigue pudiendo pulsar la foto, y los dos botones son
 * hermanos suyos, por encima de esa capa.
 */
export default function ProductCard({ product, delay = 0, index }) {
  const reduced = useReducedMotion();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [fotoRota, setFotoRota] = useState(false);

  if (!product) return null;

  const { id, name, brand, category, image_url: foto, stock } = product;

  const nombre = name || 'Producto';
  const hayStock = stock !== undefined && stock !== null;
  const agotado = hayStock && Number(stock) <= 0;
  const stockBajo = hayStock && Number(stock) > 0 && Number(stock) <= UMBRAL_STOCK_BAJO;

  const enOferta = hasDiscount(product);
  const porcentaje = getDiscountPercent(product);
  const precioLista = getTierBasePrice(product, 1);
  const precioFinal = getDisplayPrice(product);

  const favorito = isInWishlist(id);
  const mostrarFoto = Boolean(foto) && !fotoRota;
  // Nombre útil del enlace: quien navega con lector de pantalla oye la marca.
  const etiquetaEnlace = [brand, nombre].filter(Boolean).join(', ');

  // Ya no hace falta cortar el evento: los botones están fuera del ancla.
  const agregar = () => {
    if (agotado) return;
    addToCart(product, 1);
    toast.success('Añadido al carrito');
  };

  const alternarFavorito = () => toggleWishlist(product);

  return (
    <motion.article
      className="superficie group relative flex h-full flex-col overflow-hidden rounded-xl transition-[border-color,box-shadow] duration-300 hover:border-brand-600 hover:shadow-[0_18px_45px_-18px_rgba(255,140,0,0.6)] has-[a:focus-visible]:border-brand-500"
      variants={resolveVariants(fadeUp, reduced)}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={{ delay: reduced ? 0 : stepDelay(Number(index ?? delay) || 0) }}
      whileHover={reduced ? undefined : { y: -6 }}
    >
      {/* -------------------------------------------------------------- foto */}
      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-white">
        {mostrarFoto ? (
          <img
            src={foto}
            alt={nombre}
            loading="lazy"
            decoding="async"
            onError={() => setFotoRota(true)}
            className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          // Marcador: una foto rota nunca deja un hueco en la rejilla.
          // Gris 500 sobre gris 100: aquí el fondo es claro, no oscuro.
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-100 text-gray-500">
            <ImageOff size={40} aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Sin foto</span>
          </div>
        )}

        {/* Los adornos no capturan el toque: debajo pasa el enlace extendido. */}
        {enOferta && (
          <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-sm bg-brand-600 px-2 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-lg">
            -{porcentaje}%
          </span>
        )}

        {agotado ? (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/65">
            <span className="rounded-full border border-white/20 bg-black/80 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white">
              Agotado
            </span>
          </div>
        ) : (
          // Cinta que sube al pasar el cursor. En táctil no estorba.
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 translate-y-full bg-brand-600 py-2.5 text-center text-[11px] font-bold uppercase tracking-widest text-white transition-transform duration-300 group-hover:translate-y-0">
            Ver detalles
          </div>
        )}
      </div>

      {/* Hermano del enlace, nunca dentro: si no, el botón no existe para un lector. */}
      <button
        type="button"
        onClick={alternarFavorito}
        aria-pressed={favorito}
        aria-label={favorito ? `Quitar ${nombre} de favoritos` : `Añadir ${nombre} a favoritos`}
        className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full bg-black/70 backdrop-blur transition-colors hover:bg-black"
      >
        <Heart
          size={18}
          aria-hidden="true"
          className={favorito ? 'fill-brand-500 text-brand-500' : 'text-gray-300'}
        />
      </button>

      {/* ------------------------------------------------------------- datos */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[11px] font-black uppercase tracking-widest text-brand-500">
            {brand || 'THAIGER'}
          </span>
          {category && (
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-gray-400">{category}</span>
          )}
        </div>

        <h3 className="recorte-2 mt-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-gray-100">
          {/*
            Enlace extendido: la capa `after` cubre la tarjeta entera (el <article>
            es su bloque contenedor), así que se puede pulsar la foto sin anidar
            botones dentro del ancla. Los botones la superan con `z-20`.
          */}
          <Link
            to={`/product/${id}`}
            aria-label={etiquetaEnlace}
            className="after:absolute after:inset-0 after:z-0 after:content-['']"
          >
            {nombre}
          </Link>
        </h3>

        <p className="mt-2 min-h-[1rem] text-[11px] font-bold uppercase tracking-wider text-brand-400">
          {stockBajo ? `Últimas ${stock} piezas` : ''}
        </p>

        <div className="mt-auto pt-3">
          {enOferta && (
            <p className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 line-through">{formatPrice(precioLista)}</span>
              <span className="rounded-sm bg-brand-600/15 px-1.5 py-0.5 text-[10px] font-black text-brand-400">
                -{porcentaje}%
              </span>
            </p>
          )}
          <p className="truncate text-2xl font-black tracking-tight text-white">{formatPrice(precioFinal)}</p>

          <button
            type="button"
            onClick={agregar}
            disabled={agotado}
            className={`relative z-20 mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors ${
              agotado
                ? 'cursor-not-allowed border border-gray-800 bg-carbon-800 text-gray-400'
                : 'border border-brand-600/40 bg-brand-600/10 text-brand-500 hover:bg-brand-600 hover:text-white'
            }`}
          >
            <Plus size={14} aria-hidden="true" /> {agotado ? 'Sin stock' : 'Agregar'}
          </button>
        </div>
      </div>
    </motion.article>
  );
}
