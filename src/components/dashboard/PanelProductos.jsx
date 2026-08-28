import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Edit,
  ImageIcon,
  Package,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { products as productosApi } from '../../services/api';
import { applyDiscount, formatPrice } from '../../lib/pricing';
import ProductFormModal from '../ProductFormModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import { SkeletonRows } from '../ui/Skeleton';
import { inputClasses } from '../ui/Field';

/** Filas por página. Con cientos de productos, pintarlas todas es inmanejable. */
const POR_PAGINA = 25;

const BOTON_SECUNDARIO =
  'flex min-h-[44px] items-center justify-center gap-2 rounded-sm border border-gray-800 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-40';

const BOTON_MARCA =
  'flex min-h-[44px] items-center justify-center gap-2 rounded-sm bg-brand-600 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:opacity-40';

/**
 * Acción de una fila (sólo icono). El icono mide 16px, así que sin una medida
 * explícita el botón se queda en 32×32: por debajo del mínimo táctil de 44.
 * La misma constante existe en los demás paneles con listas.
 */
const BOTON_ICONO = 'grid h-11 w-11 shrink-0 place-items-center rounded transition-colors';

/** Clase del número de existencias según lo apurado que vaya. */
function tonoStock(stock) {
  const unidades = Number(stock) || 0;
  if (unidades <= 0) return 'text-red-500';
  if (unidades <= 5) return 'text-amber-400';
  return 'text-green-500';
}

/** Cabecera de columna que ordena al pulsarla. */
function ColumnaOrdenable({ campo, etiqueta, criterio, orden, onOrdenar, className = '' }) {
  const activa = orden.campo === campo;

  return (
    <th scope="col" className={`px-4 py-3 ${className}`}>
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        aria-label={`Ordenar el inventario por ${criterio || etiqueta.toLowerCase()}`}
        className={`flex items-center gap-1 uppercase tracking-widest transition-colors hover:text-white ${
          activa ? 'text-brand-500' : ''
        }`}
      >
        {etiqueta}
        {activa &&
          (orden.direccion === 'asc' ? (
            <ArrowUp size={12} aria-hidden="true" />
          ) : (
            <ArrowDown size={12} aria-hidden="true" />
          ))}
      </button>
    </th>
  );
}

/**
 * Gestor de inventario: búsqueda, filtros, orden, edición rápida, acciones
 * masivas y renombrado de marcas y categorías.
 */
export default function PanelProductos({
  productos = [],
  marcas = [],
  categorias = [],
  cargando = false,
  error = null,
  onRecargar,
  onCambiarProductos,
  productoInicial = null,
  onEdicionAtendida,
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroMarca, setFiltroMarca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroExistencias, setFiltroExistencias] = useState('todos');
  const [filtroOferta, setFiltroOferta] = useState('todos');
  const [orden, setOrden] = useState({ campo: '', direccion: 'asc' });
  const [pagina, setPagina] = useState(1);

  const [seleccion, setSeleccion] = useState([]);
  const [trabajando, setTrabajando] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);

  const [gestorAbierto, setGestorAbierto] = useState(false);
  const [renombrando, setRenombrando] = useState(null);
  const [nombreNuevo, setNombreNuevo] = useState('');

  const [modalAbierto, setModalAbierto] = useState(Boolean(productoInicial));
  const [editando, setEditando] = useState(productoInicial);
  const [aperturas, setAperturas] = useState(0);
  const [guardando, setGuardando] = useState(false);

  // ---------------------------------------------------------------- filtros

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    const lista = productos.filter((producto) => {
      if (
        termino &&
        ![producto.name, producto.brand, producto.category].some((campo) =>
          String(campo || '').toLowerCase().includes(termino)
        )
      ) {
        return false;
      }
      if (filtroMarca && producto.brand !== filtroMarca) return false;
      if (filtroCategoria && producto.category !== filtroCategoria) return false;

      const unidades = Number(producto.stock) || 0;
      if (filtroExistencias === 'bajo' && !(unidades > 0 && unidades <= 5)) return false;
      if (filtroExistencias === 'agotado' && unidades > 0) return false;

      if (filtroOferta === 'oferta' && !producto.is_on_sale) return false;
      if (filtroOferta === 'sin' && producto.is_on_sale) return false;

      return true;
    });

    if (!orden.campo) return lista;

    const signo = orden.direccion === 'asc' ? 1 : -1;
    return lista.sort((a, b) => {
      if (orden.campo === 'name') return signo * String(a.name || '').localeCompare(String(b.name || ''), 'es');
      if (orden.campo === 'stock') return signo * ((Number(a.stock) || 0) - (Number(b.stock) || 0));
      return signo * ((Number(a.price1) || 0) - (Number(b.price1) || 0));
    });
  }, [productos, busqueda, filtroMarca, filtroCategoria, filtroExistencias, filtroOferta, orden]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const desde = (paginaActual - 1) * POR_PAGINA;

  const visibles = useMemo(
    () => filtrados.slice(desde, desde + POR_PAGINA),
    [filtrados, desde]
  );

  const grupos = useMemo(() => {
    const porMarca = new Map();
    const porCategoria = new Map();

    for (const producto of productos) {
      if (producto.brand) porMarca.set(producto.brand, (porMarca.get(producto.brand) || 0) + 1);
      if (producto.category) porCategoria.set(producto.category, (porCategoria.get(producto.category) || 0) + 1);
    }

    const ordenar = (mapa) =>
      [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([nombre, total]) => ({ nombre, total }));

    return { marcas: ordenar(porMarca), categorias: ordenar(porCategoria) };
  }, [productos]);

  const hayFiltros =
    Boolean(busqueda) ||
    Boolean(filtroMarca) ||
    Boolean(filtroCategoria) ||
    filtroExistencias !== 'todos' ||
    filtroOferta !== 'todos';

  /** Cualquier cambio de filtro devuelve a la primera página. */
  const conReinicio = (aplicar) => (valor) => {
    aplicar(valor);
    setPagina(1);
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroMarca('');
    setFiltroCategoria('');
    setFiltroExistencias('todos');
    setFiltroOferta('todos');
    setPagina(1);
  };

  const ordenarPor = (campo) => {
    setOrden((previo) =>
      previo.campo === campo
        ? { campo, direccion: previo.direccion === 'asc' ? 'desc' : 'asc' }
        : { campo, direccion: 'asc' }
    );
    setPagina(1);
  };

  // ------------------------------------------------------------- selección

  const seleccionados = new Set(seleccion.map(String));
  const todosVisiblesMarcados = filtrados.length > 0 && filtrados.every((p) => seleccionados.has(String(p.id)));

  const alternarSeleccion = (id) => {
    setSeleccion((previo) =>
      previo.some((actual) => String(actual) === String(id))
        ? previo.filter((actual) => String(actual) !== String(id))
        : [...previo, id]
    );
  };

  const alternarTodos = () => {
    setSeleccion(todosVisiblesMarcados ? [] : filtrados.map((producto) => producto.id));
  };

  // -------------------------------------------------------------- acciones

  const abrirNuevo = () => {
    setEditando(null);
    setAperturas((n) => n + 1);
    setModalAbierto(true);
  };

  const abrirEdicion = (producto) => {
    setEditando(producto);
    setAperturas((n) => n + 1);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    onEdicionAtendida?.();
  };

  const guardar = async (payload) => {
    setGuardando(true);
    try {
      if (editando) {
        const actualizado = await productosApi.update(editando.id, payload);
        onCambiarProductos?.((previos) =>
          previos.map((p) => (String(p.id) === String(editando.id) ? { ...p, ...actualizado } : p))
        );
        toast.success('Producto actualizado');
      } else {
        const creado = await productosApi.create(payload);
        onCambiarProductos?.((previos) => [creado, ...previos]);
        toast.success('Producto creado');
      }
      cerrarModal();
    } catch (fallo) {
      toast.error(`No se pudo guardar: ${fallo.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const alternarOferta = async (producto) => {
    const activar = !producto.is_on_sale;
    const porcentaje = activar && !(producto.discount_percent > 0) ? 15 : producto.discount_percent;
    const parche = { is_on_sale: activar, discount_percent: porcentaje };

    // Optimista: la tabla responde al instante y se revierte si el guardado falla.
    onCambiarProductos?.((previos) =>
      previos.map((p) => (String(p.id) === String(producto.id) ? { ...p, ...parche } : p))
    );

    try {
      await productosApi.update(producto.id, parche);
      toast.success(activar ? `Producto en oferta (${porcentaje}%)` : 'Oferta retirada');
    } catch (fallo) {
      onCambiarProductos?.((previos) =>
        previos.map((p) => (String(p.id) === String(producto.id) ? { ...p, ...producto } : p))
      );
      toast.error(`No se pudo actualizar la oferta: ${fallo.message}`);
    }
  };

  const guardarExistencias = async (producto, valor) => {
    const unidades = Math.max(0, Math.floor(Number(valor)));
    if (!Number.isFinite(unidades) || unidades === Number(producto.stock)) return;

    onCambiarProductos?.((previos) =>
      previos.map((p) => (String(p.id) === String(producto.id) ? { ...p, stock: unidades } : p))
    );

    try {
      await productosApi.update(producto.id, { stock: unidades });
      toast.success(`${producto.name}: ${unidades} unidades`);
    } catch (fallo) {
      onCambiarProductos?.((previos) =>
        previos.map((p) => (String(p.id) === String(producto.id) ? { ...p, ...producto } : p))
      );
      toast.error(`No se pudo cambiar las existencias: ${fallo.message}`);
    }
  };

  const duplicar = async (producto) => {
    try {
      const copia = await productosApi.create({
        ...producto,
        name: `${producto.name} (copia)`,
        stock: 0,
      });
      onCambiarProductos?.((previos) => [copia, ...previos]);
      toast.success('Producto duplicado');
    } catch (fallo) {
      toast.error(`No se pudo duplicar: ${fallo.message}`);
    }
  };

  const pedirBorrado = (producto) => {
    setConfirmacion({
      titulo: 'Eliminar producto',
      mensaje: `Se eliminará «${producto.name}» del catálogo. Esta acción no se puede deshacer.`,
      etiqueta: 'Sí, eliminar',
      accion: async () => {
        await productosApi.remove(producto.id);
        onCambiarProductos?.((previos) => previos.filter((p) => String(p.id) !== String(producto.id)));
        setSeleccion((previo) => previo.filter((id) => String(id) !== String(producto.id)));
        toast.success('Producto eliminado');
      },
    });
  };

  const pedirBorradoMasivo = () => {
    setConfirmacion({
      titulo: 'Eliminar selección',
      mensaje: `Se eliminarán ${seleccion.length} productos del catálogo. Esta acción no se puede deshacer.`,
      etiqueta: `Sí, eliminar ${seleccion.length}`,
      accion: async () => {
        await productosApi.bulkRemove(seleccion);
        onCambiarProductos?.((previos) => previos.filter((p) => !seleccionados.has(String(p.id))));
        setSeleccion([]);
        toast.success(`${seleccion.length} productos eliminados`);
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

  const aplicarMasivo = async (parche, mensaje) => {
    if (seleccion.length === 0) return;
    setTrabajando(true);
    try {
      await productosApi.bulkUpdate(seleccion, parche);
      await onRecargar?.();
      toast.success(mensaje);
    } catch (fallo) {
      toast.error(`No se pudo aplicar: ${fallo.message}`);
    } finally {
      setTrabajando(false);
    }
  };

  const renombrar = async () => {
    if (!renombrando) return;
    const destino = nombreNuevo.trim();
    if (!destino) {
      toast.error('El nombre nuevo no puede quedar vacío.');
      return;
    }

    setTrabajando(true);
    try {
      const cambiados = await productosApi.renameGroup(renombrando.campo, renombrando.desde, destino);
      await onRecargar?.();
      setRenombrando(null);
      setNombreNuevo('');
      toast.success(`${cambiados} productos actualizados`);
    } catch (fallo) {
      toast.error(`No se pudo renombrar: ${fallo.message}`);
    } finally {
      setTrabajando(false);
    }
  };

  const abrirRenombrado = (campo, desde) => {
    setRenombrando({ campo, desde });
    setNombreNuevo(desde);
  };

  // ----------------------------------------------------------------- vista

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="titulo-seccion font-extrabold uppercase tracking-widest text-brand-500">
            Gestor de Inventario
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Alta, edición y control de existencias. {productos.length} productos en el catálogo.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onRecargar?.()} className={BOTON_SECUNDARIO}>
            <RefreshCw size={16} aria-hidden="true" /> Recargar
          </button>
          <button type="button" onClick={abrirNuevo} className={BOTON_MARCA}>
            <Plus size={16} aria-hidden="true" /> Añadir Producto
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* ----------------------------------------------- marcas y categorías */}
      <section className="superficie rounded-xl">
        <button
          type="button"
          onClick={() => setGestorAbierto((abierto) => !abierto)}
          aria-expanded={gestorAbierto}
          className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-300">
            <Tags size={15} className="text-brand-500" aria-hidden="true" /> Marcas y categorías
          </span>
          <span className="flex items-center gap-2 text-[11px] text-gray-400">
            {grupos.marcas.length} marcas · {grupos.categorias.length} categorías
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`transition-transform ${gestorAbierto ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        {gestorAbierto && (
          <div className="grid grid-cols-1 gap-6 border-t border-gray-800 p-4 lg:grid-cols-2">
            {[
              { campo: 'brand', titulo: 'Marcas', lista: grupos.marcas },
              { campo: 'category', titulo: 'Categorías', lista: grupos.categorias },
            ].map((bloque) => (
              <div key={bloque.campo} className="space-y-2">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{bloque.titulo}</h2>

                <ul className="max-h-64 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                  {bloque.lista.map((grupo) => {
                    const editandoEste =
                      renombrando?.campo === bloque.campo && renombrando?.desde === grupo.nombre;

                    return (
                      <li key={grupo.nombre} className="rounded-sm border border-gray-800 px-3 py-2">
                        {editandoEste ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              aria-label={`Nuevo nombre para ${grupo.nombre}`}
                              value={nombreNuevo}
                              onChange={(evento) => setNombreNuevo(evento.target.value)}
                              className={inputClasses({ extra: 'flex-1 py-2' })}
                            />
                            <button
                              type="button"
                              onClick={renombrar}
                              disabled={trabajando}
                              className="min-h-[44px] rounded-sm bg-brand-600 px-3 text-[11px] font-bold uppercase text-white hover:bg-brand-700 disabled:opacity-40"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenombrando(null)}
                              aria-label="Cancelar el renombrado"
                              className="min-h-[44px] px-2 text-gray-400 hover:text-white"
                            >
                              <X size={16} aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-sm text-gray-300">{grupo.nombre}</span>
                            <span className="flex shrink-0 items-center gap-3">
                              <span className="text-[11px] text-gray-400">{grupo.total}</span>
                              <button
                                type="button"
                                onClick={() => abrirRenombrado(bloque.campo, grupo.nombre)}
                                className="text-[11px] font-bold uppercase tracking-wider text-brand-500 hover:text-brand-400"
                              >
                                Renombrar
                              </button>
                            </span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ filtros */}
      <section className="superficie space-y-4 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar en el inventario"
            placeholder="Buscar por nombre, marca o categoría..."
            value={busqueda}
            onChange={(evento) => conReinicio(setBusqueda)(evento.target.value)}
            className="w-full border-none bg-transparent text-base text-white placeholder-gray-400 focus:outline-none sm:text-sm"
          />
          <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">{`${filtrados.length} resultados`}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <select
            aria-label="Filtrar por marca"
            value={filtroMarca}
            onChange={(evento) => conReinicio(setFiltroMarca)(evento.target.value)}
            className={inputClasses({ extra: 'min-h-[44px]' })}
          >
            <option value="">Todas las marcas</option>
            {marcas.map((marca) => (
              <option key={marca} value={marca}>
                {marca}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por categoría"
            value={filtroCategoria}
            onChange={(evento) => conReinicio(setFiltroCategoria)(evento.target.value)}
            className={inputClasses({ extra: 'min-h-[44px]' })}
          >
            <option value="">Todas las categorías</option>
            {categorias.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por existencias"
            value={filtroExistencias}
            onChange={(evento) => conReinicio(setFiltroExistencias)(evento.target.value)}
            className={inputClasses({ extra: 'min-h-[44px]' })}
          >
            <option value="todos">Todas las existencias</option>
            <option value="bajo">Quedan 5 o menos</option>
            <option value="agotado">Agotados</option>
          </select>

          <select
            aria-label="Filtrar por oferta"
            value={filtroOferta}
            onChange={(evento) => conReinicio(setFiltroOferta)(evento.target.value)}
            className={inputClasses({ extra: 'min-h-[44px]' })}
          >
            <option value="todos">Con y sin oferta</option>
            <option value="oferta">Sólo en oferta</option>
            <option value="sin">Sin oferta</option>
          </select>
        </div>

        {hayFiltros && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="text-[11px] font-bold uppercase tracking-widest text-brand-500 hover:text-brand-400"
          >
            Quitar filtros
          </button>
        )}
      </section>

      {/* --------------------------------------------------- acciones masivas */}
      {seleccion.length > 0 && (
        <section className="rounded-xl border border-brand-600/40 bg-brand-600/10 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500">
              {seleccion.length} productos seleccionados
            </p>
            <button
              type="button"
              onClick={() => setSeleccion([])}
              className="text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-white"
            >
              Quitar selección
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label
                htmlFor="masivo-descuento"
                className="block text-[10px] font-bold uppercase tracking-wider text-gray-400"
              >
                Descuento a aplicar (%)
              </label>
              <div className="flex gap-2">
                <input
                  id="masivo-descuento"
                  type="number"
                  min="1"
                  max="99"
                  defaultValue="15"
                  className={inputClasses({ extra: 'sin-flechas min-h-[44px] w-20' })}
                />
                <button
                  type="button"
                  disabled={trabajando}
                  onClick={() => {
                    const campo = document.getElementById('masivo-descuento');
                    const porcentaje = Number(campo?.value);
                    if (!(porcentaje > 0 && porcentaje < 100)) {
                      toast.error('El descuento debe estar entre 1 y 99.');
                      return;
                    }
                    aplicarMasivo(
                      { is_on_sale: true, discount_percent: porcentaje },
                      `Oferta del ${porcentaje}% aplicada`
                    );
                  }}
                  className={BOTON_MARCA}
                >
                  <Percent size={14} aria-hidden="true" /> Poner
                </button>
                <button
                  type="button"
                  disabled={trabajando}
                  onClick={() => aplicarMasivo({ is_on_sale: false, discount_percent: 0 }, 'Ofertas retiradas')}
                  className={BOTON_SECUNDARIO}
                >
                  Quitar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="masivo-unidades"
                className="block text-[10px] font-bold uppercase tracking-wider text-gray-400"
              >
                Unidades a fijar
              </label>
              <div className="flex gap-2">
                <input
                  id="masivo-unidades"
                  type="number"
                  min="0"
                  defaultValue="10"
                  className={inputClasses({ extra: 'sin-flechas min-h-[44px] w-24' })}
                />
                <button
                  type="button"
                  disabled={trabajando}
                  onClick={() => {
                    const campo = document.getElementById('masivo-unidades');
                    const unidades = Number(campo?.value);
                    if (!Number.isFinite(unidades) || unidades < 0) {
                      toast.error('Las unidades no pueden ser negativas.');
                      return;
                    }
                    aplicarMasivo({ stock: unidades }, `Existencias fijadas en ${unidades}`);
                  }}
                  className={BOTON_MARCA}
                >
                  Aplicar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="masivo-marca"
                className="block text-[10px] font-bold uppercase tracking-wider text-gray-400"
              >
                Nueva marca
              </label>
              <div className="flex gap-2">
                <select id="masivo-marca" className={inputClasses({ extra: 'min-h-[44px] flex-1' })}>
                  <option value="">Elige una marca</option>
                  {marcas.map((marca) => (
                    <option key={marca} value={marca}>
                      {marca}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={trabajando}
                  onClick={() => {
                    const campo = document.getElementById('masivo-marca');
                    if (!campo?.value) {
                      toast.error('Elige una marca de la lista.');
                      return;
                    }
                    aplicarMasivo({ brand: campo.value }, `Marca cambiada a ${campo.value}`);
                  }}
                  className={BOTON_MARCA}
                >
                  Aplicar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="masivo-categoria"
                className="block text-[10px] font-bold uppercase tracking-wider text-gray-400"
              >
                Nueva categoría
              </label>
              <div className="flex gap-2">
                <select id="masivo-categoria" className={inputClasses({ extra: 'min-h-[44px] flex-1' })}>
                  <option value="">Elige una categoría</option>
                  {categorias.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={trabajando}
                  onClick={() => {
                    const campo = document.getElementById('masivo-categoria');
                    if (!campo?.value) {
                      toast.error('Elige una categoría de la lista.');
                      return;
                    }
                    aplicarMasivo({ category: campo.value }, `Categoría cambiada a ${campo.value}`);
                  }}
                  className={BOTON_MARCA}
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={trabajando}
            onClick={pedirBorradoMasivo}
            className="mt-4 flex min-h-[44px] items-center gap-2 rounded-sm bg-red-600 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-red-700 disabled:opacity-40"
          >
            <Trash2 size={14} aria-hidden="true" /> Eliminar {seleccion.length} productos
          </button>
        </section>
      )}

      {/* ------------------------------------------------------------- tabla */}
      {cargando ? (
        <div className="superficie rounded-xl">
          <SkeletonRows rows={8} columns={6} />
        </div>
      ) : productos.length === 0 ? (
        <EmptyState
          as="h2"
          icon={Package}
          title="El catálogo está vacío"
          message="Añade el primer producto con su foto, precios por nivel y existencias."
          actionLabel="Añadir Producto"
          onAction={abrirNuevo}
        />
      ) : filtrados.length === 0 ? (
        <EmptyState
          as="h2"
          icon={Search}
          title="Ningún producto coincide"
          message="Prueba con otro texto de búsqueda o quita los filtros activos."
          actionLabel="Quitar filtros"
          onAction={limpiarFiltros}
        />
      ) : (
        <>
          {/* Escritorio */}
          <div className="superficie hidden overflow-x-auto rounded-xl lg:block">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-carbon-700 text-xs font-bold uppercase tracking-widest text-gray-300">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos los productos filtrados"
                      checked={todosVisiblesMarcados}
                      onChange={alternarTodos}
                      className="h-4 w-4 accent-orange-600"
                    />
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Foto
                  </th>
                  <ColumnaOrdenable campo="name" etiqueta="Producto" criterio="nombre" orden={orden} onOrdenar={ordenarPor} />
                  <th scope="col" className="px-4 py-3">
                    Marca
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Categoría
                  </th>
                  <ColumnaOrdenable campo="price1" etiqueta="Precio" criterio="importe" orden={orden} onOrdenar={ordenarPor} />
                  <ColumnaOrdenable campo="stock" etiqueta="Stock" criterio="existencias" orden={orden} onOrdenar={ordenarPor} />
                  <th scope="col" className="px-4 py-3 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibles.map((producto) => (
                  <tr key={producto.id} className="border-b border-gray-800 transition-colors hover:bg-black/40">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${producto.name}`}
                        checked={seleccionados.has(String(producto.id))}
                        onChange={() => alternarSeleccion(producto.id)}
                        className="h-4 w-4 accent-orange-600"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded bg-white">
                        {producto.image_url ? (
                          <img
                            src={producto.image_url}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <ImageIcon size={18} className="text-gray-400" aria-hidden="true" />
                        )}
                      </div>
                    </td>

                    <td className="max-w-[240px] px-4 py-3 font-bold text-white">
                      <span className="block truncate" title={producto.name}>
                        {producto.name}
                      </span>
                      <span className="font-mono text-[10px] text-gray-400">#{producto.id}</span>
                    </td>

                    <td className="px-4 py-3">{producto.brand}</td>

                    <td className="px-4 py-3">
                      <span className="rounded border border-gray-700 bg-carbon-700 px-2 py-1 text-[10px] font-bold uppercase text-gray-300">
                        {producto.category}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 font-bold text-brand-500">
                      {formatPrice(applyDiscount(producto.price1, producto))}
                      {producto.is_on_sale && producto.discount_percent > 0 && (
                        <span className="block text-[10px] font-normal text-gray-400 line-through">
                          {formatPrice(producto.price1)}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <input
                        key={`${producto.id}-${producto.stock}`}
                        type="number"
                        min="0"
                        aria-label={`Existencias de ${producto.name}`}
                        defaultValue={Number(producto.stock) || 0}
                        onBlur={(evento) => guardarExistencias(producto, evento.target.value)}
                        className={`sin-flechas w-20 rounded-sm border border-gray-800 bg-carbon-900 px-2 py-2 text-sm font-bold focus:border-brand-500 focus:outline-none ${tonoStock(
                          producto.stock
                        )}`}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* El nombre accesible sale del `aria-label`: el `title`
                            se queda sólo como ayuda visual al pasar el ratón. */}
                        <button
                          type="button"
                          onClick={() => alternarOferta(producto)}
                          title="Activar o desactivar la oferta"
                          aria-label={`Activar o desactivar la oferta de ${producto.name}`}
                          className={`whitespace-nowrap rounded px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                            producto.is_on_sale
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-carbon-700 text-gray-400 hover:bg-carbon-600 hover:text-white'
                          }`}
                        >
                          {producto.is_on_sale ? `-${producto.discount_percent}%` : 'Sin oferta'}
                        </button>

                        <button
                          type="button"
                          onClick={() => abrirEdicion(producto)}
                          title="Editar"
                          aria-label={`Editar ${producto.name}`}
                          className={`${BOTON_ICONO} bg-blue-500/10 text-blue-500 hover:text-blue-400`}
                        >
                          <Edit size={16} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => duplicar(producto)}
                          title="Duplicar"
                          aria-label={`Duplicar ${producto.name}`}
                          className={`${BOTON_ICONO} bg-carbon-700 text-gray-400 hover:text-white`}
                        >
                          <Copy size={16} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => pedirBorrado(producto)}
                          title="Eliminar"
                          aria-label={`Eliminar ${producto.name}`}
                          className={`${BOTON_ICONO} bg-red-500/10 text-red-500 hover:text-red-400`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: la misma información en tarjetas */}
          <ul className="space-y-3 lg:hidden">
            {visibles.map((producto) => (
              <li key={producto.id} className="superficie rounded-xl p-4">
                <div className="flex gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Marcar ${producto.name}`}
                    checked={seleccionados.has(String(producto.id))}
                    onChange={() => alternarSeleccion(producto.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-orange-600"
                  />

                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-white">
                    {producto.image_url ? (
                      <img src={producto.image_url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon size={20} className="text-gray-400" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{producto.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">
                      {producto.brand} · {producto.category}
                    </p>
                    <p className="mt-1 font-bold text-brand-500">
                      {formatPrice(applyDiscount(producto.price1, producto))}
                      {producto.is_on_sale && producto.discount_percent > 0 && (
                        <span className="ml-2 text-[10px] font-normal text-gray-400 line-through">
                          {formatPrice(producto.price1)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-800 pt-3">
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-gray-400">
                    Unidades
                    <input
                      key={`movil-${producto.id}-${producto.stock}`}
                      type="number"
                      min="0"
                      aria-label={`Unidades de ${producto.name}`}
                      defaultValue={Number(producto.stock) || 0}
                      onBlur={(evento) => guardarExistencias(producto, evento.target.value)}
                      className={`sin-flechas w-20 rounded-sm border border-gray-800 bg-carbon-900 px-2 py-2 text-sm font-bold ${tonoStock(
                        producto.stock
                      )}`}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => alternarOferta(producto)}
                    aria-label={`Cambiar la oferta de ${producto.name}`}
                    className={`ml-auto min-h-[44px] rounded px-3 py-2 text-[10px] font-bold uppercase ${
                      producto.is_on_sale ? 'bg-red-600 text-white' : 'bg-carbon-700 text-gray-400'
                    }`}
                  >
                    {producto.is_on_sale ? `-${producto.discount_percent}%` : 'Sin oferta'}
                  </button>

                  <button
                    type="button"
                    onClick={() => abrirEdicion(producto)}
                    aria-label={`Editar ${producto.name}`}
                    className={`${BOTON_ICONO} bg-blue-500/10 text-blue-500`}
                  >
                    <Edit size={16} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => duplicar(producto)}
                    aria-label={`Duplicar ${producto.name}`}
                    className={`${BOTON_ICONO} bg-carbon-700 text-gray-400`}
                  >
                    <Copy size={16} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => pedirBorrado(producto)}
                    aria-label={`Eliminar ${producto.name}`}
                    className={`${BOTON_ICONO} bg-red-500/10 text-red-500`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* -------------------------------------------------- paginación -- */}
          <nav
            aria-label="Paginación del inventario"
            className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400"
          >
            <p>
              Mostrando {desde + 1}-{Math.min(desde + POR_PAGINA, filtrados.length)} de {filtrados.length}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPagina(Math.max(1, paginaActual - 1))}
                disabled={paginaActual <= 1}
                className={BOTON_SECUNDARIO}
              >
                Anterior
              </button>
              <span className="px-2 font-bold text-gray-400">
                Página {paginaActual} de {totalPaginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina(Math.min(totalPaginas, paginaActual + 1))}
                disabled={paginaActual >= totalPaginas}
                className={BOTON_SECUNDARIO}
              >
                Siguiente
              </button>
            </div>
          </nav>
        </>
      )}

      <ProductFormModal
        key={`${editando?.id ?? 'nuevo'}-${aperturas}`}
        abierto={modalAbierto}
        producto={editando}
        marcas={marcas}
        categorias={categorias}
        guardando={guardando}
        onSubirImagen={productosApi.uploadImage}
        onGuardar={guardar}
        onCerrar={cerrarModal}
      />

      <ConfirmDialog
        open={Boolean(confirmacion)}
        title={confirmacion?.titulo}
        message={confirmacion?.mensaje}
        confirmLabel={confirmacion?.etiqueta}
        tone="danger"
        busy={trabajando}
        onConfirm={confirmar}
        onCancel={() => setConfirmacion(null)}
      />
    </div>
  );
}
