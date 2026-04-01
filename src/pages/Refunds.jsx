import React from 'react';
import Navbar from '../components/Navbar';
import { AlertCircle, Lock, RefreshCw } from 'lucide-react';

export default function Refunds() {
    return (
        <div className="bg-[#0A0A0A] min-h-screen text-white font-sans selection:bg-orange-500 selection:text-black">
            <Navbar />
            <div className="container mx-auto pt-32 px-4 pb-20 max-w-4xl">
                <header className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-extrabold uppercase text-orange-500 tracking-wider mb-4">
                        Políticas de Devolución
                    </h1>
                    <p className="text-gray-400">Todo terreno seguro. Reglas claras y honestas.</p>
                </header>

                <div className="space-y-8">
                    <div className="bg-[#111] p-8 rounded-sm mx-auto border-l-4 border-orange-500">
                        <div className="flex items-center gap-4 mb-4">
                            <Lock className="text-orange-500 shrink-0" size={32} />
                            <h2 className="text-2xl font-bold uppercase text-white tracking-widest">Cero Tolerancia a Productos Abiertos</h2>
                        </div>
                        <p className="text-gray-400 mb-4 leading-relaxed text-sm">
                            Por estrictas normas de bioseguridad y control de calidad emitidas por las autoridades sanitarias, **Thaiger Supplements NO acepta cambios ni devoluciones bajo ninguna circunstancia de productos cuyos sellos originales, plastificados o envolturas de fábrica hayan sido violadas, retiradas o manipuladas.**
                        </p>
                        <p className="text-gray-400 leading-relaxed text-sm">
                            Una vez que el suplemento es abierto de su envase primario, queda permanentemente descalificado para cualquier programa de reembolso o cambio, aún si es al primer segundo de abrir la tapa. Tu salud y la higiene es nuestra prioridad extrema.
                        </p>
                    </div>

                    <div className="bg-[#111] p-8 rounded-sm mx-auto border-l-4 border-gray-800 hover:border-orange-500 transition-colors">
                        <div className="flex items-center gap-4 mb-4">
                            <AlertCircle className="text-orange-500 shrink-0" size={32} />
                            <h2 className="text-2xl font-bold uppercase text-white tracking-widest">Productos Dañados en Tránsito</h2>
                        </div>
                        <p className="text-gray-400 mb-4 leading-relaxed text-sm">
                            Si tu paquete fue brutalmente golpeado por la empresa transportista y afectó de manera crítica la integridad interior del envase rompiéndolo, tienes el blindaje y derecho a reclamar una reposición cubierta al 100%.
                        </p>
                        <p className="text-white font-bold uppercase text-sm mb-2">Pasos obligatorios si esto ocurre:</p>
                        <ol className="list-decimal pl-5 text-gray-500 space-y-2 text-sm">
                            <li>Debes notificar por correo de atención al cliente en **un máximo de 3 días naturales** (72 horas) contando a partir día y hora en que firmaste de recibido de parte del mensajero.</li>
                            <li>Debes enviar un video de evidencia periférica (360 grados) y fotografías donde los sellos de seguridad originales sigan completamente intactos y en el empaque de nuestro logo.</li>
                            <li>Una vez aprobado e investigado, nuestro equipo coordinará el envío cruzado gratuito (Tú lo envías devuelto al origen, nosotros te enviamos la reposición con guías pre-pagadas).</li>
                        </ol>
                    </div>

                    <div className="bg-[#111] p-8 rounded-sm mx-auto border-l-4 border-gray-800 hover:border-orange-500 transition-colors">
                        <div className="flex items-center gap-4 mb-4">
                            <RefreshCw className="text-orange-500 shrink-0" size={32} />
                            <h2 className="text-2xl font-bold uppercase text-white tracking-widest">Cancelaciones de Facturas SPEI</h2>
                        </div>
                        <p className="text-gray-400 mb-4 leading-relaxed text-sm">
                            Si realizas una orden en línea utilizando transferencia directa de banco a banco (SPEI) y decides cancelar la orden horas antes de que enviemos tu paquete para embalaje, el dinero será reembolsado a la misma cuenta clave receptora deduciendo un monto fijo técnico de **$50 MXN** exactos, utilizado para cubrir honorarios administrativos. 
                        </p>
                        <p className="text-gray-400 text-sm">
                            Atención: Una vez que el número de guía de paquetería se encuentre impreso y escaneado a activo (Estatus: "Enviado"), toda venta administrativa se vuelve sólida y de carácter final. No se pueden procesar cancelaciones de órdenes en pleno tránsito urbano.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
