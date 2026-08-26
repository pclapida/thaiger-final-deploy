import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Heart, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { formatPrice, getTierBasePrice, getDisplayPrice, hasDiscount, getDiscountPercent } from '../lib/pricing';
import toast from 'react-hot-toast';

/**
 * Tarjeta de producto del catálogo.
 * Recibe el producto completo para que precio, oferta, stock y foto siempre
 * salgan de la misma fuente (antes cada página armaba props distintas).
 */
export default function ProductCard({ product, delay = 0 }) {
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [imageFailed, setImageFailed] = useState(false);

  if (!product) return null;

  const { id, brand, category, name, image_url: image, stock } = product;

  const outOfStock = stock !== undefined && stock !== null && Number(stock) <= 0;
  const listPrice = getTierBasePrice(product, 1);
  const finalPrice = getDisplayPrice(product);
  const discounted = hasDiscount(product);
  const showImage = Boolean(image) && !imageFailed;

  const handleQuickAdd = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (outOfStock) return;
    addToCart(product, 1);
    toast.success('Añadido al carrito');
  };

  return (
    <Link to={`/product/${id}`} className="block h-full">
      <motion.div
        className="group relative bg-[#1a1a1a] p-4 rounded-xl overflow-hidden cursor-pointer h-full flex flex-col"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: delay * 0.1 }}
        whileHover={{
          scale: 1.03,
          backgroundColor: '#222222',
          boxShadow: '0 0 25px rgba(255, 140, 0, 0.4)',
        }}
      >
        {/* Borde brillante animado */}
        <div className="absolute inset-0 border-2 border-transparent group-hover:border-orange-500 rounded-xl transition-all duration-300 z-20 pointer-events-none"></div>

        {/* Badge de descuento */}
        {discounted && (
          <div className="absolute -top-1 -left-1 bg-red-600 text-white font-black px-3 py-1 rounded-sm border-2 border-black z-30 shadow-lg transform -rotate-12 uppercase text-[10px] tracking-tight">
            -{getDiscountPercent(product)}% OFF
          </div>
        )}

        {/* Favoritos */}
        <button
          type="button"
          aria-label="Añadir a favoritos"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(product);
          }}
          className="absolute top-4 right-4 z-40 p-2 bg-black/60 backdrop-blur rounded-full hover:bg-black/90 transition-colors"
        >
          <Heart className={`h-5 w-5 ${isInWishlist(id) ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-white'}`} />
        </button>

        {/* Imagen */}
        <div className="w-full h-64 bg-white rounded-t-lg mb-4 flex items-center justify-center overflow-hidden relative shrink-0">
          {showImage ? (
            <img
              src={image}
              alt={name || brand}
              loading="lazy"
              className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <ShoppingBag className="text-gray-400 h-20 w-20 opacity-50 group-hover:scale-110 transition-transform duration-500" />
          )}

          <div
            className={`absolute bottom-0 left-0 w-full text-white text-center py-3 font-bold uppercase translate-y-full group-hover:translate-y-0 transition-transform duration-300 ${outOfStock ? 'bg-gray-600' : 'bg-orange-600'}`}
          >
            {outOfStock ? 'Agotado' : 'Ver Detalles'}
          </div>

          {outOfStock && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <span className="bg-red-600 text-white font-black text-sm px-4 py-2 rounded-full uppercase tracking-widest">
                Agotado
              </span>
            </div>
          )}
        </div>

        {/* Textos */}
        <div className="text-center z-10 relative mt-auto flex flex-col items-center">
          {category && (
            <span className="text-xs text-orange-400/80 uppercase font-semibold mb-1 tracking-wider">{category}</span>
          )}
          <h3 className="text-orange-500 font-bold uppercase text-lg truncate w-full">{brand || 'MARCA'}</h3>
          <p className="text-gray-300 text-sm my-1 line-clamp-2">{name || 'Detalles del producto'}</p>

          <div className="mt-2 flex flex-col items-center">
            {discounted ? (
              <>
                <span className="text-gray-500 line-through text-xs font-bold uppercase">{formatPrice(listPrice)}</span>
                <span className="text-white font-black text-2xl tracking-tighter">{formatPrice(finalPrice)}</span>
              </>
            ) : (
              <span className="text-white font-black text-2xl tracking-tighter">{formatPrice(finalPrice)}</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={outOfStock}
            className={`mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors ${
              outOfStock
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-orange-600/10 text-orange-500 border border-orange-600/40 hover:bg-orange-600 hover:text-white'
            }`}
          >
            <Plus size={14} /> {outOfStock ? 'Sin stock' : 'Agregar'}
          </button>
        </div>
      </motion.div>
    </Link>
  );
}
