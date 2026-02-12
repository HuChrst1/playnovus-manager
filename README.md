# PlayNovus Manager

Application Next.js de gestion PlayNovus pour piloter:
- catalogue de sets et BOM
- approvisionnements par lots
- ventes (sets et pieces) avec consommation FIFO
- stock agrégé et journal de mouvements
- marge réelle par vente

## Fonctionnalités principales

- `Catalogue`
  - liste filtrable/triable des sets
  - fiche set avec état de complétion basé sur le stock
  - édition set, photo et BOM
- `Approvisionnement`
  - création/édition/suppression de lots
  - saisie des lignes d'inventaire d'un lot
  - passage `draft -> confirmed` avec création des mouvements `IN`
- `Ventes`
  - création/édition/annulation/suppression de ventes
  - lignes `SET` ou `PIECE`
  - snapshot des pièces consommées (`sale_item_pieces`)
  - calcul des coûts FIFO et marges
- `Stock`
  - vue agrégée par `piece_ref`
  - détail de l'historique par pièce
  - historique global filtrable
- `Dashboard`
  - page d'accueil UI (principalement placeholder aujourd'hui)

## Stack technique

- Next.js `16` (App Router)
- React `19`
- TypeScript (`strict: true`)
- Supabase (`@supabase/supabase-js` + CLI en devDependency)
- Tailwind CSS v4 + composants UI (Radix/shadcn)

## Prérequis

- Node.js 20+ (recommandé)
- npm 10+
- Projet Supabase (URL + clés)

## Setup local

1. Installer les dépendances:

```bash
npm install
```

2. Créer `.env.local` (ne pas committer):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

3. Lancer le serveur de dev:

```bash
npm run dev
```

4. Ouvrir `http://localhost:3000`.

## Variables d'environnement

- `NEXT_PUBLIC_SUPABASE_URL`
  - URL du projet Supabase
  - utilisée côté client et côté serveur
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - clé publique (navigateur)
  - utilisée par `src/lib/supabase.ts`
- `SUPABASE_SERVICE_ROLE_KEY`
  - clé serveur uniquement
  - utilisée par `src/lib/supabase-server.ts`

## Commandes utiles

```bash
npm run dev      # développement
npm run build    # build de production
npm run start    # exécution du build
npm run lint     # lint ESLint (bloquant)
```

## Qualite / Verification

```bash
npm run typecheck  # verification TypeScript
npm run lint       # verification ESLint (bloquant)
npm run test       # lance test:unit puis test:e2e
npm run test:unit  # TODO F0.1: brancher un framework de tests unitaires
npm run test:e2e   # TODO F0.1: brancher un framework de tests e2e
```

## Structure du repo

```text
src/app/                  # routes App Router (pages + server actions + API routes)
src/app/actions/          # actions serveur transverses (ventes, stock, set/BOM)
src/components/           # composants UI/domaines (catalogue, ventes, dashboard, ui)
src/lib/                  # logique métier et accès Supabase (sales, stock, clients)
src/types/supabase.ts     # types DB générés
data/                     # CSV de seed/import catalogue
supabase/config.toml      # config Supabase CLI locale
```

## Supabase et migrations

- Intégration:
  - client public: `src/lib/supabase.ts`
  - client serveur: `src/lib/supabase-server.ts`
- Auth:
  - aucune couche d'auth applicative n'est implémentée dans ce repo aujourd'hui
- Migrations:
  - le dossier `supabase/migrations` est absent
  - `schema_paths` est vide dans `supabase/config.toml`
  - `sql_paths` référence `./seed.sql` mais ce fichier est absent
  - conclusion: la stratégie de migrations versionnées n'est pas encore en place

## Documentation projet

- `docs/CAHIER_DES_CHARGES.md`
- `docs/AS_IS.md`
- `docs/ROADMAP.md`
- `docs/AGENTS.md`
- `docs/DECISIONS.md`
- `docs/00_START_HERE.md`

Documents archivés (historique / référence secondaire):
- `docs/_archive/PRD.md`
- `docs/_archive/BACKLOG.md`
- `docs/_archive/ACCEPTANCE_CRITERIA.md`
- `docs/_archive/ARCHITECTURE.md`
- `docs/_archive/CONVENTIONS.md`
- `docs/_archive/GLOSSARY.md`
- `docs/_archive/NON_GOALS.md`
