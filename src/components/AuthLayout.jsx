import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { resolveVariants, scaleIn } from '../lib/motion';

/**
 * Marco de las pantallas sueltas de cuenta (recuperar y restablecer
 * contraseña). Es la misma escenografía que el acceso —fondo de marca,
 * tarjeta centrada— pero en una sola columna: aquí no hay nada que contar,
 * sólo un campo que llenar.
 */
export default function AuthLayout({ title, description, children, footer }) {
  const reducido = useReducedMotion();

  return (
    <div className="relative flex min-h-[calc(100dvh-5rem)] items-center justify-center overflow-hidden bg-carbon-950 px-4 py-12">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/images/hero/thaiger-labs.svg')] bg-cover bg-center opacity-25 blur-md"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-carbon-950 via-carbon-950/85 to-carbon-950"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl"
      />

      <motion.div
        variants={resolveVariants(scaleIn, reducido)}
        initial="hidden"
        animate="visible"
        className="superficie relative z-10 w-full max-w-md rounded-2xl p-6 shadow-2xl shadow-black sm:p-10"
      >
        <div className="text-center">
          <Link to="/" className="inline-block">
            <img src="/logo.png" alt="Thaiger Supplements" className="mx-auto h-12 w-auto object-contain" />
          </Link>
          <h1 className="mt-6 text-2xl font-black uppercase italic tracking-tight text-white">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">{description}</p>
        </div>

        <div className="mt-8">{children}</div>

        {footer && <div className="mt-8 border-t border-gray-800 pt-6 text-center">{footer}</div>}
      </motion.div>
    </div>
  );
}
