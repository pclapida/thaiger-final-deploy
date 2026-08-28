/**
 * Envoltorio mínimo sobre IndexedDB (sin dependencias).
 * Se usa como "base de datos local" cuando no hay Supabase configurado.
 */

const DB_NAME = 'thaiger_local_db';
// v2 añade el almacén `settings` (configuración editable desde el panel).
const DB_VERSION = 2;
export const STORES = ['products', 'users', 'orders', 'order_items', 'settings', 'meta'];

let dbPromise = null;

function getIndexedDB() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB no está disponible en este entorno.');
  }
  return indexedDB;
}

export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = getIndexedDB().open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('La base de datos local está bloqueada por otra pestaña.'));
  });

  return dbPromise;
}

function runTx(storeName, mode, operation) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result;

        try {
          const request = operation(store);
          if (request) request.onsuccess = () => { result = request.result; };
        } catch (error) {
          tx.abort();
          reject(error);
          return;
        }

        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export const idb = {
  getAll: (store) => runTx(store, 'readonly', (s) => s.getAll()),
  get: (store, id) => runTx(store, 'readonly', (s) => s.get(id)),
  put: (store, value) => runTx(store, 'readwrite', (s) => s.put(value)).then(() => value),
  remove: (store, id) => runTx(store, 'readwrite', (s) => s.delete(id)),
  clear: (store) => runTx(store, 'readwrite', (s) => s.clear()),
  count: (store) => runTx(store, 'readonly', (s) => s.count()),

  /** Inserta o actualiza muchos registros en una sola transacción. */
  putMany: (store, values) =>
    openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite');
          const objectStore = tx.objectStore(store);
          for (const value of values) objectStore.put(value);
          tx.oncomplete = () => resolve(values.length);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        })
    ),
};

/** Sólo para pruebas: descarta la conexión cacheada. */
export function _resetConnection() {
  dbPromise = null;
}

/**
 * Borra la base local por completo (opción "restablecer datos" del panel).
 * Cierra la conexión abierta primero: si no, el navegador deja la petición
 * bloqueada hasta que se cierren todas las pestañas.
 */
export async function deleteDatabase() {
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      /* la conexión ya estaba cerrada */
    }
    dbPromise = null;
  }

  await new Promise((resolve, reject) => {
    const request = getIndexedDB().deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    // Otra pestaña con la base abierta impide borrarla; no bloqueamos al usuario.
    request.onblocked = () => resolve();
  });
}
