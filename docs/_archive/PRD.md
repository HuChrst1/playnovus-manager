# PRD TO-BE - PlayNovus Manager

## 1. Objet du document

Ce document décrit la cible produit (TO-BE) de PlayNovus Manager.

But:
- définir un cadre non ambigu pour les écrans et comportements métier
- éviter les interprétations divergentes entre produit, design et implémentation
- servir de source de vérité fonctionnelle

Périmètre de ce PRD:
- pages: `Catalogue`, `Approvisionnement`, `Ventes`, `Stock`, `Dashboard`
- règles métier achats/stock/ventes autour du ledger `stock_movements`

## 2. Contexte et vision

PlayNovus Manager est un outil interne pour gérer:
- le catalogue de sets et leur BOM
- les approvisionnements par lots
- les ventes (sets et pièces unitaires)
- le stock réel et la marge réelle

Vision:
- un stock exact, traçable, calculé à partir des mouvements
- un calcul de coût fiable via FIFO
- une UI opérationnelle simple pour piloter l'activité quotidienne

## 3. Contraintes produit (obligatoires)

Les contraintes suivantes sont impératives:

1. Pages obligatoires:
- `Catalogue`
- `Approvisionnement`
- `Ventes`
- `Stock`
- `Dashboard`

2. Ventes:
- possibilité d'enregistrer des ventes de `SET`
- possibilité d'enregistrer des ventes de `PIECE` à l'unité
- une vente ne mélange pas `SET` et `PIECE`
- `sales.sale_type` est la vérité et toutes les lignes doivent matcher ce type
- `MIXED` est hors scope

3. UI Ventes:
- une seule vue liste `Commandes`
- 1 ligne = 1 vente
- pas d'écran de liste dédié "pièces vendues" (interdit pour les listes globales)
- un drilldown audit est autorisé dans le détail commande (modal/section)
- le drilldown audit doit afficher `sale_item_pieces` et le détail du set vendu

4. KPIs Ventes:
- séparation `SET` vs `PIECE` au minimum pour le nombre de commandes
- séparation `CA` et `marge` par type attendue
- période par défaut: `30` jours glissants
- sélecteurs de période: `Total`, `90`, `30`, `7`
- affichage du delta vs période précédente équivalente (sauf `Total`, delta non applicable)
- ventes `CANCELLED` exclues du calcul KPI

5. Stock et historisation:
- stock dérivé uniquement depuis `stock_movements`
- FIFO obligatoire pour les sorties de vente
- `sale_item_pieces` est la vérité historique des pièces réellement sorties

6. Set incomplet:
- l'utilisateur renseigne les quantités réellement vendues par pièce (`overrides`)
- seules ces quantités sortent du stock

7. Approvisionnement:
- tant que `total_pieces = 0`, `unit_cost = null`
- confirmation du lot interdite si `total_pieces = 0`

8. Hors scope explicite:
- pas de marketplace connectée
- pas de multi-user avancé pour l'instant

## 4. Modèle métier cible

## 4.1 Entités clés

- `set` (`sets_catalog`): fiche catalogue
- `bom` (`sets_bom`): nomenclature pièces d'un set
- `lot` (`lots`): lot d'approvisionnement (`draft` / `confirmed`)
- `inventory` (`inventory`): lignes de pièces d'un lot
- `sale` (`sales`): commande/vente
- `sale_item` (`sale_items`): ligne de vente (set ou pièce)
- `stock_movement` (`stock_movements`): ledger de stock
- `sale_item_pieces`: snapshot des pièces consommées

## 4.2 Invariants métier

1. Invariant stock:
- toute variation de stock doit être expliquée par un mouvement dans `stock_movements`
- aucune logique ne doit écrire un "stock courant" séparé

2. Invariant FIFO:
- les mouvements `OUT` de vente consomment les entrées `IN` par ordre chronologique
- en cas de stock insuffisant, la vente est refusée

3. Invariant historique:
- `sale_item_pieces` fige la composition réellement vendue (pièces, lots, coûts unitaires)
- ce snapshot ne doit pas être inféré a posteriori depuis le BOM

4. Invariant set partiel:
- `overrides` représente les quantités finales par pièce pour la ligne set
- les sorties de stock doivent correspondre exactement aux overrides

5. Invariant type de vente:
- `sales.sale_type` détermine le type unique de la commande
- toutes les lignes `sale_items` doivent avoir le même type
- une commande `MIXED` n'est pas autorisée

## 5. Écrans cibles et comportements

## 5.1 Catalogue

### Écran liste (`/catalogue`)

Objectif:
- rechercher, filtrer, trier et naviguer dans le catalogue des sets

Colonnes minimum:
- photo
- `SetID` (`display_ref`)
- nom
- version
- début/fin de production
- thème
- complétion

Filtres minimum:
- recherche texte (sur `display_ref` et `name`)
- filtre version (multi)
- filtre année de début (multi)
- filtre période de production (active/terminée)
- filtre thème

Actions:
- créer un set
- supprimer un set
- ouvrir la fiche set

### Formulaire "Ajouter un set"

Champs:
- `display_ref` (obligatoire)
- `name` (obligatoire)
- `version` (optionnel)
- `theme` (optionnel)
- `year_start` (optionnel, entier)
- `year_end` (optionnel, entier)
- `image_url` (optionnel, URL)

Validations:
- refus si `display_ref` vide
- refus si `name` vide
- si année saisie: valeur numérique

### Écran détail set (`/catalogue/[id]`)

Objectif:
- modifier la fiche set
- gérer le BOM
- visualiser la complétion selon stock

Comportements:
- affichage des métadonnées set
- affichage BOM + stock par pièce
- calcul complétion:
  - `totalPartsNeeded = somme(bom_qty)`
  - `totalPartsOwned = somme(min(stock_qty, bom_qty))`
  - `% completion = totalPartsOwned / totalPartsNeeded`
- calcul `max_complete_sets` via minimum de `floor(stock_piece / bom_qty)`

Gestion BOM:
- ajouter une pièce (`piece_ref`, `piece_name`, `quantity`)
- modifier une pièce (nom/quantité)
- supprimer une pièce

## 5.2 Approvisionnement

### Écran liste lots (`/approvisionnement`)

Objectif:
- piloter les lots d'achat et leur statut

Colonnes minimum:
- lot id/code
- date
- libellé
- fournisseur
- nb pièces
- coût total
- coût/pièce
- statut (`draft`/`confirmed`)

Comportements:
- tri des colonnes
- création lot
- édition lot
- suppression lot
- ouverture fiche lot
- lot initial `LOT_0` présent (ou auto-créé si absent)

KPIs minimum:
- nb lots confirmés
- nb pièces confirmées
- coût total confirmé
- coût moyen par pièce

### Formulaire "Nouveau lot"

Champs:
- `purchase_date` (obligatoire)
- `label` (optionnel)
- `supplier` (optionnel)
- `lot_code` (optionnel)
- `total_cost` (obligatoire)
- `status` (`draft` par défaut)
- `notes` (optionnel)

Validations:
- date obligatoire
- `total_cost > 0` à la création depuis la modale

Règles:
- `total_pieces` initialisé à 0
- aucun mouvement stock créé tant que `status = draft`

### Écran détail lot (`/approvisionnement/[id]`)

Objectif:
- saisir et maintenir les lignes de pièces du lot

Fonctions:
- ajout rapide d'une ligne (`piece_ref`, `quantity`)
- édition ligne (`piece_ref`, `quantity`)
- suppression ligne

Validations:
- lot doit être `draft` pour modifier les lignes
- `piece_ref` obligatoire
- `quantity` entier strictement positif

Règles de calcul:
- fusion des lignes par `(lot_id, piece_ref)`
- recalcul `total_pieces` du lot = somme quantités lignes
- `unit_cost` des lignes recalculé globalement: `total_cost / total_pieces` si `total_pieces > 0`
- si `total_pieces = 0`, `unit_cost` doit rester `null`

### Confirmation lot

Condition:
- transition `draft -> confirmed`
- `total_pieces > 0` obligatoire
- `unit_cost` non nul attendu sur les lignes inventory

Effet stock:
- création des mouvements `IN` pour toutes les lignes inventory du lot
- `source_type = PURCHASE`
- `source_id = lot.id`

## 5.3 Ventes

### Écran liste commandes (`/ventes`)

Objectif:
- unique écran liste des ventes

Contrainte forte:
- 1 ligne = 1 vente
- pas d'écran liste "pièces vendues" à l'échelle globale
- drilldown audit autorisé depuis le détail commande (modal/section)

Colonnes minimum:
- id vente
- date paiement
- canal
- type (`SET` ou `PIECE`)
- statut
- CA net
- coût total
- marge totale

Actions ligne:
- éditer vente
- supprimer vente
- ouvrir détail vente

KPIs obligatoires (séparés SET vs PIECE):
- nombre de commandes `SET`
- nombre de commandes `PIECE`

KPIs attendus:
- CA net `SET` vs `PIECE`
- marge totale `SET` vs `PIECE`
- taux de marge `SET` vs `PIECE`

Règles KPI:
- les ventes `CANCELLED` sont exclues des KPIs business
- période par défaut: `30` jours glissants
- sélecteurs visibles: `Total`, `90`, `30`, `7`
- affichage du delta vs période précédente équivalente (sauf `Total`, non applicable)

### Détail commande (`/ventes/[id]`)

Objectif:
- consulter les informations complètes d'une commande
- accéder au drilldown audit des pièces réellement sorties

Contenu minimum:
- header vente (date, canal, type, statut, net, coût, marge)
- lignes de vente
- section/modal de drilldown audit:
  - données `sale_item_pieces`
  - détail set vendu (BOM attendu vs override réellement sorti)

### Formulaire vente (création/édition)

Champs header:
- `sale_type` (obligatoire: `SET` ou `PIECE`)
- `paid_at` (obligatoire, date valide)
- `sales_channel` (obligatoire, non vide)
- `net_seller_amount` (obligatoire, > 0)
- `comment` (optionnel)

Règle globale:
- une vente doit avoir un type unique (`SET` ou `PIECE`)
- le type de toutes les lignes doit correspondre à `sale_type`
- une tentative de mixage `SET` + `PIECE` est rejetée

Édition uniquement:
- `status` (`CONFIRMED` ou `CANCELLED`)

#### Mode `SET`

Champs ligne set:
- `set_id` (obligatoire)
- `quantity` (entier >= 1)
- `overrides` (optionnel, requis si set incomplet)

Règles validation:
- au moins une ligne
- chaque ligne doit être `item_kind = SET`
- si set partiel: `overrides` non vide
- si plusieurs lignes:
  - `net_amount` réparti par ligne requis (>0)
  - somme des `net_amount` lignes = `net_seller_amount`

#### Mode `PIECE`

Champs ligne pièce:
- `piece_ref` (obligatoire)
- `quantity` (entier > 0)
- `net_amount` ligne (requis si multi-lignes)
- `comment` ligne (optionnel)

Règles validation:
- au moins une ligne
- chaque ligne doit être `item_kind = PIECE`
- quantité <= stock disponible (contrôle UI + contrôle serveur au moment FIFO)
- si multi-lignes: somme `net_amount` lignes = `net_seller_amount`

### Règles stock lors d'une vente confirmée

Au submit:
1. créer `sales`
2. créer `sale_items`
3. résoudre la demande en pièces:
- ligne PIECE: `piece_ref`, `quantity`
- ligne SET complet: BOM × quantité
- ligne SET partiel: `overrides` uniquement
4. allouer FIFO par pièce
5. créer `stock_movements OUT` (`source_type = SALE`, `source_id = sale_item_id`)
6. créer `sale_item_pieces` (snapshot réel)
7. calculer `cost_amount`, `margin_amount`, `margin_rate`

Si stock insuffisant:
- annuler la transaction de vente (pas de vente confirmée partielle)

### Annulation d'une vente

Déclencheur:
- passage statut en `CANCELLED`

Effet stock:
- création des mouvements miroirs `IN` des sorties d'origine
- `source_type = SALE_CANCEL`

Effet vente:
- statut final `CANCELLED`

### Suppression définitive vente

Comportement attendu:
- suppression `sales`, `sale_items`, `sale_item_pieces`
- suppression des mouvements associés (`SALE`, `SALE_CANCEL`, `SALE_EDIT`)

## 5.4 Stock

### Écran stock agrégé (`/stock`)

Source de données:
- vue `stock_per_piece` uniquement

Fonctions:
- recherche par `piece_ref`
- tri colonnes
- KPIs globaux stock (quantité, valeur, coût moyen)
- accès détail pièce
- accès historique global

### Écran détail pièce (`/stock/[piece_ref]`)

Source de données:
- vue `piece_movements`

Fonctions:
- journal complet des mouvements de la pièce
- lecture de la provenance (`PURCHASE`, `SALE`, etc.)
- navigation vers lot source si applicable

### Historique global (`/historique-stock`)

Source de données:
- vue `stock_journal`

Filtres:
- période (`from`, `to`)
- `piece_ref`
- direction (`IN` / `OUT` / `ADJUST`)
- type source (`PURCHASE` / `SALE` / `ADJUSTMENT`)

## 5.5 Dashboard

Objectif cible:
- synthèse lisible des indicateurs clés opérationnels

Minimum attendu:
- widgets connectés aux données réelles (pas uniquement placeholders)
- indicateurs cohérents avec les pages Ventes / Stock / Approvisionnement

## 6. Règles transverses

1. Source de vérité stock:
- uniquement `stock_movements`

2. FIFO:
- non négociable

3. Snapshot historique:
- `sale_item_pieces` fait foi pour le détail vendu

4. Traçabilité:
- chaque mouvement doit porter `source_type` et `source_id`

5. Cohérence statut:
- un lot `confirmed` n'est plus éditable sur ses lignes inventory
- une vente `CANCELLED` n'entre plus dans les KPIs business

6. Cohérence type de vente:
- `sales.sale_type` est la source de vérité
- toutes les lignes d'une vente doivent matcher ce type

## 7. Hors périmètre (rappel)

- marketplace connectée
- gestion multi-user avancée (permissions fines, audit user complet)

Voir aussi: `docs/NON_GOALS.md`.

## 8. Critères d'acceptation

Les critères détaillés par page sont dans `docs/ACCEPTANCE_CRITERIA.md`.

## 9. DECISIONS NEEDED

Les points suivants doivent être tranchés explicitement (ne pas implémenter par défaut):

1. Suppression de lots confirmés:
- autorisée avec garde-fous supplémentaires ou interdite?
- impact attendu sur l'historique stock à formaliser.

2. Règles d'arrondi monétaire:
- stratégie officielle pour répartitions multi-lignes (centimes):
  - arrondi ligne par ligne
  - ajustement sur dernière ligne
  - autre
