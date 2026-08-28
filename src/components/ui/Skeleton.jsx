import React from 'react';

/**
 * Bloques de carga con la forma del contenido que va a llegar.
 * Se prefieren a un texto de "Cargando...": no mueven la página al aparecer
 * los datos y se leen como una tienda que está trabajando, no como un error.
 */
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`esqueleto rounded-md ${className}`} />;
}

/** Silueta de una tarjeta de producto. */
export function SkeletonCard() {
  return (
    <div className="superficie rounded-xl p-4">
      <Skeleton className="h-56 w-full rounded-lg" />
      <div className="mt-4 space-y-2">
        <Skeleton className="mx-auto h-3 w-20" />
        <Skeleton className="mx-auto h-4 w-32" />
        <Skeleton className="mx-auto h-3 w-40" />
        <Skeleton className="mx-auto mt-3 h-7 w-24" />
      </div>
    </div>
  );
}

/** Rejilla de tarjetas para la tienda, el inicio y las ofertas. */
export function SkeletonGrid({ count = 8, className = '' }) {
  return (
    <div
      role="status"
      aria-label="Cargando productos"
      className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${className}`}
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Filas para las tablas del panel. */
export function SkeletonRows({ rows = 6, columns = 5 }) {
  return (
    <div role="status" aria-label="Cargando datos" className="space-y-2 p-4">
      {Array.from({ length: rows }, (_, fila) => (
        <div key={fila} className="flex gap-3">
          {Array.from({ length: columns }, (_, columna) => (
            <Skeleton key={columna} className={`h-10 ${columna === 0 ? 'w-14' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
