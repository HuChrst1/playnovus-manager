# ROADMAP - Plan d'implementation sans dates

Perimetre: finaliser PlayNovus Manager avec fiabilite metier, coherence UX et qualite stricte.

## Regles de pilotage

- aucune date dans cette roadmap: execution en flux rapide par feature
- un agent Codex = une feature (granularite volontairement fine)
- stock pilote uniquement par les entrees via Approvisionnement (lots confirmes)
- stock pilote uniquement par les sorties via Ventes (FIFO)
- annulations visibles par defaut dans Commandes (historique conserve)
- KPIs contextuels alignes strictement au perimetre du tableau filtre (strategie tableau-first)
- entree "Nouvelle vente" via pop-up depuis `/ventes`
- strategie DB: baseline initiale + migrations incrementales versionnees
- niveau qualite: zero erreur bloquante

## Legende statut

- `A FAIRE`: pas demarre
- `EN COURS`: implementation en cours
- `FAIT`: livre et valide
- `BLOQUE`: dependance manquante

## Phase 0 - Qualite globale (gate bloquant)

Statut global: `FAIT`

### F0.1 - Standardiser les scripts qualite

Statut: `FAIT`
Objectif: disposer d'une base de verification unique.
Livrables:
- `package.json`: scripts `typecheck`, `test`, `test:unit`, `test:e2e`, `lint`
- README de commandes projet mises a jour
Definition of done:
- commandes executees sans erreur de configuration

### F0.2 - Nettoyage lint domaine Ventes/FIFO

Statut: `FAIT`
Objectif: supprimer les erreurs lint et types instables des flux critiques.
Fichiers cibles prioritaires:
- `src/app/actions/sales.ts`
- `src/app/ventes/nouvelle/NewSaleForm.tsx`
- `src/lib/sales.ts`
- `src/lib/stock.ts`
Livrables realises:
- lint cible vert sur le perimetre F0.2 (plus d'erreurs/warnings sur les fichiers cibles)
- suppression des `any` explicites non justifies sur le flux Ventes/FIFO cible
- stabilisation des types sur les actions ventes et le formulaire (sans changement de logique metier FIFO)
- correctif edition stock virtuel (`PIECE + SET`) pour comparer la demande a `stock actuel + stock de la vente editee`
- propagation de `stockCreditByPieceRef` dans le flux d'edition (`getSaleDraftForEditAction` -> `EditSaleDialog` -> `NewSaleForm`)
Definition of done:
- plus d'erreurs ESLint dans ces fichiers
- aucun `any` non justifie

### F0.3 - Nettoyage lint UI shared + Catalogue/Appro/Stock

Statut: `FAIT`
Objectif: passer le repo sur une base saine.
Fichiers cibles:
- composants UI (`src/components/ui/*`)
- pages Catalogue/Appro/Stock
- composants ventes annexes
Livrables realises:
- suppression des erreurs/warnings lint sur les composants UI shared, pages Catalogue/Appro/Stock et composants ventes annexes
- corrections de typage minimales sans changement de logique metier (suppression des `any`, catches `unknown`, typage payloads Supabase)
- corrections lint minimales additionnelles sur `src/components/dashboard/DashboardStatCard.tsx` et `src/lib/import-data.ts` pour atteindre `0 warning` global
- correction typecheck/build sur `src/app/approvisionnement/[id]/page.tsx` et `src/app/catalogue/actions.ts` (typage uniquement, logique inchangee)
Definition of done:
- `npm run lint` vert global
- `npm run build` vert

### F0.4 - Gouvernance securite dependances npm (supabase/tar)

Statut: `FAIT`
Objectif: eliminer les vulnerabilites high de la chaine outillage npm sans impacter le runtime applicatif.
Livrables realises:
- override npm ajoute pour forcer `tar` patche sous `supabase` (`tar > 7.5.6`)
- verification `npm audit` a `0 vulnerability`
- note de gouvernance:
  - conserver l'override tant que `supabase` pinne une version `tar` vulnereable
  - a chaque upgrade `supabase`, retester sans override
  - retirer l'override quand `supabase` embarque nativement une version `tar` corrigee
Definition of done:
- `npm ls supabase tar` montre `tar` patche sous `supabase`
- `npm audit` ne remonte plus de high sur `tar`

### F0.5 - Audit npm prod + mitigation dev-only lint chain

Statut: `FAIT`
Objectif: garantir `0` vulnerabilite npm globale (prod + dev) sans `npm audit fix --force`.
Livrables realises:
- scripts npm ajoutes:
  - `audit:prod`: `npm audit --omit=dev --audit-level=moderate`
  - `audit:deps`: `npm ls ajv @eslint/eslintrc eslint || true`
- migration outillage lint:
  - suppression de `eslint` et `eslint-config-next` des devDependencies
  - ajout de `@biomejs/biome`
  - remplacement du script `lint` par:
    - `lint:biome` (`biome lint .`)
    - `lint:next-img-guard` (`node scripts/check_no_img_element.mjs`)
- ajout de `biome.json` (profil bloqueur limite au perimetre fiabilite, sans reformat global)
- suppression de `eslint.config.mjs`
- ajout d'un garde-fou Next minimal sur `<img>`:
  - seules les 3 occurrences legacy catalogue sont autorisees
  - toute nouvelle occurrence hors allowlist fait echouer `npm run lint`
- lockfile regenere avec disparition de la chaine `eslint -> @eslint/eslintrc -> ajv`
Definition of done:
- `npm audit` vert (`0 vulnerabilities`)
- `npm run audit:prod` vert
- `npm run audit:deps` ne montre plus `eslint/@eslint/eslintrc/ajv`
- `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:f2.0` verts

## Phase 1 - DB versionnee et garde-fous

Statut global: `FAIT`

### F1.1 - Initialiser les migrations versionnees

Statut: `FAIT`
Objectif: rendre l'etat DB reproductible dans le repo.
Livrables realises:
- dossier `supabase/migrations/` initialise
- migration baseline depuis la DB reelle: `supabase/migrations/20260215214134_f1_1_baseline_public.sql`
- snapshot de securite pre-baseline: `supabase/_snapshots/pre_f1_1_public.sql`
- mise a jour `supabase/config.toml` (`[db.seed].enabled = false` en attente F1.2)
- regeneration des types Supabase: `src/types/supabase.ts`
Definition of done:
- schema rejouable localement a partir du repo

### F1.2 - Ajouter un seed minimal executable

Statut: `FAIT`
Objectif: avoir un reset local cohérent.
Livrables realises:
- `supabase/seed.sql` cree (seed SQL minimal executable)
- reactivation du seed local dans `supabase/config.toml` (`[db.seed].enabled = true`)
- jeu minimal coherent avec flux Appro/Ventes/Stock:
  - 1 set + BOM multi-pieces
  - 1 lot confirme + mouvements `PURCHASE/IN`
  - 1 vente `CONFIRMED` + 1 ligne + details `sale_item_pieces`
  - mouvements `SALE/OUT` coherents relies a la ligne de vente
Definition of done:
- `npx supabase db reset --local` execute sans erreur (baseline + seed)

### F1.3 - Bloquer le stock negatif au niveau DB

Statut: `FAIT`
Objectif: interdire toute ecriture menant a stock < 0.
Livrables realises:
- migration incrementale `supabase/migrations/20260216134316_f1_3_block_negative_stock.sql`
- contrainte `ck_stock_balance_qty_nonneg` sur `public.stock_balance`
- trigger/fonctions SQL anti-stock negatif avec message explicite
- contrainte `ck_stock_movements_lot_required_inout` pour imposer `lot_id` sur `IN/OUT`
Definition of done:
- une sortie invalide est rejetee par la DB avec message explicite

### F1.4 - Anti-doublons de mouvements + indexes perf

Statut: `FAIT`
Objectif: fiabilite et performance du ledger.
Livrables realises:
- migration incrementale `supabase/migrations/20260216144649_f1_4_anti_duplicate_movements_indexes.sql`
- fail-fast pre-migration sur donnees invalides:
  - lignes coeur sans `source_id` exploitable (`PURCHASE`, `SALE`, `SALE_CANCEL`)
  - doublons existants sur la cle metier `(source_type, source_id, piece_ref, lot_id, direction)`
- contrainte `ck_stock_movements_source_id_required_core` sur `public.stock_movements`
- index unique partiel anti-doublon `ux_stock_movements_no_duplicate_core` sur la cle metier coeur
- index lookup source `idx_stock_movements_source_id_direction` sur `(source_type, source_id, direction)`
- suppression des indexes source strictement redondants:
  - `idx_stock_movements_source`
  - `stock_movements_source_type_id_idx`
Definition of done:
- doublon bloque
- requetes critiques conservees performantes (plans EXPLAIN coherents)

### F1.5 - Healthcheck SQL des anomalies metier

Statut: `FAIT`
Objectif: auditer l'integrite metier avant release.
Livrables realises:
- migration incrementale `supabase/migrations/20260216164515_f1_5_healthcheck_sql_anomalies.sql`
- vue SQL canonique `public.healthcheck_business_anomalies_v1` (audit fail-open, non bloquant)
- contrat de sortie stable `v1` (14 colonnes): `contract_version`, `anomaly_code`, `anomaly_family`, `severity`, `entity_table`, `entity_id`, `sale_id`, `sale_item_id`, `lot_id`, `movement_id`, `piece_ref`, `expected_quantity`, `observed_quantity`, `details`
- couverture des anomalies metier:
  - ventes `CONFIRMED` sans mouvements attendus (incluant reconciliation quantitative snapshot vs `SALE/OUT`)
  - mouvements orphelins flux coeur (`PURCHASE`, `SALE`, `SALE_CANCEL`, `SALE_EDIT`)
  - incoherences inventory (double controle: `lots.total_pieces` vs somme `inventory`, et `inventory` vs `PURCHASE/IN` pour lots `confirmed`)
  - stock negatif (`stock_balance.quantity < 0`)
- grants `SELECT` sur la vue pour `anon`, `authenticated`, `service_role`
Definition of done:
- healthcheck disponible, documente, et rejouable via `npx supabase db reset --local`

### F1.6 - Hardening securite Supabase (RLS + views invoker + grants)

Statut: `FAIT`
Objectif: corriger les alertes Supabase `security_definer_view` et `rls_disabled_in_public` sans regression fonctionnelle.
Livrables realises:
- migration incrementale:
  - `supabase/migrations/20260218201000_f1_6_security_rls_views.sql`
- vues basculees en `security_invoker=true`:
  - `set_completion`, `stock_per_piece`, `sold_pieces_journal`, `piece_movements`, `set_with_completion`, `sale_item_movements`, `stock_journal`
- RLS active sur tables exposees:
  - `lots`, `inventory`, `sets_bom`, `sets_catalog`, `transactions`, `stock_balance`, `sale_items`, `sales`, `stock_movements`, `sale_item_pieces`
- policies de compatibilite creees (`FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)`) pour conserver les flux actuels sans auth applicative
- nettoyage des privileges cible:
  - vues: `anon/authenticated` en lecture seule (`SELECT`)
  - tables: `anon/authenticated` en CRUD (`SELECT, INSERT, UPDATE, DELETE`)
  - `service_role` non modifie
Definition of done:
- `npx supabase db reset --local` vert avec migration F1.6
- `relrowsecurity = true` sur les 10 tables cibles
- `security_invoker=true` present sur les 7 vues cibles
- grants conformes (vues en `SELECT`, tables en CRUD) pour `anon/authenticated`
- non-regression `lint/typecheck/build/test:f2.0` confirmee

### F1.7 - Follow-up securite: healthcheck invoker + search_path functions

Statut: `FAIT`
Objectif: supprimer l'erreur Supabase restante (`security_definer_view`) et les warnings `function_search_path_mutable` sans regression UX.
Livrables realises:
- migration incrementale:
  - `supabase/migrations/20260218224500_f1_7_security_followup_healthcheck_functions.sql`
- vue healthcheck basculee en `security_invoker=true`:
  - `healthcheck_business_anomalies_v1`
- `search_path` fige sur fonctions ciblees:
  - `reset_sales_id_sequence()`
  - `apply_stock_balance_from_movements()`
  - `apply_stock_balance_delta(text, bigint, bigint)`
  - `reject_negative_stock_balance()`
- policies RLS de compatibilite F1.6 conservees (warnings `rls_policy_always_true` assumes temporairement pour eviter toute regression des flux `anon`)
Definition of done:
- plus d'erreur `security_definer_view` sur `healthcheck_business_anomalies_v1`
- plus de warning `function_search_path_mutable` sur les 4 fonctions ciblees
- non-regression `lint/typecheck/build/test:f2.0` confirmee

## Phase 2 - Verrouillage Approvisionnement et Stock

Statut global: `EN COURS`

### F2.0 - Suppression lot confirme + synchronisation statut/stock

Statut: `FAIT`
Objectif: corriger un approvisionnement confirme tout en conservant la coherence stock/historique.
Livrables realises:
- suppression autorisee des lots `draft` et `confirmed` (y compris `LOT_0`) si aucune vente liee
- suppression des effets stock/historique du lot via retrait des mouvements `PURCHASE`
- blocage explicite si lot deja utilise en ventes (`LOT_USED_BY_SALES` + guidage ids ventes)
- synchronisation statut/stock:
  - `draft -> confirmed`: recreation des mouvements `PURCHASE`
  - `confirmed -> draft`: retrait des mouvements `PURCHASE` avec blocage si ventes liees
Definition of done:
- coherence stock/historique verifiee sur transitions `draft/confirmed`
- suppression lot confirme possible sans suppression en cascade des ventes
- revalidation merge-readiness completee en local (checks SQL + gates `lint/typecheck/build` verts)
- ecart remote observe en lecture seule sur le snapshot `pre_f2_0_public.sql` (objets F1.3/F1.4/F1.5 absents), sans ecriture distante
- cleanup remote des lots de test F2.0 realise en passe controlee (suppression ciblee uniquement)
- script de validation reproductible local disponible: `npm run test:f2.0` (scenarios F2.0 + checks F1.3/F1.4/F1.5)

### F2.1 - Garde-fou serveur lot vide non confirmable

Statut: `FAIT`
Objectif: impossible de confirmer un lot a `total_pieces = 0` et creation de lot forcee en `draft`.
Fichiers cibles:
- `src/app/approvisionnement/action.ts`
Livrables realises:
- blocage serveur sur la transition `draft -> confirmed` si `lots.total_pieces <= 0`
- message explicite et actionnable: `Impossible de confirmer un lot vide. Ajoute au moins une piece avant de confirmer.`
- refus applique avant toute tentative de creation de mouvements `PURCHASE`
- creation directe d'un lot `confirmed` refusee cote serveur avec message explicite
- UI `Nouveau lot` alignee en mode draft-first (creation en brouillon uniquement)
Definition of done:
- la server action refuse explicitement la confirmation d'un lot vide
- aucun mouvement `PURCHASE` cree quand la confirmation est refusee
- confirmation d'un lot non vide conservee
- creation d'un lot forcee en `draft` (pas de creation directe `confirmed`)

### F2.2 - Alignement UI Appro sur la regle lot vide

Statut: `FAIT`
Objectif: aligner l'UI Appro avec la regle lot vide via un blocage explicite a la soumission.
Fichiers cibles:
- `src/app/approvisionnement/EditLotDialog.tsx`
- `src/app/approvisionnement/[id]/page.tsx`
- `src/app/approvisionnement/page.tsx`
Livrables realises:
- garde client ajoute dans `EditLotDialog` avant appel serveur:
  - tentative `draft -> confirmed` bloquee si `lot.total_pieces <= 0`
- message UI inline explicite et actionnable:
  - `Impossible de confirmer un lot vide. Ajoute au moins une piece avant de confirmer.`
- comportement UX retenu preserve:
  - option `Confirme` selectionnable
  - blocage applique au clic `Enregistrer` quand lot vide
- confirmation d'un lot non vide conservee
- garde-fou serveur F2.1 conserve en filet de securite (contournement UI toujours refuse)
Definition of done:
- lot vide: confirmation bloquee en UI avec message clair
- lot non vide: confirmation UI toujours possible
- aucun mouvement `PURCHASE` cree quand la confirmation d'un lot vide est refusee
- non-regression F2.0 + F1.3/F1.4/F1.5 confirmee

### F2.3 - Confirmation lot atomique fonctionnelle

Statut: `FAIT`
Objectif: pas de lot `confirmed` sans mouvements `IN` effectifs.
Livrables realises:
- confirmation `draft -> confirmed` durcie cote serveur avec snapshot inventory au moment de la confirmation
- refus explicite si inventory du lot est vide/invalide, meme en cas de `lots.total_pieces` incoherent
- garde de conflit sur transition de statut (`update ... where id=? and status='draft'`) avec message de rechargement
- compensation verifiee en cas d'echec intermediaire:
  - restauration des mouvements `PURCHASE`
  - restauration du lot en `draft`
  - verification post-rollback
- verification post-condition de confirmation:
  - lot confirme
  - `sum(inventory.quantity)` == `sum(PURCHASE/IN)` pour le lot
- enrichissement des raisons metier retournees (`LOT_CONFIRMATION_CONFLICT`, `LOT_CONFIRMATION_INCONSISTENT`, `LOT_CONFIRMATION_ROLLBACK_FAILED`)
- extension du script `npm run test:f2.0` avec scenarios F2.3 et non-regressions F2.4
Definition of done:
- aucun etat intermediaire incoherent observe
- lot `confirmed` sans `PURCHASE/IN` coherent non observable en validation locale
- echec intermediaire de confirmation restaure un etat coherent (draft + absence de `PURCHASE`)
- non-regression F2.0/F2.1/F2.2/F2.4 + F1.3/F1.4/F1.5 confirmee en local

### F2.4 - Auto-attribution LotID a la creation

Statut: `FAIT`
Objectif: supprimer la saisie manuelle du LotID a la creation et attribuer automatiquement `LOT_N`.
Fichiers cibles:
- `src/app/approvisionnement/action.ts`
- `src/app/approvisionnement/NewLotDialog.tsx`
Livrables realises:
- generation serveur du prochain LotID au format `LOT_N` via regle `max+1` sur les codes existants
- suppression de la saisie `LotID` dans la modale `Nouveau lot`
- gestion defensive des collisions d'unicite (`lots_lot_code_key`) avec retry
- edition manuelle de `lot_code` conservee dans l'ecran d'edition de lot
- table `/approvisionnement` rendue cliquable sur toute la ligne (hors elements d'action interactifs)
- suppression de `LOT_0` explicitement interdite (lot initial protege)
- renumerotation automatique des codes `LOT_n` apres suppression d'un lot:
  - pour tout `k > n`, `LOT_k` devient `LOT_{k-1}`
  - les codes personnalises (hors format `LOT_n`) sont ignores
Definition of done:
- creation d'un nouveau lot sans champ LotID manuel
- attribution automatique incrementale (`LOT_1`, `LOT_2`, ...)
- navigation vers `/approvisionnement/[id]` possible via clic sur n'importe quelle cellule de la ligne
- suppression de `LOT_0` refusee avec message explicite
- suppression de `LOT_n` declenche un decalage automatique des `LOT_k` superieurs
- aucun changement SQL/migration
- non-regression des regles F2.0/F2.1/F2.2

## Phase 3 - Ventes/Commandes + KPIs + contrat data unique

Statut global: `FAIT`

### F3.1 - Contrat query standardise pour `/ventes`

Statut: `FAIT`
Objectif: un contrat query canonique v2 unique pour liste + KPIs.
Parametres:
- `include_cancelled=true|false` (defaut `true`)
- `channel`
- `sale_type`
- `sort`
- `dir`
- `page`
- `from` (`YYYY-MM-DD`)
- `to` (`YYYY-MM-DD`)
Livrables realises:
- parsing/normalisation canonique dans `src/app/ventes/page.tsx`
- fallback strict sur toutes valeurs invalides:
  - `include_cancelled=true`, `sort=paid_at`, `dir=desc`, `page=1`
  - `channel` vide supprime, `sale_type` invalide ignore
- normalisation `from/to`:
  - format strict `YYYY-MM-DD`
  - dates invalides ignorees
  - inversion automatique si `from > to`
- redirection automatique vers URL canonique (`/ventes?...`) et suppression des cles legacy (`period`, `stats_window_*`)
- conservation des filtres actifs dans tri/pagination via `baseQuery` transmis a `SalesTable`
- application du contrat:
  - table: `include_cancelled`, `channel`, `sale_type`, `sort`, `dir`, `page`, `from`, `to`
  - KPIs: meme perimetre que le tableau (strategie tableau-first)
- retrait de `period` du flux canonique actif (compat legacy via redirection)
- `src/lib/sales.ts` aligne sur `sale_type` (compat legacy `type` conservee)
Definition of done:
- contrat documente et utilise par la page

### F3.2 - Creer `getSalesPageData(filters)` dans `src/lib/sales.ts`

Statut: `FAIT`
Objectif: centraliser les donnees `/ventes` (table + KPI + deltas + compteurs).
Livrables realises:
- ajout de `getSalesPageData(filters, client?)` dans `src/lib/sales.ts`
- ajout d'un contrat data unique:
  - `SalesPageFilters`
  - `SalesPageData` (table + pagination + KPIs + deltas + compteurs en-tete)
- centralisation dans la lib:
  - listing table (tri/pagination/filtres existants, dont `from/to`)
  - KPIs alignes au meme perimetre que le tableau filtre
  - deltas comparatifs conserves pour compatibilite data
  - compteurs `confirmed/cancelled` alignes au perimetre filtre
- refactor de `src/app/ventes/page.tsx`:
  - conservation du contrat query F3.1 (normalisation + redirection canonique + `baseQuery`)
  - suppression de la logique KPI/dispersée dans la page
  - consommation unique de `getSalesPageData(...)`
- neutralisation des deltas en presentation UI (cards simplifiees)
- fallback preserve:
  - erreurs KPI/count => fallback visible (`0`/`—`) sans crash
  - erreur listing => echec explicite
Definition of done:
- `src/app/ventes/page.tsx` ne fait plus de logique KPI dispersee

### F3.3 - Pivot KPI cards simplifiees + strategie tableau-first + filtre date compact

Statut: `FAIT`
Objectif: simplifier les cards KPI et aligner strictement KPI/table.
Livrables realises:
- cards KPI en mode minimal (`libelle + valeur`) sur `/ventes`, `/approvisionnement`, `/stock`
- suppression des elements visuels d'evolution/periode dans les cards (tendance, vs N jours, boutons integres)
- ajout du filtre date compact (`from/to`) sur `/ventes` et `/approvisionnement` (bouton + panneau)
- suppression des anciens parametres actifs de fenetre KPI (`period`, `stats_window_*`) du flux canonique
- KPIs calcules sur le meme perimetre que le tableau courant (global par defaut, sous-ensemble si filtre actif)
Definition of done:
- coherence KPI/table validee sur le perimetre filtre

### F3.4 - Conserver l'historique annule dans la table Commandes

Statut: `FAIT`
Objectif: finaliser l'ergonomie du filtre de statut sur `/ventes`.
Livrables realises:
- base query et contrat `include_cancelled` actifs cote SSR
- historique `CANCELLED` conserve dans la table selon les filtres actifs
- ajout d'un controle UI explicite de statut (2 modes) pour piloter `include_cancelled` sans edition manuelle de l'URL
- reset pagination sur `page=1` lors du changement de mode statut
- conservation des autres filtres actifs (`channel`, `sale_type`, `sort`, `dir`, `from`, `to`) lors du changement de mode statut
- masquage de l'indicateur `annulees` dans l'en-tete quand `include_cancelled=false`
Definition of done:
- controle statut explicite finalise et non regressif

### F3.5 - Unifier l'entree Nouvelle vente (pop-up)

Statut: `FAIT`
Objectif: un seul parcours UX.
Livrables realises:
- `/ventes/nouvelle` redirige vers `/ventes?new=1`
- `/ventes` accepte l'intent URL `new=1` dans la canonicalisation SSR
- `new=1` ouvre automatiquement la pop-up `Nouvelle vente` sans clic
- fermeture pop-up depuis `new=1`:
  - fermeture UI
  - nettoyage URL (suppression de `new`, conservation des filtres actifs)
- soumission reussie depuis `new=1`:
  - fermeture pop-up
  - nettoyage URL (suppression de `new`)
  - refresh de la liste
- entree existante par bouton `Nouvelle vente` conservee
Definition of done:
- plus de flux paralleles divergents

### F3.6 - Finaliser audit interne sans page globale pieces vendues

Statut: `FAIT`
Objectif: conserver le choix produit "Commandes + drilldown".
Livrables realises:
- drilldown commande disponible (`/ventes/[id]`)
- drilldown item commande maintenu (`/ventes/[id]/[saleItemId]`)
- suppression des restes UI/composants non branches:
  - `src/components/sales/SoldPiecesTable.tsx`
  - `src/components/sales/SaleDetailDialog.tsx`
- detail commande durci en `404` sur vente introuvable (plus d'ecran debug JSON)
- verification explicite:
  - aucune entree UI active vers une liste globale "pieces vendues"
  - non-regression du contrat query `/ventes` (`include_cancelled`, `channel`, `sale_type`, `sort`, `dir`, `page`, `from`, `to`)
Definition of done:
- audit complet possible depuis une commande

### F3.7 - Nettoyage des composants KPI legacy non utilises

Statut: `FAIT`
Objectif: supprimer les composants KPI obsoletes apres le pivot tableau-first.
Livrables realises:
- retrait des composants legacy non utilises:
  - `src/components/sales/SalesStatCardWithDialog.tsx`
  - `src/components/dashboard/StatCardWithDialog.tsx`
  - `src/app/approvisionnement/ApproStatsSection.tsx` et composants associes orphelins
- verification qu'aucune route active ne depend encore des variantes legacy
Definition of done:
- plus aucun composant KPI legacy orphelin dans le flux actif

## Phase 4 - Dashboard complet branche aux vraies donnees

Statut global: `EN COURS`

### F4.1 - Creer `src/lib/dashboard.ts`

Statut: `FAIT`
Objectif: centraliser les calculs dashboard.
Livrables realises:
- agregats consolides (CA net, marge nette, valeur stock, cout appro)
- structure de retour stable pour UI dashboard
- contrat data typé stable (v1) pret pour F4.2:
  - `DashboardDateRangeInput`, `DashboardDateRange`
  - `DashboardMetric`, `DashboardIssueCode`, `DashboardData`
  - `normalizeDashboardDateRange(...)`
  - `getDashboardData(client, input?)`
- normalisation des bornes date (`YYYY-MM-DD`, inversion auto si `from > to`)
- fallback non bloquant avec signal explicite de donnee partielle (`quality=partial`, `issues`)
- aggregation paginee defensive (respect `max_rows=1000`) sur:
  - `sales` (`status='CONFIRMED'`, fallback marge `net - cost` si marge null)
  - `lots` (`status='confirmed'`)
  - `stock_per_piece` (snapshot courant non borne par periode)
Definition of done:
- pas de calcul metier eparpille dans `src/app/page.tsx`

### F4.2 - Remplacer le placeholder de `src/app/page.tsx`

Statut: `FAIT`
Objectif: afficher un dashboard reel.
Livrables realises:
- dashboard `/` branche sur `getDashboardData(...)` avec client serveur `supabaseServer`
- contrat URL canonique `/`:
  - params supportes `from`, `to` uniquement
  - normalisation `YYYY-MM-DD`, inversion auto `from > to`, invalides ignores
  - redirection SSR vers URL canonique
- cards KPI alimentees DB (sans valeurs fictives):
  - CA net
  - marge nette
  - valeur stock
  - cout approvisionnements
- cards KPI cliquables avec detail F4.2:
  - definition metier
  - periode active
  - scope de calcul
  - etat qualite (`ok|partial`) + issue eventuelle
- filtre periode global partage (`from/to`) avec reset/apply
- signal explicite de donnees partielles:
  - bandeau d'alerte visible si `partial=true`
  - messages metier derives de `issues`
  - affichage `—` sur KPI partiel (pas de faux `0`)
- liens rapides vers `/approvisionnement`, `/ventes`, `/stock`, `/catalogue`
Definition of done:
- plus aucun chiffre fictif dans le dashboard

### F4.3 - Dashboard V2 Hub analytique + drilldowns existants

Statut: `FAIT`
Objectif: transformer `/` en hub de pilotage riche, oriente profit/cash, sans creer de nouveaux ecrans analytiques dedies.
Livrables realises:
- contrat URL canonique `/` aligne Dashboard V2:
  - params supportes `preset`, `from`, `to`
  - presets `total|90|30|7|custom`
  - canonicalisation SSR (dates invalides ignorees, permutation auto si `from > to`, `from/to` force `preset=custom`)
- nouvel agregateur `getDashboardHubData(...)` dans `src/lib/dashboard.ts` (compat `getDashboardData` v1 conservee):
  - contrat `dashboard.v2`
  - 8 KPI de tete: CA net, marge nette, taux de marge, commandes confirmees, panier moyen, cout approvisionnements, valeur stock, rotation stock (proxy)
  - comparaison vs periode precedente equivalente quand applicable
  - series/diagnostics:
    - trend business (CA/marge/cout ventes)
    - mix ventes par canal + type SET/PIECE
    - bridge profit (CA -> cout ventes -> marge)
    - pression flux appro vs cout ventes (hebdo)
    - concentration stock (top immobilisations)
    - age du stock (repartition par anciennete)
    - opportunites catalogue (top sets completion)
  - alertes actionnables:
    - quality issues (`partial`, `issues`)
    - anomalies metier healthcheck
- refonte complete de `src/app/page.tsx`:
  - layout hub dense (KPI + blocs graphiques + table opportunites + alertes)
  - filtre global chips + plage libre
  - cartes KPI cliquables avec details metier et drilldowns
  - drilldowns vers pages existantes uniquement (`/ventes`, `/approvisionnement`, `/stock`, `/historique-stock`, `/catalogue`)
- visualisations implementees avec Recharts (phase A sans migration SQL)
- robustesse donnee partielle conservee: rendu non bloquant, signal explicite, aucune valeur business fictive
Definition of done:
- dashboard `/` fournit une lecture decisionnelle complete en 4 niveaux (KPI, tendances, diagnostic, action)
- chaque KPI/bloc expose un drilldown operationnel
- aucune migration SQL ajoutee pour F4.3

### F4.4 - Extensions analytiques avancees (phase B)

Statut: `FAIT`
Objectif: etendre les analyses apres validation usage metier reel.
Livrables realises:
- extensions analytiques additives sur le contrat `dashboard.v3` (sans rupture):
  - `forecast` (projections 30j/90j, fiabilite, signal achat global `ACCELERER|STABLE|FREINER`)
  - `salesChannelCohorts` (cohortes par `sales_channel`, part CA/marge, mix sets/pieces)
  - `sourcingChannelLeadTime` (canal d'appro = `lots.supplier` normalise, mediane/P75, lots non vendus)
  - `themeRotation` (famille = `sets_catalog.theme`, rotation commerciale + couverture stock proxy + signal par theme)
- bloc "Pilotage achats/stock" enrichi (dashboard + modale):
  - apercu projection/signal directement visible sur `/`
  - modale etendue en 4 sections actionnables:
    - projection cash/profit
    - cohortes canaux ventes
    - lead-time canaux d'approvisionnement
    - rotation par theme
- gestion explicite de donnees insuffisantes:
  - section visible (non masquee) + message explicite:
    - `manque de donnees pour formuler une analyse fiable`
  - valeurs non fiables affichees en `—`
  - `partial/issues/quality` conserves avec nouveaux codes F4.4 dedies
- perimetre et compatibilite respectes:
  - aucun changement des query params publics (`preset`, `from`, `to`)
  - aucune regression UX V3.2.x (header compact, filtre inline, modales)
  - aucune migration SQL ajoutee pour F4.4
Definition of done:
- nouvelles analyses activees uniquement si elles restent actionnables et sans bruit decoratif

### F4.5 - Dashboard V3 aligne vision produit (blocs + modales etendues)

Statut: `FAIT`
Objectif: refondre `/` selon la vision produit verrouillee (11 KPI, blocs graphiques imposes, modales etendues).
Livrables realises:
- contrat URL canonique `/` stabilise:
  - params supportes `preset`, `from`, `to`
  - presets `7|30|90|12m|custom`
  - baseline V3 avant ajustements F4.6 (preset `total` officialise ensuite)
  - canonicalisation SSR stricte (dates invalides ignorees, permutation auto `from > to`, `from/to` force `preset=custom`, borne manquante en `custom` => plage 1 jour)
- dashboard `/` reconstruit en 5 blocs stricts:
  - bloc 1 sante financiere: 11 KPI (CA net, marge nette, taux marge, valeur stock, nb ventes, cout appro, cout moyen piece achetee, nb lots confirmes, panier moyen, rotation stock, taux immobilisation)
  - bloc 2 tendances temporelles: courbes CA+marge + histogramme empile ventes sets/pieces
  - bloc 3 comparaison sets vs pieces: grouped chart (switch CA/marge/taux) + tableau comparatif + pie CA 2 segments
  - bloc 4 pilotage achats/stock: histogramme achats mensuels + courbe tendance (correlation ventes en modal)
  - bloc 5 opportunites catalogue: table top sets par completion exploitable
- interaction modale etendue sur toutes les cartes KPI et tous les blocs:
  - overlay sombre + modale centree
  - animation dashboard-only: fade + scale `0.95 -> 1`, `150ms`, `ease-out`, fermeture inverse
  - contenu modal KPI: definition, formule, periode active, mini-serie KPI, filtres cibles
  - contenu modal blocs: vue agrandie + controles cibles + action secondaire vers pages operationnelles existantes
- comportements metier verrouilles implementes:
  - `12 mois` = `365 jours glissants`
  - rotation stock = `CA net periode / ((stock ouverture + stock cloture)/2)`
  - taux immobilisation = `valeur stock actuelle / CA cumule 12 mois`
  - cout moyen piece achetee calcule sur periode active
  - etat `partial=true` rendu non bloquant avec signal explicite + valeurs `—` si non interpretable
- hors scope explicite respecte:
  - suppression des sections `alertes actionnables` et `drilldowns rapides` de la page `/`
  - aucune migration SQL ajoutee
Definition of done:
- dashboard V3 strictement conforme a la composition demandee, sans derive F4.4+

### F4.6 - Dashboard V3.1 ajustements UX/UI (cards compactes + preset total)

Statut: `FAIT`
Objectif: finaliser l'experience dashboard avec une lecture plus compacte et des details via modales, sans changer le scope metier.
Livrables realises:
- preset `total` officialise et canonique sur `/`:
  - `DashboardPreset` etendu a `total|7|30|90|12m|custom`
  - route canonique par defaut `/?preset=total`
  - `preset` invalide -> fallback `total`
  - `custom` conserve avec `from/to` normalises (invalides ignores, permutation si `from > to`, borne unique => plage 1 jour)
  - `total` calcule sur l'historique reel: date min business disponible (`sales CONFIRMED` et `lots confirmed`) jusqu'a aujourd'hui
- refonte UI ciblee du dashboard:
  - titre principal `DASHBOARD`
  - suppression des chips permanentes
  - bouton `Filtrer` ouvrant un drawer lateral droit
  - timeline discrete dans le drawer: `Total`, `12m`, `90j`, `30j`, `7j` + mode `custom`
- layout bento compact:
  - cards miniatures pour les blocs 2->5 (plus de longues sections empilees)
  - une card = un apercu, detail en modale
- interaction card-first:
  - suppression des boutons `Agrandir`
  - ouverture des modales au clic sur toute la card (cards KPI + cards graphiques)
  - accessibilite clavier conservee (cartes interactives en bouton)
- modales ajustees:
  - modale KPI: valeur KPI clairement visible, formule masquee
  - modale bloc 3: navigation `Graphique | Tableau | Camembert` plus lisible et focalisee
  - animation dashboard-only conservee (overlay + pop 150ms ease-out)
Definition of done:
- dashboard dense et compact, detail reserve aux modales, preset par defaut `total` actif et canonique

### F4.7 - Dashboard V3.2 ajustements UX/UI (KPI unitaires + filtre inline + bento trend-dominant)

Statut: `FAIT`
Objectif: corriger les irritants UX restants du dashboard sans modifier le contrat data.
Livrables realises:
- bloc KPI simplifie:
  - suppression du grand wrapper "Sante financiere"
  - rendu direct `1 KPI = 1 card` (11 cards)
  - style KPI ajuste (suppression du contour visuel dur, fond pastel + ombre douce + ring leger)
  - densite desktop fixee a 5 colonnes
- filtre inline dans le header:
  - remplacement `Sheet` lateral par `Popover` ancre au bouton `Filtrer`
  - suppression de l'effet plein ecran assombri pour l'usage filtre
  - presets `Total/12m/90j/30j/7j` en application instantanee
  - mode `custom` conserve avec `from/to` + bouton `Appliquer`
  - reset cible `/?preset=total`
- layout bento trend-dominant:
  - grille non empilee `1 -> 2 -> 12 colonnes` selon breakpoints
  - bloc tendances dominant (`col-span-8`, `row-span-2` en desktop XL)
  - autres blocs repartis en cartes de tailles variees
  - previews graphiques compactes (hauteurs reduites, legendes masquees en preview)
- detail preserve:
  - cards toujours cliquables
  - modales detaillees conservees avec animation dashboard-only existante
Definition of done:
- dashboard plus dense et lisible, filtre non intrusif, disposition conforme au style bento cible

### F4.8 - Dashboard V3.2.1 uniformisation KPI + filtre popover horizontal a gauche

Statut: `FAIT`
Objectif: corriger les derniers ecarts visuels d'ergonomie sans toucher a la couche data.
Livrables realises:
- KPI unifies sur le style des autres cards dashboard:
  - suppression du rendu pastel/gradient specifique KPI
  - reprise du style `MinimalCardButton` (fond blanc, bordure legere, ombre douce, rayon identique)
- filtre popover repositionne:
  - ouverture a gauche du bouton `Filtrer` (`side=left`)
  - contenu reorganise en disposition horizontale
  - presets visibles sur une ligne avec application instantanee conservee
  - mode `custom` conserve (`from/to` + `Appliquer`) avec reset `/?preset=total`
- aucune modification du contrat data dashboard (`dashboard.v3`) ni des query params (`preset/from/to`)
Definition of done:
- rendu KPI coherent avec le reste du dashboard et filtre horizontal a gauche operationnel

### F4.9 - Dashboard V3.2.2 filtre inline horizontal sans overlap KPI + fallback mobile

Statut: `FAIT`
Objectif: eliminer tout overlap du panneau filtre avec les KPI et imposer une lecture horizontale sur desktop/tablette.
Livrables realises:
- desktop/tablette:
  - suppression du popover flottant pour les filtres temps
  - ajout d'un bandeau filtre inline dans le header (flux normal) qui pousse le contenu vers le bas
  - layout horizontal strict (`flex-nowrap`) des controles:
    - presets `Total/12m/90j/30j/7j`
    - `Personnalise`, `Du`, `Au`, `Appliquer`, `Reinitialiser`
  - aucun empiètement sur la grille KPI
- mobile:
  - drawer filtre dedie (fallback mobile only) via `Sheet`
  - logique fonctionnelle identique preservee
- logique metier filtre conservee:
  - presets instantanes
  - custom applique via `Appliquer`
  - reset vers `/?preset=total`
- aucun changement du contrat data/API:
  - `dashboard.v3` inchangé
  - query params `preset/from/to` inchangés
Definition of done:
- panneau filtre desktop horizontal inline sans overlap KPI, mobile geré via drawer

### F4.10 - Dashboard V3.2.4 header stabilise (bouton droite + filtre inline en zone centrale)

Statut: `FAIT`
Objectif: verrouiller le comportement header pour que le filtre s'ouvre uniquement dans la zone centrale, sans bascule drawer en desktop/tablette.
Livrables realises:
- header desktop/tablette stabilise en grille 3 zones:
  - gauche: titre + metadata
  - centre: panneau filtre inline (zone centrale du header)
  - droite: bouton `Filtrer` fixe en haut a droite
- panneau filtre desktop:
  - rendu en flux normal dans la zone centrale
  - largeur bornee au slot central (`w-full`, `max-w-full`)
  - organisation strictement horizontale (`flex-nowrap`, `whitespace-nowrap`, `overflow-x-auto`)
  - aucun depassement vers les KPI
- robustesse viewport:
  - fermeture automatique du `Sheet` mobile quand le viewport passe en desktop/tablette
  - fermeture du panneau desktop quand retour en mobile
- logique metier conservee:
  - presets instantanes
  - mode custom via `from/to` + `Appliquer`
  - reset vers `/?preset=total`
- aucun changement de contrat:
  - `dashboard.v3` inchangé
  - query params `preset/from/to` inchangés
Definition of done:
- bouton filtre fixe a droite en desktop/tablette et panneau inline borné a la zone centrale sans overlay plein ecran

### F4.11 - Dashboard V3.2.5 desktop prioritaire strict (filtre inline unique, sans Sheet)

Statut: `FAIT`
Objectif: supprimer definitivement les effets de modal mobile sur `/` et imposer un filtre unique inline dans le header.
Livrables realises:
- suppression complete du mode `Sheet` pour le filtre dashboard:
  - plus de drawer bas
  - plus d'overlay sombre plein ecran
- declencheur unique:
  - un seul bouton `Filtrer` conserve
  - bouton maintenu en zone droite du header
  - ouverture/fermeture du panneau inline central
- filtre inline unique (toutes tailles d'ecran):
  - rendu exclusivement dans la zone centrale du header (rectangle rouge)
  - disposition horizontale stricte:
    - `Total`, `12m`, `90j`, `30j`, `7j`, `Personnalise`, `Du`, `Au`, `Appliquer`, `Reinitialiser`
  - contraintes d'affichage:
    - `flex-nowrap`
    - `whitespace-nowrap`
    - `overflow-x-auto`
  - aucun empilement vertical principal
- logique metier conservee:
  - presets instantanes
  - custom via `from/to` + `Appliquer`
  - reset vers `/?preset=total`
- aucun changement de contrat:
  - `dashboard.v3` inchangé
  - query params `preset/from/to` inchangés
Definition of done:
- filtre dashboard sans `Sheet`, sans overlay, sans ouverture en bas, et inline borne dans le header

### F4.12 - Dashboard V3.2.6 header mono-ligne ultra compact

Statut: `FAIT`
Objectif: reduire la hauteur du header au minimum en alignant sur une meme ligne `titre + panneau filtre + bouton Filtrer`.
Livrables realises:
- simplification du header dashboard:
  - suppression des informations secondaires:
    - libelle version (`Dashboard V3.2.x`)
    - badges `periode / preset / granularite`
  - conservation du seul titre `DASHBOARD` a gauche
- layout desktop mono-ligne:
  - grille 3 zones conservee (`gauche / centre / droite`)
  - alignement vertical central des 3 zones
  - bouton `Filtrer` maintenu a droite
- panneau filtre inline centre:
  - visible uniquement quand ouvert
  - hauteur compacte fixe (`h-10`)
  - rendu horizontal strict:
    - `Total`, `12m`, `90j`, `30j`, `7j`, `Personnalise`, `Du`, `Au`, `Appliquer`, `Reinitialiser`
    - `flex-nowrap`, `whitespace-nowrap`, `overflow-x-auto`
  - aucune hauteur additionnelle quand ferme
- logique metier conservee:
  - presets instantanes
  - custom via `from/to` + `Appliquer`
  - reset `/?preset=total`
- aucun changement de contrat:
  - `dashboard.v3` inchangé
  - query params `preset/from/to` inchangés
Definition of done:
- header compact mono-ligne sur desktop sans retour panel bas ni overlay

## Phase 5 - Coherence UI transversale

Statut global: `A FAIRE`

### F5.0 - Operations lots et ventes

Statut: `FAIT`
Objectif: ajouter des fonctions operationnelles dans le detail lot, la numerotation metier des ventes et la remontee de tickets internes.

#### F5.0.1 - Import CSV pieces depuis detail lot

Statut: `FAIT`
Objectif: depuis `/approvisionnement/[id]`, permettre import/collage CSV (Excel/Sheets) pour alimenter les lignes pieces/quantites d'un lot comme une saisie manuelle.
Livrables realises:
- bouton `Importer CSV` + zone `coller CSV`
- mapping attendu:
  - colonne A: `Numero de piece`
  - colonne B: `Quantite de piece`
- import applique sur le lot courant comme une saisie utilisateur standard
- pas de blocage si la piece n'existe pas encore au catalogue
- parsing tolerant `;` et `,` + entete optionnelle (`Numero de piece`, `Quantite de piece`)
- import partiel: lignes valides appliquees, lignes invalides rejetees avec rapport detaille
- doublons internes CSV agreges (addition des quantites) avant application
- verrou lot `confirmed` applique cote UI et cote serveur avec message explicite
Definition of done:
- un CSV valide ajoute/met a jour les lignes du lot
- les pieces inconnues catalogue sont acceptees (catalogue complete plus tard)
- resultat identique a une saisie manuelle equivalente dans le logiciel

#### F5.0.2 - Pieces jointes facture (photo/pdf) sur detail lot

Statut: `FAIT`
Objectif: depuis `/approvisionnement/[id]`, permettre depot de factures en `photo` ou `pdf`.
Livrables realises:
- section dediee "piece jointe facture" sur le detail lot (`/approvisionnement/[id]`)
- upload d'une piece jointe facture avec validation stricte:
  - formats autorises: PDF, JPG/JPEG, PNG, WEBP, HEIC
  - taille maximale: 15 Mo
- cardinalite lot: 1 piece jointe (remplacement automatique de l'existante)
- consultation depuis le detail lot:
  - informations fichier (nom, type, taille, date)
  - ouverture via URL signee
- suppression manuelle de la piece jointe depuis l'UI lot
- politique statut lot:
  - upload autorise sur lot `draft` et `confirmed`
  - suppression autorisee sur lot `draft` et `confirmed`
- aucun impact sur les mouvements de stock (`PURCHASE`/`SALE`/`SALE_CANCEL`)
Definition of done:
- une piece jointe (photo/pdf) peut etre ajoutee et rattachee au lot
- une piece jointe peut etre supprimee depuis l'UI du lot
- la trace documentaire reste consultable tant que non supprimee

#### F5.0.3 - Numerotation metier des ventes (MAX+1 avec reset si vide)

Statut: `FAIT`
Objectif: implementer une numerotation metier visible des ventes (et non une contrainte sur l'ID SQL technique).
Livrables realises:
- attribution serveur du numero metier a la creation (`sale_number` stocke en numerique string: `"1"`, `"2"`, ...)
- calcul `MAX + 1` sur les valeurs numeriques existantes de `sale_number` (fallback legacy non numerique ignore)
- reset metier automatique a `1` si la table `sales` est vide
- conservation du numero metier sur annulation, sans renumerotation retroactive
- verrouillage de l'edition manuelle du numero metier dans `updateSaleMetaAction`
- affichage prioritaire du numero metier en UI ventes:
  - liste `/ventes`: colonne principale `N° vente` (`#N`), ID technique en secondaire
  - detail `/ventes/[id]`: titre `Vente #N`, ID technique affiche en information secondaire
Definition of done:
- premiere vente visible = `n°1`
- suppression de la seule vente existante -> prochaine vente = `n°1`
- annulation de `n°1` -> vente suivante = `n°2`
- suppression d'une vente intermediaire -> pas de renumerotation retroactive, prochaine vente = `MAX + 1`
- numero metier visible sur `/ventes` et `/ventes/[id]`
- numero metier non modifiable manuellement via l'action d'edition meta

#### F5.0.4 - Report tickets internes

Statut: `FAIT`
Objectif: permettre aux utilisateurs V1 de remonter des incidents et demandes d'evolution depuis la sidebar desktop via une modale partagee.
Livrables realises:
- remplacement du bouton `?` par un bouton `Report` dans la sidebar desktop (sous `⚙️`)
- modale `Report` centree avec 2 onglets:
  - `Report`: creation d'un ticket (`cible`, `categorie`, `description`)
  - `Tickets`: tableau global des tickets avec mise a jour statut/cloture, date de cloture auto et suppression
- persistance en base via `public.report_tickets`:
  - colonnes: `target_scope`, `category`, `description`, `status`, `created_at`, `closed_at`
  - contraintes metier sur cible/categorie/statut
  - RLS + policy compat `anon/authenticated`
  - index `(status, created_at desc)` et `(target_scope, created_at desc)`
- tri par defaut: tickets ouverts d'abord, puis plus recents
- regles de cloture:
  - coche: passe en statut clos (`RESOLVED`/`IGNORED`) + `closed_at` auto
  - decoche: repasse `OPEN` + `closed_at = null`
- suppression explicite d'un ticket autorisee
Definition of done:
- bouton `Report` visible en sidebar desktop a la place de `?`
- creation d'un ticket valide depuis la modale
- tableau tickets affiche et met a jour les statuts/clotures conformement aux regles
- suppression d'un ticket effective
- aucune regression des flux existants (`lint/typecheck/build/test:f2.0`)
- trajectoire auth/session explicite:
  - authentification multi-session admin planifiee en `F6.5`
  - attribution utilisateur reports + reglages comptes essentiels planifies en `F6.6`

Impacts API/interfaces/types publics:
- F5.0.1: entree CSV structuree (`piece_ref`, `quantity`) depuis UI lot
- F5.0.2: gestion d'attachements lot (upload + suppression)
- F5.0.3: introduction/usage d'un `numero_vente_metier` distinct de l'ID technique
- F5.0.4: nouvelle table `public.report_tickets` + server actions CRUD pour tickets internes (sans champ auteur en V1)

### F5.1 - Normaliser composants de structure

Statut: `FAIT`
Objectif: uniformiser les patterns de page sur `/ventes`, `/approvisionnement`, `/stock`, `/historique-stock`, `/catalogue` sans regression metier.
Livrables realises:
- nouveaux composants shared dans `src/components/ui/`:
  - `page-header.tsx`
  - `filter-bar.tsx`
  - `kpi-card.tsx`
  - `data-table.tsx`
  - `clickable-table-row.tsx`
- compatibilite preservee:
  - `SalesStatCard` et `DashboardStatCard` convertis en wrappers de `kpi-card.tsx`
  - `src/app/approvisionnement/ClickableRow.tsx` et `src/app/catalogue/ClickableRow.tsx` convertis en wrappers/re-exports de `clickable-table-row.tsx`
- migration des 5 pages cibles vers le socle shared (variantes legeres par page) avec conservation des colonnes/actions existantes
- standardisation structurelle du tableau (head, tri, badges, actions, pagination) sur les pages cibles sans changer les comportements metier
- reduction des styles ad hoc repetes via reutilisation des classes globales existantes (`app-card`, `app-table-head`, `app-table-row`)
Definition of done:
- header/filtres/KPI/table shared utilises sur les 5 pages cibles
- query params, tri, pagination, actions de ligne et navigation conserves fonctionnellement
- aucune migration SQL ajoutee
- non-regression validee via `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:f2.0`

### F5.2 - Harmoniser styles globaux et tokens

Statut: `FAIT`
Objectif: coherence visuelle globale.
Livrables realises:
- harmonisation des tokens globaux et classes utilitaires transverses dans `src/app/globals.css`:
  - controles formulaire (`app-control`, `app-control--md`, `app-control--textarea`, `app-control-label`)
  - filtres (`app-filter-trigger`, `app-filter-panel`, `app-filter-actions`)
  - segments/onglets (`app-segmented`, `app-segmented-item`, etats actif/inactif)
  - dialogs (`app-dialog-overlay`, `app-dialog-surface`, `app-dialog-close`)
  - ombres et surfaces standardisees (suppression des bordures noires)
- composants UI shared alignes visuellement:
  - `button.tsx`, `badge.tsx`, `input.tsx`, `textarea.tsx`
  - `dialog.tsx`, `sheet.tsx`, `alert-dialog.tsx`
  - `filter-bar.tsx`, `data-table.tsx`, `kpi-card.tsx`
- reduction des styles ad hoc repetes sur les pages/routes et modales consommatrices:
  - filtres date/actions harmonises (`/ventes`, `/approvisionnement`, `/stock`, `/historique-stock`)
  - segments/onglets harmonises (`Report`, `Dashboard`, `NewSaleForm`, `LotCsvImportDialog`)
  - surfaces modales harmonisees (Catalogue, Ventes, Approvisionnement)
- invariants preserves:
  - aucun changement de logique metier (query params, tri, pagination, actions, navigation)
  - aucune migration SQL ajoutee
  - aucune ecriture DB distante
Definition of done:
- boutons, badges, onglets, tableaux et dialogs alignes entre pages
- non-regression technique et metier validee en local:
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - `npm run test:f2.0`

### F5.3 - Verification responsive des routes cles

Statut: `A FAIRE`
Routes:
- `/`
- `/catalogue`
- `/approvisionnement`
- `/ventes`
- `/stock`
Definition of done:
- parcours utilisables desktop et mobile sans cassure majeure

## Phase 6 - Validation finale et readiness deploiement

Statut global: `A FAIRE`

### F6.1 - Tests automatiques flux critiques

Statut: `A FAIRE`
Objectif: proteger les regles d'or metier.
Portee minimale:
- FIFO
- confirmation lot
- annulation vente
- coherence KPIs
Definition of done:
- suites test unitaires + integration executables en local

### F6.2 - Scenarios manuels de validation metier

Statut: `A FAIRE`
Objectif: valider les parcours operationnels reel utilisateur.
Livrables:
- checklists manuelles par page
- preuves de verification
Definition of done:
- scenarios critiques valides sans ecart bloquant

### F6.3 - Healthcheck DB pre-release / post-release

Statut: `A FAIRE`
Objectif: confirmer l'integrite des donnees avant/apres livraison.
Definition of done:
- healthcheck retourne 0 anomalie avant validation finale

### F6.4 - Checklist de livraison et rollback

Statut: `A FAIRE`
Objectif: livrer de facon predictable.
Livrables:
- plan rollback
- checklist verification stock/coherence
- monitoring minimal des erreurs critiques
Definition of done:
- runbook de livraison complet et actionnable

### F6.5 - Authentification applicative multi-session admin

Statut: `A FAIRE`
Objectif: imposer un acces applicatif via identifiant/mot de passe avec sessions separees, tout en conservant des permissions identiques entre admins.
Livrables:
- ecran de connexion (email + mot de passe)
- login/logout et persistance de session
- protection des routes applicatives metier (acces refuse si non connecte)
- initialisation de 2 comptes admin de demarrage (modele extensible)
- autorisations identiques pour les comptes admin (pas de roles differencies dans ce lot)
Definition of done:
- compte A et compte B peuvent se connecter chacun de leur cote au meme logiciel
- les 2 comptes ont la meme visibilite data et les memes actions metier
- un utilisateur non connecte est redirige vers la connexion

### F6.6 - Reglages comptes essentiels + attribution des reports

Statut: `A FAIRE`
Objectif: preparer l'evolution multi-utilisateur avec un premier niveau de tracabilite operationnelle.
Livrables:
- section `Reglages > Comptes` avec operations essentielles:
  - vue des comptes admins existants
  - changement de mot de passe
  - deconnexion de la session active
- tickets report enrichis avec attribution utilisateur:
  - auteur de creation
  - utilisateur de cloture/ignorance
- affichage de ces attributions dans l'onglet `Tickets` du module Report
Definition of done:
- chaque report affiche qui l'a cree et qui l'a cloture/ignore
- les reglages comptes essentiels sont operationnels sans administration avancee des utilisateurs

Impacts API/interfaces/types publics (cadrage futur auth):
- session utilisateur requise pour l'acces UI metier
- tickets report enrichis de champs d'attribution utilisateur (creation + cloture)
- surface UI `Reglages > Comptes` pour operations essentielles (hors gestion admin complete)

Scenarios de test cibles (auth + reglages + reports):
- connexion reussie avec compte A et compte B
- sessions A et B simultanees sur deux navigateurs/appareils
- meme visibilite et memes autorisations pour A et B sur ventes/stock/appro/catalogue/dashboard
- utilisateur non connecte redirige vers login
- creation de report par A visible par B avec attribution auteur A
- cloture/ignore d'un report par B met a jour l'attribution de cloture
- changement de mot de passe via `Reglages > Comptes` sans impact data metier
- non-regression globale des flux metier existants

Hypotheses et defaults explicites (auth/reglages):
- identifiant = email + mot de passe (pas de SSO/OAuth dans ce lot)
- role unique `ADMIN` au demarrage pour les comptes A et B
- modele extensible a plus de 2 admins (sans contrainte "strictement 2")
- pas d'audit complet ventes/lots/stock dans ce lot
- priorite a l'attribution utilisateur des reports
- gestion avancee comptes (creation/desactivation/reset via UI) hors scope initial

## Scenarios d'acceptation globaux (gate final)

1. confirmer un lot vide echoue en UI, serveur et DB
2. confirmer un lot non vide cree les mouvements `IN` corrects
3. vente avec stock insuffisant est refusee sans mutation partielle
4. vente de set incomplet applique exactement les `overrides`
5. annulation vente restitue le stock et conserve la commande `CANCELLED`
6. KPIs ventes suivent strictement les filtres actifs du tableau (dont `include_cancelled`)
7. dashboard et ventes affichent des chiffres coherents sur une meme plage de dates / meme contexte de filtres
8. DB bloque toute tentative menant a stock negatif
9. DB bloque les doublons de mouvements selon la contrainte d'unicite
10. healthcheck DB retourne 0 anomalie avant validation finale
11. transition `confirmed -> draft` retire les mouvements `PURCHASE` si aucune vente liee, sinon echoue explicitement
12. auth bloquante: utilisateur non connecte ne peut pas acceder a l'app metier
13. multi-session admin: A et B voient les memes donnees et les reports tracent auteur + cloture

## Ordre recommande de lancement des agents Codex (feature par feature)

1. F0.1
2. F0.2
3. F0.3
4. F1.1
5. F1.2
6. F1.3
7. F1.4
8. F1.5
9. F2.1
10. F2.2
11. F2.3
12. F3.1
13. F3.2
14. F3.3
15. F3.4
16. F3.5
17. F3.6
18. F3.7
19. F4.1
20. F4.2
21. F4.3
22. F4.4
23. F4.5
24. F4.6
25. F4.7
26. F4.8
27. F4.9
28. F4.10
29. F4.11
30. F4.12
31. F5.0.1
32. F5.0.2
33. F5.0.3
34. F5.0.4
35. F5.1
36. F5.2
37. F5.3
38. F6.1
39. F6.2
40. F6.3
41. F6.4
42. F6.5
43. F6.6
