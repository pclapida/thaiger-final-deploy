import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

/**
 * Confirmación para acciones que no se pueden deshacer.
 *
 * Sustituye a `window.confirm()`: aquel bloquea el hilo, no se puede probar y
 * se ve como una alerta del navegador en medio de la tienda.
 */
export default function ConfirmDialog({
  open,
  title = '¿Seguro?',
  message,
  confirmLabel = 'Sí, continuar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const tonos = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-amber-600 hover:bg-amber-700',
    brand: 'bg-brand-600 hover:bg-brand-700',
  };

  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm" closeOnBackdrop={!busy}>
      <div className="flex items-start gap-4">
        <AlertTriangle className={tone === 'danger' ? 'shrink-0 text-red-500' : 'shrink-0 text-amber-500'} size={28} />
        <p className="text-sm leading-relaxed text-gray-300">{message}</p>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-[44px] px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-white disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`min-h-[44px] rounded-sm px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors disabled:opacity-60 ${tonos[tone] || tonos.danger}`}
        >
          {busy ? 'Trabajando...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
