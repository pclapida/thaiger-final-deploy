import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, Users, DollarSign, TrendingUp, Edit, Trash2, Plus, X, Search, Activity, ClipboardList } from 'lucide-react';
import { formatPrice } from '../data/products';
import toast from 'react-hot-toast';
import { supabase } from '../supabase';

// Datos Falsos eliminados; ahora procesado localmente con useMemo

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
      if (data) setProducts(data);
    };
    fetchProducts();
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  // Estado para la tabla de Orders
  const [allOrders, setAllOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    // Para simplificar, obtenemos todas en el monte para cálculos del dashboard
    const fetchAllOrders = async () => {
      setLoadingOrders(true);
      const { data, error } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
      if (data && !error) setAllOrders(data);
      setLoadingOrders(false);
    };
    fetchAllOrders();
  }, []);

  // Lógica de Graficación Dinámica
  const { chartData, totalRevenue, pendingOrdersCount } = React.useMemo(() => {
      if (!allOrders.length) return { chartData: [], totalRevenue: 0, pendingOrdersCount: 0 };
      
      let revenue = 0;
      let pendingCount = 0;
      
      const salesByMonth = {};
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      
      allOrders.forEach(order => {
          if (order.status !== 'Cancelado') {
              revenue += order.total;
          }
          if (order.status === 'Pago Pendiente' || order.status === 'En Proceso') {
              pendingCount++;
          }
          // Acumulación de gráfica
          if (order.status !== 'Cancelado' && order.created_at) {
              const date = new Date(order.created_at);
              const mesAgostoEne = meses[date.getMonth()];
              if (!salesByMonth[mesAgostoEne]) salesByMonth[mesAgostoEne] = 0;
              salesByMonth[mesAgostoEne] += order.total;
          }
      });
      
      const chartMap = meses.filter(m => salesByMonth[m] !== undefined).map(mes => ({
          name: mes,
          ventas: salesByMonth[mes]
      }));

      return { chartData: chartMap, totalRevenue: revenue, pendingOrdersCount: pendingCount };
  }, [allOrders]);


  const handleUpdateOrderStatus = async (orderId, newStatus) => {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      if (!error) {
          toast.success("Estatus actualizado");
          setAllOrders(prev => prev.map(o => o.id === orderId ? {...o, status: newStatus} : o));
      } else {
          toast.error("Error al actualizar");
      }
  };
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [formData, setFormData] = useState({
    name: '', brand: '', category: '', price1: 0, price2: 0, price3: 0, image_url: '', is_on_sale: false, discount_percent: 0
  });

  // ========= CRUD OPERACIONES (SUPABASE) =========
  
  const handleDelete = async (id) => {
    if (window.confirm('¿Seguro que quieres eliminar este producto?')) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (!error) {
        setProducts(products.filter(p => p.id !== id));
        toast.success('Producto eliminado correctamente');
      } else {
        toast.error('Error al eliminar producto');
      }
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setImageFile(null);
    setFormData({
      name: product.name || '',
      brand: product.brand || '',
      category: product.category || '',
      price1: product.price1 || 0,
      price2: product.price2 || 0,
      price3: product.price3 || 0,
      image_url: product.image_url || '',
      is_on_sale: product.is_on_sale || false,
      discount_percent: product.discount_percent || 0
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingProduct(null);
    setImageFile(null);
    setFormData({ name: '', brand: '', category: '', price1: 0, price2: 0, price3: 0, image_url: '', is_on_sale: false, discount_percent: 0 });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.brand || !formData.category || !formData.price1) {
       return toast.error("Llena los campos obligatorios");
    }
    
    let uploadedImageUrl = formData.image_url;
    
    if (imageFile) {
       toast.loading("Subiendo imagen...", { id: 'uploading' });
       const fileExt = imageFile.name.split('.').pop();
       const fileName = `${Date.now()}.${fileExt}`;
       
       const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, imageFile);
       if (uploadError) {
          toast.error("Error al subir la imagen a Supabase: " + uploadError.message, { id: 'uploading' });
          return;
       }
       
       const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
       uploadedImageUrl = publicUrlData.publicUrl;
       toast.success("Imagen conectada", { id: 'uploading' });
    }
    
    const finalFormData = { ...formData, image_url: uploadedImageUrl };

    if (editingProduct) {
      const { error } = await supabase.from('products').update(finalFormData).eq('id', editingProduct.id);
      if (!error) {
        setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...finalFormData } : p));
        toast.success('Producto actualizado');
        setIsModalOpen(false);
      } else {
        toast.error('Error al actualizar el producto: ' + error.message);
      }
    } else {
      const newProduct = {
        id: Date.now(),
        ...finalFormData
      };
      const { error } = await supabase.from('products').insert([newProduct]);
      if (!error) {
        setProducts([newProduct, ...products]);
        toast.success('Producto creado exitosamente');
        setIsModalOpen(false);
      } else {
        toast.error('Error al crear el producto: ' + error.message);
      }
    }
  };

  // Filtrado superficial para la tabla
  const filteredProducts = products.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.brand?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="bg-[#0A0A0A] min-h-screen text-white font-sans">
      <Navbar />
      
      <div className="flex pt-20 min-h-screen">
        
        {/* === SIDEBAR (Admin Panel) === */}
        <aside className="w-64 bg-[#111] border-r border-gray-800 p-6 hidden lg:block sticky top-20 h-[calc(100vh-5rem)]">
          <div className="mb-8">
            <h2 className="text-orange-500 font-extrabold text-xl uppercase tracking-widest flex items-center gap-2">
              <Activity /> Admin
            </h2>
            <p className="text-gray-500 text-xs mt-1">Thaiger Supplements</p>
          </div>
          
          <nav className="space-y-2">
            <button 
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm font-bold uppercase text-xs tracking-widest transition-colors ${activeTab === 'overview' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:bg-gray-900 hover:text-white'}`}
            >
              <TrendingUp size={16} /> Resumen
            </button>
            <button 
                onClick={() => setActiveTab('products')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm font-bold uppercase text-xs tracking-widest transition-colors ${activeTab === 'products' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:bg-gray-900 hover:text-white'}`}
            >
              <Package size={16} /> Productos
            </button>
            <button 
                onClick={() => setActiveTab('orders')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm font-bold uppercase text-xs tracking-widest transition-colors ${activeTab === 'orders' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:bg-gray-900 hover:text-white'}`}
            >
              <ClipboardList size={16} /> Pedidos
            </button>
          </nav>
        </aside>

        {/* === CONTENIDO PRINCIPAL === */}
        <main className="flex-1 p-6 lg:p-10">
          
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-end mb-6">
                 <div>
                    <h1 className="text-3xl font-extrabold uppercase tracking-widest">Dashboard General</h1>
                    <p className="text-gray-400 text-sm">Monitoreo de ventas y estado de la tienda.</p>
                 </div>
              </div>

              {/* Tarjetas de Métricas Reales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#111] p-6 rounded-xl border border-gray-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign size={80} /></div>
                  <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-2">Ingresos Acumulados</h3>
                  <p className="text-3xl font-black text-white">{formatPrice(totalRevenue)}</p>
                  <p className="text-green-500 text-xs font-bold mt-2">Cifra procesada global</p>
                </div>
                <div className="bg-[#111] p-6 rounded-xl border border-gray-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Package size={80} /></div>
                  <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-2">Órdenes Históricas</h3>
                  <p className="text-3xl font-black text-white">{allOrders.length}</p>
                  <p className="text-orange-500 text-xs font-bold mt-2">{pendingOrdersCount} pendientes de envío</p>
                </div>
                <div className="bg-[#111] p-6 rounded-xl border border-gray-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Package size={80} /></div>
                  <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-2">Inventario Total</h3>
                  <p className="text-3xl font-black text-white">{products.length}</p>
                  <p className="text-gray-500 text-xs font-bold mt-2">Productos listados</p>
                </div>
              </div>

              {/* Gráfica */}
              <div className="bg-[#111] p-6 rounded-xl border border-gray-800">
                <h3 className="text-lg font-bold uppercase tracking-widest mb-6">Ingresos Históricos</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="name" stroke="#888" />
                      <YAxis stroke="#888" tickFormatter={(value) => `$${value/1000}k`} />
                      <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: '#333' }} />
                      <Line type="monotone" dataKey="ventas" stroke="#ea580c" strokeWidth={3} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
                 <div>
                    <h1 className="text-3xl font-extrabold uppercase tracking-widest text-orange-500">Gestor de Inventario</h1>
                    <p className="text-gray-400 text-sm">Añade, edita y elimina productos (Modo de previsualización local).</p>
                 </div>
                 <div className="flex gap-2">
                   <button 
                      onClick={handleAddNew}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-sm uppercase tracking-widest flex items-center gap-2 transition-transform active:scale-95 text-xs shadow-lg shadow-orange-500/20"
                   >
                      <Plus size={16} /> Añadir Producto
                   </button>
                 </div>
              </div>

              {/* Barra de Búsqueda de Tabla */}
              <div className="bg-[#111] p-4 rounded-t-xl border border-gray-800 border-b-0 flex items-center gap-3">
                  <Search className="text-gray-500 w-5 h-5" />
                  <input 
                      type="text" 
                      placeholder="Buscar producto por nombre o marca..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-transparent border-none text-white focus:outline-none w-full text-sm placeholder-gray-600"
                  />
              </div>

              {/* Tabla de Productos */}
              <div className="bg-[#111] border border-gray-800 rounded-b-xl overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                  <thead className="text-xs uppercase bg-gray-900 text-gray-300 font-bold tracking-widest">
                    <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Producto</th>
                      <th className="px-6 py-4 hidden md:table-cell">Marca</th>
                      <th className="px-6 py-4 hidden sm:table-cell">Categoría</th>
                      <th className="px-6 py-4">Precio 1</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                       <tr key={p.id} className="border-b border-gray-800 hover:bg-black/50 transition-colors">
                          <td className="px-6 py-4">#{p.id}</td>
                          <td className="px-6 py-4 font-bold text-white max-w-[200px] truncate" title={p.name}>
                            {p.name}
                            {p.is_on_sale && <span className="ml-2 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase">-{p.discount_percent}%</span>}
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell">{p.brand}</td>
                          <td className="px-6 py-4 hidden sm:table-cell">
                             <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-[10px] uppercase font-bold border border-gray-700">
                                {p.category}
                             </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-orange-500">{formatPrice(p.price1)}</td>
                          <td className="px-6 py-4 text-right space-x-2 flex items-center justify-end">
                             <button 
                               onClick={async () => {
                                 const newVal = !p.is_on_sale;
                                 const { error } = await supabase.from('products').update({ is_on_sale: newVal }).eq('id', p.id);
                                 if (!error) {
                                   setProducts(products.map(x => x.id === p.id ? {...x, is_on_sale: newVal} : x));
                                   toast.success(newVal ? 'Producto en oferta' : 'Oferta retirada');
                                 }
                               }}
                               className={`text-[9px] px-2 py-1.5 rounded font-bold uppercase tracking-wider transition-colors ${p.is_on_sale ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'}`}
                               title="Toggle Oferta"
                             >
                               {p.is_on_sale ? 'EN OFERTA' : 'SIN OFERTA'}
                             </button>
                             <button onClick={() => handleEdit(p)} className="text-blue-500 hover:text-blue-400 p-2 bg-blue-500/10 rounded transition-colors" title="Editar">
                                <Edit size={16} />
                             </button>
                             <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-400 p-2 bg-red-500/10 rounded transition-colors" title="Eliminar">
                                <Trash2 size={16} />
                             </button>
                          </td>
                       </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                        <tr>
                            <td colSpan="6" className="text-center py-10 text-gray-500">No se encontraron productos coincidentes.</td>
                        </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
             <div className="space-y-6 animate-in fade-in duration-500">
               <div className="flex justify-between items-end mb-6">
                 <div>
                    <h1 className="text-3xl font-extrabold uppercase tracking-widest text-orange-500">Gestor de Pedidos</h1>
                    <p className="text-gray-400 text-sm">Administra y despacha las compras de tus clientes.</p>
                 </div>
               </div>
               <div className="bg-[#111] border border-gray-800 rounded-xl overflow-x-auto p-4">
                  {loadingOrders ? <p className="text-gray-500 text-center py-10 font-bold uppercase tracking-widest">Cargando Pedidos...</p> : allOrders.length === 0 ? <p className="text-gray-500 text-center py-10 uppercase tracking-widest font-bold">No hay pedidos registrados.</p> : (
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
                            {allOrders.map(order => (
                               <tr key={order.id} className="border-b border-gray-800 hover:bg-gray-900 transition-colors">
                                   <td className="px-4 py-4">
                                      <p className="text-white font-bold" title={order.id}>TH-{order.id.split('-')[0].toUpperCase()}</p>
                                      <p className="text-xs text-orange-500 font-mono tracking-widest bg-orange-500/10 inline-block px-1 mt-1 rounded">{order.payment_info?.concepto}</p>
                                   </td>
                                   <td className="px-4 py-4">
                                      <p className="font-bold text-gray-300">{order.shipping_info?.fullName || 'Desconocido'}</p>
                                      <p className="text-[10px] uppercase">{order.shipping_info?.city} - {order.shipping_info?.zip}</p>
                                   </td>
                                   <td className="px-4 py-4 font-extrabold text-white">${order.total}</td>
                                   <td className="px-4 py-4">
                                       <span className="bg-gray-800 px-2 py-1 rounded text-xs font-bold">{order.order_items?.length || 0}</span>
                                   </td>
                                   <td className="px-4 py-4">
                                      <select 
                                        value={order.status} 
                                        onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                        className={`text-[10px] uppercase font-bold p-2 tracking-wider rounded-sm focus:outline-none cursor-pointer ${order.status === 'Entregado' ? 'bg-green-900 text-green-400 border border-green-700' : 'bg-orange-600 text-white border border-transparent'}`}
                                      >
                                        <option value="Pago Pendiente">Pago Pendiente</option>
                                        <option value="En Proceso">En Proceso</option>
                                        <option value="Enviado">Enviado</option>
                                        <option value="Entregado">Entregado</option>
                                        <option value="Cancelado">Cancelado</option>
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

      {/* === MODAL DE EDICIÓN/CREACIÓN === */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <div className="bg-[#111] border border-gray-800 p-8 rounded-xl w-full max-w-2xl relative shadow-2xl shadow-black">
              
              <button 
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
              >
                 <X size={24} />
              </button>

              <h2 className="text-2xl font-extrabold uppercase text-white mb-6 border-b border-gray-800 pb-4">
                 {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>

              <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 
                 <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-500">Nombre del Producto *</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-white focus:border-orange-500 focus:outline-none" required />
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-500">Marca *</label>
                    <input type="text" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-white focus:border-orange-500 focus:outline-none" required />
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-500">Categoría *</label>
                    <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-white focus:border-orange-500 focus:outline-none" required />
                 </div>

                 <div className="md:col-span-2 space-y-2 pb-4">
                    <label className="text-xs font-bold uppercase text-gray-500">Imagen del Producto (Opcional)</label>
                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="w-full bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-gray-400 focus:border-orange-500 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-orange-600 file:text-white hover:file:bg-orange-700" />
                    {formData.image_url && !imageFile && (
                        <p className="text-xs text-green-500 mt-2">Imagen actual enlazada validada.</p>
                    )}
                 </div>

                 {/* Precios escalonados */}
                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-500">Precio Publico (Tier 1) *</label>
                    <div className="relative">
                        <DollarSign size={16} className="absolute left-3 top-3.5 text-gray-500" />
                        <input type="number" step="0.01" value={formData.price1} onChange={e => setFormData({...formData, price1: Number(e.target.value)})} className="w-full pl-10 bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-orange-500 font-bold focus:border-orange-500 focus:outline-none" required />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-500">Precio Mayoreo (Tier 2)</label>
                    <div className="relative">
                        <DollarSign size={16} className="absolute left-3 top-3.5 text-gray-500" />
                        <input type="number" step="0.01" value={formData.price2} onChange={e => setFormData({...formData, price2: Number(e.target.value)})} className="w-full pl-10 bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-white focus:border-orange-500 focus:outline-none" />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-500">Precio Distribuidor (Tier 3)</label>
                    <div className="relative">
                        <DollarSign size={16} className="absolute left-3 top-3.5 text-gray-500" />
                        <input type="number" step="0.01" value={formData.price3} onChange={e => setFormData({...formData, price3: Number(e.target.value)})} className="w-full pl-10 bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-white focus:border-orange-500 focus:outline-none" />
                    </div>
                 </div>

                 {/* === SECCIÓN DE OFERTAS === */}
                 <div className="md:col-span-2 bg-red-900/10 border border-red-800/30 rounded-lg p-4 space-y-4">
                    <h3 className="text-sm font-bold uppercase text-red-400 tracking-widest">Configuración de Oferta</h3>
                    <div className="flex items-center gap-4">
                       <label className="relative inline-flex items-center cursor-pointer">
                         <input 
                           type="checkbox" 
                           checked={formData.is_on_sale} 
                           onChange={e => setFormData({...formData, is_on_sale: e.target.checked})} 
                           className="sr-only peer" 
                         />
                         <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                       </label>
                       <span className="text-sm font-bold text-gray-300">{formData.is_on_sale ? 'EN OFERTA' : 'Sin oferta'}</span>
                    </div>
                    {formData.is_on_sale && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-gray-500">Porcentaje de Descuento (%)</label>
                        <input 
                          type="number" 
                          min="1" max="90" 
                          value={formData.discount_percent} 
                          onChange={e => setFormData({...formData, discount_percent: Number(e.target.value)})} 
                          className="w-32 bg-[#0A0A0A] border border-red-700 p-3 rounded-sm text-red-400 font-bold focus:border-red-500 focus:outline-none" 
                          placeholder="15"
                        />
                        {formData.price1 > 0 && formData.discount_percent > 0 && (
                          <p className="text-xs text-gray-400">Precio final: <span className="text-red-400 font-bold">{formatPrice(formData.price1 * (1 - formData.discount_percent/100))}</span> <span className="line-through text-gray-600">{formatPrice(formData.price1)}</span></p>
                        )}
                      </div>
                    )}
                 </div>

                 <div className="md:col-span-2 mt-4 pt-4 border-t border-gray-800 flex justify-end gap-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-bold uppercase text-xs tracking-widest text-gray-400 hover:text-white transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-sm uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-transform flex items-center gap-2">
                        <Package size={16} /> {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

    </div>
  );
}