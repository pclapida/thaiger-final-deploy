import React, { useState } from 'react';
import { ChevronDown, ImagePlus, Loader2, RefreshCw, Star } from 'lucide-react';

/** Cuántas fotos se pintan de entrada; el resto, con «Ver más». */
const POR_TANDA = 24;

function fechaCorta(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime())
    ? ''
    : fecha.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Las fotos que ya se subieron a la tienda, para reutilizarlas sin volver a
 * subirlas. Sirve también para regresar una foto original: al pasar las fotos
 * a fondo negro los archivos originales se conservan, y aquí se ven (con su
 * fondo blanco) para elegirlos de nuevo.
 *
 * Plegado por defecto: la lista sólo se pide al abrirlo.
 */
export default function SelectorFotosSubidas({
  onListar,
  enUso = [],
  puedeAgregarExtra = true,
  onUsarPrincipal,
  onAgregarExtra,
}) {
  const [abierto, setAbierto] = useState(false);
  const [fotos, setFotos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [visibles, setVisibles] = useState(POR_TANDA);

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      setFotos(await onListar());
      setVisibles(POR_TANDA);
    } catch (fallo) {
      setError(fallo.message || 'No se pudieron leer las fotos.');
    } finally {
      setCargando(false);
    }
  };

  const alternar = () => {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (siguiente && fotos === null && !cargando) cargar();
  };

  const usadas = new Set(enUso.filter(Boolean));

  return (
    <div className="rounded-lg border border-gray-800 bg-black/40">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-300"
      >
        Elegir de fotos ya subidas
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-brand-500 transition-transform ${abierto ? 'rotate-180' : ''}`}
        />
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-gray-800 p-4">
          <p className="text-[11px] leading-relaxed text-gray-400">
            Todas las fotos guardadas en la tienda, de la más reciente a la más antigua. Aquí también están las
            originales con fondo blanco, por si quieres regresar alguna.
          </p>

          {cargando && (
            <p role="status" className="flex items-center gap-2 text-xs font-bold text-brand-500">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Cargando fotos...
            </p>
          )}

          {error && (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-xs text-red-300">
              {error}
              <button
                type="button"
                onClick={cargar}
                className="inline-flex min-h-[44px] items-center gap-1 font-bold uppercase text-gray-300 hover:text-white"
              >
                <RefreshCw size={13} aria-hidden="true" /> Reintentar
              </button>
            </div>
          )}

          {fotos && fotos.length === 0 && <p className="text-xs text-gray-400">Todavía no hay fotos subidas.</p>}

          {fotos && fotos.length > 0 && (
            <>
              <ul className="grid grid-cols-3 gap-3">
                {fotos.slice(0, visibles).map((foto, indice) => {
                  const enEste = usadas.has(foto.url);
                  const descripcion = foto.fecha ? `subida el ${fechaCorta(foto.fecha)}` : `número ${indice + 1}`;
                  return (
                    <li key={foto.url} className="overflow-hidden rounded-lg border border-gray-800">
                      {/* Fondo gris: así se distingue una original con fondo blanco de una ya en negro. */}
                      <div className="relative bg-carbon-600">
                        <img src={foto.url} alt="" loading="lazy" className="aspect-square w-full object-contain" />
                        {enEste && (
                          <span className="absolute left-1 top-1 rounded-sm bg-brand-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                            En uso
                          </span>
                        )}
                      </div>
                      {foto.fecha && (
                        <p className="truncate px-1.5 pt-1 text-[10px] text-gray-400">{fechaCorta(foto.fecha)}</p>
                      )}
                      <div className="flex justify-between">
                        <button
                          type="button"
                          disabled={enEste}
                          onClick={() => onUsarPrincipal(foto.url)}
                          aria-label={`Usar como principal la foto ${descripcion}`}
                          title="Usar como principal"
                          className="grid h-11 w-11 place-items-center text-gray-400 transition-colors hover:text-brand-500 disabled:opacity-30"
                        >
                          <Star size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={enEste || !puedeAgregarExtra}
                          onClick={() => onAgregarExtra(foto.url)}
                          aria-label={`Agregar a más fotos la foto ${descripcion}`}
                          title="Agregar a más fotos"
                          className="grid h-11 w-11 place-items-center text-gray-400 transition-colors hover:text-brand-500 disabled:opacity-30"
                        >
                          <ImagePlus size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {fotos.length > visibles && (
                <button
                  type="button"
                  onClick={() => setVisibles((n) => n + POR_TANDA)}
                  className="min-h-[44px] w-full rounded-sm border border-gray-800 text-xs font-bold uppercase tracking-widest text-gray-400 hover:border-gray-600 hover:text-white"
                >
                  Ver más ({fotos.length - visibles})
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
