# Architecture

## 1. Schéma d'ensemble (texte)

```text
UI (Next App Router pages + client components)
  -> Server Actions / API Routes (src/app/actions, src/app/api)
    -> Domain helpers (src/lib/sales.ts, src/lib/stock.ts)
      -> Supabase clients (public/server)
        -> Tables, vues et fonction SQL (Postgres/Supabase)
```

## 2. Responsabilités par dossier

- `src/app/`
  - routes App Router
  - orchestration des pages
  - server actions et route API
- `src/components/`
  - composants UI par domaine (`sales`, `catalogue`, `dashboard`, `ui`)
  - interactions client (modales, formulaires, validation locale)
- `src/lib/`
  - logique métier partagée
  - accès DB typé (Supabase)
  - algorithmes métier (BOM, FIFO, agrégations)
- `src/types/supabase.ts`
  - types générés depuis le schéma Supabase
- `supabase/`
  - config CLI locale (`config.toml`)
  - pas de migrations versionnées aujourd'hui
- `data/`
  - jeux CSV d'import catalogue

## 3. Intégration Supabase

- Client public (`src/lib/supabase.ts`)
  - utilise `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - appelé par certains composants client et server actions
- Client serveur (`src/lib/supabase-server.ts`)
  - utilise `SUPABASE_SERVICE_ROLE_KEY`
  - `persistSession: false`
  - utilisé dans les actions sensibles (ex: ventes/FIFO)

Auth:
- aucune couche d'auth applicative n'est branchée (pas de session utilisateur côté app).

## 4. Domaine métier actuel

### Catalogue
- `sets_catalog` + `sets_bom`
- vue `set_with_completion` pour la complétion

### Approvisionnement / Stock
- `lots` + `inventory`
- `stock_movements` = source de vérité des flux stock
- vues `stock_per_piece`, `stock_journal`, `piece_movements`

### Ventes
- `sales` + `sale_items` + `sale_item_pieces`
- logique centrale dans `src/app/actions/sales.ts`
- FIFO via `src/lib/stock.ts`
- expansion BOM/overrides via `src/lib/sales.ts`

## 5. Flux critiques

### Confirmation de lot
1. lot passe `draft -> confirmed`
2. lecture des lignes `inventory` du lot
3. création mouvements `IN` (`source_type=PURCHASE`)
4. stock agrégé reflété via vues SQL

### Création de vente
1. validation du draft
2. insertion `sales` puis `sale_items`
3. expansion demandes pièces (set BOM / overrides)
4. allocation FIFO par pièce
5. insertion `stock_movements OUT` + `sale_item_pieces`
6. update coûts/marges lignes + vente

### Annulation de vente
1. lecture mouvements `OUT` de la vente
2. insertion mouvements miroirs `IN` (`SALE_CANCEL`)
3. passage du statut vente à `CANCELLED`

## 6. Points d'attention techniques

- `src/app/actions/sales.ts` est un module volumineux (create/update/cancel/delete).
- usage mixte client Supabase public / serveur dans les server actions.
- absence de migrations SQL versionnées = risque de drift schéma/code.
- certains parcours reposent fortement sur des vues SQL non versionnées dans le repo.

## 7. Propositions (non appliquées)

Ces points sont des propositions de refactorisation, volontairement non implémentées:

- Extraire `src/app/actions/sales.ts` en modules dédiés:
  - `sales-create.ts`
  - `sales-update.ts`
  - `sales-cancel.ts`
  - `sales-delete.ts`
- Unifier les accès DB serveur:
  - server actions sensibles via `supabaseServer` uniquement
  - limiter le client public aux composants client
- Introduire un dossier `src/domain/` pour les règles métier pures:
  - validations draft vente
  - calculs d'agrégation
  - invariants FIFO/BOM
- Ajouter une couche `supabase/migrations/` et versionner les vues SQL critiques.
