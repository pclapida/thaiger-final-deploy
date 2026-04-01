import React from 'react';
import Navbar from '../components/Navbar';
import { Target, Zap, Shield } from 'lucide-react';

export default function AboutUs() {
    return (
        <div className="bg-[#0A0A0A] min-h-screen text-white font-sans selection:bg-orange-500 selection:text-black">
            <Navbar />
            <div className="container mx-auto pt-32 px-4 pb-20 max-w-4xl">
                <header className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-extrabold uppercase text-orange-500 tracking-wider mb-4">
                        Quiénes Somos
                    </h1>
                    <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                        Thaiger Supplements nace con un solo objetivo: llevar nutrición de alto rendimiento a los atletas que no aceptan excusas.
                    </p>
                </header>

                <div className="space-y-16">
                    <section className="bg-[#111] p-8 md:p-12 rounded-sm border border-gray-800">
                        <div className="flex flex-col md:flex-row gap-8 items-center">
                            <div className="flex-1 space-y-4">
                                <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-6">Nuestra Misión</h2>
                                <p className="text-gray-400 leading-relaxed text-lg">
                                    En la industria del fitness, sobran las promesas vacías y fórmulas rebajadas. En **Thaiger Supplements**, investigamos, probamos y entregamos suplementos puros diseñados para romper el estancamiento.
                                </p>
                                <p className="text-gray-400 leading-relaxed text-lg">
                                    Si entrenas duro, necesitas combustible duro. Por eso importamos la materia prima más potente y trabajamos de la mano con deportistas profesionales para garantizar resultados reales.
                                </p>
                            </div>
                            <div className="md:w-1/3 flex justify-center">
                                <Zap size={120} className="text-orange-500 opacity-20" />
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center pt-8">
                        <div className="bg-black border border-gray-800 p-8 rounded-sm hover:-translate-y-2 transition-transform">
                            <Target size={40} className="text-orange-500 mx-auto mb-6" />
                            <h3 className="text-xl font-bold uppercase mb-4">Fórmulas Extremas</h3>
                            <p className="text-sm text-gray-500">Ingredientes probados clínicamente, dosificados al máximo para resultados brutales.</p>
                        </div>
                        <div className="bg-black border border-gray-800 p-8 rounded-sm hover:-translate-y-2 transition-transform">
                            <Shield size={40} className="text-orange-500 mx-auto mb-6" />
                            <h3 className="text-xl font-bold uppercase mb-4">Materia Premium</h3>
                            <p className="text-sm text-gray-500">Sin rellenos mágicos. Lo que ves en la etiqueta es exactamente lo que entra en tu cuerpo.</p>
                        </div>
                        <div className="bg-black border border-gray-800 p-8 rounded-sm hover:-translate-y-2 transition-transform">
                            <Zap size={40} className="text-orange-500 mx-auto mb-6" />
                            <h3 className="text-xl font-bold uppercase mb-4">Comunidad Fuerte</h3>
                            <p className="text-sm text-gray-500">No solo vendemos polvo. Formamos gigantes. Únete y compruébalo hoy mismo.</p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
