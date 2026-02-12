# AS-IS - État réel implémenté

Date de référence: 2026-02-12
Méthode: lecture directe du code dans `src/app`, `src/components`, `src/lib`, `src/types/supabase.ts`.

## 1. Routes existantes (preuves)

- `/` -> `src/app/page.tsx`
- `/catalogue` -> `src/app/catalogue/page.tsx`
- `/catalogue/[id]` -> `src/app/catalogue/[id]/page.tsx`
- `/approvisionnement` -> `src/app/approvisionnement/page.tsx`
- `/approvisionnement/[id]` -> `src/app/approvisionnement/[id]/page.tsx`
- `/ventes` -> `src/app/ventes/page.tsx`
- `/ventes/nouvelle` -> `src/app/ventes/nouvelle/page.tsx`
- `/ventes/[id]` -> `src/app/ventes/[id]/page.tsx`
- `/ventes/[id]/[saleItemId]` -> `src/app/ventes/[id]/[saleItemId]/page.tsx`
- `/stock` -> `src/app/stock/page.tsx`
- `/stock/[piece_ref]` -> `src/app/stock/[piece_ref]/page.tsx`
- `/historique-stock` -> `src/app/historique-stock/page.tsx`
- API `/api/sets/[setId]/bom-stock` -> `src/app/api/sets/[setId]/bom-stock/route.ts`

## 2. Fonctionnalités réellement présentes

## 2.1 Catalogue

Implémenté:
- liste avec tri/recherche/filtres
- création set
- suppression set
- fiche set avec édition metadata + image
- gestion BOM (ajout/modif/suppression pièce)
- calcul complétion set à partir du stock

Preuves:
- `src/app/catalogue/page.tsx`
- `src/app/catalogue/actions.ts`
- `src/app/catalogue/[id]/page.tsx`
- `src/app/actions/update-bom.ts`
- `src/app/actions/update-set-info.ts`
- `src/app/actions/update-set.ts`

## 2.2 Approvisionnement

Implémenté:
- liste de lots avec tri
- création lot (modale)
- édition lot (modale)
- suppression lot (avec garde-fou UI Lot 0 confirmé)
- détail lot avec ajout rapide pièce, édition/suppression ligne
- verrouillage édition des lignes quand lot confirmé
- passage `draft -> confirmed` générant des mouvements `IN`
- recalcul `total_pieces` et `unit_cost` global des lignes d'un lot

Limite constatée:
- la confirmation d'un lot vide (`total_pieces = 0`) reste possible (pas de blocage serveur explicite)

Preuves:
- `src/app/approvisionnement/page.tsx`
- `src/app/approvisionnement/action.ts`
- `src/app/approvisionnement/NewLotDialog.tsx`
- `src/app/approvisionnement/EditLotDialog.tsx`
- `src/app/approvisionnement/[id]/page.tsx`
- `src/app/approvisionnement/[id]/QuickAddPieceForm.tsx`

## 2.3 Ventes

Implémenté:
- écran liste `Commandes` (1 ligne = 1 vente)
- création vente via modale (`SET` ou `PIECE`) + route dédiée `/ventes/nouvelle`
- édition vente via modale
- annulation vente (statut `CANCELLED` + mouvements miroirs `IN`)
- suppression définitive vente et données liées
- détail vente
- détail des pièces consommées pour une ligne set (`/ventes/[id]/[saleItemId]`)
- tri/pagination des commandes déjà branchés
- cohérence `sale_type` vs lignes validée côté serveur (`SET` ou `PIECE`, pas de mix)

Preuves:
- `src/app/ventes/page.tsx`
- `src/components/sales/SalesTable.tsx`
- `src/components/sales/SoldPiecesTable.tsx` (composant présent mais non branché à un écran global)
- `src/app/ventes/nouvelle/NewSaleForm.tsx`
- `src/app/actions/sales.ts`
- `src/app/ventes/[id]/page.tsx`
- `src/app/ventes/[id]/[saleItemId]/page.tsx`

Remarque:
- il n'existe pas de route liste dédiée "pièces vendues".
- il existe un écran de détail de pièces par ligne set.

## 2.4 KPIs Ventes

Implémenté aujourd'hui:
- CA net (confirmées)
- marge totale
- taux de marge moyen
- commandes avec set(s)
- commandes avec pièce(s)
- fenêtres KPI par carte: `7/30/90/365` jours
- trend calculé en `30j vs 30j précédents`

Preuve:
- `src/app/ventes/page.tsx`

Écart vs demande cible:
- les KPIs ne sont pas présentés explicitement en split strict `sale_type=SET` vs `sale_type=PIECE` pour CA et marge.
- le mode cible `Total/90/30/7` n'est pas appliqué tel quel.
- la table Commandes inclut `CONFIRMED` et `CANCELLED` par défaut (pas de filtre `CONFIRMED` implicite).

## 2.5 Stock

Implémenté:
- vue agrégée stock par pièce
- détail historique par pièce
- journal global stock filtrable

Preuves:
- `src/app/stock/page.tsx`
- `src/app/stock/[piece_ref]/page.tsx`
- `src/app/historique-stock/page.tsx`

Limite constatée:
- UI d'ajustement manuel de stock non identifiée dans le repo (affichage/filtrage `ADJUSTMENT` présent, mais création non trouvée).

## 2.6 Dashboard

Implémenté:
- page dashboard majoritairement statique/placeholder

Preuve:
- `src/app/page.tsx`

## 3. Règles métier réellement implémentées

## 3.1 Stock dérivé du ledger

Constat:
- les pages stock s'appuient sur vues SQL (`stock_per_piece`, `stock_journal`, `piece_movements`)
- les mouvements sont écrits dans `stock_movements`

Preuves:
- `src/lib/stock.ts`
- `src/app/stock/page.tsx`
- `src/app/historique-stock/page.tsx`

## 3.2 FIFO obligatoire pour ventes

Constat:
- allocation FIFO dans `allocateFifoForPiece`
- erreur si quantité demandée > disponible

Preuve:
- `src/lib/stock.ts`

## 3.3 Snapshot historique pièces vendues

Constat:
- insertion `sale_item_pieces` à la création/édition de vente
- détails consultables par route dédiée

Preuves:
- `src/app/actions/sales.ts`
- `src/app/ventes/[id]/[saleItemId]/page.tsx`

## 3.4 Set incomplet via overrides

Constat:
- UI de saisie quantités par pièce (`SetPiecesDialog`)
- `overrides` envoyé et utilisé pour la consommation réelle

Preuves:
- `src/components/sales/SetSelector.tsx`
- `src/components/sales/SetPiecesDialog.tsx`
- `src/lib/sales.ts`

## 3.5 Vente mono-type (pas de mix SET/PIECE)

Constat:
- les validations serveur rejettent les ventes mixtes (incohérence `sale_type`/`item_kind`)
- la logique de création/édition part d'un type de vente unique

Preuves:
- `src/app/actions/sales.ts`
- `src/lib/sales-types.ts`

## 4. Tables/vues/fonction effectivement consommées

Tables:
- `inventory`, `lots`, `stock_movements`
- `sales`, `sale_items`, `sale_item_pieces`
- `sets_catalog`, `sets_bom`

Vues:
- `set_with_completion`
- `stock_per_piece`, `stock_journal`, `piece_movements`
- `sold_pieces_journal`, `sale_item_movements` (typées)

Fonction SQL:
- `reset_sales_id_sequence`

Preuve:
- `src/types/supabase.ts`

## 5. Points non implémentés / limites constatées

- pas de migrations SQL versionnées (`supabase/migrations` absent)
- `seed.sql` référencé dans `supabase/config.toml` mais absent
- pas de couche auth applicative dans le code (sessions/users)
- pas de script `test` dans `package.json`
- dashboard non branché aux données réelles
- garde-fou \"lot vide non confirmable\" non implémenté côté serveur
- sécurisation DB (contraintes/trigger anti stock négatif) non versionnée dans le repo
- pas de contrat data unique `liste + KPIs` pour `/ventes` (liste en `src/lib/sales.ts`, KPIs calculés dans la page)
- flux ventes multi-étapes sans transaction DB atomique unique (risque en cas d'échec intermédiaire)

Preuves:
- `supabase/config.toml`
- `package.json`
- `src/lib/supabase.ts`
- `src/lib/supabase-server.ts`
- `src/app/page.tsx`

## 6. Conclusion AS-IS

Le socle métier achats/stock/ventes est déjà substantiel et cohérent avec un modèle ledger+FIFO.
Les écarts principaux vers la cible demandée se situent surtout sur:
- alignement KPI Ventes (fenêtres, split strict `SET` vs `PIECE`, exclusion `CANCELLED` partout)
- garde-fous forts Appro/DB (`lot vide`, anti-stock négatif, migrations versionnées)
- consolidation data-access Ventes pour limiter les divergences et conflits d'implémentation
