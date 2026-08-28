import React from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  Truck,
  Youtube,
} from 'lucide-react';
import Reveal from './ui/Reveal';
import { useSettings } from '../context/SettingsContext';
import { sanitizeLinkUrl, sanitizeText } from '../lib/security';

/**
 * Pie de página.
 *
 * Todo lo que se ve aquí sale de la configuración de la tienda: contacto,
 * horario y redes. Los iconos de redes sólo se pintan si hay un enlace real
 * y seguro detrás — el pie anterior tenía tres `href="#"` que no llevaban a
 * ninguna parte.
 */

const REDES = [
  { clave: 'facebook', etiqueta: 'Facebook', Icono: Facebook },
  { clave: 'instagram', etiqueta: 'Instagram', Icono: Instagram },
  { clave: 'tiktok', etiqueta: 'TikTok', Icono: Music2 },
  { clave: 'youtube', etiqueta: 'YouTube', Icono: Youtube },
];

const ATENCION = [
  { to: '/shop', etiqueta: 'Realizar Pedido' },
  { to: '/cart', etiqueta: 'Mi Carrito' },
  { to: '/profile', etiqueta: 'Mi Cuenta' },
  { to: '/refunds', etiqueta: 'Política de Reembolsos' },
  { to: '/terms', etiqueta: 'Términos y Condiciones' },
];

const EMPRESA = [
  { to: '/about', etiqueta: 'Quiénes somos' },
  { to: '/brands', etiqueta: 'Marcas' },
  { to: '/offers', etiqueta: 'Ofertas' },
  { to: '/wholesale', etiqueta: 'Venta de Mayoreo' },
];

/** Sólo dígitos, para construir `tel:` y el enlace de WhatsApp. */
function soloDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

function Columna({ titulo, children, indice }) {
  return (
    <Reveal index={indice}>
      <h2 className="mb-5 inline-block border-b border-brand-600/40 pb-2 text-sm font-bold uppercase tracking-widest text-white">
        {titulo}
      </h2>
      {children}
    </Reveal>
  );
}

function EnlaceLista({ to, children }) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-11 items-center text-sm text-gray-400 transition-all duration-300 hover:pl-2 hover:text-brand-500 sm:min-h-9"
      >
        {children}
      </Link>
    </li>
  );
}

export default function Footer() {
  const { settings } = useSettings();
  const tienda = settings?.store || {};

  const anio = new Date().getFullYear();

  const nombre = sanitizeText(tienda.name, { maxLength: 60 }) || 'Thaiger Supplements';
  const lema = sanitizeText(tienda.tagline, { maxLength: 120 });
  const descripcion = sanitizeText(tienda.description, { maxLength: 320, allowNewlines: false });

  const correo = sanitizeText(tienda.email, { maxLength: 120 });
  const telefono = sanitizeText(tienda.phone, { maxLength: 40 });
  const whatsapp = soloDigitos(tienda.whatsapp);
  const direccion = sanitizeText(tienda.address, { maxLength: 160 });
  const horario = sanitizeText(tienda.hours, { maxLength: 120 });
  const notaEnvio = sanitizeText(tienda.shippingNote, { maxLength: 160 });

  // El "+" sólo se conserva si el número ya venía en formato internacional:
  // añadirlo a un número nacional produce un enlace que no marca.
  const digitosTelefono = soloDigitos(telefono);
  const prefijoInternacional = String(tienda.phone ?? '').trim().startsWith('+') ? '+' : '';

  const enlaceCorreo = correo ? sanitizeLinkUrl(`mailto:${correo}`) : '';
  const enlaceTelefono = digitosTelefono
    ? sanitizeLinkUrl(`tel:${prefijoInternacional}${digitosTelefono}`)
    : '';
  const enlaceWhatsapp = whatsapp ? sanitizeLinkUrl(`https://wa.me/${whatsapp}`) : '';

  const redes = REDES.map((red) => ({ ...red, url: sanitizeLinkUrl(settings?.social?.[red.clave]) })).filter(
    (red) => red.url
  );

  return (
    // `pb-24` en móvil: el carrito y la tienda montan barras fijas abajo
    // (`lg:hidden`) que taparían la última fila del pie.
    <footer className="no-imprimir mt-20 border-t border-carbon-700 bg-carbon-950 pb-24 text-gray-400 lg:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* -------------------------------------------------------- marca */}
          <Reveal index={0} className="space-y-4">
            <Link to="/" className="inline-flex items-center gap-2" aria-label={`${nombre}, ir al inicio`}>
              <img src="/logo.png" alt="" aria-hidden="true" className="h-11 w-auto object-contain" />
              <span className="text-xl font-black italic tracking-tighter text-white">THAIGER</span>
            </Link>

            {lema && <p className="text-sm font-semibold text-gray-300">{lema}</p>}
            {descripcion && <p className="max-w-xs text-xs leading-relaxed text-gray-400">{descripcion}</p>}

            {redes.length > 0 && (
              <div>
                <h2 className="sr-only">Redes sociales</h2>
                <ul className="flex flex-wrap gap-2 pt-2">
                  {redes.map((red) => (
                    <li key={red.clave}>
                      <a
                        href={red.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${nombre} en ${red.etiqueta}`}
                        className="flex h-11 w-11 items-center justify-center rounded-sm bg-carbon-800 text-gray-300 transition-all hover:-translate-y-1 hover:bg-brand-600 hover:text-white"
                      >
                        <red.Icono size={19} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Reveal>

          {/* ----------------------------------------------------- atención */}
          <Columna titulo="Atención" indice={1}>
            <ul className="space-y-1">
              {ATENCION.map((enlace) => (
                <EnlaceLista key={enlace.etiqueta} to={enlace.to}>
                  {enlace.etiqueta}
                </EnlaceLista>
              ))}
            </ul>
          </Columna>

          {/* ------------------------------------------------------ thaiger */}
          <Columna titulo="Thaiger" indice={2}>
            <ul className="space-y-1">
              {EMPRESA.map((enlace) => (
                <EnlaceLista key={enlace.etiqueta} to={enlace.to}>
                  {enlace.etiqueta}
                </EnlaceLista>
              ))}
            </ul>
          </Columna>

          {/* ----------------------------------------------------- contacto */}
          <Columna titulo="Contacto" indice={3}>
            <ul className="space-y-3 text-sm">
              {enlaceCorreo && (
                <li>
                  <a
                    href={enlaceCorreo}
                    className="flex min-h-11 items-start gap-3 break-all text-gray-400 transition-colors hover:text-brand-500 sm:min-h-9"
                  >
                    <Mail size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
                    {correo}
                  </a>
                </li>
              )}

              {enlaceTelefono && (
                <li>
                  <a
                    href={enlaceTelefono}
                    className="flex min-h-11 items-start gap-3 text-gray-400 transition-colors hover:text-brand-500 sm:min-h-9"
                  >
                    <Phone size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
                    {telefono}
                  </a>
                </li>
              )}

              {enlaceWhatsapp && (
                <li>
                  <a
                    href={enlaceWhatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 items-start gap-3 text-gray-400 transition-colors hover:text-brand-500 sm:min-h-9"
                  >
                    <MessageCircle size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
                    WhatsApp
                  </a>
                </li>
              )}

              {direccion && (
                <li className="flex items-start gap-3 text-gray-400">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
                  {direccion}
                </li>
              )}

              {horario && (
                <li className="flex items-start gap-3 text-gray-400">
                  <Clock size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
                  {horario}
                </li>
              )}

              {notaEnvio && (
                <li className="flex items-start gap-3 text-gray-400">
                  <Truck size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
                  {notaEnvio}
                </li>
              )}
            </ul>
          </Columna>
        </div>
      </div>

      {/* ------------------------------------------------------ barra inferior */}
      <div className="border-t border-carbon-700">
        {/* Gris claro a propósito: sobre negro, `gray-600`/`gray-700` no pasan de
            2.8:1 y justo el aviso de que la tienda es una demo hay que leerlo. */}
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-6 text-center text-[11px] uppercase tracking-widest text-gray-400 sm:flex-row sm:justify-between sm:text-left">
          <p>
            © {anio} {nombre}
          </p>
          <p>Sitio de demostración · Datos de ejemplo</p>
        </div>
      </div>
    </footer>
  );
}
