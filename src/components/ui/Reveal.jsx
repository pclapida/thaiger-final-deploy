import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { fadeUp, resolveVariants, stepDelay, viewportOnce } from '../../lib/motion';

/**
 * Aparición al entrar en pantalla.
 *
 * Es el envoltorio que usan las secciones para que todo el sitio entre igual.
 * Si el sistema pide reducir el movimiento, se queda en un fundido corto.
 */
export default function Reveal({
  children,
  variants = fadeUp,
  index = 0,
  delay,
  as = 'div',
  className = '',
  ...rest
}) {
  const reduced = useReducedMotion();
  const Componente = motion[as] || motion.div;

  return (
    <Componente
      className={className}
      variants={resolveVariants(variants, reduced)}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={{ delay: reduced ? 0 : (delay ?? stepDelay(index)) }}
      {...rest}
    >
      {children}
    </Componente>
  );
}
