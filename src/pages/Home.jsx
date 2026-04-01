import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';

const HERO_BRANDS = [
  { name: 'MUTANT', img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2000&auto=format&fit=crop', subtitle: 'DEJA LA HUMANIDAD ATRÁS' },
  { name: 'INSANE LABZ', img: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2000&auto=format&fit=crop', subtitle: 'MAYOR ENERGÍA Y ENFOQUE' },
  { name: 'GAT SPORT', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2000&auto=format&fit=crop', subtitle: 'SUPLEMENTACIÓN DE ÉLITE' }
];

export default function Home() {
  const [productosDestacados, setProductosDestacados] = useState([]);
  const [productosPromociones, setProductosPromociones] = useState([]);

  useEffect(() => {
    const fetchHomeProducts = async () => {
        // Pedimos 8 productos aleatorios (limitados a los ultimos subidos por simplicidad técnica)
        const { data, error } = await supabase.from('products').select('*').limit(8).order('id', { ascending: false });
        if (data && data.length >= 8) {
            setProductosDestacados(data.slice(0, 4));
            setProductosPromociones(data.slice(4, 8));
        } else if (data) {
            setProductosDestacados(data.slice(0, 4));
            setProductosPromociones(data.slice(0, 4));
        }
    };
    fetchHomeProducts();
  }, []);

  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const slideInterval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % HERO_BRANDS.length);
    }, 4500);
    return () => clearInterval(slideInterval);
  }, []);

  return (
    <div className="bg-black min-h-screen text-white font-sans selection:bg-orange-500 selection:text-white">

      <Navbar />

      {/* HERO CAROUSEL SECTION */}
      <div className="relative w-full h-[600px] pt-24 overflow-hidden bg-black">
        <AnimatePresence mode="wait">
            <motion.div
                key={currentSlide}
                className="absolute inset-0 w-full h-full"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
            >
                <img src={HERO_BRANDS[currentSlide].img} alt="Banner Marca" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
                <div className="container mx-auto h-full flex items-center relative z-10 px-4">
                  <div className="max-w-2xl pl-4 md:pl-10">
                    <motion.div
                      initial={{ x: -50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    >
                      <h1 className="text-5xl md:text-7xl font-extrabold italic leading-tight uppercase">
                         <span className="text-orange-600 border-b-4 border-orange-600 pb-2">{HERO_BRANDS[currentSlide].name}</span>
                      </h1>
                      <h2 className="text-3xl md:text-4xl font-bold mt-6 mb-6 text-gray-200">
                        {HERO_BRANDS[currentSlide].subtitle}
                      </h2>
                      <p className="text-xl uppercase font-semibold tracking-widest mb-8 border-l-4 border-orange-600 pl-4">
                        Distribuidores Oficiales Thaiger
                      </p>
                      <Link to="/shop" state={{ brand: HERO_BRANDS[currentSlide].name }}>
                          <button className="bg-orange-600 hover:bg-orange-700 text-white px-10 py-4 font-bold uppercase text-lg tracking-wider transition-transform active:scale-95 skew-x-[-10deg]">
                            Ver Productos {HERO_BRANDS[currentSlide].name}
                          </button>
                      </Link>
                    </motion.div>
                  </div>
                </div>
            </motion.div>
        </AnimatePresence>
        
        {/* Indicadores de Slide */}
        <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center gap-3">
            {HERO_BRANDS.map((_, idx) => (
                <button 
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`w-12 h-1.5 rounded-full transition-colors ${idx === currentSlide ? 'bg-orange-500' : 'bg-gray-600'}`}
                />
            ))}
        </div>
      </div>

      {/* SECCIÓN: DESTACADOS */}
      <div className="container mx-auto px-4 py-16">
        <h3 className="text-center text-gray-300 uppercase tracking-[0.2em] text-sm font-bold mb-10">Destacados</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {productosDestacados.length > 0 ? productosDestacados.map((prod, index) => (
             <ProductCard 
                key={prod.id} 
                id={prod.id} 
                brand={prod.brand} 
                details={prod.name} 
                price={`$${prod.price1}`} 
                category={prod.category}
                image={prod.image_url} 
             />
          )) : <div className="col-span-4 text-center text-gray-500">Cargando destacados...</div>}
        </div>
      </div>

      {/* SECCIÓN: PROMOCIONES */}
      <div className="container mx-auto px-4 pb-16">
        <h3 className="text-center text-gray-300 uppercase tracking-[0.2em] text-sm font-bold mb-10">Promociones</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {productosPromociones.length > 0 ? productosPromociones.map((prod, index) => (
            <ProductCard 
               key={prod.id} 
               id={prod.id} 
               brand={prod.brand} 
               details={prod.name} 
               price={`$${prod.price1}`} 
               category={prod.category}
               image={prod.image_url} 
            />
          )) : <div className="col-span-4 text-center text-gray-500">Cargando promociones...</div>}
        </div>
      </div>

      {/* SECCIÓN: MARCAS POPULARES */}
      <div className="container mx-auto px-4 pb-20">
        <h3 className="text-center text-gray-300 uppercase tracking-[0.2em] text-sm font-bold mb-6">Marcas mas populares</h3>
        <div className="border border-gray-800 bg-[#0a0a0a] p-8 rounded-xl flex flex-wrap justify-center items-center gap-12 opacity-60 hover:opacity-100 transition-opacity duration-500">
          {['MUTANT', 'INSANE LABZ', 'GAT SPORT', 'NUTREX', 'RONNIE COLEMAN'].map((marca, i) => (
            <Link
              to="/shop"
              state={{ brand: marca }}
              key={i}
              className="text-xl font-bold italic text-gray-500 hover:text-white cursor-pointer transition-colors"
            >
              {marca}
            </Link>
          ))}
        </div>
      </div>

      {/* YA NO HAY FOOTER AQUÍ - AHORA ES GLOBAL EN APP.JSX */}
    </div>
  );
}