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

- Etat: **conforme**.
- Points conformes:
  - actions icon-only metier uniformisees via classe shared (`app-icon-action`)
  - style/focus/disabled coherents sur edit/delete/close des zones cibles
  - topbar icon buttons unifies (`app-topbar-icon`)
- Ecarts residuels:
  - aucune incoherence majeure detectee dans le perimetre F5.6.

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

- Etat: **conforme**.
- Points conformes:
  - chrome modal unifie sur les modales residuelles (largeur/token, header, densite, footer)
  - classes shared appliquees (`app-modal-standard`, `app-modal-wide`, `app-modal-header`, `app-modal-footer`)
  - dark tone cible pour la modale opportunites dashboard
- Ecarts residuels:
  - aucune derive critique/majeure detectee sur les modales ciblees F5.6.

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

- Aucun point majeur bloqueur detecte apres application F5.6.

## Mineur

1. Variantes contextuelles de densite encore assumees sur quelques modales techniques hors lot F5.6.
   - Fichiers:
     - `src/app/approvisionnement/[id]/LotCsvImportDialog.tsx`
     - `src/app/approvisionnement/[id]/LotInvoiceAttachmentPanel.tsx`
2. Pattern filtres catalogue conserve en drilldown pills (choix UX assume), avec coherence active/reset/apply renforcee.
   - Fichiers:
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

## 6) Statut post-F5.6

- Cible F5.6 atteinte:
  - aucune finding `Critique` ou `Majeur`
  - harmonisation icon-only + modales + filtres inter-pages livree
- Contraste et focus restent controles automatiquement via lint.
