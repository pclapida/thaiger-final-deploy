import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, User, ShoppingCart, LogIn, UserPlus, LogOut, Menu, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const NavLink = ({ to, children }) => {
  const location = useLocation();
  const isActive = (location.pathname.startsWith(to) && to !== '/') || location.pathname === to;
  
  return (
    <Link to={to} className="relative px-4 py-2 flex flex-col items-center justify-center group h-14 min-w-[5rem] overflow-visible">
      <span className={`text-sm font-bold uppercase transition-transform duration-300 z-10 ${isActive ? 'text-orange-500 -translate-y-4' : 'text-white group-hover:-translate-y-4 group-hover:text-orange-400'}`}>
        {children}
      </span>
      
      {/* Indicador Musculoso Activo */}
      {isActive && (
        <motion.img 
            src="/loader.png" 
            alt="Active Icon" 
            className="absolute -bottom-2 w-12 h-12 object-contain mix-blend-screen brightness-200 contrast-125 z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, -4, 0] }}
            transition={{ 
                opacity: { duration: 0.2 },
                y: { repeat: Infinity, duration: 1, ease: "easeInOut" }
            }}
        />
      )}
      
      {/* Indicador Hover Fantasma */}
      {!isActive && (
         <img 
            src="/loader.png" 
            alt="Hover Icon" 
            className="absolute -bottom-2 w-12 h-12 object-contain opacity-0 group-hover:opacity-40 transition-all duration-300 translate-y-4 group-hover:translate-y-0 mix-blend-screen brightness-200 z-0"
         />
      )}
    </Link>
  );
};

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { cartItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const cartItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // El menú móvil se cierra solo al cambiar de página (ajuste durante el render,
  // no en un efecto, para no encadenar renders extra).
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setIsMenuOpen(false);
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const submitSearch = () => {
    if (searchQuery.trim() === '') return;
    navigate('/shop', { state: { search: searchQuery.trim() } });
    setSearchQuery('');
    setIsMenuOpen(false);
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter') submitSearch();
  };

  return (
    <motion.nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-black/95 shadow-md shadow-orange-500/20 py-2' : 'bg-black/60 py-4'}`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto px-4 flex flex-col gap-4">

        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/">
            <img src="/logo.png" alt="Thaiger" className="h-10 object-contain" />
          </Link>

          {/* Links Centrales */}
          <div className="hidden md:flex items-center gap-8 flex-1 justify-center ml-8">
            <div className="flex gap-6">
              {user?.role === 'admin' && (
                <NavLink to="/dashboard">Admin</NavLink>
              )}
              <NavLink to="/shop">Tienda</NavLink>
              <NavLink to="/brands">Marcas</NavLink>
              <NavLink to="/offers">Ofertas</NavLink>
            </div>

            <div className="relative w-full max-w-xs lg:max-w-md hidden sm:block">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="BUSCAR..."
                className="w-full bg-white/10 border border-transparent focus:border-orange-500 rounded-sm py-1 px-4 pl-10 text-white placeholder-gray-400 focus:outline-none focus:bg-black transition-all text-sm tracking-wider"
              />
              <Search className="absolute left-3 top-1.5 text-gray-400 h-4 w-4" />
            </div>
          </div>

          {/* Zona de Usuario (Dinámica) */}
          <div className="flex items-center gap-4 text-white">

            {isAuthenticated ? (
              // === SI ESTÁ LOGUEADO: Icono de Usuario y Logout ===
              <div className="flex items-center gap-3">
                <Link to="/profile">
                  <motion.button whileHover={{ scale: 1.1, color: '#ff8c00' }} className="flex items-center justify-center p-0.5 rounded-full bg-gray-900 border border-gray-700 hover:border-orange-500 transition-colors overflow-hidden h-9 w-9">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="User Settings" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <User className="h-5 w-5 m-auto" />
                    )}
                  </motion.button>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-xs font-bold uppercase text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                  title="Cerrar Sesión"
                >
                  <LogOut size={16} /> <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            ) : (
              // === SI NO ESTÁ LOGUEADO: Botones Login/Register permanentemente visibles ===
              <div className="flex items-center gap-2 mr-2">
                <Link to="/login" className="text-xs font-bold uppercase px-3 py-1.5 border border-transparent hover:text-orange-500 transition-colors flex items-center gap-1">
                  <LogIn size={14} className="hidden sm:block" /> Entrar
                </Link>
                <Link to="/register" className="text-xs font-bold uppercase px-3 py-1.5 bg-orange-600 text-white hover:bg-orange-700 rounded transition-colors flex items-center gap-1">
                  <UserPlus size={14} className="hidden sm:block" /> Registro
                </Link>
              </div>
            )}

            {/* Carrito (Siempre visible) */}
            <Link to="/cart">
              <motion.button whileHover={{ scale: 1.1, color: '#ff8c00' }} className="relative p-2 ml-2">
                <ShoppingCart className="h-6 w-6" />
                {cartItemsCount > 0 && (
                  <div className="absolute top-0 -right-1 bg-orange-600 text-[10px] rounded-full w-4 h-4 flex items-center justify-center text-white font-bold">
                    {cartItemsCount}
                  </div>
                )}
              </motion.button>
            </Link>

            {/* Botón de menú (sólo móvil) */}
            <button
              onClick={() => setIsMenuOpen((open) => !open)}
              className="md:hidden p-2 text-white hover:text-orange-500 transition-colors"
              aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* === MENÚ MÓVIL === */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-800 pt-4 pb-2 space-y-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="BUSCAR PRODUCTOS..."
                className="w-full bg-white/10 border border-transparent focus:border-orange-500 rounded-sm py-2 px-4 pl-10 text-white placeholder-gray-400 focus:outline-none focus:bg-black transition-all text-sm tracking-wider"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400 h-4 w-4" />
            </div>

            <div className="flex flex-col">
              {user?.role === 'admin' && (
                <Link to="/dashboard" className="py-3 text-sm font-bold uppercase text-orange-500 border-b border-gray-800">
                  Admin
                </Link>
              )}
              <Link to="/shop" className="py-3 text-sm font-bold uppercase text-white border-b border-gray-800">Tienda</Link>
              <Link to="/brands" className="py-3 text-sm font-bold uppercase text-white border-b border-gray-800">Marcas</Link>
              <Link to="/offers" className="py-3 text-sm font-bold uppercase text-white border-b border-gray-800">Ofertas</Link>
              {isAuthenticated && (
                <Link to="/profile" className="py-3 text-sm font-bold uppercase text-white border-b border-gray-800">Mi Perfil</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.nav>
  );
}