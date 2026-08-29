-- =============================================================
--  Taux de change — 29 août 2026
--
--  Les Rapports affichaient un total par devise, jamais un seul chiffre :
--  additionner des dollars et des francs CFA sans taux aurait ete un
--  chiffre invente. La demande du client est claire : un chiffre d'affaires
--  cumule en FCFA, toutes devises confondues.
--
--  Le CFA ouest-africain est arrime a l'euro par un traite (1 EUR =
--  655,957 XOF, fixe) : ce taux-la n'a rien d'invente, il est ecrit dans
--  le code (lib/facture.ts). Le dollar, lui, flotte : son taux vit ici,
--  modifiable par l'equipe des que le cours bouge, plutot que fige dans
--  le code.
--
--  Relançable sans risque.
-- =============================================================

insert into public.settings (key, value, label, groupe, position) values
  ('taux.usd_xof', '610', 'Taux USD -> FCFA (a mettre a jour selon le cours)', 'taux', 1)
on conflict (key) do nothing;

comment on table public.settings is
  'Reglages modifiables par l''equipe : en-tete de facture, mentions, numerotation, taux de change USD -> FCFA (le taux EUR -> FCFA est une parite fixe, codee en dur).';
