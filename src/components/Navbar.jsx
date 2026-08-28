import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'framer-motion';
import {
  ChevronDown,
  LogIn,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Search,
  Shield,
  ShoppingCart,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import { backdrop, drawerRight, resolveVariants, SPRING } from '../lib/motion';
import { sanitizeImageUrl, sanitizeText } from '../lib/security';

/** Enlaces principales. `Admin` se añade sólo si la sesión es de administración. */
const ENLACES = [
  { to: '/shop', etiqueta: 'Tienda' },
  { to: '/brands', etiqueta: 'Marcas' },
  { to: '/offers', etiqueta: 'Ofertas' },
];

const CLAVE_AVISO = 'thaiger_aviso_cerrado';

const SELECTOR_FOCO =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** ¿Este enlace corresponde a la ruta que se está viendo? */
function esRutaActiva(pathname, to) {
  if (to === '/') return pathname === '/';
  // La ficha de producto sigue siendo "Tienda" a efectos de navegación.
  if (to === '/shop' && pathname.startsWith('/product')) return true;
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Texto recordado como cerrado en esta pestaña (vacío si no hay ninguno). */
function avisoRecordado() {
  try {
    return window.sessionStorage?.getItem(CLAVE_AVISO) || '';
  } catch {
    return '';
  }
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const reducido = useReducedMotion();

  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { cartItems } = useCart();
  const { settings } = useSettings();

  const idBase = useId();
  const cabeceraRef = useRef(null);
  const cajonRef = useRef(null);
  const botonMenuRef = useRef(null);
  const zonaUsuarioRef = useRef(null);

  const [busqueda, setBusqueda] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);

  // ------------------------------------------------------------ compactado
  // `useScroll` no provoca render: sólo se cambia el estado al cruzar el umbral.
  const { scrollY } = useScroll();
  const [compacta, setCompacta] = useState(() => (globalThis.scrollY || 0) > 40);
  useMotionValueEvent(scrollY, 'change', (valor) => setCompacta(valor > 40));

  // ------------------------------------------------------------ aviso superior
  const textoAviso = settings?.banner?.active
    ? sanitizeText(settings.banner.text, { maxLength: 160 })
    : '';

  const [avisoCerrado, setAvisoCerrado] = useState(
    () => Boolean(textoAviso) && avisoRecordado() === textoAviso
  );

  // Si el administrador cambia el texto, el aviso vuelve a mostrarse aunque
  // se hubiera cerrado (ajuste durante el render, no en un efecto).
  const [avisoEspejo, setAvisoEspejo] = useState(textoAviso);
  if (avisoEspejo !== textoAviso) {
    setAvisoEspejo(textoAviso);
    setAvisoCerrado(Boolean(textoAviso) && avisoRecordado() === textoAviso);
  }

  const mostrarAviso = Boolean(textoAviso) && !avisoCerrado;

  const cerrarAviso = () => {
    setAvisoCerrado(true);
    try {
      window.sessionStorage?.setItem(CLAVE_AVISO, textoAviso);
    } catch {
      // Sin sessionStorage (modo privado) el aviso simplemente vuelve al recargar.
    }
  };

  // ------------------------------------------------- altura real de la cabecera
  // El aviso de la tienda vive DENTRO del `<header>` fijo, así que la barra no
  // mide siempre 5rem. Se publica la altura medida en `--alto-cabecera` para
  // que todo lo `sticky` de las demás páginas se coloque justo debajo:
  //   top-[calc(var(--alto-cabecera,5rem)+0.5rem)]
  // Se escribe directamente en el DOM —nada de estado— para no provocar un
  // render por cada píxel que cambie durante la transición de compactado.
  useEffect(() => {
    const nodo = cabeceraRef.current;
    if (!nodo) return undefined;

    const raiz = document.documentElement;
    const publicar = () => {
      const alto = Math.round(nodo.getBoundingClientRect().height);
      if (alto > 0) raiz.style.setProperty('--alto-cabecera', `${alto}px`);
    };

    publicar();

    // Sin ResizeObserver (jsdom, navegadores viejos) basta con el redimensionado.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', publicar);
      return () => {
        window.removeEventListener('resize', publicar);
        raiz.style.removeProperty('--alto-cabecera');
      };
    }

    const observador = new ResizeObserver(publicar);
    observador.observe(nodo);
    return () => {
      observador.disconnect();
      raiz.style.removeProperty('--alto-cabecera');
    };
  }, []);

  // ------------------------------------------------- cierre al cambiar de ruta
  const [rutaEspejo, setRutaEspejo] = useState(location.pathname);
  if (rutaEspejo !== location.pathname) {
    setRutaEspejo(location.pathname);
    if (menuAbierto) setMenuAbierto(false);
    if (menuUsuario) setMenuUsuario(false);
  }

  // ------------------------------------------- cajón: foco, Escape y scroll
  useEffect(() => {
    if (!menuAbierto) return undefined;

    const scrollPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const alPulsar = (evento) => {
      if (evento.key === 'Escape') {
        setMenuAbierto(false);
        botonMenuRef.current?.focus();
        return;
      }
      if (evento.key !== 'Tab') return;

      const focales = cajonRef.current?.querySelectorAll(SELECTOR_FOCO);
      if (!focales || focales.length === 0) return;

      const primero = focales[0];
      const ultimo = focales[focales.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', alPulsar);
    // Se enfoca el panel, no el buscador: en un móvil eso abriría el teclado.
    const cuadro = requestAnimationFrame(() => cajonRef.current?.focus());

    return () => {
      document.body.style.overflow = scrollPrevio;
      document.removeEventListener('keydown', alPulsar);
      cancelAnimationFrame(cuadro);
    };
  }, [menuAbierto]);

  // --------------------------------------- menú de usuario: fuera y Escape
  useEffect(() => {
    if (!menuUsuario) return undefined;

    const alClicFuera = (evento) => {
      if (!zonaUsuarioRef.current?.contains(evento.target)) setMenuUsuario(false);
    };
    const alEscape = (evento) => {
      if (evento.key === 'Escape') setMenuUsuario(false);
    };

    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alEscape);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alEscape);
    };
  }, [menuUsuario]);

  // ------------------------------------------------------------------ datos
  const enlaces = isAdmin ? [...ENLACES, { to: '/dashboard', etiqueta: 'Admin', admin: true }] : ENLACES;
  const unidades = cartItems.reduce((total, articulo) => total + (Number(articulo.quantity) || 0), 0);
  const avatar = sanitizeImageUrl(user?.avatar_url);
  const nombreCorto = (user?.name || user?.email || '').split(' ')[0] || 'Mi cuenta';

  const enviarBusqueda = (evento) => {
    evento.preventDefault();
    const termino = busqueda.trim();
    if (!termino) return;

    navigate('/shop', { state: { search: termino } });
    setBusqueda('');
    setMenuAbierto(false);
  };

  const cerrarSesion = async () => {
    setMenuUsuario(false);
    setMenuAbierto(false);
    try {
      await logout();
      toast.success('Sesión cerrada');
      navigate('/');
    } catch {
      toast.error('No se pudo cerrar la sesión.');
    }
  };

  const alturaBarra = compacta ? 'h-16' : 'h-navbar';

  return (
    <>
      <motion.header
        ref={cabeceraRef}
        initial={reducido ? false : { y: -90 }}
        animate={{ y: 0 }}
        transition={reducido ? { duration: 0 } : SPRING.suave}
        className="no-imprimir fixed inset-x-0 top-0 z-50"
      >
        {/* ------------------------------------------------ aviso de la tienda */}
        {mostrarAviso && (
          <motion.div
            initial={reducido ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex h-11 items-center gap-2 bg-brand-600 px-3 text-white sm:h-9"
            role="region"
            aria-label="Aviso de la tienda"
          >
            <Megaphone size={14} className="shrink-0 opacity-90" aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate text-center text-[11px] font-semibold tracking-wide sm:text-xs">
              {textoAviso}
            </p>
            <button
              type="button"
              onClick={cerrarAviso}
              aria-label="Cerrar aviso"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm transition-colors hover:bg-black/20 sm:h-9 sm:w-9"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </motion.div>
        )}

        {/* --------------------------------------------------------- barra */}
        <div
          className={`border-b backdrop-blur transition-colors duration-300 ${
            compacta
              ? 'border-brand-600/25 bg-carbon-950/95 shadow-lg shadow-black/60'
              : 'border-white/5 bg-carbon-950/80'
          }`}
        >
          <div
            className={`mx-auto flex w-full max-w-7xl items-center gap-1 px-3 transition-all duration-300 sm:gap-3 sm:px-4 ${alturaBarra}`}
          >
            {/* Logotipo */}
            <Link
              to="/"
              className="flex shrink-0 items-center gap-2 rounded-sm"
              aria-label="Thaiger Supplements, ir al inicio"
            >
              <img
                src="/logo.png"
                alt=""
                aria-hidden="true"
                className={`object-contain transition-all duration-300 ${compacta ? 'h-8' : 'h-10'}`}
              />
              <span className="hidden text-lg font-black italic tracking-tighter text-white sm:inline">
                THAIGER
              </span>
            </Link>

            {/* Enlaces de escritorio */}
            <nav aria-label="Navegación principal" className="hidden items-center lg:flex">
              {enlaces.map((enlace) => {
                const activo = esRutaActiva(location.pathname, enlace.to);
                return (
                  <Link
                    key={enlace.to}
                    to={enlace.to}
                    aria-current={activo ? 'page' : undefined}
                    className={`relative flex h-11 items-center gap-1.5 px-4 text-sm font-bold uppercase tracking-wide transition-colors ${
                      activo ? 'text-brand-500' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    {enlace.admin && <Shield size={14} aria-hidden="true" />}
                    {enlace.etiqueta}
                    {activo && (
                      <motion.span
                        layoutId="subrayado-navegacion"
                        transition={reducido ? { duration: 0 } : SPRING.firme}
                        className="absolute inset-x-3 bottom-1 h-[3px] rounded-full bg-brand-500"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Buscador de escritorio. El texto va a 16px en móvil (`text-base`)
                porque por debajo de eso Safari iOS hace zoom al enfocar. */}
            <form
              role="search"
              onSubmit={enviarBusqueda}
              className="mx-2 hidden min-w-0 flex-1 md:block lg:max-w-sm"
            >
              <label htmlFor={`${idBase}-buscar`} className="sr-only">
                Buscar productos
              </label>
              <div className="relative">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  id={`${idBase}-buscar`}
                  type="search"
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Buscar productos, marcas..."
                  className="h-10 w-full rounded-sm border border-carbon-600 bg-white/5 pl-9 pr-3 text-base text-white transition-colors placeholder:text-gray-400 focus:border-brand-500 focus:bg-carbon-950 focus:outline-none sm:text-sm"
                />
              </div>
            </form>

            {/* Zona de usuario, carrito y menú */}
            <div className="ml-auto flex items-center gap-1">
              {isAuthenticated ? (
                <div className="relative" ref={zonaUsuarioRef}>
                  <button
                    type="button"
                    onClick={() => setMenuUsuario((abierto) => !abierto)}
                    aria-expanded={menuUsuario}
                    aria-haspopup="true"
                    aria-controls={`${idBase}-menu-usuario`}
                    // El nombre se oculta en móvil, así que la etiqueta accesible
                    // no puede depender del texto visible.
                    aria-label={`Cuenta de ${nombreCorto}`}
                    className="flex h-11 items-center gap-2 rounded-full px-1.5 text-white transition-colors hover:bg-white/5 sm:pr-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-carbon-600 bg-carbon-800">
                      {avatar ? (
                        <img src={avatar} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                      ) : (
                        <User size={18} aria-hidden="true" />
                      )}
                    </span>
                    <span className="hidden max-w-28 truncate text-sm font-bold sm:inline">
                      {nombreCorto}
                    </span>
                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                      className={`hidden transition-transform sm:block ${menuUsuario ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <AnimatePresence>
                    {menuUsuario && (
                      <motion.div
                        id={`${idBase}-menu-usuario`}
                        initial={reducido ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reducido ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.16 }}
                        className="superficie absolute right-0 top-full z-50 mt-2 w-56 origin-top-right overflow-hidden rounded-xl shadow-2xl shadow-black/70"
                      >
                        <div className="border-b border-carbon-600 px-4 py-3">
                          <p className="truncate text-sm font-bold text-white">{user?.name || 'Cuenta'}</p>
                          <p className="truncate text-[11px] text-gray-400">{user?.email}</p>
                        </div>

                        <Link
                          to="/profile"
                          className="flex min-h-11 items-center gap-3 px-4 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-brand-500"
                        >
                          <User size={16} aria-hidden="true" /> Mi perfil
                        </Link>
                        <Link
                          to="/profile"
                          state={{ tab: 'pedidos' }}
                          className="flex min-h-11 items-center gap-3 px-4 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-brand-500"
                        >
                          <Package size={16} aria-hidden="true" /> Mis pedidos
                        </Link>
                        {isAdmin && (
                          <Link
                            to="/dashboard"
                            className="flex min-h-11 items-center gap-3 px-4 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-brand-500"
                          >
                            <Shield size={16} aria-hidden="true" /> Panel de administración
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={cerrarSesion}
                          className="flex min-h-11 w-full items-center gap-3 border-t border-carbon-600 px-4 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-red-500"
                        >
                          <LogOut size={16} aria-hidden="true" /> Cerrar sesión
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="hidden items-center gap-2 sm:flex">
                  <Link
                    to="/login"
                    className="flex min-h-11 items-center gap-1.5 px-3 text-xs font-bold uppercase tracking-wide text-gray-300 transition-colors hover:text-brand-500"
                  >
                    <LogIn size={15} aria-hidden="true" /> Entrar
                  </Link>
                  <Link
                    to="/register"
                    className="flex min-h-11 items-center gap-1.5 rounded-sm bg-brand-600 px-4 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-700"
                  >
                    <UserPlus size={15} aria-hidden="true" /> Registro
                  </Link>
                </div>
              )}

              {/* Carrito */}
              <Link
                to="/cart"
                aria-label={`Carrito de compras, ${unidades} ${unidades === 1 ? 'artículo' : 'artículos'}`}
                className="relative flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/5 hover:text-brand-500"
              >
                <ShoppingCart size={22} aria-hidden="true" />
                {unidades > 0 && (
                  <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center overflow-hidden rounded-full bg-brand-600 px-1 text-[10px] font-black leading-none text-white">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={unidades}
                        initial={reducido ? { opacity: 0 } : { y: -10, opacity: 0, scale: 0.6 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={reducido ? { opacity: 0 } : { y: 10, opacity: 0, scale: 0.6 }}
                        transition={reducido ? { duration: 0.12 } : SPRING.rebote}
                      >
                        {unidades > 99 ? '99+' : unidades}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                )}
              </Link>

              {/* Botón del cajón (móvil y tableta) */}
              <button
                type="button"
                ref={botonMenuRef}
                onClick={() => setMenuAbierto(true)}
                aria-expanded={menuAbierto}
                aria-controls={`${idBase}-cajon`}
                aria-label="Abrir menú"
                className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/5 hover:text-brand-500 lg:hidden"
              >
                <Menu size={22} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Espaciador del aviso: empuja el contenido sin tocar el `pt-navbar`
          de <main>, que sólo compensa la altura de la barra. */}
      {mostrarAviso && <div aria-hidden="true" className="h-11 shrink-0 sm:h-9" />}

      {/* ------------------------------------------------------------ cajón */}
      <AnimatePresence>
        {menuAbierto && (
          <>
            <motion.div
              key="fondo-cajon"
              variants={resolveVariants(backdrop, reducido)}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setMenuAbierto(false)}
              aria-hidden="true"
              className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm lg:hidden"
            />

            <motion.div
              key="cajon"
              id={`${idBase}-cajon`}
              ref={cajonRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Menú de navegación"
              variants={resolveVariants(drawerRight, reducido)}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="custom-scrollbar fixed inset-y-0 right-0 z-[90] flex w-[min(21rem,86vw)] flex-col overflow-y-auto border-l border-carbon-600 bg-carbon-900 focus:outline-none lg:hidden"
            >
              <div className="flex h-navbar shrink-0 items-center justify-between border-b border-carbon-600 px-4">
                <span className="text-base font-black italic tracking-tighter text-white">THAIGER</span>
                <button
                  type="button"
                  onClick={() => setMenuAbierto(false)}
                  aria-label="Cerrar menú"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-white/5 hover:text-brand-500"
                >
                  <X size={22} aria-hidden="true" />
                </button>
              </div>

              <form role="search" onSubmit={enviarBusqueda} className="border-b border-carbon-600 p-4">
                <label htmlFor={`${idBase}-buscar-movil`} className="sr-only">
                  Buscar productos
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                  <input
                    id={`${idBase}-buscar-movil`}
                    type="search"
                    value={busqueda}
                    onChange={(evento) => setBusqueda(evento.target.value)}
                    placeholder="Buscar productos..."
                    className="h-11 w-full rounded-sm border border-carbon-600 bg-carbon-950 pl-9 pr-3 text-base text-white placeholder:text-gray-400 focus:border-brand-500 focus:outline-none sm:text-sm"
                  />
                </div>
              </form>

              <nav aria-label="Navegación del menú" className="flex flex-col p-2">
                {enlaces.map((enlace) => {
                  const activo = esRutaActiva(location.pathname, enlace.to);
                  return (
                    <Link
                      key={enlace.to}
                      to={enlace.to}
                      aria-current={activo ? 'page' : undefined}
                      className={`flex min-h-12 items-center gap-3 rounded-sm px-4 text-sm font-bold uppercase tracking-wide transition-colors ${
                        activo
                          ? 'bg-brand-600/10 text-brand-500'
                          : 'text-gray-200 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {enlace.admin && <Shield size={16} aria-hidden="true" />}
                      {enlace.etiqueta}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto border-t border-carbon-600 p-4">
                {isAuthenticated ? (
                  <div className="space-y-1">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-carbon-600 bg-carbon-800">
                        {avatar ? (
                          <img src={avatar} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                        ) : (
                          <User size={18} aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-white">
                          {user?.name || 'Mi cuenta'}
                        </span>
                        <span className="block truncate text-[11px] text-gray-400">{user?.email}</span>
                      </span>
                    </div>

                    <Link
                      to="/profile"
                      className="flex min-h-11 items-center gap-3 rounded-sm px-2 text-sm text-gray-300 hover:text-brand-500"
                    >
                      <User size={16} aria-hidden="true" /> Mi perfil
                    </Link>
                    <Link
                      to="/profile"
                      state={{ tab: 'pedidos' }}
                      className="flex min-h-11 items-center gap-3 rounded-sm px-2 text-sm text-gray-300 hover:text-brand-500"
                    >
                      <Package size={16} aria-hidden="true" /> Mis pedidos
                    </Link>
                    <button
                      type="button"
                      onClick={cerrarSesion}
                      className="flex min-h-11 w-full items-center gap-3 rounded-sm px-2 text-sm text-gray-400 hover:text-red-500"
                    >
                      <LogOut size={16} aria-hidden="true" /> Cerrar sesión
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Link
                      to="/login"
                      className="flex min-h-11 items-center justify-center gap-2 rounded-sm border border-carbon-600 text-xs font-bold uppercase tracking-widest text-gray-200 transition-colors hover:border-brand-500 hover:text-brand-500"
                    >
                      <LogIn size={15} aria-hidden="true" /> Entrar
                    </Link>
                    <Link
                      to="/register"
                      className="flex min-h-11 items-center justify-center gap-2 rounded-sm bg-brand-600 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
                    >
                      <UserPlus size={15} aria-hidden="true" /> Crear cuenta
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
