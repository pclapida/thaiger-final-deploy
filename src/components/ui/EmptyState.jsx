import React from 'react';
import { Link } from 'react-router-dom';
import { PackageOpen } from 'lucide-react';

/**
 * Estado vacío con una salida.
 *
 * Una lista vacía sin nada que hacer se lee como un error; aquí siempre hay
 * una acción que devuelve a la persona al flujo.
 */
export default function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  actionTo,
  onAction,
  as = 'h3',
  className = '',
}) {
  const Icono = icon || PackageOpen;
  // El nivel del título lo decide quien usa el componente: si el estado vacío
  // cuelga directo de un <h1>, tiene que ser un <h2> o la jerarquía se rompe.
  const Titulo = as;

  return (
    <div className={`superficie flex flex-col items-center rounded-xl px-6 py-16 text-center ${className}`}>
      <Icono size={44} className="mb-5 text-gray-600" aria-hidden="true" />
      <Titulo className="titulo-seccion font-bold uppercase tracking-wide text-gray-300">{title}</Titulo>
      {message && <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-400">{message}</p>}

      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="mt-8 rounded-sm bg-brand-600 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
        >
          {actionLabel}
        </Link>
      )}

      {actionLabel && !actionTo && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-8 rounded-sm bg-brand-600 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
