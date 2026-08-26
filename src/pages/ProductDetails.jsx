import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import { Package, ArrowLeft, Heart, Star, Minus, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { products as productsApi } from '../services/api';
import { formatPrice, getDisplayPrice, getTierBasePrice, hasDiscount, getDiscountPercent } from '../lib/pricing';

const REVIEWS_KEY = 'thaiger_reviews';

/** Las opiniones se guardan por producto en el navegador. */
function loadReviews(productId) {
  try {
    const all = JSON.parse(localStorage.getItem(REVIEWS_KEY) || '{}');
    return Array.isArray(all[productId]) ? all[productId] : [];
  } catch {
    return [];
  }
}

function saveReviews(productId, reviews) {
  try {
    const all = JSON.parse(localStorage.getItem(REVIEWS_KEY) || '{}');
    all[productId] = reviews;
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(all));
  } catch (error) {
    console.error('No se pudieron guardar las opiniones:', error);
  }
}

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();

  const [productData, setProductData] = useState(null);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [imageFailed, setImageFailed] = useState(false);

  const [added, setAdded] = useState(false);
  const [reviews, setReviews] = useState(() => loadReviews(id));
  const [newReview, setNewReview] = useState('');
  const [newRating, setNewRating] = useState(5);

  // Al pasar de un producto a otro se reinicia todo durante el render,
  // en lugar de encadenar setState dentro de un efecto.
  const [loadedId, setLoadedId] = useState(id);
  if (loadedId !== id) {
    setLoadedId(id);
    setLoading(true);
    setProductData(null);
    setRecommended([]);
    setQuantity(1);
    setImageFailed(false);
    setAdded(false);
    setReviews(loadReviews(id));
  }

  useEffect(() => {
    let active = true;
    window.scrollTo(0, 0);

    Promise.all([productsApi.get(id), productsApi.list()])
      .then(([current, list]) => {
        if (!active) return;
        setProductData(current);

        if (current) {
          const sameBrand = list.filter(
            (p) => p.brand === current.brand && String(p.id) !== String(current.id)
          );
          const others = list.filter((p) => String(p.id) !== String(current.id));
          setRecommended((sameBrand.length > 0 ? sameBrand : others).slice(0, 2));
        }
      })
      .catch((error) => {
        console.error('No se pudo cargar el producto:', error);
        if (active) setProductData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const handleAddToCart = () => {
      addToCart(productData, quantity);
      setAdded(true);
      toast.success(`${quantity} x ${productData.name} en el carrito`);
      setTimeout(() => setAdded(false), 1500);
  };

  const handleAddReview = () => {
      if (!user) {
          toast.error("Debes iniciar sesión para opinar.");
          return;
      }
      if (newReview.trim() === '') {
          toast.error("Por favor escribe una opinión.");
          return;
      }
      const nextReviews = [
        {
          id: `${Date.now()}`,
          user: user.name || user.email?.split('@')[0] || 'Usuario',
          text: newReview.trim(),
          rating: newRating,
          date: new Date().toLocaleDateString('es-MX')
        },
        ...reviews
      ];
      setReviews(nextReviews);
      saveReviews(id, nextReviews);
      setNewReview('');
      toast.success("¡Gracias por tu opinión!");
  };

  if (loading) {
      return (
          <div className="bg-black min-h-screen text-white font-sans flex flex-col items-center justify-center">
              <Navbar />
              <h1 className="text-4xl text-orange-500 font-bold mb-4 animate-pulse">Cargando producto...</h1>
          </div>
      );
  }

  if (!productData) {
      return (
          <div className="bg-black min-h-screen text-white font-sans flex flex-col items-center justify-center">
              <Navbar />
              <h1 className="text-4xl text-orange-500 font-bold mb-4">Producto No Encontrado</h1>
              <Link to="/shop" className="text-gray-400 hover:text-white underline flex items-center gap-2">
                 <ArrowLeft size={16} /> Volver a la Tienda
              </Link>
          </div>
      );
  }

  const listPrice = getTierBasePrice(productData, 1);
  const finalPrice = getDisplayPrice(productData);
  const discounted = hasDiscount(productData);
  const stock = Number(productData.stock);
  const hasStockInfo = Number.isFinite(stock);
  const outOfStock = hasStockInfo && stock <= 0;
  const maxQuantity = hasStockInfo && stock > 0 ? stock : 99;

  const productInfo = {
    brand: productData.brand,
    name: productData.name,
    category: productData.category,
    image: productData.image_url,
    description: productData.description && productData.description.length > 10
      ? productData.description
      : `Potente suplemento de categoría ${productData.category} diseñado en los laboratorios de ${productData.brand} para atletas de clase mundial. Resultados efectivos con la mejor pureza del mercado.`,
    features: [
      { title: "Calidad Garantizada", desc: "Producto sellado y 100% original." },
      { title: "Categoría", desc: productData.category },
      { title: "Integración", desc: "Resultados visibles combinándolo con la rutina correcta." }
    ]
  };

  return (
    <div className="bg-black min-h-screen text-white font-sans pb-20">
      <Navbar />
      <div className="container mx-auto pt-32 px-4">
        
        {/* === SECCIÓN SUPERIOR: IMAGEN Y DATOS BÁSICOS === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          <div className="w-full h-[500px] bg-white rounded-2xl flex items-center justify-center relative overflow-hidden group shadow-2xl shadow-white/5">
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-10"></div>
            {productInfo.image && !imageFailed ? (
                <img
                    src={productInfo.image}
                    alt={productInfo.name}
                    className="w-full h-full object-contain mix-blend-multiply drop-shadow-2xl hover:scale-110 transition-transform duration-700 ease-out"
                    onError={() => setImageFailed(true)}
                />
            ) : (
                <div className="relative z-10 text-gray-400 flex flex-col items-center gap-4">
                     <Package size={72} className="opacity-40" />
                     <span className="text-xs font-bold tracking-widest uppercase text-center text-gray-500">Sin fotografía</span>
                </div>
            )}
          </div>

          <div className="flex flex-col justify-center space-y-6">
            <h3 className="text-gray-400 font-bold tracking-widest uppercase text-lg">{productInfo.brand}</h3>
            <h1 className="text-5xl font-extrabold uppercase leading-tight">{productInfo.name}</h1>

            <div className="flex items-end gap-4 flex-wrap">
                <p className="text-orange-500 text-4xl font-bold">{formatPrice(finalPrice)}</p>
                {discounted && (
                    <>
                        <span className="text-gray-500 line-through text-xl">{formatPrice(listPrice)}</span>
                        <span className="bg-red-600 text-white font-black px-3 py-1 rounded-sm uppercase text-xs tracking-wider">
                            -{getDiscountPercent(productData)}% OFF
                        </span>
                    </>
                )}
            </div>

            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 flex items-start gap-4">
                <Package className="text-white h-10 w-10 flex-shrink-0" />
                <div>
                    <h4 className="font-bold text-lg text-white mb-1">{outOfStock ? 'Producto Agotado' : 'Disponible en Inventario'}</h4>
                    <p className="text-gray-400 text-sm">
                      {outOfStock
                        ? 'Este producto se encuentra temporalmente agotado. Vuelve pronto.'
                        : hasStockInfo
                          ? `${stock} unidades disponibles. Tiempo de entrega varía según el tipo de compra.`
                          : 'Disponible bajo pedido. Tiempo de entrega varía según el tipo de compra.'
                      }
                    </p>
                </div>
            </div>

            {/* Selector de cantidad */}
            {!outOfStock && (
                <div className="flex items-center gap-4">
                    <span className="text-xs uppercase font-bold text-gray-500 tracking-widest">Cantidad</span>
                    <div className="flex items-center border border-gray-700 bg-[#0A0A0A]">
                        <button
                            type="button"
                            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                            className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 transition"
                        >
                            <Minus size={16} />
                        </button>
                        <input
                            type="number"
                            min="1"
                            max={maxQuantity}
                            value={quantity}
                            onChange={(e) => {
                                const value = parseInt(e.target.value, 10);
                                if (Number.isNaN(value)) return setQuantity(1);
                                setQuantity(Math.min(Math.max(1, value), maxQuantity));
                            }}
                            className="w-16 bg-transparent text-center font-bold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                            type="button"
                            disabled={quantity >= maxQuantity}
                            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                            className={`p-3 transition ${quantity >= maxQuantity ? 'text-gray-800 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    <span className="text-sm text-gray-400">
                        Total: <span className="text-white font-bold">{formatPrice(finalPrice * quantity)}</span>
                    </span>
                </div>
            )}

            <div className="flex gap-4 mt-4">
                <button
                  onClick={handleAddToCart}
                  disabled={outOfStock}
                  className={`flex-1 font-bold uppercase py-4 transition-colors rounded-sm ${outOfStock ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : added ? 'bg-green-500 text-white' : 'bg-white text-black hover:bg-gray-200'}`}
                >
                    {outOfStock ? 'Agotado' : added ? '¡Añadido!' : 'Añadir al Carrito'}
                </button>
                <button
                  onClick={() => {
                      addToCart(productData, quantity);
                      navigate('/cart');
                  }}
                  disabled={outOfStock}
                  className={`flex-1 font-bold uppercase py-4 transition-colors rounded-sm ${outOfStock ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-orange-600 text-white hover:bg-orange-700 shadow-[0_0_15px_rgba(255,140,0,0.4)]'}`}
                >
                    {outOfStock ? 'Sin Stock' : 'Comprar Ahora'}
                </button>
                <button 
                  onClick={() => toggleWishlist(productData)}
                  className={`p-4 rounded-sm border-2 transition-colors flex items-center justify-center ${isInWishlist(productData.id) ? 'border-red-500 bg-red-500/10 text-red-500' : 'border-gray-700 hover:border-orange-500 text-gray-400 hover:text-orange-500'}`}
                  title="Añadir a Deseos"
                >
                    <Heart className={isInWishlist(productData.id) ? "fill-current" : ""} />
                </button>
            </div>
          </div>
        </div>

        {/* === SECCIÓN MEDIA: BENEFICIOS Y TABLA === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start mb-20">
            <div>
                <h2 className="text-5xl font-extrabold text-orange-600 italic mb-8 uppercase">Descripción General</h2>
                <div className="space-y-8">
                    <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-line">
                        {productInfo.description}
                    </p>
                    {productInfo.features.map((item, i) => (
                        <div key={i}>
                            <h3 className="text-xl font-bold text-white mb-2">{item.title}:</h3>
                            <p className="text-gray-400 leading-relaxed text-lg whitespace-pre-line">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-bold text-white mb-6 text-center">Fórmula y Respaldos</h2>
                <div className="bg-[#111] p-8 rounded-lg border border-gray-800 text-sm shadow-xl">
                    <p className="font-semibold text-gray-300 mb-6 text-base leading-relaxed">
                        La formulación bio-disponible de <span className="text-orange-500 font-bold">{productInfo.name}</span> ha sido construida para entregar componentes de asimilación rápida a tu tejido muscular.
                    </p>
                    
                    <div className="space-y-4 mb-8">
                        <div className="flex items-center justify-between border-b border-gray-800/80 pb-3 text-gray-400">
                            <span className="font-bold text-white tracking-wider uppercase text-xs">Clasificación:</span> 
                            <span className="bg-orange-600/20 text-orange-500 px-3 py-1 rounded-sm text-xs font-bold">{productInfo.category}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-gray-800/80 pb-3 text-gray-400">
                            <span className="font-bold text-white tracking-wider uppercase text-xs">Acreditación:</span> 
                            <span>{productInfo.brand} Original</span>
                        </div>
                    </div>
                    
                    <div className="mt-8 pt-4 border-t border-orange-600/30 text-xs leading-relaxed text-gray-500 font-medium">
                        <span className="font-bold text-orange-500 uppercase">Nota Sanitaria:</span> Los macronutrientes, perfiles de aminoácidos y calorías exactas varían profundamente entre los distintos sabores y lotes de importación. Te solicitamos inspeccionar minuciosamente el 'Nutrition Facts' de la etiqueta trasera de tu envase al recibirlo.
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-12 mt-12 mb-12">
         <div className="lg:col-span-1 bg-[#111] p-6 rounded-xl border border-gray-800 flex flex-col h-full max-h-[600px]">
            <h3 className="font-bold text-white mb-4 uppercase text-xl">Opiniones de Clientes</h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-6 custom-scrollbar">
                {reviews.length === 0 && (
                    <p className="text-gray-500 text-sm italic">
                        Todavía no hay opiniones de este producto. ¡Sé el primero en escribir una!
                    </p>
                )}
                {reviews.map((rev) => (
                    <div key={rev.id} className="bg-black/50 p-4 rounded-sm border border-gray-800">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-white text-sm">{rev.user}</h4>
                            <div className="flex text-orange-500">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} size={12} className={i < rev.rating ? 'fill-current' : 'text-gray-700'} />
                                ))}
                            </div>
                        </div>
                        <p className="text-gray-400 text-xs italic mb-1">{rev.date}</p>
                        <p className="text-gray-300 text-sm">{rev.text}</p>
                    </div>
                ))}
            </div>

            <div className="border-t border-gray-800 pt-4 mt-auto">
                <div className="flex gap-2 mb-3">
                    <span className="text-xs text-gray-400 uppercase font-bold">Calificación:</span>
                    <select value={newRating} onChange={e => setNewRating(Number(e.target.value))} className="bg-gray-900 text-orange-500 text-xs border border-gray-700 rounded-sm focus:outline-none">
                        <option value={5}>5 Estrellas</option>
                        <option value={4}>4 Estrellas</option>
                        <option value={3}>3 Estrellas</option>
                        <option value={2}>2 Estrellas</option>
                        <option value={1}>1 Estrella</option>
                    </select>
                </div>
                <textarea 
                    value={newReview}
                    onChange={(e) => setNewReview(e.target.value)}
                    placeholder="Escribe tu opinión aquí..."
                    className="w-full bg-[#0A0A0A] border border-gray-700 p-3 text-white text-sm focus:border-orange-500 focus:outline-none rounded-sm mb-3 resize-none h-20"
                ></textarea>
                <button 
                  onClick={handleAddReview}
                  className="bg-red-800 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-sm w-full transition-colors uppercase text-sm tracking-wider shadow-lg"
                >
                    Publicar Opinión
                </button>
            </div>
         </div>

         <div className="lg:col-span-2">
            <div className="flex justify-between items-end mb-6 border-b border-gray-800 pb-2">
                <h3 className="font-bold text-white uppercase text-sm tracking-widest">Recomendaciones</h3>
                <Link to="/shop" className="text-xs text-orange-500 cursor-pointer hover:text-white transition-colors">Ver más productos</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {recommended.length > 0 ? (
                    recommended.map((rec, index) => (
                        <ProductCard key={rec.id} product={rec} delay={index} />
                    ))
                ) : (
                    <div className="text-gray-500 italic text-sm">No hay sugerencias disponibles.</div>
                )}
            </div>
         </div>
      </div>
    </div>
  );
}