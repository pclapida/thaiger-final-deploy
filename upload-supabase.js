import { createClient } from '@supabase/supabase-js';
import { PRODUCTS } from './src/data/products.js';

// Claves leídas desde variables de entorno (configura SUPABASE_URL y SUPABASE_KEY antes de ejecutar)
const supabaseUrl = process.env.SUPABASE_URL || 'TU_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_KEY || 'TU_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadData() {
  console.log(`Starting upload of ${PRODUCTS.length} products to Supabase...`);
  
  // Try inserting all at once (batch insert). Supabase supports array inserts.
  try {
    const { data, error } = await supabase
      .from('products')
      .upsert(PRODUCTS, { onConflict: 'id' });

    if (error) {
      console.error('Error uploading to Supabase:', error.message, error.details);
    } else {
      console.log('Upload successful! 244 products inserted.');
    }
  } catch (err) {
    console.error('Exception during upload:', err);
  }
}

uploadData();
