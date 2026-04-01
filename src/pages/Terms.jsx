import React from 'react';
import Navbar from '../components/Navbar';
import { ShieldCheck, FileText, RefreshCw, Truck } from 'lucide-react';

export default function Terms() {
    return (
        <div className="bg-[#0A0A0A] min-h-screen text-white">
            <Navbar />
            
            <div className="container mx-auto pt-32 px-4 pb-20 max-w-4xl">
                <header className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-extrabold uppercase text-orange-500 tracking-wider mb-4">
                        Términos y Condiciones
                    </h1>
                    <p className="text-gray-400">
                        Última actualización: {new Date().toLocaleDateString('es-MX')}
                    </p>
                </header>

                <div className="space-y-12">
                    {/* Sección 1 */}
                    <section className="bg-[#111] p-8 rounded-2xl border border-gray-800 hover:border-orange-500/30 transition-colors">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                                <FileText size={24} />
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">1. Información General</h2>
                        </div>
                        <div className="text-gray-300 space-y-4 leading-relaxed">
                            <p>
                                Bienvenido a Thaiger Supplements. Al acceder y realizar compras en nuestro sitio web, aceptas estar sujeto a los siguientes términos y condiciones. Por favor, lee cuidadosamente esta sección antes de usar nuestros servicios.
                            </p>
                            <p>
                                Nos reservamos el derecho de actualizar, cambiar o reemplazar cualquier parte de estos Términos y Condiciones mediante la publicación de actualizaciones en nuestra página web.
                            </p>
                        </div>
                    </section>

                    {/* Sección 2 */}
                    <section className="bg-[#111] p-8 rounded-2xl border border-gray-800 hover:border-orange-500/30 transition-colors">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                                <Truck size={24} />
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">2. Envíos y Entregas</h2>
                        </div>
                        <div className="text-gray-300 space-y-4 leading-relaxed">
                            <p>
                                Realizamos envíos a toda la república. Los tiempos de entrega estimados se proporcionan al momento del checkout y pueden variar dependiendo de la ubicación y el servicio de paquetería.
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-400">
                                <li>Los pedidos se procesan dentro de las 24-48 horas hábiles posteriores a la confirmación de pago.</li>
                                <li>No nos hacemos responsables por retrasos causados por las empresas de paquetería o por información de envío incorrecta proporcionada por el cliente.</li>
                            </ul>
                        </div>
                    </section>

                    {/* Sección 3 */}
                    <section className="bg-[#111] p-8 rounded-2xl border border-gray-800 hover:border-orange-500/30 transition-colors">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                                <RefreshCw size={24} />
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">3. Cambios y Devoluciones</h2>
                        </div>
                        <div className="text-gray-300 space-y-4 leading-relaxed">
                            <p>
                                Debido a la naturaleza de nuestros productos (suplementos alimenticios), no aceptamos devoluciones una vez que el producto ha sido abierto o que su sello de seguridad haya sido violado.
                            </p>
                            <p>
                                Si recibes un producto dañado o incorrecto, cuentas con <strong>3 días naturales</strong> desde la recepción de tu paquete para notificarnos y procesar un cambio o reembolso.
                            </p>
                        </div>
                    </section>

                    {/* Sección 4 */}
                    <section className="bg-[#111] p-8 rounded-2xl border border-gray-800 hover:border-orange-500/30 transition-colors">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                                <ShieldCheck size={24} />
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-wide">4. Privacidad y Seguridad</h2>
                        </div>
                        <div className="text-gray-300 space-y-4 leading-relaxed">
                            <p>
                                Tu privacidad es importante para nosotros. Cualquier información personal que nos proporciones será utilizada estrictamente para el procesamiento de tus pedidos y para mejorar tu experiencia de compra. No compartimos tu información con terceros no autorizados.
                            </p>
                        </div>
                    </section>
                </div>

                <div className="mt-16 text-center">
                    <p className="text-gray-500">
                        Si tienes alguna duda sobre nuestros términos, por favor <a href="#" className="text-orange-500 hover:underline">contáctanos</a>.
                    </p>
                </div>
            </div>
        </div>
    );
}
