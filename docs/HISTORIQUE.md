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
