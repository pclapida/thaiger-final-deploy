import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import { products as productsApi } from '../services/api';
import { buildBrandSummary } from '../lib/catalog';

// Descripciones curadas; el resto de marcas usa un texto genérico con su conteo.
const BRAND_NOTES = {
  MUTANT: 'Potencia extrema para culturistas.',
  'INSANE LABZ': 'Pre-entrenos de máxima intensidad.',
  EVOGEN: 'Fórmulas de Hany Rambod para atletas de élite.',
  CELLUCOR: 'La familia C4, referente mundial en pre-entreno.',
  'HI-TECH': 'Suplementación avanzada y quemadores.',
  NUTREX: 'Fórmulas Lipo-6 ultra concentradas.',
  PROSUPPS: 'Rendimiento sin concesiones.',
  'BIO-SPORT': 'Salud, creatina y esenciales del día a día.',
  'PUMP SAUCE': 'Sabores intensos y bombeo real.',
  PSYCHOPHARMA: 'Energía al límite de la cordura.',
  MUSCLESPORT: 'Proteínas y quemadores premium.',
  PVL: 'Ganadores de masa de calidad canadiense.',
  RAW: 'Ingredientes limpios, sin rellenos.',
  NUTRAKEY: 'Micronutrientes y aminoácidos puros.',
  ENHANCED: 'Comida funcional para tu dieta.',
  CELSIUS: 'Bebidas energéticas para entrenar.',
  DRAGONPHARMA: 'Pre-entrenos de alto impacto.',
  ACCESORIOS: 'Shakers, playeras y equipo Thaiger.',
};

// Paleta cíclica para las marcas sin logotipo propio.
const PALETTE = [
  'bg-yellow-500 text-black',
  'bg-red-800 text-white',
  'bg-blue-600 text-white',
  'bg-stone-800 text-white',
  'bg-orange-600 text-white',
  'bg-emerald-700 text-white',
  'bg-purple-800 text-white',
  'bg-sky-700 text-white',
];

export default function Brands() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    productsApi
      .list()
      .then((list) => {
        if (active) setProducts(list);
      })
      .catch((error) => {
        console.error('No se pudieron cargar las marcas:', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Las marcas se calculan del catálogo real: así "Ver Productos" nunca cae en una lista vacía.
  const brands = useMemo(() => buildBrandSummary(products), [products]);

  return (
    <div className="bg-[#0A0A0A] min-h-screen text-white">
      <Navbar />

      <div className="container mx-auto pt-32 px-4 pb-20">
        <h1 className="text-4xl md:text-5xl font-extrabold uppercase text-center text-orange-500 tracking-wider mb-4">
          Nuestras Marcas
        </h1>
        <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16">
          Trabajamos únicamente con las mejores marcas a nivel mundial para garantizar que recibas
          suplementos originales, seguros y efectivos.
        </p>

        {loading ? (
          <div className="text-center py-20 bg-[#111] rounded-xl border border-gray-800">
            <h3 className="text-2xl font-bold text-orange-500 animate-pulse">Cargando marcas...</h3>
          </div>
        ) : brands.length === 0 ? (
          <div className="text-center py-20 bg-[#111] rounded-xl border border-gray-800">
            <h3 className="text-2xl font-bold text-gray-400">Todavía no hay marcas en el catálogo</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {brands.map((brand, index) => (
              <motion.div
                key={brand.name}
                className="bg-[#111] border border-gray-800 rounded-xl p-6 text-center hover:border-orange-500 transition-colors group flex flex-col"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.3 }}
              >
                <div
                  className={`h-32 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden transition-transform shadow-lg group-hover:scale-105 p-4 ${PALETTE[index % PALETTE.length]}`}
                >
                  {brand.image ? (
                    <img
                      src={brand.image}
                      alt={brand.name}
                      className="w-full h-full object-contain relative z-10 drop-shadow-xl"
                    />
                  ) : (
                    <span className="font-black text-2xl uppercase tracking-widest text-center leading-tight">
                      {brand.name}
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-1">{brand.name}</h2>
                <p className="text-xs text-orange-500 font-bold uppercase tracking-widest mb-2 flex items-center justify-center gap-1">
                  <Package size={12} /> {brand.count} productos
                </p>
                <p className="text-sm text-gray-500 flex-1">
                  {BRAND_NOTES[brand.name] || 'Suplementación original disponible en Thaiger.'}
                </p>

                <button
                  onClick={() => navigate('/shop', { state: { brand: brand.name } })}
                  className="mt-6 w-full py-2 bg-transparent border border-orange-500 text-orange-500 rounded font-bold uppercase text-xs tracking-widest hover:bg-orange-600 hover:text-white transition-all"
                >
                  Ver Productos
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
