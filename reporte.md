# Reporte de cambios — Thaiger Supplements

Qué se hizo en la reconstrucción, por qué, y qué queda pendiente.

- Commit: `361a449` — *feat: rehace la tienda sobre datos de demostracion, con panel total y seguridad*
- Alcance: 133 archivos, **+19,721 / −4,773 líneas**
- Estado: subido a `origin/main`

Documentos hermanos: [`CLAUDE.md`](CLAUDE.md) (contrato de trabajo) ·
[`arquitectura.md`](arquitectura.md) (diseño interno) · [`README.md`](README.md)

---

## 1. Resumen en números

| | Antes | Después |
|---|---|---|
| Líneas de código en `src/` | 6,862 | 20,147 |
| Archivos JS/JSX | 52 | 79 |
| Pruebas | 121 (11 archivos) | **238** (13 archivos) |
| Productos del catálogo | 244 reales | 32 de ejemplo |
| Productos **con foto** | 6 de 244 (2%) | **32 de 32 (100%)** |
| Imágenes en el repo | 6 JPG + banner | 42 SVG generados |
| Pestañas del panel | 3 | **7** |
| Módulos de lógica pura | 6 | 8 |
| Primitivas de interfaz | 0 | 7 |
| Cabeceras de seguridad | 0 | 8 |
| Integración continua | no | sí |

---

## 2. Datos de demostración

**El problema.** El repositorio traía 244 productos reales con marcas y precios
de terceros, y sólo 6 tenían fotografía: el 98% del catálogo se veía como una
tarjeta gris con un icono.

**Lo que se hizo.**

- Se eliminaron los 244 productos, las 6 fotos, `banner.jpg` y el scraper que los
  había generado (`scraper.py`, `parse_products.py`, `new_products.txt`).
- Entraron **32 productos de ejemplo** con 6 marcas ficticias (THAIGER LABS, NOVA
  NUTRITION, IRON PEAK, PURE CORE, VOLT SUPPS, ATLAS FOODS) y 8 categorías, con
  nombres, descripciones y precios creíbles en los tres niveles.
- **Todos tienen ilustración.** `scripts/generate-demo-assets.mjs` genera 42 SVG:
  32 de producto (la silueta cambia según la categoría —bote, frasco, botella,
  bolsa, shaker— y el color según la marca), 4 fondos de carrusel y 6 logotipos.
- Cuentas sembradas: `admin@thaiger.mx / admin123` y `cliente@thaiger.mx / cliente123`.
- **Seis pedidos de ejemplo** repartidos en los últimos meses, para que el panel
  arranque con una gráfica que mirar en vez de un cero.
- Configuración inicial completa: contacto, cuenta SPEI de ejemplo, textos y
  carrusel, todo editable desde el panel.
- Se conservan `logo.png` y `loader.png` — son la identidad de la tienda.

**Nota:** son ilustraciones generadas, no fotografías. Se eligieron por ser
ligeras, nítidas en cualquier pantalla y libres de derechos de terceros.

---

## 3. El carrusel

**El problema, en tus palabras:** *«el carrusel se mueve cuando le da la gana»*.
Avanzaba cada 4.5 s sin forma de detenerlo, sin flechas, y sus tres marcas
(MUTANT, INSANE LABZ, EVOGEN) estaban escritas a mano con fotos de Unsplash.

**Lo que se hizo** (`src/components/HeroCarousel.jsx`, nuevo):

| Antes | Ahora |
|---|---|
| Sólo avanzaba solo | Flechas anterior/siguiente **siempre visibles** |
| Sin pausa | Botón de pausa/reproducción explícito |
| Sin teclado | `←` / `→` cuando el carrusel tiene el foco |
| Sin gestos | Arrastre táctil con umbral |
| Sin indicador de tiempo | Barra de progreso que se congela al pausar |
| Seguía en segundo plano | Se detiene con la pestaña oculta |
| Marcas inventadas | Slides editables desde el panel |
| — | Se pausa al pasar el ratón, al enfocar y al arrastrar |
| — | Cualquier navegación manual reinicia el temporizador |
| — | Precarga el siguiente fondo; sin autoplay con movimiento reducido |

11 pruebas dedicadas (`HeroCarousel.test.jsx`).

---

## 4. El panel de administración

De 3 pestañas a **7**, con la URL reflejando la activa (`?tab=productos`).

| Pestaña | Qué controla |
|---|---|
| **Resumen** | 8 métricas animadas (ingresos, pedidos, pendientes, ticket promedio, productos, agotados, valor del inventario, stock bajo), ingresos por mes, pedidos por estado, listas de stock bajo, últimos pedidos y más vendidos |
| **Productos** | Filtros por marca, categoría, stock y oferta; orden por columna; **selección múltiple con acciones masivas**; edición rápida de stock; duplicar; **renombrar marcas y categorías en todo el catálogo**; paginación de 25 |
| **Pedidos** | Filtros por estado, texto y rango de fechas; fila expandible con artículos y dirección; cambio de estado optimista; borrado; impresión |
| **Usuarios** | Alta, cambio de rol, restablecimiento de contraseña y baja — con las salvaguardas del backend |
| **Carrusel** | Alta, edición, borrado, activación y reordenación de slides, con vista previa en vivo |
| **Ajustes** | Tienda, cuenta SPEI, envíos, umbrales de precio, textos de la portada, redes sociales y aviso superior |
| **Datos** | Exportar e importar copia de seguridad en JSON, restablecer la demo, diagnóstico del backend |

El renombrado de marcas y categorías merece mención aparte: es lo que evita que
el catálogo se vuelva a llenar de duplicados por acentos o mayúsculas, que era un
bug histórico («Proteina» y «Proteína» aparecían como dos filtros distintos).

---

## 5. Seguridad

| Área | Antes | Ahora |
|---|---|---|
| Contraseñas | SHA-256 con sal | **PBKDF2-SHA256, 210,000 iteraciones**, con migración automática al entrar |
| Sesión | Id del usuario en `localStorage`, sin caducidad | Token aleatorio con caducidad de 12 h, invalidado al cerrar sesión |
| Fuerza bruta | Sin límite | 5 intentos → 5 min de bloqueo, mismo mensaje exista o no la cuenta |
| Precios | **El navegador enviaba `price_at_purchase` y `total`** | El backend reconstruye el pedido desde el catálogo |
| Stock | Sin validar al comprar | Validado por línea antes de guardar |
| Autorización | Ninguna en el backend local | `requireAdmin()` / `requireSession()` en cada mutación |
| Entradas | Sin sanear | Saneado de texto y filtrado de URLs por esquema |
| Cabeceras HTTP | Ninguna | CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP, `nosniff` |
| RLS | Políticas básicas | Ampliadas + **disparador que impide auto-ascenderse a admin** |
| Copias de seguridad | — | `exportData()` nunca incluye hash ni sal |

**El cambio más importante** es el de precios. Antes, editar `localStorage` para
poner `price_at_purchase: 1` producía un pedido de un peso. Ahora `orders.create`
recibe sólo `[{ product_id, quantity }]` y calcula todo lo demás. Hay una prueba
dedicada a intentarlo y verificar que falla.

---

## 6. Interfaz y experiencia

### Animación

`src/lib/motion.js` (nuevo) centraliza el vocabulario: curvas, resortes,
duraciones y 14 variantes reutilizables. **Toda animación respeta
`prefers-reduced-motion`** vía `resolveVariants()` y `useReducedMotion`.

### Responsive

| Problema encontrado | Arreglo |
|---|---|
| Campos de 14px → Safari iOS ampliaba la página al enfocar y la dejaba ampliada | 16px en móvil, en `inputClasses()` y con una regla de respaldo |
| Botones de 32×32 en el panel | Mínimo 44×44 en todo control pulsable |
| Tablas ilegibles en móvil | Se convierten en tarjetas por debajo de `lg` |
| Barra fija del carrito tapaba el pie | Clase `con-barra-inferior` en el `<body>` |
| `sticky` calculado sobre 5rem fijos, pero el aviso superior agranda la barra | Variable viva `--alto-cabecera`, medida con `ResizeObserver` |
| Puntos y flechas del carrusel se cruzaban a 320px | Bandas separadas |

### Accesibilidad

- **Botones dentro de enlaces** en `ProductCard`: HTML lo prohíbe y algunos
  lectores de pantalla no exponían «Añadir a favoritos» ni «Agregar». Resuelto
  con enlace extendido y los botones como hermanos.
- **Contraste**: `text-gray-600` daba 2.6:1 y `text-gray-700` 2.0:1 sobre los
  fondos oscuros, muy por debajo del 4.5:1 exigido. El texto informativo pasó a
  `text-gray-400`.
- **Botones de sólo icono**: `aria-label` con el dato de la fila, en vez de un
  `title="Eliminar"` repetido veinte veces.
- **Foco en capas modales**: el cajón de filtros de la tienda declaraba
  `aria-modal` pero dejaba escapar el tabulador. Ahora usa el mismo patrón que
  `ui/Modal`.
- **Jerarquía de encabezados** sin saltos; `EmptyState` acepta `as="h2"`.
- **Estrellas de las opiniones**: eran `aria-hidden`, así que la calificación no
  se leía. Ahora llevan texto alternativo.
- **Selector de calificación**: declaraba `role="radiogroup"` sin implementar el
  patrón de teclado. Se cambió por radios nativos en un `fieldset`.
- Enlace «Saltar al contenido» como primer elemento del DOM.

### Estructura

Nuevos: `ErrorBoundary` (se reinicia al navegar), `ScrollProgress`, `NotFound`
propio, carga diferida de todas las rutas salvo Home y NotFound, `Suspense` con
pantalla de marca, esqueletos de carga y estados vacíos con salida.

`PageTransition` estaba roto —una cortina que animaba siempre a `y: 100%` y no se
veía nunca— y se reescribió.

### Funcionalidad que faltaba

- **Libreta de direcciones**: la pestaña decía «Próximamente». Ahora da de alta,
  edita, borra y marca una como predeterminada.
- **Cambio de contraseña** desde el perfil, exigiendo la actual.
- **Repetir pedido** desde el historial.
- **Redes sociales del pie**: tres iconos apuntaban a `href="#"`. Ahora sólo se
  pintan las que tengan URL configurada y válida.

---

## 7. Calidad y mantenimiento

- **Pruebas: 121 → 238.** Nuevas: `security.test.js` (28), `HeroCarousel.test.jsx`
  (11), y `localBackend.test.js` pasó de 30 a 63 cubriendo permisos, saneado,
  recálculo de precios, configuración y copias.
- Las pruebas **derivan las cifras del catálogo** de `SEED_PRODUCTS.length`, así
  que cambiar un producto ya no las rompe.
- `App.test.jsx` monta cada ruta y **falla ante cualquier `console.error`**.
- **CI en GitHub Actions**: lint, pruebas, build y comprobación de que las
  imágenes generadas coinciden con el catálogo.
- Se eliminaron `App.css` (residuo de la plantilla de Vite) y
  `tailwind.config.js` (Tailwind 4 configura en CSS).
- `README.md` y `CLAUDE.md` reescritos; `arquitectura.md` y este reporte, nuevos.

---

## 8. Lo que falta

Ordenado por lo que más bloquea.

### Bloqueante para vender

**1. Los datos bancarios siguen siendo de ejemplo.**
`BANCO DEMO`, CLABE `000000000000000000`. Se cambian en `/dashboard → Ajustes`.
*Tip:* desmarca la casilla «datos de ejemplo» al hacerlo; mientras siga marcada,
el checkout muestra un aviso en rojo. Es intencional: es la última red antes de
que alguien transfiera a una cuenta que no existe.

**2. Nadie concilia los pagos SPEI.**
El pedido queda en «Pago Pendiente» y alguien tiene que mirar el banco y cambiar
el estatus a mano.
*Tip:* funciona para un volumen bajo. Cuando estorbe, el camino corto es una
pasarela (Mercado Pago tiene SPEI con confirmación automática en México); el
largo, un webhook bancario, que casi ningún banco mexicano ofrece a comercios
pequeños.

**3. No se envían correos.**
Ni confirmación de pedido, ni cambio de estatus, ni recuperación de contraseña.
Esto último significa que **quien olvide su contraseña depende del admin**.
*Tip:* con Supabase, la recuperación por correo ya viene incluida
(`auth.resetPasswordForEmail`); es lo más barato de activar. Para los correos de
pedido, Resend o Supabase Edge Functions.

**4. Configurar Supabase.**
En modo local los datos viven en un solo navegador: si el cliente entra desde el
teléfono, no ve su pedido; si borra los datos del navegador, pierde todo.
*Tip:* está todo listo — `scripts/setup_supabase.sql`, `upload-supabase.js` y
`create-admin.js`. Es una tarde de trabajo, no un proyecto.
*Cuidado:* nunca pongas la `service_role key` en una variable `VITE_*`; eso la
publica en el navegador.

**5. Las credenciales viejas del Supabase eliminado siguen en el historial de git.**
*Tip:* trátalas como comprometidas. Si el proyecto ya está borrado no hay riesgo
real, pero no las reutilices.

### Importante antes de publicar

**6. Nadie ha abierto la tienda en un navegador real.**
Está verificada en jsdom, incluido un test que monta cada ruta y falla ante
cualquier error de consola. Pero jsdom no pinta: no detecta un desbordamiento, un
z-index mal puesto o una animación que trabe.
*Tip:* dedica media hora a recorrerla en Chrome y en un teléfono real. Empieza
por el flujo completo —tienda → producto → carrito → checkout— y luego el panel.

**7. Quitar el `noindex` de `index.html`.**
Mientras esté, Google no indexa el sitio. Es correcto para una demo; hay que
quitarlo el día que sea real.

**8. Sustituir el catálogo de demostración.**
*Tip:* para pocos productos, el panel (`Productos → Añadir`) redimensiona las
fotos solo. Para muchos, edita `src/data/products.js` y usa
`node scripts/upload-supabase.js`. **Al poner fotos reales, quita del CI el paso
que comprueba las imágenes generadas**, o fallará en cada empuje.

### Deuda conocida

**9. Las opiniones viven en `localStorage`.**
Cada visitante ve sólo las suyas y nadie las modera.
*Tip:* una tabla `reviews` en Supabase con RLS (leer todos, escribir el autor) y
la moderación como una pestaña más del panel.

**10. Las direcciones también son locales.**
La libreta del perfil no viaja entre dispositivos, y el checkout **no la usa**:
hay que reescribir la dirección en cada compra.
*Tip:* conectarla al checkout es una tarde y se nota mucho en la experiencia.

**11. `charts` (recharts) pesa 110 kB gzip.**
Es el trozo más grande del build. Sólo lo carga quien entra al panel, así que no
afecta a la tienda, pero para dos gráficas es caro.
*Tip:* si el panel se siente lento, unas 60 líneas de SVG a mano quitan esa
dependencia entera.

**12. `PanelProductos.jsx` tiene 1,103 líneas y `UserProfile.jsx` 1,049.**
Funcionan y están probados, pero son los dos archivos donde más cuesta orientarse.
*Tip:* si hay que tocarlos a fondo, sepáralos primero (la tabla, la barra de
filtros y las acciones masivas son tres piezas independientes).

**13. `metrics.js` agrupa por mes sin distinguir el año.**
Con más de doce meses de historial, «Ene» sumaría dos eneros distintos.
*Tip:* no molesta con los datos de demostración, pero sí en producción al segundo
año. Es un arreglo de pocas líneas.

**14. `baseline-browser-mapping` y `caniuse-lite` están desactualizados.**
Sale un aviso en cada build.
*Tip:* `npm i baseline-browser-mapping@latest -D && npx update-browserslist-db@latest`.

### Ideas, si hay tiempo

- Búsqueda con sugerencias mientras se escribe.
- Comparador de productos.
- Cupones de descuento (la aritmética de `pricing.js` ya está preparada).
- Facturación (CFDI) — obligatorio en México a partir de cierto volumen.
- Guías de envío y rastreo dentro del pedido.
- Analítica de la tienda: qué se busca, qué se abandona en el carrito.

---

## 9. Cosas que conviene no deshacer

Decisiones que parecen prescindibles y no lo son:

1. **`orders.create` no acepta precios.** Volver a mandarlos desde el navegador
   reabre el agujero de cobro.
2. **Las reglas de negocio viven en `src/lib/`.** Copiar la aritmética a una
   página es exactamente lo que hacía que el carrito ignorara las ofertas.
3. **Las marcas y categorías salen del catálogo real.** Escribirlas a mano fue lo
   que hacía que «Ver productos» llevara a una tienda vacía.
4. **16px en los campos en móvil.** Bajarlo a `text-sm` devuelve el zoom de iOS.
5. **`--alto-cabecera` es una variable viva.** Sustituirla por un `top-24` fijo
   vuelve a meter los elementos pegajosos debajo de la barra.
6. **Las pruebas derivan las cifras del catálogo.** Escribir «32» a mano las
   rompe al siguiente cambio de producto.
