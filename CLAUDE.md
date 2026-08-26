# CLAUDE.md — Thaiger Supplements

Contexto para trabajar en este repositorio. Léelo antes de tocar código.

---

## 1. Qué es la aplicación

Tienda en línea de suplementos deportivos (mercado mexicano, precios en MXN).
SPA de **React 19 + Vite 7 + Tailwind 4**, sin framework de servidor.

Catálogo base: **244 productos reales**, 18 marcas, 9 categorías, en
`src/data/products.js`.

### Qué hace

| Zona | Funcionalidad |
|---|---|
| **Tienda** | Catálogo con filtros (marca, categoría, rango de precio), buscador, orden por precio/nombre, ficha de producto con selector de cantidad y opiniones |
| **Carrito** | Persistente en `localStorage`, precios escalonados por monto, respeta stock, envío calculado |
| **Checkout** | Datos de envío + pago por transferencia SPEI (concepto generado), crea el pedido y descuenta inventario |
| **Cuentas** | Registro, login, perfil con foto (subida o URL), historial de pedidos, lista de favoritos |
| **Admin** (`/dashboard`) | Alta/edición/borrado de productos **con foto**, control de stock, activar ofertas, despachar pedidos, gráfica de ingresos |

### Reglas de negocio (todas en `src/lib/pricing.js`)

- **Niveles de precio por monto del carrito**: Nivel 1 (`price1`) por defecto,
  Nivel 2 (`price2`) desde $10,000, Nivel 3 (`price3`) desde $20,000.
  El nivel se decide con **precios de lista**, no con los de oferta.
- Un producto en oferta aplica su porcentaje **sobre el precio del nivel vigente**.
- Envío gratis desde $5,000; si no, $250.

> Si tocas precios, tócalos aquí. No repliques la aritmética en las páginas —
> ese fue exactamente el bug que hacía que el carrito ignorara las ofertas.

---

## 2. Arquitectura

### El punto clave: dos backends intercambiables

```
páginas  →  src/services/api.js  →  ┌─ localBackend.js   (IndexedDB, por defecto)
                                    └─ supabaseBackend.js (si hay .env)
```

`api.js` elige según `isSupabaseConfigured` (de `src/supabase.js`). Ambos backends
exponen **la misma API**: `products`, `orders`, `auth`. Las páginas no saben cuál
está activo.

**Nunca importes `supabase` directamente en una página.** Usa `services/api`.
Si agregas una operación de datos, impleméntala en *los dos* backends.

Modo local: los datos viven en IndexedDB del navegador; las fotos se guardan
incrustadas como data URL (redimensionadas a 900px por `src/lib/image.js`).
Admin sembrado: `admin@thaiger.mx` / `admin123`.

### Estructura

```
src/
  services/
    api.js              selector de backend + BACKEND_MODE / IS_LOCAL_MODE
    localBackend.js     IndexedDB: productos, cuentas (hash SHA-256), pedidos
    supabaseBackend.js  misma API contra Supabase + Storage
  lib/                  lógica pura, sin React, toda cubierta por pruebas
    pricing.js          niveles, ofertas, totales, formato MXN
    catalog.js          filtros, búsqueda, orden, agrupación de marcas
    metrics.js          métricas del dashboard
    productForm.js      validación del formulario de alta
    image.js            validación y redimensionado de fotos
    idb.js              envoltorio mínimo de IndexedDB
  context/              AuthContext, CartContext, WishlistContext
  components/           Navbar, Footer, ProductCard, ProductFormModal, rutas protegidas
  pages/                Home, Shop, ProductDetails, Cart, Checkout, Dashboard, UserProfile, ...
  data/
    products.js         catálogo base (no editar a mano, viene del scraper)
    seed.js             normaliza marcas/categorías y agrega stock, fotos y ofertas
  test/                 setup.js (polyfills) y utils.jsx (renderWithProviders)
scripts/                SQL de Supabase y utilidades Node
```

### Convenciones

- Código y comentarios **en español**.
- `ProductCard` recibe **el producto completo** (`product={...}`), no props sueltas.
  Antes cada página armaba props distintas y se desincronizaban.
- El usuario de sesión es siempre `{ id, email, name, role, avatar_url }`.
  No existe `user.uid` ni `currentUser` (eran restos de Firebase).
- ESLint prohíbe `setState` síncrono dentro de `useEffect`. Para reaccionar a un
  cambio de ruta o de `id`, ajusta el estado **durante el render** comparando con
  un estado espejo (ver `Shop.jsx` y `ProductDetails.jsx`).

---

## 3. Comandos

```bash
npm install
npm run dev          # servidor de desarrollo
npm test             # 121 pruebas
npm run test:watch
npm run lint
npm run build
```

Las pruebas por defecto corren en Node; los archivos que montan React llevan
`// @vitest-environment jsdom` en la primera línea.

> **Ojo con las pruebas de UI**: las consultas `getByRole` recorren todo el DOM.
> En el Dashboard con 244 filas se vuelven lentísimas y la prueba expira. Filtra
> la tabla antes de abrir el modal (ver `abrirPestanaProductos` en
> `src/pages/Dashboard.test.jsx`).

---

## 4. Qué se hizo en la recuperación del proyecto (2026-08-25)

El proyecto estaba abandonado y **sin backend**: el proyecto de Supabase del que
dependía todo fue eliminado (`ymgbcedizhhoelwjkoxj.supabase.co` ya no resuelve por
DNS). Sus credenciales estaban escritas en claro en `create-admin.js`, junto con
una contraseña personal.

### Cambios estructurales

- Capa de datos con dos backends (`src/services/`) — el proyecto vuelve a arrancar
  sin configurar nada.
- Lógica de negocio extraída a `src/lib/` para poder probarla sin montar React.
- `ProductFormModal` separado del Dashboard: escribir en el formulario ya no vuelve
  a renderizar la tabla completa del inventario.
- `AuthContext` reescrito sobre la nueva capa; se eliminaron los restos de Firebase.
- Build partido en chunks (antes un solo archivo de 1 MB; ahora el mayor es 373 kB).

### Alta manual de productos con foto (lo que se pidió)

`ProductFormModal` cubre: nombre, marca y categoría con autocompletado del catálogo,
descripción, stock, los tres niveles de precio (con botón que calcula −10% / −20%),
oferta con porcentaje y vista previa del precio final, y **foto por archivo o
arrastrando a la caja**, con previsualización y opción de pegar una URL.
Funciona igual para crear y para editar.

### Bugs corregidos

| Bug | Detalle |
|---|---|
| Ofertas no se cobraban | La tarjeta mostraba −20% y el carrito cobraba precio de lista |
| `$0.00` en la página de Ofertas | Se pasaba un elemento JSX como precio a `ProductCard` |
| `$$10,000.00` | Doble símbolo de peso en el banner de niveles del carrito |
| Marcas inexistentes | `GAT SPORT`, `Ronnie Coleman`, `Cbum`, `Redcon1`, `BPI Sports` estaban en el carrusel y en Marcas pero no en el catálogo: "Ver Productos" llevaba a una tienda vacía |
| Filtros duplicados | `Proteína`/`Proteina` y `PSYCHOPHARMA`/`PSYCHO PHARMA` salían como dos casillas |
| Sin menú en móvil | Enlaces y buscador ocultos bajo `md:` sin alternativa |
| Restos de Firebase | `currentUser.displayName` nunca existía en Supabase |
| Opiniones volátiles | Se perdían al recargar; ahora persisten por producto |
| Imágenes rotas | Dejaban huecos en lugar de mostrar el marcador |
| Stock inconsistente | Productos agotados decían "Agotado" pero dejaban comprar |
| Etiquetas sin `htmlFor` | Formularios del panel y del perfil, inaccesibles |

### Limpieza

Se eliminaron logs de build, reportes de ESLint, un `upload.js` de Firebase roto y
`ventas.html` (era de un proyecto de micromovilidad, sin relación). Los scripts se
movieron a `scripts/` y `create-admin.js` ahora lee las llaves del entorno.

### Pruebas añadidas: 121

Lógica pura (precios, filtros, métricas, imágenes, siembra), el backend local
completo (productos, cuentas, pedidos, inventario), y flujos de interfaz con
Testing Library: alta de producto con foto, filtros de tienda, carrito, checkout
(verifica pedido guardado + inventario descontado + carrito vacío), registro/login,
perfil, y un test de humo que monta **cada ruta** y falla si aparece cualquier
error en consola.

---

## 5. Qué falta

Ordenado por lo que más duele:

1. **No hay cobro real.** El checkout registra el pedido y muestra una CLABE de
   ejemplo (`012345678901234567`, "BBVA Bancomer"). **Hay que sustituirla por la
   cuenta real antes de publicar**, o integrar una pasarela (Stripe / Mercado Pago).
2. **Nadie confirma los pagos.** No hay conciliación de transferencias SPEI: el
   admin tiene que verificar a mano y cambiar el estatus.
3. **No se envían correos.** Ni confirmación de pedido, ni cambio de estatus, ni
   recuperación de contraseña.
4. **Sin verificación en el navegador.** Todo se validó con pruebas en jsdom; nadie
   ha abierto la tienda en un Chrome real desde la recuperación.
5. **Catálogo casi sin fotos**: sólo 6 de 244 productos tienen imagen. El resto
   muestra un marcador. Se pueden cargar una a una desde el panel, o retomar
   `scripts/scraper.py`.
6. **Direcciones múltiples**: la pestaña del perfil dice "Próximamente".
7. **Opiniones locales**: viven en el `localStorage` de cada visitante, no se
   comparten ni se moderan.
8. **Redes sociales**: los iconos del footer apuntan a `href="#"`.
9. **Sin CI**: nada corre `npm test` automáticamente.
10. **Modo local ≠ producción**: los datos viven en un solo navegador. Para vender
    de verdad hace falta Supabase configurado.
11. **El repo arrastra un directorio ajeno**: `Magic-Shop-.../` (un proyecto PHP sin
    relación) sigue rastreado en git aunque ya no está en disco.

---

## 6. Recomendaciones

**Antes de publicar (bloqueantes):**

1. Cambiar los datos bancarios de `src/pages/Checkout.jsx` por los reales.
2. Crear el proyecto de Supabase: ejecutar `scripts/setup_supabase.sql`, poner las
   llaves en `.env`, cargar el catálogo con `scripts/upload-supabase.js` y crear el
   admin con `scripts/create-admin.js`.
3. **Tratar las credenciales viejas como comprometidas**: siguen en el historial de
   git. Aunque el proyecto ya no exista, la contraseña personal que aparecía ahí no
   debe reutilizarse en ningún lado.
4. Revisar la tienda en un navegador real, sobre todo en móvil.

**Después, por orden de valor:**

5. Cargar fotos de los productos que más se venden — es lo que más cambia la
   conversión y ya se puede hacer desde el panel.
6. Correo transaccional (Resend o el propio Supabase) para confirmar pedidos.
7. Pasarela de pago; SPEI manual no escala.
8. Un workflow de GitHub Actions con `npm run lint && npm test && npm run build`.
9. Paginar la tabla del panel si el catálogo pasa de ~500 productos.
10. Sacar `Magic-Shop-.../` del control de versiones.

**Al escribir código nuevo:**

- Datos siempre por `src/services/api.js`, implementando en los dos backends.
- Reglas de negocio en `src/lib/`, con su prueba. Las páginas sólo pintan.
- Ejecuta `npm run lint && npm test` antes de dar algo por terminado.
