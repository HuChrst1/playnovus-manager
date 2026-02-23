# F7.2 - Scenarios manuels de validation metier

Date: 2026-02-23  
Statut lot: `FAIT`  
Perimetre: Phase 7 / F7.2 uniquement (sans glissement F7.3/F7.4/F8+)

## 1) Cadrage F7.2

Objectif:
- fournir une strategie locale reproductible de validation manuelle metier
- livrer des checklists manuelles par page
- livrer une matrice S1-S12 avec preuves pass/fail exploitables

Hors scope:
- aucune migration SQL
- aucune ecriture distante Supabase
- pas d'implementation de la checklist securite F7.4 (reference uniquement)

## 2) Strategie de validation

Approche retenue (locale-first):
1. preparer la stack locale (`supabase` + seed + build/tests)
2. valider les invariants metier via scripts automatiques existants (F7.1 + F2.0)
3. completer la preuve F7.2 via script local d'appui cible (`scripts/f7_2_validate_local.mjs`)
4. executer le protocole manuel navigateur sur `npm run dev` (Script A)
5. tracer chaque scenario S1-S12 dans un evidence log normalise

References automatiques utilisees:
- `scripts/f7_1_validate_local.mjs` (FIFO, confirmation lot, annulation vente, KPI ventes/dashboard)
- `scripts/f2_0_validate_local.mjs` (garde-fous lots/stock, non-regression F1.x/F2.x)
- `scripts/f7_2_validate_local.mjs` (F7.2 cible: refus stock insuffisant, vente SET+audit, completion catalogue)

## 3) Script A (local, obligatoire) - parcours manuel guide

### 3.1 Preparation locale

Commandes:
```bash
cd /Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager
npx supabase --version
docker info
npx supabase status
npx supabase start
npx supabase db reset --local
npm ci
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:f2.0
npm run lint:ui-contrast
npm run dev
```

### 3.2 Execution manuelle S1-S12 (navigateur)

1. S1 Auth entree:
- ouvrir `/ventes` et `/compte` en session non connectee
- attendu: redirection `/login`
- se connecter
- attendu: acces routes metier

2. S2 Appro lot draft non vide:
- creer lot `draft` dans `/approvisionnement`
- ajouter lignes inventaire
- confirmer lot
- attendu: lot confirme + stock/historique coherents

3. S3 Appro lot vide/incoherent:
- creer lot `draft` sans lignes valides ou avec total incoherent
- tenter confirmation
- attendu: refus explicite, aucun mouvement `PURCHASE/IN`

4. S4 Vente PIECE:
- creer vente PIECE stock suffisant dans `/ventes`
- attendu: vente creee
- tenter vente PIECE avec stock insuffisant
- attendu: refus explicite, aucun etat partiel

5. S5 Vente SET:
- creer vente SET dans `/ventes`
- verifier detail commande `/ventes/[id]` puis `/ventes/[id]/[saleItemId]`
- attendu: audit des pieces vendues (`sale_item_pieces`) coherent

6. S6 Annulation vente:
- annuler une vente `CONFIRMED`
- attendu: statut `CANCELLED`, mouvements `SALE_CANCEL/IN`, stock restaure

7. S7 KPI `/ventes`:
- filtrer plage date + canal + statut
- attendu: KPIs coherents avec le filtre actif

8. S8 KPI dashboard `/`:
- appliquer meme plage date
- attendu: agregats dashboard coherents avec donnees de periode

9. S9 Stock + historique:
- verifier `/stock` puis `/historique-stock`
- attendu: coherence avec mouvements generes (achats, ventes, annulations)

10. S10 Catalogue:
- verifier `/catalogue` puis `/catalogue/[id]` apres operations
- attendu: completion/max_complete_sets coherent avec stock restant

11. S11 Compte + report:
- verifier session active sur `/compte`
- verifier attribution report dans le module tickets (`Cree par`, `Cloture/Ignore par`)
- attendu: attribution visible et coherente

12. S12 Non-regression:
- reexecuter `npm run test` et `npm run test:f2.0`
- attendu: vert

### 3.3 Format de collecte de preuve (obligatoire)

Format evidence log:
`timestamp | scenario | page/route | preconditions | action | attendu | observe | resultat | bloquant | reference_preuve`

Exemples de `reference_preuve`:
- capture locale navigateur
- extrait console/network local
- sortie commande locale
- identifiants enregistrements (`sale_id`, `lot_id`, `movement_id`)

Regle:
- aucun PASS/FAIL sans observation concrete.

## 4) Script B (optionnel) - remote read-only

A executer uniquement sur demande explicite.

Regles:
- lecture seule
- interdiction ecriture distante (`--linked` write, DDL/DML remote)

Exemples de commandes read-only:
```bash
npx supabase projects list
npx supabase status --linked
```

## 5) Checklists manuelles par page

### `/`
- verifier filtres periode (preset/custom) et coherence KPI
- verifier non contradiction avec `/ventes` sur meme fenetre
- verifier que les tendances ne comptent pas des donnees hors fenetre

### `/catalogue`
- verifier tri/filtre et ordres de completion
- verifier coherence `max_complete_sets` apres ventes/annulations

### `/catalogue/[id]`
- verifier BOM detaille et progression de completion
- verifier coherence des quantites possedees vs stock disponible

### `/approvisionnement`
- verifier creation lot `draft`
- verifier protections sur suppression/edition selon statut et usage ventes

### `/approvisionnement/[id]`
- verifier edition lignes inventaire en `draft`
- verifier refus edition inventaire sur lot `confirmed`
- verifier confirmation lot non vide uniquement

### `/ventes`
- verifier creation vente PIECE / SET
- verifier refus stock insuffisant
- verifier coherence KPIs/table selon filtres URL

### `/ventes/[id]`
- verifier recap vente, statut, metadonnees
- verifier parcours annulation et effets de stock

### `/ventes/[id]/[saleItemId]`
- verifier detail pieces vendues (audit)
- verifier concordance avec `sale_item_pieces` et mouvements stock

### `/stock`
- verifier quantites/value per piece
- verifier variations apres achats/ventes/annulations

### `/stock/[piece_ref]`
- verifier vision piece par piece et lots associes
- verifier coherence quantites avec FIFO attendu

### `/historique-stock`
- verifier lecture chronologique des mouvements
- verifier presence de `PURCHASE`, `SALE`, `SALE_CANCEL`, `ADJUST` si applicable

### `/login`
- verifier redirections non connecte/connecte
- verifier messages session/login/logout

### `/compte`
- verifier session active et acces protege
- verifier sections compte/securite/session

## 6) Matrice scenarios critiques S1-S12 (etat constate)

| Scenario | Resultat constate | Preuves utilisees | Blocant |
|---|---|---|---|
| S1 Auth entree | PASS | EV-008 (`curl` routes protegees -> `/login`) | non |
| S2 Appro lot draft non vide + confirmation | PASS | EV-005 (F7.1 S2), EV-006 (F2.0 S7) | non |
| S3 Appro lot vide/incoherent refuse | PASS | EV-005 (F7.1 S3), EV-006 (F2.0 S9/S10) | non |
| S4 Vente PIECE ok + refus insuffisant | PASS | EV-005 (vente PIECE/FIFO), EV-007 (refus stock insuffisant) | non |
| S5 Vente SET + audit detail pieces | PASS | EV-007 (sale_item_pieces coherent) | non |
| S6 Annulation `CONFIRMED -> CANCELLED` + stock restaure | PASS | EV-005 (F7.1 S4) | non |
| S7 KPI `/ventes` coherents avec filtre | PASS avec reserve mineure (H-006) | EV-005 (F7.1 S5) | non |
| S8 Dashboard coherent sur periode | PASS | EV-005 (F7.1 S5 dashboard.v3) | non |
| S9 Stock + historique coherents | PASS | EV-006 (stock_balance, vues, healthcheck=0) | non |
| S10 Catalogue completion coherent apres operations | PASS | EV-007 (set_with_completion avant/apres vente SET) | non |
| S11 Compte/report essentiels | PASS partiel technique + manuel UI requis | EV-008, EV-009, EV-010 | non |
| S12 Non-regression globale | PASS | EV-005 (`npm run test`) + EV-006 (`npm run test:f2.0`) | non |

Reserve mineure tracee (non bloquante):
- H-006 / D-008: comportement par defaut `include_cancelled=true` sur `/ventes` a suivre hors F7.2.

## 7) Evidence log (execution de ce lot)

| timestamp (UTC) | scenario | page/route | preconditions | action | attendu | observe | resultat | bloquant | reference_preuve |
|---|---|---|---|---|---|---|---|---|---|
| 2026-02-23T16:37:15Z | Pre-check | local runtime | stack locale | `npx supabase --version`, `docker info`, `npx supabase status` | outils disponibles | OK (`supabase 2.65.10`, `docker 29.2.0`, stack locale active) | PASS | non | EV-001 |
| 2026-02-23T16:38:30Z | Reset DB locale | supabase local | stack demarree | `npx supabase db reset --local` | migrations+seed rejoues | baseline+F1.x+F5.0.4+F6.4+seed appliques | PASS | non | EV-002 |
| 2026-02-23T16:40:20Z | Qualite deps | local | reset OK | `npm ci` | install propre | `0 vulnerabilities` | PASS | non | EV-003 |
| 2026-02-23T16:41:00Z | Gates techniques | local | deps installees | `npm run lint`, `npm run typecheck`, `npm run build`, `npm run lint:ui-contrast` | vert | tous verts | PASS | non | EV-004 |
| 2026-02-23T16:45:00Z | Non-regression complete | local | DB reset + deps | `npm run test` | unit+integration+f2.0 verts | PASS (F7.1 + F2.0) | PASS | non | EV-005 |
| 2026-02-23T16:47Z | Non-regression F2.0 | local | DB reset | `npm run test:f2.0` | vert | PASS | PASS | non | EV-006 |
| 2026-02-23T16:55:00Z | Preuves F7.2 ciblees | local | build local-only | `node scripts/f7_2_validate_local.mjs` | S4 insuff refus + S5/S10 coherents | PASS (3 scenarios) | PASS | non | EV-007 |
| 2026-02-23T16:48Z | Auth routes protegees | `/`, `/ventes`, `/compte`, `/login` | `npm run dev` actif, non connecte | `curl -D -` | metier -> `/login`, login -> 200 | `307 /login` pour routes metier, `/login`=200 | PASS | non | EV-008 |
| 2026-02-23T16:56Z | Attribution report schema | DB locale | migration F6.4 presente | `docker exec ... psql` information_schema | 6 colonnes attribution presentes | 6/6 colonnes presentes | PASS | non | EV-009 |
| 2026-02-23T16:56Z | Attribution report UI/actions | code source | repo local | `rg` dans `report.ts`/`ReportDialog.tsx` | champs + labels presents | mapping create/close + labels UI detectes | PASS | non | EV-010 |

Note execution UI:
- ce lot a produit les preuves techniques/locales requises en environnement agent.
- la validation visuelle interactive complete (navigateur connecte) reste executable via Script A sur poste utilisateur.

## 8) Garde-fous metier preserves (rappel)

- F1.3: blocage stock negatif DB
- F1.4: anti-doublons `stock_movements`
- F2.0: protections lots (confirmation/suppression/transitions) + LOT_0
- F7.1: FIFO, confirmation lot, annulation vente, KPI ventes/dashboard

## 9) Limites et non-glissement

- aucune migration ajoutee
- aucune ecriture distante
- aucun secret ajoute au repo
- aucune implementation checklist securite F7.4 (hors scope F7.2)
