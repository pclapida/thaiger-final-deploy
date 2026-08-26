import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import { Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { products as productsApi } from '../services/api';
import { hasDiscount, getDiscountPercent } from '../lib/pricing';

export default function Offers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    productsApi
      .list()
      .then((list) => {
        if (!active) return;
        // Sólo lo que el administrador marcó como oferta, del mayor descuento al menor.
        setOffers(
          list
            .filter(hasDiscount)
            .sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a))
        );
      })
      .catch((error) => {
        console.error('No se pudieron cargar las ofertas:', error);
        if (active) setOffers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
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
            Aprovecha nuestros descuentos de temporada y combos armados especialmente para maximizar tus
            resultados sin gastar de más.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 bg-[#111] rounded-xl border border-gray-800">
            <h3 className="text-2xl font-bold text-orange-500 mb-2 animate-pulse">Cargando ofertas...</h3>
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-20 bg-[#111] rounded-xl border border-gray-800">
            <h3 className="text-2xl font-bold text-gray-400 mb-2">No hay ofertas activas</h3>
            <p className="text-gray-500 mb-6">
              Vuelve pronto, nuestro equipo está preparando descuentos increíbles.
            </p>
            <Link to="/shop" className="text-orange-500 font-bold uppercase text-sm hover:text-white transition-colors">
              Ver todo el catálogo
            </Link>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-6">{offers.length} productos con descuento activo.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {offers.map((offer, index) => (
                <ProductCard key={offer.id} product={offer} delay={index % 4} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
