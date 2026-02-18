# ROADMAP - Plan d'implementation sans dates

Perimetre: finaliser PlayNovus Manager avec fiabilite metier, coherence UX et qualite stricte.

## Regles de pilotage

- aucune date dans cette roadmap: execution en flux rapide par feature
- un agent Codex = une feature (granularite volontairement fine)
- stock pilote uniquement par les entrees via Approvisionnement (lots confirmes)
- stock pilote uniquement par les sorties via Ventes (FIFO)
- annulations visibles par defaut dans Commandes (historique conserve)
- KPIs business exclusifs des ventes `CANCELLED`
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

Statut global: `EN COURS`

### F3.1 - Contrat query standardise pour `/ventes`

Statut: `FAIT`
Objectif: un seul contrat d'entree pour liste + KPIs.
Parametres:
- `period=total|90|30|7`
- `include_cancelled=true|false` (defaut `true`)
- `channel`
- `sale_type`
- `sort`
- `dir`
- `page`
Livrables realises:
- parsing/normalisation canonique dans `src/app/ventes/page.tsx`
- fallback strict sur toutes valeurs invalides:
  - `period=30`, `include_cancelled=true`, `sort=paid_at`, `dir=desc`, `page=1`
  - `channel` vide supprime, `sale_type` invalide ignore
- redirection automatique vers URL canonique (`/ventes?...`) et suppression des cles legacy `stats_window_*`
- conservation des filtres actifs dans tri/pagination via `baseQuery` transmis a `SalesTable`
- application du contrat:
  - table: `include_cancelled`, `channel`, `sale_type`, `sort`, `dir`, `page`
  - KPIs: `period` + `channel` + `sale_type`, exclusion stricte `CANCELLED`
- card KPI alignees sur un parametre unique `period` (plus de `stats_window_*`)
- `src/lib/sales.ts` aligne sur `sale_type` (compat legacy `type` conservee)
Definition of done:
- contrat documente et utilise par la page

### F3.2 - Creer `getSalesPageData(filters)` dans `src/lib/sales.ts`

Statut: `A FAIRE`
Objectif: centraliser liste commandes + KPIs + deltas.
Livrables:
- fonction unique data-access
- structure de retour stable pour UI
Definition of done:
- `src/app/ventes/page.tsx` ne fait plus de logique KPI dispersee

### F3.3 - Aligner KPIs ventes sur la cible produit

Statut: `A FAIRE`
Objectif: KPIs fiables et comparables.
Livrables:
- periodes rapides `Total/90/30/7`
- delta vs periode precedente equivalente
- exclusion stricte de `CANCELLED` des KPIs business
- split KPI par type `SET` vs `PIECE` pour CA/marge
Definition of done:
- coherence KPI validee avec details commandes

### F3.4 - Conserver l'historique annule dans la table Commandes

Statut: `A FAIRE`
Objectif: conserver la trace operationnelle.
Livrables:
- `CANCELLED` visible par defaut avec badge clair
- option filtre `include_cancelled` active
Definition of done:
- annulation visible en historique sans polluer KPIs

### F3.5 - Unifier l'entree Nouvelle vente (pop-up)

Statut: `A FAIRE`
Objectif: un seul parcours UX.
Livrables:
- `/ventes` ouvre la pop-up via action utilisateur
- `/ventes/nouvelle` redirige vers `/ventes?new=1`
Definition of done:
- plus de flux paralleles divergents

### F3.6 - Finaliser audit interne sans page globale pieces vendues

Statut: `A FAIRE`
Objectif: conserver le choix produit "Commandes + drilldown".
Livrables:
- detail commande améliore (`/ventes/[id]`)
- detail set vendu maintenu (`/ventes/[id]/[saleItemId]`)
- suppression des restes d'UI pouvant reintroduire une liste globale non voulue
Definition of done:
- audit complet possible depuis une commande

## Phase 4 - Dashboard complet branche aux vraies donnees

Statut global: `A FAIRE`

### F4.1 - Creer `src/lib/dashboard.ts`

Statut: `A FAIRE`
Objectif: centraliser les calculs dashboard.
Livrables:
- agregats consolides (CA net, marge nette, valeur stock, cout appro)
- structure de retour stable pour UI dashboard
Definition of done:
- pas de calcul metier eparpille dans `src/app/page.tsx`

### F4.2 - Remplacer le placeholder de `src/app/page.tsx`

Statut: `A FAIRE`
Objectif: afficher un dashboard reel.
Livrables:
- cards KPI alimentees DB
- filtres periode partages
- liens rapides vers `/approvisionnement`, `/ventes`, `/stock`, `/catalogue`
Definition of done:
- plus aucun chiffre fictif dans le dashboard

### F4.3 - Ajouter visualisations exploitables

Statut: `A FAIRE`
Objectif: lecture business operationnelle.
Livrables:
- tendances CA/marge
- split set vs piece
- indicateurs stock utiles aux decisions
Definition of done:
- visuels bases sur donnees reelles et coherents avec pages sources

## Phase 5 - Coherence UI transversale

Statut global: `A FAIRE`

### F5.1 - Normaliser composants de structure

Statut: `A FAIRE`
Objectif: uniformiser les patterns de page.
Livrables:
- header de page shared
- barre de filtres shared
- cartes KPI shared
- tableau standardise (head, badges, actions, pagination)
Definition of done:
- reduction nette des styles ad hoc

### F5.2 - Harmoniser styles globaux et tokens

Statut: `A FAIRE`
Objectif: coherence visuelle globale.
Fichiers cibles:
- `src/app/globals.css`
- composants partages
Definition of done:
- boutons, badges, onglets, tableaux et dialogs alignes entre pages

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

## Scenarios d'acceptation globaux (gate final)

1. confirmer un lot vide echoue en UI, serveur et DB
2. confirmer un lot non vide cree les mouvements `IN` corrects
3. vente avec stock insuffisant est refusee sans mutation partielle
4. vente de set incomplet applique exactement les `overrides`
5. annulation vente restitue le stock et conserve la commande `CANCELLED`
6. KPIs ventes excluent toujours `CANCELLED`
7. dashboard et ventes affichent des chiffres coherents sur une meme periode
8. DB bloque toute tentative menant a stock negatif
9. DB bloque les doublons de mouvements selon la contrainte d'unicite
10. healthcheck DB retourne 0 anomalie avant validation finale
11. transition `confirmed -> draft` retire les mouvements `PURCHASE` si aucune vente liee, sinon echoue explicitement

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
18. F4.1
19. F4.2
20. F4.3
21. F5.1
22. F5.2
23. F5.3
24. F6.1
25. F6.2
26. F6.3
27. F6.4
