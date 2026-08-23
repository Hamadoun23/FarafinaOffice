-- =============================================================
--  Facturation et réglages — 23 août 2026
--
--  Le back-office savait suivre des devis (montant global, port).
--  Il lui manquait la facture telle que la maison l'établit : un
--  en-tête d'entreprise, un client facturé, des lignes avec prix
--  unitaire, quantité et remise, un total et un solde dû.
--
--  Deux tables de plus, et une table de réglages pour que l'en-tête
--  de facture se modifie depuis l'écran Réglages, sans toucher au code.
--
--  Relançable sans risque.
-- =============================================================

-- =============================================================
--  1. RÉGLAGES
--  Une ligne par réglage : coordonnées de la maison, mentions de
--  bas de facture, préfixe de numérotation, devise par défaut.
-- =============================================================
create table if not exists public.settings (
  key        text primary key,
  value      text not null default '',
  label      text,                       -- libellé montré dans l'écran
  groupe     text not null default 'societe',
  position   int  not null default 0,
  updated_at timestamptz not null default now()
);
comment on table public.settings is
  'Réglages modifiables par l''équipe : en-tête de facture, mentions, numérotation.';

insert into public.settings (key, value, label, groupe, position) values
  ('societe.nom',        'FARAFINATIGNE',                          'Nom commercial',        'societe', 1),
  ('societe.contact',    'Issouf Cissé',                           'Interlocuteur',         'societe', 2),
  ('societe.registre',   '(223) 65450202',                         'Numéro d''entreprise',  'societe', 3),
  ('societe.pays',       'Mali Afrique occidentale',               'Pays',                  'societe', 4),
  ('societe.bp',         'BP : 65 Sevare ( Mopti - Mali )',        'Boîte postale',         'societe', 5),
  ('societe.adresse',    'Immeuble Farafinatigne porte 2387 Rn6 Sevare Mopti Mali', 'Adresse', 'societe', 6),
  ('societe.tel1',       '(223) 76870695',                         'Téléphone',             'societe', 7),
  ('societe.tel2',       '(223) 65450202',                         'Second téléphone',      'societe', 8),
  ('societe.site',       'www.farafinatigne.com',                  'Site web',              'societe', 9),
  ('societe.email',      'farafinatigne@gmail.com',                'E-mail',                'societe', 10),
  ('societe.logo',       '',                                       'Logo (URL)',            'societe', 11),
  ('facture.prefixe',    'INV',                                    'Préfixe des numéros',   'facture', 1),
  ('facture.devise',     'USD',                                    'Devise par défaut',     'facture', 2),
  ('facture.echeance',   '0',                                      'Délai de paiement (jours)', 'facture', 3),
  ('facture.merci',      'Thanks for your business!',              'Mot de bas de page',    'facture', 4),
  ('facture.mentions',   '',                                       'Mentions légales',      'facture', 5)
on conflict (key) do nothing;

-- =============================================================
--  2. FACTURES
-- =============================================================
create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  number        bigint generated always as identity,
  customer_id   uuid references public.customers(id) on delete set null,
  order_id      uuid references public.orders(id)    on delete set null,
  quote_id      uuid references public.quotes(id)    on delete set null,

  -- le client peut être saisi à la volée, sans fiche : une facture
  -- ne doit jamais être bloquée par la base clients
  bill_to       text not null default '',
  bill_phone    text,
  bill_email    text,
  bill_address  text,

  issue_date    date not null default current_date,
  due_date      date,
  currency      text not null default 'USD',
  status        text not null default 'brouillon',
    -- brouillon | envoyee | payee | partielle | annulee
  paid_amount   numeric(12,2) not null default 0,
  note          text default '',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists invoices_customer_idx on public.invoices(customer_id);
create index if not exists invoices_status_idx   on public.invoices(status);

comment on column public.invoices.paid_amount is
  'Montant déjà réglé. Le solde dû se calcule : total des lignes moins ce montant.';

-- =============================================================
--  3. LIGNES DE FACTURE
--  On fige la désignation et le prix : le catalogue évolue, une
--  facture émise ne doit jamais changer rétroactivement.
-- =============================================================
create table if not exists public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  description text not null default '',
  rate        numeric(12,2) not null default 0,
  qty         numeric(12,2) not null default 1,
  discount    numeric(5,2)  not null default 0,   -- en pourcentage
  position    int not null default 0
);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);

-- =============================================================
--  4. HORODATAGE
-- =============================================================
do $$
declare t text;
begin
  foreach t in array array['invoices','settings'] loop
    execute format(
      'drop trigger if exists trg_touch_%1$s on public.%1$s;
       create trigger trg_touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- =============================================================
--  5. SÉCURITÉ
--  Rien de tout cela n'est public : ni les factures, ni les
--  coordonnées de facturation, ni les réglages.
-- =============================================================
alter table public.settings      enable row level security;
alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','invoices','invoice_items'] loop
    execute format(
      'drop policy if exists "acces equipe %1$s" on public.%1$s;
       create policy "acces equipe %1$s" on public.%1$s
       for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- =============================================================
--  6. TEMPS RÉEL
-- =============================================================
do $$
declare t text;
begin
  foreach t in array array['invoices','invoice_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
