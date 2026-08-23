-- =============================================================
--  Lot export de boucles d'oreilles — 23 août 2026
--
--  Contrairement aux t-shirts et aux tuniques, les boucles ne sont
--  pas des pièces uniques : ce sont quinze modèles reproductibles,
--  chacun avec son tarif (2,99 € à 6,99 €). On ne les remplace donc
--  PAS par un lot — on ajoute une seizième fiche, l'assortiment
--  panaché, pour l'acheteur qui ne veut pas choisir modèle par
--  modèle. Les quinze fiches et leurs prix restent en place.
--
--  Relançable sans risque.
-- =============================================================

begin;

insert into public.products (
  ref, slug, category_id, subcategory_id,
  fr_name, fr_desc, en_name, en_desc,
  price, unit, set_qty, tag, image_path, is_published, position
)
select
  'FT-BJ-LOT', 'bo-assortiment', c.id, s.id,
  'Assortiment de 10 paires, modèles panachés',
  'Dix paires choisies à l''atelier dans toute la collection ci-dessous : Fulani, Ankh, cauris, Touareg. Pour commander un modèle précis, prenez sa fiche. Prix du lot sur demande.',
  'Assortment of 10 pairs, mixed designs',
  'Ten pairs picked at the workshop from the whole collection below: Fulani, Ankh, cowrie, Tuareg. To order one specific design, use its own listing. Lot price on request.',
  null, 'lot', 10, 'gros',
  'produits/bijoux/boucles/boucle-fulani-creole.webp', true,
  -- juste avant la première boucle, pour ouvrir la sous-gamme
  coalesce((select min(p2.position) - 1 from public.products p2
            join public.subcategories s2 on s2.id = p2.subcategory_id
            where s2.slug = 'boucles'), 0)
from public.categories c
join public.subcategories s on s.category_id = c.id and s.slug = 'boucles'
where c.slug = 'bijoux'
on conflict (slug) do update set
  ref          = excluded.ref,
  fr_name      = excluded.fr_name,
  fr_desc      = excluded.fr_desc,
  en_name      = excluded.en_name,
  en_desc      = excluded.en_desc,
  unit         = excluded.unit,
  set_qty      = excluded.set_qty,
  tag          = excluded.tag,
  is_published = true;

-- ---------- la planche des modèles ----------
-- Les photos des quinze fiches, qui restent par ailleurs en vente.
delete from public.product_images
where product_id = (select id from public.products where slug = 'bo-assortiment');

insert into public.product_images (product_id, path, alt, position)
select
  (select id from public.products where slug = 'bo-assortiment'),
  p.image_path, p.fr_name,
  row_number() over (order by p.position, p.ref)
from public.products p
join public.subcategories s on s.id = p.subcategory_id
where s.slug = 'boucles'
  and p.slug <> 'bo-assortiment'
  and p.image_path is not null;

commit;
