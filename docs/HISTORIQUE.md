# HISTORIQUE

Ce fichier consigne les changements du projet, etapes par etapes.

## 2026-02-12 - F0.1 Standardiser les scripts qualite

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json` pour standardiser les scripts qualite:
- `typecheck`: `tsc --noEmit`
- `lint`: `eslint .` (bloquant)
- `test`: `npm run test:unit && npm run test:e2e`
- `test:unit`: placeholder pragmatique avec TODO explicite (framework unitaire non installe)
- `test:e2e`: placeholder pragmatique avec TODO explicite (framework e2e non installe)
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/README.md` avec une section `Qualite / Verification` listant les commandes projet.

### Verifications executees

- `npm run typecheck`: KO (erreurs TypeScript existantes dans le code applicatif, pas d'erreur de configuration script)
- `npm run lint`: KO (erreurs ESLint existantes dans le code applicatif, commande bien bloquante)
- `npm run test`: OK
- `npm run test:unit`: OK
- `npm run test:e2e`: OK

### Perimetre / limites

- Aucune logique metier applicative modifiee.
- Nettoyage des erreurs lint/types hors perimetre F0.1 (traite par F0.2/F0.3).
- Integration de frameworks de tests unitaires/e2e hors perimetre F0.1 (TODO explicites conserves).

## 2026-02-13 - F0.2 Nettoyage lint domaine Ventes/FIFO

Statut: `FAIT`

### Changements realises

- Nettoyage lint/type sur les fichiers cibles F0.2:
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/actions/sales.ts`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/nouvelle/NewSaleForm.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/sales.ts`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/stock.ts`
- Suppression des `any` non justifies et renforcement de types (`unknown`, guards, normalisation typée) sans modifier la logique metier FIFO.
- Correctif connexe en edition de vente:
- ajout d'un "stock virtuel" pour les checks UI en mode edit (`stock actuel + pieces de la vente editee`)
- ajout de `stockCreditByPieceRef` dans le flux `getSaleDraftForEditAction -> EditSaleDialog -> NewSaleForm`
- Commit de reference: `31231d4` (`feat(ventes): conclure F0.2 lint et stock virtuel en edition`).

### Verifications executees

- `npx eslint src/app/actions/sales.ts src/app/ventes/nouvelle/NewSaleForm.tsx src/lib/sales.ts src/lib/stock.ts`: OK (`0 error`, `0 warning`)
- `npx eslint src/app/actions/sales.ts src/components/sales/EditSaleDialog.tsx src/app/ventes/nouvelle/NewSaleForm.tsx`: OK (`0 error`, `0 warning`)
- `npm run typecheck --silent`: KO global (erreurs hors perimetre F0.2), aucun diagnostic releve sur les fichiers F0.2 cibles

### Perimetre / limites

- Aucune modification de logique metier applicative (FIFO, allocations, regles de validation metier).
- Le lint global du repo reste bloquant tant que les phases suivantes (notamment F0.3) ne sont pas traitees.

## 2026-02-13 - F0.3 Nettoyage lint UI shared + Catalogue/Appro/Stock

Statut: `FAIT`

### Changements realises

- Nettoyage lint/type sur le perimetre F0.3:
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/input.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/textarea.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/[id]/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/NewLotDialog.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/historique-stock/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/catalogue/delete-piece-button.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/catalogue/edit-piece-dialog.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/catalogue/set-image.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/[id]/[saleItemId]/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/DeleteSaleDialog.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/PieceSelector.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SetSelector.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SetPiecesDialog.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SalesTable.tsx`
- Corrections lint global complementaires validees:
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardStatCard.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/import-data.ts`
- Ajustements de typage necessaires pour gate `typecheck/build`:
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/[id]/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/actions.ts`

### Verifications executees

- `npm run lint`: OK (`0 error`, `0 warning`)
- `npm run typecheck`: OK
- `npm run build`: OK

### Perimetre / limites

- Aucune modification de logique metier applicative (FIFO, annulation, regles ventes/stock).
- Aucun changement de schema DB / migration.

## 2026-02-13 - Suppression lot confirme + sync statut/stock

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`:
- ajout d'un helper unique `getLotSalesUsage` pour detecter l'usage ventes d'un lot
- ajout des helpers `deletePurchaseMovementsForLot` et `createPurchaseMovementsForLot`
- `updateLotFromDialog` synchronise maintenant le stock selon transition:
- `draft -> confirmed`: recreation des mouvements `PURCHASE`
- `confirmed -> draft`: retrait des mouvements `PURCHASE` avec blocage si ventes liees
- `deleteLot` autorise suppression des lots `draft` et `confirmed` (y compris `LOT_0`) si aucune vente liee, avec suppression des effets stock/historique associes
- enrichissement des retours d'erreur (`reason`, `linkedSaleIds`, `linkedSalesCount`) sans rupture de compat
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/DeleteLotButton.tsx`:
- suppression du blocage client sur lot confirme
- confirmation utilisateur explicite pour l'impact stock/historique
- guidage utilisateur en cas de blocage `LOT_USED_BY_SALES`
- sans `console.error` client pour erreurs metier attendues
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`:
- ajout des decisions `D-010` (suppression controlee lot confirme) et `D-011` (synchronisation statut/stock)

### Verifications executees

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK

### Perimetre / limites

- Aucun changement de schema DB / migration.
- Aucune suppression en cascade des ventes.
- Blocage conserve si le lot a deja ete utilise dans des ventes.

## 2026-02-15 - Alignement documentation apres mises a jour lot/statut

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/AS_IS.md`:
- alignement du comportement Approvisionnement avec l'implementation reelle:
  - suppression lot `draft/confirmed` (incluant `LOT_0`) si non utilise en ventes
  - synchronisation `draft <-> confirmed` sur les mouvements `PURCHASE`
  - blocage si usage ventes detecte
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/CAHIER_DES_CHARGES.md`:
- regles cibles Approvisionnement mises a jour pour inclure:
  - retour `confirmed -> draft` conditionnel
  - suppression lot confirme conditionnelle
  - criteres d'acceptation anti-doublon mouvements
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
- `Phase 0` marquee `FAIT`
- ajout de `F2.0` (suppression lot confirme + sync statut/stock) marquee `FAIT`
- `Phase 2` marquee `EN COURS`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/00_START_HERE.md`:
- ordre de lecture complete avec `DECISIONS` et `HISTORIQUE`
- index des docs principales complete avec `HISTORIQUE`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/_archive/BACKLOG.md`:
- ticket `T-330` passe de bloque a traite (decision appliquee)

### Verifications executees

- revue de coherence sur tous les fichiers `docs/*` avec recherche ciblee des regles lot/statut

### Perimetre / limites

- Les docs archivees dans `docs/_archive/` restent historiques; seules les contradictions critiques ont ete corrigees.
