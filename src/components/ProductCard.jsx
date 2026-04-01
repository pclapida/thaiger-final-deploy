import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';

export default function ProductCard({ id, brand, category, details, price, image, delay = 0 }) {
  // Si no pasamos ID, usamos 1 por defecto para que no falle el link
  const productId = id || 1;
  const { toggleWishlist, isInWishlist } = useWishlist();

  return (
    <Link to={`/product/${productId}`} className="block h-full">
      <motion.div
        className="group relative bg-[#1a1a1a] p-4 rounded-xl overflow-hidden cursor-pointer h-full flex flex-col"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: delay * 0.1 }}
        whileHover={{
          scale: 1.03,
          backgroundColor: '#222222',
          boxShadow: '0 0 25px rgba(255, 140, 0, 0.4)'
        }}
      >
        {/* Borde brillante animado */}
        <div className="absolute inset-0 border-2 border-transparent group-hover:border-orange-500 rounded-xl transition-all duration-300 z-20 pointer-events-none"></div>

        {/* Botón Favoritos (Independiente del Link) */}
        <button
          onClick={(e) => {
            e.preventDefault();
            // Convertimos el precio back to int, aunque en la Wishlist solo necesitamos data referencial
            toggleWishlist({ id: productId, brand, category, name: details, price1: typeof price === 'string' ? parseInt(price.replace(/[^0-9]/g, '')) : price, image });
          }}
          className="absolute top-4 right-4 z-40 p-2 bg-black/60 backdrop-blur rounded-full hover:bg-black/90 transition-colors"
        >
          <Heart className={`h-5 w-5 ${isInWishlist(productId) ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-white'}`} />
        </button>

        {/* Imagen del Producto o Placeholder */}
        <div className="w-full h-64 bg-white rounded-t-lg mb-4 flex items-center justify-center overflow-hidden relative shrink-0">
          {image ? (
            <img src={image} alt={brand} loading="lazy" className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
          ) : null}
          <ShoppingBag className={`text-gray-400 h-20 w-20 opacity-50 group-hover:scale-110 transition-transform duration-500 ${image ? 'hidden' : 'block'}`} />

          {/* Botón "Añadir Rápido" */}
          <motion.div
            className="absolute bottom-0 left-0 w-full bg-orange-600 text-white text-center py-3 font-bold uppercase translate-y-full group-hover:translate-y-0 transition-transform duration-300"
          >
            Ver Detalles
          </motion.div>
        </div>

        {/* Textos */}
        <div className="text-center z-10 relative mt-auto flex flex-col items-center">
          {category && <span className="text-xs text-orange-400/80 uppercase font-semibold mb-1 tracking-wider">{category}</span>}
          <h3 className="text-orange-500 font-bold uppercase text-lg truncate w-full">{brand || "MARCA"}</h3>
          <p className="text-gray-300 text-sm my-1 line-clamp-2">{details || "DETALLES DEL PRODUCTO"}</p>
          <p className="text-white font-extrabold text-xl mt-2">{price || "$$$$$$"}</p>
        </div>
      </motion.div>
    </Link>
  );
}