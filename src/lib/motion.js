/**
 * Vocabulario de animación de la tienda.
 *
 * Todas las páginas tiran de estas variantes para que las entradas, los
 * escalonados y las transiciones se sientan iguales en todo el sitio. No
 * importa React: son objetos de configuración para framer-motion.
 *
 * Accesibilidad: `prefersReducedMotion()` y `resolveVariants()` permiten
 * desactivar el movimiento cuando el sistema lo pide, sin duplicar componentes.
 */

/** Curvas reutilizables. La "expo" es la que da el aire premium a las entradas. */
export const EASE = {
  expo: [0.16, 1, 0.3, 1],
  soft: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
};

export const SPRING = {
  suave: { type: 'spring', stiffness: 220, damping: 30 },
  firme: { type: 'spring', stiffness: 380, damping: 32 },
  rebote: { type: 'spring', stiffness: 500, damping: 18 },
};

export const DURATION = {
  rapida: 0.25,
  media: 0.45,
  lenta: 0.7,
};

/** ¿El sistema pide reducir el movimiento? */
export function prefersReducedMotion() {
  try {
    return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}

/** Variantes sin desplazamiento, para cuando se reduce el movimiento. */
export const sinMovimiento = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

/** Devuelve las variantes pedidas, o las planas si hay que reducir movimiento. */
export function resolveVariants(variants, reduced) {
  return reduced ? sinMovimiento : variants;
}

// ------------------------------------------------------------------ entradas

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.media, ease: EASE.expo } },
  exit: { opacity: 0, y: -12, transition: { duration: DURATION.rapida, ease: EASE.inOut } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.media, ease: EASE.soft } },
  exit: { opacity: 0, transition: { duration: DURATION.rapida } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: { duration: DURATION.media, ease: EASE.expo } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: DURATION.rapida } },
};

export const slideFromLeft = {
  hidden: { opacity: 0, x: -36 },
  visible: { opacity: 1, x: 0, transition: { duration: DURATION.media, ease: EASE.expo } },
  exit: { opacity: 0, x: -20, transition: { duration: DURATION.rapida } },
};

export const slideFromRight = {
  hidden: { opacity: 0, x: 36 },
  visible: { opacity: 1, x: 0, transition: { duration: DURATION.media, ease: EASE.expo } },
  exit: { opacity: 0, x: 20, transition: { duration: DURATION.rapida } },
};

// --------------------------------------------------------------- escalonados

/** Contenedor que escalona la entrada de sus hijos. */
export function staggerContainer(stagger = 0.07, delay = 0) {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: stagger, delayChildren: delay },
    },
    exit: { opacity: 0 },
  };
}

/** Hijo típico de un contenedor escalonado. */
export const staggerItem = fadeUp;

// ------------------------------------------------------------- interacciones

export const hoverLift = {
  rest: { y: 0, scale: 1 },
  hover: { y: -6, scale: 1.02, transition: SPRING.suave },
  tap: { scale: 0.98, transition: SPRING.firme },
};

export const hoverGlow = {
  rest: { boxShadow: '0 0 0 rgba(234, 88, 12, 0)' },
  hover: { boxShadow: '0 18px 45px -18px rgba(234, 88, 12, 0.65)', transition: { duration: DURATION.rapida } },
};

/** Transición entre páginas (la usa App.jsx con AnimatePresence). */
export const pageTransition = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE.expo } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: EASE.inOut } },
};

/** Panel deslizante (menú móvil, cajón de filtros, modales laterales). */
export const drawer = {
  hidden: { x: '-100%' },
  visible: { x: 0, transition: { duration: DURATION.media, ease: EASE.expo } },
  exit: { x: '-100%', transition: { duration: DURATION.rapida, ease: EASE.inOut } },
};

export const drawerRight = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: { duration: DURATION.media, ease: EASE.expo } },
  exit: { x: '100%', transition: { duration: DURATION.rapida, ease: EASE.inOut } },
};

export const backdrop = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.rapida } },
  exit: { opacity: 0, transition: { duration: DURATION.rapida } },
};

export const modal = {
  hidden: { opacity: 0, scale: 0.96, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: DURATION.media, ease: EASE.expo } },
  exit: { opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.18, ease: EASE.inOut } },
};

// --------------------------------------------------------------------- utils

/** Retraso escalonado acotado: en una rejilla larga nadie espera 3 segundos. */
export function stepDelay(index, step = 0.06, max = 0.42) {
  return Math.min(Number(index) || 0, Math.round(max / step)) * step;
}

/** Ajustes de `whileInView` que usan todas las secciones. */
export const viewportOnce = { once: true, amount: 0.2 };
