/**
 * Generador de imágenes de ejemplo (SVG) para el catálogo y el carrusel.
 *
 * El proyecto ya no incluye fotografías reales de producto: todas las imágenes
 * son ilustraciones generadas aquí, en la paleta de la tienda, para que la demo
 * se vea completa sin depender de archivos externos ni de derechos de terceros.
 *
 *   node scripts/generate-demo-assets.mjs
 *
 * Escribe en:
 *   public/images/products/<id>.svg   una ilustración por producto
 *   public/images/hero/<slug>.svg     los fondos del carrusel de inicio
 *   public/images/brands/<slug>.svg   el "logotipo" de cada marca ficticia
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRODUCTS, DEMO_BRANDS } from '../src/data/products.js';
import { DEFAULT_HERO_SLIDES } from '../src/data/settings.js';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const salida = (...partes) => resolve(raiz, 'public', 'images', ...partes);

// ---------------------------------------------------------------- utilidades

/** Aclara u oscurece un color #rrggbb. `amount` va de -1 (negro) a 1 (blanco). */
function mix(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const canal = (desplazamiento) => {
    const valor = (n >> desplazamiento) & 0xff;
    const destino = amount >= 0 ? 255 : 0;
    return Math.round(valor + (destino - valor) * Math.abs(amount));
  };
  return `#${[canal(16), canal(8), canal(0)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Parte un nombre largo en varias líneas para que quepa en la etiqueta. */
function envolver(texto, porLinea, maxLineas) {
  const palabras = String(texto).toUpperCase().split(/\s+/);
  const lineas = [];
  let actual = '';

  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (candidata.length > porLinea && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = candidata;
    }
  }
  if (actual) lineas.push(actual);

  if (lineas.length > maxLineas) {
    const recortadas = lineas.slice(0, maxLineas);
    recortadas[maxLineas - 1] = `${recortadas[maxLineas - 1].slice(0, porLinea - 1)}…`;
    return recortadas;
  }
  return lineas;
}

// ----------------------------------------------------- envases por categoría

/** Cada categoría se dibuja con la silueta de su envase típico. */
const ENVASES = {
  Proteína: 'bote',
  Creatina: 'bote',
  'Pre-Entreno': 'bote',
  Quemador: 'frasco',
  Salud: 'frasco',
  Aminos: 'botella',
  Comida: 'bolsa',
  Accesorios: 'shaker',
};

function siluetaBote(color) {
  const claro = mix(color, 0.25);
  const oscuro = mix(color, -0.35);
  return `
    <rect x="150" y="150" width="300" height="70" rx="22" fill="${oscuro}"/>
    <rect x="163" y="132" width="274" height="42" rx="16" fill="${mix(color, -0.15)}"/>
    <path d="M155 210 h290 v300 a44 44 0 0 1 -44 44 h-202 a44 44 0 0 1 -44 -44 z" fill="url(#cuerpo)"/>
    <rect x="185" y="268" width="230" height="190" rx="12" fill="#ffffff" opacity="0.94"/>
    <rect x="185" y="268" width="230" height="34" rx="12" fill="${claro}"/>
    <rect x="185" y="290" width="230" height="12" fill="${claro}"/>
  `;
}

function siluetaFrasco(color) {
  const claro = mix(color, 0.25);
  const oscuro = mix(color, -0.35);
  return `
    <rect x="215" y="128" width="170" height="56" rx="16" fill="${oscuro}"/>
    <path d="M198 180 h204 v300 a46 46 0 0 1 -46 46 h-112 a46 46 0 0 1 -46 -46 z" fill="url(#cuerpo)"/>
    <rect x="224" y="242" width="152" height="176" rx="10" fill="#ffffff" opacity="0.94"/>
    <rect x="224" y="242" width="152" height="30" rx="10" fill="${claro}"/>
    <rect x="224" y="262" width="152" height="10" fill="${claro}"/>
  `;
}

function siluetaBotella(color) {
  const claro = mix(color, 0.25);
  const oscuro = mix(color, -0.35);
  return `
    <rect x="262" y="92" width="76" height="60" rx="14" fill="${oscuro}"/>
    <path d="M258 150 h84 l34 76 v276 a44 44 0 0 1 -44 44 h-64 a44 44 0 0 1 -44 -44 v-276 z" fill="url(#cuerpo)"/>
    <rect x="238" y="268" width="124" height="182" rx="10" fill="#ffffff" opacity="0.94"/>
    <rect x="238" y="268" width="124" height="28" rx="10" fill="${claro}"/>
    <rect x="238" y="286" width="124" height="10" fill="${claro}"/>
  `;
}

function siluetaBolsa(color) {
  const claro = mix(color, 0.25);
  return `
    <path d="M170 168 q130 -46 260 0 v330 a30 30 0 0 1 -30 30 h-200 a30 30 0 0 1 -30 -30 z" fill="url(#cuerpo)"/>
    <path d="M170 168 q130 -46 260 0 v26 q-130 -46 -260 0 z" fill="${mix(color, -0.4)}"/>
    <rect x="204" y="266" width="192" height="184" rx="12" fill="#ffffff" opacity="0.94"/>
    <rect x="204" y="266" width="192" height="32" rx="12" fill="${claro}"/>
    <rect x="204" y="288" width="192" height="10" fill="${claro}"/>
  `;
}

function siluetaShaker(color) {
  const claro = mix(color, 0.25);
  const oscuro = mix(color, -0.35);
  return `
    <rect x="222" y="112" width="156" height="52" rx="18" fill="${oscuro}"/>
    <path d="M206 160 h188 v322 a48 48 0 0 1 -48 48 h-92 a48 48 0 0 1 -48 -48 z" fill="url(#cuerpo)" opacity="0.9"/>
    <rect x="236" y="238" width="128" height="176" rx="10" fill="#ffffff" opacity="0.9"/>
    <rect x="236" y="238" width="128" height="30" rx="10" fill="${claro}"/>
    <g stroke="${mix(color, -0.2)}" stroke-width="5" stroke-linecap="round" opacity="0.55">
      <line x1="392" y1="230" x2="416" y2="230"/>
      <line x1="392" y1="290" x2="416" y2="290"/>
      <line x1="392" y1="350" x2="416" y2="350"/>
      <line x1="392" y1="410" x2="416" y2="410"/>
    </g>
  `;
}

const SILUETAS = {
  bote: siluetaBote,
  frasco: siluetaFrasco,
  botella: siluetaBotella,
  bolsa: siluetaBolsa,
  shaker: siluetaShaker,
};

/** Zona blanca de la etiqueta según el envase, para centrar el texto. */
const ETIQUETAS = {
  bote: { x: 300, y: 340, ancho: 17 },
  frasco: { x: 300, y: 318, ancho: 13 },
  botella: { x: 300, y: 340, ancho: 11 },
  bolsa: { x: 300, y: 340, ancho: 15 },
  shaker: { x: 300, y: 312, ancho: 11 },
};

function svgProducto(producto, marca) {
  const envase = ENVASES[producto.category] || 'bote';
  const color = marca?.color || '#ea580c';
  const etiqueta = ETIQUETAS[envase];
  const lineas = envolver(producto.shortName || producto.name, etiqueta.ancho, 3);
  const alturaLinea = 30;
  const inicio = etiqueta.y - ((lineas.length - 1) * alturaLinea) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="${escapar(producto.name)}">
  <defs>
    <linearGradient id="cuerpo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${mix(color, 0.18)}"/>
      <stop offset="55%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${mix(color, -0.4)}"/>
    </linearGradient>
    <radialGradient id="piso" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="600" height="600" fill="#ffffff"/>
  <ellipse cx="300" cy="548" rx="180" ry="26" fill="url(#piso)"/>
  ${SILUETAS[envase](color)}

  <text x="${etiqueta.x}" y="${inicio - 34}" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="17" font-weight="800" letter-spacing="2.5" fill="${mix(color, -0.45)}">${escapar(marca?.name || 'THAIGER')}</text>
  ${lineas
    .map(
      (linea, i) =>
        `<text x="${etiqueta.x}" y="${inicio + i * alturaLinea}" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="26" font-weight="900" fill="#111111">${escapar(linea)}</text>`
    )
    .join('\n  ')}
  <text x="${etiqueta.x}" y="${inicio + lineas.length * alturaLinea + 16}" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="15" font-weight="700" letter-spacing="3" fill="${color}">${escapar(producto.category.toUpperCase())}</text>
  <text x="${etiqueta.x}" y="${inicio + lineas.length * alturaLinea + 40}" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="12" font-weight="600" letter-spacing="2" fill="#9ca3af">IMAGEN DE EJEMPLO</text>
</svg>
`;
}

// ------------------------------------------------------------------- carrusel

function svgHero(slide, indice) {
  const color = slide.color || '#ea580c';
  const semilla = indice * 37;

  const rayas = Array.from({ length: 9 }, (_, i) => {
    const x = 120 + i * 190 + (semilla % 60);
    const opacidad = (0.05 + ((i * 7 + semilla) % 9) / 60).toFixed(3);
    return `<path d="M${x} -100 l180 0 l-320 1100 l-180 0 z" fill="${color}" opacity="${opacidad}"/>`;
  }).join('\n    ');

  const puntos = Array.from({ length: 40 }, (_, i) => {
    const x = ((i * 149 + semilla * 31) % 1900) + 10;
    const y = ((i * 233 + semilla * 17) % 880) + 10;
    const r = 1 + ((i + semilla) % 3);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="0.10"/>`;
  }).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 900" width="1920" height="900" role="img" aria-label="${escapar(slide.title)}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#000000"/>
      <stop offset="52%" stop-color="${mix(color, -0.78)}"/>
      <stop offset="100%" stop-color="${mix(color, -0.45)}"/>
    </linearGradient>
    <radialGradient id="brillo" cx="0.72" cy="0.34" r="0.55">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1920" height="900" fill="url(#fondo)"/>
  <g>
    ${rayas}
  </g>
  <rect width="1920" height="900" fill="url(#brillo)"/>
  <g>
    ${puntos}
  </g>
  <path d="M1240 0 l260 0 l-420 900 l-260 0 z" fill="${color}" opacity="0.22"/>
  <path d="M1500 0 l90 0 l-420 900 l-90 0 z" fill="${color}" opacity="0.40"/>
  <text x="1500" y="470" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="150" font-weight="900" font-style="italic" fill="#ffffff" opacity="0.07" letter-spacing="6">${escapar(slide.brand || 'THAIGER')}</text>
</svg>
`;
}

// --------------------------------------------------------------------- marcas

function svgMarca(marca) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" width="600" height="300" role="img" aria-label="${escapar(marca.name)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${mix(marca.color, 0.2)}"/>
      <stop offset="100%" stop-color="${mix(marca.color, -0.35)}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="300" fill="url(#g)"/>
  <path d="M0 300 l180 -300 l90 0 l-180 300 z" fill="#ffffff" opacity="0.10"/>
  <path d="M420 300 l180 -300 l60 0 l-180 300 z" fill="#000000" opacity="0.12"/>
  <text x="300" y="140" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="54" font-weight="900" font-style="italic" fill="#ffffff" letter-spacing="2">${escapar(marca.name)}</text>
  <line x1="180" y1="168" x2="420" y2="168" stroke="#ffffff" stroke-width="4" opacity="0.7"/>
  <text x="300" y="212" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="7" fill="#ffffff" opacity="0.8">MARCA DE EJEMPLO</text>
</svg>
`;
}

// ----------------------------------------------------------------------- main

async function main() {
  const marcasPorNombre = new Map(DEMO_BRANDS.map((marca) => [marca.name, marca]));

  for (const carpeta of ['products', 'hero', 'brands']) {
    await rm(salida(carpeta), { recursive: true, force: true });
    await mkdir(salida(carpeta), { recursive: true });
  }

  for (const producto of PRODUCTS) {
    await writeFile(salida('products', `${producto.id}.svg`), svgProducto(producto, marcasPorNombre.get(producto.brand)), 'utf8');
  }

  for (const [indice, slide] of DEFAULT_HERO_SLIDES.entries()) {
    const archivo = slide.image.split('/').pop();
    await writeFile(salida('hero', archivo), svgHero(slide, indice), 'utf8');
  }

  for (const marca of DEMO_BRANDS) {
    await writeFile(salida('brands', `${marca.slug}.svg`), svgMarca(marca), 'utf8');
  }

  console.log(
    `Listo: ${PRODUCTS.length} productos, ${DEFAULT_HERO_SLIDES.length} fondos de carrusel y ${DEMO_BRANDS.length} marcas.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
