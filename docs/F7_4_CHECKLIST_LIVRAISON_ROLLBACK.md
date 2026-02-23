# F7.4 - Checklist de livraison et rollback

Date: 2026-02-23  
Statut lot: `FAIT`  
Perimetre: Phase 7 / F7.4 uniquement (sans glissement F7.5/F8+)

## 1) Cadrage F7.4

Objectif:
- livrer un protocole unique, local-first, reproductible et actionnable pour la livraison/rollback
- standardiser une checklist stock/coherence pre-release
- standardiser une checklist securite pre-release avec statuts `PASS|FAIL|BLOCKED` + preuves
- fournir une matrice de decision `GO/NO_GO` deterministe
- definir un monitoring minimal des erreurs critiques avec action immediate

Politique de decision validee:
- `block_always_on_security_non_compliance`
- toute non-conformite securite (`FAIL` ou `BLOCKED`) implique `NO_GO`

Hors scope:
- implementation complete des hardenings F7.5
- ecriture DB distante
- migration SQL additionnelle

## 2) Livrables F7.4

- runbook F7.4:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/F7_4_CHECKLIST_LIVRAISON_ROLLBACK.md`
- script local de collecte F7.4:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/f7_4_validate_local.mjs`
- script npm:
  - `test:f7.4` dans `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json`

## 3) Script A (local, obligatoire)

### 3.1 Pre-check runtime

```bash
cd /Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager
npx supabase --version
docker info
npx supabase status
```

### 3.2 Preparation locale

```bash
npx supabase start
npx supabase db reset --local
```

### 3.3 Gates qualite + non-regression

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:f2.0
npm run lint:ui-contrast
```

### 3.4 Gates release pre/post + checklist F7.4

```bash
npm run test:f7.3:pre
npm run test:f7.3:post
npm run audit:prod
npm run audit:deps
npm run test:f7.4
```

Remarque:
- `npm run test:f7.4` produit une decision `GO|NO_GO` et la matrice complete.
- mode enforcement optionnel:
  - `node scripts/f7_4_validate_local.mjs --checkpoint pre-release --enforce-go`
  - en mode `--enforce-go`, le script retourne `exit code 2` si decision `NO_GO`.

### 3.5 Decision release

Regle:
- `GO` uniquement si tous les controles critiques techniques ET securite sont `PASS`.
- `NO_GO` si au moins un controle est `FAIL` ou `BLOCKED`.

### 3.6 Rollback local guide (retour service rapide)

Declencheurs:
- echec gate post-release
- anomalie critique DB/stock
- incident bloquant flux coeur metier

Execution:
1. stopper la livraison en cours et figer les mutations metier
2. reinitialiser la base locale sur etat versionne:
   - `npx supabase db reset --local`
3. verifier restauration immediate:
   - `npm run test:f7.3:pre`
   - `npm run test`
   - `npm run test:f2.0`
4. confirmer la stabilite:
   - `npm run test:f7.3:post`
5. tracer l'incident + cause + action corrective

Criteres de sortie rollback:
- service retabli
- checks critiques repasses
- incident documente

### 3.7 Format de collecte de preuves

Format evidence log:

`timestamp_utc | checkpoint | control_id | command | expected | observed | status | decision | action`

Regles:
- aucune valeur sensible/secret en preuve
- toute decision `NO_GO` doit citer explicitement les controles non-PASS

## 4) Script B (remote read-only, optionnel)

A executer uniquement sur demande explicite.

Regles:
- lecture seule
- aucune ecriture distante
- interdits:
  - `supabase db push --linked`
  - `supabase migration up --linked`
  - toute commande DDL/DML distante

Exemples:

```bash
npx supabase projects list
npx supabase status --linked
```

## 5) Checklist stock/coherence (pre-release)

| Control ID | Controle | Condition PASS | Statut possible | Preuve attendue |
|---|---|---|---|---|
| `C1` | vue `healthcheck_business_anomalies_v1` lisible | lecture OK | PASS/FAIL/BLOCKED | sortie `test:f7.4` ou requete SQL locale |
| `C2` | `healthcheck_business_anomalies_v1` | `anomalies_total = 0` | PASS/FAIL/BLOCKED | `test:f7.3:pre/post` + `test:f7.4` |
| `C3` | `stock_balance` | `quantity < 0 = 0` | PASS/FAIL/BLOCKED | requete SQL locale / `test:f7.3:*` |
| `C4` | `stock_per_piece` lisible | lecture OK | PASS/FAIL/BLOCKED | `test:f7.3:*` + `test:f7.4` |
| `C5` | `stock_journal` lisible | lecture OK | PASS/FAIL/BLOCKED | `test:f7.3:*` + `test:f7.4` |
| `C6` | `piece_movements` lisible | lecture OK | PASS/FAIL/BLOCKED | `test:f7.3:*` + `test:f7.4` |
| `C7` | non-regression globale | `test`, `test:f2.0`, `test:f7.3:*` verts | PASS/FAIL/BLOCKED | logs commandes npm |

## 6) Checklist securite pre-release

| Control ID | Controle | Condition PASS | Statut possible | Preuve attendue |
|---|---|---|---|---|
| `S1` | rate limits auth | section `[auth.rate_limit]` complete et > 0 | PASS/FAIL/BLOCKED | `supabase/config.toml` + `test:f7.4` |
| `S2` | RLS tables publiques | `relrowsecurity=true` sur tables cibles | PASS/FAIL/BLOCKED | requetes `pg_class` (local) |
| `S3` | policies RLS | au moins une policy par table cible | PASS/FAIL/BLOCKED | requetes `pg_policies` (local) |
| `S4` | vues en invoker | `security_invoker=true` sur vues critiques | PASS/FAIL/BLOCKED | requetes `pg_class.reloptions` |
| `S5` | CAPTCHA | `[auth.captcha] enabled=true` + provider valide | PASS/FAIL/BLOCKED | `supabase/config.toml` |
| `S6` | validation serveur | validations presentes sur auth/lot/vente/compte | PASS/FAIL/BLOCKED | inspection code + `test:f7.4` |
| `S7` | API keys/env vars | separation anon/service_role + hygiene env | PASS/FAIL/BLOCKED | scan `.env.local` (noms), scan `src` |
| `S8` | CORS | restriction explicite des origines | PASS/FAIL/BLOCKED | `next.config.ts` / `src/app/api` |
| `S9` | dependency audit prod | `npm run audit:prod` vert | PASS/FAIL/BLOCKED | log commande |
| `S10` | dependency audit deps | arbre `ajv/@eslint/eslintrc/eslint` vide | PASS/FAIL/BLOCKED | log commande |

## 7) Matrice GO / NO_GO

| Condition | Regle | Decision |
|---|---|---|
| tous controles critiques techniques `PASS` ET tous controles securite `PASS` | release autorisee | `GO` |
| au moins un controle securite `FAIL` | blocage release | `NO_GO` |
| au moins un controle securite `BLOCKED` | blocage release | `NO_GO` |
| au moins un controle stock/coherence critique non-PASS | blocage release | `NO_GO` |
| prerequis runtime manquant | blocage release | `NO_GO` |

## 8) Monitoring minimal erreurs critiques

| Monitoring ID | Signal surveille | Seuil / gravite | Action immediate |
|---|---|---|---|
| `M1` | `anomalies_total` (`healthcheck_business_anomalies_v1`) | `> 0` = Critique | bloquer livraison, lancer rollback guide, ouvrir incident |
| `M2` | `stock_balance.quantity < 0` | `> 0` = Critique | bloquer livraison, rollback, verifier flux stock |
| `M3` | echec non-regression (`test`, `test:f2.0`, `test:f7.3:*`) | 1 echec = Critique | bloquer livraison, corriger/regresser |
| `M4` | echec `audit:prod` | echec audit = Critique securite | bloquer livraison, traiter vulnerabilites/reseau |
| `M5` | decision F7.4 `NO_GO` | `NO_GO` = Critique release | pas de release, traiter controles non-PASS |

Escalade immediate:
1. arret release
2. rollback guide si incident actif
3. evidence log + ticket d'incident
4. correction priorisee avant nouvelle tentative

## 9) Etat de reference F7.4 (lot courant)

Reference d'execution:
- timestamp: `2026-02-23T18:17:16.263Z`
- commande: `npm run test:f7.4`
- checkpoint: `pre-release`
- gate technique: `PASS`
- gate securite: `NO_GO`
- decision: `NO_GO`
- reexecution: `2026-02-23T18:17:40.015Z` (`--checkpoint post-release`) -> meme decision `NO_GO`

Extrait statuts securite:

| Control ID | Statut constate | Observation |
|---|---|---|
| `S1` rate limits | PASS | section `[auth.rate_limit]` complete et > 0 |
| `S2` RLS tables | PASS | `tables_ok=11` |
| `S3` policies RLS | PASS | `policies_ok=11` |
| `S4` views invoker | PASS | `views_ok=4` |
| `S5` CAPTCHA | BLOCKED | section `[auth.captcha]` absente/commentee |
| `S6` validation serveur | PASS | signaux trouves sur auth/lot/vente/compte |
| `S7` API keys/env | PASS | separation anon/service_role conforme, pas de fuite client |
| `S8` CORS | BLOCKED | restriction explicite non detectee dans `next.config.ts` / `src/app/api` |
| `S9` audit prod | PASS | `npm run audit:prod` -> `0 vulnerability` |
| `S10` audit deps | PASS | `npm run audit:deps` -> `(empty)` |

Interpretation:
- F7.4 est `FAIT` quand le dispositif de controle est livre et prouve.
- la decision de release peut rester `NO_GO` tant que des controles securite sont `FAIL/BLOCKED`.
- le traitement correctif de ces points appartient a F7.5 (hors scope strict F7.4).
