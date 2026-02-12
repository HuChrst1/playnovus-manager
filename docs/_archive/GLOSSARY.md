# Glossaire métier

## lot

Contenant d'approvisionnement regroupant des lignes de pièces achetées.

- table: `lots`
- statut: `draft` (modifiable) / `confirmed` (intégré stock)

## lot_code

Code métier lisible d'un lot (ex: `LOT_0`).

## inventory

Détail des pièces d'un lot.

- table: `inventory`
- clé métier: `(lot_id, piece_ref)`

## piece_ref

Référence unique d'une pièce Playmobil.

- utilisée dans BOM, stock, ventes, snapshots

## set / set_id

Set catalogue vendu en entier ou partiellement.

- table: `sets_catalog`
- clé technique: `id`

## display_ref

Référence commerciale affichée d'un set (ex: `3666`).

## BOM

Bill of Materials: nomenclature des pièces nécessaires pour un set.

- table: `sets_bom`
- champs principaux: `piece_ref`, `quantity`

## sale / commande

Vente globale (1 ligne dans l'écran Commandes).

- table: `sales`
- contient date, canal, type, statut, net, coûts, marge

## sale_type

Type métier d'une vente.

- valeurs attendues: `SET` ou `PIECE`

## sale_item

Ligne composante d'une vente.

- table: `sale_items`
- `item_kind`: `SET` ou `PIECE`

## set partiel

Cas où la ligne set vend moins que le BOM théorique.

- implémenté par `overrides`

## overrides

Mapping `piece_ref -> quantité finale vendue` pour une ligne set.

- utilisé comme vérité de sortie stock pour set incomplet

## sale_item_pieces

Snapshot historique des pièces réellement consommées pour une ligne de vente.

- table: `sale_item_pieces`
- référence lot + quantité + coût unitaire

## stock_movement / movement

Événement élémentaire de stock dans le ledger.

- table: `stock_movements`
- directions: `IN`, `OUT`, `ADJUST`

## ledger stock

Journal canonique des mouvements (`stock_movements`) depuis lequel le stock est dérivé.

## source_type

Origine métier d'un mouvement de stock.

- exemples: `PURCHASE`, `SALE`, `SALE_CANCEL`, `SALE_EDIT`, `ADJUSTMENT`

## source_id

Identifiant métier de la source du mouvement (id lot, id ligne de vente, etc.).

## FIFO

First In, First Out: règle de consommation où les entrées les plus anciennes sortent en premier.

## stock_per_piece

Vue SQL agrégée du stock courant par `piece_ref`.

- champs clés: `total_quantity`, `avg_unit_cost`, `total_value`

## stock_journal

Vue SQL du journal global des mouvements enrichi de données lot/source.

## piece_movements

Vue SQL du journal des mouvements pour une pièce donnée.

## marge réelle

Marge calculée sur coûts FIFO réels.

- `total_margin_amount = net_seller_amount - total_cost_amount`
- `margin_rate = total_margin_amount / net_seller_amount` si net > 0

## net_seller_amount

Montant net vendeur de la commande, base de calcul de la marge.

## confirmed / cancelled

Statuts de vente.

- `CONFIRMED`: vente active impactant le stock
- `CANCELLED`: vente annulée avec restauration stock

## draft / confirmed (lot)

Statuts de lot d'approvisionnement.

- `draft`: éditable, sans impact stock
- `confirmed`: figé, mouvements `IN` créés
