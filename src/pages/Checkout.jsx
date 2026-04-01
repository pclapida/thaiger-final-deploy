import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { MapPin, ShieldCheck, Landmark, CheckCircle, Copy, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { formatPrice } from '../data/products';
import toast from 'react-hot-toast';

export default function Checkout() {
    const { cartItems, clearCart } = useCart();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '', phone: '', address: '', city: '', zip: ''
    });
    
    // SPEI DUMMY DATA
    const speiData = React.useMemo(() => ({
        banco: "BBVA Bancomer",
        clabe: "012345678901234567",
        beneficiario: "Thaiger Supplements MX",
        // eslint-disable-next-line react-hooks/purity
        concepto: `TH-${Math.floor(1000 + Math.random() * 9000)}` // Random order id
    }), []);

    const handlePayment = async (e) => {
        e.preventDefault();
        if (!user || !user.uid) {
            toast.error("Debes iniciar sesión para finalizar tu compra.");
            return;
        }
        if (!formData.fullName || !formData.address || !formData.phone || !formData.city || !formData.zip) {
            toast.error("Por favor completa tu dirección de envío en todos los campos.");
            return;
        }

        setIsProcessing(true);
        try {
            const { data: orderData, error: orderError } = await supabase.from('orders').insert({
                user_id: user.uid,
                total: total,
                shipping_info: formData,
                payment_info: { method: 'SPEI', concepto: speiData.concepto, banco: speiData.banco },
                status: 'Pago Pendiente'
            }).select().single();

            if (orderError) throw orderError;

            const orderItems = cartItems.map(item => ({
                order_id: orderData.id,
                product_id: item.id,
                product_name: item.name,
                quantity: item.quantity,
                price_at_purchase: getActivePrice(item)
            }));

            const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
            if (itemsError) throw itemsError;

            toast.success(`¡Pedido Registrado!\nTrasfiere con concepto ${speiData.concepto}`, { duration: 8000 });
            clearCart();
            navigate('/profile');
            
        } catch (error) {
            console.error("Error al procesar pedido:", error);
            toast.error("Hubo un error de base de datos. Intenta de nuevo.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Cálculos de Cart igual que en Cart.jsx
    const baseTotal = cartItems.reduce((acc, item) => acc + (item.price1 * item.quantity), 0);
    let currentTier = 1;
    if (baseTotal >= 20000) currentTier = 3;
    else if (baseTotal >= 10000) currentTier = 2;

    const getActivePrice = (item) => {
        if (currentTier === 3) return item.price3;
        if (currentTier === 2) return item.price2;
        return item.price1;
    };

    const subtotal = cartItems.reduce((acc, item) => acc + (getActivePrice(item) * item.quantity), 0);
    const shipping = subtotal > 5000 ? 0 : 250; 
    const total = subtotal + shipping;

    // Si entran al checkout sin nada en cart
    if (cartItems.length === 0 && !isProcessing) {
        return (
            <div className="bg-[#0A0A0A] min-h-screen text-white font-sans flex flex-col items-center justify-center">
               <Navbar />
               <h2 className="text-3xl font-bold mb-4">El carrito está vacío</h2>
               <button onClick={() => navigate('/shop')} className="text-orange-500 hover:underline">Volver a la tienda</button>
            </div>
        );
    }

    return (
        <div className="bg-[#0A0A0A] min-h-screen text-white font-sans selection:bg-orange-500 selection:text-black">
            <Navbar />
            
            <div className="container mx-auto pt-32 px-4 pb-20">
                <h1 className="text-3xl font-extrabold uppercase tracking-widest text-orange-500 mb-8 flex items-center gap-3">
                    <ShieldCheck /> Finalizar Compra
                </h1>

                <div className="flex flex-col lg:flex-row gap-12">
                    
                    {/* === COLUMNA IZQUIERDA: FORMULARIOS === */}
                    <div className="flex-1 space-y-8">
                        
                        {/* 1. Dirección de Envío */}
                        <section className="bg-[#111] p-6 rounded-sm border border-gray-800 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-orange-600"></div>
                            <h2 className="text-xl font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
                                <MapPin size={20} className="text-orange-500"/> Información de Envío
                            </h2>
                            <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs uppercase font-bold text-gray-500">Nombre Completo</label>
                                    <input value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} type="text" className="w-full bg-[#0A0A0A] border border-gray-700 p-3 text-white focus:border-orange-500 focus:outline-none transition-colors rounded-sm" placeholder="Ej: Juan Pérez" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase font-bold text-gray-500">Teléfono</label>
                                    <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} type="tel" className="w-full bg-[#0A0A0A] border border-gray-700 p-3 text-white focus:border-orange-500 focus:outline-none transition-colors rounded-sm" placeholder="+52 55 1234 5678" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-xs uppercase font-bold text-gray-500">Dirección (Calle y Número)</label>
                                    <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} type="text" className="w-full bg-[#0A0A0A] border border-gray-700 p-3 text-white focus:border-orange-500 focus:outline-none transition-colors rounded-sm" placeholder="Av. Revolución 123" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase font-bold text-gray-500">Ciudad</label>
                                    <input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} type="text" className="w-full bg-[#0A0A0A] border border-gray-700 p-3 text-white focus:border-orange-500 focus:outline-none transition-colors rounded-sm" placeholder="CDMX / MTY / GDL" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase font-bold text-gray-500">Código Postal</label>
                                    <input value={formData.zip} onChange={e => setFormData({...formData, zip: e.target.value})} type="text" className="w-full bg-[#0A0A0A] border border-gray-700 p-3 text-white focus:border-orange-500 focus:outline-none transition-colors rounded-sm" placeholder="00000" />
                                </div>
                            </form>
                        </section>

                        {/* 2. Método de Pago - Transferencia SPEI */}
                        <section className="bg-[#111] p-6 rounded-sm border border-gray-800 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-orange-600"></div>
                            <h2 className="text-xl font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
                                <Landmark size={20} className="text-orange-500"/> Pago vía Transferencia (SPEI)
                            </h2>

                            <div 
                                className="space-y-6"
                            >
                                <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded text-sm text-gray-300 flex items-start gap-4 mb-6">
                                    <AlertCircle className="text-orange-500 shrink-0 mt-0.5" />
                                    <p>Tu pedido se apartará una vez que completes el formulario. Para que sea procesado, <strong>debes realizar la transferencia SPEI por el monto total</strong> a la siguiente cuenta y colocar el <span className="text-white font-bold">Número de Concepto</span> indicado.</p>
                                </div>

                                <div className="bg-[#0A0A0A] p-6 border border-gray-800 rounded-sm font-mono text-sm space-y-4">
                                    <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                                        <span className="text-gray-500 uppercase font-bold text-xs">Banco</span>
                                        <span className="text-white font-bold text-lg">{speiData.banco}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                                        <span className="text-gray-500 uppercase font-bold text-xs">Beneficiario</span>
                                        <span className="text-white text-base">{speiData.beneficiario}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                                        <span className="text-gray-500 uppercase font-bold text-xs">CLABE Interbancaria</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-orange-500 font-extrabold text-xl tracking-widest">{speiData.clabe}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-gray-500 uppercase font-bold text-xs">Concepto a ingresar</span>
                                        <span className="bg-orange-600 text-black font-black px-3 py-1 rounded-sm text-lg tracking-widest">{speiData.concepto}</span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* === COLUMNA DERECHA: RESUMEN (Sticky) === */}
                    <div className="lg:w-96 shrink-0">
                        <div className="bg-[#111] p-6 rounded-sm border border-gray-800 sticky top-32">
                            <h3 className="text-lg font-bold uppercase tracking-widest mb-6 border-b border-gray-800 pb-2">Resumen de Orden</h3>
                            
                            <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {cartItems.map((item, i) => (
                                    <div key={i} className="flex justify-between items-start text-sm border-b border-gray-800 pb-2">
                                        <div className="text-gray-300 w-2/3">
                                            <span className="text-orange-500 font-bold">{item.quantity}x</span> <span className="uppercase text-xs font-semibold">{item.name}</span>
                                        </div>
                                        <div className="font-bold text-white whitespace-nowrap">{formatPrice(getActivePrice(item) * item.quantity)}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2 text-sm text-gray-400 border-t border-gray-800 pt-4 mb-6">
                                <div className="flex justify-between">
                                    <span>Subtotal (Nivel {currentTier})</span>
                                    <span>{formatPrice(subtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Envío</span>
                                    <span>{shipping === 0 ? <span className="text-green-500 uppercase font-bold text-xs">Gratis</span> : formatPrice(shipping)}</span>
                                </div>
                                <div className="flex justify-between text-white text-lg font-extrabold mt-4 pt-4 border-t border-gray-800 items-end">
                                    <span className="uppercase tracking-widest text-sm">Total a Transferir</span>
                                    <span className="text-orange-500 text-3xl tracking-tight">{formatPrice(total)}</span>
                                </div>
                            </div>

                            <button 
                                onClick={handlePayment}
                                disabled={isProcessing}
                                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-black font-bold py-4 px-6 rounded-sm uppercase tracking-widest transition-all transform active:scale-95 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <span className="animate-pulse">Procesando...</span>
                                ) : (
                                    <>
                                        <CheckCircle size={20} /> Pagar Ahora
                                    </>
                                )}
                            </button>
                            
                            <p className="text-[10px] text-gray-500 text-center mt-4 uppercase flex items-center justify-center gap-1">
                                <ShieldCheck size={10} /> Tus datos de envío están protegidos
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}