import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Database, Download, HardDrive, RotateCcw, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { maintenance, users as usuariosApi, BACKEND_MODE, IS_LOCAL_MODE } from '../../services/api';
import { estimateDataUrlBytes, formatBytes } from '../../lib/image';
import ConfirmDialog from '../ui/ConfirmDialog';

const BOTON_SECUNDARIO =
  'flex min-h-[44px] items-center justify-center gap-2 rounded-sm border border-gray-800 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-40';

const BOTON_MARCA =
  'flex min-h-[44px] items-center justify-center gap-2 rounded-sm bg-brand-600 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:opacity-40';

/** Fuerza la descarga de un JSON sin pasar por ningún servidor. */
function descargarJson(nombre, contenido) {
  const blob = new Blob([JSON.stringify(contenido, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');

  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/**
 * Copias de seguridad y mantenimiento.
 *
 * En modo local todo vive en IndexedDB: exportar es la única forma de no perder
 * el catálogo al cambiar de navegador, así que la copia se descarga como JSON.
 */
export default function PanelDatos({ productos = [], pedidos = [], onRecargar }) {
  const [trabajando, setTrabajando] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);
  const [totalUsuarios, setTotalUsuarios] = useState(null);

  const contarUsuarios = useCallback(
    () =>
      usuariosApi
        .list()
        .then((lista) => setTotalUsuarios(lista.length))
        .catch(() => setTotalUsuarios(null)),
    []
  );

  useEffect(() => {
    contarUsuarios();
  }, [contarUsuarios]);

  /** Peso aproximado de las fotos incrustadas en el catálogo. */
  const pesoImagenes = useMemo(
    () =>
      productos.reduce(
        (total, producto) => total + estimateDataUrlBytes(producto.image_url),
        0
      ),
    [productos]
  );

  const incrustadas = productos.filter((producto) => String(producto.image_url || '').startsWith('data:')).length;

  const exportar = async () => {
    setTrabajando(true);
    try {
      const copia = await maintenance.exportData();
      const dia = new Date().toISOString().slice(0, 10);
      descargarJson(`thaiger-respaldo-${dia}.json`, copia);
      toast.success('Copia de seguridad descargada');
    } catch (fallo) {
      toast.error(`No se pudo exportar: ${fallo.message}`);
    } finally {
      setTrabajando(false);
    }
  };

  const elegirArchivo = async (archivo) => {
    if (!archivo) return;

    try {
      const contenido = JSON.parse(await archivo.text());
      if (!Array.isArray(contenido?.products)) {
        toast.error('El archivo no tiene el formato esperado.');
        return;
      }

      setConfirmacion({
        titulo: 'Importar copia de seguridad',
        mensaje: `Se reemplazará el catálogo actual (${productos.length} productos) por los ${contenido.products.length} del archivo, y se aplicará su configuración. Las cuentas y los pedidos no se tocan.`,
        etiqueta: 'Sí, importar',
        tono: 'warning',
        accion: async () => {
          const total = await maintenance.importData(contenido);
          await onRecargar?.();
          toast.success(`${total} productos importados`);
        },
      });
    } catch {
      toast.error('No se pudo leer el archivo: ¿es un JSON válido?');
    }
  };

  const pedirRestablecer = () => {
    setConfirmacion({
      titulo: 'Restablecer los datos de demostración',
      mensaje:
        'Se borrará TODO lo que hay en este navegador —catálogo, cuentas, pedidos y configuración— y se volverán a sembrar los datos de demostración. Se cerrará tu sesión y la página se recargará.',
      etiqueta: 'Sí, borrar y sembrar de nuevo',
      tono: 'danger',
      accion: async () => {
        await maintenance.resetDemo();
        window.location.reload();
      },
    });
  };

  const confirmar = async () => {
    if (!confirmacion) return;
    setTrabajando(true);
    try {
      await confirmacion.accion();
      setConfirmacion(null);
    } catch (fallo) {
      toast.error(fallo.message);
    } finally {
      setTrabajando(false);
    }
  };

  const informacion = [
    { titulo: 'Backend activo', valor: IS_LOCAL_MODE ? 'Local (IndexedDB)' : 'Supabase', pie: BACKEND_MODE },
    { titulo: 'Productos', valor: String(productos.length), pie: `${incrustadas} con foto incrustada` },
    { titulo: 'Pedidos', valor: String(pedidos.length), pie: 'Cargados en este panel' },
    {
      titulo: 'Cuentas',
      valor: totalUsuarios === null ? '—' : String(totalUsuarios),
      pie: totalUsuarios === null ? 'Requiere sesión de administrador' : 'Registradas',
    },
    { titulo: 'Peso de las fotos', valor: formatBytes(pesoImagenes), pie: 'Sólo las guardadas como data URL' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo-seccion font-extrabold uppercase tracking-widest text-brand-500">Datos y Respaldo</h1>
        <p className="mt-1 text-sm text-gray-400">
          Copias de seguridad, importación y restablecimiento de la demostración.
        </p>
      </header>

      {/* ------------------------------------------------------ información -- */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {informacion.map((dato) => (
          <div key={dato.titulo} className="superficie rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{dato.titulo}</p>
            <p className="mt-1 text-xl font-black text-white">{dato.valor}</p>
            <p className="mt-1 text-[11px] text-gray-400">{dato.pie}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* --------------------------------------------------------- export */}
        <section className="superficie space-y-4 rounded-xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-300">
            <Download size={16} className="text-brand-500" aria-hidden="true" /> Exportar
          </h2>
          <p className="text-xs leading-relaxed text-gray-400">
            Descarga un JSON con el catálogo, los pedidos y la configuración. Las cuentas se exportan sin
            contraseñas: una copia nunca debe llevar credenciales.
          </p>
          <button type="button" onClick={exportar} disabled={trabajando} className={BOTON_MARCA}>
            <Download size={16} aria-hidden="true" /> Descargar copia
          </button>
        </section>

        {/* --------------------------------------------------------- import */}
        <section className="superficie space-y-4 rounded-xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-300">
            <Upload size={16} className="text-brand-500" aria-hidden="true" /> Importar
          </h2>
          <p className="text-xs leading-relaxed text-gray-400">
            Reemplaza el catálogo con el de una copia. Se pedirá confirmación antes de tocar nada.
          </p>

          <label
            htmlFor="archivo-respaldo"
            className="block text-xs font-bold uppercase tracking-wider text-gray-400"
          >
            Archivo de respaldo
          </label>
          <input
            id="archivo-respaldo"
            type="file"
            accept="application/json,.json"
            disabled={trabajando}
            onChange={(evento) => {
              elegirArchivo(evento.target.files?.[0]);
              evento.target.value = '';
            }}
            className="w-full rounded-sm border border-gray-700 bg-carbon-900 p-3 text-sm text-gray-400 file:mr-4 file:rounded file:border-0 file:bg-carbon-600 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white disabled:opacity-50"
          />
        </section>

        {/* ---------------------------------------------------------- reset */}
        <section className="space-y-4 rounded-xl border border-red-900/50 bg-red-950/20 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-red-400">
            <RotateCcw size={16} aria-hidden="true" /> Restablecer la demo
          </h2>
          <p className="text-xs leading-relaxed text-gray-400">
            Borra por completo la base de este navegador y vuelve a sembrar el catálogo, las cuentas y los pedidos
            de demostración. No hay vuelta atrás: exporta antes si te importa lo que hay.
          </p>

          {!IS_LOCAL_MODE ? (
            <p className="flex items-start gap-2 text-[11px] font-bold text-amber-400">
              <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
              Con Supabase esta acción no está disponible desde el navegador.
            </p>
          ) : (
            <button
              type="button"
              onClick={pedirRestablecer}
              disabled={trabajando}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-sm bg-red-600 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-red-700 disabled:opacity-40"
            >
              <Database size={16} aria-hidden="true" /> Borrar y sembrar de nuevo
            </button>
          )}
        </section>
      </div>

      <p className="flex items-start gap-3 rounded-lg border border-gray-800 bg-black/40 p-4 text-xs leading-relaxed text-gray-400">
        <HardDrive size={16} className="mt-0.5 shrink-0 text-gray-600" aria-hidden="true" />
        <span>
          En modo local los datos viven sólo en este navegador: no se comparten entre dispositivos y se pierden si
          se borran los datos del sitio. Para vender de verdad hay que configurar Supabase en el <code>.env</code>.
        </span>
      </p>

      <ConfirmDialog
        open={Boolean(confirmacion)}
        title={confirmacion?.titulo}
        message={confirmacion?.mensaje}
        confirmLabel={confirmacion?.etiqueta}
        tone={confirmacion?.tono || 'danger'}
        busy={trabajando}
        onConfirm={confirmar}
        onCancel={() => setConfirmacion(null)}
      />
    </div>
  );
}
