import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { Box, User, MapPin, ChevronRight, PackageCheck, Clock, Camera, Save, Heart, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { orders as ordersApi, auth as authApi } from '../services/api';
import { formatPrice } from '../lib/pricing';
import ProductCard from '../components/ProductCard';
import toast from 'react-hot-toast';

export default function UserProfile() {
    const { user, updateProfile } = useAuth();
    const { wishlistItems } = useWishlist();
    const [activeTab, setActiveTab] = useState('pedidos');

    // Estado para "Detalles de Cuenta"
    const [displayName, setDisplayName] = useState(user?.name || '');
    const [photoURL, setPhotoURL] = useState(user?.avatar_url || '');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [updateMsg, setUpdateMsg] = useState('');

    // Estado para "Pedidos"
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const userId = user?.id;

    useEffect(() => {
        if (activeTab !== 'pedidos' || !userId) return;

        let active = true;
        setLoadingOrders(true);

        ordersApi
            .listByUser(userId)
            .then((list) => {
                if (active) setOrders(list);
            })
            .catch((error) => {
                console.error('No se pudieron cargar los pedidos:', error);
                if (active) setOrders([]);
            })
            .finally(() => {
                if (active) setLoadingOrders(false);
            });

        return () => {
            active = false;
        };
    }, [activeTab, userId]);

    const handlePhotoFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setIsUploadingPhoto(true);
        try {
            const url = await authApi.uploadAvatar(file);
            setPhotoURL(url);
            toast.success('Foto lista. Guarda los cambios para aplicarla.');
        } catch (error) {
            toast.error(error.message || 'No se pudo procesar la imagen.');
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setIsUpdating(true);
        setUpdateMsg('');

        const result = await updateProfile({
            name: displayName,
            avatar_url: photoURL || null
        });

        if (result.success) {
            setUpdateMsg('¡Perfil actualizado con éxito!');
            toast.success('Perfil actualizado');
        } else {
            setUpdateMsg('Error al actualizar: ' + (result.error?.message || 'intenta de nuevo.'));
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
                        <h1 className="text-3xl font-extrabold uppercase tracking-wider">{user?.name || 'Usuario Thaiger'}</h1>
                        <p className="text-gray-400">{user?.email}</p>
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
                                                        <h3 className="text-xl font-extrabold text-white tracking-wider" title={order.id}>TH-{String(order.id).split('-')[0].toUpperCase()}</h3>
                                                        <StatusBadge status={order.status} />
                                                    </div>
                                                    <p className="text-sm text-gray-400">Realizado el: {new Date(order.created_at).toLocaleDateString()}</p>
                                                    <p className="text-sm text-gray-500">{order.order_items?.length || 0} artículos</p>
                                                </div>

                                                <div className="flex flex-row md:flex-col items-center md:items-end gap-4 md:gap-2 w-full md:w-auto justify-between">
                                                    <span className="text-2xl font-extrabold text-orange-500 tracking-tight">{formatPrice(order.total)}</span>
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
                                            <ProductCard key={prod.id} product={prod} delay={idx} />
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
                                            <label htmlFor="profile-name" className="text-xs uppercase font-bold text-gray-500">Nombre Público</label>
                                            <input
                                                id="profile-name"
                                                type="text"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                className="w-full bg-[#0A0A0A] border border-gray-700 p-3 text-white focus:border-orange-500 focus:outline-none transition-colors rounded-sm" 
                                                placeholder="Tu nombre completo o apodo" 
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label htmlFor="profile-photo" className="text-xs uppercase font-bold text-gray-500">Foto de Perfil</label>

                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 rounded-full overflow-hidden bg-[#0A0A0A] border border-gray-700 flex items-center justify-center shrink-0">
                                                    {photoURL ? (
                                                        <img src={photoURL} alt="Vista previa" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User size={24} className="text-gray-600" />
                                                    )}
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <input
                                                        id="profile-photo"
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handlePhotoFile}
                                                        disabled={isUploadingPhoto}
                                                        className="w-full bg-[#0A0A0A] border border-gray-700 p-2 rounded-sm text-gray-400 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-orange-600 file:text-white hover:file:bg-orange-700"
                                                    />
                                                    {isUploadingPhoto && <p className="text-xs text-orange-500">Procesando imagen...</p>}
                                                </div>
                                            </div>

                                            <input
                                                type="url"
                                                aria-label="URL de la foto de perfil"
                                                value={photoURL?.startsWith('data:') ? '' : photoURL}
                                                onChange={(e) => setPhotoURL(e.target.value)}
                                                className="w-full bg-[#0A0A0A] border border-gray-700 p-3 text-white focus:border-orange-500 focus:outline-none transition-colors rounded-sm"
                                                placeholder="...o pega la URL de una imagen"
                                            />
                                            {photoURL && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPhotoURL('')}
                                                    className="text-xs text-gray-500 hover:text-red-500 uppercase font-bold"
                                                >
                                                    Quitar foto
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-2 opacity-50 cursor-not-allowed">
                                            <label className="text-xs uppercase font-bold text-gray-500">Correo Electrónico (No editable)</label>
                                            <input
                                                type="email"
                                                disabled
                                                value={user?.email || ''}
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