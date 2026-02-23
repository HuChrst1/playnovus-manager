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
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<turnstile-site-key>
SUPABASE_AUTH_CAPTCHA_SECRET=<turnstile-secret-key>
APP_ALLOWED_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
```

3. Lancer le serveur de dev (mode stable par defaut: webpack):

```bash
npm run dev
```

Pour diagnostiquer un probleme specifique Turbopack:

```bash
npm run dev:turbo
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
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - clé publique Turnstile (UI auth)
  - utilisée par `src/components/security/TurnstileField.tsx`
- `SUPABASE_AUTH_CAPTCHA_SECRET`
  - secret CAPTCHA Supabase Auth
  - lu via `supabase/config.toml` (`[auth.captcha].secret = env(...)`)
- `APP_ALLOWED_ORIGINS`
  - liste CSV des origines autorisées pour CORS sur les routes API exposées
  - fallback local côté code si variable absente: `http://127.0.0.1:3000,http://localhost:3000`

## Commandes utiles

```bash
npm run dev          # developpement stable (webpack, recommande)
npm run dev:webpack  # alias explicite webpack
npm run dev:turbo    # Turbopack (debug/diagnostic)
npm run build    # build de production
npm run start    # exécution du build
npm run lint     # lint Biome + gardes UI (bloquant)
npm run test:f2.0
npm run test:f7.3:pre
npm run test:f7.3:post
npm run test:f7.4
npm run test:f7.5
```

## Qualite / Verification

```bash
npm run typecheck  # verification TypeScript
npm run lint       # verification lint (bloquant)
npm run build      # verification build production
npm run test       # unit + integration locale
npm run audit:prod # audit npm production
npm run audit:deps # audit dependances cibles
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
  - couche applicative active (login/logout, cookies de session, guard proxy)
  - garde session serveur partagée: `src/lib/auth/require-active-session.ts`
  - CAPTCHA Turnstile sur login/forgot-password
- Migrations:
  - migrations versionnées présentes dans `supabase/migrations`
  - reset local supporté par `npx supabase db reset --local` (migrations + `supabase/seed.sql`)

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
