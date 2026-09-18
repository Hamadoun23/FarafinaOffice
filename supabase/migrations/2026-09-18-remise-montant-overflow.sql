-- =============================================================
--  Remise en montant : depassement au-dela de 999,99 — 18 septembre 2026
--
--  invoice_items.discount est reste en numeric(5,2) (max 999,99) apres
--  l'ajout de la remise en montant fixe (migration du 29 aout) : ca
--  suffisait pour un pourcentage (0-100) mais pas pour un montant retire
--  directement dans une devise ou les totaux se comptent en milliers
--  (FCFA). Au-dela de 999,99, Postgres refusait la ligne entiere avec
--  "numeric field overflow", meme quand le reste de la facture etait
--  correct — d'ou l'echec a l'enregistrement.
--
--  On aligne discount sur rate/qty/paid_amount : numeric(12,2). La
--  contrainte qui plafonne les remises en pourcentage a 100 (elle) ne
--  change pas — un pourcentage reste un pourcentage.
--
--  Relancable sans risque.
-- =============================================================

alter table public.invoice_items alter column discount type numeric(12,2);

comment on column public.invoice_items.discount is
  'Remise de la ligne : un pourcentage (0-100) ou un montant retire directement, selon discount_type. numeric(12,2) depuis le 18/09/2026 (etait numeric(5,2), trop etroit pour un montant fixe au-dela de 999,99).';
