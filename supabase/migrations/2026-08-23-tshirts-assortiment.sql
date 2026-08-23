-- =============================================================
--  T-shirts vendus par assortiment — 23 août 2026
--
--  Les t-shirts sont peints à la main : chaque motif est une pièce
--  unique, l'atelier ne peut pas garantir un modèle précis en gros.
--  Le client ne choisit donc plus un t-shirt, il commande un
--  assortiment de dix, les motifs étant composés à l'atelier.
--
--  Les dix-huit fiches à l'unité sont remplacées par une seule ;
--  leurs photos deviennent la planche de motifs de l'assortiment
--  (table product_images, déjà prévue pour cela).
--
--  Relançable sans risque.
-- =============================================================

begin;

-- ---------- la sous-gamme, si elle manque ----------
-- Une base installée avant l'ajout des t-shirts ne la connaît pas.
insert into public.subcategories (category_id, slug, fr_name, en_name, position)
select c.id, 'tshirts', 'T-shirts', 'T-shirts', 4
from public.categories c
where c.slug = 'textile'
on conflict (category_id, slug) do nothing;

-- ---------- la fiche d'assortiment ----------
insert into public.products (
  ref, slug, category_id, subcategory_id,
  fr_name, fr_desc, en_name, en_desc,
  price, unit, set_qty, sizes, tag, image_path, is_published, position
)
select
  'FT-TX-LOT10', 'ts-assortiment', c.id, s.id,
  'Assortiment de 10 t-shirts bogolan',
  'Dix t-shirts peints à la main sur coton écru, motifs assortis choisis à l''atelier. Chaque pièce étant unique, les modèles ne se commandent pas séparément. Tailles panachées de S à 4XL sur demande.',
  'Assortment of 10 bogolan T-shirts',
  'Ten hand-painted T-shirts on ecru cotton, an assorted mix picked at the workshop. Each piece is unique, so individual designs cannot be ordered separately. Mixed sizes from S to 4XL on request.',
  null, 'lot', 10, 'S → 4XL', 'gros',
  'produits/textile/tshirts/tshirt-cauris.webp', true,
  coalesce((select min(p2.position) from public.products p2
            join public.subcategories s2 on s2.id = p2.subcategory_id
            where s2.slug = 'tshirts'), 0)
from public.categories c
join public.subcategories s on s.category_id = c.id and s.slug = 'tshirts'
where c.slug = 'textile'
on conflict (slug) do update set
  ref            = excluded.ref,
  fr_name        = excluded.fr_name,
  fr_desc        = excluded.fr_desc,
  en_name        = excluded.en_name,
  en_desc        = excluded.en_desc,
  unit           = excluded.unit,
  set_qty        = excluded.set_qty,
  sizes          = excluded.sizes,
  tag            = excluded.tag,
  subcategory_id = excluded.subcategory_id,
  is_published   = true;

-- ---------- la planche de motifs ----------
-- Les photos des anciennes fiches, reprises telles quelles : ce sont
-- elles qui montrent à l'acheteur dans quoi l'atelier puise.
delete from public.product_images
where product_id = (select id from public.products where slug = 'ts-assortiment');

insert into public.product_images (product_id, path, alt, position)
select
  (select id from public.products where slug = 'ts-assortiment'),
  p.image_path,
  p.fr_name,
  row_number() over (order by p.position, p.ref)
from public.products p
join public.subcategories s on s.id = p.subcategory_id
where s.slug = 'tshirts'
  and p.slug <> 'ts-assortiment'
  and p.image_path is not null;

-- filet : si la base ne contenait aucune fiche à l'unité (installation
-- neuve), on reprend les fichiers livrés avec le site.
insert into public.product_images (product_id, path, alt, position)
select
  (select id from public.products where slug = 'ts-assortiment'),
  'produits/textile/tshirts/' || f || '.webp', 'Motif bogolan', i
from unnest(array[
  'tshirt-cauris','tshirt-masque-ocre','tshirt-labyrinthe','tshirt-case-dogon',
  'tshirt-chasseur','tshirt-diagonale-cauris','tshirt-afrique-grecque','tshirt-rosaces',
  'tshirt-afrique-chevrons','tshirt-formes-ocre','tshirt-triangles','tshirt-chasseur-mouchete',
  'tshirt-symboles','tshirt-damiers','tshirt-triangles-fins','tshirt-carre-grecque',
  'tshirt-semis-bogolan','tshirt-gye-nyame'
]) with ordinality as t(f, i)
where exists (select 1 from public.products where slug = 'ts-assortiment')
  and not exists (
    select 1 from public.product_images
    where product_id = (select id from public.products where slug = 'ts-assortiment')
  );

-- ---------- retrait des fiches à l'unité ----------
delete from public.products p
using public.subcategories s
where p.subcategory_id = s.id
  and s.slug = 'tshirts'
  and p.slug <> 'ts-assortiment';

commit;
