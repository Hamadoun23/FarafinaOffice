-- =============================================================
--  État du site — 24 août 2026
--
--  De quoi fermer la boutique sans appeler personne : congés,
--  inventaire, rupture de stock, maintenance. Le site lit ces
--  réglages au chargement et affiche le message choisi.
--
--  Trois états :
--    ouvert       — rien ne change
--    annonce      — le site fonctionne, un bandeau prévient
--    ferme        — la boutique est consultable mais la sélection
--                   et l'envoi de devis sont suspendus
--
--  Relançable sans risque.
-- =============================================================

insert into public.settings (key, value, label, groupe, position) values
  ('site.etat', 'ouvert',
   'État du site', 'site', 1),
  ('site.titre', 'Boutique momentanément fermée',
   'Titre du message', 'site', 2),
  ('site.message',
   'Nous préparons la prochaine collection. Les commandes reprennent très bientôt — écrivez-nous, nous vous répondrons dès la réouverture.',
   'Message affiché aux visiteurs', 'site', 3),
  ('site.reprise', '',
   'Date de reprise (facultatif)', 'site', 4)
on conflict (key) do nothing;

-- Le site public doit pouvoir lire ces réglages — et seulement ceux-là.
-- Les coordonnées de facturation, elles, restent réservées à l'équipe.
drop policy if exists "lecture publique etat du site" on public.settings;
create policy "lecture publique etat du site"
  on public.settings for select to anon
  using (groupe = 'site');
