import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Número que sube hasta su valor.
 *
 * Lo usan las tarjetas de métricas del panel. El texto final siempre es el
 * valor real: si se reduce el movimiento —o si algo falla— se pinta de golpe,
 * nunca se queda a medias.
 */
export default function AnimatedNumber({ value, format = (n) => n, duration = 900, className = '' }) {
  const objetivo = Number(value);
  const final = Number.isFinite(objetivo) ? objetivo : 0;

  const reduced = useReducedMotion();
  const [animado, setAnimado] = useState(0);
  const frameRef = useRef(0);

  // Con movimiento reducido el valor se resuelve DURANTE EL RENDER: meterlo en
  // el efecto sería un setState síncrono dentro de useEffect, que es justo el
  // patrón que la convención del proyecto prohíbe (y que ESLint no detecta
  // cuando el efecto lleva array de dependencias).
  const mostrado = reduced ? final : animado;

  useEffect(() => {
    if (reduced) return undefined;

    const inicio = performance.now();
    const desde = 0;

    const paso = (ahora) => {
      const avance = Math.min(1, (ahora - inicio) / duration);
      // Curva de salida: arranca rápido y frena al llegar.
      const suavizado = 1 - (1 - avance) ** 3;
      setAnimado(desde + (final - desde) * suavizado);

      if (avance < 1) frameRef.current = requestAnimationFrame(paso);
      else setAnimado(final);
    };

    frameRef.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frameRef.current);
  }, [final, duration, reduced]);

  return <span className={className}>{format(mostrado)}</span>;
}
