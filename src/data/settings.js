/**
 * Configuración del sitio (datos de DEMOSTRACIÓN).
 *
 * Todo lo que aquí aparece —contacto, cuenta bancaria, textos, redes y los
 * slides del carrusel— es información de prueba y se edita desde el panel de
 * administración (`/dashboard`, pestañas «Carrusel» y «Ajustes»). Este archivo
 * sólo define los valores con los que arranca una instalación limpia.
 *
 * Al publicar de verdad hay que sustituir `payment` por la cuenta real.
 */

/** Identificador del único registro de configuración. */
export const SETTINGS_ID = 'site';

/** Slides del carrusel de inicio. `image` apunta a los fondos generados. */
export const DEFAULT_HERO_SLIDES = [
  {
    id: 'hero-1',
    title: 'THAIGER LABS',
    subtitle: 'La línea de la casa, sin relleno',
    caption: 'Distribuidores oficiales Thaiger',
    cta: 'Ver productos THAIGER LABS',
    brand: 'THAIGER LABS',
    image: '/images/hero/thaiger-labs.svg',
    color: '#ea580c',
    active: true,
  },
  {
    id: 'hero-2',
    title: 'IRON PEAK',
    subtitle: 'Volumen, fuerza y equipo pesado',
    caption: 'Para quien entrena de verdad',
    cta: 'Ver productos IRON PEAK',
    brand: 'IRON PEAK',
    image: '/images/hero/iron-peak.svg',
    color: '#0ea5e9',
    active: true,
  },
  {
    id: 'hero-3',
    title: 'VOLT SUPPS',
    subtitle: 'Energía y enfoque de alto voltaje',
    caption: 'Pre-entrenos y termogénicos',
    cta: 'Ver productos VOLT SUPPS',
    brand: 'VOLT SUPPS',
    image: '/images/hero/volt-supps.svg',
    color: '#eab308',
    active: true,
  },
  {
    id: 'hero-4',
    title: 'PURE CORE',
    subtitle: 'Fórmulas limpias para recuperarte',
    caption: 'Salud, sueño y movilidad',
    cta: 'Ver productos PURE CORE',
    brand: 'PURE CORE',
    image: '/images/hero/pure-core.svg',
    color: '#10b981',
    active: true,
  },
];

export const DEFAULT_SETTINGS = {
  id: SETTINGS_ID,

  /** Identidad y contacto de la tienda. */
  store: {
    name: 'Thaiger Supplements',
    tagline: 'Suplementación deportiva de alto rendimiento',
    description:
      'Tienda de demostración. Los productos, marcas, precios y datos de contacto de este sitio son de ejemplo.',
    email: 'demo@thaiger.mx',
    phone: '55 0000 0000',
    whatsapp: '525500000000',
    address: 'Calle Demo 000, Col. Ejemplo, CDMX',
    hours: 'Lunes a viernes de 9:00 a 18:00',
    shippingNote: 'Envíos a toda la República Mexicana',
  },

  /** Cuenta para transferencias SPEI. DATOS DE PRUEBA: cámbialos antes de vender. */
  payment: {
    bank: 'BANCO DEMO',
    clabe: '000000000000000000',
    beneficiary: 'Thaiger Supplements (DEMO)',
    instructions:
      'Tu pedido se aparta al confirmarlo. Para procesarlo debes transferir el total a esta cuenta usando el concepto indicado.',
    isDemo: true,
  },

  /** Reglas de envío (las consume src/lib/pricing.js). */
  shipping: {
    freeFrom: 5000,
    cost: 250,
  },

  /** Umbrales de los niveles de precio por monto del carrito. */
  tiers: {
    tier2From: 10000,
    tier3From: 20000,
  },

  /** Carrusel de la página de inicio. */
  hero: DEFAULT_HERO_SLIDES,

  /** Textos y bloques de la página de inicio. */
  home: {
    featuredTitle: 'Destacados',
    promoTitle: 'Promociones',
    brandsTitle: 'Marcas más populares',
    showBrandStrip: true,
  },

  /** Redes sociales del pie de página. Vacío = el icono no se muestra. */
  social: {
    facebook: '',
    instagram: '',
    tiktok: '',
    youtube: '',
  },

  /** Aviso permanente en la barra superior. Vacío = no se muestra. */
  banner: {
    text: 'Sitio de demostración: productos, precios y datos bancarios son de ejemplo.',
    active: true,
  },
};

/** Copia profunda de los valores por defecto (para no compartir referencias). */
export function buildDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

/**
 * Completa un registro guardado con los valores por defecto que le falten,
 * para que una configuración vieja no rompa la tienda al añadir campos nuevos.
 */
export function withSettingsDefaults(saved) {
  const base = buildDefaultSettings();
  if (!saved || typeof saved !== 'object') return base;

  return {
    ...base,
    ...saved,
    id: SETTINGS_ID,
    store: { ...base.store, ...(saved.store || {}) },
    payment: { ...base.payment, ...(saved.payment || {}) },
    shipping: { ...base.shipping, ...(saved.shipping || {}) },
    tiers: { ...base.tiers, ...(saved.tiers || {}) },
    home: { ...base.home, ...(saved.home || {}) },
    social: { ...base.social, ...(saved.social || {}) },
    banner: { ...base.banner, ...(saved.banner || {}) },
    hero: Array.isArray(saved.hero) && saved.hero.length > 0 ? saved.hero : base.hero,
  };
}
