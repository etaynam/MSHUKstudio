create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  logo_url text,
  brand_color text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  barcode text,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.product_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  version_label text,
  file_type text not null,
  original_filename text,
  cloudinary_public_id text not null,
  cloudinary_url text not null,
  png_public_id text,
  png_url text,
  file_size bigint,
  width int,
  height int,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.product_assets enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger trg_suppliers_updated_at
before update on public.suppliers
for each row execute procedure public.set_updated_at();

create trigger trg_products_updated_at
before update on public.products
for each row execute procedure public.set_updated_at();

create policy "Profiles can read suppliers"
on public.suppliers
for select
using (auth.uid() is not null);

create policy "Admins manage suppliers"
on public.suppliers
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "Profiles can read products"
on public.products
for select
using (auth.uid() is not null);

create policy "Admins manage products"
on public.products
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "Profiles can read assets"
on public.product_assets
for select
using (auth.uid() is not null);

create policy "Admins manage assets"
on public.product_assets
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- helpful indexes
create index if not exists idx_products_supplier_id on public.products (supplier_id);
create index if not exists idx_product_assets_product_id on public.product_assets (product_id);
create index if not exists idx_product_assets_public_id on public.product_assets (cloudinary_public_id);

