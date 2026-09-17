# Pruebas del esquema de Supabase

`scripts/setup_supabase.sql` dejó de ser sólo un esquema: desde que
`create_order()` calcula los precios, **es la frontera de seguridad del cobro**.
Estas pruebas la ejecutan de verdad contra un Postgres local.

Se corren a mano (todavía no están en CI: haría falta un *service container* de
Postgres en `.github/workflows/ci.yml`). Vale la pena correrlas cada vez que se
toque el SQL, `src/lib/pricing.js` o los umbrales de precio.

## Cómo

Hace falta `postgresql` instalado (`psql`, `initdb`, `pg_ctl`) y Node.

```bash
./scripts/pruebas-sql/ejecutar.sh
```

## Qué comprueban

| Archivo | Comprueba |
|---|---|
| `00-stub-supabase.sql` | Remedo de lo que Supabase da por hecho: `auth.uid()`, `storage.objects`, los roles `anon`/`authenticated`. |
| `10-datos.sql` | Catálogo y cuentas mínimas para las pruebas. |
| `20-create-order.sql` | Niveles de precio, ofertas, envío, estatus fijado por el servidor, descuento de inventario, y todo lo que debe rechazar sin dejar pedidos a medias. |
| `30-seguridad.sql` | Que un cliente **no** pueda insertar un pedido de $1 «Pagado», tocar precios, subir al bucket del catálogo ni escribir en el avatar de otra persona. Y que `anon` no pueda ejecutar `create_order`. |
| `40-paridad.mjs` | 300 carritos al azar sobre el catálogo real: el total de `computeCartTotals()` tiene que ser **idéntico** al de `create_order()`. Aquí se cazó una diferencia de un centavo entre la coma flotante de JavaScript y el `numeric` de Postgres. |

La carrera por el inventario (20 compradores simultáneos, 5 unidades) va dentro
de `ejecutar.sh`, porque necesita procesos de verdad en paralelo.
