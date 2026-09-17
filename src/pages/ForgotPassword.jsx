import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail, MailCheck, ShieldAlert } from 'lucide-react';

import AuthLayout from '../components/AuthLayout';
import { TextField } from '../components/ui/Field';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { auth, IS_LOCAL_MODE } from '../services/api';

export default function ForgotPassword() {
  useDocumentTitle(
    'Recuperar contraseña',
    'Te enviamos un enlace para volver a entrar a tu cuenta Thaiger.'
  );

  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const enviar = async (evento) => {
    evento.preventDefault();
    if (enviando) return;

    setError('');
    setEnviando(true);

    try {
      setResultado(await auth.requestPasswordReset(email));
    } catch (fallo) {
      setError(fallo?.message || 'No pudimos procesar la solicitud. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  // Ya se respondió: ni aquí ni en el backend se dice si la cuenta existe.
  if (resultado?.sent) {
    return (
      <AuthLayout
        title="Revisa tu correo"
        description="Si hay una cuenta con ese correo, acabamos de enviarle un enlace para elegir una contraseña nueva."
        footer={
          <Link
            to="/login"
            className="inline-flex min-h-[44px] items-center justify-center text-sm font-bold uppercase tracking-widest text-brand-500 transition-colors hover:text-white"
          >
            Volver al acceso
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <MailCheck size={44} className="text-brand-500" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-gray-400">
            El enlace caduca en un rato por seguridad. Si no llega en unos minutos, revisa la carpeta de
            correo no deseado antes de volver a pedirlo.
          </p>
        </div>
      </AuthLayout>
    );
  }

  // Modo local: no hay servidor de correo y no tiene caso fingir que sí.
  if (resultado && !resultado.sent) {
    return (
      <AuthLayout
        title="Sin correo en modo local"
        description="Esta instalación guarda los datos en tu navegador y no tiene servidor de correo."
        footer={
          <Link
            to="/login"
            className="inline-flex min-h-[44px] items-center justify-center text-sm font-bold uppercase tracking-widest text-brand-500 transition-colors hover:text-white"
          >
            Volver al acceso
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <ShieldAlert size={44} className="text-brand-500" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-gray-400">
            Pídele a un administrador que restablezca tu contraseña desde el panel, en la pestaña de
            usuarios. La recuperación por correo funciona cuando la tienda corre con Supabase.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Olvidé mi contraseña"
      description="Escribe el correo de tu cuenta y te mandamos un enlace para elegir una nueva."
      footer={
        <>
          <p className="text-sm text-gray-400">¿Ya te acordaste?</p>
          <Link
            to="/login"
            className="mt-2 inline-flex min-h-[44px] items-center justify-center text-sm font-bold uppercase tracking-widest text-brand-500 transition-colors hover:text-white"
          >
            Volver al acceso
          </Link>
        </>
      }
    >
      <form onSubmit={enviar} className="space-y-5" noValidate>
        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
          placeholder="usuario@ejemplo.com"
        />

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
          disabled={enviando}
          aria-busy={enviando}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sm bg-brand-600 px-6 py-4 text-sm font-black uppercase italic tracking-widest text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <Mail size={18} aria-hidden="true" />
          )}
          Enviar enlace
        </button>

        {IS_LOCAL_MODE && (
          <p className="text-center text-xs leading-relaxed text-gray-400">
            Esta tienda corre en modo local: los datos viven en este navegador y no hay correo que enviar.
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
