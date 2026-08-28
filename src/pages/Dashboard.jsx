import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  Database,
  HardDrive,
  Images,
  LayoutDashboard,
  Package,
  RefreshCw,
  Settings,
  Store,
  Users,
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { products as productosApi, orders as pedidosApi, BACKEND_MODE, IS_LOCAL_MODE } from '../services/api';
import PanelResumen from '../components/dashboard/PanelResumen';
import PanelProductos from '../components/dashboard/PanelProductos';
import PanelPedidos from '../components/dashboard/PanelPedidos';
import PanelUsuarios from '../components/dashboard/PanelUsuarios';
import PanelCarrusel from '../components/dashboard/PanelCarrusel';
import PanelAjustes from '../components/dashboard/PanelAjustes';
import PanelDatos from '../components/dashboard/PanelDatos';

/** Pestañas del panel. El `id` es el que viaja en la URL (`?tab=productos`). */
const PESTANAS = [
  { id: 'resumen', etiqueta: 'Resumen', icono: LayoutDashboard },
  { id: 'productos', etiqueta: 'Productos', icono: Package },
  { id: 'pedidos', etiqueta: 'Pedidos', icono: ClipboardList },
  { id: 'usuarios', etiqueta: 'Usuarios', icono: Users },
  { id: 'carrusel', etiqueta: 'Carrusel', icono: Images },
  { id: 'ajustes', etiqueta: 'Ajustes', icono: Settings },
  { id: 'datos', etiqueta: 'Datos', icono: Database },
];

/** Botón de pestaña: mismo aspecto en la barra lateral y en la tira móvil. */
function BotonPestana({ pestana, activa, onSeleccionar, compacto = false }) {
  const Icono = pestana.icono;

  return (
    <button
      type="button"
      onClick={() => onSeleccionar(pestana.id)}
      aria-current={activa ? 'page' : undefined}
      className={`flex min-h-[44px] items-center gap-3 rounded-sm px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
        compacto ? 'shrink-0 whitespace-nowrap' : 'w-full'
      } ${activa ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-carbon-700 hover:text-white'}`}
    >
      <Icono size={16} aria-hidden="true" /> {pestana.etiqueta}
    </button>
  );
}

/**
 * Armazón del panel de administración.
 *
 * Sólo se ocupa de tres cosas: la navegación entre pestañas (reflejada en la
 * URL para poder recargar sin perder el sitio), la carga de productos y pedidos
 * —que se comparten entre paneles— y el reparto de esos datos por props. Todo
 * lo demás vive en `src/components/dashboard/`.
 */
export default function Dashboard() {
  useDocumentTitle('Panel de administración', 'Inventario, pedidos, usuarios y configuración de la tienda.');

  const [searchParams, setSearchParams] = useSearchParams();
  const solicitada = searchParams.get('tab');
  const pestanaActiva = PESTANAS.some((p) => p.id === solicitada) ? solicitada : 'resumen';

  const [productos, setProductos] = useState([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [errorProductos, setErrorProductos] = useState(null);

  const [pedidos, setPedidos] = useState([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);
  const [errorPedidos, setErrorPedidos] = useState(null);

  // Producto que hay que abrir en el formulario al entrar en la pestaña de
  // inventario (lo usa el aviso de stock bajo del resumen).
  const [edicionPendiente, setEdicionPendiente] = useState(null);

  // ------------------------------------------------------------------ carga

  // Las funciones de carga no tocan el estado antes del primer `await`: así el
  // efecto de arranque no dispara renders en cascada (regla set-state-in-effect).
  const cargarProductos = useCallback(async () => {
    try {
      setProductos(await productosApi.list());
      setErrorProductos(null);
    } catch (fallo) {
      setErrorProductos(fallo.message || 'No se pudo cargar el inventario.');
      setProductos([]);
    } finally {
      setCargandoProductos(false);
    }
  }, []);

  // `listAll()` exige sesión de administrador: si falla, el panel lo explica en
  // lugar de reventar la página.
  const cargarPedidos = useCallback(async () => {
    try {
      setPedidos(await pedidosApi.listAll());
      setErrorPedidos(null);
    } catch (fallo) {
      setErrorPedidos(fallo.message || 'No se pudieron leer los pedidos.');
      setPedidos([]);
    } finally {
      setCargandoPedidos(false);
    }
  }, []);

  useEffect(() => {
    cargarProductos();
    cargarPedidos();
  }, [cargarProductos, cargarPedidos]);

  /** Recarga desde un botón: aquí sí se muestra el estado de carga. */
  const recargarProductos = useCallback(() => {
    setCargandoProductos(true);
    return cargarProductos();
  }, [cargarProductos]);

  const recargarPedidos = useCallback(() => {
    setCargandoPedidos(true);
    return cargarPedidos();
  }, [cargarPedidos]);

  const recargarTodo = useCallback(() => {
    recargarProductos();
    recargarPedidos();
  }, [recargarProductos, recargarPedidos]);

  // ------------------------------------------------------------- navegación

  const irAPestana = useCallback(
    (id) => {
      const siguiente = new URLSearchParams(searchParams);
      if (id === 'resumen') siguiente.delete('tab');
      else siguiente.set('tab', id);
      setSearchParams(siguiente, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const editarProducto = useCallback(
    (producto) => {
      setEdicionPendiente(producto);
      irAPestana('productos');
    },
    [irAPestana]
  );

  // ------------------------------------------------------------- derivados

  const marcas = useMemo(
    () => [...new Set(productos.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [productos]
  );

  const categorias = useMemo(
    () => [...new Set(productos.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [productos]
  );

  const pestanaActual = PESTANAS.find((p) => p.id === pestanaActiva) || PESTANAS[0];

  return (
    <div className="min-h-screen bg-carbon-900 font-sans text-white">
      <div className="flex min-h-screen">
        {/* ============================ barra lateral (escritorio) ========= */}
        {/* La altura real de la cabecera cambia con el aviso superior: el Navbar la
            publica en `--alto-cabecera` y aquí se usa para pegar la barra justo debajo. */}
        <aside className="no-imprimir sticky top-[var(--alto-cabecera,5rem)] hidden h-[calc(100vh-var(--alto-cabecera,5rem))] w-64 shrink-0 overflow-y-auto border-r border-gray-800 bg-carbon-800 p-6 custom-scrollbar lg:block">
          <div className="mb-8">
            <p className="flex items-center gap-2 text-xl font-extrabold uppercase tracking-widest text-brand-500">
              <HardDrive size={20} aria-hidden="true" /> Admin
            </p>
            <p className="mt-1 text-xs text-gray-400">Thaiger Supplements</p>
          </div>

          <nav aria-label="Secciones del panel" className="space-y-2">
            {PESTANAS.map((pestana) => (
              <BotonPestana
                key={pestana.id}
                pestana={pestana}
                activa={pestana.id === pestanaActiva}
                onSeleccionar={irAPestana}
              />
            ))}
          </nav>

          <Link
            to="/"
            className="mt-8 flex min-h-[44px] items-center gap-2 rounded-sm border border-gray-800 px-4 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-gray-600 hover:text-white"
          >
            <Store size={16} aria-hidden="true" /> Ver tienda
          </Link>

          {IS_LOCAL_MODE && (
            <div className="mt-8 rounded border border-brand-600/30 bg-brand-600/10 p-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-brand-500">Modo local</p>
              <p className="text-[11px] leading-relaxed text-gray-400">
                Los datos viven en este navegador (IndexedDB). Configura Supabase en el <code>.env</code> para
                usar una base compartida.
              </p>
            </div>
          )}
        </aside>

        {/* =================================== contenido =================== */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10">
          {/* Tira de pestañas desplazable en móvil */}
          <div className="no-imprimir -mx-4 mb-6 overflow-x-auto px-4 pb-1 custom-scrollbar lg:hidden">
            <nav aria-label="Secciones del panel" className="flex gap-2">
              {PESTANAS.map((pestana) => (
                <BotonPestana
                  key={pestana.id}
                  pestana={pestana}
                  activa={pestana.id === pestanaActiva}
                  onSeleccionar={irAPestana}
                  compacto
                />
              ))}
            </nav>
          </div>

          <div className="no-imprimir mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
              Panel de administración · {pestanaActual.etiqueta} ·{' '}
              <span className="text-brand-500">{BACKEND_MODE === 'local' ? 'datos locales' : 'Supabase'}</span>
            </p>

            <button
              type="button"
              onClick={recargarTodo}
              className="flex min-h-[44px] items-center gap-2 rounded-sm border border-gray-800 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-gray-600 hover:text-white"
            >
              <RefreshCw size={14} aria-hidden="true" /> Recargar todo
            </button>
          </div>

          {IS_LOCAL_MODE && (
            <p className="no-imprimir mb-6 rounded border border-brand-600/30 bg-brand-600/10 p-3 text-[11px] leading-relaxed text-gray-400 lg:hidden">
              <span className="font-bold uppercase tracking-widest text-brand-500">Modo local:</span> los datos se
              guardan en este navegador.
            </p>
          )}

          {/* Sólo se monta el panel activo: con cientos de filas, mantener los
              demás en el árbol vuelve lentísima cualquier interacción. */}
          {pestanaActiva === 'resumen' && (
            <PanelResumen
              productos={productos}
              pedidos={pedidos}
              cargandoProductos={cargandoProductos}
              cargandoPedidos={cargandoPedidos}
              errorPedidos={errorPedidos}
              onEditarProducto={editarProducto}
              onIrAPestana={irAPestana}
            />
          )}

          {pestanaActiva === 'productos' && (
            <PanelProductos
              productos={productos}
              marcas={marcas}
              categorias={categorias}
              cargando={cargandoProductos}
              error={errorProductos}
              onRecargar={recargarProductos}
              onCambiarProductos={setProductos}
              productoInicial={edicionPendiente}
              onEdicionAtendida={() => setEdicionPendiente(null)}
            />
          )}

          {pestanaActiva === 'pedidos' && (
            <PanelPedidos
              pedidos={pedidos}
              cargando={cargandoPedidos}
              error={errorPedidos}
              onRecargar={recargarPedidos}
              onCambiarPedidos={setPedidos}
            />
          )}

          {pestanaActiva === 'usuarios' && <PanelUsuarios pedidos={pedidos} />}

          {pestanaActiva === 'carrusel' && <PanelCarrusel marcas={marcas} />}

          {pestanaActiva === 'ajustes' && <PanelAjustes />}

          {pestanaActiva === 'datos' && (
            <PanelDatos productos={productos} pedidos={pedidos} onRecargar={recargarTodo} />
          )}
        </main>
      </div>
    </div>
  );
}
