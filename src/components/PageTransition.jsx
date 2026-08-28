import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { pageTransition, resolveVariants } from '../lib/motion';

/**
 * Transición entre páginas.
 *
 * La versión anterior pintaba una cortina que animaba siempre a `y: 100%`, así
 * que nunca llegaba a verse y sólo dejaba un retraso de 200 ms. Aquí no hay
 * cortina: la página que sale se desvanece hacia arriba y la siguiente entra
 * desde abajo, con `mode="wait"` para que nunca se solapen dos páginas.
 *
 * `initial={false}` evita que la primera carga empiece en opacidad 0.
 */
export default function PageTransition({ children }) {
  const location = useLocation();
  const reducido = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={resolveVariants(pageTransition, reducido)}
        initial="hidden"
        animate="visible"
        exit="exit"
        // Altura mínima: sin ella el pie salta hacia arriba durante el cambio.
        className="min-h-[60vh]"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
