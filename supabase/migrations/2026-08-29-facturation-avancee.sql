-- =============================================================
--  Facturation avancée — 29 août 2026
--
--  Quatre demandes du client, réunies dans une seule migration :
--
--  1. Le catalogue PDF redemande un nom et un contact avant le
--     téléchargement (téléphone OU e-mail, l'un des deux suffit).
--     La table `leads` exigeait un e-mail : elle accepte maintenant
--     aussi un téléphone seul.
--  2. Chaque client a désormais une référence lisible (CL0001, CL0002…)
--     pour le retrouver vite, au téléphone ou sur un document.
--  3. La remise d'une ligne de facture savait dire un pourcentage.
--     Elle sait maintenant aussi dire un montant retiré directement
--     (« -2000 F » sans faire le calcul en pourcentage).
--
--  Relançable sans risque.
-- =============================================================

-- =============================================================
--  1. PROSPECTS DU CATALOGUE — téléphone ou e-mail
-- =============================================================
alter table public.leads add column if not exists phone text;
alter table public.leads alter column email drop not null;

alter table public.leads drop constraint if exists leads_contact_requis;
alter table public.leads add constraint leads_contact_requis
  check (coalesce(trim(email), '') <> '' or coalesce(trim(phone), '') <> '');

comment on column public.leads.phone is
  'Téléphone du prospect. E-mail et téléphone sont tous deux facultatifs à eux seuls : l''un des deux est exigé par la contrainte leads_contact_requis.';

-- =============================================================
--  2. RÉFÉRENCE CLIENT AUTOMATIQUE
--  Un compteur propre à la table, jamais réattribué (comme pour les
--  numéros de facture) : CL0001, CL0002… La colonne se calcule seule,
--  aucune saisie possible.
-- =============================================================
alter table public.customers add column if not exists client_number bigint generated always as identity;
alter table public.customers add column if not exists reference text
  generated always as ('CL' || lpad(client_number::text, 4, '0')) stored;

create unique index if not exists customers_reference_idx on public.customers(reference);

comment on column public.customers.reference is
  'Référence lisible du client (CL0001…), calculée depuis client_number. Sert à l''identifier vite, au téléphone ou sur une facture.';

-- =============================================================
--  3. REMISE EN MONTANT, EN PLUS DU POURCENTAGE
--  `discount` reste le nombre saisi ; `discount_type` dit comment le
--  lire. En pourcentage par défaut, pour ne rien changer aux factures
--  déjà enregistrées.
-- =============================================================
alter table public.invoice_items add column if not exists discount_type text not null default 'percent';

alter table public.invoice_items drop constraint if exists invoice_items_discount_type_check;
alter table public.invoice_items add constraint invoice_items_discount_type_check
  check (discount_type in ('percent', 'amount'));

alter table public.invoice_items drop constraint if exists invoice_items_discount_percent_check;
alter table public.invoice_items add constraint invoice_items_discount_percent_check
  check (discount_type <> 'percent' or discount <= 100);

comment on column public.invoice_items.discount_type is
  'percent : discount est un pourcentage (comme avant). amount : discount est un montant retiré directement, dans la devise de la facture.';
