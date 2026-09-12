-- ============================================================
-- CotizaYa · Esquema Supabase (fase 1: backend en la nube)
-- Cómo usar: Supabase Dashboard → SQL Editor → New query,
-- pegar todo este archivo → Run.
-- Es re-ejecutable: si algo ya existe, lo salta o lo recrea.
-- ============================================================

-- ---------- Tablas ----------

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null default '',
  descripcion text not null default '',
  ruc text not null default '',
  telefono text not null default '',
  email text not null default '',
  direccion text not null default '',
  logo_url text not null default '',
  color text not null default '#059669',
  iva_default text not null default 'incl10',
  validez_dias integer not null default 15,
  condiciones text not null default 'Precios en Guaraníes. Forma de pago a convenir.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  folio integer not null,
  fecha timestamptz not null default now(),
  cliente_nombre text not null default '',
  cliente_ruc text not null default '',
  cliente_telefono text not null default '',
  items jsonb not null default '[]'::jsonb,
  descuento_tipo text not null default 'pct',
  descuento_valor numeric not null default 0,
  iva_mode text not null default 'incl10',
  validez_dias integer not null default 0,
  notas text not null default '',
  total numeric not null default 0,
  status text not null default 'borrador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, folio)
);

create index if not exists quotes_user_created_idx
  on public.quotes (user_id, created_at desc);

create table if not exists public.item_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  descripcion text not null default '',
  cantidad numeric not null default 0,
  precio numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.folio_counters (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_folio integer not null default 0
);

-- ---------- Folio transaccional por usuario ----------

create or replace function public.next_folio()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
begin
  insert into public.folio_counters (user_id, last_folio)
  values (auth.uid(), 1)
  on conflict (user_id)
  do update set last_folio = public.folio_counters.last_folio + 1
  returning last_folio into v;
  return v;
end;
$$;

-- ---------- updated_at automático ----------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_companies_touch on public.companies;
create trigger trg_companies_touch
  before update on public.companies
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_quotes_touch on public.quotes;
create trigger trg_quotes_touch
  before update on public.quotes
  for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ----------

alter table public.companies enable row level security;
alter table public.quotes enable row level security;
alter table public.item_templates enable row level security;
alter table public.folio_counters enable row level security;

drop policy if exists "own company" on public.companies;
create policy "own company" on public.companies
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own quotes" on public.quotes;
create policy "own quotes" on public.quotes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own templates" on public.item_templates;
create policy "own templates" on public.item_templates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own counter" on public.folio_counters;
create policy "own counter" on public.folio_counters
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant execute on function public.next_folio() to authenticated;

-- ---------- Storage: bucket de logos ----------

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "public read logos" on storage.objects;
create policy "public read logos" on storage.objects
  for select
  using (bucket_id = 'logos');

drop policy if exists "auth write logos" on storage.objects;
create policy "auth write logos" on storage.objects
  for insert
  with check (bucket_id = 'logos' and auth.role() = 'authenticated');

drop policy if exists "auth update logos" on storage.objects;
create policy "auth update logos" on storage.objects
  for update
  using (bucket_id = 'logos' and auth.role() = 'authenticated')
  with check (bucket_id = 'logos' and auth.role() = 'authenticated');

drop policy if exists "auth delete logos" on storage.objects;
create policy "auth delete logos" on storage.objects
  for delete
  using (bucket_id = 'logos' and auth.role() = 'authenticated');
