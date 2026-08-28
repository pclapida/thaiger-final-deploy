import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ClipboardList,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { orders as pedidosApi } from '../../services/api';
import { formatPrice } from '../../lib/pricing';
import { ESTADOS_PEDIDO } from '../../lib/metrics';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import { SkeletonRows } from '../ui/Skeleton';
import { inputClasses } from '../ui/Field';

const BOTON_SECUNDARIO =
  'flex min-h-[44px] items-center justify-center gap-2 rounded-sm border border-gray-800 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-40';

/**
 * Acción de una fila (sólo icono). El icono mide 16px, así que sin una medida
 * explícita el botón se queda en 32×32: por debajo del mínimo táctil de 44.
 * La misma constante existe en los demás paneles con listas.
 */
const BOTON_ICONO = 'grid h-11 w-11 shrink-0 place-items-center rounded transition-colors';

/** Colores del selector de estatus, dentro de la paleta del sitio. */
function tonoEstado(estado) {
  if (estado === 'Entregado') return 'border-green-700 bg-green-950 text-green-400';
  if (estado === 'Cancelado') return 'border-gray-700 bg-carbon-700 text-gray-400';
  if (estado === 'Enviado') return 'border-transparent bg-brand-700 text-white';
  return 'border-transparent bg-brand-600 text-white';
}

/** Referencia corta y legible del pedido (el id completo es un UUID). */
function referencia(id) {
  return `TH-${String(id).split('-')[0].toUpperCase()}`;
}

function fechaCorta(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleDateString('es-MX');
}

function fechaLarga(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleString('es-MX');
}

/** Detalle completo de un pedido. Se reutiliza en la fila y en la impresión. */
function DetallePedido({ pedido, paraImprimir = false }) {
  // En papel el fondo es blanco, así que ahí sí valen los grises oscuros.
  const tonoTexto = paraImprimir ? 'text-black' : 'text-gray-300';
  const tonoTenue = paraImprimir ? 'text-gray-700' : 'text-gray-400';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h3 className={`mb-2 text-[11px] font-bold uppercase tracking-widest ${tonoTenue}`}>Artículos</h3>

        {/* Cuatro columnas no caben en el ancho de la tarjeta móvil: la tabla
            se desplaza dentro de su caja en vez de desbordar la página. */}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[20rem] text-left text-xs">
            <thead>
              <tr className={tonoTenue}>
                <th scope="col" className="py-1 font-bold uppercase">
                  Producto
                </th>
                <th scope="col" className="py-1 text-center font-bold uppercase">
                  Cant.
                </th>
                <th scope="col" className="py-1 text-right font-bold uppercase">
                  Unitario
                </th>
                <th scope="col" className="py-1 text-right font-bold uppercase">
                  Importe
                </th>
              </tr>
            </thead>
            <tbody>
              {(pedido.order_items || []).map((articulo) => (
                <tr key={articulo.id || `${articulo.product_id}-${articulo.quantity}`} className={tonoTexto}>
                  <td className="py-1 pr-2">{articulo.product_name}</td>
                  <td className="py-1 text-center">{articulo.quantity}</td>
                  <td className="py-1 text-right">{formatPrice(articulo.price_at_purchase)}</td>
                  <td className="py-1 text-right font-bold">
                    {formatPrice((Number(articulo.price_at_purchase) || 0) * (Number(articulo.quantity) || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className={`mt-4 space-y-1 text-xs ${tonoTexto}`}>
          <div className="flex justify-between">
            <dt className={tonoTenue}>Subtotal</dt>
            <dd>{formatPrice(pedido.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className={tonoTenue}>Envío</dt>
            <dd>{Number(pedido.shipping_cost) > 0 ? formatPrice(pedido.shipping_cost) : 'Gratis'}</dd>
          </div>
          <div className="flex justify-between font-black">
            <dt>Total</dt>
            <dd>{formatPrice(pedido.total)}</dd>
          </div>
          {pedido.tier > 1 && (
            <div className="flex justify-between">
              <dt className={tonoTenue}>Nivel de precios</dt>
              <dd>Nivel {pedido.tier}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className={`mb-1 text-[11px] font-bold uppercase tracking-widest ${tonoTenue}`}>Envío</h3>
          <address className={`text-xs not-italic leading-relaxed ${tonoTexto}`}>
            {pedido.shipping_info?.fullName}
            <br />
            {pedido.shipping_info?.address}
            <br />
            {pedido.shipping_info?.city} · C.P. {pedido.shipping_info?.zip}
            <br />
            Tel. {pedido.shipping_info?.phone}
            {pedido.shipping_info?.notes && (
              <>
                <br />
                <span className={tonoTenue}>Notas: {pedido.shipping_info.notes}</span>
              </>
            )}
          </address>
        </div>

        <div>
          <h3 className={`mb-1 text-[11px] font-bold uppercase tracking-widest ${tonoTenue}`}>Pago</h3>
          <p className={`text-xs leading-relaxed ${tonoTexto}`}>
            {pedido.payment_info?.method || 'SPEI'}
            {pedido.payment_info?.banco ? ` · ${pedido.payment_info.banco}` : ''}
            <br />
            Concepto: <span className="font-mono font-bold">{pedido.payment_info?.concepto || '—'}</span>
            <br />
            <span className={tonoTenue}>{fechaLarga(pedido.created_at)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Gestor de pedidos: filtros por estado, texto y fechas, detalle desplegable,
 * cambio de estatus, borrado e impresión de la hoja del pedido.
 */
export default function PanelPedidos({
  pedidos = [],
  cargando = false,
  error = null,
  onRecargar,
  onCambiarPedidos,
}) {
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [texto, setTexto] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [expandido, setExpandido] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [aImprimir, setAImprimir] = useState(null);

  // La impresión se lanza cuando la hoja ya está en pantalla.
  useEffect(() => {
    if (!aImprimir) return undefined;

    const alTerminar = () => setAImprimir(null);
    window.addEventListener('afterprint', alTerminar);

    try {
      window.print?.();
    } catch {
      /* algunos navegadores integrados no permiten imprimir */
    }

    return () => window.removeEventListener('afterprint', alTerminar);
  }, [aImprimir]);

  const filtrados = useMemo(() => {
    const termino = texto.trim().toLowerCase();

    return pedidos.filter((pedido) => {
      if (filtroEstado !== 'todos' && pedido.status !== filtroEstado) return false;

      if (termino) {
        const campos = [
          pedido.shipping_info?.fullName,
          pedido.shipping_info?.city,
          pedido.payment_info?.concepto,
          pedido.id,
          referencia(pedido.id),
        ];
        if (!campos.some((campo) => String(campo || '').toLowerCase().includes(termino))) return false;
      }

      const dia = String(pedido.created_at || '').slice(0, 10);
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;

      return true;
    });
  }, [pedidos, filtroEstado, texto, desde, hasta]);

  const totales = useMemo(() => {
    let ingresos = 0;
    let articulos = 0;

    for (const pedido of filtrados) {
      if (pedido.status !== 'Cancelado') ingresos += Number(pedido.total) || 0;
      for (const articulo of pedido.order_items || []) articulos += Number(articulo.quantity) || 0;
    }

    return { ingresos, articulos, pedidos: filtrados.length };
  }, [filtrados]);

  const hayFiltros = filtroEstado !== 'todos' || Boolean(texto) || Boolean(desde) || Boolean(hasta);

  const limpiarFiltros = () => {
    setFiltroEstado('todos');
    setTexto('');
    setDesde('');
    setHasta('');
  };

  const cambiarEstado = async (pedido, estado) => {
    // Optimista: el selector responde al momento y se revierte si falla.
    onCambiarPedidos?.((previos) =>
      previos.map((actual) => (actual.id === pedido.id ? { ...actual, status: estado } : actual))
    );

    try {
      await pedidosApi.updateStatus(pedido.id, estado);
      toast.success(`Pedido ${referencia(pedido.id)}: ${estado}`);
    } catch (fallo) {
      onCambiarPedidos?.((previos) =>
        previos.map((actual) => (actual.id === pedido.id ? { ...actual, status: pedido.status } : actual))
      );
      toast.error(`No se pudo actualizar: ${fallo.message}`);
    }
  };

  const pedirBorrado = (pedido) => {
    setConfirmacion({
      titulo: 'Eliminar pedido',
      mensaje: `Se eliminará el pedido ${referencia(pedido.id)} de ${
        pedido.shipping_info?.fullName || 'un cliente'
      } por ${formatPrice(pedido.total)}. Esta acción no se puede deshacer.`,
      accion: async () => {
        await pedidosApi.remove(pedido.id);
        onCambiarPedidos?.((previos) => previos.filter((actual) => actual.id !== pedido.id));
        toast.success('Pedido eliminado');
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

  return (
    <div className="space-y-6">
      <div className={aImprimir ? 'no-imprimir space-y-6' : 'space-y-6'}>
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="titulo-seccion font-extrabold uppercase tracking-widest text-brand-500">
              Gestor de Pedidos
            </h1>
            <p className="mt-1 text-sm text-gray-400">Consulta, despacha e imprime las compras de tus clientes.</p>
          </div>

          <button type="button" onClick={() => onRecargar?.()} className={BOTON_SECUNDARIO}>
            <RefreshCw size={16} aria-hidden="true" /> Recargar
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-xl border border-red-900/50 bg-red-950/30 p-8 text-center"
          >
            <AlertTriangle className="text-red-500" size={32} aria-hidden="true" />
            <p className="text-sm font-bold uppercase tracking-widest text-red-400">
              No se pudieron leer los pedidos
            </p>
            <p className="max-w-md text-xs text-gray-400">{error}</p>
            <button type="button" onClick={() => onRecargar?.()} className={BOTON_SECUNDARIO}>
              <RefreshCw size={14} aria-hidden="true" /> Reintentar
            </button>
          </div>
        )}

        {!error && (
          <>
            {/* ------------------------------------------------------ filtros */}
            <section className="superficie space-y-4 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Buscar pedidos"
                  placeholder="Buscar por cliente, concepto o referencia..."
                  value={texto}
                  onChange={(evento) => setTexto(evento.target.value)}
                  className="w-full border-none bg-transparent text-base text-white placeholder-gray-400 focus:outline-none sm:text-sm"
                />
                <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">
                  {filtrados.length} pedidos
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <select
                  aria-label="Filtrar por estatus"
                  value={filtroEstado}
                  onChange={(evento) => setFiltroEstado(evento.target.value)}
                  className={inputClasses({ extra: 'min-h-[44px]' })}
                >
                  <option value="todos">Todos los estatus</option>
                  {ESTADOS_PEDIDO.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Desde
                  <input
                    type="date"
                    value={desde}
                    onChange={(evento) => setDesde(evento.target.value)}
                    className={inputClasses({ extra: 'min-h-[44px] flex-1' })}
                  />
                </label>

                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Hasta
                  <input
                    type="date"
                    value={hasta}
                    onChange={(evento) => setHasta(evento.target.value)}
                    className={inputClasses({ extra: 'min-h-[44px] flex-1' })}
                  />
                </label>
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

            {/* ------------------------------------------ totales del periodo */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { titulo: 'Pedidos del periodo', valor: String(totales.pedidos) },
                { titulo: 'Ingresos del periodo', valor: formatPrice(totales.ingresos) },
                { titulo: 'Artículos vendidos', valor: String(totales.articulos) },
              ].map((dato) => (
                <div key={dato.titulo} className="superficie rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{dato.titulo}</p>
                  <p className="mt-1 text-2xl font-black text-white">{dato.valor}</p>
                </div>
              ))}
            </section>

            {/* -------------------------------------------------------- lista */}
            {cargando ? (
              <div className="superficie rounded-xl">
                <SkeletonRows rows={6} columns={5} />
              </div>
            ) : pedidos.length === 0 ? (
              <EmptyState
                as="h2"
                icon={ClipboardList}
                title="Todavía no hay pedidos"
                message="Cuando alguien complete una compra, aparecerá aquí con su concepto de pago."
              />
            ) : filtrados.length === 0 ? (
              <EmptyState
                as="h2"
                icon={Search}
                title="Ningún pedido coincide"
                message="Cambia el estatus, el texto o el rango de fechas."
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
                          Pedido
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Cliente
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Monto
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Artículos
                        </th>
                        <th scope="col" className="px-4 py-3">
                          Estatus
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          Acciones
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtrados.map((pedido) => {
                        const abierto = expandido === pedido.id;

                        return (
                          <React.Fragment key={pedido.id}>
                            <tr className="border-b border-gray-800 transition-colors hover:bg-black/40">
                              <td className="px-4 py-4">
                                <p className="font-bold text-white" title={pedido.id}>
                                  {referencia(pedido.id)}
                                </p>
                                <p className="mt-1 inline-block rounded bg-brand-600/10 px-1 font-mono text-xs tracking-widest text-brand-500">
                                  {pedido.payment_info?.concepto || 'SIN CONCEPTO'}
                                </p>
                                <p className="mt-1 text-[10px] text-gray-400">{fechaCorta(pedido.created_at)}</p>
                              </td>

                              <td className="px-4 py-4">
                                <p className="font-bold text-gray-300">
                                  {pedido.shipping_info?.fullName || 'Desconocido'}
                                </p>
                                <p className="text-[10px] uppercase">
                                  {pedido.shipping_info?.city} · {pedido.shipping_info?.zip}
                                </p>
                                <p className="text-[10px] text-gray-400">{pedido.shipping_info?.phone}</p>
                              </td>

                              <td className="whitespace-nowrap px-4 py-4 font-extrabold text-white">
                                {formatPrice(pedido.total)}
                              </td>

                              <td className="px-4 py-4">
                                <span className="rounded bg-carbon-700 px-2 py-1 text-xs font-bold">
                                  {pedido.order_items?.length || 0}
                                </span>
                              </td>

                              <td className="px-4 py-4">
                                <select
                                  aria-label={`Estatus del pedido ${referencia(pedido.id)}`}
                                  value={pedido.status}
                                  onChange={(evento) => cambiarEstado(pedido, evento.target.value)}
                                  className={`cursor-pointer rounded-sm border p-2 text-[10px] font-bold uppercase tracking-wider focus:outline-none ${tonoEstado(
                                    pedido.status
                                  )}`}
                                >
                                  {ESTADOS_PEDIDO.map((estado) => (
                                    <option key={estado} value={estado}>
                                      {estado}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className="px-4 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  {/* El nombre accesible sale del `aria-label`, que
                                      lleva la referencia de la fila; el `title` se
                                      queda sólo como ayuda visual. */}
                                  <button
                                    type="button"
                                    onClick={() => setExpandido(abierto ? null : pedido.id)}
                                    aria-expanded={abierto}
                                    aria-label={`Detalle del pedido ${referencia(pedido.id)}`}
                                    title="Ver el detalle"
                                    className="flex min-h-[44px] items-center gap-1 rounded bg-carbon-700 px-3 py-2 text-[10px] font-bold uppercase text-gray-300 hover:text-white"
                                  >
                                    Detalle
                                    <ChevronDown
                                      size={14}
                                      aria-hidden="true"
                                      className={`transition-transform ${abierto ? 'rotate-180' : ''}`}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setAImprimir(pedido)}
                                    title="Imprimir el pedido"
                                    aria-label={`Imprimir el pedido ${referencia(pedido.id)}`}
                                    className={`${BOTON_ICONO} bg-carbon-700 text-gray-300 hover:text-white`}
                                  >
                                    <Printer size={16} aria-hidden="true" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => pedirBorrado(pedido)}
                                    title="Eliminar el pedido"
                                    aria-label={`Eliminar el pedido ${referencia(pedido.id)}`}
                                    className={`${BOTON_ICONO} bg-red-500/10 text-red-500 hover:text-red-400`}
                                  >
                                    <Trash2 size={16} aria-hidden="true" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {abierto && (
                              <tr className="border-b border-gray-800 bg-black/40">
                                <td colSpan={6} className="px-4 py-5">
                                  <DetallePedido pedido={pedido} />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Móvil */}
                <ul className="space-y-3 lg:hidden">
                  {filtrados.map((pedido) => {
                    const abierto = expandido === pedido.id;

                    return (
                      <li key={pedido.id} className="superficie rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-white">{referencia(pedido.id)}</p>
                            <p className="truncate text-xs text-gray-400">
                              {pedido.shipping_info?.fullName || 'Desconocido'}
                            </p>
                            <p className="text-[10px] text-gray-400">{fechaCorta(pedido.created_at)}</p>
                          </div>
                          <p className="shrink-0 font-black text-white">{formatPrice(pedido.total)}</p>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-800 pt-3">
                          <select
                            aria-label={`Cambiar estatus de ${referencia(pedido.id)}`}
                            value={pedido.status}
                            onChange={(evento) => cambiarEstado(pedido, evento.target.value)}
                            className={`min-h-[44px] cursor-pointer rounded-sm border p-2 text-[10px] font-bold uppercase tracking-wider ${tonoEstado(
                              pedido.status
                            )}`}
                          >
                            {ESTADOS_PEDIDO.map((estado) => (
                              <option key={estado} value={estado}>
                                {estado}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => setExpandido(abierto ? null : pedido.id)}
                            aria-expanded={abierto}
                            aria-label={
                              abierto
                                ? `Ocultar el detalle de ${referencia(pedido.id)}`
                                : `Detalle del pedido ${referencia(pedido.id)}`
                            }
                            className="ml-auto min-h-[44px] rounded bg-carbon-700 px-3 py-2 text-[10px] font-bold uppercase text-gray-300"
                          >
                            {abierto ? 'Ocultar' : 'Detalle'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setAImprimir(pedido)}
                            aria-label={`Imprimir el pedido ${referencia(pedido.id)}`}
                            className={`${BOTON_ICONO} bg-carbon-700 text-gray-300`}
                          >
                            <Printer size={16} aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => pedirBorrado(pedido)}
                            aria-label={`Eliminar el pedido ${referencia(pedido.id)}`}
                            className={`${BOTON_ICONO} bg-red-500/10 text-red-500`}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>

                        {abierto && (
                          <div className="mt-4 border-t border-gray-800 pt-4">
                            <DetallePedido pedido={pedido} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      {/* --------------------------------------------------- hoja de impresión */}
      {aImprimir && (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-carbon-900 p-4 sm:p-10 print:static print:bg-white print:p-0">
          <div className="mx-auto max-w-3xl rounded-xl bg-white p-8 text-black print:rounded-none print:p-0">
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-gray-300 pb-4">
              <div>
                <p className="text-lg font-black uppercase tracking-widest">Thaiger Supplements</p>
                <p className="text-xs text-gray-700">Pedido {referencia(aImprimir.id)}</p>
              </div>
              <div className="text-right text-xs text-gray-700">
                <p>{fechaLarga(aImprimir.created_at)}</p>
                <p className="font-bold uppercase">{aImprimir.status}</p>
              </div>
            </div>

            <DetallePedido pedido={aImprimir} paraImprimir />

            <div className="no-imprimir mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAImprimir(null)}
                className="flex min-h-[44px] items-center gap-2 rounded-sm bg-carbon-900 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white"
              >
                <X size={14} aria-hidden="true" /> Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmacion)}
        title={confirmacion?.titulo}
        message={confirmacion?.mensaje}
        confirmLabel="Sí, eliminar"
        tone="danger"
        busy={trabajando}
        onConfirm={confirmar}
        onCancel={() => setConfirmacion(null)}
      />
    </div>
  );
}
