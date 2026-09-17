import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Copy,
  CreditCard,
  Landmark,
  Loader2,
  Lock,
  MapPin,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';

import EmptyState from '../components/ui/EmptyState';
import { TextField } from '../components/ui/Field';
import useDocumentTitle from '../hooks/useDocumentTitle';

import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import { orders as ordersApi, payments as paymentsApi, shipping as shippingApi } from '../services/api';
import { computeCartTotals, formatPrice, getPricingConfig, getUnitPrice, roundMoney } from '../lib/pricing';
import { fadeUp, resolveVariants } from '../lib/motion';

const ENVIO_VACIO = { fullName: '', phone: '', address: '', city: '', zip: '' };

const AVISO_INCOMPLETO = 'Por favor completa tu dirección de envío en todos los campos.';

const PASOS = [
  { id: 1, nombre: 'Envío' },
  { id: 2, nombre: 'Pago' },
  { id: 3, nombre: 'Confirmación' },
];

/** Sólo dígitos, para validar teléfono y código postal escritos con espacios. */
function soloDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/** Una regla por campo: el mensaje se muestra debajo del propio campo. */
const REGLAS = {
  fullName: (valor) => {
    if (!valor.trim()) return 'Escribe el nombre de quien recibe.';
    if (valor.trim().length < 3) return 'El nombre es demasiado corto.';
    return '';
  },
  phone: (valor) => {
    const digitos = soloDigitos(valor);
    if (!digitos) return 'Escribe un teléfono de contacto.';
    if (digitos.length < 10) return 'El teléfono debe tener 10 dígitos.';
    return '';
  },
  address: (valor) => {
    if (!valor.trim()) return 'Escribe la calle y el número.';
    if (valor.trim().length < 5) return 'La dirección es demasiado corta.';
    return '';
  },
  city: (valor) => (valor.trim() ? '' : 'Escribe tu ciudad.'),
  zip: (valor) => {
    const digitos = soloDigitos(valor);
    if (!digitos) return 'Escribe tu código postal.';
    if (digitos.length !== 5) return 'El código postal son 5 dígitos.';
    return '';
  },
};

function validarEnvio(datos) {
  const errores = {};
  for (const [campo, regla] of Object.entries(REGLAS)) {
    const mensaje = regla(datos[campo] ?? '');
    if (mensaje) errores[campo] = mensaje;
  }
  return errores;
}

export default function Checkout() {
  const navigate = useNavigate();
  const reducido = useReducedMotion();
  const { cartItems, clearCart } = useCart();
  const { user } = useAuth();
  const { settings } = useSettings();

  const [formulario, setFormulario] = useState(ENVIO_VACIO);
  const [tocados, setTocados] = useState({});
  const [intentado, setIntentado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [copiada, setCopiada] = useState(false);

  useDocumentTitle('Finalizar compra', 'Confirma tu dirección de envío y paga tu pedido por transferencia SPEI.');

  // Los datos bancarios salen de la configuración de la tienda, nunca del código.
  const pago = settings?.payment || {};
  const pasarela = pago.gateway === 'mercadopago';
  // Con una paquetería conectada, el envío se cotiza por código postal.
  const cotizaEnvio = (settings?.shipping?.provider || 'manual') !== 'manual';
  const concepto = useMemo(() => `TH-${Math.floor(1000 + Math.random() * 9000)}`, []);

  const totales = computeCartTotals(cartItems);
  const { tier: nivel, subtotal, savings: ahorro } = totales;

  const [cotizacion, setCotizacion] = useState({ estado: 'inactiva', quote_id: null, rates: [], error: '' });
  const [tarifaId, setTarifaId] = useState('');
  const [reintentos, setReintentos] = useState(0);
  const tarifa = cotizacion.rates.find((opcion) => opcion.id === tarifaId) || null;

  // Con tarifa cotizada, el envío es el de la paquetería. La promesa de envío
  // gratis se respeta igual (la absorbe la tienda): es lo mismo que hace
  // create_order() en el servidor, así que el total de aquí es el que se cobra.
  const envio =
    tarifa && cotizacion.quote_id
      ? subtotal >= getPricingConfig().freeShippingFrom
        ? 0
        : roundMoney(tarifa.amount)
      : totales.shipping;
  const total = roundMoney(subtotal + envio);

  // Se cotiza en cuanto hay un C.P. completo, con una pausa para no pedir una
  // tarifa por cada dígito. Sin paquetería conectada no hace nada.
  const cp = soloDigitos(formulario.zip);
  useEffect(() => {
    if (!cotizaEnvio || cp.length !== 5 || cartItems.length === 0) return undefined;

    let vigente = true;
    const temporizador = setTimeout(async () => {
      setCotizacion({ estado: 'cargando', quote_id: null, rates: [], error: '' });
      setTarifaId('');
      try {
        const respuesta = await shippingApi.quote({
          zip: cp,
          items: cartItems.map((item) => ({ product_id: item.id, quantity: item.quantity })),
        });
        if (!vigente) return;
        const rates = respuesta?.rates || [];
        setCotizacion({ estado: 'lista', quote_id: respuesta?.quote_id ?? null, rates, error: '' });
        setTarifaId(rates[0]?.id || '');
      } catch (fallo) {
        if (!vigente) return;
        setCotizacion({
          estado: 'error',
          quote_id: null,
          rates: [],
          error: fallo?.message || 'No pudimos cotizar el envío.',
        });
      }
    }, 600);

    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [cotizaEnvio, cp, cartItems, reintentos]);

  const errores = useMemo(() => validarEnvio(formulario), [formulario]);
  const envioCompleto = Object.keys(errores).length === 0;
  const pasoActual = enviando ? 3 : envioCompleto ? 2 : 1;

  const temporizadorCopia = useRef(0);
  useEffect(() => () => clearTimeout(temporizadorCopia.current), []);

  const escribir = (campo) => (evento) => {
    const { value } = evento.target;
    setFormulario((previo) => ({ ...previo, [campo]: value }));
    if (aviso === AVISO_INCOMPLETO) setAviso('');
  };

  const marcarTocado = (campo) => () => setTocados((previo) => ({ ...previo, [campo]: true }));

  const errorDe = (campo) => ((tocados[campo] || intentado) && errores[campo]) || undefined;

  const copiarClabe = async () => {
    try {
      await navigator.clipboard.writeText(String(pago.clabe || ''));
      setCopiada(true);
      toast.success('CLABE copiada');
      clearTimeout(temporizadorCopia.current);
      temporizadorCopia.current = setTimeout(() => setCopiada(false), 2500);
    } catch {
      toast.error('Tu navegador bloqueó el portapapeles. Copia la CLABE a mano.');
    }
  };

  const pagar = async (evento) => {
    evento.preventDefault();
    setIntentado(true);

    if (!user?.id) {
      setAviso('Necesitas iniciar sesión para finalizar tu compra.');
      return;
    }
    if (!envioCompleto) {
      setAviso(AVISO_INCOMPLETO);
      return;
    }
    if (cotizaEnvio && cotizacion.estado === 'cargando') {
      setAviso('Espera un momento: estamos cotizando el envío.');
      return;
    }
    if (cotizaEnvio && cotizacion.quote_id && !tarifa) {
      setAviso('Elige una opción de envío.');
      return;
    }

    setAviso('');
    setEnviando(true);

    // Sólo se manda qué y cuánto: el backend recalcula precios, envío y total
    // contra el catálogo, así que un carrito manipulado no cambia el cobro.
    const lineas = cartItems.map((item) => ({ product_id: item.id, quantity: item.quantity }));

    try {
      // El inventario lo descuenta el propio `create`, en la misma operación:
      // no hay una segunda llamada que se pueda perder a medio camino.
      const pedido = await ordersApi.create({
        userId: user.id,
        shippingInfo: formulario,
        paymentInfo: { provider: pasarela ? 'mercadopago' : 'spei', concepto, banco: pago.bank },
        items: lineas,
        shippingRate: cotizacion.quote_id && tarifa ? { quote_id: cotizacion.quote_id, rate_id: tarifa.id } : null,
      });

      if (pasarela) {
        // Checkout Pro vive en el sitio de Mercado Pago: es una navegación
        // completa. El pedido ya quedó registrado como «Pago Pendiente»; si el
        // cliente cierra la pestaña, puede retomar el pago desde su perfil.
        const inicio = await paymentsApi.start(pedido.id);
        clearCart();
        window.location.assign(inicio.init_point);
        return;
      }

      toast.success(
        `¡Pedido registrado! Transfiere ${formatPrice(pedido?.total ?? total)} con el concepto ${concepto}.`,
        { duration: 8000 }
      );
      clearCart();
      navigate('/profile');
    } catch (error) {
      // El backend responde en español (falta de stock, dirección incompleta...).
      setAviso(error?.message || 'No pudimos registrar tu pedido. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (cartItems.length === 0 && !enviando) {
    return (
      <div className="min-h-screen bg-carbon-950 text-white">
        <div className="container mx-auto px-4 py-10 lg:py-14">
          <h1 className="titulo-pagina mb-10 border-b border-gray-800 pb-5 font-extrabold uppercase tracking-wide text-brand-500">
            Finalizar Compra
          </h1>
          <EmptyState
            as="h2"
            icon={ShoppingCart}
            title="El carrito está vacío"
            message="Agrega productos antes de pasar por caja."
            actionLabel="Volver a la tienda"
            actionTo="/shop"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-carbon-950 pb-16 text-white">
      <div className="container mx-auto px-4 py-10 lg:py-14">
        <h1 className="titulo-pagina flex items-center gap-3 font-extrabold uppercase tracking-wide text-brand-500">
          <ShieldCheck className="shrink-0" aria-hidden="true" /> Finalizar Compra
        </h1>

        {/* --------------------------------------------------- paso a paso */}
        <ol className="mt-8 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-widest">
          {PASOS.map((paso, indice) => {
            const completado = paso.id < pasoActual;
            const activo = paso.id === pasoActual;
            return (
              <li key={paso.id} className="flex items-center gap-3">
                <span
                  aria-current={activo ? 'step' : undefined}
                  className={`flex items-center gap-2 rounded-sm px-3 py-2 ${
                    activo
                      ? 'bg-brand-600 text-white'
                      : completado
                        ? 'bg-brand-600/15 text-brand-500'
                        : 'bg-carbon-800 text-gray-400'
                  }`}
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full border border-current text-[10px]">
                    {completado ? <Check size={12} aria-hidden="true" /> : paso.id}
                  </span>
                  {paso.nombre}
                </span>
                {indice < PASOS.length - 1 && <span aria-hidden="true" className="h-px w-6 bg-gray-800" />}
              </li>
            );
          })}
        </ol>

        <form onSubmit={pagar} noValidate className="mt-8 flex flex-col gap-8 lg:flex-row">
          {/* ============================================ datos y pago */}
          <div className="min-w-0 flex-1 space-y-6">
            <motion.section
              variants={resolveVariants(fadeUp, reducido)}
              initial="hidden"
              animate="visible"
              className="superficie relative overflow-hidden rounded-xl p-6"
            >
              <span aria-hidden="true" className="absolute left-0 top-0 h-full w-1 bg-brand-600" />
              <h2 className="mb-6 flex items-center gap-2 text-xl font-bold uppercase tracking-wider">
                <MapPin size={20} className="text-brand-500" aria-hidden="true" /> Información de envío
              </h2>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <TextField
                  label="Nombre completo"
                  required
                  type="text"
                  autoComplete="name"
                  placeholder="Ej: Juan Pérez"
                  value={formulario.fullName}
                  onChange={escribir('fullName')}
                  onBlur={marcarTocado('fullName')}
                  error={errorDe('fullName')}
                />
                <TextField
                  label="Teléfono"
                  required
                  type="tel"
                  autoComplete="tel"
                  placeholder="+52 55 1234 5678"
                  value={formulario.phone}
                  onChange={escribir('phone')}
                  onBlur={marcarTocado('phone')}
                  error={errorDe('phone')}
                />
                <TextField
                  className="md:col-span-2"
                  label="Dirección (calle y número)"
                  required
                  type="text"
                  autoComplete="street-address"
                  placeholder="Av. Revolución 123"
                  value={formulario.address}
                  onChange={escribir('address')}
                  onBlur={marcarTocado('address')}
                  error={errorDe('address')}
                />
                <TextField
                  label="Ciudad"
                  required
                  type="text"
                  autoComplete="address-level2"
                  placeholder="CDMX / MTY / GDL"
                  value={formulario.city}
                  onChange={escribir('city')}
                  onBlur={marcarTocado('city')}
                  error={errorDe('city')}
                />
                <TextField
                  label="Código postal"
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000"
                  value={formulario.zip}
                  onChange={escribir('zip')}
                  onBlur={marcarTocado('zip')}
                  error={errorDe('zip')}
                />
              </div>

              {cotizaEnvio && (
                <div className="mt-6 rounded-lg border border-gray-800 bg-carbon-900 p-4" aria-live="polite">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-300">
                    <Truck size={16} className="text-brand-500" aria-hidden="true" /> Opciones de envío
                  </h3>

                  {cp.length !== 5 && (
                    <p className="text-sm text-gray-400">Escribe tu código postal para cotizar el envío.</p>
                  )}

                  {cp.length === 5 && cotizacion.estado === 'cargando' && (
                    <p role="status" className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Cotizando con la paquetería...
                    </p>
                  )}

                  {cp.length === 5 && cotizacion.estado === 'error' && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p role="alert" className="text-sm text-red-400">
                        {cotizacion.error}
                      </p>
                      <button
                        type="button"
                        onClick={() => setReintentos((n) => n + 1)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-gray-700 px-4 text-xs font-bold uppercase tracking-widest text-gray-300 hover:border-brand-500 hover:text-white"
                      >
                        <RefreshCw size={14} aria-hidden="true" /> Volver a cotizar
                      </button>
                    </div>
                  )}

                  {cotizacion.estado === 'lista' && (
                    <fieldset className="space-y-2">
                      <legend className="sr-only">Elige cómo quieres recibir tu pedido</legend>
                      {cotizacion.rates.map((opcion) => (
                        <label
                          key={opcion.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-sm border p-3 text-sm transition-colors ${
                            tarifaId === opcion.id ? 'border-brand-500 bg-brand-600/10' : 'border-gray-800 hover:border-gray-600'
                          }`}
                        >
                          <input
                            type="radio"
                            name="tarifa-envio"
                            value={opcion.id}
                            checked={tarifaId === opcion.id}
                            onChange={() => setTarifaId(opcion.id)}
                            className="h-4 w-4 accent-orange-600"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold text-white">{opcion.carrier}</span>
                            <span className="block text-xs text-gray-400">
                              {opcion.service}
                              {opcion.days ? ` · ${opcion.days} día${opcion.days === 1 ? '' : 's'}` : ''}
                            </span>
                          </span>
                          <span className="whitespace-nowrap font-bold text-white">
                            {subtotal >= getPricingConfig().freeShippingFrom ? (
                              <span className="text-xs uppercase text-emerald-500">Gratis</span>
                            ) : (
                              formatPrice(opcion.amount)
                            )}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                </div>
              )}
            </motion.section>

            <motion.section
              variants={resolveVariants(fadeUp, reducido)}
              initial="hidden"
              animate="visible"
              transition={{ delay: reducido ? 0 : 0.08 }}
              className="superficie relative overflow-hidden rounded-xl p-6"
            >
              <span aria-hidden="true" className="absolute left-0 top-0 h-full w-1 bg-brand-600" />
              <h2 className="mb-6 flex items-center gap-2 text-xl font-bold uppercase tracking-wider">
                {pasarela ? (
                  <>
                    <CreditCard size={20} className="text-brand-500" aria-hidden="true" /> Pago con Mercado Pago
                  </>
                ) : (
                  <>
                    <Landmark size={20} className="text-brand-500" aria-hidden="true" /> Pago por transferencia (SPEI)
                  </>
                )}
              </h2>

              {pasarela && (
                <div className="space-y-4 text-sm leading-relaxed text-gray-400">
                  <p>
                    Al confirmar te llevamos al sitio seguro de Mercado Pago para pagar con{' '}
                    <strong className="text-white">
                      tarjeta de crédito o débito, transferencia SPEI o en efectivo en OXXO
                    </strong>
                    . Tus datos bancarios nunca pasan por nuestra tienda.
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-3">
                    {['Tarjeta', 'SPEI', 'OXXO'].map((medio) => (
                      <li
                        key={medio}
                        className="rounded-sm border border-gray-800 bg-carbon-900 px-3 py-2 text-center text-xs font-bold uppercase tracking-widest text-gray-300"
                      >
                        {medio}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs">
                    En cuanto Mercado Pago confirme el cobro, tu pedido pasa a «Pagado» y te avisamos por correo. Si no
                    terminas el pago, el pedido queda apartado y puedes retomarlo desde tu perfil.
                  </p>
                </div>
              )}

              {!pasarela && pago.isDemo && (
                <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
                  <AlertTriangle className="mt-0.5 shrink-0 text-amber-500" size={20} aria-hidden="true" />
                  <p className="text-amber-200">
                    <strong className="font-bold">Cuenta de ejemplo.</strong> Esta tienda es una demostración: los datos
                    bancarios de abajo son ficticios. <strong>No transfieras dinero.</strong> Puedes completar el pedido
                    para ver el flujo completo.
                  </p>
                </div>
              )}

              {!pasarela && (
                <>
              <p className="mb-6 text-sm leading-relaxed text-gray-400">
                {pago.instructions ||
                  'Tu pedido se aparta al confirmarlo. Para procesarlo debes transferir el total a esta cuenta usando el concepto indicado.'}
              </p>

              <dl className="space-y-4 rounded-lg border border-gray-800 bg-carbon-900 p-5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
                  <dt className="text-xs font-bold uppercase tracking-wider text-gray-400">Banco</dt>
                  <dd className="font-bold text-white">{pago.bank || '—'}</dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
                  <dt className="text-xs font-bold uppercase tracking-wider text-gray-400">Beneficiario</dt>
                  <dd className="text-white">{pago.beneficiary || '—'}</dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
                  <dt className="text-xs font-bold uppercase tracking-wider text-gray-400">CLABE interbancaria</dt>
                  <dd className="flex items-center gap-3">
                    <span className="break-all font-mono text-lg font-extrabold tracking-wider text-brand-500">
                      {pago.clabe || '—'}
                    </span>
                    <button
                      type="button"
                      onClick={copiarClabe}
                      aria-label="Copiar la CLABE"
                      className="grid h-11 w-11 place-items-center rounded-sm text-gray-400 transition-colors hover:bg-carbon-700 hover:text-brand-500"
                    >
                      {copiada ? (
                        <Check size={16} className="text-emerald-500" aria-hidden="true" />
                      ) : (
                        <Copy size={16} aria-hidden="true" />
                      )}
                    </button>
                    <span role="status" aria-live="polite" className="sr-only">
                      {copiada ? 'CLABE copiada al portapapeles' : ''}
                    </span>
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-xs font-bold uppercase tracking-wider text-gray-400">Concepto a ingresar</dt>
                  <dd className="rounded-sm bg-brand-600 px-3 py-1 font-mono text-lg font-black tracking-widest text-white">
                    {concepto}
                  </dd>
                </div>
              </dl>
                </>
              )}
            </motion.section>
          </div>

          {/* ================================================== resumen */}
          <aside className="lg:w-96 lg:shrink-0">
            <div className="superficie rounded-xl p-6 lg:sticky lg:top-[calc(var(--alto-cabecera,5rem)+0.5rem)]">
              <h2 className="mb-5 border-b border-gray-800 pb-3 text-lg font-bold uppercase tracking-widest">
                Resumen de tu pedido
              </h2>

              <ul className="custom-scrollbar mb-5 max-h-60 space-y-3 overflow-y-auto pr-2">
                {cartItems.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 border-b border-gray-800 pb-2">
                    <span className="min-w-0 text-sm text-gray-300">
                      <span className="font-bold text-brand-500">{item.quantity}x</span>{' '}
                      <span className="text-xs uppercase">{item.name}</span>
                    </span>
                    <span className="whitespace-nowrap text-sm font-bold text-white">
                      {formatPrice(getUnitPrice(item, nivel) * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="space-y-2 border-t border-gray-800 pt-4 text-sm text-gray-400">
                <div className="flex justify-between">
                  <span>Subtotal (Nivel {nivel})</span>
                  <span className="text-white">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Envío{tarifa && cotizacion.quote_id ? ` · ${tarifa.carrier}` : ''}</span>
                  <span className="text-white">
                    {envio === 0 ? (
                      <span className="text-xs font-bold uppercase text-emerald-500">Gratis</span>
                    ) : (
                      formatPrice(envio)
                    )}
                  </span>
                </div>
                {ahorro > 0 && (
                  <div className="flex justify-between text-emerald-500">
                    <span>Tu ahorro</span>
                    <span className="font-bold">−{formatPrice(ahorro)}</span>
                  </div>
                )}
                <div className="mt-4 flex items-end justify-between border-t border-gray-800 pt-4">
                  <span className="text-sm font-bold uppercase tracking-widest text-white">
                    {pasarela ? 'Total a pagar' : 'Total a transferir'}
                  </span>
                  <span className="text-3xl font-extrabold tracking-tight text-brand-500">{formatPrice(total)}</span>
                </div>
              </div>

              {aviso && (
                <p
                  role="alert"
                  className="mt-5 flex items-start gap-2 rounded-sm border border-red-600/50 bg-red-600/10 p-3 text-sm text-red-400"
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {aviso}
                </p>
              )}

              <motion.button
                type="submit"
                disabled={enviando}
                whileTap={reducido ? undefined : { scale: 0.98 }}
                className="resplandor-marca mt-6 flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-sm bg-brand-600 px-6 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-carbon-700 disabled:text-gray-300"
              >
                {enviando ? (
                  <span className="latido-marca">Procesando...</span>
                ) : pasarela ? (
                  <>
                    <CreditCard size={18} aria-hidden="true" /> Pagar con Mercado Pago
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} aria-hidden="true" /> Pagar Ahora
                  </>
                )}
              </motion.button>

              <p className="mt-4 flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-gray-400">
                <Lock size={10} aria-hidden="true" /> Tus datos de envío sólo se usan para entregarte el pedido
              </p>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
