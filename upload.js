import { db } from './src/firebase.js';
import { PRODUCTS } from './src/data/products.js';
import { collection, addDoc } from 'firebase/firestore';

async function uploadData() {
  console.log('Starting upload of ' + PRODUCTS.length + ' products...');
  const productsRef = collection(db, 'products');
  let count = 0;
  for (const product of PRODUCTS) {
    try {
      await addDoc(productsRef, product);
      count++;
      if (count % 10 === 0) {
        console.log(`Uploaded ${count}/${PRODUCTS.length}...`);
      }
    } catch (e) {
      console.error('Error adding document: ' + product.name + ' | ' + e.message);
      break;
    }
  }
  console.log('Upload complete');
  process.exit();
}

uploadData();
