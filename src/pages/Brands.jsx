import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { motion } from 'framer-motion';

const BRANDS = [
  { id: 1, name: 'Mutant', file: 'mutant.png', bg: 'bg-yellow-500', txt: 'text-black', description: 'Potencia extrema para culturistas.' },
  { id: 2, name: 'Insane Labz', file: 'insanelabz.png', bg: 'bg-red-800', txt: 'text-white', description: 'Pre-entrenos de máxima intensidad.' },
  { id: 3, name: 'GAT Sport', file: 'gatsport.png', bg: 'bg-blue-600', txt: 'text-white', description: 'Nitraflex y suplementos premium.' },
  { id: 4, name: 'BPI Sports', file: 'bpisports.png', bg: 'bg-blue-400', txt: 'text-black', description: 'Proteínas limpias y aminoácidos.' },
  { id: 5, name: 'Ronnie Coleman', file: 'ronniecoleman.png', bg: 'bg-yellow-600', txt: 'text-black', description: 'La firma del rey Ronnie.' },
  { id: 6, name: 'Cbum', file: 'cbum.png', bg: 'bg-red-600', txt: 'text-white', description: 'Calidad campeona del Olympia.' },
  { id: 7, name: 'Redcon1', file: 'redcon1.png', bg: 'bg-stone-800', txt: 'text-white', description: 'Estado de máxima preparación.' },
  { id: 8, name: 'Nutrex', file: 'nutrex.png', bg: 'bg-black', txt: 'text-red-500 border border-red-500', description: 'Fórmulas Lipo-6 ultra concentradas.' }
];

export default function Brands() {
  const navigate = useNavigate();

  return (
    <div className="bg-[#0A0A0A] min-h-screen text-white">
      <Navbar />

      <div className="container mx-auto pt-32 px-4 pb-20">
        <h1 className="text-4xl md:text-5xl font-extrabold uppercase text-center text-orange-500 tracking-wider mb-4">
          Nuestras Marcas
        </h1>
        <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16">
          Trabajamos únicamente con las mejores marcas a nivel mundial para garantizar que recibas suplementos originales, seguros y efectivos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {BRANDS.map((brand, index) => (
            <motion.div
              key={brand.id}
              className="bg-[#111] border border-gray-800 rounded-xl p-6 text-center hover:border-orange-500 transition-colors cursor-pointer group"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              <div className={`h-32 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden transition-transform ${brand.bg} shadow-lg group-hover:scale-105 p-6`}>
                {/* Fallback Texto por si falla la imagen logo */}
                <span className={`absolute font-black text-2xl uppercase tracking-widest text-center ${brand.txt} opacity-20`}>{brand.name}</span>
                {/* Imagen del ClearBit API */}
                <img 
                   src={`/brands/${brand.file}`} 
                   alt={brand.name} 
                   className="w-full h-full object-contain relative z-10 drop-shadow-xl"
                   onError={(e) => { e.target.style.display = 'none'; e.target.previousSibling.classList.remove('opacity-20'); }}
                />
              </div>
              <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-2">{brand.name}</h2>
              <p className="text-sm text-gray-500">{brand.description}</p>

              <button
                onClick={() => navigate('/shop', { state: { brand: brand.name } })}
                className="mt-6 w-full py-2 bg-transparent border border-orange-500 text-orange-500 rounded font-bold uppercase text-xs tracking-widest hover:bg-orange-600 hover:text-white transition-all"
              >
                Ver Productos
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
