// Compara la aritmética de src/lib/pricing.js con la de create_order() en SQL.
// Si alguna vez divergen, el cliente ve un total y se le cobra otro.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSeedProducts } from '../../src/data/seed.js';
import { computeCartTotals } from '../../src/lib/pricing.js';

const SALIDA = process.env.SCRATCH || tmpdir();

const PSQL = ['-h', '127.0.0.1', '-p', '55432', '-U', 'postgres', '-tA'];
const sql = (q) => execFileSync('psql', [...PSQL, '-c', q], { encoding: 'utf8' }).trim();
const sqlFile = (f) => execFileSync('psql', [...PSQL, '-v', 'ON_ERROR_STOP=1', '-f', f], { encoding: 'utf8' }).trim();

const productos = buildSeedProducts();

// El catálogo real entra como JSON, para no pelearse con las comillas.
const catalogo = productos.map((p) => ({
  id: p.id, name: p.name, brand: p.brand, category: p.category,
  price1: p.price1, price2: p.price2, price3: p.price3,
  stock: 1000000, is_on_sale: Boolean(p.is_on_sale), discount_percent: Number(p.discount_percent) || 0,
}));

writeFileSync(join(SALIDA, 'catalogo.sql'), `
truncate public.order_items, public.orders cascade;
delete from public.products;
insert into public.products (id,name,brand,category,price1,price2,price3,stock,is_on_sale,discount_percent)
select id,name,brand,category,price1,price2,price3,stock,is_on_sale,discount_percent
  from jsonb_populate_recordset(null::public.products, $json$${JSON.stringify(catalogo)}$json$::jsonb);
`);
sqlFile(join(SALIDA, 'catalogo.sql'));
console.log(`Catálogo cargado: ${sql('select count(*) from public.products')} productos`);

// Cada `psql -c` abre su propia sesión, así que la identidad se fija en la
// misma llamada que la compra.
const comprar = (items) => {
  const salida = execFileSync('psql', [...PSQL,
    '-c', "select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false)",
    '-c', `select public.create_order($json$${items}$json$::jsonb, $json$${ENVIO}$json$::jsonb, '{}'::jsonb)`,
  ], { encoding: 'utf8' }).trim().split('\n');
  return JSON.parse(salida[salida.length - 1]);
};

const ENVIO = '{"fullName":"Juan Perez","phone":"5512345678","address":"Av. Demo 123","city":"CDMX","zip":"01000"}';
let fallos = 0;
let comprobados = 0;
const nivelesVistos = new Set();

// Semilla fija: la prueba tiene que dar lo mismo cada vez que se corra.
let semilla = 20260917;
const aleatorio = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);

for (let ronda = 0; ronda < 300; ronda += 1) {
  const cuantos = 1 + Math.floor(aleatorio() * 5);
  const elegidos = new Map();
  for (let i = 0; i < cuantos; i += 1) {
    const p = productos[Math.floor(aleatorio() * productos.length)];
    // Cantidades grandes a propósito: hay que cruzar los umbrales de nivel.
    elegidos.set(p.id, { ...p, quantity: 1 + Math.floor(aleatorio() * 14) });
  }
  const carrito = [...elegidos.values()];

  const js = computeCartTotals(carrito);
  const items = JSON.stringify(carrito.map((i) => ({ product_id: i.id, quantity: i.quantity })));
  const pg = comprar(items);

  nivelesVistos.add(js.tier);
  const mismo = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
  const problemas = [];
  if (Number(pg.tier) !== js.tier) problemas.push(`tier ${pg.tier} vs ${js.tier}`);
  if (!mismo(pg.subtotal, js.subtotal)) problemas.push(`subtotal ${pg.subtotal} vs ${js.subtotal.toFixed(2)}`);
  if (!mismo(pg.shipping_cost, js.shipping)) problemas.push(`envio ${pg.shipping_cost} vs ${js.shipping}`);
  if (!mismo(pg.total, js.total)) problemas.push(`total ${pg.total} vs ${js.total.toFixed(2)}`);

  comprobados += 1;
  if (problemas.length) {
    fallos += 1;
    if (fallos <= 5) console.log(`  x carrito ${items}\n    ${problemas.join(' | ')}`);
  }
}

console.log(`\nCarritos comparados: ${comprobados} (niveles alcanzados: ${[...nivelesVistos].sort().join(', ')})`);
console.log(fallos ? `DIVERGENCIAS: ${fallos}` : 'Sin divergencias: el SQL y pricing.js cobran exactamente lo mismo.');
process.exit(fallos ? 1 : 0);
