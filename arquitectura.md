# Arquitectura — Thaiger Supplements

Cómo está construida la tienda por dentro: qué capas hay, qué puede hablar con
qué, dónde vive cada decisión y por qué está donde está.

Para el contrato del día a día (convenciones, comandos, API) ve a
[`CLAUDE.md`](CLAUDE.md). Para qué se hizo y qué queda, [`reporte.md`](reporte.md).

---

## 1. Panorama

Aplicación de una sola página, sin servidor propio. Todo lo que normalmente
haría un backend —autenticación, autorización, cálculo de precios, persistencia—
está encapsulado en una **capa de servicios intercambiable** que corre en el
navegador o contra Supabase, según haya credenciales.

| Pieza | Versión | Papel |
|---|---|---|
| React | 19 | Interfaz |
| Vite | 7 | Build y servidor de desarrollo |
| Tailwind CSS | 4 | Estilos (configuración en CSS, sin `tailwind.config.js`) |
| React Router | 7 | Rutas del cliente |
| framer-motion | 12 | Animación |
| recharts | 3 | Gráficas del panel |
| lucide-react | — | Iconos |
| react-hot-toast | — | Avisos |
| Supabase JS | 2 | Backend remoto opcional |
| Vitest + Testing Library | 4 / 16 | Pruebas |

**Tamaño:** ~20,100 líneas de JS/JSX en `src/`, 79 archivos, 238 pruebas.

---

## 2. Las capas

```
┌──────────────────────────────────────────────────────────────┐
│  PRESENTACIÓN            pages/ · components/ · components/ui│
│  Pinta. No decide reglas de negocio ni habla con la base.    │
└───────────────┬──────────────────────────────────────────────┘
                │ hooks de contexto + services/api
┌───────────────▼──────────────────────────────────────────────┐
│  ESTADO                  context/                            │
│  Auth · Cart · Wishlist · Settings                           │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│  SERVICIOS               services/api.js  ← único punto       │
│         ┌────────────────┴────────────────┐                  │
│    localBackend.js                 supabaseBackend.js        │
│    (IndexedDB)                     (Postgres + RLS)          │
│  Autoriza, sanea, recalcula precios, valida stock.           │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│  LÓGICA PURA             lib/                                │
│  pricing · catalog · metrics · security · image · motion     │
│  Sin React, sin IO. Todo con pruebas.                        │
└──────────────────────────────────────────────────────────────┘
```

**La regla que sostiene el diseño:** las flechas van sólo hacia abajo. Una
página nunca importa `localBackend`; un módulo de `lib/` nunca importa React.
Romper esto es lo que produjo los dos bugs históricos del proyecto (el carrito
que ignoraba las ofertas y el carrusel que anunciaba marcas inexistentes).

---

## 3. La capa de servicios

### 3.1 El selector

`src/services/api.js` es un archivo de treinta líneas y es la pieza más
importante de la arquitectura:

```js
const backend = isSupabaseConfigured ? supabaseBackend : localBackend;

export const products    = backend.products;
export const orders      = backend.orders;
export const auth        = backend.auth;
export const users       = backend.users;
export const settings    = backend.settings;
export const maintenance = backend.maintenance;
```

`isSupabaseConfigured` (en `src/supabase.js`) comprueba que `VITE_SUPABASE_URL`
sea una URL válida y que la clave no sea el marcador de posición. Sin `.env`, la
tienda arranca en modo local y se siembra sola: **no hay paso de configuración
para poder trabajar**.

### 3.2 Los dos backends implementan el mismo contrato

| | `localBackend` | `supabaseBackend` |
|---|---|---|
| Persistencia | IndexedDB (`thaiger_local_db`, v2) | Postgres |
| Sesión | Token propio en `localStorage`, 12 h | Supabase Auth (JWT) |
| Contraseñas | PBKDF2-SHA256 210k, sal por cuenta | Supabase Auth |
| Autorización | `requireAdmin()` / `requireSession()` en el módulo | **RLS en la base** |
| Fotos | data URL incrustado (WebP si se puede) | Supabase Storage |
| Alta de cuentas ajenas | Sí (`users.create`) | No — lanza error explicativo |
| Restablecer demo | Sí | No — lanza error explicativo |

Cuando una operación no tiene sentido en un backend, **no se omite: lanza un
`Error` con el motivo**. Así la interfaz puede mostrar una explicación en vez de
romperse con `undefined is not a function`.

### 3.3 Dónde vive la autorización

En **local** la autorización es una función del propio módulo:

```js
async function requireAdmin() {
  const user = await currentUser();          // sesión válida y token vigente
  if (!user) throw new Error('Necesitas iniciar sesión para hacer esto.');
  if (user.role !== 'admin') throw new Error('Sólo un administrador puede hacer esto.');
  return user;
}
```

Es una **barrera de la aplicación, no del sistema**: quien controla el navegador
controla su propia base. Sirve para que la interfaz sea coherente y para que las
pruebas verifiquen el contrato, no para detener a un atacante.

En **Supabase** la autorización la hace Postgres con RLS. Aunque una página
pidiera algo que no le toca, la base lo rechaza. Las comprobaciones del backend
de Supabase existen sólo para dar mensajes legibles.

> Ésta es la frontera real de seguridad del proyecto. Está documentada así de
> explícitamente porque el modo local puede dar una falsa sensación de solidez.

### 3.4 El pedido se reconstruye, nunca se acepta

`orders.create` recibe `[{ product_id, quantity }]` y nada más. Con eso:

```
items del navegador
   │
   ├─ busca cada producto en el catálogo guardado
   ├─ valida cantidad (entero ≥ 1) y stock disponible
   ├─ computeCartTotals() decide nivel, subtotal, envío y total
   └─ arma order_items con el precio calculado, no el recibido
```

Un carrito manipulado en `localStorage` para poner precios de un peso produce un
pedido con los precios reales. Hay una prueba dedicada a esto
(`Checkout.test.jsx` → «el precio no se acepta desde el navegador»).

---

## 4. Modelo de datos

### 4.1 IndexedDB (modo local)

Base `thaiger_local_db`, versión 2, seis almacenes con `keyPath: 'id'`:

| Almacén | Contenido |
|---|---|
| `products` | Catálogo completo |
| `users` | Cuentas, con `password_hash`, `salt`, `session_token` |
| `orders` | Cabeceras de pedido |
| `order_items` | Líneas, referenciadas por `order_id` |
| `settings` | Un único registro, `id: 'site'` |
| `meta` | Reservado |

`src/lib/idb.js` es un envoltorio mínimo sin dependencias: `getAll`, `get`,
`put`, `putMany`, `remove`, `clear`, `count` y `deleteDatabase()` (que cierra la
conexión antes de borrar, o el navegador deja la petición bloqueada).

### 4.2 Postgres (modo Supabase)

Mismas cinco tablas (`scripts/setup_supabase.sql`), más:

- `public.is_admin()` — función `security definer` que evita la recursión
  infinita en las políticas que consultan el rol.
- **Disparador `proteger_rol`** — si alguien edita su propio perfil y cambia
  `role`, se le restaura el valor anterior salvo que ya sea admin. Sin esto, la
  política de «cada quien edita su perfil» permitiría auto-ascenderse.
- `decrement_stock(product_id, qty)` — descuento atómico de inventario.
- Buckets `product-images` y `avatars`.

El script es idempotente (`create table if not exists`, `drop policy if exists`,
`add column if not exists`): se puede volver a ejecutar sobre un proyecto vivo.

### 4.3 Forma del producto

```js
{
  id, name, brand, category, description,
  price1, price2, price3,          // nivel 1 / mayoreo / distribuidor
  image_url,                        // ruta, o data URL en modo local
  stock,
  is_on_sale, discount_percent,
  created_at,
}
```

### 4.4 Forma de la configuración

Un solo objeto, editable entero desde `/dashboard`:

```js
{
  store:    { name, tagline, description, email, phone, whatsapp, address, hours, shippingNote },
  payment:  { bank, clabe, beneficiary, instructions, isDemo },
  shipping: { freeFrom, cost },
  tiers:    { tier2From, tier3From },
  hero:     [{ id, title, subtitle, caption, cta, brand, image, color, active }],
  home:     { featuredTitle, promoTitle, brandsTitle, showBrandStrip },
  social:   { facebook, instagram, tiktok, youtube },
  banner:   { text, active },
}
```

`withSettingsDefaults()` completa los campos que falten al leer, de modo que una
configuración guardada con una versión vieja no rompe la tienda al añadir campos.

### 4.5 Qué vive en `localStorage`

| Clave | Contenido | Por qué ahí |
|---|---|---|
| `thaiger_cart` | Carrito | Debe sobrevivir a la recarga y sincronizarse entre pestañas |
| `thaiger_wishlist` | Favoritos | Igual |
| `thaiger_local_session` | Token de sesión y caducidad | Es la sesión del navegador |
| `thaiger_reviews` | Opiniones por producto | **Limitación conocida**: no se comparten |
| `thaiger_addresses_<userId>` | Libreta de direcciones | Comodidad local, el checkout no depende de ella |
| `thaiger_aviso_cerrado` | Aviso superior descartado (en `sessionStorage`) | Preferencia efímera |

Todo lo que se lee de ahí pasa por un normalizador que descarta entradas
corruptas en vez de dejar que revienten la aplicación.

---

## 5. La capa de lógica pura (`src/lib/`)

Sin React, sin IO, sin estado global salvo donde se dice. Es lo que permite
probar las reglas de negocio en milisegundos y sin montar un DOM.

### `pricing.js` — la única aritmética de dinero

```
computeCartTotals(items)
   │
   ├─ listTotal  = Σ price1 × cantidad        ← decide el nivel
   ├─ tier       = getTier(listTotal)          ← 1, 2 o 3
   ├─ subtotal   = Σ getUnitPrice(item, tier) × cantidad
   ├─ shipping   = getShippingCost(subtotal)
   ├─ savings    = Σ (precio público − pagado) × cantidad
   └─ total      = subtotal + shipping
```

El nivel se calcula con **precios de lista** a propósito: si se calculara con los
de oferta, un carrito lleno de descuentos podría no alcanzar el escalón que le
corresponde por volumen.

Los cuatro umbrales son configurables. `configurePricing()` guarda la
configuración en un módulo con estado, y **los dos backends la sincronizan en
`settings.get()`, `update()` y `reset()`**. Sincronizarla sólo al leer fue un bug
real: el admin cambiaba el umbral y el carrito seguía calculando con el viejo el
resto de la sesión, mostrando un total distinto del que se cobraba.

### `security.js` — todo lo que protege

Contraseñas (PBKDF2 + verificación con migración del hash viejo), política de
contraseñas y medidor de fuerza, comparación en tiempo constante, normalización
y validación de correo, saneado de texto (`stripControlChars` filtra por código
de carácter en vez de por expresión regular, para no meter caracteres de control
crudos en el fuente), escapado de HTML, filtrado de URLs por esquema, bloqueo por
intentos fallidos y creación/validación de sesiones.

### `catalog.js`, `metrics.js`, `image.js`, `motion.js`, `productForm.js`

Filtros y búsqueda del catálogo; métricas del panel; validación, redimensionado
y medición de fotos; vocabulario de animación; validación del alta de productos.

---

## 6. Estado en React

Cuatro contextos, anidados en este orden en `App.jsx`:

```
AuthProvider          sesión; bloquea el render con una pantalla de marca mientras resuelve
  SettingsProvider    configuración de la tienda; una sola lectura al arrancar
    WishlistProvider  favoritos
      CartProvider    carrito
        Estructura    Navbar · main · Footer · Toaster
```

`AuthProvider` va primero porque `SettingsProvider` no lo necesita pero el resto
sí sabe quién eres. `CartProvider` va último porque es el que más se actualiza.

Detalles que importan:

- **Carrito y favoritos escuchan el evento `storage`**: dos pestañas abiertas
  muestran lo mismo.
- **El carrito guarda una copia de conveniencia del producto**, no la fuente de
  la verdad. El precio definitivo lo pone el backend al crear el pedido.
- `CartContext` expone `totals` ya calculados con `computeCartTotals`, para que
  ninguna página vuelva a hacer la cuenta.

---

## 7. Presentación

### 7.1 Rutas

Diecisiete rutas en `App.jsx`. Todas diferidas con `React.lazy` **menos `Home` y
`NotFound`**: la primera es la pantalla de entrada y la segunda es la de rescate;
ninguna debe esperar a que llegue un trozo de código.

| Públicas | Con sesión | Admin |
|---|---|---|
| `/` `/shop` `/brands` `/offers` `/product/:id` `/cart` `/login` `/register` `/terms` `/about` `/wholesale` `/refunds` | `/checkout` `/profile` | `/dashboard` |

`ProtectedRoute` y `AdminRoute` recuerdan a dónde ibas (`state.from`) para
devolverte ahí después de entrar.

### 7.2 Estructura común

```jsx
<a className="salto-contenido">Saltar al contenido</a>   ← primero en el DOM
<ScrollToTop /> <ScrollProgress />
<Navbar />
<main id="contenido" tabIndex={-1} className="pt-navbar">
  <ErrorBoundary>
    <PageTransition>            ← AnimatePresence + key={pathname}
      <Suspense fallback={<PantallaDeCarga />}>
        <Routes>…</Routes>
```

`ErrorBoundary` se reinicia con `location.key`: si una página revienta, navegar a
otra la recupera sin recargar.

### 7.3 Sistema de diseño

Los tokens viven en `@theme` dentro de `src/index.css` (Tailwind 4 ya no usa
`tailwind.config.js`):

- **Superficies** `carbon-950` (#000) → `carbon-600` (#222)
- **Acento** `brand-400` → `brand-700`, más `brand-glow` (#ff8c00)
- **Espaciado** `navbar` (5rem), `navbar-compact` (4rem)
- **Escalas fluidas** `--paso-titulo`, `--paso-seccion`, `--paso-cuerpo` con `clamp()`

Utilidades propias: `superficie`, `resplandor-marca`, `titulo-pagina`,
`titulo-seccion`, `recorte-2`, `sin-flechas`, `esqueleto`, `desfile`,
`latido-marca`, `custom-scrollbar`, `salto-contenido`, `area-segura-inferior`,
`con-barra-inferior`, `no-imprimir`.

**`--alto-cabecera`** es una variable viva: el Navbar la mide con un
`ResizeObserver` y la escribe en el DOM, porque el aviso superior cambia la
altura real de la barra. Todo lo pegajoso se posiciona con
`top-[calc(var(--alto-cabecera,5rem)+0.5rem)]` en vez de con un `top-24` a ojo.

### 7.4 Primitivas de `components/ui/`

Existen para que un problema resuelto no se vuelva a resolver mal:

| Componente | Qué encapsula |
|---|---|
| `Modal` | Foco al abrir, Escape, trampa de tabulador, bloqueo de scroll, devolución del foco |
| `ConfirmDialog` | Sustituye a `window.confirm`, que bloquea el hilo y no se puede probar |
| `Field` / `TextField` | Etiqueta asociada, `aria-describedby`, error con `role="alert"`, 16px en móvil |
| `EmptyState` | Estado vacío **con una salida**, y nivel de encabezado configurable |
| `Skeleton` | Carga con la forma del contenido, no un cartel de «Cargando» |
| `Reveal` | Aparición al entrar en pantalla, con movimiento reducido resuelto |
| `AnimatedNumber` | Cuenta ascendente que siempre termina en el valor real |

### 7.5 El carrusel

`HeroCarousel.jsx` es el componente con más lógica de la capa de presentación,
porque el mando lo tiene la persona:

- Flechas, puntos y pausa **siempre visibles** (no en hover: en móvil no existe).
- El avance se congela al pasar el ratón, al enfocar dentro, al arrastrar y
  cuando la pestaña deja de estar visible (`visibilitychange`).
- Cualquier navegación manual reinicia el temporizador.
- Teclado (`←`/`→`), arrastre táctil y `role="region"` con
  `aria-roledescription="carrusel"`.
- **La barra de progreso se pinta mutando el `transform` dentro de un
  `requestAnimationFrame`.** Si viviera en el estado, el carrusel se volvería a
  renderizar sesenta veces por segundo para animar una barra.
- Precarga la imagen del siguiente slide para que el cambio no parpadee.
- Con movimiento reducido: sin autoplay, sin barra, sólo un fundido corto.

---

## 8. El panel de administración

`Dashboard.jsx` es sólo el armazón: carga `products.list()` y `orders.listAll()`
una vez, gestiona la pestaña activa (reflejada en la URL como `?tab=productos`) y
reparte los datos por props. **Los paneles inactivos no se renderizan.**

| Panel | Responsabilidad |
|---|---|
| `PanelResumen` | 8 métricas animadas, ingresos por mes, pedidos por estado, stock bajo, últimos pedidos, más vendidos |
| `PanelProductos` | Tabla/tarjetas con filtros, orden, selección múltiple, acciones masivas, edición rápida de stock, duplicado, renombrado de marcas y categorías, paginación de 25 |
| `PanelPedidos` | Filtros por estado, texto y fechas; fila expandible con el detalle; cambio de estado optimista; impresión |
| `PanelUsuarios` | Alta, cambio de rol, restablecimiento de contraseña y baja, con las salvaguardas del backend |
| `PanelCarrusel` | CRUD y reordenación de slides, con vista previa en vivo |
| `PanelAjustes` | Los ocho bloques de configuración, con aviso mientras la cuenta bancaria siga siendo de ejemplo |
| `PanelDatos` | Exportar e importar copia de seguridad, restablecer la demo, diagnóstico del backend |

La paginación de la tabla de productos no es cosmética: con cientos de filas, las
consultas por rol de Testing Library recorren todo el DOM y las pruebas se
vuelven inviables.

---

## 9. Seguridad: qué protege qué

| Amenaza | Defensa | Dónde |
|---|---|---|
| Robo de la base local | PBKDF2-SHA256 210k con sal por cuenta | `security.js` |
| Fuerza bruta | 5 intentos → 5 min de bloqueo; mismo mensaje exista o no la cuenta | `security.js` |
| Sesión copiada a mano | Token aleatorio guardado también en la cuenta; cerrar sesión lo invalida | `localBackend.js` |
| Sesión eterna | Caducidad de 12 h | `security.js` |
| **Manipular precios** | El pedido se reconstruye desde el catálogo | `orders.create` |
| Comprar sin stock | Validación por línea antes de guardar | `orders.create` |
| XSS por URL | Filtrado por esquema (`javascript:`, `data:text/html` bloqueados) | `security.js` |
| XSS por texto | Saneado de todo lo que escribe una persona; cero `dangerouslySetInnerHTML` | `security.js` |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` | `vercel.json` |
| Inyección de scripts | CSP sin `unsafe-inline` en `script-src` | `vercel.json` |
| Degradación a HTTP | HSTS con `preload` | `vercel.json` |
| Auto-ascenso a admin | Disparador `proteger_rol` | `setup_supabase.sql` |
| Fuga en copias de seguridad | `exportData()` quita hash y sal | `maintenance` |

**Lo que NO está resuelto:** en modo local no hay servidor, así que el rol es una
barrera de aplicación. Para vender de verdad hay que configurar Supabase.

---

## 10. Accesibilidad y responsive

Decisiones que están en el código y conviene no deshacer:

- **16px en los campos de formulario en móvil.** Por debajo de eso, Safari iOS
  amplía la página al enfocar y la deja ampliada. Está en `inputClasses()` y
  además hay una regla de respaldo en `index.css`.
- **44×44 px mínimo** en cualquier control que se pulse.
- **`aria-label` con el dato de la fila** en los botones de sólo icono. Un
  `title="Eliminar"` repetido veinte veces no le dice nada a quien usa lector de
  pantalla, y además `title` no aparece al enfocar con teclado.
- **Contraste 4.5:1**: sobre los fondos oscuros, `text-gray-600` da 2.6:1 y
  `text-gray-700` da 2.0:1. El texto informativo va en `text-gray-400`.
- **Jerarquía de encabezados sin saltos**, incluidos los estados vacíos.
- **`useReducedMotion` en toda animación.**
- **Tablas → tarjetas** por debajo de `lg`.
- **`con-barra-inferior`** en el `<body>` cuando hay una barra fija en móvil: el
  pie de página vive fuera del `<main>`, así que compensar dentro de la página no
  lo protege.

---

## 11. Pruebas

238 pruebas en 13 archivos, tres niveles:

| Nivel | Archivos | Qué comprueba |
|---|---|---|
| **Lógica pura** | `lib/*.test.js`, `data/seed.test.js` | Precios, filtros, métricas, seguridad, imágenes, siembra. Corren en Node, en milisegundos |
| **Contrato de datos** | `services/localBackend.test.js` (63 pruebas) | Permisos, saneado, recálculo de precios, stock, sesiones, bloqueo, configuración, copias |
| **Interfaz** | `*.test.jsx` con jsdom | Flujos completos: tienda → carrito → checkout, cuentas, panel, carrusel |

`App.test.jsx` es una prueba de humo que **monta cada ruta y falla si aparece
cualquier `console.error`**. Es la red que detecta importaciones rotas y errores
de render que las pruebas por página no verían.

`src/test/utils.jsx` da `renderWithProviders` (con los cuatro contextos),
`resetApp()`, `entrarComoAdmin()`, `entrarComoCliente()`, `makeImageFile()` y
`ponerEnCarrito()`.

---

## 12. Build y despliegue

`vite.config.js` separa el bundle en trozos para que una visita a la portada no
descargue las gráficas del panel:

| Trozo | Tamaño (gzip) |
|---|---|
| `charts` (recharts) | ~110 kB |
| `index` | ~99 kB |
| `supabase` | ~51 kB |
| `motion` | ~41 kB |
| `Dashboard` | ~27 kB |
| `react` | ~17 kB |

Más un trozo por página diferida (2–8 kB cada una).

`vercel.json` añade las cabeceras de seguridad y el cacheado: un año inmutable
para `/assets/` (con hash en el nombre), una semana para `/images/`.

El CI (`.github/workflows/ci.yml`) corre lint, pruebas y build, y **comprueba que
las imágenes generadas coincidan con el catálogo**: si alguien cambia
`products.js` sin regenerar los SVG, falla.

---

## 13. Decisiones y sus porqués

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| Dos backends tras una interfaz común | Sólo Supabase | La tienda tiene que funcionar entera al clonar el repo, sin configurar nada |
| Reglas de negocio en `lib/` puro | Repartidas en las páginas | Ya pasó: el carrito ignoraba las ofertas porque cada página hacía su propia cuenta |
| El backend recalcula el pedido | Confiar en el carrito | El cliente puede editar `localStorage`; el precio no puede salir de ahí |
| Imágenes SVG generadas | Fotos de archivo | Ligeras, nítidas en cualquier pantalla, sin derechos de terceros, y garantizan que ningún producto quede sin foto |
| Umbrales configurables | Constantes en el código | El dueño de la tienda cambia sus promociones sin tocar código |
| Primitivas en `ui/` | Cada página su modal | El foco, Escape y la trampa de tabulador se resuelven una vez |
| `--alto-cabecera` viva | `top-24` fijo | El aviso superior cambia la altura real de la barra |
| Progreso del carrusel por `ref` | Progreso en el estado | 60 renders por segundo para animar una barra |
| Datos de demostración explícitos | Base vacía | Se puede enseñar y probar la tienda entera desde el primer minuto |

---

## 14. Cómo extender

**Añadir una operación de datos**
1. Impleméntala en `localBackend.js` **y** en `supabaseBackend.js`, con la misma
   firma y los mismos mensajes de error.
2. Expórtala en `api.js`.
3. Prueba en `localBackend.test.js`, incluyendo el caso sin permiso.

**Añadir una regla de negocio**
1. Función pura en `src/lib/`, con su prueba.
2. Si es configurable, campo en `data/settings.js` y control en `PanelAjustes`.
3. Las páginas la consumen; no la reimplementan.

**Añadir una página**
1. `React.lazy` en `App.jsx`.
2. `useDocumentTitle` al principio del componente.
3. Estados de carga (`Skeleton`), vacío (`EmptyState`) y error con reintento.
4. Ruta al humo de `App.test.jsx`.

**Añadir un panel al dashboard**
1. Componente en `components/dashboard/`.
2. Entrada en `PESTANAS` de `Dashboard.jsx`.
3. Recibe datos por props del armazón; no vuelve a cargar lo que ya está.

**Cambiar el catálogo de demostración**
1. Edita `src/data/products.js`.
2. Ejecuta `node scripts/generate-demo-assets.mjs`.
3. Las pruebas derivan las cifras de `SEED_PRODUCTS.length`, así que no hay
   números que actualizar a mano.
