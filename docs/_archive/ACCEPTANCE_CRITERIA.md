# Acceptance Criteria

Critères synthétiques de validation fonctionnelle par page.

## 1. Catalogue

1. Liste
- la route `/catalogue` affiche une liste de sets triable et filtrable
- chaque ligne ouvre une fiche set

2. Création set
- un set ne peut pas être créé sans `display_ref` et `name`
- la création réussie redirige vers la fiche du set créé

3. Fiche set
- la route `/catalogue/[id]` affiche metadata + BOM
- l'ajout, la modification et la suppression d'une pièce BOM sont possibles
- la complétion du set est calculée depuis le stock réel

## 2. Approvisionnement

1. Liste lots
- la route `/approvisionnement` affiche les lots avec statut `draft/confirmed`
- création, édition et suppression de lot sont disponibles

2. Création lot
- impossible de créer sans date
- impossible de créer avec `total_cost <= 0` via la modale

3. Détail lot
- la route `/approvisionnement/[id]` permet ajouter/modifier/supprimer des lignes si lot `draft`
- si lot `confirmed`, la saisie des lignes est verrouillée

4. Confirmation lot
- passage `draft -> confirmed` crée des mouvements `IN` dans `stock_movements`
- ces mouvements sont visibles dans les écrans stock/historique
- confirmation refusée tant que `total_pieces = 0`
- tant que `total_pieces = 0`, `unit_cost` reste `null`

## 3. Ventes

1. Vue Commandes
- la route `/ventes` est la vue unique de liste des ventes
- 1 ligne correspond à 1 vente
- il n'existe pas d'écran liste global dédié "pièces vendues"
- le détail commande expose un drilldown audit des pièces réellement sorties

2. Type de vente
- chaque vente est strictement `SET` ou `PIECE`
- une vente ne mélange jamais lignes `SET` et lignes `PIECE`
- toute tentative de mixage est refusée

3. Création vente SET
- impossible d'enregistrer sans date, canal, net vendeur > 0, au moins une ligne
- impossible d'enregistrer une ligne set sans `set_id`
- en set partiel, `overrides` est obligatoire
- seules les quantités d'overrides sortent du stock

4. Création vente PIECE
- impossible d'enregistrer une ligne pièce sans `piece_ref`
- quantité ligne doit être > 0
- si stock insuffisant, la vente échoue

5. Stock/FIFO/snapshot
- chaque vente confirmée crée des mouvements `OUT` FIFO
- chaque vente confirmée enregistre un snapshot `sale_item_pieces`
- coûts et marges sont recalculés au niveau ligne et vente

6. Annulation
- annuler une vente crée les mouvements miroirs `IN` (`SALE_CANCEL`)
- la vente passe au statut `CANCELLED`

7. KPIs Ventes
- l'écran ventes affiche au minimum `nb commandes SET` et `nb commandes PIECE`
- l'écran ventes affiche `CA` et `marge` séparés par type
- période par défaut: 30 jours glissants
- filtres période disponibles: `Total`, `90`, `30`, `7`
- delta affiché vs période précédente équivalente (hors `Total`)
- les ventes `CANCELLED` sont exclues des KPIs business

## 4. Stock

1. Vue agrégée
- `/stock` s'appuie sur `stock_per_piece`
- recherche et tri par référence fonctionnent

2. Détail pièce
- `/stock/[piece_ref]` affiche le journal des mouvements de la pièce

3. Historique global
- `/historique-stock` filtre correctement par période, pièce, direction et type source

4. Source de vérité
- le stock affiché est dérivé uniquement des mouvements

## 5. Dashboard

1. Présence page
- `/` existe et reste accessible

2. Cible fonctionnelle
- les KPI dashboard doivent être cohérents avec Ventes/Stock/Approvisionnement
- pas de divergence chiffrée avec les pages métier

## 6. Critères transverses

1. Intégrité métier
- FIFO est respecté pour toutes les sorties ventes
- `sale_item_pieces` reflète les pièces réellement sorties

2. Traçabilité
- chaque mouvement de stock comporte source type/id exploitables

3. Périmètre
- pas de marketplace connectée
- pas de multi-user avancé
