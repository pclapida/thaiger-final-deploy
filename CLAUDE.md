# CLAUDE.md — Thaiger Supplements

Contexto para trabajar en este repositorio. Léelo antes de tocar código.

---

## 1. Qué es la aplicación

Tienda en línea de suplementos deportivos (mercado mexicano, precios en MXN).
SPA de **React 19 + Vite 7 + Tailwind 4**, sin framework de servidor.

> **El repositorio arranca con datos de DEMOSTRACIÓN.** Marcas, productos,
> imágenes, cuentas y datos bancarios son de ejemplo. Ver §5.

Catálogo base: **32 productos de ejemplo**, 6 marcas ficticias, 8 categorías, en
`src/data/products.js`. Cada producto tiene su ilustración generada en
`public/images/products/<id>.svg`.

### Qué hace

| Zona | Funcionalidad |
|---|---|
| **Tienda** | Catálogo con filtros (marca, categoría, precio), buscador, orden, ficha con opiniones y recomendaciones |
| **Carrito** | Persistente y sincronizado entre pestañas, precios escalonados, respeta stock, avance hacia el envío gratis |
| **Checkout** | Datos de envío + transferencia SPEI con concepto generado; **el backend recalcula precios y total** |
| **Cuentas** | Registro, acceso, perfil con foto, libreta de direcciones, historial, favoritos, cambio de contraseña |
| **Admin** (`/dashboard`) | Resumen, productos, pedidos, usuarios, carrusel, ajustes de la tienda y copias de seguridad |

### Reglas de negocio (todas en `src/lib/pricing.js`)

- **Niveles de precio por monto del carrito**: Nivel 1 (`price1`) por defecto,
  Nivel 2 (`price2`) desde $10,000, Nivel 3 (`price3`) desde $20,000.
  El nivel se decide con **precios de lista**, no con los de oferta.
- Un producto en oferta aplica su porcentaje **sobre el precio del nivel vigente**.
- Envío gratis desde $5,000; si no, $250.
- **Los cuatro umbrales son configurables** desde el panel. `configurePricing()`
  los sincroniza en `settings.get/update/reset` de los dos backends.

> Si tocas precios, tócalos ahí. No repliques la aritmética en las páginas —
> ése fue exactamente el bug que hacía que el carrito ignorara las ofertas.

---

## 2. Arquitectura

### El punto clave: dos backends intercambiables

```
páginas  →  src/services/api.js  →  ┌─ localBackend.js   (IndexedDB, por defecto)
                                    └─ supabaseBackend.js (si hay .env)
```

`api.js` elige según `isSupabaseConfigured`. Ambos exponen **la misma API**:
`products`, `orders`, `auth`, `users`, `settings`, `maintenance`.

**Nunca importes `supabase` directamente en una página.** Usa `services/api`.
Si agregas una operación de datos, impleméntala en *los dos* backends.
(Excepción documentada: los archivos `*.test.{js,jsx}` sí importan
`localBackend` para sembrar y leer la base directamente.)

Modo local: los datos viven en IndexedDB del navegador; las fotos se guardan
incrustadas como data URL (redimensionadas a 900px por `src/lib/image.js`, en
WebP si el navegador lo soporta).

### Estructura

```
src/
  services/
    api.js              selector de backend + BACKEND_MODE / IS_LOCAL_MODE
    localBackend.js     IndexedDB: productos, cuentas, pedidos, ajustes, mantenimiento
    supabaseBackend.js  misma API contra Supabase + Storage
  lib/                  lógica pura, sin React, toda cubierta por pruebas
    pricing.js          niveles, ofertas, totales, envío, formato MXN (configurable)
    catalog.js          filtros, búsqueda, orden, agrupación de marcas
    metrics.js          métricas del dashboard
    security.js         PBKDF2, sesiones, bloqueo por intentos, saneado de texto y URLs
    motion.js           variantes de animación compartidas
    productForm.js      validación del formulario de alta
    image.js            validación, redimensionado y peso de fotos
    idb.js              envoltorio mínimo de IndexedDB
  context/              AuthContext, CartContext, WishlistContext, SettingsContext
  hooks/                useDocumentTitle
  components/
    ui/                 Reveal, AnimatedNumber, Skeleton, Modal, ConfirmDialog, Field, EmptyState
    dashboard/          los siete paneles del admin
    Navbar, Footer, HeroCarousel, ProductCard, ProductFormModal, rutas protegidas...
  pages/                Home, Shop, ProductDetails, Cart, Checkout, Dashboard, UserProfile, NotFound...
  data/
    products.js         catálogo de demostración (32 productos)
    seed.js             siembra: stock, ofertas, fotos, cuentas y pedidos de ejemplo
    settings.js         configuración inicial de la tienda y del carrusel
  test/                 setup.js (polyfills) y utils.jsx (renderWithProviders, entrarComoAdmin)
scripts/                SQL de Supabase, alta de admin, carga de catálogo, generador de imágenes
```

### Convenciones

- Código y comentarios **en español**.
- `ProductCard` recibe **el producto completo** (`product={...}`), no props sueltas.
- El usuario de sesión es siempre `{ id, email, name, role, avatar_url }`.
- ESLint prohíbe `setState` síncrono dentro de `useEffect`. Para reaccionar a un
  cambio de ruta o de `id`, ajusta el estado **durante el render** comparando con
  un estado espejo (ver `Shop.jsx` y `ProductDetails.jsx`).
  Ojo: la regla no dispara cuando el efecto lleva array de dependencias, así que
  hay que respetarla a mano (ver el comentario de `ui/AnimatedNumber.jsx`).
- **Animaciones**: usa las variantes de `src/lib/motion.js` y `useReducedMotion`.
  Nada de movimiento inventado por página.
- **Formularios**: usa `Field` / `TextField` para que toda etiqueta quede
  asociada y los campos midan 16px en móvil (si no, Safari iOS hace zoom).
- **Contraste**: sobre los fondos oscuros, `text-gray-600`/`700` no llegan al
  4.5:1 exigido. Para texto que se lee, `text-gray-400`.
- **Modales y cajones**: usa `ui/Modal`, que ya gestiona foco, Escape, trampa de
  tabulador y bloqueo de scroll. Nada de `window.confirm`: usa `ConfirmDialog`.
- **Elementos pegajosos**: usa `top-[calc(var(--alto-cabecera,5rem)+0.5rem)]`.
  El Navbar mantiene esa variable al día porque el aviso superior cambia la
  altura real de la barra.

---

## 3. Comandos

```bash
npm install
npm run dev          # servidor de desarrollo
npm test             # suite completa
npm run test:watch
npm run lint
npm run build

node scripts/generate-demo-assets.mjs   # regenera las imágenes de ejemplo
```

Las pruebas por defecto corren en Node; los archivos que montan React llevan
`// @vitest-environment jsdom` en la primera línea.

> **Ojo con las pruebas de UI**: `getByRole` recorre todo el DOM. Filtra o pagina
> antes de buscar dentro de tablas largas (ver `abrirPestanaProductos` en
> `src/pages/Dashboard.test.jsx`). La tabla del panel pagina de 25 en 25.

> **Las pruebas del panel necesitan sesión de administrador**: el backend rechaza
> las mutaciones sin ella. Usa `entrarComoAdmin()` de `src/test/utils.jsx`.

---

## 4. Seguridad

Lo que está resuelto:

- **Contraseñas** con PBKDF2-SHA256, 210,000 iteraciones y sal por cuenta.
  Las cuentas con el hash viejo (SHA-256) se migran solas al entrar.
- **Sesiones** con token aleatorio y caducidad de 12 h. Cerrar sesión invalida el
  token en la cuenta, así que una sesión copiada a mano deja de servir.
- **Bloqueo por fuerza bruta**: 5 fallos → 5 minutos de bloqueo. El mensaje de
  error es el mismo exista o no la cuenta.
- **Precios no se confían al cliente**: `orders.create` recibe sólo
  `[{ product_id, quantity }]` y reconstruye el pedido desde el catálogo,
  validando stock. Manipular `localStorage` no cambia lo que se cobra.
- **Autorización**: las mutaciones exigen sesión (y rol admin donde toca).
- **Saneado** de todo lo que escribe una persona (`src/lib/security.js`);
  las URLs se filtran por esquema (`javascript:` bloqueado).
- **Cabeceras HTTP** en `vercel.json`: CSP, HSTS, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`.
- **RLS en Supabase** con un disparador que impide auto-ascenderse a admin.

Lo que hay que saber:

> En modo local no hay servidor: la base vive en el navegador de cada visitante
> y las comprobaciones de rol son una barrera de la aplicación, no del sistema.
> La frontera de seguridad real es Supabase con RLS.

---

## 5. Datos de demostración

Todo lo que se ve al arrancar es de ejemplo:

- **Catálogo**: 32 productos, marcas ficticias (THAIGER LABS, NOVA NUTRITION,
  IRON PEAK, PURE CORE, VOLT SUPPS, ATLAS FOODS).
- **Imágenes**: SVG generados por `scripts/generate-demo-assets.mjs` — productos,
  fondos del carrusel y logotipos de marca. Se conservan `logo.png` y
  `loader.png`, que son la identidad de la tienda.
- **Cuentas**: `admin@thaiger.mx` / `admin123` y `cliente@thaiger.mx` / `cliente123`.
- **Pedidos**: seis pedidos de ejemplo del cliente, repartidos en los últimos
  meses, para que el panel arranque con una gráfica que mirar.
- **Configuración**: contacto, cuenta SPEI (`BANCO DEMO`, CLABE de ceros),
  redes vacías y aviso de demostración. Todo editable en `/dashboard`.

**Las pruebas no deben registrar `cliente@thaiger.mx`**: esa cuenta viene
sembrada y `signUp` fallaría con «User already registered».

---

## 6. Qué falta

1. **No hay cobro real.** El checkout registra el pedido y muestra la CLABE de
   los ajustes. Hay que poner la cuenta real (o integrar Stripe / Mercado Pago).
2. **Nadie confirma los pagos**: no hay conciliación de transferencias SPEI.
3. **No se envían correos**: ni confirmación, ni cambio de estatus, ni
   recuperación de contraseña.
4. **Opiniones locales**: viven en el `localStorage` de cada visitante, no se
   comparten ni se moderan.
5. **Modo local ≠ producción**: los datos viven en un solo navegador.
6. El `noindex` de `index.html` hay que quitarlo cuando deje de ser una demo.

---

## 7. Recomendaciones

**Antes de publicar (bloqueantes):**

1. Cambiar los datos bancarios en `/dashboard → Ajustes` (mientras la casilla
   «datos de ejemplo» siga marcada, el sitio lo avisa en rojo).
2. Sustituir el catálogo de demostración por el real, con sus fotos.
3. Crear el proyecto de Supabase: `scripts/setup_supabase.sql`, llaves en
   `.env`, `scripts/upload-supabase.js` y `scripts/create-admin.js`.
4. **Tratar como comprometidas las credenciales viejas** que siguen en el
   historial de git del proyecto de Supabase eliminado.
5. Quitar el `noindex` de `index.html`.

**Al escribir código nuevo:**

- Datos siempre por `src/services/api.js`, implementando en los dos backends.
- Reglas de negocio en `src/lib/`, con su prueba. Las páginas sólo pintan.
- Ejecuta `npm run lint && npm test` antes de dar algo por terminado.
