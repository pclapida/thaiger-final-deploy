# Thaiger Supplements

Tienda en línea de suplementos y fitness. React + Vite + Tailwind.

Incluye catálogo con filtros, carrito con precios escalonados, ofertas, checkout
por transferencia SPEI, cuentas de usuario y un panel de administración para dar
de alta productos manualmente (con foto), controlar inventario y despachar pedidos.

## Arranque rápido

```bash
npm install
npm run dev
```

Listo: no hace falta configurar nada más. La tienda arranca en **modo local** con
los 244 productos del catálogo ya cargados.

**Cuenta de administrador de la demo:**

```
admin@thaiger.mx / admin123
```

Con ella entras a `/dashboard` para añadir, editar y eliminar productos, activar
ofertas y cambiar el estatus de los pedidos.

## Los dos modos de funcionamiento

La aplicación habla siempre con `src/services/api.js`, que elige el backend solo:

| | Cuándo se usa | Dónde viven los datos |
|---|---|---|
| **Local** | Si no hay `.env` con credenciales | IndexedDB del navegador |
| **Supabase** | Si `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` están definidas | Tu proyecto de Supabase |

En modo local las fotos que subes desde el panel se guardan incrustadas en la
base del navegador (redimensionadas automáticamente). Es un modo real y usable,
pero los datos viven en ese navegador: para una tienda de verdad, con varios
dispositivos y clientes, usa Supabase.

### Conectar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el **SQL Editor**, ejecuta [`scripts/setup_supabase.sql`](scripts/setup_supabase.sql).
   Crea las tablas, las políticas de seguridad (RLS), la función de inventario y
   los buckets de imágenes.
3. Copia `.env.example` a `.env` y pega tu URL y tu *anon key*.
4. Carga el catálogo base:

   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/upload-supabase.js
   ```

5. Regístrate desde `/register` y conviértete en administrador:

   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/create-admin.js tu@correo.com "TuPassword"
   ```

> Las llaves nunca se escriben dentro del código: `VITE_*` va en `.env` (que está
> en `.gitignore`) y la *service key* sólo se pasa por variables de entorno a los
> scripts de `scripts/`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción a `dist/` |
| `npm run preview` | Sirve la compilación de producción |
| `npm test` | Pruebas (98 en total) |
| `npm run test:watch` | Pruebas en modo interactivo |
| `npm run lint` | ESLint |

## Cómo está organizado

```
src/
  services/       api.js elige entre localBackend (IndexedDB) y supabaseBackend
  lib/            pricing, catalog, metrics, imágenes, IndexedDB — lógica pura y probada
  context/        Auth, Cart, Wishlist
  components/     Navbar, Footer, ProductCard, ProductFormModal, rutas protegidas
  pages/          Home, Shop, ProductDetails, Cart, Checkout, Dashboard, UserProfile...
  data/           products.js (catálogo base) y seed.js (normalización + stock + ofertas)
scripts/          SQL de Supabase y utilidades de carga (Node)
```

### Reglas de precio

Viven todas en `src/lib/pricing.js`:

- **Nivel 1** (`price1`) por defecto; **Nivel 2** (`price2`) desde $10,000 de
  compra; **Nivel 3** (`price3`) desde $20,000. El nivel se decide con los
  precios de lista, no con los de oferta.
- Un producto en oferta aplica su porcentaje **sobre el precio del nivel vigente**.
- Envío gratis a partir de $5,000; si no, $250.

## Pruebas

```bash
npm test
```

Cubren la lógica de precios, filtros y métricas; el backend local completo
(productos, cuentas, pedidos, inventario); y los flujos de la interfaz con
Testing Library: alta de producto con foto desde el panel, filtros de la tienda,
carrito, checkout, registro/login y perfil, más un test de humo que monta cada
ruta de la aplicación.
