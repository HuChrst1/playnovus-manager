# AS-IS - Etat reel implemente

Date de reference: 2026-02-24
Methode: lecture directe du code dans `src/app`, `src/components`, `src/lib`, `src/types/supabase.ts`, `supabase/migrations`.

## 1. Routes existantes (preuves)

Routes metier:
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
- `/compte` -> `src/app/compte/page.tsx`

Routes auth:
- `/login` -> `src/app/login/page.tsx`
- `/forgot-password` -> `src/app/forgot-password/page.tsx`
- `/reset-password` -> `src/app/reset-password/page.tsx`

API exposee:
- `/api/sets/[setId]/bom-stock` -> `src/app/api/sets/[setId]/bom-stock/route.ts`

## 2. Fonctionnalites reellement presentes

## 2.1 Catalogue

Implemente:
- liste avec tri/recherche/filtres
- creation set
- suppression set
- fiche set avec edition metadata + image
- gestion BOM (ajout/modif/suppression piece)
- calcul completion set a partir du stock

Preuves:
- `src/app/catalogue/page.tsx`
- `src/app/catalogue/actions.ts`
- `src/app/catalogue/[id]/page.tsx`
- `src/app/actions/update-bom.ts`
- `src/app/actions/update-set-info.ts`
- `src/app/actions/update-set.ts`

## 2.2 Approvisionnement

Implemente:
- liste de lots avec tri
- creation lot (modale)
- edition lot (modale)
- suppression lot `draft` et `confirmed` si non utilise en ventes
- protection explicite de `LOT_0` (non supprimable)
- detail lot avec ajout rapide piece, edition/suppression ligne
- verrouillage edition des lignes quand lot confirme
- synchronisation stock/statut:
  - `draft -> confirmed`: creation des mouvements `PURCHASE` (`IN`)
  - `confirmed -> draft`: retrait des mouvements `PURCHASE` si aucune vente liee
- blocage explicite de suppression et de downgrade statut si le lot a deja ete utilise en ventes
- recalcul `total_pieces` et `unit_cost` global des lignes d'un lot
- garde-fou serveur: confirmation d'un lot vide refusee
- attachements facture lot (photo/pdf) presents

Preuves:
- `src/app/approvisionnement/page.tsx`
- `src/app/approvisionnement/action.ts`
- `src/app/approvisionnement/NewLotDialog.tsx`
- `src/app/approvisionnement/EditLotDialog.tsx`
- `src/app/approvisionnement/[id]/page.tsx`
- `src/app/approvisionnement/[id]/QuickAddPieceForm.tsx`
- `src/app/approvisionnement/[id]/LotInvoiceAttachmentPanel.tsx`

## 2.3 Ventes

Implemente:
- ecran liste `Commandes` (1 ligne = 1 vente)
- creation vente via modale (`SET` ou `PIECE`) + route dediee `/ventes/nouvelle`
- edition vente via modale
- annulation vente (statut `CANCELLED` + mouvements miroirs `IN`)
- suppression definitive vente et donnees liees
- detail vente
- detail des pieces consommees pour une ligne set (`/ventes/[id]/[saleItemId]`)
- tri/pagination des commandes
- coherence `sale_type` vs lignes validee cote serveur (`SET` ou `PIECE`, pas de mix)

Preuves:
- `src/app/ventes/page.tsx`
- `src/components/sales/SalesTable.tsx`
- `src/app/ventes/nouvelle/NewSaleForm.tsx`
- `src/app/actions/sales.ts`
- `src/app/ventes/[id]/page.tsx`
- `src/app/ventes/[id]/[saleItemId]/page.tsx`

Remarque:
- il n'existe pas de route liste dediee "pieces vendues"
- l'audit detail est fourni au niveau d'une ligne set vendue

## 2.4 KPIs Ventes

Implemente aujourd'hui:
- CA net
- marge totale
- taux de marge moyen
- commandes avec set(s)
- commandes avec piece(s)
- fenetres KPI par carte: `7/30/90/365` jours
- trend calcule en `30j vs 30j precedents`

Preuves:
- `src/app/ventes/page.tsx`
- `src/lib/sales.ts`

Ecarts encore ouverts vs cible:
- split strict `SET` vs `PIECE` non totalement applique pour tous les indicateurs
- mode cible `Total/90/30/7` non applique tel quel
- table commandes inclut `CONFIRMED` + `CANCELLED` par defaut

## 2.5 Stock

Implemente:
- vue agregee stock par piece
- detail historique par piece
- journal global stock filtrable

Preuves:
- `src/app/stock/page.tsx`
- `src/app/stock/[piece_ref]/page.tsx`
- `src/app/historique-stock/page.tsx`

Limite constatee:
- UI d'ajustement manuel de stock non identifiee (affichage `ADJUSTMENT` present, creation non trouvee)

## 2.6 Dashboard

Implemente:
- dashboard data-driven (filtres periode, blocs KPI, modales detail)
- bloc opportunites catalogue base sur `set_with_completion`
- blocs pilotage achats/stock et comparaison sets vs pieces

Preuves:
- `src/app/page.tsx`
- `src/lib/dashboard.ts`
- `src/components/dashboard/DashboardExecutiveView.tsx`

## 2.7 Auth / securite applicative

Implemente:
- entree auth explicite (`/login`)
- pages `forgot-password` et `reset-password`
- session cookies applicatifs (remember + inactivity)
- garde d'acces proxy sur routes metier
- CAPTCHA Turnstile sur flux auth
- scopes de rate-limit applicatifs sur endpoints sensibles

Preuves:
- `src/proxy.ts`
- `src/lib/auth/*`
- `src/app/login/actions.ts`
- `src/app/forgot-password/actions.ts`
- `src/lib/security/rate-limit.ts`

## 2.8 Module Tools (phase 9)

Etat actuel:
- aucune route `/tools` implementee
- aucun onglet topbar `Tools`
- aucun schema DB dedie Tools present

## 3. Regles metier reellement implementees

## 3.1 Stock derive du ledger

Constat:
- les pages stock s'appuient sur vues SQL (`stock_per_piece`, `stock_journal`, `piece_movements`)
- les mouvements sont ecrits dans `stock_movements`

Preuves:
- `src/lib/stock.ts`
- `src/app/stock/page.tsx`
- `src/app/historique-stock/page.tsx`

## 3.2 FIFO obligatoire pour ventes

Constat:
- allocation FIFO dans `allocateFifoForPiece`
- erreur si quantite demandee > disponible

Preuve:
- `src/lib/stock.ts`

## 3.3 Snapshot historique pieces vendues

Constat:
- insertion `sale_item_pieces` a la creation/edition de vente
- details consultables par route dediee

Preuves:
- `src/app/actions/sales.ts`
- `src/app/ventes/[id]/[saleItemId]/page.tsx`

## 3.4 Set incomplet via overrides

Constat:
- UI de saisie quantites par piece (`SetPiecesDialog`)
- `overrides` envoyes et utilises pour la consommation reelle

Preuves:
- `src/components/sales/SetSelector.tsx`
- `src/components/sales/SetPiecesDialog.tsx`
- `src/lib/sales.ts`

## 3.5 Vente mono-type (pas de mix SET/PIECE)

Constat:
- les validations serveur rejettent les ventes mixtes (incoherence `sale_type`/`item_kind`)
- la logique de creation/edition part d'un type de vente unique

Preuves:
- `src/app/actions/sales.ts`
- `src/lib/sales-types.ts`

## 4. Tables/vues/fonctions effectivement consommees

Tables:
- `inventory`, `lots`, `stock_movements`
- `sales`, `sale_items`, `sale_item_pieces`
- `sets_catalog`, `sets_bom`
- `report_tickets`

Vues:
- `set_with_completion`
- `stock_per_piece`, `stock_journal`, `piece_movements`
- `sold_pieces_journal`, `sale_item_movements` (typees)

Fonction SQL:
- `reset_sales_id_sequence`

Preuve:
- `src/types/supabase.ts`

## 5. Points non implementes / limites constatees

- module `Tools` non implemente (routes, UI, APIs, schema)
- kanban de mise en vente non implemente
- agregateur pieces manquantes `>=90%` non implemente
- generateur descriptions marketplace non implemente
- generateur fiche remerciement PDF A5 + QR non implemente
- estimation prix multi-plateformes (scraping + fallback manuel) non implementee
- table commandes inclut `CANCELLED` par defaut (decision produit encore ouverte)
- flux ventes multi-etapes sans transaction DB atomique unique
- rate-limit memoire locale (non distribue multi-instance)

## 6. Etat migrations / outillage

Constat:
- migrations SQL versionnees presentes dans `supabase/migrations`
- `supabase/seed.sql` present
- script `test` present dans `package.json`

Preuves:
- `supabase/migrations/*`
- `supabase/seed.sql`
- `package.json`

## 7. Conclusion AS-IS

Le socle metier achats/stock/ventes/auth est operationnel et coherent avec le modele ledger+FIFO.
Les ecarts principaux avant implementation phase 9 concernent la couche `Tools` orientee processus de mise en vente, sans remise en cause des invariants coeur deja en place.
