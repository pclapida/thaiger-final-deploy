import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';

export default function ProductCard({ id, brand, category, details, price, image, delay = 0, stock, isOnSale, discountPercent }) {
  const outOfStock = stock !== undefined && stock !== null && stock <= 0;
  const productId = id || 1;
  const { toggleWishlist, isInWishlist } = useWishlist();

  // Logic to handle sale price
  const originalPrice = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^0-9.]/g, '')) || 0;
  const hasDiscount = isOnSale && discountPercent > 0;
  const salePrice = hasDiscount ? (originalPrice * (1 - discountPercent / 100)) : originalPrice;

  const formatPrice = (val) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(val);
  };

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

        {/* Badge de Descuento (Solo si está en oferta) */}
        {hasDiscount && (
          <div className="absolute -top-1 -left-1 bg-red-600 text-white font-black px-3 py-1 rounded-sm border-2 border-black z-30 shadow-lg transform -rotate-12 uppercase text-[10px] tracking-tight">
            -{discountPercent}% OFF
          </div>
        )}

        {/* Botón Favoritos */}
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist({ id: productId, brand, category, name: details, price1: originalPrice, image, is_on_sale: isOnSale, discount_percent: discountPercent });
          }}
          className="absolute top-4 right-4 z-40 p-2 bg-black/60 backdrop-blur rounded-full hover:bg-black/90 transition-colors"
        >
          <Heart className={`h-5 w-5 ${isInWishlist(productId) ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-white'}`} />
        </button>

        {/* Imagen del Producto */}
        <div className="w-full h-64 bg-white rounded-t-lg mb-4 flex items-center justify-center overflow-hidden relative shrink-0">
          {image ? (
            <img src={image} alt={brand} loading="lazy" className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
          ) : null}
          <ShoppingBag className={`text-gray-400 h-20 w-20 opacity-50 group-hover:scale-110 transition-transform duration-500 ${image ? 'hidden' : 'block'}`} />

          {/* Botón "Ver Detalles" */}
          <motion.div
            className={`absolute bottom-0 left-0 w-full text-white text-center py-3 font-bold uppercase translate-y-full group-hover:translate-y-0 transition-transform duration-300 ${outOfStock ? 'bg-gray-600' : 'bg-orange-600'}`}
          >
            {outOfStock ? 'Agotado' : 'Ver Detalles'}
          </motion.div>

          {/* Overlay AGOTADO */}
          {outOfStock && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <span className="bg-red-600 text-white font-black text-sm px-4 py-2 rounded-full uppercase tracking-widest">Agotado</span>
            </div>
          )}
        </div>

        {/* Textos */}
        <div className="text-center z-10 relative mt-auto flex flex-col items-center">
          {category && <span className="text-xs text-orange-400/80 uppercase font-semibold mb-1 tracking-wider">{category}</span>}
          <h3 className="text-orange-500 font-bold uppercase text-lg truncate w-full">{brand || "MARCA"}</h3>
          <p className="text-gray-300 text-sm my-1 line-clamp-2">{details || "DETALLES DEL PRODUCTO"}</p>
          
          <div className="mt-2 flex flex-col items-center">
            {hasDiscount ? (
              <>
                <span className="text-gray-500 line-through text-xs font-bold uppercase">{formatPrice(originalPrice)}</span>
                <span className="text-white font-black text-2xl tracking-tighter shadow-orange-500/20">{formatPrice(salePrice)}</span>
              </>
            ) : (
              <span className="text-white font-black text-2xl tracking-tighter">{formatPrice(originalPrice)}</span>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}