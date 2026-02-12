# BACKLOG - PlayNovus Manager

Backlog aligné sur `docs/PRD.md` (TO-BE) et `docs/AS_IS.md` (réalité code).

## Definition of Done (standard)

Une tâche est terminée uniquement si:
- [ ] code livré et relu, sans régression évidente sur les parcours liés
- [ ] `npm run lint` et `npm run build` passent
- [ ] tests/recettes prévus dans le ticket sont exécutés et documentés
- [ ] si impact DB: migration versionnée + rollback décrit + types Supabase régénérés
- [ ] documentation impactée mise à jour (`docs/*`, décisions si nécessaire)

## Phase 0 - Foundation

Objectif: stabiliser la base documentaire, les conventions et les contrôles minimaux avant les changements sensibles.

### Ticket T-001 - Source de vérité docs unifiée
- ID: `T-001`
- But métier: éviter les divergences entre produit, code et backlog pour réduire les régressions de cadrage.
- Critères d'acceptation:
  - [ ] `docs/PRD.md`, `docs/AS_IS.md`, `docs/ACCEPTANCE_CRITERIA.md` sont cohérents entre eux
  - [ ] les règles verrouillées (sale_type unique, KPI périodes, appro 0 pièce) sont présentes dans tous les docs pertinents
  - [ ] les ambiguïtés restantes sont listées explicitement en "DECISIONS NEEDED"
- Fichiers impactés (probables):
  - `docs/PRD.md`
  - `docs/AS_IS.md`
  - `docs/ACCEPTANCE_CRITERIA.md`
  - `docs/DECISIONS.md`
- DB impact: `non` (objets: `n/a`)
- Risque de conflit: `faible` (zone docs uniquement)
- Dépendances: `aucune`
- Tests/recettes à faire:
  - revue croisée docs (lecture manuelle)
  - vérification qu'aucune règle verrouillée n'est contradictoire
- Done: `Definition of Done (standard)`

### Ticket T-002 - Normalisation chemins docs en relatif
- ID: `T-002`
- But métier: garder une documentation portable (machine-agnostique) et exploitable par tous les agents.
- Critères d'acceptation:
  - [ ] plus aucun chemin absolu local dans les docs de pilotage (`docs/BACKLOG.md`, `docs/ROADMAP.md`, `docs/PRD.md`)
  - [ ] les preuves de routes/fichiers sont exprimées en chemins repo relatifs
  - [ ] les commandes et références restent exécutables depuis la racine projet
- Fichiers impactés (probables):
  - `docs/AS_IS.md`
  - `docs/BACKLOG.md`
  - `docs/ROADMAP.md`
- DB impact: `non` (objets: `n/a`)
- Risque de conflit: `faible` (docs)
- Dépendances: `T-001`
- Tests/recettes à faire:
  - recherche regex des chemins absolus dans `docs/*`
  - revue manuelle des chemins mentionnés
- Done: `Definition of Done (standard)`

### Ticket T-003 - Garde-fous qualité minimaux (lint/build + smoke)
- ID: `T-003`
- But métier: détecter tôt les régressions sur les parcours ventes/stock/appro.
- Critères d'acceptation:
  - [ ] un runbook de vérification locale est documenté
  - [ ] les scénarios smoke critiques sont listés et reproductibles
  - [ ] la checklist locale est reliée au backlog et au DoD
- Fichiers impactés (probables):
  - `README.md`
  - `docs/CONVENTIONS.md`
  - `docs/ACCEPTANCE_CRITERIA.md`
- DB impact: `non` (objets: `n/a`)
- Risque de conflit: `faible` (docs + scripts potentiels)
- Dépendances: `T-001`
- Tests/recettes à faire:
  - `npm run lint`
  - `npm run build`
  - recettes manuelles listées dans le runbook
- Done: `Definition of Done (standard)`

## Phase 1 - DB Safety

Objectif: sécuriser l'intégrité stock/ventes au niveau base, indépendamment de l'UI.

### Ticket T-100 - Baseline migrations Supabase
- ID: `T-100`
- But métier: rendre tout changement DB traçable et réversible.
- Critères d'acceptation:
  - [ ] dossier `supabase/migrations/` initialisé
  - [ ] migration baseline du schéma courant créée
  - [ ] process local "apply + verify + rollback" documenté
- Fichiers impactés (probables):
  - `supabase/migrations/*`
  - `supabase/config.toml`
  - `docs/ARCHITECTURE.md`
  - `docs/CONVENTIONS.md`
- DB impact: `oui` (migrations baseline, schéma courant)
- Risque de conflit: `fort` (fichiers DB centraux)
- Dépendances: `T-001`
- Tests/recettes à faire:
  - reset DB locale + apply migrations
  - vérification de compatibilité avec `src/types/supabase.ts`
- Done: `Definition of Done (standard)`

### Ticket T-110 - Contraintes SQL `stock_movements`
- ID: `T-110`
- But métier: empêcher l'insertion de mouvements invalides qui corrompent le ledger.
- Critères d'acceptation:
  - [ ] contraintes sur valeurs autorisées (`direction`, `source_type`)
  - [ ] contraintes de cohérence (`quantity > 0`, `piece_ref` non vide)
  - [ ] contraintes de traçabilité (`source_id` requis selon `source_type`)
  - [ ] migration avec stratégie rollback
- Fichiers impactés (probables):
  - `supabase/migrations/*`
  - `src/types/supabase.ts`
  - `docs/ARCHITECTURE.md`
- DB impact: `oui` (`stock_movements`, contraintes/check)
- Risque de conflit: `fort` (objet pivot de tout le stock)
- Dépendances: `T-100`
- Tests/recettes à faire:
  - inserts valides/invalide en SQL
  - validation des parcours ventes/appro existants après migration
- Done: `Definition of Done (standard)`

### Ticket T-120 - Anti stock négatif (garantie DB)
- ID: `T-120`
- But métier: garantir qu'aucune vente/ajustement ne peut descendre sous zéro.
- Critères d'acceptation:
  - [ ] garde-fou DB empêchant tout `OUT` excédentaire
  - [ ] erreur métier explicite remontée côté application
  - [ ] aucun contournement possible via insertion directe
- Fichiers impactés (probables):
  - `supabase/migrations/*`
  - `src/lib/stock.ts`
  - `src/app/actions/sales.ts`
  - `src/types/supabase.ts`
- DB impact: `oui` (`stock_movements`, fonction/trigger de contrôle)
- Risque de conflit: `fort` (touche règles cœur FIFO)
- Dépendances: `T-110`
- Tests/recettes à faire:
  - vente avec stock suffisant
  - vente avec stock insuffisant (doit échouer atomiquement)
  - non-régression annulation vente (`SALE_CANCEL`)
- Done: `Definition of Done (standard)`

### Ticket T-130 - RPC atomiques ventes
- ID: `T-130`
- But métier: garantir la cohérence transactionnelle create/edit/cancel/delete d'une vente.
- Critères d'acceptation:
  - [ ] RPC transactionnelle pour création vente (sales, sale_items, sale_item_pieces, stock_movements)
  - [ ] RPC transactionnelle pour édition/annulation/suppression
  - [ ] rollback complet si une étape échoue
  - [ ] suppression des écritures multi-étapes non atomiques côté app
- Fichiers impactés (probables):
  - `supabase/migrations/*`
  - `src/app/actions/sales.ts`
  - `src/lib/sales.ts`
  - `src/types/supabase.ts`
- DB impact: `oui` (fonctions RPC + permissions d'exécution)
- Risque de conflit: `fort` (fort recouvrement sur ventes)
- Dépendances: `T-110`, `T-120`
- Tests/recettes à faire:
  - create SET complet
  - create SET incomplet (overrides)
  - create PIECE
  - cancel + delete + edit avec vérification ledger et snapshot
- Done: `Definition of Done (standard)`

### Ticket T-140 - Healthchecks intégrité data
- ID: `T-140`
- But métier: détecter rapidement les dérives de données avant impact opérationnel.
- Critères d'acceptation:
  - [ ] requêtes de contrôle publiées (mouvements orphelins, incohérences coûts, stock négatif)
  - [ ] rapport lisible "OK / KO" documenté
  - [ ] procédure d'exécution locale et pré-prod définie
- Fichiers impactés (probables):
  - `supabase/migrations/*`
  - `data/healthchecks/*.sql`
  - `docs/ARCHITECTURE.md`
  - `docs/CONVENTIONS.md`
- DB impact: `oui` (vues/requêtes de contrôle)
- Risque de conflit: `moyen` (DB + docs, peu d'impact UI)
- Dépendances: `T-110`, `T-120`
- Tests/recettes à faire:
  - exécution healthchecks sur dataset nominal
  - simulation d'un cas KO et validation du signalement
- Done: `Definition of Done (standard)`

## Phase 2 - Ventes UX

Objectif: fiabiliser `/ventes` autour des règles TO-BE sans créer d'écran "liste pièces vendues" global.

### Ticket T-200 - Data contract ventes (liste + KPI)
- ID: `T-200`
- But métier: fournir une source unique pour les données de `/ventes` afin de réduire les conflits entre agents.
- Critères d'acceptation:
  - [ ] une fonction unique fournit la liste commandes et les KPIs
  - [ ] la fonction applique les mêmes filtres de période (`Total/90/30/7`, défaut 30)
  - [ ] `CANCELLED` exclu des KPIs
  - [ ] contrat typé documenté (input/output)
- Fichiers impactés (probables):
  - `src/lib/sales.ts`
  - `src/lib/sales-types.ts`
  - `src/app/ventes/page.tsx`
  - `docs/ARCHITECTURE.md`
- DB impact: `non` (objets: `n/a`)
- Risque de conflit: `fort` (point central partagé)
- Dépendances: `T-130`
- Tests/recettes à faire:
  - comparaison résultat contrat vs affichage UI actuel
  - contrôle cohérence KPI sur fenêtres 7/30/90/Total
- Done: `Definition of Done (standard)`

### Ticket T-210 - Verrouillage `sale_type` (no MIXED)
- ID: `T-210`
- But métier: garantir qu'une commande est soit `SET`, soit `PIECE`, jamais mixte.
- Critères d'acceptation:
  - [ ] validation UI empêche les lignes mixtes
  - [ ] validation serveur rejette toute tentative mixte
  - [ ] `sales.sale_type` devient la vérité de l'ordre
  - [ ] cas historiques incohérents explicitement gérés (erreur ou exclusion)
- Fichiers impactés (probables):
  - `src/app/ventes/nouvelle/NewSaleForm.tsx`
  - `src/components/sales/EditSaleDialog.tsx`
  - `src/app/actions/sales.ts`
  - `src/lib/sales.ts`
- DB impact: `oui` (contrainte/validation possible sur `sales`, `sale_items`)
- Risque de conflit: `fort` (UI + serveur + DB)
- Dépendances: `T-130`, `T-200`
- Tests/recettes à faire:
  - création vente SET valide
  - création vente PIECE valide
  - tentative MIXED rejetée côté UI et côté serveur
- Done: `Definition of Done (standard)`

### Ticket T-220 - KPI `/ventes` périodes + delta
- ID: `T-220`
- But métier: standardiser la lecture business avec comparatif période précédente.
- Critères d'acceptation:
  - [ ] période par défaut: 30 jours glissants
  - [ ] boutons `Total`, `90`, `30`, `7` disponibles
  - [ ] delta affiché vs période précédente équivalente
  - [ ] delta masqué/NA pour `Total`
  - [ ] split KPI `SET` vs `PIECE` pour commandes, CA, marge
- Fichiers impactés (probables):
  - `src/app/ventes/page.tsx`
  - `src/components/sales/SalesStatCard.tsx`
  - `src/components/sales/SalesStatCardWithDialog.tsx`
  - `src/lib/sales.ts`
- DB impact: `non` (objets: `n/a`)
- Risque de conflit: `moyen` (UI ventes + contrat data)
- Dépendances: `T-200`
- Tests/recettes à faire:
  - vérifier chiffres avec dataset connu sur 7/30/90
  - vérifier exclusion `CANCELLED`
  - vérifier calcul delta (valeur et pourcentage)
- Done: `Definition of Done (standard)`

### Ticket T-230 - Drilldown audit en détail commande
- ID: `T-230`
- But métier: conserver la traçabilité `sale_item_pieces` sans créer de liste globale "pièces vendues".
- Critères d'acceptation:
  - [ ] depuis le détail commande, ouverture d'un drilldown (modal/section) par ligne
  - [ ] affichage des `sale_item_pieces` réellement sortis
  - [ ] affichage du détail set vendu (BOM attendu vs override)
  - [ ] aucune nouvelle route de liste globale pièces vendues
- Fichiers impactés (probables):
  - `src/app/ventes/[id]/page.tsx`
  - `src/components/sales/SaleDetailDialog.tsx`
  - `src/components/sales/SoldPiecesTable.tsx`
  - `src/app/ventes/[id]/[saleItemId]/page.tsx`
- DB impact: `non` (objets: `n/a`)
- Risque de conflit: `moyen` (UI détail ventes)
- Dépendances: `T-200`, `T-210`
- Tests/recettes à faire:
  - navigation liste commandes -> détail -> drilldown
  - vérification cohérence quantités/lot/cost avec `sale_item_pieces`
- Done: `Definition of Done (standard)`

## Phase 3 - Catalogue / Appro / Stock polish

Objectif: consolider les écrans métier hors ventes avec les nouveaux garde-fous.

### Ticket T-300 - Règle Appro `total_pieces=0` et confirmation interdite
- ID: `T-300`
- But métier: empêcher la confirmation de lots vides et les coûts unitaires incohérents.
- Critères d'acceptation:
  - [ ] tant que `total_pieces=0`, `unit_cost` reste `null`
  - [ ] action de confirmation désactivée/refusée si `total_pieces=0`
  - [ ] message d'erreur explicite côté UI
  - [ ] aucune création de mouvement `IN` pour lot vide
- Fichiers impactés (probables):
  - `src/app/approvisionnement/[id]/page.tsx`
  - `src/app/approvisionnement/action.ts`
  - `src/app/approvisionnement/NewLotDialog.tsx`
  - `src/types/supabase.ts`
- DB impact: `oui` (`lots`, `inventory`, règles de confirmation)
- Risque de conflit: `moyen` (appro + DB)
- Dépendances: `T-100`, `T-110`
- Tests/recettes à faire:
  - lot draft vide: confirmation refusée
  - lot avec pièces: confirmation OK et mouvements `IN`
- Done: `Definition of Done (standard)`

### Ticket T-310 - Cohérence calculs catalogue/stock
- ID: `T-310`
- But métier: garantir que complétion set et disponibilité stock restent alignées sur le ledger.
- Critères d'acceptation:
  - [ ] complétion set cohérente avec `stock_per_piece`
  - [ ] `max_complete_sets` testé sur cas limites
  - [ ] aucune logique locale n'écrit un stock courant séparé
- Fichiers impactés (probables):
  - `src/app/catalogue/[id]/page.tsx`
  - `src/app/api/sets/[setId]/bom-stock/route.ts`
  - `src/lib/stock.ts`
- DB impact: `non` (objets: `n/a`)
- Risque de conflit: `moyen` (catalogue + stock)
- Dépendances: `T-110`, `T-120`
- Tests/recettes à faire:
  - vérification manuelle sur set complet/partiel/insuffisant
  - non-régression des pages stock
- Done: `Definition of Done (standard)`

### Ticket T-320 - Historique stock lisible et fiable
- ID: `T-320`
- But métier: faciliter l'audit opérationnel des mouvements.
- Critères d'acceptation:
  - [ ] filtres période/piece_ref/direction/source_type fiables
  - [ ] ordre chronologique stable
  - [ ] liens vers provenance exploitables (`PURCHASE`, `SALE`, `SALE_CANCEL`)
- Fichiers impactés (probables):
  - `src/app/historique-stock/page.tsx`
  - `src/app/stock/[piece_ref]/page.tsx`
  - `src/lib/stock.ts`
- DB impact: `non` (objets: `n/a`)
- Risque de conflit: `faible` (UI stock dédiée)
- Dépendances: `T-110`
- Tests/recettes à faire:
  - parcours audit d'une pièce de l'entrée lot à la sortie vente
  - vérification des filtres sur jeu de données large
- Done: `Definition of Done (standard)`

### Ticket T-330 - Politique suppression lot confirmé
- ID: `T-330`
- But métier: définir un comportement sûr pour éviter la corruption d'historique stock.
- Statut: `BLOCKED (decision needed)`
- Critères d'acceptation:
  - [ ] décision explicite: interdiction stricte ou suppression contrôlée
  - [ ] impact historique documenté
  - [ ] implémentation alignée avec la décision
- Fichiers impactés (probables):
  - `src/app/approvisionnement/action.ts`
  - `src/app/approvisionnement/page.tsx`
  - `docs/PRD.md`
  - `docs/DECISIONS.md`
- DB impact: `oui` (`lots`, `inventory`, `stock_movements`)
- Risque de conflit: `moyen` (règle métier transverse)
- Dépendances: `T-100`, `T-110`
- Tests/recettes à faire:
  - scénario suppression lot confirmé selon décision retenue
  - vérification non-régression historique stock
- Done: `Definition of Done (standard)`

## Phase 4 - Dashboard

Objectif: connecter le dashboard aux vraies données sans divergence avec les pages métier.

### Ticket T-400 - KPIs dashboard branchés au réel
- ID: `T-400`
- But métier: fournir une vue synthèse fiable pour pilotage quotidien.
- Critères d'acceptation:
  - [ ] dashboard n'utilise plus de placeholders pour KPI principaux
  - [ ] chiffres cohérents avec `/ventes`, `/stock`, `/approvisionnement`
  - [ ] période affichée explicitement
- Fichiers impactés (probables):
  - `src/app/page.tsx`
  - `src/components/dashboard/DashboardStatCard.tsx`
  - `src/lib/sales.ts`
  - `src/lib/stock.ts`
- DB impact: `non` (objets: `n/a`)
- Risque de conflit: `moyen` (partage de contrats de données)
- Dépendances: `T-200`, `T-220`, `T-320`
- Tests/recettes à faire:
  - comparaison dashboard vs pages métier pour même période
  - vérification exclusion `CANCELLED` sur métriques ventes
- Done: `Definition of Done (standard)`

## Phase 5 - Hardening (RLS, deploy)

Objectif: préparer la mise en production stable (sécurité, pipeline, exploitation).

### Ticket T-500 - Baseline RLS et rôles Supabase
- ID: `T-500`
- But métier: sécuriser l'accès données avant ouverture plus large.
- Critères d'acceptation:
  - [ ] politiques RLS définies pour tables sensibles
  - [ ] rôles service vs lecture clarifiés
  - [ ] tests d'accès autorisé/interdit documentés
- Fichiers impactés (probables):
  - `supabase/migrations/*`
  - `src/lib/supabase.ts`
  - `src/lib/supabase-server.ts`
  - `docs/ARCHITECTURE.md`
- DB impact: `oui` (policies RLS sur `sales`, `sale_items`, `sale_item_pieces`, `stock_movements`, `inventory`, `lots`)
- Risque de conflit: `fort` (impact large et critique)
- Dépendances: `T-100`, `T-130`
- Tests/recettes à faire:
  - tests d'accès avec clés anonymes vs service role
  - vérification des parcours applicatifs après activation RLS
- Done: `Definition of Done (standard)`

### Ticket T-510 - Pipeline déploiement et checks obligatoires
- ID: `T-510`
- But métier: rendre les releases prévisibles et sûres.
- Critères d'acceptation:
  - [ ] pipeline exécute lint/build et checks DB avant merge/release
  - [ ] ordre d'exécution migrations documenté
  - [ ] rollback opérationnel documenté
- Fichiers impactés (probables):
  - `.github/workflows/*`
  - `README.md`
  - `docs/ROADMAP.md`
  - `docs/CONVENTIONS.md`
- DB impact: `non` (objets: `n/a`; contrôle d'exécution migrations)
- Risque de conflit: `faible` (CI/docs)
- Dépendances: `T-100`, `T-140`, `T-500`
- Tests/recettes à faire:
  - exécution pipeline sur branche de test
  - test de rollback documenté en environnement local
- Done: `Definition of Done (standard)`

## Peut être fait en parallèle

### Lot A (Agent 1 - docs/fondation)
- `T-001`, `T-002`, `T-003`
- Zone principale: `docs/*`, `README.md`

### Lot B (Agent 2 - DB safety)
- `T-100`, `T-110`, `T-140`
- Zone principale: `supabase/migrations/*`, `data/healthchecks/*`, `src/types/supabase.ts`

### Lot C (Agent 3 - ventes core)
- `T-130`, `T-200`, `T-210`
- Zone principale: `src/app/actions/sales.ts`, `src/lib/sales.ts`, `src/lib/sales-types.ts`

### Lot D (Agent 4 - UI ventes + dashboard)
- `T-220`, `T-230`, `T-400`
- Zone principale: `src/app/ventes/page.tsx`, `src/app/ventes/[id]/page.tsx`, `src/components/sales/*`, `src/app/page.tsx`

### Lot E (Agent 5 - appro/stock/hardening)
- `T-120`, `T-300`, `T-310`, `T-320`, `T-500`, `T-510`
- Zone principale: `src/lib/stock.ts`, `src/app/approvisionnement/*`, `src/app/stock/*`, `src/app/historique-stock/page.tsx`, `.github/workflows/*`

## Fichiers sensibles (ne pas modifier en parallèle)

- `supabase/migrations/*`
- `src/types/supabase.ts`
- `src/app/actions/sales.ts`
- `src/lib/sales.ts`
- `src/lib/stock.ts`
- `src/lib/supabase.ts`
- `src/lib/supabase-server.ts`
- `src/app/approvisionnement/action.ts`
- `package.json`
- `README.md`
