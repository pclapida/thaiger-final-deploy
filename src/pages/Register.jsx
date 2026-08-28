import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Field, TextField, inputClasses } from '../components/ui/Field';
import { isValidEmail, passwordStrength, sanitizeText, validatePassword } from '../lib/security';
import { fadeUp, resolveVariants, scaleIn } from '../lib/motion';
import useDocumentTitle from '../hooks/useDocumentTitle';

/** Cuántos tramos pinta la barra de fuerza (passwordStrength va de 0 a 5). */
const TRAMOS = 5;

function traducirError(mensaje) {
  const texto = String(mensaje ?? '').trim();
  if (/already registered|already in use|ya existe/i.test(texto)) return 'El correo electrónico ya está registrado.';
  return texto || 'No pudimos crear la cuenta. Vuelve a intentarlo.';
}

export default function Register() {
  useDocumentTitle('Crear cuenta', 'Crea tu cuenta Thaiger para comprar suplementos originales con precios de mayoreo.');

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [verContrasena, setVerContrasena] = useState(false);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [cargando, setCargando] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const reduced = useReducedMotion();

  const destino = location.state?.from?.pathname || '/';
  const fuerza = useMemo(() => passwordStrength(password), [password]);

  /** Revisa el formulario completo: así ningún error queda escondido tras otro. */
  const revisar = () => {
    const fallos = {};

    if (!sanitizeText(nombre, { maxLength: 60 })) fallos.nombre = 'Escribe tu nombre.';
    if (!isValidEmail(email)) fallos.email = 'El correo electrónico no es válido.';

    const problemaContrasena = validatePassword(password);
    if (problemaContrasena) fallos.password = problemaContrasena;

    if (password !== confirmacion) fallos.confirmacion = 'Las contraseñas no coinciden.';
    if (!aceptaTerminos) fallos.terminos = 'Debes aceptar los términos y condiciones.';

    return fallos;
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    if (cargando) return;

    setErrorGeneral('');
    const fallos = revisar();
    setErrores(fallos);
    if (Object.keys(fallos).length > 0) return;

    setCargando(true);
    try {
      await register(email, password, sanitizeText(nombre, { maxLength: 60 }));
      toast.success('¡Cuenta creada con éxito!');
      navigate(destino, { replace: true });
    } catch (fallo) {
      setErrorGeneral(traducirError(fallo?.message));
      setCargando(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100dvh-5rem)] items-center justify-center overflow-hidden bg-carbon-950 px-4 py-12">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/images/hero/thaiger-labs.svg')] bg-cover bg-center opacity-20 blur-md"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-carbon-950 via-carbon-950/85 to-carbon-950" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl"
      />

      <motion.div
        variants={resolveVariants(scaleIn, reduced)}
        initial="hidden"
        animate="visible"
        className="superficie relative z-10 w-full max-w-lg rounded-2xl p-6 shadow-2xl shadow-black sm:p-10"
      >
        <motion.div variants={resolveVariants(fadeUp, reduced)} className="text-center">
          <img src="/logo.png" alt="Thaiger Supplements" className="mx-auto mb-6 h-12 w-auto object-contain" />
          <h1 className="text-2xl font-black uppercase italic tracking-tight text-white sm:text-3xl">
            Únete a <span className="text-brand-500">Thaiger</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400">Crea tu cuenta y empieza tu transformación.</p>
        </motion.div>

        <form onSubmit={manejarEnvio} className="mt-8 space-y-5" noValidate>
          <TextField
            label="Nombre completo"
            required
            error={errores.nombre}
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            placeholder="Tu Nombre"
            autoComplete="name"
            maxLength={60}
          />

          <TextField
            label="Correo electrónico"
            type="email"
            required
            error={errores.email}
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            placeholder="usuario@ejemplo.com"
            autoComplete="email"
          />

          <div className="space-y-3">
            <Field
              label="Contraseña"
              required
              error={errores.password}
              hint="Mínimo 8 caracteres, combinando letras y números."
            >
              {({ id, describedBy, invalid }) => (
                <div className="relative">
                  <input
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    type={verContrasena ? 'text' : 'password'}
                    value={password}
                    onChange={(evento) => setPassword(evento.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    className={inputClasses({ invalid, extra: 'pr-14' })}
                  />
                  <button
                    type="button"
                    onClick={() => setVerContrasena((previo) => !previo)}
                    aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-500 transition-colors hover:text-brand-500"
                  >
                    {verContrasena ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              )}
            </Field>

            {/* Medidor de fuerza: el color acompaña, pero el texto es quien informa. */}
            <div>
              <div aria-hidden="true" className="flex gap-1.5">
                {Array.from({ length: TRAMOS }, (_, indice) => (
                  <span
                    key={indice}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      indice < fuerza.score ? 'bg-brand-500' : 'bg-carbon-600'
                    }`}
                  />
                ))}
              </div>
              <p aria-live="polite" className="mt-2 text-[11px] uppercase tracking-widest text-gray-500">
                Fuerza: <span className="font-bold text-gray-300">{fuerza.label}</span>
              </p>
            </div>
          </div>

          <Field label="Confirmar contraseña" required error={errores.confirmacion}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                type={verContrasena ? 'text' : 'password'}
                value={confirmacion}
                onChange={(evento) => setConfirmacion(evento.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                className={inputClasses({ invalid })}
              />
            )}
          </Field>

          <div>
            <label htmlFor="registro-terminos" className="flex cursor-pointer items-start gap-3 py-2 text-sm text-gray-400">
              <input
                id="registro-terminos"
                type="checkbox"
                checked={aceptaTerminos}
                onChange={(evento) => setAceptaTerminos(evento.target.checked)}
                aria-describedby={errores.terminos ? 'registro-terminos-error' : undefined}
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600"
              />
              <span>
                Acepto los{' '}
                <Link to="/terms" className="font-bold text-brand-500 underline underline-offset-2 hover:text-white">
                  términos y condiciones
                </Link>{' '}
                de Thaiger Supplements.
              </span>
            </label>
            {errores.terminos && (
              <p id="registro-terminos-error" role="alert" className="text-[11px] font-bold text-red-500">
                {errores.terminos}
              </p>
            )}
          </div>

          <div aria-live="polite">
            {errorGeneral && (
              <p
                role="alert"
                className="rounded-sm border border-red-800 bg-red-950/40 px-4 py-3 text-sm font-bold text-red-400"
              >
                {errorGeneral}
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
              <UserPlus size={18} aria-hidden="true" />
            )}
            Crear Cuenta
          </button>
        </form>

        <div className="mt-8 border-t border-gray-800 pt-6 text-center">
          <p className="text-sm text-gray-500">¿Ya tienes cuenta?</p>
          <Link
            to="/login"
            state={location.state}
            className="mt-2 inline-flex min-h-[44px] items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest text-brand-500 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Volver al acceso
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
