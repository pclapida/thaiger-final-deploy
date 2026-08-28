import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Images, Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { products as productosApi } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import { isSafeImageUrl } from '../../lib/security';
import ConfirmDialog from '../ui/ConfirmDialog';
import { Skeleton } from '../ui/Skeleton';
import { TextField, inputClasses } from '../ui/Field';

const BOTON_SECUNDARIO =
  'flex min-h-[44px] items-center justify-center gap-2 rounded-sm border border-gray-800 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-40';

const BOTON_MARCA =
  'flex min-h-[44px] items-center justify-center gap-2 rounded-sm bg-brand-600 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:opacity-40';

/**
 * Accion de un slide (solo icono). El icono mide 15px, asi que sin una medida
 * explicita el boton se queda en 32x32: por debajo del minimo tactil de 44.
 * La misma constante existe en los demas paneles con listas.
 */
const BOTON_ICONO = 'grid h-11 w-11 shrink-0 place-items-center rounded transition-colors';

/** Slide nuevo con valores razonables para que la vista previa no salga vacía. */
function slideEnBlanco(marca) {
  return {
    id: `hero-${Math.random().toString(16).slice(2, 8)}`,
    title: marca || 'NUEVA MARCA',
    subtitle: 'Describe la promesa de esta marca',
    caption: 'Texto pequeño de arriba',
    cta: 'Ver productos',
    brand: marca || '',
    image: '/images/hero/thaiger-labs.svg',
    color: '#ea580c',
    active: true,
  };
}

/**
 * Editor del carrusel.
 *
 * Se monta cuando la configuración ya está cargada, de modo que el estado del
 * formulario arranca con los valores reales y no con los de fábrica.
 */
function EditorCarrusel({ heroInicial, marcas, onGuardar }) {
  const [slides, setSlides] = useState(() => heroInicial.map((slide) => ({ ...slide })));
  const [referencia, setReferencia] = useState(() => JSON.stringify(heroInicial));
  const [seleccionado, setSeleccionado] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

  const indice = Math.min(seleccionado, Math.max(0, slides.length - 1));
  const actual = slides[indice] || null;
  const haCambiado = JSON.stringify(slides) !== referencia;

  const cambiarCampo = (campo, valor) => {
    setSlides((previos) => previos.map((slide, i) => (i === indice ? { ...slide, [campo]: valor } : slide)));
  };

  const mover = (desde, hacia) => {
    if (hacia < 0 || hacia >= slides.length) return;
    setSlides((previos) => {
      const copia = [...previos];
      const [movido] = copia.splice(desde, 1);
      copia.splice(hacia, 0, movido);
      return copia;
    });
    setSeleccionado(hacia);
  };

  const alternarActivo = (posicion) => {
    setSlides((previos) => previos.map((slide, i) => (i === posicion ? { ...slide, active: !slide.active } : slide)));
  };

  const anadir = () => {
    setSlides((previos) => [...previos, slideEnBlanco(marcas[0])]);
    setSeleccionado(slides.length);
  };

  const borrar = () => {
    if (aBorrar === null) return;
    setSlides((previos) => previos.filter((slide, i) => i !== aBorrar));
    setSeleccionado(0);
    setABorrar(null);
  };

  const subirImagen = async (archivo) => {
    if (!archivo) return;

    setSubiendo(true);
    const aviso = toast.loading('Procesando imagen...');
    try {
      const url = await productosApi.uploadImage(archivo);
      cambiarCampo('image', url);
      toast.success('Imagen lista', { id: aviso });
    } catch (fallo) {
      toast.error(fallo.message || 'No se pudo procesar la imagen', { id: aviso });
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    if (slides.length === 0) {
      toast.error('Deja al menos un slide en el carrusel.');
      return;
    }

    setGuardando(true);
    try {
      const limpios = slides.map((slide) => ({
        ...slide,
        image: isSafeImageUrl(slide.image) ? slide.image : '',
      }));
      await onGuardar({ hero: limpios });
      setSlides(limpios);
      setReferencia(JSON.stringify(limpios));
      toast.success('Carrusel actualizado');
    } catch (fallo) {
      toast.error(`No se pudo guardar: ${fallo.message}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="titulo-seccion font-extrabold uppercase tracking-widest text-brand-500">
            Carrusel de Inicio
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {slides.filter((slide) => slide.active).length} de {slides.length} slides activos. El orden es el que
            se ve en la portada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {haCambiado && (
            <span className="rounded-sm border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-amber-400">
              Cambios sin guardar
            </span>
          )}
          <button type="button" onClick={anadir} className={BOTON_SECUNDARIO}>
            <Plus size={16} aria-hidden="true" /> Añadir slide
          </button>
          <button type="button" onClick={guardar} disabled={guardando || !haCambiado} className={BOTON_MARCA}>
            <Save size={16} aria-hidden="true" /> {guardando ? 'Guardando...' : 'Guardar carrusel'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* --------------------------------------------------------- lista -- */}
        <section className="superficie space-y-2 rounded-xl p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">Slides</h2>

          <ul className="space-y-2">
            {slides.map((slide, posicion) => (
              <li
                key={slide.id}
                className={`rounded-sm border p-3 transition-colors ${
                  posicion === indice ? 'border-brand-500 bg-brand-600/10' : 'border-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSeleccionado(posicion)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-bold text-white">
                      {slide.title || 'Sin título'}
                    </span>
                    <span className="block truncate text-[11px] text-gray-400">
                      {slide.brand || 'sin marca'} · {slide.active ? 'activo' : 'oculto'}
                    </span>
                  </button>

                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => mover(posicion, posicion - 1)}
                      disabled={posicion === 0}
                      aria-label={`Subir el slide ${slide.title}`}
                      className={`${BOTON_ICONO} text-gray-400 hover:text-white disabled:opacity-30`}
                    >
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(posicion, posicion + 1)}
                      disabled={posicion === slides.length - 1}
                      aria-label={`Bajar el slide ${slide.title}`}
                      className={`${BOTON_ICONO} text-gray-400 hover:text-white disabled:opacity-30`}
                    >
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => alternarActivo(posicion)}
                      aria-label={slide.active ? `Ocultar el slide ${slide.title}` : `Mostrar el slide ${slide.title}`}
                      className={`${BOTON_ICONO} ${slide.active ? 'text-brand-500' : 'text-gray-400'}`}
                    >
                      {slide.active ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setABorrar(posicion)}
                      aria-label={`Eliminar el slide ${slide.title}`}
                      className={`${BOTON_ICONO} text-red-500 hover:text-red-400`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {slides.length === 0 && (
            <p className="py-6 text-center text-xs uppercase tracking-widest text-gray-400">
              El carrusel está vacío
            </p>
          )}
        </section>

        {/* ------------------------------------------------------- edición -- */}
        {actual && (
          <section className="superficie space-y-5 rounded-xl p-4 xl:col-span-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Slide {indice + 1} de {slides.length}
            </h2>

            {/* Vista previa en vivo */}
            <div
              className="relative flex h-56 items-end overflow-hidden rounded-xl border border-gray-800 bg-carbon-950 sm:h-64"
              aria-label="Vista previa del slide"
            >
              {actual.image && (
                <img
                  src={actual.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-70"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />

              <div className="relative w-full p-6">
                <p
                  className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em]"
                  style={{ color: actual.color || '#ea580c' }}
                >
                  {actual.caption}
                </p>
                <p className="text-3xl font-black uppercase leading-none tracking-tight text-white sm:text-4xl">
                  {actual.title}
                </p>
                <p className="mt-2 max-w-md text-sm text-gray-300">{actual.subtitle}</p>
                <span
                  className="mt-4 inline-block rounded-sm px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-white"
                  style={{ backgroundColor: actual.color || '#ea580c' }}
                >
                  {actual.cta || 'Ver productos'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Título"
                value={actual.title || ''}
                onChange={(evento) => cambiarCampo('title', evento.target.value)}
              />
              <TextField
                label="Subtítulo"
                value={actual.subtitle || ''}
                onChange={(evento) => cambiarCampo('subtitle', evento.target.value)}
              />
              <TextField
                label="Texto pequeño"
                value={actual.caption || ''}
                onChange={(evento) => cambiarCampo('caption', evento.target.value)}
              />
              <TextField
                label="Texto del botón"
                value={actual.cta || ''}
                onChange={(evento) => cambiarCampo('cta', evento.target.value)}
              />

              <div className="space-y-2">
                <label
                  htmlFor="slide-marca"
                  className="block text-xs font-bold uppercase tracking-wider text-gray-400"
                >
                  Marca a la que enlaza
                </label>
                <select
                  id="slide-marca"
                  value={actual.brand || ''}
                  onChange={(evento) => cambiarCampo('brand', evento.target.value)}
                  className={inputClasses({ extra: 'min-h-[44px]' })}
                >
                  <option value="">Sin marca (lleva a la tienda)</option>
                  {marcas.map((marca) => (
                    <option key={marca} value={marca}>
                      {marca}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="slide-color"
                  className="block text-xs font-bold uppercase tracking-wider text-gray-400"
                >
                  Color del acento
                </label>
                <div className="flex gap-2">
                  <input
                    id="slide-color"
                    type="color"
                    value={actual.color || '#ea580c'}
                    onChange={(evento) => cambiarCampo('color', evento.target.value)}
                    className="h-11 w-14 shrink-0 cursor-pointer rounded-sm border border-gray-700 bg-carbon-900"
                  />
                  <input
                    type="text"
                    aria-label="Código del color"
                    value={actual.color || ''}
                    onChange={(evento) => cambiarCampo('color', evento.target.value)}
                    className={inputClasses({ extra: 'min-h-[44px] font-mono' })}
                  />
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label
                  htmlFor="slide-imagen"
                  className="block text-xs font-bold uppercase tracking-wider text-gray-400"
                >
                  Imagen de fondo
                </label>
                <input
                  id="slide-imagen"
                  type="file"
                  accept="image/*"
                  disabled={subiendo}
                  onChange={(evento) => {
                    subirImagen(evento.target.files?.[0]);
                    evento.target.value = '';
                  }}
                  className="w-full rounded-sm border border-gray-700 bg-carbon-900 p-3 text-sm text-gray-400 file:mr-4 file:rounded file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-brand-700 disabled:opacity-50"
                />
                <input
                  type="url"
                  aria-label="Dirección de la imagen de fondo"
                  value={String(actual.image || '').startsWith('data:') ? '' : actual.image || ''}
                  onChange={(evento) => cambiarCampo('image', evento.target.value)}
                  placeholder="/images/hero/thaiger-labs.svg"
                  className={inputClasses()}
                />
                {actual.image && !isSafeImageUrl(actual.image) && (
                  <p role="alert" className="text-[11px] font-bold text-red-500">
                    Esa dirección no es válida: usa una ruta del sitio o una URL http(s).
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={aBorrar !== null}
        title="Eliminar slide"
        message={`Se quitará «${slides[aBorrar]?.title || ''}» del carrusel. Recuerda guardar para que el cambio se publique.`}
        confirmLabel="Sí, eliminar"
        tone="danger"
        onConfirm={borrar}
        onCancel={() => setABorrar(null)}
      />
    </div>
  );
}

/** Envoltorio: espera a que la configuración esté cargada antes de editarla. */
export default function PanelCarrusel({ marcas = [] }) {
  const { settings, loading, save } = useSettings();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <EditorCarrusel heroInicial={settings.hero || []} marcas={marcas} onGuardar={save} />;
}
