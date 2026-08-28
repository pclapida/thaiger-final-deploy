import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';

/**
 * Coloca la ventana al cambiar de ruta.
 *
 * Reglas:
 * - Si la navegación trae `state.preserveScroll`, no se toca nada (la tienda
 *   lo usa al aplicar filtros: mover la página ahí desorienta).
 * - Con un `#ancla` se baja hasta ese elemento; sólo ese desplazamiento es
 *   suave, y se vuelve instantáneo con movimiento reducido.
 * - En el resto de casos, salto seco arriba: un cambio de página no debe
 *   animarse durante medio segundo mientras el contenido ya cambió.
 */
export default function ScrollToTop() {
  const location = useLocation();
  const reducido = useReducedMotion();

  useEffect(() => {
    if (location.state?.preserveScroll) return;

    if (location.hash) {
      let destino = null;
      // Un hash cualquiera (`#!algo`) no siempre es un selector válido.
      try {
        destino = document.querySelector(location.hash);
      } catch {
        destino = null;
      }

      if (destino) {
        destino.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'start' });
        return;
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location, reducido]);

  return null;
}
