# F5.5 UX Audit - Etat actuel post-refonte

Date: 2026-02-22  
Perimetre: parcours metier web app (`/`, `/approvisionnement`, `/ventes`, `/stock`, `/historique-stock`, `/catalogue`, sous-pages details et modales associees).

## 1) Methode

- Base d'analyse:
  - lecture des parcours dans `src/app/**` et `src/components/**`
  - consolidation des changements traces depuis F5.5 (`ROADMAP`, `HISTORIQUE`, diff courant)
- Critere de validation:
  - uniquement les elements valides et observables dans le code courant
- Heuristiques appliquees:
  - clarte de l'action principale
  - coherence de placement des controles
  - prevention d'erreurs
  - feedback utilisateur
  - charge cognitive
  - continuite responsive desktop/mobile

## 2) Evaluation par parcours

## Navigation globale et reperage

- Etat: **Bon**
- Forces:
  - topbar stable, navigation centrale claire, action report visible
  - bouton retour global toujours accessible
- Frictions:
  - comportement `back` depend de l'historique navigateur (peut surprendre selon entree directe)
- Pistes:
  - ajouter un micro-feedback contextuel (tooltip/info) sur fallback vers `/`.

## Dashboard executif

- Etat: **Bon**
- Forces:
  - densite mieux maitrisee, modales specialisees, tendances en vues explicites
  - opportunites en theme sombre coherent avec la card
- Frictions:
  - multiplicite de modales peut augmenter la charge cognitive pour nouveaux utilisateurs
- Pistes:
  - ajouter un resume contextuel bref en tete de modal (objectif/lecture).

## Approvisionnement (liste + detail lot)

- Etat: **Bon**
- Forces:
  - actions de table clarifiees, filtre compact, nouvelle logique fournisseur plus guidante
  - detail lot enrichi (gestion piece jointe integree, edition rapide)
- Frictions:
  - certains controles details/summary restent sensibles a la precision de clic en environnement dense
- Pistes:
  - renforcer affordance visuelle des zones interactives (hover/focus explicites).

## Ventes (liste + details + modales New/Edit)

- Etat: **Partiellement bon**
- Forces:
  - coherence liste/detail amelioree, libelles metier plus lisibles (`Commande n°`, `SETS/PIECES`)
  - colonnes et statuts globalement mieux organises
- Frictions:
  - formulaire New/Edit reste dense, avec un cout cognitif eleve sur les cas mixtes set/piece
  - variations de rythme vertical selon etat (`create` vs `edit`)
- Pistes:
  - segmentation plus explicite des sections et aides contextuelles par mode.

## Stock / Historique stock

- Etat: **Bon**
- Forces:
  - alignement visuel avec appro/ventes
  - separation claire recherche vs actions
  - historique conserve la semantique couleur vert/rouge
- Frictions:
  - utilite percue des actions secondaires peut varier selon profil utilisateur
- Pistes:
  - clarifier les labels et tooltips des actions peu frequentes.

## Catalogue (liste + detail set)

- Etat: **Partiellement bon**
- Forces:
  - toolbar filtres par categories plus directe que l'ancien panneau lateral
  - detail set plus structuré (fiche + inventaire + pieces)
- Frictions:
  - systeme de filtres multi-dropdown peut devenir charge quand plusieurs panneaux sont ouverts successivement
  - detail pieces: bascule de colonnes QTE ajoute une interaction supplementaire a memoriser
- Pistes:
  - meilleure signalisation des etats actifs de filtres et simplification des toggles secondaires.

## 3) Synthese frictions prioritaires

## Quick wins (priorite haute, effort faible)

1. Standardiser les micro-interactions des boutons icon-only (hover/focus/disabled) sur toutes les tables.
2. Uniformiser les gabarits de modales metier (header, espace, footer) pour reduire l'effet de contexte.
3. Ajouter des tooltips courts sur les actions ambigues (retour global, toggles de colonnes, filtres compacts).

## Chantiers moyens (priorite moyenne)

1. Simplifier la lecture des formulaires de ventes (ordre visuel, regroupements, labels d'aide).
2. Harmoniser le pattern de filtres entre pages (`details/summary`, actions reset/apply, feedback selection).
3. Renforcer l'etat vide/actionnable des sections detail (dashboard et catalogue detail).

## Refontes structurantes (priorite strategique)

1. Introduire un pattern unique de "toolbar metier" reutilisable (filtres + CTA + recherche).
2. Definir une grammaire UX commune pour les interactions de drilldown (ouverture, fermeture, persistance d'etat).

## 4) Tableau des opportunites UX

| Point de friction | Impact utilisateur | Recommandation | Priorite | Zone fichier/route |
|---|---|---|---|---|
| Variantes de modales non uniformes | Reperes visuels fluctuants | Gabarit modal unique (taille/padding/header/footer) | Haute | `src/components/sales/*Dialog.tsx`, `src/components/catalogue/*dialog*.tsx`, `src/components/report/ReportDialog.tsx` |
| Actions icon-only heterogenes | Interpretation moins immediate | Harmoniser style + focus + labels aria/title | Haute | `src/components/sales/SalesTable.tsx`, `src/components/catalogue/delete-piece-button.tsx`, `src/app/catalogue/DeleteSetButton.tsx` |
| Filtres multi-pages avec comportements proches mais non identiques | Apprentissage repetitif | Pattern unifie de filtres (layout + feedback + reset/apply) | Moyenne | `/approvisionnement`, `/ventes`, `/stock`, `/catalogue`, `/historique-stock` |
| Formulaires ventes denses | Charge cognitive elevee | Decoupage visuel et aides contextuelles par mode | Moyenne | `src/app/ventes/nouvelle/NewSaleForm.tsx` |
| Toggle QTE detail catalogue peu discoverable | Perte d'information potentielle | Affordance explicite + aide micro-copy | Basse | `src/components/catalogue/set-parts-list.tsx` |

## 5) Cible UX de sortie

- Parcours metier lisibles sans effort d'interpretation supplementaire.
- Patterns d'actions et filtres repetables entre pages.
- Feedbacks d'etat clairs (action possible, action en cours, action terminee, action bloquee).
