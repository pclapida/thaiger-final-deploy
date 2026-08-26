import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Package, DollarSign, TrendingUp, Edit, Trash2, Plus, Search, Activity,
  ClipboardList, ImageIcon, AlertTriangle, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { products as productsApi, orders as ordersApi, IS_LOCAL_MODE } from '../services/api';
import { formatPrice, applyDiscount } from '../lib/pricing';
import { buildDashboardMetrics, ESTADOS_PEDIDO } from '../lib/metrics';
import ProductFormModal from '../components/ProductFormModal';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [allOrders, setAllOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState(null);

  // Modal de alta/edición (el formulario vive en ProductFormModal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // ------------------------------------------------------------------ carga

  const loadProducts = useCallback(() => {
    setLoadingProducts(true);
    return productsApi
      .list()
      .then(setProducts)
      .catch((error) => {
        console.error('No se pudo cargar el inventario:', error);
        toast.error('No se pudo cargar el inventario.');
      })
      .finally(() => setLoadingProducts(false));
  }, []);

  const loadOrders = useCallback(() => {
    setLoadingOrders(true);
    setOrdersError(null);
    return ordersApi
      .listAll()
      .then(setAllOrders)
      .catch((error) => {
        console.error('No se pudieron cargar los pedidos:', error);
        setOrdersError(error.message);
        setAllOrders([]);
      })
      .finally(() => setLoadingOrders(false));
  }, []);

  useEffect(() => {
    loadProducts();
    loadOrders();
  }, [loadProducts, loadOrders]);

  const { chartData, totalRevenue, pendingOrdersCount } = useMemo(
    () => buildDashboardMetrics(allOrders),
    [allOrders]
  );

  const knownBrands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(),
    [products]
  );
  const knownCategories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );

  const outOfStockCount = useMemo(
    () => products.filter((p) => Number(p.stock) <= 0).length,
    [products]
  );

  // ----------------------------------------------------------------- pedidos

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const previous = allOrders;
    setAllOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));

    try {
      await ordersApi.updateStatus(orderId, newStatus);
      toast.success('Estatus actualizado');
    } catch (error) {
      setAllOrders(previous);
      toast.error(`No se pudo actualizar: ${error.message}`);
    }
  };

  // --------------------------------------------------------------- productos

  const handleAddNew = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;

    try {
      await productsApi.remove(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success('Producto eliminado');
    } catch (error) {
      toast.error(`No se pudo eliminar: ${error.message}`);
    }
  };

  const handleToggleSale = async (product) => {
    const nextValue = !product.is_on_sale;
    const discount = nextValue && !(product.discount_percent > 0) ? 15 : product.discount_percent;
    const patch = { is_on_sale: nextValue, discount_percent: discount };

    const previous = products;
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...patch } : p)));

    try {
      await productsApi.update(product.id, patch);
      toast.success(nextValue ? `Producto en oferta (${discount}%)` : 'Oferta retirada');
    } catch (error) {
      setProducts(previous);
      toast.error(`No se pudo actualizar la oferta: ${error.message}`);
    }
  };

  const handleSave = async (payload) => {
    setIsSaving(true);
    try {
      if (editingProduct) {
        const updated = await productsApi.update(editingProduct.id, payload);
        setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? { ...p, ...updated } : p)));
        toast.success('Producto actualizado');
      } else {
        const created = await productsApi.create(payload);
        setProducts((prev) => [created, ...prev]);
        toast.success('Producto creado');
      }
      setIsModalOpen(false);
    } catch (error) {
      toast.error(`No se pudo guardar: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      [p.name, p.brand, p.category].some((field) => field?.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  const tabButton = (id, Icon, label) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm font-bold uppercase text-xs tracking-widest transition-colors ${
        activeTab === id ? 'bg-orange-600 text-white' : 'text-gray-400 hover:bg-gray-900 hover:text-white'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="bg-[#0A0A0A] min-h-screen text-white font-sans">
      <Navbar />

      <div className="flex pt-20 min-h-screen">
        {/* === SIDEBAR === */}
        <aside className="w-64 bg-[#111] border-r border-gray-800 p-6 hidden lg:block sticky top-20 h-[calc(100vh-5rem)]">
          <div className="mb-8">
            <h2 className="text-orange-500 font-extrabold text-xl uppercase tracking-widest flex items-center gap-2">
              <Activity /> Admin
            </h2>
            <p className="text-gray-500 text-xs mt-1">Thaiger Supplements</p>
          </div>

          <nav className="space-y-2">
            {tabButton('overview', TrendingUp, 'Resumen')}
            {tabButton('products', Package, 'Productos')}
            {tabButton('orders', ClipboardList, 'Pedidos')}
          </nav>

          {IS_LOCAL_MODE && (
            <div className="mt-8 bg-orange-500/10 border border-orange-500/30 rounded p-3">
              <p className="text-[10px] uppercase font-bold text-orange-500 tracking-widest mb-1">Modo local</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Los datos se guardan en este navegador. Configura Supabase en el <code>.env</code> para
                usar una base compartida.
              </p>
            </div>
          )}
        </aside>

        {/* === CONTENIDO === */}
        <main className="flex-1 p-6 lg:p-10">
          {/* Selector de pestañas en móvil */}
          <div className="grid grid-cols-3 gap-2 mb-8 lg:hidden">
            {tabButton('overview', TrendingUp, 'Resumen')}
            {tabButton('products', Package, 'Productos')}
            {tabButton('orders', ClipboardList, 'Pedidos')}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-extrabold uppercase tracking-widest">Dashboard General</h1>
                <p className="text-gray-400 text-sm">Monitoreo de ventas y estado de la tienda.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#111] p-6 rounded-xl border border-gray-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <DollarSign size={80} />
                  </div>
                  <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-2">Ingresos Acumulados</h3>
                  <p className="text-3xl font-black text-white">{formatPrice(totalRevenue)}</p>
                  <p className="text-green-500 text-xs font-bold mt-2">Pedidos no cancelados</p>
                </div>

                <div className="bg-[#111] p-6 rounded-xl border border-gray-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <ClipboardList size={80} />
                  </div>
                  <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-2">Órdenes Históricas</h3>
                  <p className="text-3xl font-black text-white">{allOrders.length}</p>
                  <p className="text-orange-500 text-xs font-bold mt-2">{pendingOrdersCount} pendientes de envío</p>
                </div>

                <div className="bg-[#111] p-6 rounded-xl border border-gray-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Package size={80} />
                  </div>
                  <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-2">Inventario Total</h3>
                  <p className="text-3xl font-black text-white">{products.length}</p>
                  <p className={`text-xs font-bold mt-2 ${outOfStockCount > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                    {outOfStockCount} productos agotados
                  </p>
                </div>
              </div>

              <div className="bg-[#111] p-6 rounded-xl border border-gray-800">
                <h3 className="text-lg font-bold uppercase tracking-widest mb-6">Ingresos Históricos</h3>
                {chartData.length === 0 ? (
                  <div className="h-80 flex flex-col items-center justify-center text-gray-500 gap-2">
                    <TrendingUp size={40} className="opacity-30" />
                    <p className="uppercase tracking-widest text-sm font-bold">Sin ventas registradas todavía</p>
                  </div>
                ) : (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="name" stroke="#888" />
                        <YAxis stroke="#888" tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#000', borderColor: '#333' }}
                          formatter={(value) => formatPrice(value)}
                        />
                        <Line type="monotone" dataKey="ventas" stroke="#ea580c" strokeWidth={3} activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h1 className="text-3xl font-extrabold uppercase tracking-widest text-orange-500">
                    Gestor de Inventario
                  </h1>
                  <p className="text-gray-400 text-sm">
                    Añade productos manualmente con su foto, precios y stock.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={loadProducts}
                    className="border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 font-bold py-3 px-4 rounded-sm uppercase tracking-widest flex items-center gap-2 transition-colors text-xs"
                  >
                    <RefreshCw size={16} /> Recargar
                  </button>
                  <button
                    onClick={handleAddNew}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-sm uppercase tracking-widest flex items-center gap-2 transition-transform active:scale-95 text-xs shadow-lg shadow-orange-500/20"
                  >
                    <Plus size={16} /> Añadir Producto
                  </button>
                </div>
              </div>

              <div className="bg-[#111] p-4 rounded-t-xl border border-gray-800 border-b-0 flex items-center gap-3">
                <Search className="text-gray-500 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, marca o categoría..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none text-white focus:outline-none w-full text-sm placeholder-gray-600"
                />
                <span className="text-xs text-gray-600 whitespace-nowrap">{`${filteredProducts.length} resultados`}</span>
              </div>

              <div className="bg-[#111] border border-gray-800 rounded-b-xl overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                  <thead className="text-xs uppercase bg-gray-900 text-gray-300 font-bold tracking-widest">
                    <tr>
                      <th className="px-4 py-4">Foto</th>
                      <th className="px-4 py-4">Producto</th>
                      <th className="px-4 py-4 hidden md:table-cell">Marca</th>
                      <th className="px-4 py-4 hidden sm:table-cell">Categoría</th>
                      <th className="px-4 py-4">Precio</th>
                      <th className="px-4 py-4 hidden lg:table-cell">Stock</th>
                      <th className="px-4 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingProducts && (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-gray-500 uppercase tracking-widest font-bold">
                          Cargando inventario...
                        </td>
                      </tr>
                    )}

                    {!loadingProducts &&
                      filteredProducts.map((p) => (
                        <tr key={p.id} className="border-b border-gray-800 hover:bg-black/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="w-12 h-12 bg-white rounded flex items-center justify-center overflow-hidden">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.name} className="w-full h-full object-contain" />
                              ) : (
                                <ImageIcon size={18} className="text-gray-400" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-white max-w-[220px]">
                            <span className="block truncate" title={p.name}>{p.name}</span>
                            <span className="text-[10px] text-gray-600 font-mono">#{p.id}</span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">{p.brand}</td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-[10px] uppercase font-bold border border-gray-700">
                              {p.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-orange-500 whitespace-nowrap">
                            {formatPrice(applyDiscount(p.price1, p))}
                            {p.is_on_sale && p.discount_percent > 0 && (
                              <span className="block text-[10px] text-gray-500 line-through font-normal">
                                {formatPrice(p.price1)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span
                              className={`font-bold text-sm ${
                                Number(p.stock) <= 0
                                  ? 'text-red-500'
                                  : Number(p.stock) <= 5
                                    ? 'text-yellow-500'
                                    : 'text-green-500'
                              }`}
                            >
                              {p.stock ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleSale(p)}
                                className={`text-[9px] px-2 py-1.5 rounded font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                                  p.is_on_sale
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'
                                }`}
                                title="Activar o desactivar la oferta"
                              >
                                {p.is_on_sale ? `-${p.discount_percent}%` : 'Sin oferta'}
                              </button>
                              <button
                                onClick={() => handleEdit(p)}
                                className="text-blue-500 hover:text-blue-400 p-2 bg-blue-500/10 rounded transition-colors"
                                title="Editar"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(p)}
                                className="text-red-500 hover:text-red-400 p-2 bg-red-500/10 rounded transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                    {!loadingProducts && filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-gray-500">
                          No se encontraron productos coincidentes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-extrabold uppercase tracking-widest text-orange-500">Gestor de Pedidos</h1>
                  <p className="text-gray-400 text-sm">Administra y despacha las compras de tus clientes.</p>
                </div>
                <button
                  onClick={loadOrders}
                  className="border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 font-bold py-3 px-4 rounded-sm uppercase tracking-widest flex items-center gap-2 transition-colors text-xs"
                >
                  <RefreshCw size={16} /> Recargar
                </button>
              </div>

              <div className="bg-[#111] border border-gray-800 rounded-xl overflow-x-auto p-4">
                {loadingOrders ? (
                  <p className="text-gray-500 text-center py-10 font-bold uppercase tracking-widest">
                    Cargando pedidos...
                  </p>
                ) : ordersError ? (
                  <div className="text-center py-10 flex flex-col items-center gap-3">
                    <AlertTriangle className="text-red-500" size={32} />
                    <p className="text-red-400 font-bold uppercase tracking-widest text-sm">
                      No se pudieron leer los pedidos
                    </p>
                    <p className="text-gray-500 text-xs max-w-md">{ordersError}</p>
                  </div>
                ) : allOrders.length === 0 ? (
                  <p className="text-gray-500 text-center py-10 uppercase tracking-widest font-bold">
                    No hay pedidos registrados.
                  </p>
                ) : (
                  <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-xs uppercase bg-gray-900 text-gray-300 font-bold tracking-widest">
                      <tr>
                        <th className="px-4 py-4">ID / Concepto</th>
                        <th className="px-4 py-4">Cliente</th>
                        <th className="px-4 py-4">Monto</th>
                        <th className="px-4 py-4">Artículos</th>
                        <th className="px-4 py-4">Estatus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allOrders.map((order) => (
                        <tr key={order.id} className="border-b border-gray-800 hover:bg-gray-900 transition-colors">
                          <td className="px-4 py-4">
                            <p className="text-white font-bold" title={order.id}>
                              TH-{String(order.id).split('-')[0].toUpperCase()}
                            </p>
                            <p className="text-xs text-orange-500 font-mono tracking-widest bg-orange-500/10 inline-block px-1 mt-1 rounded">
                              {order.payment_info?.concepto || 'SIN CONCEPTO'}
                            </p>
                            <p className="text-[10px] text-gray-600 mt-1">
                              {order.created_at ? new Date(order.created_at).toLocaleDateString('es-MX') : ''}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-bold text-gray-300">{order.shipping_info?.fullName || 'Desconocido'}</p>
                            <p className="text-[10px] uppercase">
                              {order.shipping_info?.city} - {order.shipping_info?.zip}
                            </p>
                            <p className="text-[10px] text-gray-600">{order.shipping_info?.phone}</p>
                          </td>
                          <td className="px-4 py-4 font-extrabold text-white whitespace-nowrap">
                            {formatPrice(order.total)}
                          </td>
                          <td className="px-4 py-4">
                            <span className="bg-gray-800 px-2 py-1 rounded text-xs font-bold">
                              {order.order_items?.length || 0}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <select
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                              className={`text-[10px] uppercase font-bold p-2 tracking-wider rounded-sm focus:outline-none cursor-pointer ${
                                order.status === 'Entregado'
                                  ? 'bg-green-900 text-green-400 border border-green-700'
                                  : order.status === 'Cancelado'
                                    ? 'bg-red-900 text-red-400 border border-red-700'
                                    : 'bg-orange-600 text-white border border-transparent'
                              }`}
                            >
                              {ESTADOS_PEDIDO.map((estado) => (
                                <option key={estado} value={estado}>
                                  {estado}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {isModalOpen && (
        <ProductFormModal
          product={editingProduct}
          brands={knownBrands}
          categories={knownCategories}
          isSaving={isSaving}
          onUploadImage={productsApi.uploadImage}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
