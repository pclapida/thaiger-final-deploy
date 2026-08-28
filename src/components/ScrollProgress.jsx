import React from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';

/**
 * Barra de avance del scroll.
 *
 * Va sobre una pista oscura para que se lea igual esté detrás la franja de
 * aviso naranja o la barra negra. Con movimiento reducido no se pinta: una
 * barra que persigue al dedo es justo lo que esa preferencia pide evitar.
 */
export default function ScrollProgress() {
  const reducido = useReducedMotion();
  const { scrollYProgress } = useScroll();

  // El muelle suaviza el salto de la rueda del ratón sin retrasar el gesto.
  const avance = useSpring(scrollYProgress, { stiffness: 190, damping: 30, restDelta: 0.001 });

  if (reducido) return null;

  return (
    <div
      aria-hidden="true"
      className="no-imprimir pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] bg-carbon-900/80"
    >
      <motion.div
        style={{ scaleX: avance }}
        className="h-full w-full origin-left bg-gradient-to-r from-brand-700 via-brand-500 to-brand-glow"
      />
    </div>
  );
}
