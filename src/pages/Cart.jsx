import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ImageOff, Minus, Plus, ShoppingCart, Tag, Trash2, Truck } from 'lucide-react';

import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import {
  computeCartTotals,
  formatPrice,
  getDiscountPercent,
  getPricingConfig,
  getTierBasePrice,
  getUnitPrice,
  hasDiscount,
} from '../lib/pricing';
import { fadeUp, resolveVariants } from '../lib/motion';

/** A partir de aquí avisamos de que quedan pocas piezas. */
const UMBRAL_STOCK_BAJO = 5;

/** Devuelve el número de los ajustes o el de la configuración de precios. */
function numero(valor, alterno) {
  if (valor === null || valor === undefined || valor === '') return alterno;
  const convertido = Number(valor);
  return Number.isFinite(convertido) && convertido >= 0 ? convertido : alterno;
}

export default function Cart() {
  const { cartItems, updateQuantity, removeFromCart, clearCart } = useCart();
  const { settings } = useSettings();
  const reducido = useReducedMotion();
  const [confirmarVaciado, setConfirmarVaciado] = useState(false);

  // La barra fija de móvil se sale del flujo y tapaba la última fila del pie,
  // que se pinta después de <main>: la compensación tiene que ir en el <body>.
  const hayBarraFija = cartItems.length > 0;
  useEffect(() => {
    if (!hayBarraFija) return undefined;
    document.body.classList.add('con-barra-inferior');
    return () => document.body.classList.remove('con-barra-inferior');
  }, [hayBarraFija]);

  useDocumentTitle('Carrito', 'Revisa tu carrito, ajusta cantidades y consulta tu nivel de precios.');

  // Toda la aritmética de niveles, ofertas y envío vive en src/lib/pricing.js.
  const {
    tier: nivel,
    subtotal,
    shipping: envio,
    savings: ahorro,
    total,
    itemCount: piezas,
    missingForNextTier: faltaSiguienteNivel,
    missingForFreeShipping: faltaEnvioGratis,
  } = computeCartTotals(cartItems);

  // El umbral sale de los ajustes vivos: `getPricingConfig()` sólo se refresca
  // al leer la configuración, así que por sí solo mostraba el valor viejo el
  // resto de la sesión si el panel lo cambiaba.
  const umbralEnvioGratis = numero(settings?.shipping?.freeFrom, getPricingConfig().freeShippingFrom);
  const avanceEnvio =
    umbralEnvioGratis > 0 ? Math.min(100, Math.round((subtotal / umbralEnvioGratis) * 100)) : 100;

  const vaciar = () => {
    clearCart();
    setConfirmarVaciado(false);
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-carbon-950 text-white">
        <div className="container mx-auto px-4 py-10 lg:py-14">
          <h1 className="titulo-pagina mb-10 border-b border-gray-800 pb-5 font-extrabold uppercase tracking-wide text-brand-500">
            Tu Carrito de Compras
          </h1>
          <EmptyState
            as="h2"
            icon={ShoppingCart}
            title="Tu carrito está vacío"
            message="Todavía no has agregado productos. Empieza por el catálogo: los precios bajan solos conforme sube el monto de tu pedido."
            actionLabel="Ir a la tienda"
            actionTo="/shop"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-carbon-950 pb-40 text-white lg:pb-16">
      <div className="container mx-auto px-4 py-10 lg:py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-gray-800 pb-5">
          <h1 className="titulo-pagina font-extrabold uppercase tracking-wide text-brand-500">
            Tu Carrito de Compras
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
            {piezas} {piezas === 1 ? 'pieza' : 'piezas'}
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* ================================================== artículos */}
          <div className="min-w-0 flex-1">
            {/* Avance hacia el envío gratis */}
            <div className="superficie mb-6 rounded-xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-300">
                  <Truck size={16} className="text-brand-500" aria-hidden="true" />
                  {faltaEnvioGratis > 0 ? 'Envío gratis más cerca' : '¡Envío gratis conseguido!'}
                </p>
                <p className="text-xs text-gray-400">
                  {faltaEnvioGratis > 0
                    ? `Te faltan ${formatPrice(faltaEnvioGratis)}`
                    : `Superaste ${formatPrice(umbralEnvioGratis)}`}
                </p>
              </div>

              <div
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-carbon-700"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={avanceEnvio}
                aria-label="Avance hacia el envío gratis"
              >
                <motion.span
                  className="block h-full rounded-full bg-brand-500"
                  initial={false}
                  animate={{ width: `${avanceEnvio}%` }}
                  transition={reducido ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>

            {/* Aviso de siguiente nivel de precios */}
            {nivel < 3 && faltaSiguienteNivel > 0 && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-brand-600/40 bg-brand-600/10 p-4 text-sm">
                <Tag className="mt-0.5 shrink-0 text-brand-500" size={18} aria-hidden="true" />
                <p className="text-gray-300">
                  Estás en el <span className="font-bold text-brand-500">Nivel {nivel}</span>. Agrega{' '}
                  <span className="font-bold text-white">{formatPrice(faltaSiguienteNivel)}</span> más en productos y
                  todo tu carrito pasa al <span className="font-bold text-brand-500">Nivel {nivel + 1}</span>.
                </p>
              </div>
            )}

            <ul className="space-y-4">
              <AnimatePresence initial={false}>
                {cartItems.map((item) => {
                  const enOferta = hasDiscount(item);
                  const precioUnidad = getUnitPrice(item, nivel);
                  const precioBase = getTierBasePrice(item, nivel);
                  const hayStock = item.stock !== undefined && item.stock !== null;
                  const stockBajo = hayStock && Number(item.stock) <= UMBRAL_STOCK_BAJO;
                  const enElTope = hayStock && item.quantity >= Number(item.stock);

                  return (
                    <motion.li
                      key={item.id}
                      layout={!reducido}
                      variants={resolveVariants(fadeUp, reducido)}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="superficie rounded-xl p-4"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row">
                        <Link
                          to={`/product/${item.id}`}
                          aria-label={`Ver ${item.name}`}
                          className="grid h-28 w-full shrink-0 place-items-center overflow-hidden rounded-lg bg-white sm:h-28 sm:w-28"
                        >
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              loading="lazy"
                              className="h-full w-full object-contain p-2"
                            />
                          ) : (
                            <ImageOff size={28} className="text-gray-400" aria-hidden="true" />
                          )}
                        </Link>

                        <div className="flex min-w-0 flex-1 flex-col gap-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-black uppercase tracking-widest text-brand-500">
                                {item.brand}
                              </p>
                              <h2 className="truncate text-base font-bold text-white">
                                <Link to={`/product/${item.id}`} className="hover:text-brand-400">
                                  {item.name}
                                </Link>
                              </h2>

                              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-400">
                                <span>{formatPrice(precioUnidad)} c/u</span>
                                {enOferta && (
                                  <>
                                    <span className="text-xs text-gray-400 line-through">
                                      {formatPrice(precioBase)}
                                    </span>
                                    <span className="rounded-sm bg-brand-600/15 px-1.5 py-0.5 text-[10px] font-black text-brand-400">
                                      -{getDiscountPercent(item)}%
                                    </span>
                                  </>
                                )}
                              </p>

                              {hayStock && (
                                <p
                                  className={`mt-1 text-[11px] font-bold uppercase tracking-wider ${
                                    stockBajo ? 'text-amber-500' : 'text-gray-400'
                                  }`}
                                >
                                  Disponibles: {item.stock} unidades
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id)}
                              aria-label={`Quitar ${item.name} del carrito`}
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-sm text-gray-400 transition-colors hover:bg-carbon-700 hover:text-red-500"
                            >
                              <Trash2 size={18} aria-hidden="true" />
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center rounded-sm border border-gray-700 bg-carbon-900">
                              <button
                                type="button"
                                aria-label={`Quitar una unidad de ${item.name}`}
                                onClick={() => updateQuantity(item.id, item.quantity - 1, item.stock)}
                                className="flex h-11 w-11 items-center justify-center text-gray-400 transition-colors hover:text-white"
                              >
                                <Minus size={16} aria-hidden="true" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={hayStock ? item.stock : undefined}
                                value={item.quantity}
                                aria-label={`Cantidad de ${item.name}`}
                                onChange={(evento) => {
                                  const valor = Number.parseInt(evento.target.value, 10);
                                  updateQuantity(item.id, Number.isNaN(valor) ? 1 : valor, item.stock);
                                }}
                                className="sin-flechas h-11 w-14 bg-transparent text-center font-bold text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                aria-label={`Añadir una unidad de ${item.name}`}
                                disabled={enElTope}
                                onClick={() => updateQuantity(item.id, item.quantity + 1, item.stock)}
                                className="flex h-11 w-11 items-center justify-center text-gray-400 transition-colors hover:text-white disabled:text-gray-700"
                              >
                                <Plus size={16} aria-hidden="true" />
                              </button>
                            </div>

                            <p className="text-xl font-extrabold tracking-tight text-brand-500">
                              {formatPrice(precioUnidad * item.quantity)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>

            <button
              type="button"
              onClick={() => setConfirmarVaciado(true)}
              className="mt-6 min-h-11 px-1 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-red-500"
            >
              Vaciar carrito
            </button>
          </div>

          {/* =================================================== resumen */}
          <aside className="lg:w-96 lg:shrink-0">
            <div className="superficie rounded-xl p-6 lg:sticky lg:top-[calc(var(--alto-cabecera,5rem)+0.5rem)]">
              <h2 className="mb-6 text-xl font-bold uppercase tracking-wider">Resumen del Pedido</h2>

              <div className="space-y-4 text-sm text-gray-300">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <span className="flex items-center gap-2 font-bold uppercase tracking-wide text-brand-500">
                    <Tag size={14} aria-hidden="true" /> Nivel de Precios Actual
                  </span>
                  <span className="rounded-sm bg-brand-500 px-2 py-0.5 text-xs font-black text-black">{nivel}</span>
                </div>

                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-white">{formatPrice(subtotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Envío</span>
                  <span className="font-bold text-white">
                    {envio === 0 ? (
                      <span className="text-sm uppercase text-emerald-500">Gratis</span>
                    ) : (
                      formatPrice(envio)
                    )}
                  </span>
                </div>

                {ahorro > 0 && (
                  <div className="flex justify-between text-emerald-500">
                    <span>Tu ahorro</span>
                    <span className="font-bold">−{formatPrice(ahorro)}</span>
                  </div>
                )}

                {faltaEnvioGratis > 0 && (
                  <p className="text-xs text-gray-400">
                    Agrega {formatPrice(faltaEnvioGratis)} más y el envío corre por nuestra cuenta.
                  </p>
                )}

                <div className="border-t border-gray-800 pt-4">
                  <div className="flex items-end justify-between">
                    <span className="text-lg font-bold uppercase">Total</span>
                    <span className="text-3xl font-extrabold tracking-tight text-brand-500">{formatPrice(total)}</span>
                  </div>
                  <p className="mt-1 text-right text-xs text-gray-400">IVA incluido</p>
                </div>
              </div>

              <Link
                to="/checkout"
                className="resplandor-marca group mt-6 flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-sm bg-brand-600 px-6 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
              >
                Proceder al Pago
                <ArrowRight size={18} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                to="/shop"
                className="mt-3 flex min-h-11 items-center justify-center text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-white"
              >
                Seguir comprando
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* Barra fija de móvil: el total y el paso a pagar siempre a la vista. */}
      <div className="area-segura-inferior fixed inset-x-0 bottom-0 z-40 border-t border-gray-800 bg-carbon-800/95 px-4 pt-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</p>
            <p className="text-xl font-extrabold text-brand-500">{formatPrice(total)}</p>
          </div>
          <Link
            to="/checkout"
            className="flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-sm bg-brand-600 px-5 text-sm font-bold uppercase tracking-widest text-white"
          >
            Ir a pagar
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={confirmarVaciado}
        title="¿Vaciar el carrito?"
        message="Se quitarán todos los productos. Esta acción no se puede deshacer."
        confirmLabel="Sí, vaciarlo"
        cancelLabel="Conservarlo"
        tone="danger"
        onConfirm={vaciar}
        onCancel={() => setConfirmarVaciado(false)}
      />
    </div>
  );
}
