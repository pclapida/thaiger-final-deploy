import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

import AuthLayout from '../components/AuthLayout';
import { Field, inputClasses } from '../components/ui/Field';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { auth, IS_LOCAL_MODE } from '../services/api';
import { passwordStrength, validatePassword } from '../lib/security';

const VOLVER = (
  <Link
    to="/login"
    className="inline-flex min-h-[44px] items-center justify-center text-sm font-bold uppercase tracking-widest text-brand-500 transition-colors hover:text-white"
  >
    Volver al acceso
  </Link>
);

export default function ResetPassword() {
  useDocumentTitle('Nueva contraseña', 'Elige la contraseña con la que entrarás a tu cuenta Thaiger.');

  const navigate = useNavigate();
  const [contrasena, setContrasena] = useState('');
  const [repetida, setRepetida] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // El enlace del correo trae una sesión temporal que el SDK canjea al cargar.
  // Hasta que aparezca no tiene sentido enseñar el formulario.
  const [enlace, setEnlace] = useState(IS_LOCAL_MODE ? 'no-aplica' : 'comprobando');

  useEffect(() => {
    if (IS_LOCAL_MODE) return undefined;

    let vigente = true;
    const resolver = (sesion) => {
      if (vigente) setEnlace(sesion ? 'listo' : 'caducado');
    };

    auth.getSession().then(resolver).catch(() => resolver(null));

    // Si el canje del enlace tarda, el propio cambio de sesión nos avisa.
    const cancelar = auth.onAuthStateChange((usuario) => {
      if (usuario) resolver(usuario);
    });

    return () => {
      vigente = false;
      cancelar?.();
    };
  }, []);

  const fuerza = passwordStrength(contrasena);

  const guardar = async (evento) => {
    evento.preventDefault();
    if (guardando) return;

    const problema = validatePassword(contrasena);
    if (problema) {
      setError(problema);
      return;
    }
    if (contrasena !== repetida) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setError('');
    setGuardando(true);

    try {
      await auth.completePasswordReset(contrasena);
      toast.success('Contraseña actualizada. Ya puedes entrar.');
      navigate('/login', { replace: true });
    } catch (fallo) {
      setError(fallo?.message || 'No pudimos cambiar la contraseña. Pide un enlace nuevo.');
      setGuardando(false);
    }
  };

  if (IS_LOCAL_MODE) {
    return (
      <AuthLayout
        title="Sin correo en modo local"
        description="Esta instalación guarda los datos en tu navegador y no tiene servidor de correo."
        footer={VOLVER}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <ShieldAlert size={44} className="text-brand-500" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-gray-400">
            Pídele a un administrador que restablezca tu contraseña desde el panel.
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (enlace === 'comprobando') {
    return (
      <AuthLayout title="Un momento" description="Estamos comprobando tu enlace." footer={VOLVER}>
        <div role="status" className="flex flex-col items-center gap-4 text-center">
          <Loader2 size={40} className="animate-spin text-brand-500" aria-hidden="true" />
          <p className="text-sm text-gray-400">Validando el enlace del correo...</p>
        </div>
      </AuthLayout>
    );
  }

  if (enlace === 'caducado') {
    return (
      <AuthLayout
        title="El enlace ya no sirve"
        description="Los enlaces de recuperación caducan al poco rato, y sólo se pueden usar una vez."
        footer={VOLVER}
      >
        <div className="flex flex-col items-center gap-5 text-center">
          <ShieldAlert size={44} className="text-brand-500" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-gray-400">
            Pide uno nuevo y ábrelo en cuanto llegue.
          </p>
          <Link
            to="/forgot-password"
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sm bg-brand-600 px-6 py-4 text-sm font-black uppercase italic tracking-widest text-white transition-colors hover:bg-brand-700"
          >
            Pedir otro enlace
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Nueva contraseña"
      description="Elige una que no uses en otro sitio. Al guardarla entrarás con ella."
      footer={VOLVER}
    >
      <form onSubmit={guardar} className="space-y-5" noValidate>
        <Field label="Contraseña nueva" required hint="Mínimo 8 caracteres, con letras y números.">
          {({ id, describedBy }) => (
            <div className="relative">
              <input
                id={id}
                aria-describedby={describedBy}
                type={verContrasena ? 'text' : 'password'}
                autoComplete="new-password"
                value={contrasena}
                onChange={(evento) => setContrasena(evento.target.value)}
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

        {contrasena && (
          <p aria-live="polite" className="text-xs text-gray-400">
            Fuerza: <span className="font-bold text-brand-500">{fuerza.label}</span>
          </p>
        )}

        <Field label="Repite la contraseña" required>
          {({ id, describedBy }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              type={verContrasena ? 'text' : 'password'}
              autoComplete="new-password"
              value={repetida}
              onChange={(evento) => setRepetida(evento.target.value)}
              placeholder="••••••••"
              required
              className={inputClasses()}
            />
          )}
        </Field>

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
          disabled={guardando}
          aria-busy={guardando}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sm bg-brand-600 px-6 py-4 text-sm font-black uppercase italic tracking-widest text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <KeyRound size={18} aria-hidden="true" />
          )}
          Guardar contraseña
        </button>
      </form>
    </AuthLayout>
  );
}
