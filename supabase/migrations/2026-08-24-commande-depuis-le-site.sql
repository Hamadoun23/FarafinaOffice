-- =============================================================
--  Commandes déposées par le site — 24 août 2026
--
--  Jusqu'ici, une demande partait sur WhatsApp sans laisser de trace :
--  le back-office ne voyait rien tant que personne ne la ressaisissait.
--  Le site enregistre désormais la commande AVANT d'ouvrir WhatsApp.
--
--  Le site n'a que la clé publique. Plutôt que de lui ouvrir customers,
--  orders et order_items en écriture — ce qui laisserait n'importe qui
--  modifier une commande existante — on expose UNE fonction qui ne sait
--  faire qu'une chose : déposer une nouvelle demande. Elle s'exécute
--  avec les droits du propriétaire, et rien d'autre n'est accessible.
--
--  Relançable sans risque.
-- =============================================================

create or replace function public.deposer_commande(
  p_nom      text,
  p_prenom   text default null,
  p_adresse  text default null,
  p_tel      text default null,
  p_email    text default null,
  p_pays     text default null,
  p_societe  text default null,
  p_langue   text default 'fr',
  p_message  text default '',
  p_articles jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_commande uuid;
  v_numero bigint;
  v_total numeric(10,2) := 0;
  v_nom_complet text;
  v_article jsonb;
begin
  -- ---------- garde-fous ----------
  if coalesce(trim(p_nom), '') = '' then
    raise exception 'nom manquant';
  end if;
  if coalesce(trim(p_tel), '') = '' and coalesce(trim(p_email), '') = '' then
    raise exception 'il faut un téléphone ou une adresse e-mail';
  end if;
  if jsonb_typeof(p_articles) <> 'array' or jsonb_array_length(p_articles) = 0 then
    raise exception 'aucun article';
  end if;
  if jsonb_array_length(p_articles) > 200 then
    raise exception 'trop d''articles';
  end if;

  v_nom_complet := trim(coalesce(trim(p_prenom), '') || ' ' || trim(p_nom));

  -- ---------- le client ----------
  -- On rapproche sur l'e-mail quand il y en a un, sinon sur le téléphone :
  -- un acheteur qui revient ne doit pas créer une deuxième fiche.
  if coalesce(trim(p_email), '') <> '' then
    select id into v_client from public.customers
     where lower(email) = lower(trim(p_email)) limit 1;
  end if;
  if v_client is null and coalesce(trim(p_tel), '') <> '' then
    select id into v_client from public.customers
     where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(trim(p_tel), '[^0-9]', '', 'g')
       and regexp_replace(trim(p_tel), '[^0-9]', '', 'g') <> ''
     limit 1;
  end if;

  if v_client is null then
    insert into public.customers (name, company, email, phone, country, lang, source, notes)
    values (v_nom_complet, nullif(trim(coalesce(p_societe, '')), ''),
            nullif(trim(coalesce(p_email, '')), ''), nullif(trim(coalesce(p_tel, '')), ''),
            nullif(trim(coalesce(p_pays, '')), ''), coalesce(p_langue, 'fr'), 'site',
            case when coalesce(trim(p_adresse), '') = '' then ''
                 else 'Adresse de livraison : ' || trim(p_adresse) end)
    returning id into v_client;
  else
    -- on complète ce qui manquait, sans écraser ce qui est déjà renseigné
    update public.customers
       set phone   = coalesce(phone, nullif(trim(coalesce(p_tel, '')), '')),
           email   = coalesce(email, nullif(trim(coalesce(p_email, '')), '')),
           country = coalesce(country, nullif(trim(coalesce(p_pays, '')), '')),
           company = coalesce(company, nullif(trim(coalesce(p_societe, '')), ''))
     where id = v_client;
  end if;

  -- ---------- la commande ----------
  insert into public.orders (customer_id, status, channel, lang, message, total_estimate)
  values (v_client, 'nouveau', 'site', coalesce(p_langue, 'fr'), coalesce(p_message, ''), 0)
  returning id, number into v_commande, v_numero;

  -- ---------- les articles ----------
  -- Le prix vient du CATALOGUE, jamais de ce que le navigateur envoie :
  -- sans cela, n'importe qui pourrait déposer une commande à un centime.
  for v_article in select * from jsonb_array_elements(p_articles) loop
    insert into public.order_items (order_id, product_id, ref, name, qty, unit_price)
    select v_commande, p.id, p.ref, p.fr_name,
           greatest(1, least(9999, coalesce((v_article->>'qty')::int, 1))),
           case when p.discount_percent > 0
                 and (p.discount_until is null or p.discount_until >= current_date)
                then round(p.price * (1 - p.discount_percent / 100.0), 2)
                else p.price end
      from public.products p
     where p.slug = (v_article->>'slug')
       and p.is_published;
  end loop;

  if not exists (select 1 from public.order_items where order_id = v_commande) then
    delete from public.orders where id = v_commande;
    raise exception 'aucun article connu du catalogue';
  end if;

  select coalesce(sum(qty * coalesce(unit_price, 0)), 0) into v_total
    from public.order_items where order_id = v_commande;

  update public.orders set total_estimate = v_total where id = v_commande;

  return jsonb_build_object('numero', v_numero, 'total', v_total);
end $$;

revoke all on function public.deposer_commande(text,text,text,text,text,text,text,text,text,jsonb) from public;
grant execute on function public.deposer_commande(text,text,text,text,text,text,text,text,text,jsonb) to anon, authenticated;
