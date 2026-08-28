# Thaiger Supplements

Tienda en línea de suplementación deportiva: catálogo con filtros, carrito con
precios escalonados, checkout por transferencia SPEI, cuentas de cliente y un
panel de administración desde el que se controla todo el sitio.

**Este repositorio arranca con datos de DEMOSTRACIÓN.** Las marcas, los
productos, las imágenes, las cuentas y la cuenta bancaria son de ejemplo: sirven
para enseñar y probar la tienda de punta a punta sin depender de información
real. Lee [«Antes de vender de verdad»](#antes-de-vender-de-verdad) antes de
publicarla.

---

## Arrancar

```bash
npm install
npm run dev          # http://localhost:5173
```

No hace falta configurar nada: sin `.env`, la tienda guarda catálogo, cuentas,
pedidos y configuración en la base local del navegador (IndexedDB) y se siembra
sola con los datos de demostración.

### Cuentas de demostración

| Cuenta | Correo | Contraseña | Para qué |
|---|---|---|---|
| Administrador | `admin@thaiger.mx` | `admin123` | Entra a `/dashboard` |
| Cliente | `cliente@thaiger.mx` | `cliente123` | Trae pedidos de ejemplo en su historial |

La pantalla de acceso las ofrece con un botón que rellena los datos.

### Comandos

```bash
npm run dev          # servidor de desarrollo
npm test             # suite completa
npm run test:watch   # pruebas en modo vigilancia
npm run lint         # ESLint
npm run build        # build de producción
npm run preview      # sirve el build

node scripts/generate-demo-assets.mjs   # regenera las imágenes de ejemplo (SVG)
```

---

## Qué hace

| Zona | Funcionalidad |
|---|---|
| **Tienda** | Catálogo con filtros (marca, categoría, precio), buscador, orden, ficha de producto con opiniones y recomendaciones |
| **Carrito** | Persistente y sincronizado entre pestañas, precios escalonados por monto, respeta stock, avance hacia el envío gratis |
| **Checkout** | Datos de envío + transferencia SPEI con concepto generado; **el backend recalcula precios y total contra el catálogo** |
| **Cuentas** | Registro, acceso, perfil con foto, libreta de direcciones, historial de pedidos, favoritos, cambio de contraseña |
| **Admin** (`/dashboard`) | Productos, pedidos, usuarios, carrusel, ajustes de la tienda y copias de seguridad |

### Reglas de negocio

Todas viven en `src/lib/pricing.js` y son **configurables desde el panel**:

- **Niveles de precio por monto del carrito**: Nivel 1 (`price1`) por defecto,
  Nivel 2 (`price2`) a partir de $10,000, Nivel 3 (`price3`) a partir de $20,000.
  El nivel se decide con **precios de lista**, no con los de oferta.
- Un producto en oferta aplica su porcentaje **sobre el precio del nivel vigente**.
- Envío gratis desde $5,000; si no, $250.

> Si tocas precios, tócalos ahí. No repliques la aritmética en las páginas: ése
> fue exactamente el bug que hacía que el carrito ignorara las ofertas.

---

## Arquitectura

### Dos backends intercambiables

```
páginas → src/services/api.js → ┌─ localBackend.js    (IndexedDB, por defecto)
                                └─ supabaseBackend.js (si hay .env)
```

`api.js` elige según `isSupabaseConfigured`. Ambos exponen **la misma API**:
`products`, `orders`, `auth`, `users`, `settings`, `maintenance`. Las páginas no
saben cuál está activo.

**Nunca importes `supabase` directamente en una página.** Usa `services/api`, y
si añades una operación de datos, impleméntala en *los dos* backends.

### Estructura

```
src/
  services/       api.js (selector) + localBackend.js + supabaseBackend.js
  lib/            lógica pura, sin React, cubierta por pruebas
                  pricing · catalog · metrics · security · motion · image · idb · productForm
  context/        Auth · Cart · Wishlist · Settings
  components/     Navbar, Footer, HeroCarousel, ProductCard, ui/ (primitivas), dashboard/ (paneles)
  hooks/          useDocumentTitle
  pages/          Home, Shop, ProductDetails, Cart, Checkout, Dashboard, UserProfile, ...
  data/           products.js (catálogo demo) · seed.js (siembra) · settings.js (config inicial)
  test/           setup.js (polyfills) y utils.jsx (renderWithProviders)
scripts/          SQL de Supabase, alta de admin, carga de catálogo, generador de imágenes
```

### Convenciones

- Código y comentarios **en español**.
- `ProductCard` recibe **el producto completo** (`product={...}`), no props sueltas.
- El usuario de sesión es siempre `{ id, email, name, role, avatar_url }`.
- ESLint prohíbe `setState` síncrono dentro de `useEffect`: para reaccionar a un
  cambio de ruta o de `id`, ajusta el estado **durante el render** comparando con
  un estado espejo.
- Animaciones: usa las variantes de `src/lib/motion.js` y respeta
  `useReducedMotion`. Nada de movimiento inventado por página.
- Formularios: usa `Field` / `TextField` para que toda etiqueta quede asociada.

---

## Seguridad

Lo que está resuelto:

- **Contraseñas** derivadas con PBKDF2-SHA256 (210,000 iteraciones, sal por
  cuenta). Nunca se guardan legibles. Las cuentas con el hash viejo se migran
  solas al entrar.
- **Sesiones** con token aleatorio y caducidad de 12 h; cerrar sesión invalida el
  token, así que una sesión copiada a mano deja de servir.
- **Bloqueo por fuerza bruta**: 5 intentos fallidos y la cuenta queda bloqueada
  5 minutos. El mensaje de error no revela si el correo existe.
- **Precios no se confían al cliente**: el pedido se reconstruye en el backend a
  partir del catálogo, con validación de stock. Manipular el carrito en
  `localStorage` no cambia lo que se cobra.
- **Saneado de entradas** (`src/lib/security.js`) en todo lo que escribe una
  persona; las URLs de imagen y de redes se filtran por esquema (`javascript:`
  bloqueado).
- **Cabeceras HTTP** en `vercel.json`: CSP, HSTS, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`.
- **RLS en Supabase** (`scripts/setup_supabase.sql`), con un disparador que
  impide que alguien se ascienda a administrador editando su propio perfil.

Lo que hay que saber:

> En modo local no hay servidor: la base vive en el navegador de cada visitante
> y las comprobaciones de rol son una barrera de la aplicación, no del sistema.
> La frontera de seguridad real es Supabase con RLS. Para vender de verdad,
> configúralo.

---

## Supabase (opcional)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta `scripts/setup_supabase.sql` en el SQL Editor.
3. Copia `.env.example` a `.env` y pega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Carga el catálogo: `SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/upload-supabase.js`
5. Crea el administrador: `node scripts/create-admin.js correo@ejemplo.com "Password123"`

La `service_role key` sólo se usa en los scripts. **Nunca** la pongas en una
variable `VITE_*`: eso la publica en el navegador.

---

## Antes de vender de verdad

1. **Cambia la cuenta bancaria.** El checkout muestra una CLABE de ejemplo
   (`000000000000000000`, «BANCO DEMO»). Se edita en `/dashboard → Ajustes`, y
   mientras la casilla «datos de ejemplo» siga marcada el sitio lo avisa en rojo.
2. **Sustituye el catálogo de demostración** por el real, con sus fotos.
3. **Configura Supabase**: en modo local los datos viven en un solo navegador.
4. **Quita el `noindex`** de `index.html` cuando la tienda deje de ser una demo.
5. Nadie concilia los pagos SPEI todavía: el admin verifica a mano y cambia el
   estatus. Considera una pasarela (Stripe / Mercado Pago).
6. No se envían correos (confirmación de pedido, cambio de estatus, recuperación
   de contraseña).

---

## Pruebas

```bash
npm test
```

Cubren la lógica pura (precios, filtros, métricas, seguridad, imágenes,
siembra), el backend local completo (productos, cuentas, permisos, pedidos,
inventario, configuración, mantenimiento) y los flujos de interfaz con Testing
Library, incluido un test de humo que monta **cada ruta** y falla si aparece
cualquier error en consola.

Las pruebas corren en Node por defecto; los archivos que montan React llevan
`// @vitest-environment jsdom` en la primera línea.

> **Ojo con las pruebas de UI**: `getByRole` recorre todo el DOM. Filtra o pagina
> antes de buscar dentro de tablas largas, o la prueba expira.
