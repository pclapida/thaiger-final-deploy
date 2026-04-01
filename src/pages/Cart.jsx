import React from 'react';
import Navbar from '../components/Navbar';
import { Trash2, Minus, Plus, ArrowRight, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../data/products';
import { useCart } from '../context/CartContext';

export default function Cart() {
  const { cartItems, updateQuantity, removeFromCart } = useCart();

  // 1. Calculamos el total base (usando Precio 1) para saber en qué nivel de descuento estamos
  const baseTotal = cartItems.reduce((acc, item) => acc + (item.price1 * item.quantity), 0);

  // 2. Determinamos el nivel de tier
  let currentTier = 1;
  if (baseTotal >= 20000) currentTier = 3;
  else if (baseTotal >= 10000) currentTier = 2;

  // 3. Función para obtener el precio activo de un producto según el tier
  const getActivePrice = (item) => {
      if (currentTier === 3) return item.price3;
      if (currentTier === 2) return item.price2;
      return item.price1;
  };

  // 4. Calculamos el subtotal REAL con los descuentos aplicados
  const subtotal = cartItems.reduce((acc, item) => acc + (getActivePrice(item) * item.quantity), 0);

  const shipping = subtotal > 5000 ? 0 : 250; // Envío gratis si supera los $5,000 en el pago final
  const total = subtotal + shipping;

  return (
    <div className="bg-[#0A0A0A] min-h-screen text-white font-sans">
      <Navbar />

      <div className="container mx-auto pt-32 px-4 pb-12">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-8 uppercase text-orange-500 tracking-wider border-b border-gray-800 pb-4">
          Tu Carrito de Compras
        </h1>

        {cartItems.length === 0 ? (
           <div className="text-center py-20 text-gray-400 uppercase tracking-widest">
              Tu carrito está vacío.
           </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* === LISTA DE PRODUCTOS === */}
            <div className="flex-1 space-y-4">
              
              {/* Banner de aviso de descuentos (Solo muestra si aún puede mejorar de nivel) */}
              {currentTier < 3 && (
                <div className="bg-orange-600/20 border border-orange-500 rounded p-4 flex items-center gap-4 text-sm font-semibold mb-6">
                    <Tag className="text-orange-500" />
                    <p>
                        Estás en el <span className="text-orange-500">Nivel de Precio {currentTier}</span>. 
                        ¡Agrega <span className="text-white">${formatPrice((currentTier === 1 ? 10000 : 20000) - baseTotal)}</span> más en productos para desbloquear el Nivel {currentTier + 1} y conseguir mejores precios!
                    </p>
                </div>
              )}

              {cartItems.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row items-center bg-[#111] p-4 rounded-sm border border-gray-800 hover:border-gray-700 transition-colors">
                  <div className="w-full sm:w-32 h-32 bg-white rounded flex-shrink-0 mb-4 sm:mb-0 sm:mr-6 p-2 relative flex items-center justify-center overflow-hidden">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="w-full h-full object-contain mix-blend-multiply" 
                      />
                    ) : (
                      <span className="text-gray-300 font-bold opacity-30 select-none uppercase text-[10px]">Sin Imagen</span>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col md:flex-row justify-between items-start md:items-center w-full">
                    <div className="mb-4 md:mb-0">
                      <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mb-1">{item.brand}</p>
                      <h3 className="text-lg font-bold uppercase">{item.name}</h3>
                      <div className="flex flex-col gap-1 mt-1">
                        <p className="text-gray-400 text-sm">Precio: {formatPrice(getActivePrice(item))}</p>
                        {item.stock !== undefined && (
                          <p className={`text-[10px] uppercase font-bold ${item.stock < 5 ? 'text-red-500' : 'text-gray-500'}`}>
                            Disponibles: {item.stock} unidades
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full md:w-auto md:gap-8">
                      <div className="flex items-center border border-gray-700 bg-[#0A0A0A]">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1, item.stock)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 transition"
                        ><Minus size={16}/></button>
                        <span className="px-4 font-bold">{item.quantity}</span>
                        <button 
                          disabled={item.stock !== undefined && item.quantity >= item.stock}
                          onClick={() => updateQuantity(item.id, item.quantity + 1, item.stock)}
                          className={`p-2 transition ${item.stock !== undefined && item.quantity >= item.stock ? 'text-gray-800 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                        ><Plus size={16}/></button>
                      </div>
                      
                      <div className="text-right">
                         <p className="text-xl font-extrabold text-orange-500">{formatPrice(getActivePrice(item) * item.quantity)}</p>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="mt-4 sm:mt-0 sm:ml-6 text-gray-500 hover:text-red-500 transition-colors p-2"
                  >
                      <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>

            {/* === RESUMEN DEL PEDIDO === */}
            <div className="lg:w-96 shrink-0">
              <div className="bg-[#111] p-6 rounded-sm border border-gray-800 sticky top-32">
                <h2 className="text-xl font-bold uppercase mb-6 tracking-wider">Resumen del Pedido</h2>
                
                <div className="space-y-4 text-gray-300 mb-6">
                  <div className="flex justify-between items-center text-sm border-b border-gray-800 pb-2">
                    <span className="text-orange-500 font-bold uppercase flex items-center gap-1"><Tag size={14}/> Nivel de Precios Actual</span>
                    <span className="bg-orange-500 text-black font-black px-2 py-0.5 rounded text-xs">{currentTier}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-bold text-white">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Envío Estimado</span>
                    <span className="font-bold text-white">{shipping === 0 ? <span className="text-green-500 uppercase text-sm">Gratis</span> : formatPrice(shipping)}</span>
                  </div>
                  <div className="border-t border-gray-800 pt-4 mt-4">
                    <div className="flex justify-between items-end">
                      <span className="text-lg uppercase font-bold">Total</span>
                      <span className="text-3xl font-extrabold text-orange-500 tracking-tight">{formatPrice(total)}</span>
                    </div>
                    <p className="text-xs text-gray-500 text-right mt-1">IVA incluido</p>
                  </div>
                </div>

                {/* --- AQUÍ ESTÁ EL CAMBIO: LINK AL CHECKOUT --- */}
                <Link to="/checkout">
                    <button className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-6 rounded-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-95 group">
                    Proceder al Pago 
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </Link>
                {/* --------------------------------------------- */}
                
                <div className="mt-6 text-xs text-gray-500 text-center uppercase tracking-wider flex flex-col gap-2">
                   <p>Pagos Seguros Encriptados</p>
                   <div className="flex justify-center gap-2 opacity-50">
                     <span>VISA</span> <span>MC</span> <span>AMEX</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}