# F7.3 - Healthcheck DB pre-release / post-release

Date: 2026-02-23  
Statut lot: `FAIT`  
Perimetre: Phase 7 / F7.3 uniquement (sans glissement F7.4/F7.5/F8+)

## 1) Cadrage F7.3

Objectif:
- confirmer l'integrite des donnees avant et apres chaque livraison
- etablir un gate DB local reproductible et decisionnel
- produire une preuve standardisee exploitable en run de release

Hors scope:
- aucune migration SQL dans ce lot
- aucune ecriture distante Supabase
- aucun durcissement global F7.4/F7.5 (reference uniquement)

## 2) Regles de decision F7.3

Politique retenue:
- `strict_blocking`

Regle officielle:
- si `anomalies_total > 0` dans `healthcheck_business_anomalies_v1`:
  - decision = `BLOCKED`
  - la livraison est bloquee

Cadence:
- checkpoint `pre-release` + checkpoint `post-release` a chaque release

## 3) Script A (local, obligatoire)

Script:
- `scripts/f7_3_validate_local.mjs`

Commandes:
```bash
cd /Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager
npm run test:f7.3:pre
npm run test:f7.3:post
```

Parametre obligatoire:
- `--checkpoint pre-release|post-release`

Garde local-only:
- lecture `npx supabase status -o env`
- refus si `API_URL` n'est pas `localhost` / `127.0.0.1`

Sorties produites:
- `PASS_FAIL_MATRIX`:
  - S1 vue healthcheck lisible
  - S2 total anomalies
  - S5 `stock_balance.quantity < 0`
  - S6 vues `stock_per_piece`, `stock_journal`, `piece_movements` lisibles
- `ANOMALIES_BY_FAMILY`
- `ANOMALIES_BY_FAMILY_CODE`
- `ACTIONABLE_DETAILS` (si anomalies > 0)
- `DECISION` (`PASS` ou `BLOCKED`)

Codes de sortie:
- `0`: gate valide
- `2`: anomalies detectees (`BLOCKED`)
- `1`: erreur technique/prerequis manquant

## 4) Protocole standard de release (local-first)

### 4.1 Pre-check runtime

```bash
npx supabase --version
docker info
npx supabase status
```

### 4.2 Preparation locale

```bash
npx supabase start
npx supabase db reset --local
```

### 4.3 Gate pre-release

```bash
npm run test:f7.3:pre
```

Attendu:
- `anomalies_total = 0`
- `decision = PASS`

### 4.4 Flux de validation existants (non-regression)

```bash
npm run test
npm run test:f2.0
```

### 4.5 Gate post-release local

```bash
npm run test:f7.3:post
```

Attendu:
- `anomalies_total = 0`
- `decision = PASS`

## 5) Matrice attendue pass/fail

| Controle | Condition PASS | Impact si FAIL |
|---|---|---|
| `S1_healthcheck_view_readable` | vue lisible | blocage technique |
| `S2_healthcheck_anomalies_total` | `0` | `BLOCKED` |
| `S5_negative_stock_rows` | `0` | blocage technique |
| `S6_stock_per_piece_readable` | lisible | blocage technique |
| `S6_stock_journal_readable` | lisible | blocage technique |
| `S6_piece_movements_readable` | lisible | blocage technique |

## 6) Format de collecte de preuves (obligatoire)

Format evidence log:
`timestamp_utc | checkpoint | commande | resultat | decision | observation`

Exemple:
`2026-02-23T17:00:00Z | pre-release | npm run test:f7.3:pre | anomalies_total=0 | PASS | healthcheck + stock views lisibles`

## 7) Script B (optionnel) - remote read-only

A executer uniquement sur demande explicite.

Regles:
- lecture seule
- interdiction d'ecriture distante (`db push --linked`, DDL, DML)

Exemples:
```bash
npx supabase projects list
npx supabase status --linked
```

## 8) Perimetre et garanties

- aucun changement de schema SQL
- aucun secret sensible ajoute au repo
- aucun changement fonctionnel UI/produit
- garde-fous existants F1.x/F2.x/F7.1/F7.2 preserves
