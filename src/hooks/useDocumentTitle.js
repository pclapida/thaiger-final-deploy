import { useEffect } from 'react';

const SUFIJO = 'Thaiger Supplements';

/**
 * Pone el título de la pestaña y la descripción para buscadores.
 *
 * En una SPA el `<title>` se queda congelado en el del index.html: cada página
 * lo actualiza al montarse para que el historial y las pestañas se entiendan.
 */
export default function useDocumentTitle(title, description) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const anterior = document.title;
    document.title = title ? `${title} | ${SUFIJO}` : SUFIJO;

    let metaAnterior;
    const meta = document.querySelector('meta[name="description"]');
    if (description && meta) {
      metaAnterior = meta.getAttribute('content');
      meta.setAttribute('content', description);
    }

    return () => {
      document.title = anterior;
      if (metaAnterior !== undefined && meta) meta.setAttribute('content', metaAnterior);
    };
  }, [title, description]);
}
