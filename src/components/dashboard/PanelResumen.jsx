import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  DollarSign,
  Flame,
  PackageX,
  Receipt,
  TrendingUp,
  Truck,
  Warehouse,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import AnimatedNumber from '../ui/AnimatedNumber';
import Reveal from '../ui/Reveal';
import { Skeleton } from '../ui/Skeleton';
import { formatPrice } from '../../lib/pricing';
import { buildDashboardMetrics, ESTADOS_PEDIDO } from '../../lib/metrics';
import { resolveVariants, staggerContainer, staggerItem } from '../../lib/motion';

/** Color de cada estado dentro de la paleta de la marca (gris para cancelado). */
const COLOR_ESTADO = {
  'Pago Pendiente': '#7c2d12',
  'En Proceso': '#c2410c',
  Enviado: '#ea580c',
  Entregado: '#f97316',
  Cancelado: '#4b5563',
};

/**
 * Tarjeta de métrica.
 *
 * Entra con el contenedor escalonado (`animate`, no `whileInView`): estas
 * tarjetas están siempre a la vista, no hay nada que esperar a que aparezca.
 */
function Metrica({ icono, titulo, valor, formato, pie, tono = 'text-white', reduced = false }) {
  const Icono = icono;

  return (
    <motion.div
      variants={resolveVariants(staggerItem, reduced)}
      className="superficie relative overflow-hidden rounded-xl p-5"
    >
      <Icono
        size={72}
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 -top-2 text-white opacity-[0.04]"
      />
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">{titulo}</h3>
      <p className={`text-2xl font-black sm:text-3xl ${tono}`}>
        <AnimatedNumber value={valor} format={formato} duration={350} />
      </p>
      {pie && <p className="mt-2 text-[11px] font-bold text-gray-400">{pie}</p>}
    </motion.div>
  );
}

const enteros = (valor) => String(Math.round(Number(valor) || 0));

/**
 * Vista general del negocio: dinero, pedidos, inventario y las tres listas que
 * de verdad se miran a diario (stock bajo, últimos pedidos y más vendidos).
 */
export default function PanelResumen({
  productos = [],
  pedidos = [],
  cargandoProductos = false,
  cargandoPedidos = false,
  errorPedidos = null,
  onEditarProducto,
  onIrAPestana,
}) {
  const { chartData, totalRevenue, pendingOrdersCount } = useMemo(
    () => buildDashboardMetrics(pedidos),
    [pedidos]
  );

  const inventario = useMemo(() => {
    let agotados = 0;
    let valor = 0;
    const bajos = [];

    for (const producto of productos) {
      const stock = Number(producto.stock) || 0;
      valor += (Number(producto.price1) || 0) * stock;
      if (stock <= 0) agotados += 1;
      if (stock <= 5) bajos.push(producto);
    }

    return {
      agotados,
      valor,
      bajos: [...bajos].sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0)).slice(0, 8),
    };
  }, [productos]);

  const porEstado = useMemo(() => {
    const conteo = new Map(ESTADOS_PEDIDO.map((estado) => [estado, 0]));
    for (const pedido of pedidos) {
      conteo.set(pedido.status, (conteo.get(pedido.status) || 0) + 1);
    }
    return ESTADOS_PEDIDO.map((estado) => ({ name: estado, pedidos: conteo.get(estado) || 0 }));
  }, [pedidos]);

  const masVendidos = useMemo(() => {
    const acumulado = new Map();

    for (const pedido of pedidos) {
      if (pedido.status === 'Cancelado') continue;
      for (const articulo of pedido.order_items || []) {
        const clave = String(articulo.product_id ?? articulo.product_name);
        const previo = acumulado.get(clave) || { nombre: articulo.product_name, unidades: 0, importe: 0 };
        const cantidad = Number(articulo.quantity) || 0;
        acumulado.set(clave, {
          nombre: articulo.product_name || previo.nombre,
          unidades: previo.unidades + cantidad,
          importe: previo.importe + cantidad * (Number(articulo.price_at_purchase) || 0),
        });
      }
    }

    return [...acumulado.values()].sort((a, b) => b.unidades - a.unidades).slice(0, 5);
  }, [pedidos]);

  const ultimos = useMemo(() => pedidos.slice(0, 5), [pedidos]);

  const reduced = useReducedMotion();
  const facturados = pedidos.filter((pedido) => pedido.status !== 'Cancelado').length;
  const ticketPromedio = facturados > 0 ? totalRevenue / facturados : 0;
  const hayVentas = chartData.length > 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="titulo-seccion font-extrabold uppercase tracking-widest">Dashboard General</h1>
        <p className="mt-1 text-sm text-gray-400">Monitoreo de ventas, inventario y estado de la tienda.</p>
      </header>

      {errorPedidos && (
        <p
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
          <span>
            No se pudieron leer los pedidos: {errorPedidos}
            <br />
            <span className="text-xs text-red-400/80">
              Las cifras de venta se muestran en cero hasta que se resuelva.
            </span>
          </span>
        </p>
      )}

      {/* ------------------------------------------------------- métricas ----
          Las tarjetas son `h3`: cuelgan del `h2` de esta sección, que va antes
          de los `h2` de las gráficas para no romper la jerarquía del `h1`. */}
      <section aria-labelledby="titulo-metricas">
        <h2 id="titulo-metricas" className="sr-only">
          Indicadores del negocio
        </h2>

        <motion.div
          variants={resolveVariants(staggerContainer(0.05), reduced)}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <Metrica
            reduced={reduced}
            icono={DollarSign}
            titulo="Ingresos acumulados"
            valor={totalRevenue}
            formato={formatPrice}
            pie="Pedidos no cancelados"
          />
          <Metrica
            reduced={reduced}
            icono={ClipboardList}
            titulo="Pedidos"
            valor={pedidos.length}
            formato={enteros}
            pie={`${facturados} facturables`}
          />
          <Metrica
            reduced={reduced}
            icono={Truck}
            titulo="Pendientes de envío"
            valor={pendingOrdersCount}
            formato={enteros}
            tono={pendingOrdersCount > 0 ? 'text-brand-500' : 'text-white'}
            pie="Pago pendiente o en proceso"
          />
          <Metrica
            reduced={reduced}
            icono={Receipt}
            titulo="Ticket promedio"
            valor={ticketPromedio}
            formato={formatPrice}
            pie="Por pedido facturable"
          />
          <Metrica
            reduced={reduced}
            icono={Boxes}
            titulo="Productos"
            valor={productos.length}
            formato={enteros}
            pie="En el catálogo"
          />
          <Metrica
            reduced={reduced}
            icono={PackageX}
            titulo="Agotados"
            valor={inventario.agotados}
            formato={enteros}
            tono={inventario.agotados > 0 ? 'text-red-500' : 'text-white'}
            pie="Sin unidades disponibles"
          />
          <Metrica
            reduced={reduced}
            icono={Warehouse}
            titulo="Valor del inventario"
            valor={inventario.valor}
            formato={formatPrice}
            pie="Precio público × existencias"
          />
          <Metrica
            reduced={reduced}
            icono={AlertTriangle}
            titulo="Stock bajo"
            valor={inventario.bajos.length}
            formato={enteros}
            tono={inventario.bajos.length > 0 ? 'text-amber-400' : 'text-white'}
            pie="5 unidades o menos"
          />
        </motion.div>
      </section>

      {/* --------------------------------------------------------- gráficas -- */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="superficie rounded-xl p-5">
          <h2 className="mb-6 text-sm font-bold uppercase tracking-widest text-gray-300">Ingresos por mes</h2>

          {cargandoPedidos ? (
            <Skeleton className="h-72 w-full" />
          ) : hayVentas ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} />
                  <YAxis stroke="#888" fontSize={12} tickFormatter={(valor) => `$${Math.round(valor / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: 8 }}
                    formatter={(valor) => formatPrice(valor)}
                  />
                  <Line type="monotone" dataKey="ventas" stroke="#ea580c" strokeWidth={3} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-72 flex-col items-center justify-center gap-2 text-gray-400">
              <TrendingUp size={40} className="opacity-30" aria-hidden="true" />
              <p className="text-sm font-bold uppercase tracking-widest">Sin ventas registradas todavía</p>
            </div>
          )}
        </section>

        <section className="superficie rounded-xl p-5">
          <h2 className="mb-6 text-sm font-bold uppercase tracking-widest text-gray-300">Pedidos por estado</h2>

          {cargandoPedidos ? (
            <Skeleton className="h-72 w-full" />
          ) : pedidos.length === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center gap-2 text-gray-400">
              <ClipboardList size={40} className="opacity-30" aria-hidden="true" />
              <p className="text-sm font-bold uppercase tracking-widest">Todavía no hay pedidos</p>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porEstado} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis dataKey="name" stroke="#888" fontSize={10} interval={0} tickMargin={8} />
                  <YAxis stroke="#888" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(234,88,12,0.08)' }}
                    contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: 8 }}
                  />
                  <Bar dataKey="pedidos" radius={[4, 4, 0, 0]}>
                    {porEstado.map((entrada) => (
                      <Cell key={entrada.name} fill={COLOR_ESTADO[entrada.name] || '#ea580c'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* ----------------------------------------------------------- listas -- */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Stock bajo */}
        <Reveal as="section" index={0} className="superficie rounded-xl p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-300">
            <AlertTriangle size={15} className="text-amber-400" aria-hidden="true" /> Stock bajo
          </h2>

          {cargandoProductos ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : inventario.bajos.length === 0 ? (
            <p className="py-6 text-center text-xs uppercase tracking-widest text-gray-400">
              Todo el catálogo tiene existencias
            </p>
          ) : (
            <ul className="space-y-2">
              {inventario.bajos.map((producto) => (
                <li key={producto.id}>
                  <button
                    type="button"
                    onClick={() => onEditarProducto?.(producto)}
                    className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-sm border border-gray-800 px-3 py-2 text-left transition-colors hover:border-brand-600/60 hover:bg-carbon-700"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-white">{producto.name}</span>
                      <span className="block text-[10px] uppercase tracking-wider text-gray-400">
                        {producto.brand}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded px-2 py-1 text-[10px] font-black ${
                        Number(producto.stock) <= 0
                          ? 'bg-red-950 text-red-400'
                          : 'bg-amber-950/60 text-amber-400'
                      }`}
                    >
                      {Number(producto.stock) || 0} u.
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Reveal>

        {/* Últimos pedidos */}
        <Reveal as="section" index={1} className="superficie rounded-xl p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-300">
            <ClipboardList size={15} className="text-brand-500" aria-hidden="true" /> Últimos pedidos
          </h2>

          {cargandoPedidos ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : ultimos.length === 0 ? (
            <p className="py-6 text-center text-xs uppercase tracking-widest text-gray-400">
              Sin pedidos registrados
            </p>
          ) : (
            <ul className="space-y-2">
              {ultimos.map((pedido) => (
                <li
                  key={pedido.id}
                  className="flex items-center justify-between gap-3 rounded-sm border border-gray-800 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-white">
                      {pedido.shipping_info?.fullName || 'Cliente'}
                    </span>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400">
                      {pedido.payment_info?.concepto || 'sin concepto'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xs font-black text-white">{formatPrice(pedido.total)}</span>
                    <span className="block text-[10px] font-bold uppercase text-brand-500">{pedido.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {ultimos.length > 0 && (
            <button
              type="button"
              onClick={() => onIrAPestana?.('pedidos')}
              className="mt-4 w-full rounded-sm border border-gray-800 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-gray-600 hover:text-white"
            >
              Ver todos los pedidos
            </button>
          )}
        </Reveal>

        {/* Más vendidos */}
        <Reveal as="section" index={2} className="superficie rounded-xl p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-300">
            <Flame size={15} className="text-brand-500" aria-hidden="true" /> Más vendidos
          </h2>

          {cargandoPedidos ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : masVendidos.length === 0 ? (
            <p className="py-6 text-center text-xs uppercase tracking-widest text-gray-400">
              Aún no hay unidades vendidas
            </p>
          ) : (
            <ol className="space-y-2">
              {masVendidos.map((articulo, posicion) => (
                <li
                  key={articulo.nombre}
                  className="flex items-center gap-3 rounded-sm border border-gray-800 px-3 py-2"
                >
                  <span className="w-5 shrink-0 text-center text-sm font-black text-brand-500">{posicion + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-white">{articulo.nombre}</span>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400">
                      {formatPrice(articulo.importe)}
                    </span>
                  </span>
                  <span className="shrink-0 rounded bg-carbon-700 px-2 py-1 text-[10px] font-black text-gray-300">
                    {articulo.unidades} u.
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Reveal>
      </div>
    </div>
  );
}
