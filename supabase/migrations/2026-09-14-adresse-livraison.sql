-- =============================================================
--  Facture : pays separe, adresse de livraison — 14 septembre 2026
--
--  "Adresse / pays" etait un seul champ libre. On le separe en deux
--  (bill_address reste l'adresse, bill_country devient le pays), et on
--  ajoute une adresse de livraison distincte — colis et facture ne
--  vont pas toujours au meme endroit.
--
--  Relancable sans risque.
-- =============================================================

alter table public.invoices add column if not exists bill_country text;
alter table public.invoices add column if not exists shipping_address text;

comment on column public.invoices.bill_country is
  'Pays de facturation, separe de bill_address depuis le 14/09/2026.';
comment on column public.invoices.shipping_address is
  'Adresse de livraison, si differente de l''adresse de facturation.';
