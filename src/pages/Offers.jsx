import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import { Tag } from 'lucide-react';
import { supabase } from '../supabase';

export default function Offers() {
  const [realOffers, setRealOffers] = useState([]);

  useEffect(() => {
    const fetchOffers = async () => {
        // Obtenemos un set de productos (ej. los primeros 8 para mostrarlos con descuento simulado)
        const { data } = await supabase.from('products').select('*').limit(8).order('price1', { ascending: false });
        if (data) {
            setRealOffers(data);
        }
    };
    fetchOffers();
  }, []);
  return (
    <div className="bg-[#0A0A0A] min-h-screen text-white">
      <Navbar />
      
      <div className="container mx-auto pt-32 px-4 pb-20">
        
        <div className="flex flex-col items-center justify-center text-center mb-16">
            <div className="bg-orange-500 p-4 rounded-full mb-6">
                <Tag className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold uppercase text-orange-500 tracking-wider mb-4">
            Ofertas y Combos Especiales
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto">
            Aprovecha nuestros descuentos de temporada y combos armados especialmente para maximizar tus resultados sin gastar de más.
            </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {realOffers.length > 0 ? realOffers.map((offer, index) => {
                // Simulamos un descuento inflado de un +25% que aplicaba antes
                const oldPriceNum = (Number(offer.price1) * 1.25).toFixed(2);
                
                return (
                    <div key={offer.id} className="relative">
                        <ProductCard 
                            id={offer.id} 
                            delay={index % 4}
                            brand={offer.brand}
                            details={offer.name}
                            image={offer.image_url}
                            price={
                                <div className="flex items-center gap-2 justify-center mt-2">
                                    <span className="text-gray-500 line-through text-sm">${oldPriceNum}</span>
                                    <span className="text-orange-500 font-extrabold text-xl">${offer.price1}</span>
                                </div>
                            }
                            category={offer.category}
                        />
                        <div className="absolute -top-3 -right-3 bg-red-600 text-white font-black px-3 py-1 rounded-full border-2 border-black z-30 shadow-lg transform rotate-12">
                            -20%
                        </div>
                    </div>
                );
            }) : (
                <div className="col-span-full text-center text-gray-500 py-10">
                    Calculando súper ofertas...
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
