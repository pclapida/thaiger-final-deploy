import React, { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { backdrop as backdropVariants, modal as modalVariants, resolveVariants } from '../../lib/motion';

const FOCUSABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Ventana modal accesible.
 *
 * Se encarga de lo que casi siempre se olvida: cerrar con Escape, devolver el
 * foco al elemento que la abrió, no dejar que el tabulador se escape al fondo y
 * bloquear el desplazamiento de la página mientras está abierta.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'lg',
  closeOnBackdrop = true,
}) {
  const panelRef = useRef(null);
  const previoRef = useRef(null);
  const reduced = useReducedMotion();

  const anchos = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  };

  const cerrar = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Foco: se guarda quién abrió el modal y se le devuelve al cerrar.
  useEffect(() => {
    if (!open) return undefined;

    previoRef.current = document.activeElement;
    const panel = panelRef.current;
    const primero = panel?.querySelector(FOCUSABLES);
    (primero || panel)?.focus?.();

    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = anterior;
      previoRef.current?.focus?.();
    };
  }, [open]);

  // Escape cierra; Tab no sale del panel.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        cerrar();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusables = panelRef.current?.querySelectorAll(FOCUSABLES);
      if (!focusables || focusables.length === 0) return;

      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, cerrar]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/85 p-4 pt-20 backdrop-blur-sm sm:pt-24"
          variants={resolveVariants(backdropVariants, reduced)}
          initial="hidden"
          animate="visible"
          exit="exit"
          onMouseDown={(event) => {
            if (closeOnBackdrop && event.target === event.currentTarget) cerrar();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            tabIndex={-1}
            variants={resolveVariants(modalVariants, reduced)}
            className={`superficie relative mb-10 w-full ${anchos[size] || anchos.lg} rounded-xl shadow-2xl shadow-black outline-none`}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-800 p-6">
              <div>
                <h2 className="text-xl font-extrabold uppercase tracking-wide text-white sm:text-2xl">{title}</h2>
                {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
              </div>
              {/* 44px: en móvil es el único cierre visible sin desplazarse,
                  porque el pie del modal queda al final del scroll. */}
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-sm text-gray-400 transition-colors hover:text-white"
              >
                <X size={22} aria-hidden="true" />
              </button>
            </div>

            <div className="p-6">{children}</div>

            {footer && <div className="border-t border-gray-800 p-6 pt-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
