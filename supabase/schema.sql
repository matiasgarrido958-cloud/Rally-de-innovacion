-- Tabla usada por el Workspace del Rally Latinoamericano de Innovación 2026.
-- Ejecutar en Supabase: Dashboard → SQL Editor → New query → Run.
-- Es idempotente: se puede ejecutar de nuevo sin perder datos.
--
-- A diferencia de Fast Check (una columna por campo), aquí hay UNA sola tabla
-- genérica: cada fila es un elemento del workspace (idea, tarea, integrante,
-- decisión, reunión, casilla de checklist o ajuste) y sus campos van en `data`.
-- Así se pueden agregar campos desde js/ sin migraciones durante las 28 horas,
-- y la sincronización es una sola consulta.

create table if not exists public.rally_items (
    id          text primary key,             -- I-01, T-01, D1, M-xxxx, B-xxxx, chk:xxx, set:xxx
    kind        text not null check (kind in ('idea', 'task', 'member', 'decision', 'meeting', 'check', 'setting')),
    data        jsonb       not null default '{}'::jsonb,
    position    integer     not null default 0,
    updated_by  text        default 'Equipo',
    updated_at  timestamptz default now()
);

create index if not exists rally_items_kind_idx on public.rally_items (kind);

-- Row Level Security: solo usuarios con sesión iniciada (Supabase Auth)
-- pueden leer y escribir. Sin sesión, la API no devuelve nada.
alter table public.rally_items enable row level security;

drop policy if exists "rally_items_select" on public.rally_items;
drop policy if exists "rally_items_insert" on public.rally_items;
drop policy if exists "rally_items_update" on public.rally_items;
drop policy if exists "rally_items_delete" on public.rally_items;

create policy "rally_items_select" on public.rally_items for select to authenticated using (true);
create policy "rally_items_insert" on public.rally_items for insert to authenticated with check (true);
create policy "rally_items_update" on public.rally_items for update to authenticated using (true) with check (true);
create policy "rally_items_delete" on public.rally_items for delete to authenticated using (true);

-- Avisa a la API de Supabase que recargue la estructura de las tablas.
notify pgrst, 'reload schema';

-- Verificación: cuántos elementos hay de cada tipo.
select kind, count(*) from public.rally_items group by kind order by kind;
