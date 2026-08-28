import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { DURATION, EASE, fadeUp, resolveVariants } from '../lib/motion';

/**
 * Carrusel de la página de inicio.
 *
 * El carrusel anterior avanzaba solo, sin controles y sin forma de detenerlo:
 * si estabas leyendo un slide, se te iba. Aquí el mando lo tiene la persona:
 *
 *  - Flechas y puntos SIEMPRE visibles (nada de aparecer sólo al pasar el ratón,
 *    que en un móvil no ocurre nunca) y botón de pausa explícito.
 *  - El avance automático se congela al pasar el ratón, al enfocar con teclado,
 *    mientras se arrastra y cuando la pestaña deja de estar visible.
 *  - Cualquier navegación manual reinicia el tiempo del slide.
 *  - La barra inferior muestra cuánto falta para el cambio; en pausa se detiene
 *    en el punto exacto en el que estaba y luego continúa desde ahí.
 *
 * El progreso se pinta mutando el `transform` de la barra dentro de un
 * `requestAnimationFrame`: si viviera en el estado, el carrusel se volvería a
 * renderizar sesenta veces por segundo para animar una sola barra.
 */

/** Umbral de arrastre (px) a partir del cual el gesto cuenta como cambio de slide. */
const UMBRAL_ARRASTRE = 70;
const VELOCIDAD_ARRASTRE = 450;

/** Entrada/salida del slide: entra por el lado hacia el que se está navegando. */
const variantesSlide = {
  hidden: (direccion) => ({ opacity: 0, x: direccion >= 0 ? 90 : -90 }),
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: DURATION.lenta,
      ease: EASE.expo,
      staggerChildren: 0.08,
      delayChildren: 0.12,
    },
  },
  exit: (direccion) => ({
    opacity: 0,
    x: direccion >= 0 ? -70 : 70,
    transition: { duration: DURATION.rapida, ease: EASE.inOut },
  }),
};

const claseBotonRedondo =
  'inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white backdrop-blur-sm transition-colors hover:border-brand-500 hover:bg-brand-600 active:scale-95';

export default function HeroCarousel({ slides = [], intervalMs = 6000 }) {
  const reduced = useReducedMotion();

  // Sólo los slides publicados. El panel puede apagar uno sin borrarlo.
  const activos = useMemo(
    () => (Array.isArray(slides) ? slides.filter((slide) => slide && slide.active !== false) : []),
    [slides]
  );
  const total = activos.length;
  const duracion = Math.max(1500, Number(intervalMs) || 6000);

  const [indice, setIndice] = useState(0);
  const [direccion, setDireccion] = useState(1);
  const [pausaManual, setPausaManual] = useState(false);
  const [hover, setHover] = useState(false);
  const [foco, setFoco] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [pestanaVisible, setPestanaVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );
  const [imagenesFallidas, setImagenesFallidas] = useState(() => ({}));

  // Espejo del número de slides: si el panel elimina uno, el índice se ajusta
  // durante el render (no en un efecto, que es lo que prohíbe ESLint).
  const [totalEspejo, setTotalEspejo] = useState(total);
  if (totalEspejo !== total) {
    setTotalEspejo(total);
    if (indice > total - 1) setIndice(0);
  }

  const progresoRef = useRef(0);
  const barraRef = useRef(null);

  const reiniciarProgreso = useCallback(() => {
    progresoRef.current = 0;
    if (barraRef.current) barraRef.current.style.transform = 'scaleX(0)';
  }, []);

  /** Salta a un slide concreto (puntos indicadores). */
  const irA = useCallback(
    (destino) => {
      if (destino === indice) return;
      setDireccion(destino > indice ? 1 : -1);
      setIndice(destino);
      reiniciarProgreso();
    },
    [indice, reiniciarProgreso]
  );

  /** Avanza (+1) o retrocede (-1) de forma circular. */
  const mover = useCallback(
    (delta) => {
      if (total < 2) return;
      setDireccion(delta >= 0 ? 1 : -1);
      setIndice((actual) => (actual + delta + total) % total);
      reiniciarProgreso();
    },
    [total, reiniciarProgreso]
  );

  const enPausa = pausaManual || hover || foco || arrastrando || !pestanaVisible;

  // La pestaña en segundo plano no debe consumir slides que nadie está viendo.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const alCambiar = () => setPestanaVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, []);

  // Avance automático + barra de progreso, en un solo bucle.
  useEffect(() => {
    if (reduced || enPausa || total < 2) return undefined;

    const base = progresoRef.current;
    const inicio = performance.now();
    let peticion = 0;

    const paso = (ahora) => {
      const avance = base + (ahora - inicio) / duracion;
      progresoRef.current = Math.min(1, avance);
      if (barraRef.current) barraRef.current.style.transform = `scaleX(${progresoRef.current})`;

      if (avance >= 1) {
        mover(1);
        return;
      }
      peticion = requestAnimationFrame(paso);
    };

    peticion = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(peticion);
  }, [reduced, enPausa, total, duracion, indice, mover]);

  // Precarga del siguiente fondo: sin esto el cambio parpadea en blanco.
  useEffect(() => {
    if (total < 2) return;
    const siguiente = activos[(indice + 1) % total];
    if (!siguiente?.image) return;
    const imagen = new Image();
    imagen.src = siguiente.image;
  }, [indice, total, activos]);

  const alPulsarTecla = (evento) => {
    if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      mover(1);
    } else if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      mover(-1);
    }
  };

  const alTerminarArrastre = (_evento, info) => {
    setArrastrando(false);
    const desplazamiento = info?.offset?.x ?? 0;
    const velocidad = info?.velocity?.x ?? 0;
    if (desplazamiento < -UMBRAL_ARRASTRE || velocidad < -VELOCIDAD_ARRASTRE) mover(1);
    else if (desplazamiento > UMBRAL_ARRASTRE || velocidad > VELOCIDAD_ARRASTRE) mover(-1);
  };

  const variantesActivas = resolveVariants(variantesSlide, reduced);
  const variantesTexto = resolveVariants(fadeUp, reduced);

  // Sin slides configurados la portada no se rompe: se saluda y se ofrece salida.
  if (total === 0) {
    return (
      <section
        aria-label="Bienvenida"
        className="relative flex min-h-[420px] w-full flex-col items-center justify-center overflow-hidden bg-carbon-900 px-5 py-16 text-center md:h-[560px]"
      >
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-500">
          Distribuidores Oficiales Thaiger
        </p>
        <h1 className="titulo-pagina mt-4 max-w-3xl font-black uppercase italic leading-none">
          Suplementación de alto rendimiento
        </h1>
        <p className="mt-4 max-w-xl text-gray-400">
          Proteínas, creatinas, pre-entrenos y accesorios con envío a toda la República.
        </p>
        <Link
          to="/shop"
          className="mt-8 inline-flex min-h-[44px] items-center gap-2 rounded-sm bg-brand-600 px-8 py-3 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
        >
          Ver catálogo <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const slide = activos[Math.min(indice, total - 1)];
  const claveSlide = slide.id ?? indice;
  const mostrarImagen = Boolean(slide.image) && !imagenesFallidas[claveSlide];

  return (
    <section
      tabIndex={0}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Marcas destacadas"
      onKeyDown={alPulsarTecla}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFoco(true)}
      onBlur={() => setFoco(false)}
      className="relative isolate w-full min-h-[420px] overflow-hidden bg-carbon-950 md:h-[560px] xl:h-[640px]"
    >
      <AnimatePresence mode="wait" custom={direccion}>
        <motion.div
          key={claveSlide}
          custom={direccion}
          variants={variantesActivas}
          initial="hidden"
          animate="visible"
          exit="exit"
          drag={total > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.16}
          dragMomentum={false}
          onDragStart={() => setArrastrando(true)}
          onDragEnd={alTerminarArrastre}
          className="absolute inset-0 flex touch-pan-y"
        >
          {/* Fondo: la imagen es decorativa, el texto del slide ya la describe. */}
          <div className="absolute inset-0 -z-10 bg-carbon-900">
            {mostrarImagen && (
              <img
                src={slide.image}
                alt=""
                aria-hidden="true"
                draggable={false}
                loading={indice === 0 ? 'eager' : 'lazy'}
                fetchPriority={indice === 0 ? 'high' : 'auto'}
                onError={() => setImagenesFallidas((previas) => ({ ...previas, [claveSlide]: true }))}
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/50" />
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col justify-center px-5 pb-32 pt-12 sm:px-8 md:pb-24 lg:px-12">
            {slide.caption && (
              <motion.p
                variants={variantesTexto}
                className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-500 sm:text-xs"
              >
                {slide.caption}
              </motion.p>
            )}

            <motion.h1
              variants={variantesTexto}
              className="titulo-pagina mt-3 max-w-3xl font-black uppercase italic leading-none text-white"
            >
              {slide.title}
            </motion.h1>

            {slide.subtitle && (
              <motion.p
                variants={variantesTexto}
                className="mt-4 max-w-xl text-base text-gray-300 sm:text-lg md:text-xl"
              >
                {slide.subtitle}
              </motion.p>
            )}

            <motion.div variants={variantesTexto} className="mt-8">
              <Link
                to="/shop"
                state={{ brand: slide.brand }}
                draggable={false}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-sm bg-brand-600 px-7 py-3 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700 sm:px-9 sm:text-base"
              >
                {slide.cta || 'Ver productos'}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Estado para lectores de pantalla: sólo se anuncia si el avance está detenido. */}
      <p className="sr-only" aria-live={enPausa ? 'polite' : 'off'}>
        {`Slide ${indice + 1} de ${total}: ${slide.title || ''}`}
      </p>

      {total > 1 && (
        <>
          {/* En móvil las flechas viven abajo, al alcance del pulgar; en escritorio, a los lados. */}
          <button
            type="button"
            onClick={() => mover(-1)}
            aria-label="Slide anterior"
            className={`${claseBotonRedondo} absolute bottom-4 left-4 z-30 md:bottom-auto md:left-6 md:top-1/2 md:-translate-y-1/2`}
          >
            <ChevronLeft size={24} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => mover(1)}
            aria-label="Slide siguiente"
            className={`${claseBotonRedondo} absolute bottom-4 right-4 z-30 md:bottom-auto md:right-6 md:top-1/2 md:-translate-y-1/2`}
          >
            <ChevronRight size={24} aria-hidden="true" />
          </button>

          {/*
            Los puntos van en su propia banda, por encima de las flechas: antes
            compartían franja con ellas (flechas a 16px de altura y 48px de alto,
            puntos a 20px) y en un móvil de 320px los primeros puntos caían sobre
            la flecha izquierda, que además ganaba el toque por su z-index.
            Con `flex-wrap` un catálogo de seis o más slides crece hacia arriba,
            que es hacia donde hay sitio, en vez de desbordar a lo ancho.
          */}
          <div className="absolute inset-x-0 bottom-20 z-20 flex flex-wrap items-center justify-center gap-1 px-4 md:bottom-8">
            {activos.map((entrada, posicion) => (
              <button
                key={entrada.id ?? posicion}
                type="button"
                onClick={() => irA(posicion)}
                aria-label={`Ir al slide ${posicion + 1}`}
                aria-current={posicion === indice ? 'true' : undefined}
                className="flex h-11 w-9 items-center justify-center"
              >
                <span
                  aria-hidden="true"
                  className={`block h-1.5 rounded-full transition-all duration-300 ${
                    posicion === indice ? 'w-8 bg-brand-500' : 'w-5 bg-white/35 hover:bg-white/60'
                  }`}
                />
              </button>
            ))}

            {!reduced && (
              <button
                type="button"
                onClick={() => setPausaManual((previo) => !previo)}
                aria-label={pausaManual ? 'Reproducir carrusel' : 'Pausar carrusel'}
                aria-pressed={pausaManual}
                className="ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white backdrop-blur-sm transition-colors hover:border-brand-500 hover:bg-brand-600"
              >
                {pausaManual ? (
                  <Play size={16} aria-hidden="true" />
                ) : (
                  <Pause size={16} aria-hidden="true" />
                )}
              </button>
            )}
          </div>

          {!reduced && (
            <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/10">
              <div
                ref={barraRef}
                aria-hidden="true"
                style={{ transform: 'scaleX(0)' }}
                className="h-full origin-left bg-brand-500"
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
