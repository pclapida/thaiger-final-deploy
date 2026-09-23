# DESPLIEGUE.md — Cómo poner la tienda en línea

Guía para hacerlo por primera vez, de principio a fin. Está escrita para
seguirse en orden; cada paso dice qué necesitas tener a la mano y cómo
comprobar que quedó bien antes de pasar al siguiente.

> **Tiempo realista:** una tarde para tener la tienda en línea con SPEI manual
> (pasos 1–6); otra tarde para Mercado Pago y correos (7–8); Skydropx (9) es
> opcional y depende de que te den credenciales.

---

## 0. Qué vas a tener y qué cuesta

```
Navegador ──► Cloudflare Pages (la tienda, archivos estáticos)      $0
                 │
                 ├──► Supabase (base de datos, cuentas, fotos)        $0 al arrancar*
                 │       └── Edge Functions: crear-pago, mp-webhook,
                 │           notificar-pedido, cotizar-envio, generar-guia
                 │
                 ├──► Mercado Pago (cobro)         3.49 % + $4 + IVA por venta
                 ├──► Resend (correos)              $0 hasta 3,000/mes
                 └──► Skydropx (guías, opcional)    lo que cueste cada guía
```

\* El plan gratis de Supabase **no hace respaldos automáticos**. Mientras
estén en él, descarguen la copia desde `/dashboard → Datos` cada semana. Con
pedidos reales, los $25 USD/mes del plan Pro son un seguro, no un lujo.

**Cuentas que hay que abrir** (todas gratis; abrirlas toma 10 minutos cada una):

| Servicio | Para qué | Ten a la mano |
|---|---|---|
| [supabase.com](https://supabase.com) | Base de datos, cuentas de clientes, fotos, funciones | Correo de la empresa |
| [cloudflare.com](https://cloudflare.com) | Hosting de la tienda y DNS del dominio | El dominio (o cómpralo ahí mismo) |
| [mercadopago.com.mx](https://www.mercadopago.com.mx) | Cobrar con tarjeta, SPEI y OXXO | Cuenta bancaria, identificación; para producción, datos fiscales |
| [resend.com](https://resend.com) | Correos de pedido y de recuperación de contraseña | Acceso al DNS del dominio |
| [pro.skydropx.com](https://pro.skydropx.com) (opcional) | Cotizar y generar guías | Dirección desde la que se envía |
| GitHub | De ahí despliega Cloudflare | Este repositorio |

---

## 1. Supabase: crear el proyecto

1. Entra a supabase.com → **New project**. Nombre: `thaiger`. Región: la más
   cercana (**East US** funciona bien para México). Guarda la contraseña de la
   base en el gestor de contraseñas: la vas a necesitar.
2. Espera a que termine de crearse (1–2 min).
3. En **Project Settings → API** copia dos cosas (éstas son las del proyecto real,
   creado el 19/09/2026; son públicas por diseño, viajan en el navegador):
   - **Project URL**: `https://vylqmwzofiybmohgzwum.supabase.co`
   - **publishable key**: `sb_publishable_zRjXfz6VHum_xEmNUyeYOw_V9CghhoU`

   Lo que hay entre `https://` y `.supabase.co` es el **project ref**
   (`vylqmwzofiybmohgzwum`). Se usa en varios comandos de abajo.

4. **Nunca** copies la `service_role key` ni la **contraseña de la base** a
   ningún archivo del repositorio, del front-end ni a Cloudflare. La contraseña
   vive en un gestor de contraseñas; sólo la pide `supabase link`. La
   service_role sólo la usan los scripts de `scripts/` desde tu computadora.

## 2. Supabase: el esquema

1. **Database → Webhooks → Enable webhooks** (un botón; instala lo que usa
   `configurar_notificaciones`).
2. **SQL Editor → New query**. Pega **completo** el contenido de
   `scripts/setup_supabase.sql` y ejecuta (Run). Debe terminar en "Success".
   Los avisos "does not exist, skipping" son normales: el script se puede
   volver a ejecutar sin romper nada.
3. Comprueba en **Table Editor** que existen `users`, `products`, `orders`,
   `order_items`, `settings` y `shipping_quotes`.

> Si ya habías ejecutado una versión anterior del SQL, **vuelve a ejecutarlo**:
> las versiones viejas dejaban que un cliente registrara pedidos de $1 marcados
> como pagados.

## 3. Supabase: cuentas y catálogo

1. En tu computadora, crea `.env` a partir de `.env.example` con la URL y la
   anon key del paso 1. Arranca `npm run dev`, entra a `/register` y crea **tu**
   cuenta de administrador con un correo real (te llegará el correo de
   confirmación de Supabase).
2. Conviértela en administradora, en el SQL Editor:
   ```sql
   update public.users set role = 'admin' where email = 'tu@correo.mx';
   ```
   Debe decir **1 row affected**. Si dice 0, la cuenta no tiene perfil:
   vuelve a ejecutar `scripts/setup_supabase.sql` completo (crea los perfiles
   que falten) y repite el `update`.
3. Carga el catálogo. Dos caminos:
   - **A mano** desde `/dashboard → Productos` (es lo normal con pocas decenas
     de productos; ahí capturas foto, precios, stock, y peso y medidas para el
     envío).
   - **Con el script**, si preparaste `src/data/products.js` con el catálogo
     real: `SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/upload-supabase.js`
     (la service key sólo aquí, en tu terminal).
4. **Authentication → URL Configuration**:
   - **Site URL**: `https://www.thaigersupplements.com` (el dominio final, aunque aún no exista).
   - **Redirect URLs**: añade `https://www.thaigersupplements.com/reset-password` y, para
     probar en local, `http://localhost:5174/reset-password` (el servidor de desarrollo corre en el puerto 5174, ver `vite.config.js`).
   Sin esto, el enlace de "olvidé mi contraseña" no vuelve a la tienda.
5. **Authentication → Emails**: los correos de confirmación y recuperación los
   manda Supabase con su remitente genérico y un límite bajo por hora. Para
   producción, configura **Custom SMTP** con los datos de Resend (paso 8) para
   que salgan desde tu dominio.

## 4. Supabase: las Edge Functions

Necesitas Node instalado. El CLI corre con `npx`, no hay que instalar nada más.

```bash
npx supabase login                       # abre el navegador, autoriza
npx supabase link --project-ref vylqmwzofiybmohgzwum # el ref del paso 1; pide la contraseña de la base

# Secretos: copia la plantilla, rellénala, súbela.
cp supabase/.env.example supabase/.env.functions
#   ...edita supabase/.env.functions (ver qué va en cada uno en la tabla del paso 10)
npx supabase secrets set --env-file supabase/.env.functions

# Despliega las cinco funciones.
npx supabase functions deploy
```

`config.toml` ya dice qué funciones van sin verificación de JWT
(`mp-webhook`, `notificar-pedido`): no hay que tocar nada.

Comprueba en **Edge Functions** del panel que aparecen las cinco. Las URLs
quedan así: `https://vylqmwzofiybmohgzwum.supabase.co/functions/v1/<nombre>`.

Por último, conecta las notificaciones de pedidos (SQL Editor), con el mismo
secreto que pusiste en `NOTIFY_SECRET`:

```sql
select public.configurar_notificaciones(
    'https://vylqmwzofiybmohgzwum.supabase.co/functions/v1/notificar-pedido',
    'el-mismo-valor-de-NOTIFY_SECRET'
);
```

## 5. Cloudflare Pages: la tienda en línea

1. Sube el código a GitHub (rama `main`).
2. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → elige
   el repositorio.
3. Configuración de build:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Environment variables** (Production):
   - `VITE_SUPABASE_URL` = la URL del paso 1
   - `VITE_SUPABASE_ANON_KEY` = la anon key del paso 1
   - `NODE_VERSION` = `22`
5. **Save and Deploy**. En 2–3 minutos tienes `https://thaiger-xxx.pages.dev`.
   Ábrelo: debe cargar la tienda **sin** el aviso de "modo local" en `/login`.
   Si sigue diciendo modo local, las variables no llegaron: revísalas y vuelve
   a desplegar.

Las cabeceras de seguridad y las redirecciones ya van en `public/_headers` y
`public/_redirects`; no hay que configurar nada más.

> **No uses Vercel gratis para esto.** Su plan Hobby prohíbe el uso comercial
> (tiendas, cobros). `vercel.json` se conserva sólo por si algún día contratan
> el plan de pago.

## 6. Dominio

1. `thaigersupplements.com` está registrado en **Alibaba Cloud**, pero el DNS
   lo administra **Cloudflare**: en Cloudflare → *Add a domain* (plan Free) te
   da dos nameservers, y en Alibaba → *Domains → Domain List → Manage → DNS
   Modify* se ponen esos dos en lugar de los de Alibaba. Cuando Cloudflare dice
   **Active**, el dominio ya responde desde ahí.
2. Cloudflare → tu proyecto de Pages → **Custom domains → Set up a custom
   domain** → `www.thaigersupplements.com`. Repite con `thaigersupplements.com`
   (sin `www`). Con el DNS en Cloudflare, crea los registros solo.
3. **Redirige el dominio sin `www` hacia el que lo lleva**: *Rules → Redirect
   Rules → Create rule → plantilla "Redirect from Root to WWW"* (301, conservar
   ruta y parámetros). No es cosmético: las Edge Functions sólo aceptan
   llamadas desde `SITE_URL` (`https://www.thaigersupplements.com`); quien
   entrara sin `www` vería fallar el pago y la cotización por CORS.
4. HTTPS sale solo. Espera a que el estado diga **Active**.
5. Vuelve a **Supabase → Authentication → URL Configuration** y confirma que
   Site URL y las Redirect URLs llevan el dominio real.
6. Actualiza `SITE_URL` en `supabase/.env.functions`, y vuelve a subir los
   secretos (`npx supabase secrets set --env-file ...`).

**Ya puedes vender con SPEI manual.** Entra a `/dashboard → Ajustes`, pon la
cuenta bancaria real, **desmarca "datos de ejemplo"**, pon el contacto real y
la dirección de origen de envíos. Los pasos que siguen añaden la pasarela.

## 7. Mercado Pago: cobrar con tarjeta, SPEI y OXXO

1. Crea la cuenta de Mercado Pago **a nombre del negocio** (persona física
   con actividad empresarial o persona moral). Para pasar a producción te van
   a pedir datos fiscales y bancarios; empieza el trámite hoy.
2. Entra a [mercadopago.com.mx/developers](https://www.mercadopago.com.mx/developers)
   → **Tus integraciones → Crear aplicación**:
   - Nombre: `Tienda Thaiger`
   - Producto: **Pagos online → Checkout Pro**
   - Plataforma: no aplica / propia
3. Dentro de la aplicación, **Credenciales de prueba**: copia el **Access
   Token** de prueba a `MP_ACCESS_TOKEN` en `supabase/.env.functions`.
4. **Webhooks → Configurar notificaciones** (modo de prueba primero):
   - URL: `https://vylqmwzofiybmohgzwum.supabase.co/functions/v1/mp-webhook`
   - Eventos: marca **Pagos**
   - Guarda. Aparece una **Clave secreta**: cópiala a `MP_WEBHOOK_SECRET`.
   - Usa el botón **Simular** de esa pantalla: en Supabase → Edge Functions →
     `mp-webhook` → Logs debe aparecer la llamada con respuesta 200 (o 401 si
     el secreto no coincide: revísalo).
5. `npx supabase secrets set --env-file supabase/.env.functions`
6. En `/dashboard → Ajustes → Pago`, elige **Mercado Pago** y guarda.
7. **Prueba de punta a punta** con las cuentas de prueba de Mercado Pago
   (Tus integraciones → Cuentas de prueba: crea un *comprador* y un
   *vendedor*; las credenciales de prueba del paso 3 deben ser las del
   vendedor de prueba). Compra algo en la tienda con la cuenta de comprador
   de prueba y una [tarjeta de prueba](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards).
   El pedido debe pasar solo a **Pagado** en `/dashboard → Pedidos`.
8. Cuando pasen a producción: **Credenciales de producción** (te las activan
   al completar los datos del negocio), repite el webhook en **modo
   producción** (URL y eventos iguales; nueva clave secreta), actualiza los
   dos secretos y vuelve a subirlos.

Cómo funciona por dentro, para cuando algo falle: el navegador crea el pedido
(`create_order`, en «Pago Pendiente») → llama a `crear-pago`, que arma la
preferencia con los importes del pedido → el cliente paga en Mercado Pago →
Mercado Pago llama a `mp-webhook` → la función verifica la firma, consulta el
pago y llama a `marcar_pedido_pagado`, que exige que el monto coincida con el
total. Si algo no cuadra, el pedido muestra un aviso rojo en el panel en vez
de marcarse como pagado.

## 8. Resend: los correos

1. Cuenta en resend.com → **Domains → Add domain** → `thaigersupplements.com`.
2. Te da 3–4 registros DNS (TXT/MX/CNAME). Crea cada uno en **Cloudflare →
   DNS**. Vuelve a Resend y pulsa **Verify**; puede tardar unos minutos.
3. **API Keys → Create** → cópiala a `RESEND_API_KEY`. Pon `MAIL_FROM` con el
   dominio verificado (`Thaiger Supplements <pedidos@thaigersupplements.com>`) y
   `NOTIFY_ADMIN_EMAIL` con el correo al que quieran que llegue cada pedido.
4. `npx supabase secrets set --env-file supabase/.env.functions`
5. Haz un pedido de prueba: deben llegar dos correos (al cliente y al admin).
   Cambia el estatus desde el panel: llega el aviso. Si no llega nada, revisa
   **Edge Functions → notificar-pedido → Logs**.

Recuerda el límite gratis: **100 correos al día**. Cada pedido gasta dos y
cada cambio de estatus uno.

## 9. Skydropx: cotizar y generar guías (opcional)

Sin este paso la tienda funciona en modo **manual**: cobra el envío fijo de los
ajustes, compras la guía donde quieras (Solo Envíos, la sucursal) y capturas
el número de rastreo en el pedido (`/dashboard → Pedidos → Detalle → Guía`).
El cliente recibe el correo con el rastreo al marcar «Enviado».

Para que el checkout cotice por código postal y el panel genere la guía:

1. Cuenta en pro.skydropx.com. Pide acceso a la **API** y al **sandbox**
   (soporte: hola@skydropx.com). Te dan `Client ID` y `Client Secret` en
   *Conexiones → API*.
2. Ponlos en `SKYDROPX_CLIENT_ID` / `SKYDROPX_CLIENT_SECRET`, y mientras
   pruebas `SKYDROPX_BASE_URL=https://sb-pro.skydropx.com`. Sube los secretos.
3. `/dashboard → Ajustes → Envíos`: paquetería **Skydropx** y la **dirección
   de origen completa** (calle, colonia, ciudad, estado, C.P., teléfono).
4. Revisa que cada producto tenga **peso y medidas** reales (formulario de
   producto, bloque "Paquete"). De ahí sale el paquete que se cotiza.
5. Haz una compra de prueba: al escribir el C.P. deben aparecer las tarifas.

> **Importante:** el adaptador (`supabase/functions/_shared/envios/skydropx.ts`)
> se escribió a partir de la documentación pública, sin credenciales para
> probarlo en vivo. Es probable que la primera respuesta real traiga algún
> nombre de campo distinto. Está diseñado para eso: el mapeo vive en cuatro
> funciones pequeñas al principio del archivo, y la lectura de respuestas busca
> los campos por nombre a cualquier profundidad. Con la primera cotización real
> a la vista, ajustarlo es cosa de minutos. Los logs de `cotizar-envio` enseñan
> la respuesta cruda cuando algo falla.

## 10. Todos los secretos, en un lugar

| Variable | Dónde se consigue | Quién la usa |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API | Cloudflare (build) y tu `.env` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API | Cloudflare (build) y tu `.env` |
| `SITE_URL` | Tu dominio | Edge Functions |
| `MP_ACCESS_TOKEN` | Mercado Pago → tu app → Credenciales | `crear-pago`, `mp-webhook` |
| `MP_WEBHOOK_SECRET` | Mercado Pago → tu app → Webhooks | `mp-webhook` |
| `RESEND_API_KEY` | Resend → API Keys | `notificar-pedido` |
| `MAIL_FROM` | Tú (dominio verificado en Resend) | `notificar-pedido` |
| `NOTIFY_ADMIN_EMAIL` | Tú | `notificar-pedido` |
| `NOTIFY_SECRET` | Tú (`openssl rand -hex 32`) | `notificar-pedido` y `configurar_notificaciones()` |
| `SKYDROPX_CLIENT_ID` / `_SECRET` | Skydropx PRO → Conexiones → API | `cotizar-envio`, `generar-guia` |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API (service_role) | **Sólo** `scripts/` en tu terminal. Nunca en Cloudflare ni en el repo |

Los secretos de las funciones se cambian con
`npx supabase secrets set NOMBRE=valor` (o con `--env-file`) y aplican en el
siguiente request; no hay que volver a desplegar.

## 11. Antes de abrir: la lista

- [ ] `/dashboard → Ajustes`: contacto, cuenta SPEI real y **"datos de ejemplo" desmarcado**, pasarela elegida, dirección de origen.
- [ ] Catálogo real con fotos, stock, peso y medidas. Ni un producto de demostración.
- [ ] Quitar el aviso de demostración del banner (Ajustes → Aviso).
- [ ] Términos, Devoluciones y Quiénes somos con la razón social, RFC, domicilio fiscal, aviso de privacidad y plazos reales. Hoy están redactados como demo (`src/pages/Terms.jsx`, `Refunds.jsx`, `AboutUs.jsx`).
- [ ] Quitar `<meta name="robots" content="noindex, nofollow">` de `index.html`.
- [ ] Mercado Pago en **producción** (credenciales y webhook de producción), no en prueba.
- [ ] Compra real de $50 hecha por ustedes: pedido → pago → correo → «Pagado» solo → guía → «Enviado» → correo con rastreo.
- [ ] Recuperación de contraseña probada con un correo real.
- [ ] Recorrido completo en Chrome de escritorio **y en un celular real**.
- [ ] Copia de seguridad descargada (`/dashboard → Datos`) y guardada fuera.

## 12. Operación diaria

- **Pedidos SPEI**: alguien revisa el banco y cambia el estatus a «Pagado» en el panel (el correo al cliente sale solo).
- **Pedidos Mercado Pago**: se marcan solos. Si un pedido muestra un aviso rojo ("Revisar: el monto no coincide…"), es un pago que no cuadra: revisar en el panel de Mercado Pago antes de enviar.
- **Envíos**: Detalle del pedido → Guía → generar o capturar → marcar «Enviado».
- **Respaldo semanal** mientras estén en el plan gratis.
- **Logs**: Supabase → Edge Functions → la función → Logs. Ahí sale exactamente qué respondió Mercado Pago, Resend o Skydropx cuando algo falla.

## 13. Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `/login` dice "modo local" en producción | Cloudflare no tiene las variables `VITE_*` | Añadirlas y volver a desplegar |
| "Necesitas iniciar sesión" al pagar aunque estés dentro | El JWT no llega a la función (dominio distinto al de Site URL) | Revisar `SITE_URL` y el CORS; probar desde el dominio real |
| El pedido no pasa a Pagado tras pagar | El webhook no está configurado, apunta a otra URL o el secreto no coincide | Simular desde Mercado Pago y mirar los logs de `mp-webhook` |
| Aviso rojo "el monto no coincide" | Se cambió el total del pedido después de crear la preferencia, o pago parcial | Revisar en Mercado Pago; nunca marcar a mano sin comprobar |
| No llegan correos | Dominio sin verificar en Resend, o `MAIL_FROM` con otro dominio | Resend → Domains; logs de `notificar-pedido` |
| Los correos de Supabase (confirmar cuenta) no llegan | Límite del remitente por defecto | Configurar Custom SMTP con Resend |
| "Cotización caducó" al confirmar | El cliente tardó más de 12 h con el checkout abierto | Volver a escribir el C.P. cotiza de nuevo |
| El enlace de recuperar contraseña no vuelve a la tienda | Falta la Redirect URL en Supabase | Authentication → URL Configuration |
