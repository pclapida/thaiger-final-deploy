import React from 'react';
import { Clock, FileText, Mail, MapPin, Phone } from 'lucide-react';

/**
 * Tarjetas con los datos de quien vende (ver `datosLegales` en src/lib/legal.js).
 * Con `soloContacto` muestra correo, teléfono y horario: lo que sirve para
 * escribir, sin repetir razón social y domicilio.
 */
export default function DatosResponsable({ legal, soloContacto = false }) {
  const datos = [
    !soloContacto && { icono: FileText, etiqueta: 'Responsable', valor: legal.responsable },
    !soloContacto && { icono: FileText, etiqueta: 'RFC', valor: legal.rfc },
    !soloContacto && { icono: MapPin, etiqueta: 'Domicilio', valor: legal.domicilio },
    { icono: Mail, etiqueta: 'Correo', valor: legal.correo, href: legal.correo && `mailto:${legal.correo}` },
    { icono: Phone, etiqueta: 'Teléfono', valor: legal.telefono },
    { icono: Clock, etiqueta: 'Horario de atención', valor: legal.horario },
  ].filter((dato) => dato && dato.valor);

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {datos.map((dato) => (
        <div key={dato.etiqueta} className="rounded-lg border border-gray-800 bg-carbon-900/60 p-4">
          <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            <dato.icono size={13} aria-hidden="true" />
            {dato.etiqueta}
          </dt>
          <dd className="mt-1 break-words text-sm text-gray-300">
            {dato.href ? (
              <a href={dato.href} className="text-brand-400 underline-offset-2 hover:underline">
                {dato.valor}
              </a>
            ) : (
              dato.valor
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
