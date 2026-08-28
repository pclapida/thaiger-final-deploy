import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  Info,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Tags,
  Truck,
  UserCog,
} from 'lucide-react';
import Reveal from '../components/ui/Reveal';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSettings } from '../context/SettingsContext';
import { formatPrice, getPricingConfig } from '../lib/pricing';
import { fadeUp, resolveVariants } from '../lib/motion';
import { IS_LOCAL_MODE } from '../services/api';

/**
 * Términos y Condiciones.
 *
 * Ninguna cifra está escrita a mano: los montos de envío y los umbrales de
 * nivel salen de la misma configuración que cobra el carrito, y el contacto
 * sale de los ajustes de la tienda. Así la página legal nunca contradice a la
 * caja. Se dice de frente que el sitio es una demostración.
 */

const SECCIONES = [
  { id: 'general', titulo: '1. Información general', icono: FileText },
  { id: 'cuenta', titulo: '2. Cuenta y uso del sitio', icono: UserCog },
  { id: 'precios', titulo: '3. Precios y niveles', icono: Tags },
  { id: 'pagos', titulo: '4. Pagos', icono: CreditCard },
  { id: 'envios', titulo: '5. Envíos y entregas', icono: Truck },
  { id: 'devoluciones', titulo: '6. Cambios y devoluciones', icono: RefreshCw },
  { id: 'privacidad', titulo: '7. Privacidad y datos', icono: ShieldCheck },
  { id: 'contacto', titulo: '8. Contacto', icono: Mail },
];

const IDS = SECCIONES.map((seccion) => seccion.id);

// Se calcula una sola vez al cargar el módulo: si se recalculara en cada render
// la fecha "bailaría" entre renders sin aportar nada.
const ULTIMA_ACTUALIZACION = new Date().toLocaleDateString('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Devuelve el número de los ajustes o el de la configuración de precios. */
function numero(valor, alterno) {
  if (valor === null || valor === undefined || valor === '') return alterno;
  const convertido = Number(valor);
  return Number.isFinite(convertido) && convertido >= 0 ? convertido : alterno;
}

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

/** Bloque plegable accesible: `<details>` nativo, sin JavaScript de más. */
function Acordeon({ titulo, children }) {
  return (
    <details className="group rounded-xl border border-gray-800 bg-carbon-900/60 transition-colors hover:border-brand-600/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-bold uppercase tracking-wider text-gray-200 [&::-webkit-details-marker]:hidden">
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

/** Encabezado de sección con su icono, igual en las ocho. */
function TituloSeccion({ icono, children }) {
  const Icono = icono;

  return (
    <h2 className="mb-5 flex items-center gap-3 text-lg font-bold uppercase tracking-wide text-white sm:text-xl">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-500">
        <Icono size={20} aria-hidden="true" />
      </span>
      {children}
    </h2>
  );
}

export default function Terms() {
  useDocumentTitle(
    'Términos y Condiciones',
    'Reglas de uso, precios, envíos, pagos y privacidad de la tienda de demostración Thaiger Supplements.'
  );

  const { settings } = useSettings();
  const reduced = useReducedMotion();
  const activa = useSeccionActiva(IDS);

  const tienda = settings.store;
  const pago = settings.payment;

  // Los montos salen de los ajustes; si faltara alguno, de la aritmética de precios.
  const reglas = useMemo(() => {
    const base = getPricingConfig();
    return {
      envioGratisDesde: numero(settings.shipping?.freeFrom, base.freeShippingFrom),
      costoEnvio: numero(settings.shipping?.cost, base.shippingCost),
      nivel2Desde: numero(settings.tiers?.tier2From, base.tier2From),
      nivel3Desde: numero(settings.tiers?.tier3From, base.tier3From),
    };
  }, [settings]);

  const whatsapp = String(tienda.whatsapp || '').replace(/\D/g, '');

  const datosTienda = [
    { icono: FileText, etiqueta: 'Nombre comercial', valor: tienda.name },
    { icono: MapPin, etiqueta: 'Domicilio', valor: tienda.address },
    { icono: Mail, etiqueta: 'Correo', valor: tienda.email },
    { icono: Phone, etiqueta: 'Teléfono', valor: tienda.phone },
    { icono: Clock, etiqueta: 'Horario', valor: tienda.hours },
  ].filter((dato) => Boolean(dato.valor));

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
          <h1 className="titulo-pagina mt-3 font-black uppercase text-white">Términos y Condiciones</h1>
          <p className="mt-5 text-base leading-relaxed text-gray-400">
            Estas son las reglas con las que funciona {tienda.name}: cómo se calculan los precios, cómo se
            paga, cómo se envía y qué pasa con tus datos. Están escritas en corto y sin letra chica.
          </p>
          <p className="mt-3 text-xs uppercase tracking-widest text-gray-400">
            Última actualización: {ULTIMA_ACTUALIZACION}
          </p>
        </motion.header>

        <div
          role="note"
          className="mt-8 flex max-w-3xl items-start gap-3 rounded-xl border border-brand-600/40 bg-brand-600/10 p-4 sm:p-5"
        >
          <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-500" />
          <p className="text-sm leading-relaxed text-gray-300">
            <strong className="font-bold text-white">Sitio de demostración.</strong> {tienda.name} es una tienda
            de ejemplo: no hay una empresa detrás, no se cobra dinero real y los datos fiscales, bancarios y de
            contacto que aparecen aquí son ficticios. Este documento sirve para mostrar cómo se vería una página
            legal, no como contrato ni como asesoría jurídica.
          </p>
        </div>

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
              {SECCIONES.map((seccion) => (
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
                {SECCIONES.map((seccion) => {
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
            {/* 1 ------------------------------------------------------------ */}
            <Reveal as="section" id="general" className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
              <TituloSeccion icono={FileText}>1. Información general</TituloSeccion>
              <div className="space-y-4 text-sm leading-relaxed text-gray-400">
                <p>
                  Al navegar, registrarte o levantar un pedido en {tienda.name} aceptas estos términos. Si no
                  estás de acuerdo con alguno, lo correcto es no usar el sitio.
                </p>
                <p>
                  Podemos actualizar este documento cuando cambien las condiciones de la tienda. La versión
                  vigente es siempre la publicada en esta página, con la fecha que aparece arriba.
                </p>

                <dl className="grid gap-3 pt-2 sm:grid-cols-2">
                  {datosTienda.map((dato) => (
                    <div key={dato.etiqueta} className="rounded-lg border border-gray-800 bg-carbon-900/60 p-4">
                      <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                        <dato.icono size={13} aria-hidden="true" />
                        {dato.etiqueta}
                      </dt>
                      <dd className="mt-1 break-words text-sm text-gray-300">{dato.valor}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-gray-400">Datos de ejemplo, cargados desde la configuración de la tienda.</p>

                <Acordeon titulo="Qué faltaría en una tienda real">
                  <p>Antes de vender de verdad, este apartado tendría que incluir:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Razón social, RFC y domicilio fiscal de quien vende.</li>
                    <li>Aviso de privacidad conforme a la ley aplicable.</li>
                    <li>Datos del responsable de atención a clientes y del medio de aclaraciones.</li>
                    <li>Condiciones específicas de facturación.</li>
                  </ul>
                </Acordeon>
              </div>
            </Reveal>

            {/* 2 ------------------------------------------------------------ */}
            <Reveal as="section" id="cuenta" className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
              <TituloSeccion icono={UserCog}>2. Cuenta y uso del sitio</TituloSeccion>
              <div className="space-y-4 text-sm leading-relaxed text-gray-400">
                <p>
                  Puedes ver el catálogo sin cuenta, pero para pagar necesitas registrarte con un correo y una
                  contraseña. El formulario te indica los requisitos mínimos de la contraseña al escribirla.
                </p>
                <p>
                  Tú eres responsable de lo que ocurra con tu sesión: no compartas tu contraseña y cierra sesión
                  en equipos que no sean tuyos.
                </p>

                <Acordeon titulo="Uso permitido del sitio">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>No intentes acceder a cuentas ajenas ni al panel de administración sin permiso.</li>
                    <li>No uses procesos automáticos para copiar el catálogo o saturar el sitio.</li>
                    <li>Las opiniones de producto deben ser tuyas y sin contenido ofensivo.</li>
                    <li>Podemos suspender una cuenta que incumpla estos puntos.</li>
                  </ul>
                </Acordeon>

                <Acordeon titulo="Cuentas de demostración">
                  <p>
                    El sitio incluye cuentas de prueba abiertas a cualquiera que visite la demostración. No
                    guardes en ellas información que consideres privada: cualquiera puede entrar y el contenido
                    se reinicia al restablecer la demostración.
                  </p>
                </Acordeon>
              </div>
            </Reveal>

            {/* 3 ------------------------------------------------------------ */}
            <Reveal as="section" id="precios" className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
              <TituloSeccion icono={Tags}>3. Precios y niveles</TituloSeccion>
              <div className="space-y-4 text-sm leading-relaxed text-gray-400">
                <p>
                  Los precios se muestran en pesos mexicanos (MXN) y pueden cambiar sin aviso. El precio que
                  vale es el que el sitio calcula al confirmar el pedido.
                </p>
                <p>
                  El catálogo trabaja con tres niveles de precio que se activan solos según el monto del
                  carrito, calculado con precios de lista:
                </p>
                <ul className="space-y-2">
                  <li className="flex flex-wrap items-baseline gap-x-2 rounded-lg border border-gray-800 bg-carbon-900/60 p-3">
                    <span className="font-bold text-white">Nivel 1</span>
                    <span>precio de lista, desde el primer producto.</span>
                  </li>
                  <li className="flex flex-wrap items-baseline gap-x-2 rounded-lg border border-gray-800 bg-carbon-900/60 p-3">
                    <span className="font-bold text-white">Nivel 2</span>
                    <span>
                      a partir de <span className="font-bold text-brand-400">{formatPrice(reglas.nivel2Desde)}</span> en
                      el carrito.
                    </span>
                  </li>
                  <li className="flex flex-wrap items-baseline gap-x-2 rounded-lg border border-gray-800 bg-carbon-900/60 p-3">
                    <span className="font-bold text-white">Nivel 3</span>
                    <span>
                      a partir de <span className="font-bold text-brand-400">{formatPrice(reglas.nivel3Desde)}</span> en
                      el carrito.
                    </span>
                  </li>
                </ul>
                <p>
                  Cuando un producto está en oferta, su descuento se aplica sobre el precio del nivel vigente.
                  El detalle completo está en el{' '}
                  <Link to="/wholesale" className="font-bold text-brand-500 underline-offset-4 hover:underline">
                    programa de mayoreo
                  </Link>
                  .
                </p>
              </div>
            </Reveal>

            {/* 4 ------------------------------------------------------------ */}
            <Reveal as="section" id="pagos" className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
              <TituloSeccion icono={CreditCard}>4. Pagos</TituloSeccion>
              <div className="space-y-4 text-sm leading-relaxed text-gray-400">
                <p>
                  El pago se hace por transferencia electrónica (SPEI). Al confirmar el pedido verás la cuenta
                  de {pago.beneficiary} en {pago.bank} y un concepto único: hay que usar ese concepto para que
                  el pago se pueda identificar.
                </p>
                <p>
                  El pedido queda apartado al confirmarlo y pasa a prepararse cuando el pago se registra. Si el
                  pago no llega, el pedido puede cancelarse y el inventario se libera.
                </p>
                {pago.isDemo && (
                  <p className="rounded-lg border border-brand-600/40 bg-brand-600/10 p-4 text-sm text-gray-300">
                    <strong className="font-bold text-white">No transfieras dinero.</strong> La cuenta que muestra
                    el checkout es de ejemplo y nadie concilia los pagos: el estatus de cada pedido lo cambia a
                    mano quien administra la demostración.
                  </p>
                )}

                <Acordeon titulo="Facturación">
                  <p>
                    Esta demostración no emite comprobantes fiscales. En una tienda real, la factura se
                    solicitaría con los datos fiscales dentro del mismo mes de la compra.
                  </p>
                </Acordeon>
              </div>
            </Reveal>

            {/* 5 ------------------------------------------------------------ */}
            <Reveal as="section" id="envios" className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
              <TituloSeccion icono={Truck}>5. Envíos y entregas</TituloSeccion>
              <div className="space-y-4 text-sm leading-relaxed text-gray-400">
                <p>{tienda.shippingNote}.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-800 bg-carbon-900/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Envío gratis desde</p>
                    <p className="mt-1 text-xl font-black text-brand-500">{formatPrice(reglas.envioGratisDesde)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-carbon-900/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Envío por debajo de ese monto</p>
                    <p className="mt-1 text-xl font-black text-white">{formatPrice(reglas.costoEnvio)}</p>
                  </div>
                </div>
                <p>
                  Los pedidos se preparan en horario de tienda ({tienda.hours}). El costo de envío se calcula en
                  el carrito antes de pagar, nunca después.
                </p>

                <Acordeon titulo="Datos de entrega y demoras">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      La dirección que registres es la que se usa: revísala antes de confirmar, porque un dato
                      incorrecto puede devolver el paquete al origen.
                    </li>
                    <li>
                      No respondemos por demoras de la paquetería, causas de fuerza mayor o direcciones
                      inexistentes.
                    </li>
                    <li>
                      En esta demostración no hay paquetería contratada: ningún pedido sale físicamente y los
                      tiempos que aparecen son ilustrativos.
                    </li>
                  </ul>
                </Acordeon>
              </div>
            </Reveal>

            {/* 6 ------------------------------------------------------------ */}
            <Reveal as="section" id="devoluciones" className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
              <TituloSeccion icono={RefreshCw}>6. Cambios y devoluciones</TituloSeccion>
              <div className="space-y-4 text-sm leading-relaxed text-gray-400">
                <p>
                  Por tratarse de suplementos alimenticios, no se aceptan devoluciones de productos abiertos o
                  con el sello de seguridad roto. Si el producto llegó dañado o no corresponde con lo que
                  pediste, hay que reportarlo dentro de los primeros días tras recibirlo.
                </p>
                <p>
                  Los plazos, los pasos y las excepciones están detallados en las{' '}
                  <Link to="/refunds" className="font-bold text-brand-500 underline-offset-4 hover:underline">
                    políticas de devolución
                  </Link>
                  .
                </p>
              </div>
            </Reveal>

            {/* 7 ------------------------------------------------------------ */}
            <Reveal as="section" id="privacidad" className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
              <TituloSeccion icono={ShieldCheck}>7. Privacidad y datos</TituloSeccion>
              <div className="space-y-4 text-sm leading-relaxed text-gray-400">
                <p>
                  Los datos que registras (nombre, correo y dirección de envío) se usan únicamente para
                  procesar tus pedidos y mostrarte tu historial. No se venden ni se comparten con terceros que
                  no participen en la entrega.
                </p>
                {IS_LOCAL_MODE ? (
                  <p className="rounded-lg border border-gray-800 bg-carbon-900/60 p-4 text-gray-300">
                    En esta demostración todo vive dentro de tu navegador: cuenta, pedidos, favoritos y
                    opiniones se guardan en tu propio equipo y no viajan a ningún servidor. Si borras los datos
                    del sitio, desaparecen; y no se ven desde otra computadora.
                  </p>
                ) : (
                  <p className="rounded-lg border border-gray-800 bg-carbon-900/60 p-4 text-gray-300">
                    Tus datos se guardan en el servicio contratado por la tienda para operar el catálogo, las
                    cuentas y los pedidos.
                  </p>
                )}
                <p>
                  Las contraseñas nunca se guardan tal cual: se almacenan derivadas, de manera que ni quien
                  administra el sitio puede leerlas.
                </p>
              </div>
            </Reveal>

            {/* 8 ------------------------------------------------------------ */}
            <Reveal as="section" id="contacto" className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
              <TituloSeccion icono={Mail}>8. Contacto</TituloSeccion>
              <div className="space-y-4 text-sm leading-relaxed text-gray-400">
                <p>
                  Si algo de este documento no queda claro, escríbenos. Son datos de ejemplo, así que en esta
                  demostración nadie responderá del otro lado.
                </p>
                <div className="flex flex-wrap gap-3">
                  {tienda.email && (
                    <a
                      href={`mailto:${tienda.email}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 px-4 py-3 text-sm font-bold text-gray-200 transition-colors hover:border-brand-500 hover:text-brand-400"
                    >
                      <Mail size={16} aria-hidden="true" />
                      {tienda.email}
                    </a>
                  )}
                  {tienda.phone && (
                    <a
                      href={`tel:${String(tienda.phone).replace(/\s/g, '')}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 px-4 py-3 text-sm font-bold text-gray-200 transition-colors hover:border-brand-500 hover:text-brand-400"
                    >
                      <Phone size={16} aria-hidden="true" />
                      {tienda.phone}
                    </a>
                  )}
                  {whatsapp && (
                    <a
                      href={`https://wa.me/${whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 px-4 py-3 text-sm font-bold text-gray-200 transition-colors hover:border-brand-500 hover:text-brand-400"
                    >
                      <Phone size={16} aria-hidden="true" />
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </Reveal>

            <p className="pt-2 text-center text-xs leading-relaxed text-gray-400">
              Documento de ejemplo con fines de demostración. No sustituye la asesoría legal de una tienda real.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
