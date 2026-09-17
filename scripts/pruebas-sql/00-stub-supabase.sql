-- Remedo mínimo de lo que Supabase da por hecho, para poder ejecutar el
-- esquema real en un Postgres pelón y probarlo.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema if not exists auth;
create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    created_at timestamptz not null default now()
);

-- auth.uid() en Supabase lee el JWT; aquí lo leemos de una variable de sesión.
create or replace function auth.uid() returns uuid
language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid;
$$;

create schema if not exists storage;
create table storage.buckets (
    id text primary key,
    name text,
    public boolean default false
);
create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

grant usage on schema public, auth, storage to anon, authenticated;
