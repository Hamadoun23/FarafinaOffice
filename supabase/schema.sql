-- =============================================================
--  FarafinaOffice — schéma Supabase (PostgreSQL)
--  Back-office de Farafinatignɛ : contenus, catalogue, clients,
--  commandes, devis et relances.
--
--  À exécuter une fois dans l'éditeur SQL du projet Supabase.
--  Idempotent : relançable sans casse.
-- =============================================================

-- ---------- extensions ----------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================
--  1. CONTENUS ÉDITABLES
--  Chaque texte du site vitrine est une ligne, repérée par la clé
--  déjà utilisée dans js/i18n.js (ex. "hero.title1"). Le site lit
--  cette table au chargement ; le back-office l'édite.
-- =============================================================
create table if not exists public.contents (
  key         text primary key,
  fr          text not null default '',
  en          text not null default '',
  section     text,                        -- regroupement pour l'interface
  help        text,                        -- note à l'attention de l'éditeur
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);
comment on table public.contents is
  'Textes du site vitrine, une ligne par clé i18n. Modifiable depuis le back-office.';

-- =============================================================
--  2. CATALOGUE
-- =============================================================
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,        -- bijoux | textile | decor
  fr_name     text not null,
  en_name     text not null,
  description_fr text default '',
  description_en text default '',
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  slug        text not null,               -- colliers | bracelets | ...
  fr_name     text not null,
  en_name     text not null,
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (category_id, slug)
);

create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  ref            text unique not null,     -- FT-BJ-001
  slug           text unique not null,
  category_id    uuid not null references public.categories(id) on delete restrict,
  subcategory_id uuid references public.subcategories(id) on delete set null,

  fr_name        text not null,
  fr_desc        text not null default '',
  en_name        text not null,
  en_desc        text not null default '',

  -- prix de gros en euros ; NULL = « prix sur demande »
  price          numeric(10,2),
  price_from     boolean not null default false,   -- affiche « à partir de »
  unit           text    not null default 'piece', -- piece | pair | lot
  set_qty        int,                              -- quantité si vendu par lot
  sizes          text,                             -- ex. « XXS → XXL »

  -- promotion : une remise en pourcentage posée par-dessus le prix de gros,
  -- qui s'arrête d'elle-même à la date de fin (voir migrations/2026-08-23)
  discount_percent int  not null default 0 check (discount_percent between 0 and 90),
  discount_until   date,

  tag            text,                    -- signature | best | gros | piece-speciale | nouveau
  image_path     text,                    -- chemin dans le bucket product-images
  is_published   boolean not null default true,
  position       int     not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on column public.products.price is
  'Prix de gros unitaire en euros. NULL affiche « prix sur demande » sur le site.';

-- photos secondaires d'une référence
create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path       text not null,
  alt        text default '',
  position   int  not null default 0
);

create index if not exists products_category_idx    on public.products(category_id);
create index if not exists products_subcategory_idx on public.products(subcategory_id);
create index if not exists products_published_idx   on public.products(is_published);

-- =============================================================
--  3. CLIENTS
--  Alimentée par trois voies : téléchargement du catalogue PDF,
--  formulaire de contact, demande de devis.
-- =============================================================
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  company     text,
  email       text,
  phone       text,
  country     text,
  lang        text default 'fr',
  source      text not null default 'contact',  -- catalogue | contact | devis
  notes       text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists customers_email_idx
  on public.customers (lower(email)) where email is not null;

-- =============================================================
--  4. COMMANDES (demandes de devis)
-- =============================================================
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  number        bigint generated always as identity,  -- numéro lisible
  customer_id   uuid references public.customers(id) on delete set null,
  status        text not null default 'nouveau',
    -- nouveau | devis_envoye | confirme | paye | expedie | annule
  channel       text not null default 'whatsapp',     -- whatsapp | email | site
  lang          text default 'fr',
  total_estimate numeric(10,2) not null default 0,
  message       text default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  -- on fige la référence, le nom et le prix au moment de la commande :
  -- le catalogue évolue, la commande ne doit pas changer rétroactivement
  ref         text not null,
  name        text not null,
  qty         int  not null check (qty > 0),
  unit_price  numeric(10,2)
);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists orders_status_idx     on public.orders(status);

-- =============================================================
--  5. DEVIS / FACTURES PROFORMA
-- =============================================================
create table if not exists public.quotes (
  id            uuid primary key default gen_random_uuid(),
  number        bigint generated always as identity,
  order_id      uuid references public.orders(id) on delete set null,
  customer_id   uuid references public.customers(id) on delete set null,
  amount        numeric(10,2) not null default 0,
  shipping_cost numeric(10,2) not null default 0,
  currency      text not null default 'EUR',
  status        text not null default 'brouillon',  -- brouillon | envoye | accepte | refuse | expire
  valid_until   date,
  pdf_path      text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- =============================================================
--  6. RELANCES
-- =============================================================
create table if not exists public.follow_ups (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete cascade,
  channel     text not null default 'whatsapp',   -- whatsapp | email | appel
  note        text default '',
  due_at      timestamptz,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists follow_ups_due_idx on public.follow_ups(due_at) where done_at is null;

-- =============================================================
--  7. PROSPECTS DU CATALOGUE PDF
-- =============================================================
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  company    text,
  country    text,
  lang       text default 'fr',
  created_at timestamptz not null default now()
);

-- =============================================================
--  8. HORODATAGE AUTOMATIQUE
-- =============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['contents','products','customers','orders','quotes'] loop
    execute format(
      'drop trigger if exists trg_touch_%1$s on public.%1$s;
       create trigger trg_touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- =============================================================
--  9. SÉCURITÉ (RLS)
--  Le site vitrine utilise la clé « anon » : il ne doit voir que
--  le catalogue publié et les textes, et ne peut rien modifier.
--  Tout le reste exige un compte authentifié (l'équipe).
-- =============================================================
alter table public.contents       enable row level security;
alter table public.categories     enable row level security;
alter table public.subcategories  enable row level security;
alter table public.products       enable row level security;
alter table public.product_images enable row level security;
alter table public.customers      enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.quotes         enable row level security;
alter table public.follow_ups     enable row level security;
alter table public.leads          enable row level security;

-- --- lecture publique : uniquement ce qui s'affiche sur le site ---
drop policy if exists "lecture publique contenus" on public.contents;
create policy "lecture publique contenus"
  on public.contents for select to anon, authenticated using (true);

drop policy if exists "lecture publique categories" on public.categories;
create policy "lecture publique categories"
  on public.categories for select to anon, authenticated using (true);

drop policy if exists "lecture publique sous-categories" on public.subcategories;
create policy "lecture publique sous-categories"
  on public.subcategories for select to anon, authenticated using (true);

drop policy if exists "lecture publique produits publies" on public.products;
create policy "lecture publique produits publies"
  on public.products for select to anon, authenticated using (is_published);

drop policy if exists "lecture publique photos" on public.product_images;
create policy "lecture publique photos"
  on public.product_images for select to anon, authenticated using (true);

-- --- écriture publique : seulement déposer un prospect ou une demande ---
drop policy if exists "depot prospect" on public.leads;
create policy "depot prospect"
  on public.leads for insert to anon, authenticated with check (true);

-- --- tout le reste : équipe authentifiée uniquement ---
do $$
declare t text;
begin
  foreach t in array array['contents','categories','subcategories','products',
                           'product_images','customers','orders','order_items',
                           'quotes','follow_ups','leads'] loop
    execute format(
      'drop policy if exists "acces equipe %1$s" on public.%1$s;
       create policy "acces equipe %1$s" on public.%1$s
       for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- =============================================================
--  10. TEMPS RÉEL
--  Le tableau de bord s'actualise sans rechargement.
-- =============================================================
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Ajout relançable : « add table » échoue si la table est déjà publiée.
do $$
declare t text;
begin
  foreach t in array array['orders','order_items','customers','leads','quotes','follow_ups'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- =============================================================
--  11. STOCKAGE DES IMAGES
--  Bucket public en lecture, dépôt réservé à l'équipe.
-- =============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "lecture publique images" on storage.objects;
create policy "lecture publique images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');

drop policy if exists "depot images equipe" on storage.objects;
create policy "depot images equipe" on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
