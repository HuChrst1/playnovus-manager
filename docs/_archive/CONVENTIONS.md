# Conventions de projet

## 1. Naming

- Dossiers:
  - routes Next: kebab-case (ex: `approvisionnement`, `historique-stock`)
  - composants UI: PascalCase (ex: `NewSaleDialog.tsx`)
  - helpers/lib: camelCase ou domain-name explicite (`sales.ts`, `stock.ts`)
- Types:
  - suffixer les objets de contrat avec `Row`, `Insert`, `Update`, `Result`, `Props`
- Actions serveur:
  - suffixe `Action` pour les actions publiques (ex: `createSaleAction`)
- Clés métier:
  - conserver les noms DB (`piece_ref`, `set_id`, `sale_id`) pour limiter les mappings

## 2. Organisation des fichiers

- `src/app/*`
  - uniquement orchestration route/page + composition UI
- `src/app/actions/*`
  - appels DB transactionnels et flux métier serveur
- `src/lib/*`
  - logique partagée et utilitaires métier
- `src/components/*`
  - UI et interactions utilisateur

Règle:
- éviter de dupliquer de la logique métier entre composants client et server actions.

## 3. Style de code

- TypeScript strict par défaut.
- Privilégier des fonctions pures pour les règles métier.
- Garder les validations proches des entrées (formulaire/action).
- Traiter explicitement les cas `null`/`undefined` provenant de Supabase.
- Ne pas utiliser de `any` sauf exception documentée.

## 4. Commits

Format recommandé:
- `feat(scope): ...` pour ajout de capacité
- `fix(scope): ...` pour correction
- `refactor(scope): ...`
- `docs(scope): ...`
- `chore(scope): ...`

Exemples:
- `docs(readme): remplacer le template next par la doc projet`
- `fix(sales): corriger validation net_amount en mode piece`

## 5. Definition of Done (standard)

Toute feature/correction est "Done" uniquement si:

1. Code
- la logique est implémentée et relue
- pas de régression évidente sur les flux liés

2. Qualité technique
- `npm run lint` passe
- `npm run build` passe
- si des tests existent sur la zone, ils passent

3. Data/DB (si impact DB)
- migration SQL écrite et versionnée
- rollback ou stratégie de retour arrière décrite
- types Supabase régénérés si nécessaire

4. Documentation
- README/docs mis à jour si comportement, setup ou conventions changent
- décision importante ajoutée dans `docs/DECISIONS.md`

5. Vérification fonctionnelle
- parcours manuel principal validé (happy path + au moins un edge case)

## 6. Interdits

- Modifier la logique FIFO sans explicitation et validation dédiée.
- Changer le schéma de production sans migration formelle.
- Mélanger refactor structurel et changement métier dans le même ticket sans justification.
