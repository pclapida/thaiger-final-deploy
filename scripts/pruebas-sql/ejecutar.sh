#!/usr/bin/env bash
#
# Levanta un Postgres desechable, aplica el esquema real de Supabase y corre
# las pruebas de create_order(). Ver README.md de esta carpeta.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"

# El socket de Postgres no admite rutas largas (107 bytes), de ahí lo corto.
BASE="${BASE_PRUEBAS:-/tmp/thaiger-pg}"
PUERTO="${PUERTO_PRUEBAS:-55432}"
export PATH="/usr/lib/postgresql/16/bin:$PATH"

psql_() { psql -h 127.0.0.1 -p "$PUERTO" -U postgres "$@"; }

limpiar() {
  # El servidor corre como postgres cuando somos root: hay que pararlo igual.
  if [ "$(id -u)" -eq 0 ]; then
    su postgres -c "PATH=$PATH pg_ctl -D $BASE/data stop -m immediate" >/dev/null 2>&1 || true
  else
    pg_ctl -D "$BASE/data" stop -m immediate >/dev/null 2>&1 || true
  fi
  rm -rf "$BASE"
}
trap limpiar EXIT

echo "==> Levantando Postgres en $BASE"
rm -rf "$BASE"; mkdir -p "$BASE"
# initdb se niega a correr como root; si lo somos, se delega en el usuario postgres.
if [ "$(id -u)" -eq 0 ]; then
  chown postgres "$BASE"
  su postgres -c "PATH=$PATH initdb -D $BASE/data -U postgres --auth=trust" >/dev/null
  su postgres -c "PATH=$PATH pg_ctl -D $BASE/data -l $BASE/pg.log -o '-p $PUERTO -k $BASE -c listen_addresses=127.0.0.1' start" >/dev/null
else
  initdb -D "$BASE/data" -U postgres --auth=trust >/dev/null
  pg_ctl -D "$BASE/data" -l "$BASE/pg.log" -o "-p $PUERTO -k $BASE -c listen_addresses=127.0.0.1" start >/dev/null
fi
sleep 2

echo "==> Aplicando el esquema"
psql_ -v ON_ERROR_STOP=1 -q -f "$AQUI/00-stub-supabase.sql"
psql_ -v ON_ERROR_STOP=1 -q -f "$RAIZ/scripts/setup_supabase.sql" 2>&1 | grep -i "^ERROR" && exit 1
psql_ -q -c "create schema if not exists pruebas;"
psql_ -v ON_ERROR_STOP=1 -q -f "$AQUI/10-datos.sql"

echo "==> Perfiles y roles"
psql_ -v ON_ERROR_STOP=1 -q -f "$AQUI/15-perfiles.sql" 2>&1 | sed 's/.*NOTICE:  //'

echo "==> create_order()"
psql_ -v ON_ERROR_STOP=1 -q -f "$AQUI/20-create-order.sql" 2>&1 | sed 's/.*NOTICE:  //'

echo "==> Pagos, cotizaciones de envío y notificaciones"
psql_ -v ON_ERROR_STOP=1 -q -f "$AQUI/25-pagos-envios.sql" 2>&1 | sed 's/.*NOTICE:  //'

echo "==> Seguridad"
psql_ -q -c "insert into storage.buckets (id,name,public) values ('avatars','avatars',true) on conflict do nothing;" >/dev/null
psql_ -v ON_ERROR_STOP=1 -q -f "$AQUI/30-seguridad.sql" 2>&1 | grep -v "^ \|^-\|(1 row)\|set_config" | sed 's/.*NOTICE:  //'

echo "==> Paridad con src/lib/pricing.js"
SCRATCH="$BASE" node "$AQUI/40-paridad.mjs"

echo "==> Carrera por la última unidad (20 compradores, 5 unidades)"
psql_ -q -c "truncate public.order_items, public.orders cascade;
             update public.products set stock = 0;
             update public.products set stock = 5 where id = 1;" >/dev/null

comprar() {
  psql -h 127.0.0.1 -p "$PUERTO" -U postgres -tA \
    -c "select set_config('test.uid','11111111-1111-1111-1111-111111111111',false)" \
    -c "select public.create_order('[{\"product_id\":1,\"quantity\":1}]'::jsonb,
          '{\"fullName\":\"Juan\",\"phone\":\"5512345678\",\"address\":\"Av. Demo 123\",\"city\":\"CDMX\",\"zip\":\"01000\"}'::jsonb,
          '{}'::jsonb)" >/dev/null 2>&1 && echo "OK" || echo "RECHAZADO"
}

for _ in $(seq 1 20); do comprar & done > "$BASE/carrera.txt" 2>/dev/null
wait
ACEPTADAS=$(grep -c OK "$BASE/carrera.txt" || true)
STOCK=$(psql_ -tA -c "select stock from public.products where id = 1")
VENDIDAS=$(psql_ -tA -c "select coalesce(sum(quantity),0) from public.order_items")

if [ "$ACEPTADAS" = "5" ] && [ "$STOCK" = "0" ] && [ "$VENDIDAS" = "5" ]; then
  echo "  ok   5 aceptadas de 20, stock 0, 5 unidades vendidas: sin sobreventa"
else
  echo "  FALLA: aceptadas=$ACEPTADAS stock=$STOCK vendidas=$VENDIDAS"
  exit 1
fi

echo
echo "Todo en orden."
