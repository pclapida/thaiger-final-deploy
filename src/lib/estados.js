/**
 * Las 32 entidades federativas, como las esperan las paqueterías (Skydropx
 * las recibe en `area_level1`). Una lista cerrada evita «NL», «N.L.» y
 * «Nuevo Leon» para el mismo estado.
 */
export const ESTADOS_MX = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
];

/** Cómo se escribe la dirección de un pedido en una línea, con lo que tenga. */
export function lineaDireccion(envio = {}) {
  const partes = [envio.address, envio.neighborhood && `Col. ${envio.neighborhood}`, envio.city, envio.state]
    .map((parte) => String(parte ?? '').trim())
    .filter(Boolean);
  const cp = String(envio.zip ?? '').trim();
  return `${partes.join(', ')}${cp ? `, C.P. ${cp}` : ''}`;
}
