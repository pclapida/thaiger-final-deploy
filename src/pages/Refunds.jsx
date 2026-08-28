import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  Banknote,
  ChevronDown,
  Clock,
  HelpCircle,
  Info,
  ListChecks,
  Mail,
  PackageCheck,
  PackageX,
  Phone,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import Reveal from '../components/ui/Reveal';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSettings } from '../context/SettingsContext';
import { formatPrice, getPricingConfig } from '../lib/pricing';
import { fadeUp, resolveVariants } from '../lib/motion';

/**
 * Políticas de devolución.
 *
 * Las cifras de envío salen de los ajustes de la tienda (nunca escritas a
 * mano) y se dice sin rodeos que el sitio es una demostración: aquí no hay
 * paquetería, ni banco, ni nadie que reciba un paquete de vuelta.
 */

const PLAZO_REPORTE_DIAS = 3;

const SECCIONES = [
  { id: 'resumen', titulo: '1. Resumen rápido', icono: ListChecks },
  { id: 'cubre', titulo: '2. Qué sí se cambia', icono: PackageCheck },
  { id: 'no-cubre', titulo: '3. Qué no se acepta', icono: PackageX },
  { id: 'proceso', titulo: '4. Cómo se reporta', icono: RotateCcw },
  { id: 'reembolsos', titulo: '5. Reembolsos y plazos', icono: Banknote },
  { id: 'cancelaciones', titulo: '6. Cancelaciones', icono: Clock },
  { id: 'preguntas', titulo: '7. Preguntas frecuentes', icono: HelpCircle },
];

const IDS = SECCIONES.map((seccion) => seccion.id);

const PASOS = [
  {
    titulo: 'Repórtalo a tiempo',
    texto: `Escríbenos dentro de los ${PLAZO_REPORTE_DIAS} días naturales siguientes a la entrega, indicando el número de pedido.`,
  },
  {
    titulo: 'Manda evidencia',
    texto: 'Fotos del producto, del sello de seguridad y de la caja tal como llegó. Con eso basta para abrir el caso.',
  },
  {
    titulo: 'Esperas la respuesta',
    texto: 'Revisamos el caso contra el pedido y el inventario, y te decimos si procede cambio, reposición o reembolso.',
  },
  {
    titulo: 'Se resuelve',
    texto: 'Si procede, coordinamos la recolección del producto y enviamos la reposición o devolvemos el dinero.',
  },
];

const PREGUNTAS = [
  {
    pregunta: '¿Puedo devolver un producto porque no me gustó el sabor?',
    respuesta:
      'No. El sabor es una preferencia personal y el producto ya salió sellado del almacén. Si dudas entre dos sabores, pregúntanos antes de comprar.',
  },
  {
    pregunta: 'Me llegó un producto distinto al que pedí, ¿qué hago?',
    respuesta:
      'Repórtalo con fotos y el número de pedido. El error es nuestro, así que la reposición y el envío corren por nuestra cuenta.',
  },
  {
    pregunta: '¿Y si el producto está cerca de su fecha de caducidad?',
    respuesta:
      'Si al recibirlo tiene menos de dos meses de vida útil, entra como producto en mal estado y se cambia sin discusión.',
  },
  {
    pregunta: '¿El envío también se devuelve?',
    respuesta:
      'Si el error fue nuestro, sí: se reembolsa el producto y el envío que hayas pagado. Si la devolución es por un cambio de opinión aceptado como excepción, el envío no se reembolsa.',
  },
  {
    pregunta: '¿Cuánto tarda el reembolso?',
    respuesta:
      'Una vez aprobado el caso, el dinero se regresa a la misma cuenta desde la que se hizo la transferencia. El tiempo depende del banco.',
  },
];

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

/** Encabezado de sección con su icono. */
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

export default function Refunds() {
  useDocumentTitle(
    'Políticas de Devolución',
    'Qué se cambia, qué no, cómo se reporta un problema y cómo funcionan los reembolsos en Thaiger Supplements.'
  );

  const { settings } = useSettings();
  const reduced = useReducedMotion();
  const activa = useSeccionActiva(IDS);

  const tienda = settings.store;

  // Montos de envío: de los ajustes, con la configuración de precios como respaldo.
  const envio = useMemo(() => {
    const base = getPricingConfig();
    return {
      gratisDesde: numero(settings.shipping?.freeFrom, base.freeShippingFrom),
      costo: numero(settings.shipping?.cost, base.shippingCost),
    };
  }, [settings]);

  const whatsapp = String(tienda.whatsapp || '').replace(/\D/g, '');

  const resumen = [
    {
      icono: Clock,
      titulo: `${PLAZO_REPORTE_DIAS} días para reportar`,
      texto: 'Ese es el plazo desde que recibes el paquete para avisarnos de un producto dañado o incorrecto.',
    },
    {
      icono: ShieldCheck,
      titulo: 'Sello intacto',
      texto: 'Por sanidad, un suplemento abierto ya no se puede cambiar ni devolver.',
    },
    {
      icono: Banknote,
      titulo: 'Devolución a la misma cuenta',
      texto: 'El reembolso regresa a la cuenta desde la que se transfirió, sin comisiones nuestras.',
    },
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
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-brand-500">Compra tranquila</p>
          <h1 className="titulo-pagina mt-3 font-black uppercase text-white">Políticas de Devolución</h1>
          <p className="mt-5 text-base leading-relaxed text-gray-400">
            Reglas claras y en pocas líneas: qué se cambia, qué no, en cuánto tiempo hay que avisar y cómo
            regresa el dinero. Sin trampas ni letra chica.
          </p>
        </motion.header>

        <div
          role="note"
          className="mt-8 flex max-w-3xl items-start gap-3 rounded-xl border border-brand-600/40 bg-brand-600/10 p-4 sm:p-5"
        >
          <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-500" />
          <p className="text-sm leading-relaxed text-gray-300">
            <strong className="font-bold text-white">Sitio de demostración.</strong> {tienda.name} no vende de
            verdad: no hay paquetería, ni cobros, ni una cuenta bancaria real. Esta política existe para mostrar
            cómo se documentaría el proceso en una tienda que sí opera; el correo y el teléfono que aparecen son
            de ejemplo.
          </p>
        </div>

        {/* Índice en móvil */}
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
            <Reveal as="section" id="resumen" className="scroll-mt-28">
              <TituloSeccion icono={ListChecks}>1. Resumen rápido</TituloSeccion>
              <div className="grid gap-4 sm:grid-cols-3">
                {resumen.map((punto) => (
                  <div key={punto.titulo} className="superficie rounded-xl p-5">
                    <punto.icono size={24} aria-hidden="true" className="text-brand-500" />
                    <h3 className="mt-4 text-sm font-bold uppercase tracking-wide text-white">{punto.titulo}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">{punto.texto}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* 2 ------------------------------------------------------------ */}
            <Reveal as="section" id="cubre" className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
              <TituloSeccion icono={PackageCheck}>2. Qué sí se cambia</TituloSeccion>
              <p className="mb-4 text-sm leading-relaxed text-gray-400">
                Si el problema viene del pedido o del traslado, lo resolvemos sin que te cueste nada:
              </p>
              <ul className="space-y-3 text-sm leading-relaxed text-gray-300">
                {[
                  'Producto equivocado: llegó algo distinto a lo que aparece en tu pedido.',
                  'Producto dañado en tránsito: el envase se rompió o se abrió durante el traslado.',
                  'Producto incompleto: falta una pieza del pedido o del paquete.',
                  'Producto con menos de dos meses de vida útil al recibirlo.',
                ].map((caso) => (
                  <li key={caso} className="flex items-start gap-3 rounded-lg border border-gray-800 bg-carbon-900/60 p-4">
                    <PackageCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-green-500" />
                    <span>{caso}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm leading-relaxed text-gray-400">
                En estos casos eliges reposición del mismo producto o reembolso completo, incluido el envío que
                hayas pagado.
              </p>
            </Reveal>

            {/* 3 ------------------------------------------------------------ */}
            <Reveal as="section" id="no-cubre" className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
              <TituloSeccion icono={PackageX}>3. Qué no se acepta</TituloSeccion>
              <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-900/60 bg-red-950/30 p-4">
                <AlertTriangle size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-sm leading-relaxed text-gray-300">
                  <strong className="font-bold text-white">Producto abierto, producto vendido.</strong> Un
                  suplemento cuyo sello de seguridad se rompió ya no puede volver a inventario: no hay forma de
                  garantizar que sea seguro para la siguiente persona.
                </p>
              </div>
              <ul className="space-y-3 text-sm leading-relaxed text-gray-300">
                {[
                  'Envases abiertos, sin sello o con el contenido consumido parcialmente.',
                  'Reportes hechos después del plazo de los primeros días tras la entrega.',
                  'Daños por mal almacenamiento después de recibido (calor, humedad, golpes).',
                  'Cambio de opinión sobre el sabor, la presentación o el resultado esperado.',
                  'Productos en oferta de liquidación, marcados como venta final.',
                ].map((caso) => (
                  <li key={caso} className="flex items-start gap-3 rounded-lg border border-gray-800 bg-carbon-900/60 p-4">
                    <PackageX size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-red-500" />
                    <span>{caso}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            {/* 4 ------------------------------------------------------------ */}
            <Reveal as="section" id="proceso" className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
              <TituloSeccion icono={RotateCcw}>4. Cómo se reporta</TituloSeccion>
              <ol className="relative space-y-6 border-l border-gray-800 pl-8">
                {PASOS.map((paso, indice) => (
                  <li key={paso.titulo} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[42px] flex h-7 w-7 items-center justify-center rounded-full border border-brand-600/50 bg-carbon-900 text-xs font-black text-brand-500"
                    >
                      {indice + 1}
                    </span>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-white">{paso.titulo}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">{paso.texto}</p>
                  </li>
                ))}
              </ol>

              <div className="mt-6 flex flex-wrap gap-3">
                {tienda.email && (
                  <a
                    href={`mailto:${tienda.email}?subject=Devoluci%C3%B3n%20de%20pedido`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
                  >
                    <Mail size={16} aria-hidden="true" />
                    Reportar por correo
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
                  to="/profile"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-200 transition-colors hover:border-brand-500 hover:text-brand-400"
                >
                  Ver mis pedidos
                </Link>
              </div>
            </Reveal>

            {/* 5 ------------------------------------------------------------ */}
            <Reveal as="section" id="reembolsos" className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
              <TituloSeccion icono={Banknote}>5. Reembolsos y plazos</TituloSeccion>
              <div className="space-y-4 text-sm leading-relaxed text-gray-400">
                <p>
                  Los pedidos se pagan por transferencia (SPEI), así que el reembolso regresa a la misma cuenta
                  que hizo el pago. No cobramos ninguna comisión por procesarlo; el tiempo que tarde en
                  reflejarse depende del banco.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-800 bg-carbon-900/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Envío gratis desde</p>
                    <p className="mt-1 text-xl font-black text-brand-500">{formatPrice(envio.gratisDesde)}</p>
                    <p className="mt-2 text-xs leading-relaxed text-gray-400">
                      Si tu pedido no llegó a ese monto, se te cobraron {formatPrice(envio.costo)} de envío.
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-carbon-900/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Envío que se reembolsa</p>
                    <p className="mt-1 text-xl font-black text-white">{formatPrice(envio.costo)}</p>
                    <p className="mt-2 text-xs leading-relaxed text-gray-400">
                      Se devuelve completo cuando el error fue nuestro.
                    </p>
                  </div>
                </div>
                <p>
                  Si prefieres reposición en lugar de dinero, la enviamos sin costo en cuanto se aprueba el
                  caso, siempre que haya inventario del mismo producto.
                </p>
              </div>
            </Reveal>

            {/* 6 ------------------------------------------------------------ */}
            <Reveal as="section" id="cancelaciones" className="superficie scroll-mt-28 rounded-2xl p-6 sm:p-8">
              <TituloSeccion icono={Clock}>6. Cancelaciones</TituloSeccion>
              <div className="space-y-4 text-sm leading-relaxed text-gray-400">
                <p>
                  Mientras tu pedido siga en <span className="font-bold text-white">Pago Pendiente</span> o{' '}
                  <span className="font-bold text-white">En Proceso</span>, puedes cancelarlo escribiéndonos con
                  el número de pedido. El inventario se libera y, si ya habías transferido, el monto se devuelve
                  completo.
                </p>
                <p>
                  Cuando el pedido cambia a <span className="font-bold text-white">Enviado</span> ya no se puede
                  cancelar: a partir de ahí aplica lo descrito en las secciones anteriores.
                </p>

                <Acordeon titulo="¿Y si nunca transfiero?">
                  <p>
                    El pedido se queda en Pago Pendiente y el apartado se libera. No se genera ningún cargo ni
                    adeudo: sin transferencia no hay compra.
                  </p>
                </Acordeon>
              </div>
            </Reveal>

            {/* 7 ------------------------------------------------------------ */}
            <Reveal as="section" id="preguntas" className="scroll-mt-28">
              <TituloSeccion icono={HelpCircle}>7. Preguntas frecuentes</TituloSeccion>
              <div className="space-y-3">
                {PREGUNTAS.map((item) => (
                  <Acordeon key={item.pregunta} titulo={item.pregunta}>
                    <p>{item.respuesta}</p>
                  </Acordeon>
                ))}
              </div>
            </Reveal>

            <p className="pt-2 text-center text-xs leading-relaxed text-gray-400">
              ¿Falta algo por aclarar? Revisa también los{' '}
              <Link to="/terms" className="font-bold text-brand-500 underline-offset-4 hover:underline">
                términos y condiciones
              </Link>
              . Contenido de ejemplo con fines de demostración.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
