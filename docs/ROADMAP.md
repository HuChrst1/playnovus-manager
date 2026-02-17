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

Statut: `A FAIRE`
Objectif: impossible de confirmer un lot a `total_pieces = 0`.
Fichiers cibles:
- `src/app/approvisionnement/action.ts`
Definition of done:
- la server action refuse explicitement la confirmation d'un lot vide

### F2.2 - Alignement UI Appro sur la regle lot vide

Statut: `A FAIRE`
Objectif: prevenir l'utilisateur avant soumission.
Fichiers cibles:
- `src/app/approvisionnement/[id]/page.tsx`
- dialogs associes Appro
Definition of done:
- bouton/action de confirmation desactive ou bloque avec message clair

### F2.3 - Confirmation lot atomique fonctionnelle

Statut: `A FAIRE`
Objectif: pas de lot `confirmed` sans mouvements `IN` effectifs.
Livrables:
- sequence robuste de confirmation (status + ecritures stock)
- gestion d'erreur explicite en cas d'echec mouvement
Definition of done:
- aucun etat intermediaire incoherent observe

## Phase 3 - Ventes/Commandes + KPIs + contrat data unique

Statut global: `A FAIRE`

### F3.1 - Contrat query standardise pour `/ventes`

Statut: `A FAIRE`
Objectif: un seul contrat d'entree pour liste + KPIs.
Parametres:
- `period=total|90|30|7`
- `include_cancelled=true|false` (defaut `true`)
- `channel`
- `sale_type`
- `sort`
- `dir`
- `page`
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
