import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Boxes,
  ChevronDown,
  Clock,
  Info,
  Mail,
  Percent,
  Phone,
  ShoppingCart,
  Store,
  Tags,
  Truck,
} from 'lucide-react';
import Reveal from '../components/ui/Reveal';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSettings } from '../context/SettingsContext';
import { formatPrice, getPricingConfig } from '../lib/pricing';
import { fadeUp, resolveVariants } from '../lib/motion';

/**
 * Programa de mayoreo.
 *
 * Los umbrales de los tres niveles y el envío se leen de la configuración real
 * de precios (`getPricingConfig`) y de los ajustes de la tienda: si mañana el
 * panel cambia un umbral, esta página cambia con él. Ninguna cifra va a mano.
 */

const PASOS = [
  {
    icono: ShoppingCart,
    titulo: 'Llena el carrito',
    texto: 'Mezcla marcas, categorías y presentaciones. Lo único que cuenta es el monto total.',
  },
  {
    icono: Tags,
    titulo: 'El nivel se calcula solo',
    texto: 'El carrito suma los precios de lista y decide el nivel que te corresponde. No hay códigos ni trámites.',
  },
  {
    icono: Percent,
    titulo: 'Se aplica a todo el carrito',
    texto: 'Al alcanzar un nivel, el precio nuevo aplica a cada producto del pedido, no sólo al último.',
  },
];

/** Devuelve el número de los ajustes o el de la configuración de precios. */
function numero(valor, alterno) {
  if (valor === null || valor === undefined || valor === '') return alterno;
  const convertido = Number(valor);
  return Number.isFinite(convertido) && convertido >= 0 ? convertido : alterno;
}

/** Bloque plegable accesible: `<details>` nativo, sin JavaScript de más. */
function Acordeon({ titulo, children }) {
  return (
    <details className="group rounded-xl border border-gray-800 bg-carbon-900/60 transition-colors hover:border-brand-600/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold text-gray-200 [&::-webkit-details-marker]:hidden">
        <span>{titulo}</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="shrink-0 text-brand-500 transition-transform duration-300 group-open:rotate-180"
        />
      </summary>
      <div className="space-y-3 px-5 pb-5 text-sm leading-relaxed text-gray-400">{children}</div>
    </details>
  );
}

export default function Wholesale() {
  useDocumentTitle(
    'Programa de Mayoreo',
    'Tres niveles de precio que se activan solos según el monto del carrito, sin trámites ni códigos.'
  );

  const { settings } = useSettings();
  const reduced = useReducedMotion();

  const tienda = settings.store;

  // Fuente única: la misma aritmética que cobra el carrito, completada con los
  // ajustes por si el panel acaba de guardar valores nuevos.
  const reglas = useMemo(() => {
    const base = getPricingConfig();
    return {
      nivel2Desde: numero(settings.tiers?.tier2From, base.tier2From),
      nivel3Desde: numero(settings.tiers?.tier3From, base.tier3From),
      envioGratisDesde: numero(settings.shipping?.freeFrom, base.freeShippingFrom),
      costoEnvio: numero(settings.shipping?.cost, base.shippingCost),
    };
  }, [settings]);

  const whatsapp = String(tienda.whatsapp || '').replace(/\D/g, '');

  // Si el umbral del nivel ya supera el de envío gratis, el envío va incluido.
  const niveles = useMemo(
    () => [
      {
        id: 'nivel-1',
        etiqueta: 'Nivel 1',
        nombre: 'Menudeo',
        desde: 'Desde el primer producto',
        monto: null,
        resumen: 'El precio de lista que ves en el catálogo.',
        destacado: false,
        ventajas: [
          'Precio de lista publicado en cada ficha.',
          'Sin monto mínimo de compra.',
          `Envío de ${formatPrice(reglas.costoEnvio)}, gratis a partir de ${formatPrice(reglas.envioGratisDesde)}.`,
          'Ideal para consumo personal o para probar una marca.',
        ],
        cta: 'Ver catálogo',
      },
      {
        id: 'nivel-2',
        etiqueta: 'Nivel 2',
        nombre: 'Mayoreo',
        desde: `A partir de ${formatPrice(reglas.nivel2Desde)} en el carrito`,
        monto: reglas.nivel2Desde,
        resumen: 'Segundo escalón de precio en todo el catálogo.',
        destacado: true,
        ventajas: [
          'Precio de nivel 2 aplicado a todos los productos del pedido.',
          'Se activa solo: no hay registro, ni código, ni alta de distribuidor.',
          reglas.nivel2Desde >= reglas.envioGratisDesde
            ? 'Envío incluido, porque el pedido supera el monto de envío gratis.'
            : `Envío gratis a partir de ${formatPrice(reglas.envioGratisDesde)}.`,
          'Pensado para gimnasios pequeños y compras compartidas.',
        ],
        cta: 'Armar pedido de mayoreo',
      },
      {
        id: 'nivel-3',
        etiqueta: 'Nivel 3',
        nombre: 'Distribuidor',
        desde: `A partir de ${formatPrice(reglas.nivel3Desde)} en el carrito`,
        monto: reglas.nivel3Desde,
        resumen: 'El mejor precio disponible en la tienda.',
        destacado: false,
        ventajas: [
          'Precio de nivel 3, el más bajo del catálogo.',
          'El margen más amplio para revender en gimnasio o tienda.',
          reglas.nivel3Desde >= reglas.envioGratisDesde
            ? 'Envío incluido en todos los pedidos de este nivel.'
            : `Envío gratis a partir de ${formatPrice(reglas.envioGratisDesde)}.`,
          'Atención directa para surtidos grandes y recompras.',
        ],
        cta: 'Hacer pedido grande',
      },
    ],
    [reglas]
  );

  return (
    <div className="min-h-screen bg-carbon-900 text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <motion.header
          variants={resolveVariants(fadeUp, reduced)}
          initial="hidden"
          animate="visible"
          className="max-w-3xl"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-brand-500">Precios por volumen</p>
          <h1 className="titulo-pagina mt-3 font-black uppercase text-white">Programa de Mayoreo</h1>
          <p className="mt-5 text-base leading-relaxed text-gray-400">
            Tres niveles de precio que se activan solos según cuánto lleves en el carrito. Sin solicitudes, sin
            códigos y sin esperar aprobación: el descuento aparece en el momento.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/shop"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
            >
              Ir al catálogo
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              to="/cart"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 px-6 py-3 text-xs font-bold uppercase tracking-widest text-gray-200 transition-colors hover:border-brand-500 hover:text-brand-400"
            >
              Ver mi carrito
            </Link>
          </div>
        </motion.header>

        <div
          role="note"
          className="mt-8 flex max-w-3xl items-start gap-3 rounded-xl border border-brand-600/40 bg-brand-600/10 p-4 sm:p-5"
        >
          <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-500" />
          <p className="text-sm leading-relaxed text-gray-300">
            <strong className="font-bold text-white">Sitio de demostración.</strong> Las marcas, los productos y
            los montos de {tienda.name} son de ejemplo, igual que el correo y el teléfono de contacto. Los
            niveles sí funcionan de verdad dentro de la demostración: agrega productos al carrito y verás cómo
            cambia el precio al cruzar cada umbral.
          </p>
        </div>

        {/* Tarjetas de nivel ------------------------------------------------ */}
        <section aria-labelledby="niveles-titulo" className="mt-14">
          <h2 id="niveles-titulo" className="titulo-seccion font-black uppercase text-white">
            Los tres niveles
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400">
            El nivel se decide con los <span className="font-bold text-white">precios de lista</span> del
            carrito, antes de aplicar ofertas. Así, una promoción nunca te baja de escalón.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-3 lg:gap-8">
            {niveles.map((nivel, indice) => (
              <Reveal
                key={nivel.id}
                index={indice}
                className={`flex flex-col rounded-2xl p-6 sm:p-7 ${
                  nivel.destacado
                    ? 'resplandor-marca border-2 border-brand-500 bg-carbon-800'
                    : 'superficie border border-gray-800'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-[0.25em] ${
                      nivel.destacado ? 'text-brand-500' : 'text-gray-400'
                    }`}
                  >
                    {nivel.etiqueta}
                  </span>
                  {nivel.destacado && (
                    <span className="rounded-full bg-brand-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                      El más pedido
                    </span>
                  )}
                </div>

                <h3 className="mt-3 text-2xl font-black uppercase tracking-tight text-white">{nivel.nombre}</h3>
                <p className="mt-1 text-sm text-gray-400">{nivel.resumen}</p>

                <p
                  className={`mt-5 text-lg font-black ${nivel.destacado ? 'text-brand-400' : 'text-white'}`}
                >
                  {nivel.monto === null ? nivel.desde : formatPrice(nivel.monto)}
                </p>
                {nivel.monto !== null && (
                  <p className="mt-1 text-xs uppercase tracking-widest text-gray-400">o más en el carrito</p>
                )}

                <ul className="mt-6 flex-1 space-y-3 text-sm leading-relaxed text-gray-400">
                  {nivel.ventajas.map((ventaja) => (
                    <li key={ventaja} className="flex items-start gap-2">
                      <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                      <span>{ventaja}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/shop"
                  className={`mt-7 inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                    nivel.destacado
                      ? 'bg-brand-600 text-white hover:bg-brand-700'
                      : 'border border-gray-700 text-gray-200 hover:border-brand-500 hover:text-brand-400'
                  }`}
                >
                  {nivel.cta}
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Cómo funciona ---------------------------------------------------- */}
        <section aria-labelledby="pasos-titulo" className="mt-16">
          <h2 id="pasos-titulo" className="titulo-seccion font-black uppercase text-white">
            Cómo funciona
          </h2>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {PASOS.map((paso, indice) => (
              <Reveal key={paso.titulo} index={indice} className="superficie rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600/10 text-brand-500">
                    <paso.icono size={20} aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">
                    Paso {indice + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-bold uppercase tracking-wide text-white">{paso.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{paso.texto}</p>
              </Reveal>
            ))}
          </div>

          <Reveal className="superficie mt-6 rounded-2xl p-6 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Truck size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-500" />
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-white">Envío</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-400">
                    {formatPrice(reglas.costoEnvio)} por pedido, gratis a partir de{' '}
                    {formatPrice(reglas.envioGratisDesde)}. {tienda.shippingNote}.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Boxes size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-500" />
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-white">Sin mínimos por marca</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-400">
                    Puedes combinar todas las marcas y categorías del catálogo en el mismo pedido.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Preguntas -------------------------------------------------------- */}
        <section aria-labelledby="faq-titulo" className="mt-16 max-w-3xl">
          <h2 id="faq-titulo" className="titulo-seccion font-black uppercase text-white">
            Preguntas del programa
          </h2>

          <div className="mt-6 space-y-3">
            <Acordeon titulo="¿Tengo que registrarme como distribuidor?">
              <p>
                No. No hay solicitud, ni cuenta especial, ni aprobación previa: el nivel lo decide el monto del
                carrito en el momento de comprar.
              </p>
            </Acordeon>

            <Acordeon titulo="¿Las ofertas cuentan para alcanzar un nivel?">
              <p>
                El nivel se calcula con los precios de lista, no con los de oferta. Un producto rebajado no te
                hace bajar de escalón, y una vez que alcanzas el nivel, el descuento de la oferta se aplica
                sobre el precio de ese nivel.
              </p>
            </Acordeon>

            <Acordeon titulo="¿El precio de nivel aplica a todo el pedido?">
              <p>
                Sí. Al cruzar el umbral, todos los productos del carrito pasan al precio del nivel alcanzado,
                incluidos los que agregaste al principio.
              </p>
            </Acordeon>

            <Acordeon titulo={`¿Qué pasa si quito productos y bajo de ${formatPrice(reglas.nivel2Desde)}?`}>
              <p>
                El carrito vuelve a calcular el nivel al instante y los precios regresan al escalón que
                corresponda. Siempre pagas lo que marque el carrito al confirmar el pedido.
              </p>
            </Acordeon>

            <Acordeon titulo="¿Puedo pedir un surtido más grande que el nivel 3?">
              <p>
                En una tienda real ese caso se atendería de forma directa para cotizar disponibilidad y
                logística. En esta demostración el nivel 3 es el mejor precio disponible.
              </p>
            </Acordeon>
          </div>
        </section>

        {/* Contacto --------------------------------------------------------- */}
        <Reveal className="superficie mt-16 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="flex items-center gap-3 text-lg font-bold uppercase tracking-wide text-white sm:text-xl">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-500">
                  <Store size={20} aria-hidden="true" />
                </span>
                ¿Compras para un gimnasio o una tienda?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">
                Escríbenos y armamos el pedido contigo. Recuerda que estos datos son de ejemplo: en la
                demostración nadie responde del otro lado.
              </p>
              {tienda.hours && (
                <p className="mt-3 flex items-center gap-2 text-xs uppercase tracking-widest text-gray-400">
                  <Clock size={14} aria-hidden="true" />
                  {tienda.hours}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {tienda.email && (
                <a
                  href={`mailto:${tienda.email}?subject=Pedido%20de%20mayoreo`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
                >
                  <Mail size={16} aria-hidden="true" />
                  Escribir por correo
                </a>
              )}
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-200 transition-colors hover:border-brand-500 hover:text-brand-400"
                >
                  <Phone size={16} aria-hidden="true" />
                  WhatsApp
                </a>
              )}
              <Link
                to="/terms"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-200 transition-colors hover:border-brand-500 hover:text-brand-400"
              >
                Ver condiciones
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
