# HISTORIQUE

Ce fichier consigne les changements du projet, etapes par etapes.

## 2026-02-12 - F0.1 Standardiser les scripts qualite

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json` pour standardiser les scripts qualite:
- `typecheck`: `tsc --noEmit`
- `lint`: `eslint .` (bloquant)
- `test`: `npm run test:unit && npm run test:e2e`
- `test:unit`: placeholder pragmatique avec TODO explicite (framework unitaire non installe)
- `test:e2e`: placeholder pragmatique avec TODO explicite (framework e2e non installe)
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/README.md` avec une section `Qualite / Verification` listant les commandes projet.

### Verifications executees

- `npm run typecheck`: KO (erreurs TypeScript existantes dans le code applicatif, pas d'erreur de configuration script)
- `npm run lint`: KO (erreurs ESLint existantes dans le code applicatif, commande bien bloquante)
- `npm run test`: OK
- `npm run test:unit`: OK
- `npm run test:e2e`: OK

### Perimetre / limites

- Aucune logique metier applicative modifiee.
- Nettoyage des erreurs lint/types hors perimetre F0.1 (traite par F0.2/F0.3).
- Integration de frameworks de tests unitaires/e2e hors perimetre F0.1 (TODO explicites conserves).

## 2026-02-13 - F0.2 Nettoyage lint domaine Ventes/FIFO

Statut: `FAIT`

### Changements realises

- Nettoyage lint/type sur les fichiers cibles F0.2:
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/actions/sales.ts`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/nouvelle/NewSaleForm.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/sales.ts`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/stock.ts`
- Suppression des `any` non justifies et renforcement de types (`unknown`, guards, normalisation typée) sans modifier la logique metier FIFO.
- Correctif connexe en edition de vente:
- ajout d'un "stock virtuel" pour les checks UI en mode edit (`stock actuel + pieces de la vente editee`)
- ajout de `stockCreditByPieceRef` dans le flux `getSaleDraftForEditAction -> EditSaleDialog -> NewSaleForm`
- Commit de reference: `31231d4` (`feat(ventes): conclure F0.2 lint et stock virtuel en edition`).

### Verifications executees

- `npx eslint src/app/actions/sales.ts src/app/ventes/nouvelle/NewSaleForm.tsx src/lib/sales.ts src/lib/stock.ts`: OK (`0 error`, `0 warning`)
- `npx eslint src/app/actions/sales.ts src/components/sales/EditSaleDialog.tsx src/app/ventes/nouvelle/NewSaleForm.tsx`: OK (`0 error`, `0 warning`)
- `npm run typecheck --silent`: KO global (erreurs hors perimetre F0.2), aucun diagnostic releve sur les fichiers F0.2 cibles

### Perimetre / limites

- Aucune modification de logique metier applicative (FIFO, allocations, regles de validation metier).
- Le lint global du repo reste bloquant tant que les phases suivantes (notamment F0.3) ne sont pas traitees.

## 2026-02-13 - F0.3 Nettoyage lint UI shared + Catalogue/Appro/Stock

Statut: `FAIT`

### Changements realises

- Nettoyage lint/type sur le perimetre F0.3:
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/input.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/textarea.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/[id]/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/NewLotDialog.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/historique-stock/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/catalogue/delete-piece-button.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/catalogue/edit-piece-dialog.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/catalogue/set-image.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/[id]/[saleItemId]/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/DeleteSaleDialog.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/PieceSelector.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SetSelector.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SetPiecesDialog.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SalesTable.tsx`
- Corrections lint global complementaires validees:
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardStatCard.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/import-data.ts`
- Ajustements de typage necessaires pour gate `typecheck/build`:
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/[id]/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/actions.ts`

### Verifications executees

- `npm run lint`: OK (`0 error`, `0 warning`)
- `npm run typecheck`: OK
- `npm run build`: OK

### Perimetre / limites

- Aucune modification de logique metier applicative (FIFO, annulation, regles ventes/stock).
- Aucun changement de schema DB / migration.

## 2026-02-13 - Suppression lot confirme + sync statut/stock

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`:
- ajout d'un helper unique `getLotSalesUsage` pour detecter l'usage ventes d'un lot
- ajout des helpers `deletePurchaseMovementsForLot` et `createPurchaseMovementsForLot`
- `updateLotFromDialog` synchronise maintenant le stock selon transition:
- `draft -> confirmed`: recreation des mouvements `PURCHASE`
- `confirmed -> draft`: retrait des mouvements `PURCHASE` avec blocage si ventes liees
- `deleteLot` autorise suppression des lots `draft` et `confirmed` (y compris `LOT_0`) si aucune vente liee, avec suppression des effets stock/historique associes
- enrichissement des retours d'erreur (`reason`, `linkedSaleIds`, `linkedSalesCount`) sans rupture de compat
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/DeleteLotButton.tsx`:
- suppression du blocage client sur lot confirme
- confirmation utilisateur explicite pour l'impact stock/historique
- guidage utilisateur en cas de blocage `LOT_USED_BY_SALES`
- sans `console.error` client pour erreurs metier attendues
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`:
- ajout des decisions `D-010` (suppression controlee lot confirme) et `D-011` (synchronisation statut/stock)

### Verifications executees

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK

### Perimetre / limites

- Aucun changement de schema DB / migration.
- Aucune suppression en cascade des ventes.
- Blocage conserve si le lot a deja ete utilise dans des ventes.

## 2026-02-15 - Alignement documentation apres mises a jour lot/statut

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/AS_IS.md`:
- alignement du comportement Approvisionnement avec l'implementation reelle:
  - suppression lot `draft/confirmed` (incluant `LOT_0`) si non utilise en ventes
  - synchronisation `draft <-> confirmed` sur les mouvements `PURCHASE`
  - blocage si usage ventes detecte
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/CAHIER_DES_CHARGES.md`:
- regles cibles Approvisionnement mises a jour pour inclure:
  - retour `confirmed -> draft` conditionnel
  - suppression lot confirme conditionnelle
  - criteres d'acceptation anti-doublon mouvements
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
- `Phase 0` marquee `FAIT`
- ajout de `F2.0` (suppression lot confirme + sync statut/stock) marquee `FAIT`
- `Phase 2` marquee `EN COURS`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/00_START_HERE.md`:
- ordre de lecture complete avec `DECISIONS` et `HISTORIQUE`
- index des docs principales complete avec `HISTORIQUE`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/_archive/BACKLOG.md`:
- ticket `T-330` passe de bloque a traite (decision appliquee)

### Verifications executees

- revue de coherence sur tous les fichiers `docs/*` avec recherche ciblee des regles lot/statut

### Perimetre / limites

- Les docs archivees dans `docs/_archive/` restent historiques; seules les contradictions critiques ont ete corrigees.

## 2026-02-15 - F1.1 Initialiser les migrations versionnees

Statut: `FAIT`

### Changements realises

- Baseline migration generee depuis la DB Supabase reelle:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/migrations/20260215214134_f1_1_baseline_public.sql`
- Snapshot de securite pre-baseline cree:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/_snapshots/pre_f1_1_public.sql`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/config.toml`:
  - `[db.seed].enabled = false` (seed hors perimetre F1.1, traite en F1.2)
- Regeneration des types Supabase dans:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/types/supabase.ts`
- Ajustement de typage uniquement (sans changement metier) dans:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/actions/sales.ts`
  - prise en charge defensive de l'absence de colonne `sale_items.overrides` dans la DB reelle
- Mise a jour documentation F1.1:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`
- Mise a jour safety git:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/.gitignore` avec `_snapshots/`

### Verifications executees

- Supabase / migrations:
  - `npx supabase link --project-ref cxnbrqfhyyhnrhahdzcb --password <env>`: OK
  - `npx supabase db dump --linked --schema public --file supabase/_snapshots/pre_f1_1_public.sql --password <env>`: OK
  - `npx supabase db pull f1_1_baseline_public --linked --schema public --password <env>`: OK
  - `npx supabase start`: OK
  - `npx supabase db reset --local`: OK
- Verification objets cles apres reset (DB locale):
  - tables cles attendues: presentes (`inventory`, `lots`, `sales`, `sale_items`, `sale_item_pieces`, `stock_movements`, `sets_catalog`, `sets_bom`, `transactions`, `stock_balance`)
  - vues cles attendues: presentes (`stock_per_piece`, `stock_journal`, `piece_movements`, `set_with_completion`)
  - fonction attendue: presente (`reset_sales_id_sequence`)
- Qualite projet:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK

### Perimetre / limites

- Aucun changement de logique metier applicative.
- Aucun changement destructif applique au schema distant.

## 2026-02-15 - F1.2 Ajouter un seed minimal executable

Statut: `FAIT`

### Changements realises

- Creation de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/seed.sql`:
  - seed minimal deterministe et executable via reset local
  - insertion d'un set (`sets_catalog`) et BOM multi-pieces (`sets_bom`)
  - insertion d'un lot `confirmed` (`lots`) + lignes `inventory` coherentes
  - insertion des mouvements `PURCHASE/IN` dans `stock_movements`
  - insertion d'une vente `CONFIRMED` (`sales`) + ligne `sale_items` de type `SET`
  - insertion du detail `sale_item_pieces`
  - insertion des mouvements `SALE/OUT` relies au `sale_item_id`
  - aucune insertion directe dans `stock_balance` (alimente par trigger)
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/config.toml`:
  - `[db.seed].enabled = true`
  - `sql_paths = ["./seed.sql"]` conserve
- Mise a jour documentation F1.2:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F1.2` passe a `FAIT`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md` (cette entree)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale detectee en cours d'execution)
- Validation Supabase locale:
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local`: OK (baseline + seed appliques sans erreur)
- Verification SQL post-seed (DB locale):
  - objets cles presents:
    - `stock_per_piece`: present
    - `stock_journal`: present
    - `piece_movements`: present
    - `set_with_completion`: present
    - `reset_sales_id_sequence()`: presente
  - comptages seed:
    - `lots=1`
    - `stock_movements=4`
    - `sales=1`
    - `sale_items=1`
    - `sale_item_pieces=2`
    - `sets_catalog=1`
    - `sets_bom=2`
  - integrite:
    - `stock_balance.quantity < 0`: `0` ligne
    - vues non vides:
      - `stock_per_piece=2` lignes
      - `stock_journal=4` lignes
      - `set_with_completion=1` ligne
- Qualite projet:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK

### Perimetre / limites

- Aucun changement de schema distant Supabase.
- Aucune commande destructive remote executee.
- Aucune modification de logique metier applicative (hors ajout seed SQL et config locale associee).

## 2026-02-16 - F1.3 Bloquer le stock negatif au niveau DB

Statut: `FAIT`

### Changements realises

- Creation de la migration incrementale:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/migrations/20260216134316_f1_3_block_negative_stock.sql`
- Ajouts DB dans la migration:
  - fail-fast pre-migration si donnees invalides (`stock_balance.quantity < 0` ou `stock_movements IN/OUT` sans `lot_id`)
  - contrainte `ck_stock_balance_qty_nonneg` sur `public.stock_balance` (`quantity >= 0`)
  - fonction helper `public.apply_stock_balance_delta(piece_ref, lot_id, delta)` avec rejet explicite des resultats negatifs
  - remplacement de `public.apply_stock_balance_from_movements()` pour appliquer les deltas sans insert intermediaire negatif
  - fonction/trigger `public.reject_negative_stock_balance()` + `trg_reject_negative_stock_balance` sur `public.stock_balance`
  - contrainte `ck_stock_movements_lot_required_inout` sur `public.stock_movements`
  - grants explicites pour les nouvelles fonctions (`anon`, `authenticated`, `service_role`)
- Mise a jour documentation F1.3:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md` (cette entree)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
- Validation rejouabilite locale:
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local`: OK (baseline + F1.3 + seed F1.2)
- Verification SQL post-migration (DB locale):
  - inventaire contraintes/fonctions/triggers F1.3: OK
    - `ck_stock_balance_qty_nonneg`: presente
    - `ck_stock_movements_lot_required_inout`: presente
    - `trg_reject_negative_stock_balance`: present
    - `apply_stock_balance_delta`, `apply_stock_balance_from_movements`, `reject_negative_stock_balance`: presentes
  - test echec sortie invalide: OK (rejet DB explicite)
    - message: `Stock negatif interdit (...) Mouvement refuse.`
  - test succes sortie valide: OK (`BEGIN`, `INSERT 0 1`, `ROLLBACK`)
  - test lot obligatoire pour `IN/OUT`: OK (viol de `ck_stock_movements_lot_required_inout` quand `lot_id` est `NULL`)
  - integrite:
    - `stock_balance.quantity < 0`: `0` ligne
    - traces de tests (`source_id=F1_3_FAIL_TEST`, `F1_3_SUCCESS_TEST`): `0` ligne
  - vues operationnelles:
    - `stock_per_piece`: lisible
    - `stock_journal`: lisible
    - `piece_movements`: lisible
- Qualite projet:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK

### Perimetre / limites

- Aucun changement de schema distant Supabase.
- Aucune commande d'ecriture remote executee.
- Aucun ajout de secret sensible dans le repo.
- Aucun changement F1.4+ (pas d'anti-doublon, pas d'index perf additionnels).

## 2026-02-16 - F1.4 Anti-doublons de mouvements + indexes perf

Statut: `FAIT`

### Changements realises

- Creation de la migration incrementale:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/migrations/20260216144649_f1_4_anti_duplicate_movements_indexes.sql`
- Ajouts DB dans la migration:
  - fail-fast pre-migration si mouvements coeur sans `source_id` exploitable (`PURCHASE`, `SALE`, `SALE_CANCEL`)
  - fail-fast pre-migration si doublons deja presents sur la cle metier `(source_type, source_id, piece_ref, lot_id, direction)` pour flux coeur
  - contrainte `ck_stock_movements_source_id_required_core` sur `public.stock_movements`
  - index unique partiel `ux_stock_movements_no_duplicate_core` sur `(source_type, source_id, piece_ref, lot_id, direction)` (scope `PURCHASE|SALE|SALE_CANCEL`, `IN|OUT`)
  - index lookup source `idx_stock_movements_source_id_direction` sur `(source_type, source_id, direction)`
  - suppression des indexes redondants `idx_stock_movements_source` et `stock_movements_source_type_id_idx`
- Mise a jour documentation F1.4:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md` (cette entree)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale detectee)
- Validation rejouabilite locale:
  - `npx supabase start`: KO initial (conflit conteneur deja existant `supabase_db_playnovus-manager`)
  - `npx supabase stop --no-backup`: OK (remise a plat locale)
  - `npx supabase start`: OK (migrations F1.1 + F1.3 + F1.4 appliquees, seed execute)
  - `npx supabase db reset --local`: OK (baseline + F1.3 + F1.4 + seed)
- Verification SQL post-migration (DB locale):
  - inventaire contraintes/index/triggers/fonctions F1.4: OK
    - `ck_stock_movements_source_id_required_core`: presente
    - `ux_stock_movements_no_duplicate_core`: present
    - `idx_stock_movements_source_id_direction`: present
    - `idx_stock_movements_source` / `stock_movements_source_type_id_idx`: absents
    - `trg_stock_balance_ins|upd|del` et `trg_reject_negative_stock_balance`: presents
    - `apply_stock_balance_delta`, `apply_stock_balance_from_movements`, `reject_negative_stock_balance`: presentes
  - test echec doublon cible: OK (duplicate insert rejete, `unique_violation`)
  - test succes insertion legitime non dupliquee: OK (`INSERT 0 1` dans transaction de test puis `ROLLBACK`)
  - integrite:
    - `stock_balance.quantity < 0`: `0` ligne
  - vues operationnelles:
    - `stock_per_piece`: lisible (`2` lignes)
    - `stock_journal`: lisible (`4` lignes)
    - `piece_movements`: lisible (`4` lignes)
  - EXPLAIN requetes critiques:
    - lookup source (`source_type+source_id+direction`) utilise `ux_stock_movements_no_duplicate_core` / `idx_stock_movements_source_id_direction`
    - journal filtre `source_type` utilise `idx_stock_movements_source_id_direction`
    - FIFO force (`piece_ref + order created_at,id`) couvre `idx_stock_movements_piece_created_id`
- Qualite projet:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - warning non bloquant observe au build: `baseline-browser-mapping` data > 2 mois

### Perimetre / limites

- Aucun changement de schema distant Supabase.
- Aucune commande d'ecriture remote executee.
- Aucun ajout de secret sensible dans le repo.
- Aucun changement de logique metier applicative (scope strict DB + docs F1.4).
- Aucun changement F1.5+ (pas de healthcheck metier SQL additionnel).

## 2026-02-16 - F1.5 Healthcheck SQL des anomalies metier

Statut: `FAIT`

### Changements realises

- Creation de la migration incrementale:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/migrations/20260216164515_f1_5_healthcheck_sql_anomalies.sql`
- Ajouts DB dans la migration:
  - creation de la vue canonique `public.healthcheck_business_anomalies_v1`
  - contrat de sortie stable `v1` (14 colonnes):
    - `contract_version`
    - `anomaly_code`
    - `anomaly_family`
    - `severity`
    - `entity_table`
    - `entity_id`
    - `sale_id`
    - `sale_item_id`
    - `lot_id`
    - `movement_id`
    - `piece_ref`
    - `expected_quantity`
    - `observed_quantity`
    - `details`
  - couverture des anomalies:
    - `CONFIRMED_SALE`: `SALE_CONFIRMED_WITHOUT_ITEMS`, `SALE_ITEM_WITHOUT_SNAPSHOT`, `SALE_ITEM_MOVEMENT_QTY_MISMATCH`
    - `ORPHAN_MOVEMENT`: `ORPHAN_PURCHASE_MOVEMENT`, `ORPHAN_SALE_MOVEMENT`, `ORPHAN_SALE_CANCEL_MOVEMENT`, `ORPHAN_SALE_EDIT_MOVEMENT`
    - `INVENTORY_INCONSISTENCY`: `LOT_TOTAL_PIECES_MISMATCH`, `CONFIRMED_LOT_PURCHASE_INVENTORY_QTY_MISMATCH`
    - `NEGATIVE_STOCK`: `NEGATIVE_STOCK_BALANCE_ROW`
  - grants de lecture explicites sur la vue pour `anon`, `authenticated`, `service_role`
- Strategie appliquee:
  - audit `fail-open` (aucun blocage de migration sur anomalies metier detectees)
  - aucun changement des contraintes/triggers F1.3/F1.4
- Mise a jour documentation F1.5:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md` (cette entree)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info`: OK (Docker engine `29.2.0`)
  - `npx supabase status`: OK (stack locale active)
- Validation rejouabilite locale:
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local --debug`: OK (baseline + F1.3 + F1.4 + F1.5 + seed)
  - `npx supabase db reset --local`: OK (validation finale en mode standard)
- Verification SQL post-migration (DB locale):
  - vue `public.healthcheck_business_anomalies_v1`: presente
  - contrat colonnes/types: conforme (14 colonnes attendues)
  - etat nominal apres reset:
    - `anomalies total`: `0`
    - `stock_balance.quantity < 0`: `0`
  - tests d'injection controles (transaction + rollback): OK
    - `SALE_CONFIRMED_WITHOUT_ITEMS`: detecte (`detected_rows=1`)
    - `ORPHAN_SALE_MOVEMENT`: detecte (`detected_rows=1`)
    - `LOT_TOTAL_PIECES_MISMATCH`: detecte (`detected_rows=1`)
    - `CONFIRMED_LOT_PURCHASE_INVENTORY_QTY_MISMATCH`: detecte (`detected_rows=1`)
    - post-rollback: `anomalies total = 0`
  - non-regression F1.3/F1.4: OK
    - garde-fou anti-stock negatif: actif (test negatif bloque, `stock_balance.quantity < 0 = 0`)
    - anti-doublon metier: actif (`unique_violation` capturee sur tentative de doublon)
  - vues metier existantes toujours lisibles:
    - `stock_per_piece`: OK (`2` lignes seed)
    - `stock_journal`: OK (`4` lignes seed)
    - `piece_movements`: OK (`4` lignes seed)
- Qualite projet:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - warning non bloquant observe au build: `baseline-browser-mapping` data > 2 mois

### Perimetre / limites

- Aucun changement de schema distant Supabase.
- Aucune commande d'ecriture remote executee.
- Aucun ajout de secret sensible dans le repo.
- Aucun changement de logique metier applicative.
- Aucun changement F2+.

## 2026-02-16 - Correctif securite npm `supabase/tar`

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json`:
  - ajout de l'override npm:
    - `supabase -> tar@7.5.9`
- Regeneration du lockfile:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package-lock.json`
- Mise a jour gouvernance roadmap:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F0.4`)

### Verifications executees

- Stabilisation npm:
  - `chown -R $(id -u):$(id -g) ~/.npm`: OK
  - `npm config get cache`: OK (`/Users/bastienchristlen/.npm`)
  - `npm ping`: OK (`PONG`)
- Baseline vulnerabilites:
  - `npm ls supabase tar`: OK (`supabase@2.65.10 -> tar@7.5.2`)
  - `npm audit`: KO attendu (`2 high` sur `tar <= 7.5.6`)
- Apres correctif:
  - `npm install`: OK (`changed 1 package`)
  - `npm ls supabase tar`: OK (`tar@7.5.9 overridden`)
  - `npm audit`: OK (`found 0 vulnerabilities`)
- Smoke test Supabase CLI:
  - `npx supabase --version`: OK (`2.65.10`)
  - `npx supabase --help`: OK
  - `npx supabase status`: OK (stack locale active)
- Gates techniques:
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK

### Perimetre / limites

- Aucun changement de logique applicative.
- Aucun changement de schema DB (local/remote).
- Aucune ecriture distante Supabase.
