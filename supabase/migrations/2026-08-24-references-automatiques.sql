-- =============================================================
--  Références automatiques — 24 août 2026
--
--  Une référence disait la gamme mais pas la sous-gamme :
--  FT-BJ-001 pouvait être un collier comme une bague. Elle porte
--  désormais les deux initiales et un compteur propre à chaque
--  sous-gamme : FT-BJ-CO-001 pour le premier collier, FT-BJ-BA-001
--  pour la première bague.
--
--  Les codes sont stockés sur les gammes plutôt que devinés du nom :
--  « coussins » et « couvertures » commencent tous deux par CO, et
--  c'est à l'équipe de trancher, pas à une règle d'écriture.
--
--  order_items fige sa propre copie de la référence : renuméroter le
--  catalogue ne touche pas aux commandes déjà passées.
--
--  Relançable sans risque.
-- =============================================================

alter table public.categories    add column if not exists code text;
alter table public.subcategories add column if not exists code text;

comment on column public.categories.code is
  'Initiales de la gamme dans les références. Ex. BJ pour Bijoux.';
comment on column public.subcategories.code is
  'Initiales de la sous-gamme. Uniques à l''intérieur d''une gamme.';

-- ---------- les codes ----------
update public.categories set code = v.code
from (values ('bijoux','BJ'), ('textile','TX'), ('decor','DC')) as v(slug, code)
where public.categories.slug = v.slug and public.categories.code is distinct from v.code;

update public.subcategories set code = v.code
from (values
  ('colliers','CO'), ('bracelets','BR'), ('boucles','BO'), ('bagues','BA'), ('earcuffs','EC'),
  ('tissus','TI'), ('coussins','CS'), ('couvertures','CV'), ('tshirts','TH'),
  ('tuniques','TU'), ('sacs','SA'), ('mode','MO'), ('echarpe','EH'),
  ('pieces','PI'), ('objets','OB'), ('portecles','PC'), ('chemins','CH')
) as v(slug, code)
where public.subcategories.slug = v.slug and public.subcategories.code is distinct from v.code;

-- filet pour toute gamme ajoutée depuis : deux premières lettres du nom
update public.categories
   set code = upper(substr(regexp_replace(slug, '[^a-z]', '', 'g'), 1, 2))
 where code is null or code = '';
update public.subcategories
   set code = upper(substr(regexp_replace(slug, '[^a-z]', '', 'g'), 1, 2))
 where code is null or code = '';

-- =============================================================
--  La prochaine référence libre
--  Appelée par le back-office à la création d'une fiche.
-- =============================================================
create or replace function public.prochaine_reference(
  p_categorie uuid,
  p_sous_categorie uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat text;
  v_sub text;
  v_prefixe text;
  v_num int;
begin
  select code into v_cat from public.categories where id = p_categorie;
  if v_cat is null then
    raise exception 'gamme inconnue';
  end if;

  select code into v_sub from public.subcategories where id = p_sous_categorie;

  v_prefixe := 'FT-' || v_cat || case when v_sub is null then '' else '-' || v_sub end || '-';

  /* on repart du plus grand numéro déjà porté par ce préfixe : une
     référence supprimée ne se réattribue pas, ce qui éviterait deux
     factures anciennes désignant deux articles différents. */
  select coalesce(max(substring(ref from '([0-9]+)$')::int), 0) + 1
    into v_num
    from public.products
   where ref like v_prefixe || '%'
     and ref ~ ('^' || v_prefixe || '[0-9]+$');

  return v_prefixe || lpad(v_num::text, 3, '0');
end $$;

grant execute on function public.prochaine_reference(uuid, uuid) to authenticated;

-- =============================================================
--  Renumérotation du catalogue existant
-- =============================================================
with numerotees as (
  select p.id,
         'FT-' || c.code
              || case when s.code is null then '' else '-' || s.code end
              || '-'
              || lpad(row_number() over (
                   partition by c.code, s.code order by p.position, p.created_at, p.ref
                 )::text, 3, '0') as neuve
    from public.products p
    join public.categories c on c.id = p.category_id
    left join public.subcategories s on s.id = p.subcategory_id
)
update public.products p
   set ref = 'TMP-' || p.id::text
  from numerotees n
 where n.id = p.id and p.ref is distinct from n.neuve;

with numerotees as (
  select p.id,
         'FT-' || c.code
              || case when s.code is null then '' else '-' || s.code end
              || '-'
              || lpad(row_number() over (
                   partition by c.code, s.code order by p.position, p.created_at, p.id
                 )::text, 3, '0') as neuve
    from public.products p
    join public.categories c on c.id = p.category_id
    left join public.subcategories s on s.id = p.subcategory_id
)
update public.products p
   set ref = n.neuve
  from numerotees n
 where n.id = p.id;
