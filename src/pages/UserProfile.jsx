import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { Box, User, MapPin, ChevronRight, PackageCheck, Clock, Camera, Save, Heart, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { supabase } from '../supabase';
import ProductCard from '../components/ProductCard';

// Los pedidos falsos (DUMMY_ORDERS) han sido removidos. Se implementará conexión con base de datos.

export default function UserProfile() {
    const { currentUser, user, updateProfile } = useAuth();
    const { wishlistItems } = useWishlist();
    const [activeTab, setActiveTab] = useState('pedidos');
    
    // Estado para "Detalles de Cuenta"
    const [displayName, setDisplayName] = useState(user?.name || '');
    const [photoURL, setPhotoURL] = useState(user?.avatar_url || '');
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateMsg, setUpdateMsg] = useState('');

    // Estado para "Pedidos"
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    useEffect(() => {
        if (activeTab === 'pedidos' && user?.uid) {
            const fetchOrders = async () => {
                setLoadingOrders(true);
                const { data, error } = await supabase
                    .from('orders')
                    .select('*, order_items(*)')
                    .eq('user_id', user.uid)
                    .order('created_at', { ascending: false });
                
                if (data && !error) setOrders(data);
                setLoadingOrders(false);
            };
            fetchOrders();
        }
    }, [activeTab, user]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setIsUpdating(true);
        setUpdateMsg('');
        
        const result = await updateProfile({
            name: displayName,
            avatar_url: photoURL
        });

        if (result.success) {
            setUpdateMsg('¡Perfil actualizado con éxito!');
        } else {
            setUpdateMsg('Error al actualizar: ' + result.error.message);
        }
        
        setIsUpdating(false);
    };

    // Componente simple para el badge de estado
    const StatusBadge = ({ status }) => {
        const styles = status === "Entregado" 
            ? "bg-green-900/30 text-green-500 border-green-800" 
            : "bg-orange-900/30 text-orange-500 border-orange-800";
        const Icon = status === "Entregado" ? PackageCheck : Clock;
        return (
            <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs uppercase font-bold tracking-wider border ${styles}`}>
                <Icon size={14} /> {status}
            </span>
        );
    };

    return (
        <div className="bg-[#0A0A0A] min-h-screen text-white">
            <Navbar />
            <div className="container mx-auto pt-32 px-4 pb-12">
                
                {/* Encabezado del Perfil */}
                <div className="flex items-center gap-6 mb-12 border-b border-gray-800 pb-8">
                    <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center border-2 border-orange-500 overflow-hidden relative group shrink-0">
                        {user?.avatar_url ? (
                            <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={40} className="text-gray-400" />
                        )}
                        {/* Overlay al hacer hover para sugerir cambio */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => setActiveTab('cuenta')}>
                            <Camera className="text-white" size={24} />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold uppercase tracking-wider">{user?.name || currentUser?.user_metadata?.name || 'Usuario Thaiger'}</h1>
                        <p className="text-gray-400">{currentUser?.email}</p>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-12">
                    {/* === SIDEBAR DE NAVEGACIÓN === */}
                    <aside className="lg:w-64 shrink-0">
                        <nav className="space-y-2">
                            {[
                                { id: 'pedidos', label: 'Mis Pedidos', icon: Box },
                                { id: 'favoritos', label: 'Mis Favoritos', icon: Heart },
                                { id: 'direcciones', label: 'Direcciones', icon: MapPin },
                                { id: 'cuenta', label: 'Detalles de Cuenta', icon: User },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`w-full flex items-center gap-4 px-4 py-4 text-left uppercase font-bold tracking-widest transition-all rounded-sm border-l-4 ${
                                        activeTab === item.id 
                                        ? 'bg-[#111] border-orange-500 text-white' 
                                        : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-900'
                                    }`}
                                >
                                    <item.icon size={20} className={activeTab === item.id ? "text-orange-500" : ""} />
                                    {item.label}
                                </button>
                            ))}
                            
                            {user?.role === 'admin' && (
                                <div className="pt-4 mt-4 border-t border-gray-800">
                                    <Link to="/dashboard" className="w-full flex items-center gap-4 px-4 py-4 text-left uppercase font-bold tracking-widest transition-all rounded-sm border-l-4 border-transparent text-orange-500 hover:bg-orange-900/20">
                                        <LayoutDashboard size={20} />
                                        Dashboard Admin
                                    </Link>
                                </div>
                            )}
                        </nav>
                    </aside>

                    {/* === ÁREA DE CONTENIDO PRINCIPAL === */}
                    <main className="flex-1">
                        {activeTab === 'pedidos' && (
                            <div>
                                <h2 className="text-2xl font-bold uppercase mb-6 flex items-center gap-2">
                                    <Box className="text-orange-500"/> Historial de Pedidos
                                </h2>
                                {loadingOrders ? (
                                    <div className="text-gray-400 uppercase tracking-widest py-20 text-center border border-gray-800 bg-[#111] rounded-sm">
                                        Cargando pedidos...
                                    </div>
                                ) : orders.length === 0 ? (
                                    <div className="text-gray-400 uppercase tracking-widest py-20 text-center border border-gray-800 bg-[#111] rounded-sm">
                                        Aún no has guardado pedidos en el historial.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {orders.map((order) => (
                                            <div key={order.id} className="bg-[#111] border border-gray-800 hover:border-orange-500/50 transition-colors p-6 rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-4">
                                                        <h3 className="text-xl font-extrabold text-white tracking-wider" title={order.id}>TH-{order.id.split('-')[0].toUpperCase()}</h3>
                                                        <StatusBadge status={order.status} />
                                                    </div>
                                                    <p className="text-sm text-gray-400">Realizado el: {new Date(order.created_at).toLocaleDateString()}</p>
                                                    <p className="text-sm text-gray-500">{order.order_items?.length || 0} artículos</p>
                                                </div>

                                                <div className="flex flex-row md:flex-col items-center md:items-end gap-4 md:gap-2 w-full md:w-auto justify-between">
                                                    <span className="text-2xl font-extrabold text-orange-500 tracking-tight">${order.total}</span>
                                                    <p className="text-xs uppercase text-gray-500 flex items-center gap-1 font-bold">
                                                        SPEI: {order.payment_info?.concepto || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'favoritos' && (
                            <div>
                                <h2 className="text-2xl font-bold uppercase mb-6 flex items-center gap-2">
                                    <Heart className="text-orange-500"/> Mis Favoritos
                                </h2>
                                {wishlistItems.length === 0 ? (
                                    <div className="text-gray-400 uppercase tracking-widest py-20 text-center border border-gray-800 bg-[#111] rounded-sm">
                                        No tienes productos en tu lista de deseos.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {wishlistItems.map((prod, idx) => (
                                            <ProductCard key={prod.id} delay={idx} id={prod.id} brand={prod.brand} details={prod.name} price={`$${prod.price1}`} image={prod.image} category={prod.category} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'direcciones' && (
                            <div className="text-gray-400 uppercase tracking-widest py-20 text-center border border-gray-800 bg-[#111] rounded-sm">Próximamente: Gestión de Direcciones Múltiples</div>
                        )}
                        
                        {activeTab === 'cuenta' && (
                            <div>
                                <h2 className="text-2xl font-bold uppercase mb-6 flex items-center gap-2">
                                    <User className="text-orange-500"/> Configuración de Cuenta
                                </h2>
                                <form onSubmit={handleUpdateProfile} className="bg-[#111] border border-gray-800 p-8 rounded-sm max-w-2xl">
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-xs uppercase font-bold text-gray-500">Nombre Público</label>
                                            <input 
                                                type="text" 
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                className="w-full bg-[#0A0A0A] border border-gray-700 p-3 text-white focus:border-orange-500 focus:outline-none transition-colors rounded-sm" 
                                                placeholder="Tu nombre completo o apodo" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs uppercase font-bold text-gray-500">URL de tu Foto de Perfil</label>
                                            <input 
                                                type="url" 
                                                value={photoURL}
                                                onChange={(e) => setPhotoURL(e.target.value)}
                                                className="w-full bg-[#0A0A0A] border border-gray-700 p-3 text-white focus:border-orange-500 focus:outline-none transition-colors rounded-sm" 
                                                placeholder="https://ejemplo.com/mifoto.jpg" 
                                            />
                                            <p className="text-[10px] text-gray-500">Ingresa un link directo a una imagen para usarla como tu avatar.</p>
                                        </div>
                                        <div className="space-y-2 opacity-50 cursor-not-allowed">
                                            <label className="text-xs uppercase font-bold text-gray-500">Correo Electrónico (No editable)</label>
                                            <input 
                                                type="email" 
                                                disabled
                                                value={currentUser?.email || ''}
                                                className="w-full bg-[#0A0A0A] border border-gray-700 p-3 text-gray-500 rounded-sm" 
                                            />
                                        </div>

                                        {updateMsg && (
                                            <p className={`text-sm font-bold ${updateMsg.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                                                {updateMsg}
                                            </p>
                                        )}

                                        <button 
                                            type="submit" 
                                            disabled={isUpdating}
                                            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-sm uppercase tracking-widest flex items-center gap-2 transition-transform active:scale-95 disabled:bg-gray-600"
                                        >
                                            <Save size={18} /> {isUpdating ? "Guardando..." : "Guardar Cambios"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}