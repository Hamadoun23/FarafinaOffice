-- =============================================================
--  Facture publique — 10 septembre 2026
--
--  Le bouton "Envoyer" (facture imprimable) partage desormais un lien
--  vers une page publique de la facture, plutot qu'un lien vers cet
--  ecran d'administration (que le client ne peut pas ouvrir : RLS
--  reserve invoices/invoice_items/settings a "authenticated").
--
--  On ne touche pas a cette RLS — elle reste fermee. A la place, une
--  fonction SECURITY DEFINER renvoie UNE facture par id (comme un
--  lien de facture Stripe/Anthropic : l'id, un uuid v4, fait office de
--  jeton — non enumerable). Aucune liste, aucun acces aux autres
--  factures ou aux autres reglages.
--
--  Relancable sans risque.
-- =============================================================

create or replace function public.facture_publique(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resultat jsonb;
begin
  select jsonb_build_object(
    'facture', to_jsonb(i) - 'order_id' - 'quote_id',
    'lignes', coalesce((
      select jsonb_agg(to_jsonb(li) - 'invoice_id' - 'product_id' order by li.position)
      from public.invoice_items li
      where li.invoice_id = i.id
    ), '[]'::jsonb),
    'reglages', coalesce((
      select jsonb_object_agg(s.key, s.value)
      from public.settings s
      where s.key like 'societe.%' or s.key like 'facture.%'
    ), '{}'::jsonb),
    'client_reference', (
      select c.reference from public.customers c where c.id = i.customer_id
    )
  )
  into resultat
  from public.invoices i
  where i.id = p_id;

  return resultat;
end;
$$;

comment on function public.facture_publique(uuid) is
  'Lecture publique d''une seule facture, par id (uuid non enumerable) — pour le lien envoye au client par email/WhatsApp.';

revoke all on function public.facture_publique(uuid) from public;
grant execute on function public.facture_publique(uuid) to anon, authenticated;
