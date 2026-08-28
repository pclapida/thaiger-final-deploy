import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Box,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Heart,
  KeyRound,
  LayoutDashboard,
  Loader2,
  MapPin,
  PackageCheck,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  Truck,
  User,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { auth as authApi, orders as ordersApi, products as productsApi } from '../services/api';
import { formatPrice } from '../lib/pricing';
import { ESTADOS_PEDIDO } from '../lib/metrics';
import { sanitizeImageUrl, sanitizeText, validatePassword } from '../lib/security';
import { fadeUp, resolveVariants, staggerContainer, staggerItem } from '../lib/motion';
import ProductCard from '../components/ProductCard';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { TextAreaField, TextField, inputClasses } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import useDocumentTitle from '../hooks/useDocumentTitle';

// --------------------------------------------------------------- direcciones

/** La libreta vive en el navegador: el checkout no depende de ella. */
function claveDirecciones(userId) {
  return `thaiger_addresses_${userId}`;
}

function leerDirecciones(userId) {
  if (!userId) return [];
  try {
    const crudo = window.localStorage.getItem(claveDirecciones(userId));
    const lista = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    // Un JSON corrupto no debe tumbar el perfil: se empieza de cero.
    return [];
  }
}

function escribirDirecciones(userId, lista) {
  if (!userId) return;
  try {
    window.localStorage.setItem(claveDirecciones(userId), JSON.stringify(lista));
  } catch {
    // Almacenamiento lleno o bloqueado: la libreta sigue viva en memoria.
  }
}

const DIRECCION_VACIA = {
  alias: '',
  nombre: '',
  telefono: '',
  calle: '',
  ciudad: '',
  cp: '',
  referencias: '',
};

/** Limpia lo que escribió la persona antes de guardarlo. */
function sanearDireccion(borrador) {
  return {
    alias: sanitizeText(borrador.alias, { maxLength: 40 }),
    nombre: sanitizeText(borrador.nombre, { maxLength: 90 }),
    telefono: sanitizeText(borrador.telefono, { maxLength: 25 }),
    calle: sanitizeText(borrador.calle, { maxLength: 160 }),
    ciudad: sanitizeText(borrador.ciudad, { maxLength: 60 }),
    cp: sanitizeText(borrador.cp, { maxLength: 10 }),
    referencias: sanitizeText(borrador.referencias, { maxLength: 300, allowNewlines: true }),
  };
}

// -------------------------------------------------------------------- varios

const PESTANAS = [
  { id: 'pedidos', label: 'Mis Pedidos', icon: Box },
  { id: 'favoritos', label: 'Mis Favoritos', icon: Heart },
  { id: 'direcciones', label: 'Direcciones', icon: MapPin },
  { id: 'cuenta', label: 'Detalles de Cuenta', icon: User },
];

const ESTILO_ESTADO = {
  'Pago Pendiente': { clases: 'bg-brand-600/15 text-brand-400 border-brand-600/40', icono: Clock },
  'En Proceso': { clases: 'bg-brand-600/15 text-brand-400 border-brand-600/40', icono: Box },
  Enviado: { clases: 'bg-sky-950/40 text-sky-300 border-sky-800', icono: Truck },
  Entregado: { clases: 'bg-emerald-950/40 text-emerald-300 border-emerald-800', icono: PackageCheck },
  Cancelado: { clases: 'bg-red-950/40 text-red-400 border-red-900', icono: XCircle },
};

function EtiquetaEstado({ estado }) {
  const { clases, icono: Icono } = ESTILO_ESTADO[estado] || ESTILO_ESTADO['Pago Pendiente'];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${clases}`}
    >
      <Icono size={14} aria-hidden="true" /> {estado}
    </span>
  );
}

function formatearFecha(valor) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return 'Fecha no disponible';
  return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

function referenciaCorta(id) {
  return `TH-${String(id ?? '').split('-')[0].toUpperCase()}`;
}

// ================================================================== componente

export default function UserProfile() {
  useDocumentTitle('Mi cuenta', 'Consulta tus pedidos, tus favoritos, tus direcciones y los datos de tu cuenta Thaiger.');

  const { user, updateProfile } = useAuth();
  const { wishlistItems } = useWishlist();
  const { addToCart } = useCart();
  const reduced = useReducedMotion();

  const userId = user?.id;
  const [pestana, setPestana] = useState('pedidos');

  // ------------------------------------------------------------- pedidos
  const [pedidos, setPedidos] = useState([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(Boolean(userId));
  const [errorPedidos, setErrorPedidos] = useState('');
  const [intento, setIntento] = useState(0);
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [pedidoAbierto, setPedidoAbierto] = useState(null);
  const [repitiendo, setRepitiendo] = useState(null);

  useEffect(() => {
    if (!userId) return undefined;

    let activo = true;
    ordersApi
      .listByUser(userId)
      .then((lista) => {
        if (!activo) return;
        setPedidos(Array.isArray(lista) ? lista : []);
        setErrorPedidos('');
      })
      .catch(() => {
        if (!activo) return;
        setPedidos([]);
        setErrorPedidos('No pudimos cargar tu historial de pedidos.');
      })
      .finally(() => {
        if (activo) setCargandoPedidos(false);
      });

    return () => {
      activo = false;
    };
  }, [userId, intento]);

  const reintentarPedidos = () => {
    setCargandoPedidos(true);
    setErrorPedidos('');
    setIntento((previo) => previo + 1);
  };

  const estadosDisponibles = useMemo(() => {
    const presentes = new Set(pedidos.map((pedido) => pedido.status));
    return ['Todos', ...ESTADOS_PEDIDO.filter((estado) => presentes.has(estado))];
  }, [pedidos]);

  const pedidosVisibles = useMemo(
    () => (filtroEstado === 'Todos' ? pedidos : pedidos.filter((pedido) => pedido.status === filtroEstado)),
    [pedidos, filtroEstado]
  );

  const repetirPedido = async (pedido) => {
    setRepitiendo(pedido.id);
    try {
      let anadidos = 0;
      for (const linea of pedido.order_items || []) {
        const producto = await productsApi.get(linea.product_id);
        if (!producto) continue;
        addToCart(producto, Math.max(1, Number(linea.quantity) || 1));
        anadidos += 1;
      }

      if (anadidos === 0) toast.error('Los productos de este pedido ya no están disponibles.');
      else toast.success(`${anadidos} producto(s) añadidos al carrito.`);
    } catch {
      toast.error('No pudimos volver a armar este pedido.');
    } finally {
      setRepitiendo(null);
    }
  };

  // --------------------------------------------------------- direcciones
  const [direcciones, setDirecciones] = useState(() => leerDirecciones(userId));
  const [usuarioLibreta, setUsuarioLibreta] = useState(userId);
  const [borrador, setBorrador] = useState(null);
  const [erroresDireccion, setErroresDireccion] = useState({});
  const [direccionABorrar, setDireccionABorrar] = useState(null);

  // Cambio de cuenta: se recarga la libreta durante el render, sin efectos.
  if (userId !== usuarioLibreta) {
    setUsuarioLibreta(userId);
    setDirecciones(leerDirecciones(userId));
  }

  const guardarLibreta = (lista) => {
    setDirecciones(lista);
    escribirDirecciones(userId, lista);
  };

  const abrirNuevaDireccion = () => {
    setErroresDireccion({});
    setBorrador({ ...DIRECCION_VACIA, id: null, nombre: user?.name || '' });
  };

  const abrirEdicion = (direccion) => {
    setErroresDireccion({});
    setBorrador({ ...DIRECCION_VACIA, ...direccion });
  };

  const guardarDireccion = (evento) => {
    evento.preventDefault();
    const limpia = sanearDireccion(borrador);

    const fallos = {};
    if (!limpia.alias) fallos.alias = 'Ponle un nombre para reconocerla (Casa, Oficina...).';
    if (!limpia.nombre) fallos.nombre = 'Escribe quién recibe.';
    if (!limpia.telefono) fallos.telefono = 'Necesitamos un teléfono de contacto.';
    if (!limpia.calle) fallos.calle = 'Escribe la calle y el número.';
    if (!limpia.ciudad) fallos.ciudad = 'Escribe la ciudad.';
    if (!/^\d{5}$/.test(limpia.cp)) fallos.cp = 'El código postal son 5 dígitos.';

    setErroresDireccion(fallos);
    if (Object.keys(fallos).length > 0) return;

    if (borrador.id) {
      guardarLibreta(direcciones.map((item) => (item.id === borrador.id ? { ...item, ...limpia } : item)));
      toast.success('Dirección actualizada.');
    } else {
      const nueva = {
        ...limpia,
        id: `dir-${Date.now().toString(36)}`,
        // La primera dirección guardada manda por defecto.
        predeterminada: direcciones.length === 0,
      };
      guardarLibreta([...direcciones, nueva]);
      toast.success('Dirección guardada.');
    }

    setBorrador(null);
  };

  const marcarPredeterminada = (id) => {
    guardarLibreta(direcciones.map((item) => ({ ...item, predeterminada: item.id === id })));
    toast.success('Dirección predeterminada actualizada.');
  };

  const confirmarBorrado = () => {
    const restantes = direcciones.filter((item) => item.id !== direccionABorrar.id);
    // Si se borró la predeterminada, la primera que quede toma el relevo.
    if (restantes.length > 0 && !restantes.some((item) => item.predeterminada)) {
      restantes[0] = { ...restantes[0], predeterminada: true };
    }
    guardarLibreta(restantes);
    setDireccionABorrar(null);
    toast.success('Dirección eliminada.');
  };

  // -------------------------------------------------------------- cuenta
  const [nombrePublico, setNombrePublico] = useState(user?.name || '');
  const [fotoURL, setFotoURL] = useState(user?.avatar_url || '');
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [mensajePerfil, setMensajePerfil] = useState('');
  const [errorPerfil, setErrorPerfil] = useState('');

  const manejarArchivo = async (evento) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;

    setSubiendoFoto(true);
    setErrorPerfil('');
    try {
      const url = await authApi.uploadAvatar(archivo);
      setFotoURL(url);
      toast.success('Foto lista. Guarda los cambios para aplicarla.');
    } catch (fallo) {
      setErrorPerfil(fallo?.message || 'No se pudo procesar la imagen.');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const guardarPerfil = async (evento) => {
    evento.preventDefault();
    setMensajePerfil('');
    setErrorPerfil('');

    const nombre = sanitizeText(nombrePublico, { maxLength: 60 });
    if (!nombre) {
      setErrorPerfil('Escribe cómo quieres que te llamemos.');
      return;
    }

    const foto = fotoURL ? sanitizeImageUrl(fotoURL) : null;
    if (fotoURL && !foto) {
      setErrorPerfil('Esa dirección de imagen no es válida.');
      return;
    }

    setGuardandoPerfil(true);
    const resultado = await updateProfile({ name: nombre, avatar_url: foto });
    setGuardandoPerfil(false);

    if (resultado.success) {
      setMensajePerfil('¡Perfil actualizado con éxito!');
      toast.success('Perfil actualizado');
    } else {
      setErrorPerfil(resultado.error?.message || 'No se pudo actualizar el perfil.');
    }
  };

  // --------------------------------------------------- cambio de contraseña
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [erroresClave, setErroresClave] = useState({});
  const [mensajeClave, setMensajeClave] = useState('');
  const [cambiandoClave, setCambiandoClave] = useState(false);

  const cambiarContrasena = async (evento) => {
    evento.preventDefault();
    setMensajeClave('');

    const fallos = {};
    if (!actual) fallos.actual = 'Escribe tu contraseña actual.';
    const problema = validatePassword(nueva);
    if (problema) fallos.nueva = problema;
    if (nueva !== confirmacion) fallos.confirmacion = 'La confirmación no coincide.';

    setErroresClave(fallos);
    if (Object.keys(fallos).length > 0) return;

    setCambiandoClave(true);
    try {
      await authApi.changePassword(actual, nueva);
      setActual('');
      setNueva('');
      setConfirmacion('');
      setMensajeClave('Tu contraseña se cambió correctamente.');
      toast.success('Contraseña actualizada');
    } catch (fallo) {
      setErroresClave({ actual: fallo?.message || 'No se pudo cambiar la contraseña.' });
    } finally {
      setCambiandoClave(false);
    }
  };

  // ------------------------------------------------------------------ vista

  const avatar = user?.avatar_url;
  const esAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-carbon-900 text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* ------------------------------------------------------ cabecera */}
        <motion.header
          variants={resolveVariants(fadeUp, reduced)}
          initial="hidden"
          animate="visible"
          className="superficie flex flex-col gap-6 rounded-2xl p-6 sm:flex-row sm:items-center sm:p-8"
        >
          <button
            type="button"
            onClick={() => setPestana('cuenta')}
            className="group relative mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-brand-600 bg-carbon-900 sm:mx-0"
            aria-label="Cambiar foto de perfil"
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <User size={40} className="mx-auto text-gray-500" aria-hidden="true" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/65 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera size={22} aria-hidden="true" />
            </span>
          </button>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="titulo-seccion truncate font-black uppercase italic tracking-tight text-white">
              {user?.name || 'Usuario Thaiger'}
            </h1>
            <p className="mt-1 truncate text-sm text-gray-400">{user?.email}</p>

            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                  esAdmin ? 'border-brand-600/40 bg-brand-600/15 text-brand-400' : 'border-gray-700 bg-carbon-700 text-gray-300'
                }`}
              >
                <ShieldCheck size={13} aria-hidden="true" /> {esAdmin ? 'Administrador' : 'Cliente'}
              </span>
              {user?.created_at && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-800 px-3 py-1 text-[11px] uppercase tracking-wider text-gray-500">
                  Miembro desde {formatearFecha(user.created_at)}
                </span>
              )}
            </div>
          </div>

          {esAdmin && (
            <Link
              to="/dashboard"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-sm border border-brand-600/50 px-5 py-3 text-xs font-bold uppercase tracking-widest text-brand-500 transition-colors hover:bg-brand-600 hover:text-white"
            >
              <LayoutDashboard size={16} aria-hidden="true" /> Panel
            </Link>
          )}
        </motion.header>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-10">
          {/* Barra de pestañas: carrusel horizontal en móvil, lateral en escritorio. */}
          <nav
            aria-label="Secciones de tu cuenta"
            className="custom-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {PESTANAS.map((entrada) => {
              const Icono = entrada.icon;
              const { id, label } = entrada;
              const activa = pestana === id;
              const contador = id === 'pedidos' ? pedidos.length : id === 'favoritos' ? wishlistItems.length : null;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPestana(id)}
                  aria-current={activa ? 'page' : undefined}
                  className={`flex min-h-[48px] shrink-0 items-center gap-3 whitespace-nowrap rounded-sm border-l-4 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors lg:w-full ${
                    activa
                      ? 'border-brand-500 bg-carbon-800 text-white'
                      : 'border-transparent text-gray-500 hover:bg-carbon-800 hover:text-gray-200'
                  }`}
                >
                  <Icono size={18} className={activa ? 'text-brand-500' : ''} aria-hidden="true" />
                  {label}
                  {contador > 0 && (
                    <span
                      aria-hidden="true"
                      className="ml-auto hidden rounded-full bg-carbon-700 px-2 py-0.5 text-[10px] text-gray-400 lg:inline"
                    >
                      {contador}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <main className="min-w-0 flex-1">
            {/* ================================================== pedidos */}
            {pestana === 'pedidos' && (
              <section aria-labelledby="titulo-pedidos">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <h2 id="titulo-pedidos" className="flex items-center gap-2 text-xl font-black uppercase tracking-wide">
                    <Box className="text-brand-500" size={22} aria-hidden="true" /> Historial de Pedidos
                  </h2>

                  {pedidos.length > 0 && (
                    <div className="w-full sm:w-auto">
                      <label htmlFor="filtro-estado" className="sr-only">
                        Filtrar por estado
                      </label>
                      <select
                        id="filtro-estado"
                        value={filtroEstado}
                        onChange={(evento) => setFiltroEstado(evento.target.value)}
                        className="min-h-[44px] w-full rounded-sm border border-gray-700 bg-carbon-900 px-4 text-sm text-white focus:border-brand-500 focus:outline-none sm:w-56"
                      >
                        {estadosDisponibles.map((estado) => (
                          <option key={estado} value={estado}>
                            {estado === 'Todos' ? 'Todos los estados' : estado}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {cargandoPedidos ? (
                  <div role="status" aria-label="Cargando tus pedidos" className="space-y-4">
                    {Array.from({ length: 3 }, (_, indice) => (
                      <Skeleton key={indice} className="h-32 w-full" />
                    ))}
                  </div>
                ) : errorPedidos ? (
                  <EmptyState
                    icon={XCircle}
                    title="No pudimos cargar tus pedidos"
                    message={errorPedidos}
                    actionLabel="Reintentar"
                    onAction={reintentarPedidos}
                  />
                ) : pedidos.length === 0 ? (
                  <EmptyState
                    icon={Box}
                    title="Sin pedidos todavía"
                    message="Aún no has guardado pedidos en el historial."
                    actionLabel="Ir a la tienda"
                    actionTo="/shop"
                  />
                ) : pedidosVisibles.length === 0 ? (
                  <EmptyState
                    icon={Box}
                    title="Ningún pedido con ese estado"
                    message={`No tienes pedidos en estado "${filtroEstado}".`}
                    actionLabel="Ver todos"
                    onAction={() => setFiltroEstado('Todos')}
                  />
                ) : (
                  <motion.ul
                    variants={resolveVariants(staggerContainer(0.06), reduced)}
                    initial="hidden"
                    animate="visible"
                    className="space-y-4"
                  >
                    {pedidosVisibles.map((pedido) => {
                      const abierto = pedidoAbierto === pedido.id;
                      const lineas = pedido.order_items || [];

                      return (
                        <motion.li
                          key={pedido.id}
                          variants={resolveVariants(staggerItem, reduced)}
                          className="superficie rounded-xl transition-colors hover:border-brand-600/50"
                        >
                          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-3">
                                <h3 className="text-lg font-black tracking-wide text-white" title={pedido.id}>
                                  {referenciaCorta(pedido.id)}
                                </h3>
                                <EtiquetaEstado estado={pedido.status} />
                              </div>
                              <p className="text-sm text-gray-400">Realizado el {formatearFecha(pedido.created_at)}</p>
                              <p className="text-sm text-gray-500">{lineas.length} artículos</p>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 lg:flex-col lg:items-end">
                              <span className="text-2xl font-black tracking-tight text-brand-500">
                                {formatPrice(pedido.total)}
                              </span>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                SPEI: {pedido.payment_info?.concepto || 'N/A'}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 px-5 py-3 sm:px-6">
                            <button
                              type="button"
                              onClick={() => setPedidoAbierto(abierto ? null : pedido.id)}
                              aria-expanded={abierto}
                              aria-controls={`detalle-${pedido.id}`}
                              className="inline-flex min-h-[44px] items-center gap-2 px-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-white"
                            >
                              <ChevronDown
                                size={16}
                                aria-hidden="true"
                                className={`transition-transform ${abierto ? 'rotate-180' : ''}`}
                              />
                              {abierto ? 'Ocultar detalle' : 'Ver detalle'}
                            </button>

                            <button
                              type="button"
                              onClick={() => repetirPedido(pedido)}
                              disabled={repitiendo === pedido.id || lineas.length === 0}
                              className="ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-gray-700 px-4 text-xs font-bold uppercase tracking-widest text-gray-300 transition-colors hover:border-brand-500 hover:text-white disabled:opacity-50"
                            >
                              {repitiendo === pedido.id ? (
                                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                              ) : (
                                <RotateCcw size={15} aria-hidden="true" />
                              )}
                              Volver a comprar
                            </button>
                          </div>

                          {abierto && (
                            <div id={`detalle-${pedido.id}`} className="border-t border-gray-800 px-5 py-4 sm:px-6">
                              <ul className="divide-y divide-gray-800">
                                {lineas.map((linea) => (
                                  <li key={linea.id || linea.product_id} className="flex items-center justify-between gap-4 py-3">
                                    <span className="min-w-0 flex-1 truncate text-sm text-gray-300">
                                      {linea.product_name || `Producto ${linea.product_id}`}
                                    </span>
                                    <span className="shrink-0 text-xs uppercase tracking-wider text-gray-500">
                                      x{linea.quantity}
                                    </span>
                                    <span className="shrink-0 text-sm font-bold text-white">
                                      {formatPrice(Number(linea.price_at_purchase) * Number(linea.quantity))}
                                    </span>
                                  </li>
                                ))}
                              </ul>

                              <dl className="mt-4 space-y-1 border-t border-gray-800 pt-4 text-sm">
                                <div className="flex justify-between text-gray-400">
                                  <dt>Subtotal</dt>
                                  <dd>{formatPrice(pedido.subtotal ?? pedido.total)}</dd>
                                </div>
                                <div className="flex justify-between text-gray-400">
                                  <dt>Envío</dt>
                                  <dd>{Number(pedido.shipping_cost) > 0 ? formatPrice(pedido.shipping_cost) : 'Gratis'}</dd>
                                </div>
                                <div className="flex justify-between pt-1 font-bold text-white">
                                  <dt>Total</dt>
                                  <dd className="text-brand-500">{formatPrice(pedido.total)}</dd>
                                </div>
                              </dl>

                              {pedido.shipping_info?.address && (
                                <p className="mt-4 text-xs leading-relaxed text-gray-500">
                                  Envío a: {pedido.shipping_info.address}, {pedido.shipping_info.city} {pedido.shipping_info.zip}
                                </p>
                              )}
                            </div>
                          )}
                        </motion.li>
                      );
                    })}
                  </motion.ul>
                )}
              </section>
            )}

            {/* =============================================== favoritos */}
            {pestana === 'favoritos' && (
              <section aria-labelledby="titulo-favoritos">
                <h2 id="titulo-favoritos" className="mb-6 flex items-center gap-2 text-xl font-black uppercase tracking-wide">
                  <Heart className="text-brand-500" size={22} aria-hidden="true" /> Mis Favoritos
                </h2>

                {wishlistItems.length === 0 ? (
                  <EmptyState
                    icon={Heart}
                    title="Tu lista está vacía"
                    message="No tienes productos en tu lista de deseos. Toca el corazón de cualquier producto para guardarlo aquí."
                    actionLabel="Explorar catálogo"
                    actionTo="/shop"
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {wishlistItems.map((producto, indice) => (
                      <ProductCard key={producto.id} product={producto} delay={indice} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ============================================= direcciones */}
            {pestana === 'direcciones' && (
              <section aria-labelledby="titulo-direcciones">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <h2 id="titulo-direcciones" className="flex items-center gap-2 text-xl font-black uppercase tracking-wide">
                    <MapPin className="text-brand-500" size={22} aria-hidden="true" /> Direcciones
                  </h2>
                  <button
                    type="button"
                    onClick={abrirNuevaDireccion}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-sm bg-brand-600 px-5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
                  >
                    <Plus size={16} aria-hidden="true" /> Añadir dirección
                  </button>
                </div>

                <p className="mb-6 text-sm leading-relaxed text-gray-500">
                  Tu libreta se guarda en este navegador para que no vuelvas a escribir lo mismo en cada compra.
                </p>

                {direcciones.length === 0 ? (
                  <EmptyState
                    icon={MapPin}
                    title="Sin direcciones guardadas"
                    message="Guarda tus direcciones frecuentes y tenlas a mano cuando compres."
                    actionLabel="Añadir la primera"
                    onAction={abrirNuevaDireccion}
                  />
                ) : (
                  <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {direcciones.map((direccion) => (
                      <li key={direccion.id} className="superficie flex flex-col rounded-xl p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-black uppercase tracking-wider text-white">{direccion.alias}</h3>
                          {direccion.predeterminada && (
                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-600/40 bg-brand-600/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-400">
                              <Star size={12} aria-hidden="true" /> Predeterminada
                            </span>
                          )}
                        </div>

                        <address className="mt-3 flex-1 space-y-1 text-sm not-italic leading-relaxed text-gray-400">
                          <p className="text-gray-300">{direccion.nombre}</p>
                          <p>{direccion.calle}</p>
                          <p>
                            {direccion.ciudad} · C.P. {direccion.cp}
                          </p>
                          <p>Tel. {direccion.telefono}</p>
                          {direccion.referencias && <p className="text-gray-500">{direccion.referencias}</p>}
                        </address>

                        <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-800 pt-4">
                          {!direccion.predeterminada && (
                            <button
                              type="button"
                              onClick={() => marcarPredeterminada(direccion.id)}
                              className="inline-flex min-h-[44px] items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-brand-500"
                            >
                              <Star size={14} aria-hidden="true" /> Predeterminada
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => abrirEdicion(direccion)}
                            className="inline-flex min-h-[44px] items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-white"
                          >
                            <Pencil size={14} aria-hidden="true" /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDireccionABorrar(direccion)}
                            className="ml-auto inline-flex min-h-[44px] items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-red-500"
                          >
                            <Trash2 size={14} aria-hidden="true" /> Eliminar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* ================================================== cuenta */}
            {pestana === 'cuenta' && (
              <section aria-labelledby="titulo-cuenta" className="space-y-8">
                <h2 id="titulo-cuenta" className="flex items-center gap-2 text-xl font-black uppercase tracking-wide">
                  <User className="text-brand-500" size={22} aria-hidden="true" /> Configuración de Cuenta
                </h2>

                <form onSubmit={guardarPerfil} className="superficie space-y-6 rounded-xl p-6 sm:p-8">
                  <TextField
                    label="Nombre público"
                    value={nombrePublico}
                    onChange={(evento) => setNombrePublico(evento.target.value)}
                    placeholder="Tu nombre completo o apodo"
                    maxLength={60}
                    autoComplete="name"
                  />

                  <div className="space-y-3">
                    <label htmlFor="perfil-foto" className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                      Foto de Perfil
                    </label>

                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-carbon-900">
                        {fotoURL ? (
                          <img src={fotoURL} alt="Vista previa de tu foto de perfil" className="h-full w-full object-cover" />
                        ) : (
                          <User size={24} className="text-gray-600" aria-hidden="true" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <input
                          id="perfil-foto"
                          type="file"
                          accept="image/*"
                          onChange={manejarArchivo}
                          disabled={subiendoFoto}
                          className="w-full rounded-sm border border-gray-700 bg-carbon-900 p-2 text-sm text-gray-400 file:mr-3 file:rounded file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-brand-700"
                        />
                        <p aria-live="polite" className="mt-1 text-xs text-brand-500">
                          {subiendoFoto ? 'Procesando imagen...' : ''}
                        </p>
                      </div>
                    </div>

                    <input
                      type="url"
                      aria-label="URL de la foto de perfil"
                      value={fotoURL?.startsWith('data:') ? '' : fotoURL}
                      onChange={(evento) => setFotoURL(evento.target.value)}
                      className={inputClasses()}
                      placeholder="...o pega la URL de una imagen"
                    />

                    {fotoURL && (
                      <button
                        type="button"
                        onClick={() => setFotoURL('')}
                        className="min-h-[44px] text-xs font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-red-500"
                      >
                        Quitar foto
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="perfil-correo" className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                      Correo electrónico (no editable)
                    </label>
                    <input
                      id="perfil-correo"
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full cursor-not-allowed rounded-sm border border-gray-800 bg-carbon-900 p-3 text-gray-500"
                    />
                  </div>

                  <div aria-live="polite" className="space-y-2">
                    {mensajePerfil && (
                      <p className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                        <CheckCircle2 size={16} aria-hidden="true" /> {mensajePerfil}
                      </p>
                    )}
                    {errorPerfil && (
                      <p role="alert" className="text-sm font-bold text-red-500">
                        {errorPerfil}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={guardandoPerfil}
                    aria-busy={guardandoPerfil}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-sm bg-brand-600 px-6 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                  >
                    {guardandoPerfil ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Save size={16} aria-hidden="true" />
                    )}
                    Guardar Cambios
                  </button>
                </form>

                {/* ------------------------------------- cambio de contraseña */}
                <form onSubmit={cambiarContrasena} className="superficie space-y-6 rounded-xl p-6 sm:p-8">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
                      <KeyRound size={18} className="text-brand-500" aria-hidden="true" /> Cambiar contraseña
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-gray-500">
                      Mínimo 8 caracteres, combinando letras y números.
                    </p>
                  </div>

                  <TextField
                    label="Contraseña actual"
                    type="password"
                    autoComplete="current-password"
                    error={erroresClave.actual}
                    value={actual}
                    onChange={(evento) => setActual(evento.target.value)}
                    placeholder="••••••••"
                  />
                  <TextField
                    label="Contraseña nueva"
                    type="password"
                    autoComplete="new-password"
                    error={erroresClave.nueva}
                    value={nueva}
                    onChange={(evento) => setNueva(evento.target.value)}
                    placeholder="••••••••"
                  />
                  <TextField
                    label="Repite la contraseña nueva"
                    type="password"
                    autoComplete="new-password"
                    error={erroresClave.confirmacion}
                    value={confirmacion}
                    onChange={(evento) => setConfirmacion(evento.target.value)}
                    placeholder="••••••••"
                  />

                  <div aria-live="polite">
                    {mensajeClave && (
                      <p className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                        <CheckCircle2 size={16} aria-hidden="true" /> {mensajeClave}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={cambiandoClave}
                    aria-busy={cambiandoClave}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-sm border border-gray-700 px-6 text-xs font-bold uppercase tracking-widest text-gray-200 transition-colors hover:border-brand-500 hover:text-white disabled:opacity-60"
                  >
                    {cambiandoClave ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <KeyRound size={16} aria-hidden="true" />
                    )}
                    Actualizar contraseña
                  </button>
                </form>
              </section>
            )}
          </main>
        </div>
      </div>

      {/* ------------------------------------------- formulario de dirección */}
      <Modal
        open={Boolean(borrador)}
        onClose={() => setBorrador(null)}
        title={borrador?.id ? 'Editar dirección' : 'Nueva dirección'}
        description="Se guarda sólo en este navegador."
        size="md"
      >
        {borrador && (
          <form onSubmit={guardarDireccion} className="space-y-5" noValidate>
            <TextField
              label="Alias"
              required
              hint="Cómo la reconoces: Casa, Oficina, Gimnasio..."
              error={erroresDireccion.alias}
              value={borrador.alias}
              onChange={(evento) => setBorrador({ ...borrador, alias: evento.target.value })}
              placeholder="Casa"
            />
            <TextField
              label="Quién recibe"
              required
              error={erroresDireccion.nombre}
              value={borrador.nombre}
              onChange={(evento) => setBorrador({ ...borrador, nombre: evento.target.value })}
              placeholder="Nombre completo"
            />
            <TextField
              label="Teléfono"
              required
              type="tel"
              error={erroresDireccion.telefono}
              value={borrador.telefono}
              onChange={(evento) => setBorrador({ ...borrador, telefono: evento.target.value })}
              placeholder="55 1234 5678"
            />
            <TextField
              label="Calle y número"
              required
              error={erroresDireccion.calle}
              value={borrador.calle}
              onChange={(evento) => setBorrador({ ...borrador, calle: evento.target.value })}
              placeholder="Av. Siempre Viva 742, Int. 3"
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Ciudad"
                required
                error={erroresDireccion.ciudad}
                value={borrador.ciudad}
                onChange={(evento) => setBorrador({ ...borrador, ciudad: evento.target.value })}
                placeholder="Ciudad de México"
              />
              <TextField
                label="Código postal"
                required
                inputMode="numeric"
                maxLength={5}
                error={erroresDireccion.cp}
                value={borrador.cp}
                onChange={(evento) => setBorrador({ ...borrador, cp: evento.target.value })}
                placeholder="01000"
              />
            </div>

            <TextAreaField
              label="Referencias"
              hint="Color de la fachada, entre qué calles, horario de entrega..."
              value={borrador.referencias}
              onChange={(evento) => setBorrador({ ...borrador, referencias: evento.target.value })}
              placeholder="Portón negro, junto a la farmacia."
            />

            <div className="flex flex-col-reverse gap-3 border-t border-gray-800 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setBorrador(null)}
                className="min-h-[48px] px-5 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-sm bg-brand-600 px-6 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700"
              >
                <Save size={16} aria-hidden="true" /> Guardar dirección
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(direccionABorrar)}
        title="Eliminar dirección"
        message={`¿Quieres borrar "${direccionABorrar?.alias || ''}" de tu libreta? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        tone="danger"
        onConfirm={confirmarBorrado}
        onCancel={() => setDireccionABorrar(null)}
      />
    </div>
  );
}
