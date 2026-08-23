-- =============================================================
--  Nouveaux motifs de l'arrivage 3 — 23 août 2026
--
--  Six photos de vêtements viennent d'être rangées dans les assets.
--  Elles ne méritent pas une référence à elles seules : t-shirts,
--  tuniques et ponchos ne se vendent plus au modèle mais par
--  assortiment. Elles rejoignent donc la planche de motifs du lot
--  correspondant, à la suite des existantes.
--
--  Relançable sans risque : on n'ajoute que ce qui manque.
-- =============================================================

insert into public.product_images (product_id, path, alt, position)
select p.id, v.chemin, v.alt,
       coalesce((select max(i.position) from public.product_images i where i.product_id = p.id), 0) + v.rang
from public.products p
join (values
  ('ts-assortiment', 'produits/textile/tshirts/tshirt-triangles-colonnes.webp', 'T-shirt triangles en colonnes', 1),
  ('ts-assortiment', 'produits/textile/tshirts/tshirt-bogolan-allover.webp',    'T-shirt bogolan intégral',      2),
  ('tu-assortiment', 'produits/textile/tuniques/tunique-capuche-ecrue.webp',    'Tunique écrue à capuche',       1),
  ('tu-assortiment', 'produits/textile/tuniques/tunique-jaune-symboles.webp',   'Tunique jaune à symboles',      2),
  ('po-assortiment', 'produits/textile/tuniques/tunique-capuche-terre.webp',    'Poncho à capuche, terre',       1),
  ('po-assortiment', 'produits/textile/tuniques/tunique-capuche-safran.webp',   'Poncho à capuche, safran',      2)
) as v(slug, chemin, alt, rang) on v.slug = p.slug
where not exists (
  select 1 from public.product_images i
  where i.product_id = p.id and i.path = v.chemin
);
