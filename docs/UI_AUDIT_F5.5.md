# F5.5 UI Audit - Etat actuel post-refonte

Date: 2026-02-22  
Perimetre: `src/app/**`, `src/components/**`, `src/app/globals.css`, primitives UI shared.

## 1) Methode d'audit

- Source de verite consolidee:
  - `docs/ROADMAP.md` (section F5.5 et phases UI)
  - `docs/HISTORIQUE.md` (livraisons F5.x)
  - `git log` + `git diff --name-only` sur la branche courante
- Regle d'inclusion:
  - uniquement les elements valides (preuves techniques et/ou validation explicite deja tracee)
- Verifications techniques de reference:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - `npm run test:f2.0`

## 2) Baseline consolidee (post-F5.5)

### Domains couverts

1. Dashboard:
   - modales harmonisees, titres nettoyes, vues de tendances en onglets
   - fichiers cles: `src/components/dashboard/DashboardExecutiveView.tsx`, `src/components/dashboard/DashboardHubCharts.tsx`
2. Approvisionnement:
   - pattern table/filter alignes, modal lots harmonisee, fournisseur en dropdown
   - fichiers cles: `src/app/approvisionnement/page.tsx`, `src/app/approvisionnement/NewLotDialog.tsx`, `src/app/approvisionnement/EditLotDialog.tsx`
3. Ventes:
   - page liste + subpages detail alignees au shell appro-table, modales new/edit homogenisees
   - fichiers cles: `src/app/ventes/page.tsx`, `src/components/sales/SalesTable.tsx`, `src/components/sales/NewSaleDialog.tsx`, `src/components/sales/EditSaleDialog.tsx`
4. Stock / Historique:
   - header sur fond, table appro-table, actions externes coherentes
   - fichiers cles: `src/app/stock/page.tsx`, `src/app/historique-stock/page.tsx`
5. Catalogue:
   - toolbar filtres en pills dropdown, detail set harmonise
   - fichiers cles: `src/app/catalogue/page.tsx`, `src/app/catalogue/[id]/page.tsx`, `src/components/catalogue/set-parts-list.tsx`
6. Navigation globale:
   - topbar flottante + bouton retour global externe + compte/report
   - fichiers cles: `src/app/layout.tsx`, `src/components/AppBackButton.tsx`, `src/components/AppSidebar.tsx`
7. Design system:
   - tokens et classes soft UI transverses
   - fichiers cles: `src/app/globals.css`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/card.tsx`

## 3) Resultats par categorie UI

### Boutons

- Etat: **partiellement harmonise** (majoritairement conforme).
- Points conformes:
  - style ghost rond des actions edit/delete aligne sur appro pour les zones metier principales
  - topbar icon buttons unifies (`app-topbar-icon`)
- Ecarts residuels:
  - coexistence de classes ad hoc sur certains boutons non metier (modales techniques et actions secondaires)

### Cards / surfaces

- Etat: **globalement conforme**.
- Points conformes:
  - surfaces soft UI coherentes (`app-card`, `app-surface-muted`, `appro-table-shell`)
  - hierarchie visuelle stabilisee sur pages metier et detail pages
- Ecarts residuels:
  - quelques blocs gardent des styles locaux de shadow/border en dehors des primitives.

### Champs (input/select/textarea)

- Etat: **conforme** sur la majorite des flux.
- Points conformes:
  - `app-control` / primitives `Input` et `Textarea` unifiees
  - focus rings et contrastes remontees
- Ecarts residuels:
  - quelques champs natifs (`select` et controles inline) gardent des classes locales heterogenes.

### Tableaux

- Etat: **conforme** sur routes cibles.
- Points conformes:
  - adoption large des classes `appro-table-*`
  - densite et headers homogenes entre pages principales
- Ecarts residuels:
  - quelques micro-variantes de padding/alignement selon les sous-composants.

### Modales

- Etat: **partiellement harmonise**.
- Points conformes:
  - base dialog convergente (rayon, padding, footer action, labels)
  - dark tone cible pour la modale opportunites dashboard
- Ecarts residuels:
  - certaines modales gardent des largeurs/headers specifiques non alignes au pattern principal.

### Topbar / navigation globale

- Etat: **conforme**.
- Points conformes:
  - bouton retour global externe a la topbar
  - action report + compte a droite, iconographie explicite
- Ecarts residuels:
  - aucun ecart critique detecte.

## 4) Findings priorises

## Critique

- Aucun point critique bloqueur detecte dans le perimetre UI F5.5.

## Majeur

1. Variantes de style boutons encore ad hoc dans certains composants complexes.
   - Impact: perception d'incoherence visuelle entre modules.
   - Fichiers:
     - `src/components/sales/SetPiecesDialog.tsx`
     - `src/components/sales/SetSelector.tsx`
     - `src/components/sales/PieceSelector.tsx`
     - `src/components/report/ReportDialog.tsx`
2. Chrome modal non totalement standardise sur quelques ecrans.
   - Impact: rythmes de lecture et densite inegaux selon modal.
   - Fichiers:
     - `src/components/sales/EditSaleDialog.tsx`
     - `src/components/catalogue/edit-set-dialog.tsx`
     - `src/components/catalogue/edit-piece-dialog.tsx`

## Mineur

1. Heterogeneite ponctuelle des etats icon-only (taille/stroke/focus) hors topbar.
   - Fichiers:
     - `src/components/sales/SalesTable.tsx`
     - `src/app/catalogue/DeleteSetButton.tsx`
     - `src/components/catalogue/delete-piece-button.tsx`
2. Quelques micro-ecarts de spacing horizontal des toolbar filtres entre pages.
   - Fichiers:
     - `src/app/ventes/page.tsx`
     - `src/app/stock/page.tsx`
     - `src/app/catalogue/page.tsx`

## 5) Conformite contraste (WCAG AA strict)

- Source executable:
  - script: `scripts/ui_contrast_audit.mjs`
  - commande: `npm run lint:ui-contrast`
- Seuils:
  - texte normal >= 4.5:1
  - texte large >= 3:1
  - composants non textuels interactifs >= 3:1
- Etat actuel:
  - audit contraste **PASS** sur les combinaisons DS critiques (boutons, champs, placeholders, focus ring, icones).

## 6) Ecarts residuels et plan court terme

### Quick wins (faible effort, impact rapide)

1. Remplacer les dernieres classes boutons ad hoc par les variantes DS (`ghost`, `outline`, `icon`) dans les composants identifies en majeur.
2. Aligner les headers/footers de modales restantes sur un seul gabarit (`max-w`, `padding`, `DialogHeader`, `DialogFooter`).
3. Uniformiser la taille et le focus des actions icon-only en table.

### Chantiers moyens

1. Convergence des toolbar filtres (gaps, alignements, fallback mobile) avec un pattern unique.
2. Reduction des styles inline localises au profit de classes scopees reutilisables.

### Cible de sortie

- Boutons, cards, champs, tableaux et modales suivent un principe visuel unique.
- Contraste et focus restent controles automatiquement via lint.
