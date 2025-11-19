-- Campaigns & platform settings schema

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'admin'
    ),
    false
  );
$$;

create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  inserted_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

create policy "Admins manage platform settings"
  on public.platform_settings
  for all
  using (is_admin())
  with check (is_admin());

comment on table public.platform_settings is 'Key/value storage for global settings such as Abyssale API keys.';

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  template_id text not null,
  selected_fields jsonb not null default '[]'::jsonb,
  selected_layouts jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  source text not null default 'manual',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_created_by_idx on public.campaigns (created_by);

alter table public.campaigns enable row level security;

create policy "Users can manage their campaigns"
  on public.campaigns
  for all
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Admins manage all campaigns"
  on public.campaigns
  for all
  using (is_admin())
  with check (is_admin());

create table if not exists public.campaign_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  barcode text,
  layout_id text,
  payload jsonb,
  status text not null default 'pending',
  image_url text,
  error_message text,
  row_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_items_campaign_id_idx on public.campaign_items (campaign_id);

alter table public.campaign_items enable row level security;

create policy "Users can manage their campaign items"
  on public.campaign_items
  for all
  using (
    campaign_id in (
      select id from public.campaigns where created_by = auth.uid()
    )
  )
  with check (
    campaign_id in (
      select id from public.campaigns where created_by = auth.uid()
    )
  );

create policy "Admins manage all campaign items"
  on public.campaign_items
  for all
  using (is_admin())
  with check (is_admin());

