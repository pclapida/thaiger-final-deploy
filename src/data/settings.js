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
      'Suplementos deportivos originales con precios por volumen y envíos a toda la República Mexicana.',
    // Vacíos hasta capturarlos en Ajustes: el pie oculta lo que no tenga valor.
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    hours: 'Lunes a viernes de 9:00 a 18:00',
    shippingNote: 'Envíos a toda la República Mexicana',
  },

  /**
   * Cuenta para transferencias SPEI. Sin capturar todavía: mientras `isDemo`
   * siga en true, el checkout avisa que no se transfiera a esta cuenta.
   */
  payment: {
    bank: 'Por configurar',
    clabe: '000000000000000000',
    beneficiary: 'Thaiger Supplements',
    instructions:
      'Tu pedido se aparta al confirmarlo. Para procesarlo debes transferir el total a esta cuenta usando el concepto indicado.',
    isDemo: true,
    /**
     * Cómo cobra la tienda: 'spei' (transferencia manual, los datos de arriba)
     * o 'mercadopago' (Checkout Pro: tarjeta, SPEI y OXXO con confirmación
     * automática). Mercado Pago necesita la tienda en Supabase con la Edge
     * Function `crear-pago` desplegada; ver DESPLIEGUE.md.
     */
    gateway: 'spei',
  },

  /** Reglas de envío (las consume src/lib/pricing.js). */
  shipping: {
    freeFrom: 5000,
    cost: 250,
    /**
     * 'manual': se cobra `cost` y la guía se compra fuera (se captura el
     * rastreo a mano). 'skydropx': el checkout cotiza con la paquetería por
     * código postal y el panel genera la guía. Necesita las credenciales en
     * los secretos de Supabase.
     */
    provider: 'manual',
    /** Desde dónde sale todo: la paquetería lo pide para cotizar y para la guía. */
    origin: {
      name: '',
      company: '',
      street: '',
      neighborhood: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
      email: '',
    },
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

  /**
   * Quién vende, para las páginas legales (términos, aviso de privacidad,
   * devoluciones). Vacío = se usa el nombre y la dirección de la tienda, y el
   * panel avisa de que falta. Ver src/lib/legal.js.
   */
  legal: {
    businessName: '',
    rfc: '',
    fiscalAddress: '',
    privacyEmail: '',
  },

  /** Aviso permanente en la barra superior. Vacío = no se muestra. */
  banner: {
    text: '',
    active: false,
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
    shipping: {
      ...base.shipping,
      ...(saved.shipping || {}),
      origin: { ...base.shipping.origin, ...(saved.shipping?.origin || {}) },
    },
    tiers: { ...base.tiers, ...(saved.tiers || {}) },
    home: { ...base.home, ...(saved.home || {}) },
    social: { ...base.social, ...(saved.social || {}) },
    legal: { ...base.legal, ...(saved.legal || {}) },
    banner: { ...base.banner, ...(saved.banner || {}) },
    hero: Array.isArray(saved.hero) && saved.hero.length > 0 ? saved.hero : base.hero,
  };
}
