# Workflow multi-agents

Objectif: permettre un travail parallèle sans casser les flux critiques achats/stock/ventes.

## 1. Règle de base

- 1 ticket = 1 branche = 1 agent responsable.
- Ne pas partager une même branche entre plusieurs agents.
- Préfixe de branche recommandé: `codex/<ticket-id>-<short-name>`.

## 2. Zones sensibles (coordination obligatoire)

Avant toute modification, vérifier qu'aucun autre agent ne travaille en parallèle sur:

- `src/app/actions/sales.ts`
- `src/app/approvisionnement/action.ts`
- `src/lib/sales.ts`
- `src/lib/stock.ts`
- `src/types/supabase.ts`
- `supabase/*`

Règle anti-conflits:
- si un ticket touche un fichier sensible, réserver ce fichier pour la durée du ticket.

## 3. Découpage recommandé des tickets

- Ticket "UI":
  - composants/pages sans modification d'algorithme métier
- Ticket "Domain":
  - validations et règles `sales/stock`
- Ticket "DB":
  - migrations, vues SQL, types générés
- Ticket "Docs":
  - README + `docs/*`

Ne pas mélanger "DB" et "Domain" avec un gros refactor UI dans la même PR.

## 4. Protocole de handoff entre agents

Chaque agent laisse, dans sa PR ou son message de passation:

- périmètre exact modifié
- hypothèses prises
- risques identifiés
- tests/commandes exécutés
- points bloquants éventuels

Format minimal:
- `Contexte`
- `Changements`
- `Risques`
- `Checks`
- `Next`

## 5. Stratégie anti-conflits

- Rébase fréquente sur la branche de référence.
- PR courtes et atomiques.
- Si conflit sur fichier sensible:
  - priorité à l'agent "owner" du ticket principal
  - les autres tickets se rebases ensuite

## 6. Politique de modification métier

- Interdit de changer FIFO sans ticket explicite.
- Interdit de modifier le schéma production sans migration versionnée.
- Toute décision structurante doit être tracée dans `docs/DECISIONS.md`.

## 7. Done côté agent

Avant de considérer un ticket "fini":
- lint/build passés
- docs alignées
- pas de changements hors périmètre annoncé
