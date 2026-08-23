-- =============================================================
--  Promotions sur le catalogue — 23 août 2026
--
--  L'équipe applique une remise en pourcentage sur les références
--  de son choix, depuis le back-office, sans toucher aux prix.
--  Le prix de gros reste la vérité ; la remise s'applique par-dessus
--  et s'arrête toute seule à la date de fin.
--
--  Relançable sans risque.
-- =============================================================

alter table public.products
  add column if not exists discount_percent int not null default 0;

alter table public.products
  add column if not exists discount_until date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_discount_percent_check'
  ) then
    alter table public.products
      add constraint products_discount_percent_check
      check (discount_percent >= 0 and discount_percent <= 90);
  end if;
end $$;

comment on column public.products.discount_percent is
  'Remise en pourcentage appliquée au prix de gros. 0 = pas de promotion.';
comment on column public.products.discount_until is
  'Dernier jour de la promotion. NULL = sans date de fin. Passée cette date, le site réaffiche le prix plein.';

-- Le site ne lit que les produits publiés : la remise y est visible
-- immédiatement, sans redéploiement.
create index if not exists products_discount_idx
  on public.products (discount_percent) where discount_percent > 0;
