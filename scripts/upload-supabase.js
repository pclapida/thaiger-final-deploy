/**
 * Carga el catálogo base (src/data/products.js, ya normalizado y con stock)
 * en la tabla `products` de Supabase.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/upload-supabase.js
 *
 * Se puede ejecutar varias veces: hace upsert por id.
 */

import { createClient } from '@supabase/supabase-js';
import { buildSeedProducts } from '../src/data/seed.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Falta configurar SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CHUNK_SIZE = 100;

async function main() {
  const products = buildSeedProducts();
  console.log(`Subiendo ${products.length} productos...`);

  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunk = products.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'id' });

    if (error) {
      console.error(`Error en el lote ${i / CHUNK_SIZE + 1}:`, error.message);
      process.exit(1);
    }

    console.log(`  ${Math.min(i + CHUNK_SIZE, products.length)}/${products.length}`);
  }

  console.log('Catálogo cargado correctamente.');
}

main();
