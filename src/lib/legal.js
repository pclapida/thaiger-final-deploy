/**
 * Datos de quien vende, tal como los usan las páginas legales.
 *
 * Salen de Ajustes → Datos legales. Lo que falte se completa con los datos de
 * la tienda (nombre, dirección, correo) para que la página nunca muestre un
 * hueco, y `pendientes` dice qué hay que capturar: el panel lo avisa.
 */

/** Fecha de la versión vigente de los textos legales. Cámbiala al editarlos. */
export const VIGENCIA_LEGAL = '24 de septiembre de 2026';

/** Los documentos legales de la tienda, para enlazarlos entre sí. */
export const DOCUMENTOS_LEGALES = [
  { to: '/terms', etiqueta: 'Términos y condiciones' },
  { to: '/privacidad', etiqueta: 'Aviso de privacidad' },
  { to: '/refunds', etiqueta: 'Devoluciones y reembolsos' },
  { to: '/envios', etiqueta: 'Envíos y entregas' },
];

function limpio(valor) {
  return String(valor ?? '').trim();
}

export function datosLegales(settings = {}) {
  const tienda = settings.store || {};
  const legal = settings.legal || {};

  const razonSocial = limpio(legal.businessName);
  const rfc = limpio(legal.rfc).toUpperCase();
  const domicilioFiscal = limpio(legal.fiscalAddress);
  const correoPrivacidad = limpio(legal.privacyEmail);

  const pendientes = [];
  if (!razonSocial) pendientes.push('razón social o nombre de la persona física');
  if (!rfc) pendientes.push('RFC');
  if (!domicilioFiscal) pendientes.push('domicilio');

  return {
    nombreComercial: limpio(tienda.name) || 'Thaiger Supplements',
    responsable: razonSocial || limpio(tienda.name) || 'Thaiger Supplements',
    rfc,
    domicilio: domicilioFiscal || limpio(tienda.address),
    correo: correoPrivacidad || limpio(tienda.email),
    telefono: limpio(tienda.phone),
    horario: limpio(tienda.hours),
    pendientes,
  };
}
