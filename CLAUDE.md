# CLAUDE.md — Thaiger Supplements

Contexto para trabajar en este repositorio. Léelo antes de tocar código.

- Diseño interno a fondo → [`arquitectura.md`](arquitectura.md)
- Qué se hizo y qué falta → [`reporte.md`](reporte.md)
- Puesta en marcha y uso → [`README.md`](README.md)
- Ponerla en línea paso a paso (Supabase, Cloudflare, Mercado Pago, correos, guías) → [`DESPLIEGUE.md`](DESPLIEGUE.md)

---

## 1. Qué es la aplicación

Tienda en línea de suplementos deportivos (mercado mexicano, precios en MXN).
SPA de **React 19 + Vite 7 + Tailwind 4**, sin framework de servidor.

> **El repositorio arranca con datos de DEMOSTRACIÓN.** Marcas, productos,
> imágenes, cuentas y datos bancarios son de ejemplo. Ver §6.

Catálogo base: **32 productos de ejemplo**, 6 marcas ficticias, 8 categorías, en
`src/data/products.js`. Cada producto tiene su ilustración generada en
`public/images/products/<id>.svg`.

### Qué hace

| Zona | Funcionalidad |
|---|---|
| **Tienda** | Catálogo con filtros (marca, categoría, precio), buscador, orden, ficha con opiniones y recomendaciones |
| **Carrito** | Persistente y sincronizado entre pestañas, precios escalonados, respeta stock, avance hacia el envío gratis |
| **Checkout** | Datos de envío, envío cotizado por C.P. (con paquetería conectada), pago por SPEI manual o **Mercado Pago** (tarjeta, SPEI, OXXO); **el backend recalcula precios y total** |
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

## 2. Arquitectura en una pantalla

### El punto clave: dos backends intercambiables

```
páginas  →  src/services/api.js  →  ┌─ localBackend.js   (IndexedDB, por defecto)
                                    └─ supabaseBackend.js (si hay .env)
```

`api.js` elige según `isSupabaseConfigured`. Ambos exponen **la misma API**:
`products`, `orders`, `auth`, `users`, `settings`, `maintenance`, `payments`, `shipping`.

Lo que necesita un servidor de verdad (hablar con Mercado Pago, con la
paquetería, mandar correos) vive en **Edge Functions** de Supabase
(`supabase/functions/`). En modo local esas operaciones se explican en vez de
fingirse (`payments.start` lanza; `shipping.quote` devuelve la tarifa fija).

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
    image.js            validación, redimensionado, peso de fotos y quitar el fondo blanco
    galeria.js          fotos de un producto: `image_url` (principal) + `gallery` (adicionales)
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
  pruebas-sql/          banco de pruebas del esquema contra un Postgres real
supabase/
  config.toml           qué funciones van sin JWT (webhooks)
  functions/
    _shared/            supabase.ts (clientes), http.ts, mercadopago.ts, correo.ts,
                        plantillas.ts (correos), envios/ (paquete, manual, skydropx)
    crear-pago/         preferencia de Checkout Pro para un pedido (sesión)
    mp-webhook/         confirma el pago: firma HMAC → API de MP → marcar_pedido_pagado()
    notificar-pedido/   correos por pedido nuevo y cambio de estatus (disparador de la base)
    cotizar-envio/      tarifas por C.P. para el carrito → shipping_quotes
    generar-guia/       guía con la paquetería, o captura manual del rastreo (admin)
```

---

## 3. API de datos (referencia rápida)

```js
import { products, orders, auth, users, settings, maintenance,
         IS_LOCAL_MODE, DEMO_ADMIN, DEMO_CUSTOMER } from '../services/api';
```

| Módulo | Operaciones | Permiso |
|---|---|---|
| `products` | `list()` `get(id)` `create(data)` `update(id, patch)` `remove(id)` `bulkUpdate(ids, patch)` `bulkRemove(ids)` `renameGroup('brand'\|'category', desde, hacia)` `uploadImage(file, { quitarFondo })` | lectura libre; escritura **admin** o **catálogo** |
| `orders` | `listAll()` `listByUser(id)` `create({...})` `updateStatus(id, estado)` `remove(id)` | `listAll`/`updateStatus`/`remove` **admin**; `listByUser` sólo la propia cuenta (o admin) |
| `auth` | `getSession()` `onAuthStateChange(cb)` `signIn` `signUp` `signOut` `updateProfile(id, {name, avatar_url})` `changePassword(actual, nueva)` `requestPasswordReset(email)` `completePasswordReset(nueva)` `uploadAvatar(file)` | — |
| `users` | `list()` `create({...})` `setRole(id, rol)` `remove(id)` `setPassword(id, nueva)` | **admin** |
| `settings` | `get()` `update(patch)` `reset()` | lectura libre; escritura **admin** |
| `maintenance` | `exportData()` `importData(backup)` `resetDemo()` | **admin** |
| `payments` | `start(orderId)` → `{ init_point }` (Checkout Pro) | sesión; sólo Supabase |
| `shipping` | `quote({ zip, items })` → `{ quote_id, rates }` · `createLabel(orderId, { rateId } \| { trackingNumber, carrier, trackingUrl })` | `quote` sesión; `createLabel` **admin** |

**`orders.create` no acepta precios.** Su firma es:

```js
orders.create({
  userId,
  shippingInfo,                                  // { fullName, phone, address, city, zip }
  paymentInfo,                                   // { provider: 'spei'|'mercadopago', concepto, banco }
  items: [{ product_id, quantity }],             // ← sólo qué y cuánto
  shippingRate,                                  // { quote_id, rate_id } de shipping.quote, o null
});
```

Con `shippingRate`, el precio del envío lo lee Postgres de `shipping_quotes`
(la escribió la Edge Function), nunca del navegador: el cliente elige *cuál*,
no *cuánto*. El envío gratis por umbral se respeta igual (lo absorbe la tienda).

El backend reconstruye el pedido desde el catálogo, valida stock, calcula
subtotal, envío y total, fija el estatus y **descuenta el inventario en la misma
operación**. Devuelve `{ subtotal, shipping_cost, total, tier, order_items }`.
Lanza `Error` con mensaje en español si algo falla (sin stock, dirección incompleta).

> No hay `decrementStock`: existía y se llamaba aparte desde el checkout, así que
> un navegador cerrado a destiempo vendía sin descontar y dos compras simultáneas
> de la última unidad pasaban las dos. Si necesitas ajustar inventario a mano, es
> `products.update`, que exige admin.

En modo Supabase esto **no** lo hace JavaScript: lo hace la función
`create_order()` de Postgres (`scripts/setup_supabase.sql`), y las tablas
`orders`/`order_items` no tienen política de INSERT, así que es el único camino.
Su aritmética es el espejo de `src/lib/pricing.js`: **si tocas una, toca la otra**,
o el cliente verá un total y se le cobrará otro.

---

## 4. Convenciones

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
  No les añadas `text-sm`: pisa esa regla.
- **Contraste**: sobre los fondos oscuros, `text-gray-600`/`700` no llegan al
  4.5:1 exigido. Para texto que se lee, `text-gray-400`. El gris oscuro sólo
  para adornos y para iconos con `aria-hidden`.
- **Botones de sólo icono**: `aria-label` con el dato de la fila
  (`aria-label={\`Eliminar ${producto.name}\`}`), no un `title` genérico repetido.
  Mínimo 44×44 px: `grid h-11 w-11 place-items-center`.
- **Modales y cajones**: usa `ui/Modal`, que ya gestiona foco, Escape, trampa de
  tabulador y bloqueo de scroll. Nada de `window.confirm`: usa `ConfirmDialog`.
- **Encabezados**: no saltes niveles. `EmptyState` acepta `as="h2"` cuando cuelga
  directo de un `<h1>`.
- **Elementos pegajosos**: usa `top-[calc(var(--alto-cabecera,5rem)+0.5rem)]`.
  El Navbar mantiene esa variable al día porque el aviso superior cambia la
  altura real de la barra.
- **Barras fijas en móvil**: añade `con-barra-inferior` al `<body>` mientras la
  barra esté montada, o tapará el pie de página (que vive fuera del `<main>`).

### Primitivas de `components/ui/`

| Componente | Uso |
|---|---|
| `Reveal` | `<Reveal index={i}>` — aparición al entrar en pantalla |
| `AnimatedNumber` | `<AnimatedNumber value={n} format={formatPrice} />` |
| `Skeleton` | `SkeletonCard`, `SkeletonGrid`, `SkeletonRows` para los estados de carga |
| `Modal` | `open onClose title description footer size` — foco, Escape y scroll resueltos |
| `ConfirmDialog` | `open title message confirmLabel tone busy onConfirm onCancel` |
| `Field` | `TextField`, `TextAreaField`, `inputClasses()` |
| `EmptyState` | `icon title message actionLabel actionTo\|onAction as` |

---

## 5. Comandos y pruebas

```bash
npm install
npm run dev          # servidor de desarrollo
npm test             # suite completa (312 pruebas, 23 archivos)
npm run test:watch
npm run lint
npm run build

node scripts/generate-demo-assets.mjs   # regenera las imágenes de ejemplo

./scripts/pruebas-sql/ejecutar.sh       # pruebas del esquema de Supabase (necesita Postgres)
```

Las pruebas por defecto corren en Node; los archivos que montan React llevan
`// @vitest-environment jsdom` en la primera línea.

`npm test` **no** cubre `scripts/setup_supabase.sql`, que desde `create_order()`
es donde se decide lo que se cobra. Eso lo prueba `scripts/pruebas-sql/`, a mano
y con un Postgres local (aún no está en CI). Córrelo si tocas el SQL, `pricing.js`
o los umbrales de precio.

Reglas que ahorran horas de depuración:

> **Sesión de administrador**: el backend rechaza las mutaciones sin ella.
> Usa `entrarComoAdmin()` de `src/test/utils.jsx`.

> **`getByRole` recorre todo el DOM.** Filtra o pagina antes de buscar dentro de
> tablas largas (ver `abrirPestanaProductos` en `Dashboard.test.jsx`).
> La tabla del panel pagina de 25 en 25.

> **No escribas cifras del catálogo a mano** (ni «32», ni «244»). Derívalas de
> `SEED_PRODUCTS.length`, o la prueba se rompe al cambiar un producto.

> **No registres `cliente@thaiger.mx`**: viene sembrada y `signUp` fallaría con
> «User already registered».

> **`AnimatedNumber` anima**: el valor final tarda en llegar. Espéralo con
> `waitFor`, no con una consulta síncrona.

El CI (`.github/workflows/ci.yml`) corre lint, pruebas y build, y además
**comprueba que las imágenes generadas coincidan con el catálogo**: si cambias
`products.js` y no ejecutas el generador, falla. Cuando pongas fotos reales,
quita ese paso.

---

## 6. Seguridad

Lo que está resuelto:

- **Contraseñas** con PBKDF2-SHA256, 210,000 iteraciones y sal por cuenta.
  Las cuentas con el hash viejo (SHA-256) se migran solas al entrar.
- **Sesiones** con token aleatorio y caducidad de 12 h. Cerrar sesión invalida el
  token en la cuenta, así que una sesión copiada a mano deja de servir.
- **Bloqueo por fuerza bruta**: 5 fallos → 5 minutos de bloqueo. El mensaje de
  error es el mismo exista o no la cuenta.
- **Precios no se confían al cliente**: ver §3. Con Supabase el cálculo vive en
  Postgres, no en el navegador: aunque alguien llame a la API REST con la anon
  key, no puede registrar un pedido de $1 marcado como pagado.
- **Inventario**: se descuenta dentro de la transacción del pedido, con las filas
  del catálogo bloqueadas en orden de id. No hay sobreventa en la carrera por la
  última unidad (probado con 20 compradores simultáneos y 5 unidades).
- **Autorización**: las mutaciones exigen sesión (y rol admin donde toca).
- **Saneado** de todo lo que escribe una persona (`src/lib/security.js`);
  las URLs se filtran por esquema (`javascript:` bloqueado).
- **Cabeceras HTTP** en `vercel.json`: CSP, HSTS, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`.
- **Pagos**: el navegador nunca ve el access token de Mercado Pago. `crear-pago`
  arma la preferencia con los importes del pedido; `mp-webhook` verifica la
  firma HMAC (`x-signature`), consulta el pago en la API y sólo entonces llama a
  `marcar_pedido_pagado()`, que exige que el monto coincida con el total. Esa
  función es la **única** forma de poner `paid_at`; sólo la ejecuta la service_role.
- **Notificaciones de la base** con secreto compartido (`x-thaiger-secret`).
- **RLS en Supabase** con un disparador (`proteger_rol`) que impide que un
  usuario con sesión se ascienda a admin. No aplica sin sesión (SQL Editor,
  service_role): es el camino para nombrar al primer administrador.
- **Perfiles**: `public.users` se llena con el disparador `crear_perfil_de_usuario`
  sobre `auth.users`, no desde el navegador (con confirmación de correo no hay
  sesión al registrarse y la RLS rechazaba el insert).
- **Roles** (`src/lib/roles.js`): `user`, `catalogo` y `admin`. La cuenta de
  catálogo sólo ve la pestaña Productos; en Supabase la frontera es
  `puede_editar_catalogo()` en las políticas de `products` y del bucket de
  fotos, más un `check` que rechaza roles inventados. `public.users` no tiene
  política de INSERT: el perfil lo crea el disparador (con la política vieja,
  una cuenta cuyo perfil se borraba podía reinsertarse como admin).
- **Storage por rol**: las fotos de producto sólo las escriben admin y catálogo; el avatar,
  cada quien dentro de su propia carpeta (`avatars/<uid>/`).

Lo que hay que saber:

> En modo local no hay servidor: la base vive en el navegador de cada visitante
> y las comprobaciones de rol son una barrera de la aplicación, no del sistema.
> La frontera de seguridad real es Supabase con RLS.

---

## 7. Datos de demostración

Todo lo que se ve al arrancar es de ejemplo:

- **Catálogo**: 32 productos, marcas ficticias (THAIGER LABS, NOVA NUTRITION,
  IRON PEAK, PURE CORE, VOLT SUPPS, ATLAS FOODS).
- **Imágenes**: 42 SVG generados por `scripts/generate-demo-assets.mjs` —
  32 de producto, 4 fondos de carrusel y 6 logotipos de marca. Se conservan
  `logo.png` y `loader.png`, que son la identidad de la tienda.
- **Cuentas**: `admin@thaiger.mx` / `admin123` y `cliente@thaiger.mx` / `cliente123`.
- **Pedidos**: seis pedidos de ejemplo del cliente, repartidos en los últimos
  meses, para que el panel arranque con una gráfica que mirar.
- **Configuración**: contacto vacío (se captura en Ajustes), cuenta SPEI
  «Por configurar» con CLABE de ceros y la casilla de cuenta no definitiva
  marcada, redes vacías y sin aviso superior. Todo editable en `/dashboard`.

---

## 8. Qué falta

Lista corta; el detalle y el orden sugerido están en [`reporte.md`](reporte.md).

1. **Todo está construido pero nada está encendido**: falta crear las cuentas
   (Supabase, Cloudflare, Mercado Pago, Resend) y cargar los secretos. El orden
   exacto está en [`DESPLIEGUE.md`](DESPLIEGUE.md).
2. **Con SPEI manual, alguien concilia a mano**; con Mercado Pago el pedido
   pasa solo a «Pagado». Los correos de pedido y de estatus salen solos en
   cuanto Resend esté configurado.
3. **El adaptador de Skydropx no se ha probado contra su API en vivo** (no
   había credenciales): el mapeo de campos está aislado y documentado para
   ajustarlo con la primera respuesta real.
4. **Opiniones locales**: viven en el `localStorage` de cada visitante.
5. **Modo local ≠ producción**: los datos viven en un solo navegador.
6. **Nadie ha abierto la tienda en un navegador real**: está verificada en jsdom.
7. **Textos legales** (`Terms`, `Privacidad`, `Refunds`, `Envios`, con el
   armazón `components/legal/DocumentoLegal.jsx`): quién vende sale de
   Ajustes → Datos legales (`src/lib/legal.js`). Son una base; falta que los
   revise un abogado. Si cambias el texto, cambia `VIGENCIA_LEGAL`.

**Al escribir código nuevo:**

- Datos siempre por `src/services/api.js`, implementando en los dos backends.
- Reglas de negocio en `src/lib/`, con su prueba. Las páginas sólo pintan.
- Ejecuta `npm run lint && npm test` antes de dar algo por terminado.

---

## 9. Traspaso (18 de septiembre de 2026) — por dónde seguir

Esta sección es para quien retome el trabajo (persona o asistente) en otro
entorno. Léela junto con `DESPLIEGUE.md`.

### Estado

- Rama de trabajo fusionada en `main`. Últimos commits: `203c786` (pedido en
  el servidor, esquema endurecido) y `59e8c84` (Mercado Pago, correos, envíos,
  guía de despliegue).
- Verificado en este entorno: `npm run lint` limpio, `npm test` 280/280,
  `npm run build` OK, `scripts/pruebas-sql/ejecutar.sh` 69 aserciones + paridad
  de precios en 300 carritos + carrera de inventario sin sobreventa, y el paso
  de assets del CI.
- **Nada está desplegado todavía.** No hay proyecto de Supabase, ni cuenta de
  Mercado Pago, Resend, Cloudflare ni dominio. Todo el código está listo para
  recibirlos.

### Lo que NO se ha podido verificar (y hay que hacerlo)

1. **Las Edge Functions contra Supabase real.** Están escritas y su lógica pura
   probada con Vitest, pero nunca se han desplegado ni ejecutado en Deno. El
   primer `npx supabase functions deploy` puede sacar algún error de tipos o de
   import: se corrige ahí mismo. Usan `npm:@supabase/supabase-js@2` y
   `Deno.serve`.
2. **El adaptador de Skydropx** (`supabase/functions/_shared/envios/skydropx.ts`)
   sigue la documentación pública sin haberse probado contra la API. Los
   nombres de campo viven en `armarCotizacion`, `leerTarifas`, `armarEnvio` y
   `leerGuia`; la lectura busca claves por nombre a cualquier profundidad.
   Ajustar con la primera respuesta real del sandbox.
3. **La tienda en un navegador real** (Chrome + un celular). Todo está probado
   en jsdom, que no pinta.

### Lo que depende de la empresa (bloquea el lanzamiento)

- Catálogo y fotos reales, con peso y medidas por producto.
- Cuenta bancaria real (`/dashboard → Ajustes`, desmarcar «datos de ejemplo»).
- Razón social, RFC y domicilio en Ajustes → Datos legales. Los textos legales
  y públicos ya no hablan de demostración (se reescribieron el 24/09/2026) y
  el `noindex` ya no está; lo único «de ejemplo» que queda a la vista es la
  cuenta SPEI mientras «La cuenta bancaria aún no es la definitiva» siga marcada.

### Orden sugerido para seguir

1. `DESPLIEGUE.md` §1–4: proyecto de Supabase, SQL, admin, catálogo, funciones.
   Al desplegar las funciones, corregir lo que salga.
2. §5–6: Cloudflare Pages y dominio. **No Vercel Hobby**: prohíbe uso comercial.
3. Recorrido en navegador real del flujo tienda → producto → carrito → checkout
   (SPEI) → perfil → panel. Arreglar lo que se vea.
4. §7–8: Mercado Pago en modo prueba (tarjetas de prueba) y Resend. Ensayo de
   punta a punta: el pedido debe pasar solo a «Pagado» y llegar los correos.
5. Contenido y legal (arriba). Lista previa a abrir: `DESPLIEGUE.md` §11.
6. Cuando haya credenciales de Skydropx: §9 y ajustar el adaptador.
7. Pendientes menores que quedaron anotados: meter `scripts/pruebas-sql` al CI
   con un service container de Postgres; `App.jsx:54` usa `text-gray-600` en
   texto legible (la regla pide `text-gray-400`); `image.js` no redimensiona
   GIF; `changePassword` local no rota `session_token`.

### Trampas conocidas de este repo

- **No pases Prettier** a los archivos: el proyecto no lo usa y reformatea
  todo (ya pasó una vez y hubo que revertir). El estilo se mantiene a mano.
- Los `.ts` de `supabase/functions` no los lintea ESLint (no hay config para
  TypeScript); Vitest sí los ejecuta (`supabase/functions/**/*.test.ts`).
- Si tocas `create_order()` o `precio_unitario()` en SQL, toca también
  `src/lib/pricing.js`, y corre `scripts/pruebas-sql/ejecutar.sh` (necesita
  Postgres 16 local): la prueba de paridad es la que detecta que se separen.
- Las cifras de pruebas en este archivo (312 / 23) se actualizan a mano cuando
  cambian.
- **Nunca uses `async` ni llames a Supabase dentro de
  `supabase.auth.onAuthStateChange`.** supabase-js corre ese callback dentro de
  su cerrojo de sesión, y cualquier consulta que espere ahí se bloquea para
  siempre. Pasó en producción: al volver con una sesión de horas antes, la
  renovación del token disparaba el aviso y la tienda se quedaba en «Cargando
  Thaiger». El patrón correcto (diferir con `setTimeout`) está en
  `supabaseBackend.auth.onAuthStateChange`, cubierto por `supabaseBackend.test.js`.
