import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, Loader2, LogIn, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { DEMO_ADMIN, DEMO_CUSTOMER, IS_LOCAL_MODE } from '../services/api';
import { Field, TextField, inputClasses } from './ui/Field';
import { fadeUp, resolveVariants, scaleIn, staggerContainer, staggerItem } from '../lib/motion';
import useDocumentTitle from '../hooks/useDocumentTitle';

/**
 * Traduce el error del backend a algo que una persona pueda leer.
 *
 * El bloqueo por intentos fallidos ya viene redactado en español desde
 * `src/lib/security.js`, así que se muestra tal cual: contiene el tiempo que
 * falta para volver a intentarlo.
 */
function traducirError(mensaje) {
  const texto = String(mensaje ?? '').trim();
  if (/invalid login|credentials|not found/i.test(texto)) return 'Correo o contraseña incorrectos.';
  return texto || 'No pudimos iniciar sesión. Vuelve a intentarlo en un momento.';
}

const VENTAJAS = [
  { icon: ShieldCheck, texto: 'Productos originales con garantía de distribuidor.' },
  { icon: Truck, texto: 'Envío gratis en pedidos desde $5,000 MXN.' },
  { icon: Sparkles, texto: 'Precios de mayoreo automáticos al subir de nivel.' },
];

export default function ThaigerLogin() {
  useDocumentTitle('Iniciar sesión', 'Entra a tu cuenta Thaiger para ver tus pedidos, tus favoritos y tus precios de mayoreo.');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const reduced = useReducedMotion();

  // Si una ruta protegida nos mandó aquí, volvemos a donde quería ir la persona.
  const destino = location.state?.from?.pathname || '/';

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    if (cargando) return;

    setError('');
    setCargando(true);

    try {
      await login(email, password);
      toast.success('¡Bienvenido a Thaiger!');
      navigate(destino, { replace: true });
    } catch (fallo) {
      setError(traducirError(fallo?.message));
      setCargando(false);
    }
  };

  const rellenar = (cuenta) => {
    if (!cuenta) return;
    setError('');
    setEmail(cuenta.email);
    setPassword(cuenta.password);
  };

  return (
    <div className="relative flex min-h-[calc(100dvh-5rem)] items-center justify-center overflow-hidden bg-carbon-950 px-4 py-12">
      {/* Fondo de marca: el mismo arte del carrusel, difuminado. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/images/hero/thaiger-labs.svg')] bg-cover bg-center opacity-25 blur-md"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-carbon-950 via-carbon-950/85 to-carbon-950" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl"
      />

      <motion.div
        variants={resolveVariants(scaleIn, reduced)}
        initial="hidden"
        animate="visible"
        className="superficie relative z-10 grid w-full max-w-5xl overflow-hidden rounded-2xl shadow-2xl shadow-black lg:grid-cols-[1.05fr_1fr]"
      >
        {/* ------------------------------------------------ panel de marca */}
        <motion.aside
          variants={resolveVariants(staggerContainer(0.08, 0.1), reduced)}
          initial="hidden"
          animate="visible"
          className="relative hidden flex-col justify-between border-r border-gray-800 bg-carbon-900 p-10 lg:flex"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[url('/images/hero/thaiger-labs.svg')] bg-cover bg-center opacity-20"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-tr from-carbon-950 via-carbon-950/70 to-transparent" />

          <motion.div variants={resolveVariants(staggerItem, reduced)} className="relative">
            <img src="/logo.png" alt="Thaiger Supplements" className="h-14 w-auto object-contain" />
          </motion.div>

          <motion.div variants={resolveVariants(staggerItem, reduced)} className="relative mt-10">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-brand-500">Bienvenido de vuelta</p>
            {/*
              Texto de marca, no una sección navegable: como <h2> era el primer
              encabezado del documento y dejaba el <h1> ("iniciar sesión") por
              debajo de él, invirtiendo el orden que lee un lector de pantalla.
            */}
            <p className="titulo-seccion mt-4 font-black uppercase italic tracking-tight text-white">
              Tu entrenamiento
              <br />
              <span className="text-brand-500">no se detiene</span>
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-400">
              Entra para ver tu historial de pedidos, tus favoritos y los precios que te tocan según el monto de tu compra.
            </p>
          </motion.div>

          <motion.ul variants={resolveVariants(staggerItem, reduced)} className="relative mt-10 space-y-4">
            {VENTAJAS.map((ventaja) => {
              const Icono = ventaja.icon;
              return (
                <li key={ventaja.texto} className="flex items-start gap-3 text-sm text-gray-400">
                  <Icono size={18} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
                  <span>{ventaja.texto}</span>
                </li>
              );
            })}
          </motion.ul>
        </motion.aside>

        {/* --------------------------------------------------- formulario */}
        <motion.div variants={resolveVariants(fadeUp, reduced)} initial="hidden" animate="visible" className="p-6 sm:p-10">
          <div className="text-center lg:text-left">
            <img src="/logo.png" alt="Thaiger Supplements" className="mx-auto mb-6 h-12 w-auto object-contain lg:hidden" />
            <h1 className="text-2xl font-black uppercase italic tracking-tight text-white sm:text-3xl">iniciar sesion</h1>
            <p className="mt-2 text-sm text-gray-400">Usa el correo con el que creaste tu cuenta.</p>
          </div>

          <form onSubmit={manejarEnvio} className="mt-8 space-y-5" noValidate>
            <TextField
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              placeholder="usuario@ejemplo.com"
            />

            <Field label="Contraseña" required>
              {({ id, describedBy }) => (
                <div className="relative">
                  <input
                    id={id}
                    aria-describedby={describedBy}
                    type={verContrasena ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(evento) => setPassword(evento.target.value)}
                    placeholder="••••••••"
                    required
                    className={inputClasses({ extra: 'pr-14' })}
                  />
                  <button
                    type="button"
                    onClick={() => setVerContrasena((previo) => !previo)}
                    aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400 transition-colors hover:text-brand-500"
                  >
                    {verContrasena ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              )}
            </Field>

            {/* El error vive junto al formulario y se anuncia a los lectores. */}
            <div aria-live="polite">
              {error && (
                <p
                  role="alert"
                  className="rounded-sm border border-red-800 bg-red-950/40 px-4 py-3 text-sm font-bold text-red-400"
                >
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={cargando}
              aria-busy={cargando}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sm bg-brand-600 px-6 py-4 text-sm font-black uppercase italic tracking-widest text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <LogIn size={18} aria-hidden="true" />
              )}
              Ingresar
            </button>

            <p aria-live="polite" className="min-h-[1rem] text-center text-xs text-gray-400">
              {cargando ? 'Verificando tus datos...' : ''}
            </p>
          </form>

          {IS_LOCAL_MODE && (
            <div className="mt-8 rounded-lg border border-brand-600/35 bg-brand-600/[0.08] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-500">
                Modo local — cuentas de demostración
              </p>

              <dl className="mt-4 space-y-3 text-xs text-gray-400">
                {DEMO_ADMIN && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-gray-300">Administrador</dt>
                      <dd className="break-all">
                        {DEMO_ADMIN.email} / {DEMO_ADMIN.password}
                      </dd>
                    </div>
                    <button
                      type="button"
                      onClick={() => rellenar(DEMO_ADMIN)}
                      className="min-h-[44px] rounded-sm border border-gray-700 px-4 text-[11px] font-bold uppercase tracking-widest text-gray-300 transition-colors hover:border-brand-500 hover:text-white"
                    >
                      Rellenar datos
                    </button>
                  </div>
                )}

                {DEMO_CUSTOMER && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 pt-3">
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-gray-300">Cliente</dt>
                      <dd className="break-all">
                        {DEMO_CUSTOMER.email} / {DEMO_CUSTOMER.password}
                      </dd>
                    </div>
                    <button
                      type="button"
                      onClick={() => rellenar(DEMO_CUSTOMER)}
                      className="min-h-[44px] rounded-sm border border-gray-700 px-4 text-[11px] font-bold uppercase tracking-widest text-gray-300 transition-colors hover:border-brand-500 hover:text-white"
                    >
                      Usar demo de cliente
                    </button>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="mt-8 border-t border-gray-800 pt-6 text-center">
            <p className="text-sm text-gray-400">¿Todavía no tienes cuenta?</p>
            <Link
              to="/register"
              state={location.state}
              className="mt-2 inline-flex min-h-[44px] items-center justify-center text-sm font-bold uppercase tracking-widest text-brand-500 transition-colors hover:text-white"
            >
              Crear una cuenta
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
