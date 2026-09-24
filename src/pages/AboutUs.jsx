import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Boxes,
  ChevronDown,
  Clock,
  Mail,
  MapPin,
  Percent,
  Phone,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import Reveal from '../components/ui/Reveal';
import { Skeleton } from '../components/ui/Skeleton';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSettings } from '../context/SettingsContext';
import { formatPrice, getPricingConfig } from '../lib/pricing';
import { fadeUp, resolveVariants } from '../lib/motion';
import { products as productsApi } from '../services/api';

/**
 * Quiénes Somos.
 *
 * La identidad (nombre, lema, descripción y contacto) sale de los ajustes de
 * la tienda y las cifras del catálogo se cuentan del catálogo real, así que
 * nada de esta página puede quedarse desfasado.
 */

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

export default function AboutUs() {
  useDocumentTitle(
    'Quiénes Somos',
    'Quiénes somos en Thaiger Supplements, cómo comprar, cómo pagar y cómo te llega tu pedido.'
  );

  const { settings } = useSettings();
  const reduced = useReducedMotion();

  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;

    productsApi
      .list()
      .then((lista) => {
        if (vivo) setProductos(Array.isArray(lista) ? lista : []);
      })
      .catch(() => {
        // Las cifras son un adorno: si el catálogo no carga, la página sigue
        // contando su historia sin números en lugar de romperse.
        if (vivo) setProductos([]);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, []);

  const tienda = settings.store;

  const reglas = useMemo(() => {
    const base = getPricingConfig();
    return {
      envioGratisDesde: numero(settings.shipping?.freeFrom, base.freeShippingFrom),
      nivel2Desde: numero(settings.tiers?.tier2From, base.tier2From),
    };
  }, [settings]);

  // Las cifras se cuentan del catálogo, nunca se escriben a mano.
  const cifras = useMemo(() => {
    const marcas = new Set(productos.map((producto) => producto.brand).filter(Boolean));
    const categorias = new Set(productos.map((producto) => producto.category).filter(Boolean));
    return [
      { valor: productos.length, etiqueta: 'Productos en catálogo' },
      { valor: marcas.size, etiqueta: 'Marcas representadas' },
      { valor: categorias.size, etiqueta: 'Categorías' },
    ];
  }, [productos]);

  const whatsapp = String(tienda.whatsapp || '').replace(/\D/g, '');

  const valores = [
    {
      icono: ShieldCheck,
      titulo: 'Etiqueta completa',
      texto:
        'Cada ficha dice qué es el producto, de qué marca y en qué categoría entra. Sin fórmulas secretas ni promesas imposibles.',
    },
    {
      icono: Percent,
      titulo: 'El precio no esconde nada',
      texto: `Los descuentos se aplican sobre el precio que te toca, y a partir de ${formatPrice(
        reglas.nivel2Desde
      )} el catálogo entero baja de nivel.`,
    },
    {
      icono: Truck,
      titulo: 'Envío calculado antes de pagar',
      texto: `Gratis desde ${formatPrice(
        reglas.envioGratisDesde
      )}. El costo se muestra en el carrito antes de confirmar, nunca después.`,
    },
    {
      icono: Store,
      titulo: 'Inventario de verdad',
      texto:
        'Si algo está agotado, se dice y no se puede comprar. El stock se descuenta al confirmar el pedido.',
    },
  ];

  const pasos = [
    {
      titulo: 'Arma tu carrito',
      texto:
        'Elige tus productos. El nivel de precio se activa solo según el monto del carrito, y ves el ahorro antes de pagar.',
    },
    {
      titulo: 'Confirma tu dirección y el envío',
      texto: 'Captura dónde recibes y elige el envío. El total que ves es el total que pagas.',
    },
    {
      titulo: 'Paga de forma segura',
      texto:
        settings.payment?.gateway === 'mercadopago'
          ? 'Con tarjeta, transferencia SPEI u OXXO a través de Mercado Pago. Nunca vemos ni guardamos los datos de tu tarjeta.'
          : 'Por transferencia SPEI a la cuenta que te mostramos al confirmar, con un concepto único para identificar tu pago.',
    },
    {
      titulo: 'Recibe y rastrea',
      texto:
        'En cuanto se confirma el pago preparamos tu pedido. El número de guía aparece en tu perfil, en «Mis pedidos».',
    },
  ];

  const rutas = [
    { to: '/shop', icono: Boxes, titulo: 'Recorrer el catálogo', texto: 'Filtra por marca, categoría y precio.' },
    { to: '/wholesale', icono: Percent, titulo: 'Ver el mayoreo', texto: 'Los tres niveles y sus umbrales.' },
    { to: '/offers', icono: Sparkles, titulo: 'Ver las ofertas', texto: 'Los productos con descuento vigente.' },
  ];

  return (
    <div className="min-h-screen bg-carbon-900 text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <motion.header
          variants={resolveVariants(fadeUp, reduced)}
          initial="hidden"
          animate="visible"
          className="max-w-3xl"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-brand-500">La tienda</p>
          <h1 className="titulo-pagina mt-3 font-black uppercase text-white">Quiénes Somos</h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-300">{tienda.tagline}.</p>
          <p className="mt-4 text-base leading-relaxed text-gray-400">{tienda.description}</p>
        </motion.header>

        {/* Cifras del catálogo ---------------------------------------------- */}
        <section aria-label="Cifras del catálogo" className="mt-12">
          <div className="grid gap-4 sm:grid-cols-3">
            {cifras.map((cifra, indice) => (
              <Reveal key={cifra.etiqueta} index={indice} className="superficie rounded-2xl p-6 text-center">
                {cargando ? (
                  <Skeleton className="mx-auto h-9 w-16" />
                ) : (
                  <p className="text-3xl font-black text-brand-500">{cifra.valor}</p>
                )}
                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                  {cifra.etiqueta}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Misión ------------------------------------------------------------ */}
        <Reveal as="section" aria-labelledby="mision-titulo" className="superficie mt-12 rounded-2xl p-6 sm:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl flex-1">
              <h2 id="mision-titulo" className="titulo-seccion font-black uppercase text-white">
                Nuestra idea de una buena tienda
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-gray-400">
                En suplementación deportiva sobran las promesas y falta la información. La tienda que queríamos
                construir es la contraria: precios que se entienden sin calculadora, existencias reales, envíos
                sin sorpresas al final y un carrito que cobra exactamente lo que muestra.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-gray-400">
                De ahí salen las reglas de {tienda.name}: el descuento se aplica sobre el precio que te toca,
                el nivel de mayoreo se activa solo y el total se calcula en el servidor al confirmar, no en tu
                navegador. Nadie paga de más por leer mal una promoción.
              </p>
              <Link
                to="/shop"
                className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
              >
                Ver el catálogo
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <div className="grid shrink-0 place-items-center lg:w-64">
              <span className="grid h-32 w-32 place-items-center rounded-full bg-brand-600/10 text-brand-500 sm:h-40 sm:w-40">
                <Sparkles size={64} aria-hidden="true" className="opacity-80" />
              </span>
            </div>
          </div>
        </Reveal>

        {/* Valores ----------------------------------------------------------- */}
        <section aria-labelledby="valores-titulo" className="mt-16">
          <h2 id="valores-titulo" className="titulo-seccion font-black uppercase text-white">
            Cómo trabajamos
          </h2>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {valores.map((valor, indice) => (
              <Reveal key={valor.titulo} index={indice} className="superficie h-full rounded-2xl p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600/10 text-brand-500">
                  <valor.icono size={22} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-base font-bold uppercase tracking-wide text-white">{valor.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{valor.texto}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Cómo comprar ---------------------------------------------------- */}
        <section aria-labelledby="comprar-titulo" className="mt-16 max-w-3xl">
          <h2 id="comprar-titulo" className="titulo-seccion font-black uppercase text-white">
            Cómo comprar
          </h2>

          <ol className="mt-8 space-y-8 border-l border-gray-800 pl-8">
            {pasos.map((paso, indice) => (
              <Reveal as="li" key={paso.titulo} index={indice} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[42px] flex h-7 w-7 items-center justify-center rounded-full border border-brand-600/50 bg-carbon-900 text-xs font-black text-brand-500"
                >
                  {indice + 1}
                </span>
                <h3 className="text-sm font-bold uppercase tracking-wide text-white">{paso.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{paso.texto}</p>
              </Reveal>
            ))}
          </ol>

          <div className="mt-10 space-y-3">
            <Acordeon titulo="¿Los productos son originales?">
              <p>
                Sí. Vendemos producto original, sellado y con caducidad vigente. Si algo te llega abierto, dañado o
                distinto a lo que pediste, repórtalo y lo resolvemos.
              </p>
            </Acordeon>
            <Acordeon titulo="¿Cuándo llega mi pedido?">
              <p>
                Lo preparamos después de confirmar tu pago y el tiempo de traslado depende de la paquetería y de tu
                código postal. Los detalles están en{' '}
                <Link to="/envios" className="text-brand-400 underline-offset-2 hover:underline">
                  Envíos y entregas
                </Link>
                .
              </p>
            </Acordeon>
            <Acordeon titulo="¿Puedo devolver un producto?">
              <p>
                Sí, dentro de los plazos y condiciones de nuestra{' '}
                <Link to="/refunds" className="text-brand-400 underline-offset-2 hover:underline">
                  política de devoluciones
                </Link>
                . Por tratarse de suplementos, el producto debe estar cerrado y con su sello intacto, salvo que
                haya llegado dañado o con defecto.
              </p>
            </Acordeon>
            <Acordeon titulo="¿Qué hacen con mis datos?">
              <p>
                Los usamos sólo para operar tu cuenta y tus pedidos. Cómo, con quién y cómo ejercer tus derechos
                está en el{' '}
                <Link to="/privacidad" className="text-brand-400 underline-offset-2 hover:underline">
                  aviso de privacidad
                </Link>
                .
              </p>
            </Acordeon>
          </div>
        </section>

        {/* Qué probar -------------------------------------------------------- */}
        <section aria-labelledby="probar-titulo" className="mt-16">
          <h2 id="probar-titulo" className="titulo-seccion font-black uppercase text-white">
            Empieza por aquí
          </h2>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {rutas.map((ruta, indice) => (
              <Reveal key={ruta.to} index={indice} className="h-full">
                <Link
                  to={ruta.to}
                  className="superficie group flex h-full flex-col rounded-2xl p-6 transition-colors hover:border-brand-600"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600/10 text-brand-500">
                    <ruta.icono size={22} aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-base font-bold uppercase tracking-wide text-white">{ruta.titulo}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-400">{ruta.texto}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-500">
                    Abrir
                    <ArrowRight
                      size={14}
                      aria-hidden="true"
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Contacto ---------------------------------------------------------- */}
        <Reveal as="section" aria-labelledby="contacto-titulo" className="superficie mt-16 rounded-2xl p-6 sm:p-8">
          <h2 id="contacto-titulo" className="titulo-seccion font-black uppercase text-white">
            Dónde encontrarnos
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400">
            ¿Dudas sobre un producto, un pedido o una compra por volumen? Escríbenos.
          </p>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              { icono: Mail, etiqueta: 'Correo', valor: tienda.email },
              { icono: Phone, etiqueta: 'Teléfono', valor: tienda.phone },
              { icono: MapPin, etiqueta: 'Domicilio', valor: tienda.address },
              { icono: Clock, etiqueta: 'Horario', valor: tienda.hours },
            ]
              .filter((dato) => Boolean(dato.valor))
              .map((dato) => (
                <div key={dato.etiqueta} className="rounded-lg border border-gray-800 bg-carbon-900/60 p-4">
                  <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    <dato.icono size={13} aria-hidden="true" />
                    {dato.etiqueta}
                  </dt>
                  <dd className="mt-1 break-words text-sm text-gray-300">{dato.valor}</dd>
                </div>
              ))}
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            {tienda.email && (
              <a
                href={`mailto:${tienda.email}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
              >
                <Mail size={16} aria-hidden="true" />
                Escribir
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
              Términos y condiciones
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
