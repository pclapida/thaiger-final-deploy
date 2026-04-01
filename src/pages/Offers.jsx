import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import { Tag } from 'lucide-react';
import { supabase } from '../supabase';

const formatPrice = (price) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price);
};

export default function Offers() {
  const [realOffers, setRealOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOffers = async () => {
        setLoading(true);
        // Solo traer productos que el admin marcó como "en oferta"
        const { data } = await supabase.from('products').select('*').eq('is_on_sale', true).order('discount_percent', { ascending: false });
        if (data) {
            setRealOffers(data);
        }
        setLoading(false);
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

        {loading ? (
            <div className="text-center py-20 bg-[#111] rounded-xl border border-gray-800">
                <h3 className="text-2xl font-bold text-orange-500 mb-2 animate-pulse">Cargando ofertas...</h3>
            </div>
        ) : realOffers.length === 0 ? (
            <div className="text-center py-20 bg-[#111] rounded-xl border border-gray-800">
                <h3 className="text-2xl font-bold text-gray-400 mb-2">No hay ofertas activas</h3>
                <p className="text-gray-500">Vuelve pronto, nuestro equipo está preparando descuentos increíbles.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {realOffers.map((offer, index) => {
                    const discount = offer.discount_percent || 10;
                    const originalPrice = offer.price1;
                    const salePrice = (originalPrice * (1 - discount / 100)).toFixed(2);
                    
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
                                        <span className="text-gray-500 line-through text-sm">{formatPrice(originalPrice)}</span>
                                        <span className="text-orange-500 font-extrabold text-xl">{formatPrice(salePrice)}</span>
                                    </div>
                                }
                                category={offer.category}
                                stock={offer.stock}
                            />
                            <div className="absolute -top-3 -right-3 bg-red-600 text-white font-black px-3 py-1 rounded-full border-2 border-black z-30 shadow-lg transform rotate-12">
                                -{discount}%
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
    </div>
  );
}
