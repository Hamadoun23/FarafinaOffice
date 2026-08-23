-- =============================================================
--  Tuniques et ponchos vendus par assortiment — 23 août 2026
--
--  Même règle que les t-shirts : chaque pièce est peinte à la main,
--  le motif ne se reproduit pas à l'identique et l'atelier ne peut
--  pas garantir un modèle précis en gros. Les vingt-et-une fiches à
--  l'unité laissent la place à deux assortiments — tuniques d'un
--  côté, ponchos de l'autre, ce ne sont pas les mêmes vêtements —
--  dont les photos d'origine deviennent la planche de motifs.
--
--  Relançable sans risque.
-- =============================================================

begin;

-- ---------- la sous-gamme, si elle manque ----------
insert into public.subcategories (category_id, slug, fr_name, en_name, position)
select c.id, 'tuniques', 'Tuniques & ponchos', 'Tunics & ponchos', 5
from public.categories c
where c.slug = 'textile'
on conflict (category_id, slug) do nothing;

-- ---------- les deux fiches d'assortiment ----------
insert into public.products (
  ref, slug, category_id, subcategory_id,
  fr_name, fr_desc, en_name, en_desc,
  price, unit, set_qty, sizes, tag, image_path, is_published, position
)
select v.ref, v.slug, c.id, s.id,
       v.fr_name, v.fr_desc, v.en_name, v.en_desc,
       null, 'lot', 10, v.sizes, 'gros', v.image, true, v.pos
from public.categories c
join public.subcategories s on s.category_id = c.id and s.slug = 'tuniques'
cross join (values
  ('FT-TX-LOT-TUN', 'tu-assortiment',
   'Assortiment de 10 tuniques bogolan',
   'Dix tuniques peintes à la main sur coton filé main, motifs assortis choisis à l''atelier. Chaque pièce étant unique, les modèles ne se commandent pas séparément. Tailles panachées sur demande.',
   'Assortment of 10 bogolan tunics',
   'Ten hand-painted tunics on hand-spun cotton, an assorted mix picked at the workshop. Each piece is unique, so individual designs cannot be ordered separately. Mixed sizes on request.',
   'S → 4XL', 'produits/textile/tuniques/tunique-case-ocre.webp', 0),
  ('FT-TX-LOT-PON', 'po-assortiment',
   'Assortiment de 10 ponchos bogolan',
   'Dix ponchos peints à la main, avec ou sans capuche, motifs assortis choisis à l''atelier. Chaque pièce étant unique, les modèles ne se commandent pas séparément.',
   'Assortment of 10 bogolan ponchos',
   'Ten hand-painted ponchos, hooded or open, an assorted mix picked at the workshop. Each piece is unique, so individual designs cannot be ordered separately.',
   'Taille unique', 'produits/textile/tuniques/poncho-capuche-terre.webp', 1)
) as v(ref, slug, fr_name, fr_desc, en_name, en_desc, sizes, image, pos)
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

-- ---------- les planches de motifs ----------
-- Les photos des anciennes fiches, réparties selon le vêtement :
-- une tunique ne va pas dans le lot de ponchos.
delete from public.product_images
where product_id in (select id from public.products where slug in ('tu-assortiment', 'po-assortiment'));

insert into public.product_images (product_id, path, alt, position)
select
  (select id from public.products
   where slug = case when p.image_path like '%/poncho-%' then 'po-assortiment' else 'tu-assortiment' end),
  p.image_path, p.fr_name,
  row_number() over (partition by (p.image_path like '%/poncho-%') order by p.position, p.ref)
from public.products p
join public.subcategories s on s.id = p.subcategory_id
where s.slug = 'tuniques'
  and p.slug not in ('tu-assortiment', 'po-assortiment')
  and p.image_path is not null;

-- filet : base neuve, sans fiche à l'unité — on reprend les fichiers du site
insert into public.product_images (product_id, path, alt, position)
select (select id from public.products where slug = 'tu-assortiment'),
       'produits/textile/tuniques/' || f || '.webp', 'Tunique bogolan', i
from unnest(array[
  'tunique-case-ocre','tunique-ecru-fine','tunique-plastron-ocre','tunique-case-safran',
  'tunique-case-brune','tunique-indigo-spirales','tunique-symboles','tunique-chevrons',
  'tunique-animaux','tunique-croix-noire','tunique-damier-noir','tunique-dashiki-ocre'
]) with ordinality as t(f, i)
where exists (select 1 from public.products where slug = 'tu-assortiment')
  and not exists (
    select 1 from public.product_images
    where product_id = (select id from public.products where slug = 'tu-assortiment'));

insert into public.product_images (product_id, path, alt, position)
select (select id from public.products where slug = 'po-assortiment'),
       'produits/textile/tuniques/' || f || '.webp', 'Poncho bogolan', i
from unnest(array[
  'poncho-capuche-terre','poncho-bordeaux-safran','poncho-capuche-noire','poncho-safran-bordeaux',
  'poncho-brun-plastron','poncho-patchwork-jaune','poncho-ecru-terre','poncho-noir-terre',
  'poncho-patchwork-indigo'
]) with ordinality as t(f, i)
where exists (select 1 from public.products where slug = 'po-assortiment')
  and not exists (
    select 1 from public.product_images
    where product_id = (select id from public.products where slug = 'po-assortiment'));

-- ---------- retrait des fiches à l'unité ----------
delete from public.products p
using public.subcategories s
where p.subcategory_id = s.id
  and s.slug = 'tuniques'
  and p.slug not in ('tu-assortiment', 'po-assortiment');

commit;
