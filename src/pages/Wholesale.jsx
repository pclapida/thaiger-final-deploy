import React from 'react';
import Navbar from '../components/Navbar';
import { PackageOpen, TrendingUp, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Wholesale() {
    return (
        <div className="bg-[#0A0A0A] min-h-screen text-white font-sans selection:bg-orange-500 selection:text-black">
            <Navbar />
            <div className="container mx-auto pt-32 px-4 pb-20 max-w-5xl">
                <header className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-extrabold uppercase text-orange-500 tracking-wider mb-4">
                        Programa de Mayoreo
                    </h1>
                    <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                        Escala tu negocio de suplementación deportiva con herramientas de poder. Compra inteligentemente con nuestros 3 escalafones de descuentos automáticos.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* TIER 1 */}
                    <div className="bg-black border border-gray-800 rounded-sm p-8 relative flex flex-col">
                        <div className="mb-6">
                            <h3 className="text-gray-500 font-bold uppercase tracking-widest text-sm mb-2">Tier 1</h3>
                            <h2 className="text-3xl font-black text-white uppercase">Minorista</h2>
                            <p className="text-orange-500 font-medium text-sm mt-2">Menudeo normal y prueba</p>
                        </div>
                        <ul className="space-y-4 text-sm text-gray-400 flex-1 mb-8">
                            <li className="flex items-start gap-2">- Precio regular listado en tienda.</li>
                            <li className="flex items-start gap-2">- Ideal para consumo personal o clientes finales.</li>
                            <li className="flex items-start gap-2 text-white">- Envío base con costo fijo (MXN $250).</li>
                            <li className="flex items-start gap-2">- <span className="text-orange-500 font-bold">¡Tip!</span> Pasa de $5,000 en el carrito y tu envío es GRATIS.</li>
                        </ul>
                        <Link to="/shop" className="w-full block text-center bg-gray-900 hover:bg-orange-600 text-white font-bold py-3 uppercase tracking-widest transition-colors rounded-sm">Ver Tienda Original</Link>
                    </div>

                    {/* TIER 2 */}
                    <div className="bg-[#111] border-2 border-orange-500 rounded-sm p-8 relative flex flex-col transform md:-translate-y-4 shadow-2xl shadow-orange-500/10">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-500 text-black text-[10px] font-black uppercase px-4 py-1 tracking-widest rounded-full">El Más Popular</div>
                        <div className="mb-6">
                            <h3 className="text-orange-500 font-bold uppercase tracking-widest text-sm mb-2">Tier 2</h3>
                            <h2 className="text-3xl font-black text-white uppercase">Mayoreo Ligero</h2>
                            <p className="text-gray-400 font-medium text-sm mt-2">Compras superiores a $10,000 MXN</p>
                        </div>
                        <ul className="space-y-4 text-sm text-gray-300 flex-1 mb-8">
                            <li className="flex items-start gap-2 text-white font-bold">- Se desbloquea automáticamente al superar la cantidad de $10,000 MXN.</li>
                            <li className="flex items-start gap-2">- Precios reducidos en todo el catálogo (Aplica Precio Tier 2).</li>
                            <li className="flex items-start gap-2">- Oportunidad de invertir y probar sin comprometer tanto capital.</li>
                            <li className="flex items-start gap-2 text-green-500 font-bold">- ¡Envío completamente GRATIS a todo México!</li>
                        </ul>
                        <Link to="/shop" className="w-full block text-center bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 uppercase tracking-widest transition-colors rounded-sm">Activar Nivel Mayoreo</Link>
                    </div>

                    {/* TIER 3 */}
                    <div className="bg-black border border-gray-800 rounded-sm p-8 relative flex flex-col">
                        <div className="mb-6">
                            <h3 className="text-gray-500 font-bold uppercase tracking-widest text-sm mb-2">Tier 3</h3>
                            <h2 className="text-3xl font-black text-white uppercase">Distribuidor</h2>
                            <p className="text-gray-400 font-medium text-sm mt-2">Compras superiores a $20,000 MXN</p>
                        </div>
                        <ul className="space-y-4 text-sm text-gray-400 flex-1 mb-8">
                            <li className="flex items-start gap-2 text-white font-bold">- Se desbloquea automáticamente al cobrar arriba de $20,000 MXN.</li>
                            <li className="flex items-start gap-2">- Acceso instantáneo a nuestro escalafón de Distribuidor Mayoritario.</li>
                            <li className="flex items-start gap-2">- Mayores márgenes de utilidad para reventas y gimnasios.</li>
                            <li className="flex items-start gap-2 text-green-500 font-bold">- ¡Envío completamente GRATIS y trato preferencial!</li>
                        </ul>
                        <Link to="/shop" className="w-full block text-center bg-gray-900 text-white font-bold py-3 uppercase tracking-widest hover:bg-gray-800 transition-colors rounded-sm">Hacer Súper Pedido</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
