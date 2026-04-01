import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

export default function PageTransition({ children }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      {/* CORTINA NEGRA CON EL FISICOCULTURISTA SUBIENDO */}
      <motion.div
        key={"curtain-" + location.pathname}
        initial={{ y: "100%" }}
        animate={{ y: "100%" }}
        exit={{ y: "-100%" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center pointer-events-none"
      >
        <motion.img 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3 }}
            src="/loader.png" 
            alt="Cargando Músculo" 
            className="w-48 h-48 sm:w-64 sm:h-64 object-contain opacity-80 mix-blend-screen"
        />
        <p className="text-orange-500 uppercase tracking-[0.4em] font-bold mt-8 animate-pulse text-xs sm:text-sm">
            Cargando...
        </p>
      </motion.div>

      {/* RENDERIZADO SUAVE DE LA PÁGINA */}
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
