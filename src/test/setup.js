// IndexedDB en Node para poder probar el backend local.
import 'fake-indexeddb/auto';

// Los archivos con `@vitest-environment jsdom` necesitan además algunos
// polyfills que jsdom no trae y que la app sí usa.
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');

  // Sin `globals: true`, Testing Library no registra su limpieza automática
  // y el DOM de una prueba se filtraría a la siguiente.
  const { cleanup } = await import('@testing-library/react');
  const { afterEach } = await import('vitest');
  afterEach(cleanup);

  const { webcrypto } = await import('node:crypto');
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }

  // framer-motion (whileInView) y recharts (ResponsiveContainer)
  class ObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  globalThis.IntersectionObserver ??= ObserverStub;
  globalThis.ResizeObserver ??= ObserverStub;

  window.matchMedia ??= (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });

  window.scrollTo ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};

  // Node expone un `localStorage` global incompleto que tapa al de jsdom;
  // lo sustituimos por uno en memoria con la API completa.
  const necesitaPolyfill = (candidate) =>
    !candidate || ['getItem', 'setItem', 'removeItem', 'clear'].some((m) => typeof candidate[m] !== 'function');

  if (necesitaPolyfill(globalThis.localStorage) || necesitaPolyfill(window.localStorage)) {
    const crearStorage = () => {
      const data = new Map();
      return {
        get length() {
          return data.size;
        },
        key: (i) => [...data.keys()][i] ?? null,
        getItem: (k) => (data.has(String(k)) ? data.get(String(k)) : null),
        setItem: (k, v) => data.set(String(k), String(v)),
        removeItem: (k) => data.delete(String(k)),
        clear: () => data.clear(),
      };
    };

    for (const target of [globalThis, window]) {
      Object.defineProperty(target, 'localStorage', { value: crearStorage(), configurable: true, writable: true });
      Object.defineProperty(target, 'sessionStorage', { value: crearStorage(), configurable: true, writable: true });
    }
    window.localStorage = globalThis.localStorage;
    window.sessionStorage = globalThis.sessionStorage;
  }
}
