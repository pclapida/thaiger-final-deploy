import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock, CreditCard, Loader2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import AuthLayout from '../components/AuthLayout';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { payments as paymentsApi } from '../services/api';

/**
 * Aquí regresa el cliente desde Mercado Pago (back_urls de la preferencia).
 *
 * El estado de la URL es orientativo: lo que manda es la notificación que
 * Mercado Pago envía al servidor (mp-webhook), que es la que marca el pedido
 * como pagado. Por eso «éxito» dice "en cuanto se confirme" y no "pagado".
 */
const RESULTADOS = {
  exito: {
    icono: CheckCircle,
    tono: 'text-emerald-400',
    titulo: 'Pago recibido',
    texto: 'Mercado Pago aprobó tu pago. En cuanto nos lo confirme —normalmente en segundos— tu pedido pasa a «Pagado» y te avisamos por correo.',
  },
  pendiente: {
    icono: Clock,
    tono: 'text-brand-500',
    titulo: 'Pago pendiente',
    texto: 'Tu pago quedó en espera (por ejemplo, un pago en OXXO que aún no se realiza). El pedido queda apartado y se confirma solo cuando se acredite.',
  },
  fallo: {
    icono: XCircle,
    tono: 'text-red-400',
    titulo: 'El pago no se completó',
    texto: 'No se realizó ningún cargo. Tu pedido sigue apartado: puedes intentar pagar de nuevo con otro medio.',
  },
};

export default function PagoResultado() {
  const [parametros] = useSearchParams();
  const estado = RESULTADOS[parametros.get('estado')] ? parametros.get('estado') : 'pendiente';
  const pedidoId = parametros.get('pedido') || '';
  const [reintentando, setReintentando] = useState(false);

  const resultado = RESULTADOS[estado];
  const Icono = resultado.icono;

  useDocumentTitle(resultado.titulo, 'Resultado del pago de tu pedido en Thaiger Supplements.');

  const reintentar = async () => {
    if (!pedidoId || reintentando) return;
    setReintentando(true);
    try {
      const pago = await paymentsApi.start(pedidoId);
      window.location.assign(pago.init_point);
    } catch (fallo) {
      toast.error(fallo?.message || 'No pudimos reiniciar el pago.');
      setReintentando(false);
    }
  };

  return (
    <AuthLayout
      title={resultado.titulo}
      description={resultado.texto}
      footer={
        <Link
          to="/profile"
          className="inline-flex min-h-[44px] items-center justify-center text-sm font-bold uppercase tracking-widest text-brand-500 transition-colors hover:text-white"
        >
          Ver mis pedidos
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <Icono size={48} className={resultado.tono} aria-hidden="true" />
        {pedidoId && (
          <p className="text-xs uppercase tracking-widest text-gray-400">
            Pedido <span className="font-mono font-bold text-white">TH-{pedidoId.split('-')[0].toUpperCase()}</span>
          </p>
        )}

        {estado === 'fallo' && pedidoId && (
          <button
            type="button"
            onClick={reintentar}
            disabled={reintentando}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sm bg-brand-600 px-6 py-4 text-sm font-black uppercase italic tracking-widest text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {reintentando ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <CreditCard size={18} aria-hidden="true" />
            )}
            Intentar pagar de nuevo
          </button>
        )}
      </div>
    </AuthLayout>
  );
}
