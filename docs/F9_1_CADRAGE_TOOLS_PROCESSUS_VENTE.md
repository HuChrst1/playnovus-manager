# F9.1 - Cadrage Tools (processus de mise en vente)

Statut: `VALIDE`
Date: `2026-02-24`
Portee: lot strictement documentaire (sans implementation technique)

## 1) Vision et objectifs

Vision:
- ajouter un module `Tools` dedie au pilotage operationnel de la mise en vente
- accelerer le process terrain sans affaiblir les invariants coeur (`stock`, `FIFO`, `ventes`)
- fournir une vision commune produit+tech decision-complete avant implementation

Objectifs:
- definir l'architecture fonctionnelle de `Tools` (navigation, routes, parcours)
- verrouiller le lot principal Phase 9 (`outils 1..6`) et l'ordre de livraison
- decrire les modeles de donnees, APIs et garde-fous securite pour implementation
- formaliser les criteres d'acceptation et la non-regression attendue

## 2) Non-objectifs F9.1

- implementer les pages `Tools` ou les APIs associees
- modifier le schema DB effectif dans ce lot documentaire
- activer une generation IA en production pour les descriptions
- integrer l'outil photo avance (outil 7), explicitement hors Phase 9
- changer les regles metier coeur ventes/stock/FIFO existantes

## 3) Baseline technique validee (existant)

- navigation topbar active via `src/components/AppSidebar.tsx`
- auth guard centralise via `src/proxy.ts` (matcher explicite)
- API BOM+stock deja disponible:
  - `GET /api/sets/[setId]/bom-stock`
- UI de controle piece-par-piece deja existante:
  - `src/components/sales/SetPiecesDialog.tsx`
- vues SQL deja exploitees:
  - `set_with_completion`
  - `stock_per_piece`

## 4) Decoupage Phase 9 retenu

1. `F9.1` cadrage documentaire (ce document)
2. `F9.2` socle Tools (topbar, routes, auth matcher, schema DB dedie, types, securite)
3. `F9.3` outil inventaire set (session temporaire + historique leger)
4. `F9.4` outil kanban processus vente (cartes set physiques, colonnes fixes, journal complet)
5. `F9.5` outil pieces manquantes (sets `>=90%` et `<100%`, vue + export CSV)
6. `F9.6` outils annonce/post-vente (descriptions templates + fiche remerciement PDF A5)
7. `F9.7` outil estimation prix multi-plateformes (scraping on-demand + fallback manuel)

Ordre de livraison verrouille:
- `1 -> 2 -> 3 -> 5 -> 6 -> 4`

## 5) Navigation et routes UI cibles

Navigation:
- nouvel onglet topbar: `Tools`

Routes UI:
- `/tools` (hub cards)
- `/tools/inventaire`
- `/tools/kanban`
- `/tools/pieces-manquantes`
- `/tools/descriptions`
- `/tools/remerciement`
- `/tools/pricing`

Regle auth:
- toutes les routes `Tools` sont protegees par session active
- extension du matcher proxy: `/tools/:path*`

## 6) Specification fonctionnelle verrouillee (lot principal)

## 6.1 Outil 1 - Inventaire set

But:
- verifier rapidement la completion d'un set physique via BOM + stock

Parcours:
1. rechercher/saisir un numero de set
2. charger la liste BOM (piece + quantite theorique)
3. comparer avec quantites reelles observees
4. visualiser manque/excedent + statut global (complet/incomplet)

Regles:
- usage interactif temporaire
- conservation d'un historique leger uniquement:
  - set
  - date/heure
  - resultat global (`complet`/`incomplet`)
  - pourcentage global
  - nombre de pieces manquantes
- pas de snapshot detaille piece-par-piece persiste

## 6.2 Outil 2 - Kanban processus vente

Unite de carte:
- 1 carte = 1 set physique en processus de mise en vente

Creation:
- creation manuelle uniquement depuis `Tools`

Colonnes V1 (fixes, non configurables):
1. Reception/Reconstitution complete ou presque complete
2. Verification de la completion du set
3. Achat des pieces manquantes en attente
4. Pieces manquantes achetees - attente d'etre livrees
5. Nettoyage pieces
6. En attente d'etre photographie
7. Photographie
8. Retouches
9. Redaction description d'annonce
10. Estimation du prix
11. En attente d'etre mis en ligne
12. Mis en ligne
13. Vendu (commande recue)
14. Generer fiche de remerciement A5
15. Expedie
16. Vente validee (archive carte)

Interactions:
- drag-and-drop
- fallback boutons (suivant/precedent) pour mobile/clavier

Historisation:
- journal complet horodate de transitions:
  - `from_stage`
  - `to_stage`
  - `changed_at`
  - `changed_by`
  - commentaire optionnel

Couplage ventes:
- aucun couplage automatique avec creation de vente
- handoff manuel conserve vers le module `Ventes`

## 6.3 Outil 3 - Pieces manquantes globales

But:
- fournir une vue transversale des pieces a acheter pour les sets presque complets

Population cible:
- sets avec `completion_percent >= 90` et `< 100`
- metrique verrouillee: `completion_percent` de `set_with_completion`

Source:
- calcul uniquement via stock/BOM (pas de dependance aux sessions inventaire)

Sortie:
- tableau agrege par piece:
  - `piece_ref`
  - quantite totale manquante
  - liste des sets concernes
- export CSV

## 6.4 Outil 5 - Generateur de description d'annonce

But:
- produire rapidement une description prete a publier

Mode V1:
- templates deterministes (sans IA)
- templates distincts par plateforme:
  - `VINTED`
  - `LEBONCOIN`
  - `EBAY`

Input:
- set/ piece
- etat
- loose/boite
- completude
- informations complementaires

Output:
- description structuree copiable

Phase 2 (hors V1):
- reecriture IA optionnelle

## 6.5 Outil 6 - Fiche remerciement PDF A5

But:
- generer une fiche PDF standardisee pour expeditions

Formats:
- format A: notice physique presente
- format B: notice transmise numeriquement

Regles QR:
- QR dynamique uniquement pour format B
- URL notice saisie manuellement a la generation

Integration process:
- action declenchee depuis etape kanban "Generer fiche de remerciement A5"
- historique de generation conserve

## 6.6 Outil 4 - Estimation prix multi-plateformes

But:
- proposer un prix de vente par plateforme + une estimation globale

Execution:
- on-demand par set (pas de batch planifie en V1)

Sources cibles:
- `VINTED`, `LEBONCOIN`, `EBAY`
- prix neuf prioritaire: Amazon ou site officiel Playmobil

Strategie technique:
- scraping automatique via connecteurs internes par plateforme
- fallback manuel obligatoire si blocage anti-bot/captcha/DOM

Strategie calcul:
- nettoyage outliers
- mediane par plateforme
- score confiance par source
- aggregation globale par mediane robuste ponderee

## 7) Modele data cible (schema dedie Tools)

Tables dediees:
- `tool_kanban_cards`
- `tool_kanban_stage_events`
- `tool_inventory_checks`
- `tool_price_estimation_runs`
- `tool_price_estimation_platform_rows`
- `tool_listing_descriptions`
- `tool_thank_you_cards`

Principes:
- aucun couplage ecriture sur `sales`, `sale_items`, `stock_movements`
- liens de reference autorises vers `sets_catalog` (lecture metier)
- historisation explicite pour kanban/pricing/docs

## 8) Contrats API cibles

Nouvelles APIs JSON `api/tools/*`:
- board kanban
- transitions kanban
- export CSV pieces manquantes
- generation description
- generation fiche PDF
- estimation pricing

Contraintes API:
- session active obligatoire (`requireActiveSession`)
- validation server-side stricte des payloads
- format d'erreur explicite et actionnable

## 9) Securite, garde-fous et observabilite

Auth:
- routes `Tools` protegees (proxy + guard server)

Rate-limit scopes a ajouter:
- `tools_mutations`
- `tools_pricing`
- `tools_doc_generation`

Invariants:
- aucun outil `Tools` ne doit muter le stock
- aucune creation automatique de vente depuis le kanban

Journalisation:
- transitions kanban journalisees
- runs pricing horodates
- generations docs tracees

## 10) Criteres d'acceptation Phase 9

1. `/tools` redirige vers `/login` sans session
2. onglet `Tools` visible et actif desktop/mobile
3. inventaire set exact sur BOM+stock + historique leger enregistre
4. kanban: creation carte, transitions, journal complet, archivage final
5. pieces manquantes: filtre `>=90`/`<100`, calcul correct, CSV valide
6. descriptions: template correct selon plateforme
7. fiche PDF A5: 2 formats, QR uniquement pour notice numerique
8. pricing: estimation par plateforme + globale, fallback manuel effectif
9. non-regression runtime/qualite/tests inchangee
10. invariants metier coeur preserves (stock/FIFO/ventes)

## 11) Hypotheses et defaults verrouilles

1. production V1 est active apres cloture `F8.2` (`2026-02-24`)
2. `F8.3` peut rester ouverte sans bloquer le cadrage/lot phase 9
3. scope principal phase 9 = outils `1..6`
4. outil 7 (retouche photo automatisee) hors phase 9
5. colonnes kanban fixes en V1
6. handoff ventes manuel uniquement
7. IA descriptions reportee en phase 2

## 12) Livrables documentaires du lot F9.1

- ce document (`docs/F9_1_CADRAGE_TOOLS_PROCESSUS_VENTE.md`)
- mise a jour roadmap avec `F9.1 -> F9.7`
- decisions structurantes phase 9 ajoutees dans `docs/DECISIONS.md`
- entree historique de cadrage ajoutee dans `docs/HISTORIQUE.md`
- refresh coherence `docs/AS_IS.md` et `README.md`
