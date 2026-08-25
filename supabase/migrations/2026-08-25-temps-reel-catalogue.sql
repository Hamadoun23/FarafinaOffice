-- =============================================================
--  Temps réel du catalogue — 25 août 2026
--
--  Le back-office s'abonne aux changements pour rafraîchir ses
--  listes toutes seules. Or la publication ne contenait que les
--  tables commerciales : modifier un produit, une photo ou un
--  texte ne notifiait personne. Il fallait recharger la page pour
--  voir sa propre modification — ce que l'administrateur a signalé.
--
--  À savoir aussi, hors base : la passerelle Envoy cherchait le
--  service temps réel sous « realtime-dev.supabase-realtime », un
--  nom qui n'existe que sur la pile voisine. Corrigé en
--  « farafina-realtime » dans volumes/api/envoy/cds.yaml.
--
--  Relançable sans risque.
-- =============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'products', 'product_images', 'categories', 'subcategories',
    'contents', 'settings', 'follow_ups'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
