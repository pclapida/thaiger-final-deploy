/* eslint-disable react-refresh/only-export-components */
// Además de los componentes, este archivo exporta `inputClasses`: las clases del
// input estándar tienen que vivir junto al componente que las define, o los
// formularios a medida acaban inventando su propio estilo.
import React, { useId } from 'react';

/**
 * Campo de formulario con su etiqueta correctamente asociada.
 *
 * Todos los formularios del sitio pasan por aquí para que ninguna etiqueta
 * vuelva a quedarse sin `htmlFor` —era uno de los fallos de accesibilidad del
 * panel y del perfil— y para que el error se anuncie a los lectores de pantalla.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  children,
  className = '',
  id: idProp,
}) {
  const generado = useId();
  const id = idProp || generado;
  const hintId = hint ? `${id}-ayuda` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={`space-y-2 ${className}`}>
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider text-gray-500">
        {label} {required && <span className="text-brand-500">*</span>}
      </label>

      {children({ id, describedBy: [hintId, errorId].filter(Boolean).join(' ') || undefined, invalid: Boolean(error) })}

      {hint && !error && (
        <p id={hintId} className="text-[11px] leading-relaxed text-gray-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[11px] font-bold text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

// `text-base sm:text-sm`: Safari en iOS hace zoom automático al enfocar un campo
// con menos de 16px y deja la página ampliada. En escritorio vuelve a 14px.
// El placeholder lleva el formato esperado del campo, así que tiene que leerse:
// `text-gray-700` daba 1.9:1 sobre el fondo, muy por debajo del mínimo de 4.5:1.
const BASE_INPUT =
  'w-full rounded-sm border bg-carbon-900 p-3 text-base text-white transition-colors placeholder:text-gray-400 focus:outline-none sm:text-sm';

/** Clases del `input` estándar. Se exportan para los casos a medida. */
export function inputClasses({ invalid = false, extra = '' } = {}) {
  return `${BASE_INPUT} ${invalid ? 'border-red-600 focus:border-red-500' : 'border-gray-700 focus:border-brand-500'} ${extra}`;
}

/** Atajo para el caso más común: etiqueta + input controlado. */
export function TextField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  className,
  inputClassName = '',
  ...inputProps
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          value={value}
          onChange={onChange}
          className={inputClasses({ invalid, extra: inputClassName })}
          {...inputProps}
        />
      )}
    </Field>
  );
}

/** Igual que `TextField` pero con `<textarea>`. */
export function TextAreaField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  rows = 3,
  className,
  inputClassName = '',
  ...props
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          value={value}
          onChange={onChange}
          className={inputClasses({ invalid, extra: `resize-y ${inputClassName}` })}
          {...props}
        />
      )}
    </Field>
  );
}

export default Field;
