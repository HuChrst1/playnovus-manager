# Journal des décisions

Date de mise à jour initiale: 2026-02-12
Derniere mise a jour: 2026-02-16

## Décisions prises

### D-001 - Next.js App Router + TypeScript strict

- Statut: validée
- Constat:
  - projet structuré autour de `src/app/*`
  - TS strict activé dans `tsconfig.json`
- Impact:
  - base solide pour composants serveur/client et typage des flux

### D-002 - Supabase comme backend unique

- Statut: validée
- Constat:
  - clients Supabase dédiés (`supabase.ts`, `supabase-server.ts`)
  - typage DB généré dans `src/types/supabase.ts`
- Impact:
  - modèle de données centralisé sur Postgres/Supabase

### D-003 - Stock piloté par ledger de mouvements

- Statut: validée
- Constat:
  - `stock_movements` comme source de vérité
  - vues dérivées pour agrégats (`stock_per_piece`, `stock_journal`, `piece_movements`)
- Impact:
  - traçabilité et recalcul du stock indépendants des écrans

### D-004 - FIFO pour le coût des ventes

- Statut: validée
- Constat:
  - allocation FIFO implémentée dans `src/lib/stock.ts`
  - consommation appliquée lors des créations/éditions de vente
- Impact:
  - coût/marge réels calculés sur ordre chronologique des entrées

### D-005 - Support set partiel via overrides

- Statut: validée
- Constat:
  - mapping `overrides` (`piece_ref -> qty finale`) stocké sur `sale_items`
  - snapshot détaillé dans `sale_item_pieces`
- Impact:
  - vente de set incomplet possible sans casser le moteur FIFO

### D-006 - Vente mono-type (pas de mix SET/PIECE)

- Statut: validée
- Constat:
  - une commande doit avoir un type unique
  - `sale_type` est la vérité de classification
- Impact:
  - les lignes d'une vente doivent toutes correspondre au type de la commande
  - les cas `MIXED` sont hors scope

### D-007 - Pas de liste globale "pièces vendues", audit via détail commande

- Statut: validée
- Constat:
  - l'écran principal de ventes reste la vue `Commandes` (1 ligne = 1 vente)
  - le besoin audit est couvert dans le détail commande
- Impact:
  - aucune page liste globale dédiée "pièces vendues"
  - drilldown autorisé en modal/section pour afficher les pièces réellement sorties

### D-008 - KPIs Ventes standardisés (fenêtre + delta)

- Statut: validée
- Constat:
  - période par défaut: 30 jours glissants
  - périodes rapides: `Total`, `90`, `30`, `7`
  - comparaison avec période précédente équivalente
- Impact:
  - exclusion des ventes `CANCELLED` des KPIs business
  - lecture des performances homogène d'un écran à l'autre

### D-009 - Confirmation lot interdite tant que le lot est vide

- Statut: validée
- Constat:
  - un lot avec 0 pièce ne doit pas être confirmable
  - le coût unitaire reste vide tant que le lot n'a pas de quantité
- Impact:
  - réduction des incohérences de stock/couts sur les lots incomplets
  - garde-fou produit explicite avant intégration stock

### D-010 - Suppression contrôlée des lots confirmés

- Statut: validée
- Constat:
  - un lot confirmé peut être supprimé pour corriger un approvisionnement erroné
  - la suppression doit retirer les mouvements d'achat du stock/historique
  - la suppression est interdite si le lot a déjà été utilisé en ventes
- Impact:
  - suppression autorisée pour `draft` et `confirmed` si aucune consommation ventes
  - blocage explicite + guidage utilisateur si ventes liées détectées
  - aucune suppression en cascade des ventes

### D-011 - Synchronisation stock sur transition de statut lot

- Statut: validée
- Constat:
  - passer `confirmed -> draft` doit retirer les entrées `PURCHASE` du lot
  - passer `draft -> confirmed` doit recréer les entrées `PURCHASE` du lot
  - le downgrade `confirmed -> draft` est bloqué si le lot est déjà utilisé en ventes
- Impact:
  - cohérence stock/historique sur les changements de statut
  - prévention des doublons de mouvements lors des aller-retours de statut
  - conservation des invariants FIFO/ventes existants

### D-012 - Baseline migrations SQL issue de la DB reelle + seed desactive en F1.1

- Statut: validée
- Constat:
  - baseline SQL versionnee generee depuis la DB Supabase reelle (`public`)
  - `supabase/migrations/` initialise avec migration timestampée
  - `seed.sql` n'existe pas encore (scope F1.2)
- Impact:
  - le schema est versionne et rejouable localement depuis le repo
  - la valeur de verite schema devient la baseline migration
  - `db.seed.enabled` est desactive temporairement pour eviter les resets casses en F1.1

### D-013 - Mouvements IN/OUT obligatoirement relies a un lot (F1.3)

- Statut: validee
- Constat:
  - le garde-fou anti-stock negatif est porte par `stock_balance` alimente depuis `stock_movements`
  - des mouvements `IN/OUT` avec `lot_id` nul pouvaient contourner ce garde-fou
  - la logique FIFO et les couts unitaires reussissent uniquement avec un rattachement lot explicite
- Impact:
  - contrainte DB `ck_stock_movements_lot_required_inout` pour imposer `lot_id` sur `IN/OUT`
  - tout rejet de stock negatif remonte un message SQL explicite
  - compatibilite conservee avec le modele ledger (`stock_movements` source de verite, `stock_balance` derive)

### D-014 - Anti-doublon strict metier sur stock_movements + fail-fast (F1.4)

- Statut: validee
- Constat:
  - `stock_movements` etait protege par PK `id` uniquement, sans unicite metier anti-double insertion
  - les flux coeur (`PURCHASE`, `SALE`, `SALE_CANCEL`) peuvent etre reinvoques accidentellement (retry/double-submit)
  - deux indexes strictement redondants existaient deja sur `(source_type, source_id)`
- Impact:
  - contrainte DB `ck_stock_movements_source_id_required_core` pour exiger `source_id` non vide sur flux coeur
  - index unique partiel `ux_stock_movements_no_duplicate_core` sur `(source_type, source_id, piece_ref, lot_id, direction)` pour `PURCHASE|SALE|SALE_CANCEL`
  - strategie migration `fail-fast` en presence de donnees invalides/doublons preexistants (pas de dedup auto)
  - remplacement de lookup source par `idx_stock_movements_source_id_direction`
  - suppression des indexes source redondants pour limiter le cout d'ecriture inutile

### D-015 - Healthcheck metier SQL canonique via vue versionnee (F1.5)

- Statut: validee
- Constat:
  - besoin d'un audit pre-release des anomalies metier sans bloquer les ecritures
  - les anomalies cibles couvrent: ventes `CONFIRMED`, mouvements orphelins flux coeur, incoherences inventory, stock negatif
- Impact:
  - creation de `public.healthcheck_business_anomalies_v1` comme contrat canonique de healthcheck SQL
  - sortie normalisee stable (`v1`) avec colonnes techniques/metier exploitables en lecture humaine et automatisation
  - `anomaly_code`/`anomaly_family` imposes comme cles machine de tri et suivi
  - strategie `fail-open` explicite: aucun trigger/contrainte bloquante supplementaire introduit en F1.5
  - compatibilite preservee avec le modele ledger existant (`stock_movements` source de verite, `stock_balance` derive)

## Hypothèses / décisions en attente

### H-002 - Politique d'authentification applicative

- Statut: ouverte
- Observation:
  - pas de flux auth/session dans l'app
- A décider:
  - accès interne sans auth vs auth utilisateur explicite

### H-003 - Découpage du module `sales.ts` (actions)

- Statut: ouverte
- Observation:
  - fichier volumineux, responsabilités multiples
- A décider:
  - refactor en modules métier dédiés (sans changer la logique fonctionnelle)

### H-004 - Couverture de tests

- Statut: ouverte
- Observation:
  - pas de script `test` dans `package.json`
- A décider:
  - niveau minimal de tests automatisés sur flux critiques (FIFO, annulation, confirmation lot)

### H-005 - Alignement implémentation avec décisions produit validées

- Statut: ouverte
- Observation:
  - certaines décisions validées ne sont pas encore appliquées partout dans le code
  - exemples observés: filtre par défaut ventes, standard KPI, garde-fou lot vide
- A décider:
  - ordre de priorité d'implémentation des décisions `D-008` et `D-009`
  - niveau de blocage attendu (UI seule vs contrôle serveur obligatoire)

### H-006 - Politique d'affichage par défaut des commandes annulées

- Statut: ouverte
- Observation:
  - la table `/ventes` inclut aujourd'hui `CONFIRMED` + `CANCELLED` par défaut
  - le besoin produit priorise une lecture business non polluée par les annulations
- A décider:
  - défaut strict `CONFIRMED` avec option d'inclure `CANCELLED`
  - ou maintien du défaut multi-statut avec simple badge

### H-007 - Parcours "Nouvelle vente" (modale unique vs page dédiée)

- Statut: ouverte
- Observation:
  - le flux est disponible en modale depuis `/ventes` et aussi via `/ventes/nouvelle`
- A décider:
  - conserver les 2 entrées
  - ou n'en garder qu'une (et laquelle) pour réduire la dette UX

### H-008 - Ajustements manuels de stock dans le périmètre court terme

- Statut: ouverte
- Observation:
  - les vues affichent les mouvements `ADJUSTMENT`
  - aucune UI claire de création d'ajustement n'a été identifiée dans le repo
- A décider:
  - implémenter la création d'ajustement maintenant
  - ou sortir explicitement ce besoin du périmètre immédiat
