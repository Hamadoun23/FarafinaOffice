# FarafinaOffice — back-office de Farafinatignɛ

Application de gestion pour l'équipe de **Farafinatignɛ** : elle pilote le contenu
du site vitrine et suit l'activité commerciale.

> État : **en production** — https://office.farafinatigne.com

## Ce que l'application doit permettre

| Domaine | Fonctions |
|---|---|
| Contenus | modifier les textes du site (FR/EN), sans toucher au code |
| Catalogue | créer et modifier les produits : nom, description, prix, photo, catégorie, publication |
| Clients | base alimentée en temps réel par le catalogue PDF, le formulaire de contact et les demandes de devis |
| Commandes | suivre les demandes reçues, changer leur statut, voir le détail des articles |
| Devis | établir une facture proforma à partir d'une commande, l'envoyer, suivre son acceptation |
| Relances | programmer un rappel WhatsApp ou e-mail sur un client ou une commande |

## Architecture retenue

```
                    ┌──────────────────────┐
                    │   FarafinaOffice     │  Next.js, sur le VPS
                    │   (équipe, connecté) │  office.farafinatigne.com
                    └──────────┬───────────┘
                               │ lecture + écriture (clé service)
                    ┌──────────▼───────────┐
                    │      Supabase        │  PostgreSQL + Storage + Realtime
                    └──────────┬───────────┘
                               │ lecture seule (clé anon, RLS)
                    ┌──────────▼───────────┐
                    │   Site vitrine       │  statique, sur le VPS
                    │   farafinatigne.com  │  farafinatigne.com
                    └──────────────────────┘
```

Le site vitrine **lit Supabase au chargement** : une modification de prix ou de
texte est visible en quelques secondes, sans redéploiement. Un **instantané
statique** des produits reste embarqué dans le site et sert de secours si
Supabase est injoignable, et de contenu pour les moteurs de recherche.

## Base de données

Le schéma complet est dans [`supabase/schema.sql`](supabase/schema.sql) :
11 tables, sécurité par ligne (RLS), temps réel et bucket d'images.

Points de conception à connaître :

- **`contents`** reprend les clés i18n déjà utilisées par le site
  (`hero.title1`, `mani.p1`…) : une ligne par texte, colonnes `fr` et `en`.
- **`products.price` à `NULL`** signifie « prix sur demande » — c'est le cas
  des 16 références dont le tarif n'est pas encore fixé.
- **`order_items` fige la référence, le nom et le prix** au moment de la
  commande. Le catalogue évolue, une commande passée ne doit pas changer.
- **RLS** : la clé publique du site ne voit que les contenus, les catégories et
  les produits publiés, et ne peut écrire que dans `leads`. Tout le reste exige
  un compte de l'équipe.

Pour l'installer : ouvrir l'éditeur SQL du projet Supabase, coller le fichier,
exécuter. Le script est relançable sans risque.

## L'éditeur en direct

L'écran **Modifier le site** affiche le vrai site dans un cadre, en mode édition.
Au survol, chaque texte, prix et image s'encadre ; un clic l'ouvre dans le panneau
de droite ; la frappe met l'aperçu à jour immédiatement ; « Enregistrer » écrit
dans la base et la modification est en ligne.

Le mécanisme repose sur deux fichiers du site vitrine :

- **`site/js/editor-bridge.js`** — signale l'élément cliqué et applique les
  aperçus. Il ne détient **aucune clé d'écriture** et refuse de s'activer si la
  page n'est pas encadrée par une origine autorisée. C'est ce qui permet de le
  laisser en place sur le site public.
- **`site/js/live-data.js`** — affiche d'abord le contenu embarqué, puis applique
  les valeurs de la base. Si Supabase est injoignable, le site reste parfaitement
  fonctionnel avec ses données d'origine.

L'écriture est faite par le back-office, avec la session de l'administrateur.

Côté nginx, le site autorise l'encadrement **par ce seul sous-domaine**
(`Content-Security-Policy: frame-ancestors`). `X-Frame-Options` ne sait pas
lister plusieurs origines : ne pas le réintroduire, il casserait l'éditeur.

## Installation en local

```bash
python tools/generate-env.py --env local
cd supabase-stack && docker compose up -d
docker cp ../supabase/schema.sql farafina-db:/tmp/
docker exec farafina-db psql -U postgres -d postgres -f /tmp/schema.sql

node tools/seed-from-site.mjs ../site > supabase/seed.sql   # données du site

cd app && cp .env.example .env.local    # y coller la clé anon
npm install && npm run dev              # http://127.0.0.1:3100
```

Viser **`127.0.0.1`** et jamais `localhost` : sur certaines machines `localhost`
part en IPv6 vers un autre conteneur et renvoie un 401 trompeur.

## Production

Tout tourne sur le VPS dans `/opt/farafina`, **sans aucun contact avec BEKST**
qui occupe le même serveur :

| | Farafina | BEKST — ne pas toucher |
|---|---|---|
| Répertoire | `/opt/farafina` | `/opt/bekst`, `/opt/docs` |
| Conteneurs | `farafina-*` | `app-*`, `supabase-*`, `docs-*` |
| Passerelle | `127.0.0.1:8100` | `0.0.0.0:8000` |
| Base | `127.0.0.1:5533` | `127.0.0.1:5432` |
| Vhosts | `farafinatigne.conf`, `farafina-office.conf` | `bekst.conf`, `docs.conf` |

Le compose officiel de Supabase impose des `container_name` en dur qui
entreraient en collision avec ceux de BEKST : `docker-compose.override.yml` les
renomme et **restreint les ports à la boucle locale**.

L'API est servie par nginx sous `https://farafinatigne.com/supabase`, même
domaine que le site : aucune requête inter-origine côté public.

### Mettre à jour l'application

```bash
ssh root@169.58.85.222
cd /opt/farafina
docker compose -f docker-compose.office.yml up -d --build
```

## Ce qu'il reste à faire

- Écran **relances** (la table `follow_ups` est prête)
- Génération du PDF de facture proforma
- Enregistrer les demandes de devis du site directement dans `orders`
- Configurer le SMTP pour les invitations et mots de passe oubliés

Aucun identifiant ne doit être écrit dans ce dépôt : ils vivent dans des fichiers
`.env` ignorés par git, et sur le VPS en `chmod 600`.
