# HISTORIQUE

Ce fichier consigne les changements du projet, etapes par etapes.

## 2026-02-23 - F8.1 Cloture GO apres preuves externes (Vercel + Supabase + Turnstile)

Statut: `FAIT` / Decision release courante: `GO` (DoD stricte F8.1 atteinte)

### Preuves externes validees

- Turnstile production valide sur domaine heberge:
  - `E1_turnstile_prod_domain_validated: PASS`
- Variables securite hebergees verifiees:
  - `E2_hosted_env_security_vars_verified: PASS`
- Verification CORS production:
  - origin non autorisee -> `403` (`{"error":"Origin non autorisee."}`)
  - origin autorisee sans session -> `401` (`{"error":"Aucune session active detectee."}`)

### Verifications executees

- `npm run test:f8.1` -> `decision=GO`
- `node scripts/f8_1_validate_local.mjs --checkpoint pre-release --enforce-go` -> `decision=GO` (exit `0`)

### Mise a jour documentaire

- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/F8_1_PREPARATION_DEPLOIEMENT_PRODUCTION.md`
  - E1/E2 passes de `BLOCKED` a `PASS`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - `Phase 8` passe a `EN COURS`
  - `F8.1` passe a `FAIT`

## 2026-02-23 - F8.1 Preparation deploiement production (Vercel)

Statut: `BLOQUE` / Decision release courante: `NO_GO` (DoD stricte F8.1)

### Changements realises

- Runbook F8.1 ajoute:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/F8_1_PREPARATION_DEPLOIEMENT_PRODUCTION.md`
  - contenu livre:
    - strategie stack/outillage (`Vercel + Supabase + Turnstile`)
    - prerequis techniques et operationnels
    - sequence preprod -> prod (preparation uniquement)
    - checklist env/secrets `local|preprod|prod`
    - procedure Turnstile production (widget + hostnames + mapping variables)
    - checklist go-live + smoke checks metier critiques
    - matrice `GO/NO_GO` F8.1
    - rollback de deploiement (niveau preparation)
    - format de preuves standardise
- Script local F8.1 ajoute:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/f8_1_validate_local.mjs`
  - comportement:
    - `--checkpoint pre-release|post-release`
    - `--enforce-go` (exit `2` si decision `NO_GO`)
    - sorties:
      - `PASS_FAIL_BLOCKED_MATRIX`
      - `EVIDENCE_LOG`
      - `DECISION`
    - controles couverts:
      - prerequis runtime local
      - completude runbook/checklists F8.1
      - hygiene doc (pas de secret en clair)
      - preservation garde-fous F7.4/F7.5
      - absence de migration SQL additionnelle
      - preuves externes obligatoires E1/E2
- Script npm ajoute:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json`
  - `test:f8.1`
- Gouvernance documentaire mise a jour:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
    - `Phase 8` et `F8.1` passes a `BLOQUE` tant que E1/E2 sont non valides
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`
    - nouvelle decision structurante `D-040` (stack Vercel + gouvernance F8.1)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/README.md`
    - section preparation deploiement F8.1 + commande `npm run test:f8.1`
- Ajustement non-regression gate securite F7.5:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/f7_5_validate_local.mjs`
  - detection CAPTCHA login alignee sur l'architecture effective (`LoginFormClient`), sans changement runtime auth.

### Verifications executees

- Pre-check local:
  - `npx supabase --version` -> OK (`2.65.10`)
  - `docker info` -> OK (`Server Version 29.2.0`)
  - `npx supabase status` -> OK (stack locale active)
- Reset local:
  - `npx supabase start` -> OK
  - `npx supabase db reset --local` -> OK
- Campagne qualite/tests/audits (commandes executees):
  - `npm ci` -> OK (`found 0 vulnerabilities`)
  - `npm run lint` -> OK
  - `npm run typecheck` -> OK
  - `npm run build` -> OK
  - `npm run test` -> OK
  - `npm run test:f2.0` -> OK
  - `npm run test:f7.3:pre` -> OK
  - `npm run test:f7.3:post` -> OK
  - `npm run test:f7.4` -> OK (`decision=GO`)
  - `npm run test:f7.5` -> OK (`decision=GO`)
  - `npm run test:f8.1` -> OK (execution), `decision=NO_GO`
  - `npm run lint:ui-contrast` -> OK
  - `npm run audit:prod` -> OK (`found 0 vulnerabilities`)
  - `npm run audit:deps` -> OK (`(empty)`)

### Etat gate F8.1

- `P1..P3` PASS
- `D1..D7` PASS
- `G1..G2` PASS
- `E1` BLOCKED (widget Turnstile prod/domaine non valide en preuve externe)
- `E2` BLOCKED (variables securite hebergees non validees en preuve externe)
- decision stricte: `NO_GO`

### Perimetre / limites

- Scope strict F8.1 respecte (preparation uniquement, sans execution F8.2).
- Aucune migration SQL ajoutee.
- Aucune ecriture DB distante.
- Aucun secret sensible ajoute au repo.
- Actions manuelles externes restantes avant passage a F8.2:
  - validation Turnstile production (widget + hostnames)
  - verification variables securite dans l'environnement heberge.

## 2026-02-23 - F7.5 Gate securite Phase 7 (GO strict)

Statut: `FAIT` / Decision release courante: `GO`

### Changements realises

- Socle securite partage ajoute:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/auth/require-active-session.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/security/rate-limit.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/security/cors.ts`
- CAPTCHA Turnstile active cote config Supabase locale:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/config.toml`
- CAPTCHA branche sur login / forgot-password:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/security/TurnstileField.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/login/LoginFormClient.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/login/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/login/actions.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/forgot-password/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/forgot-password/actions.ts`
  - verrou UX login actif: soumission impossible tant que CAPTCHA non valide (bouton desactive)
- CORS allowlist explicite + OPTIONS + auth session + rate-limit sur API exposee:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/api/sets/[setId]/bom-stock/route.ts`
- Garde session + rate-limit + validation serveur homogenises sur mutations cibles:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/actions/update-bom.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/actions/update-set-info.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/actions/update-set.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/actions.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/actions/stock-movements.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/actions/sales.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/actions/report.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/compte/actions.ts`
- Compatibilite scripts locaux preservee pour validations existantes:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/f2_0_validate_local.mjs`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/f7_1_validate_local.mjs`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/f7_2_validate_local.mjs`
  - variable locale explicite: `PLAYNOVUS_LOCAL_VALIDATION_BYPASS=1`
- Gate F7.5 livre:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/f7_5_validate_local.mjs`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json` (`test:f7.5`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/F7_5_CHECKLIST_SECURITE_PHASE7.md`
- README securite/env mis a jour:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/README.md`

### Verifications executees

- Pre-check local:
  - `npx supabase --version` -> OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'` -> OK (`29.2.0`)
  - `npx supabase status` -> OK (stack locale active)
  - `npx supabase start` -> OK
  - `npx supabase db reset --local` -> OK
- Qualite:
  - revalidation ciblee verrou CAPTCHA login: `npm run lint` + `npm run typecheck` + `npm run build` -> OK
  - `npm ci` -> OK (`0 vulnerabilities`)
  - `npm run lint` -> OK
  - `npm run typecheck` -> OK
  - `npm run build` -> OK
  - `npm run test` -> OK
  - `npm run test:f2.0` -> OK
  - `npm run test:f7.3:pre` -> OK
  - `npm run test:f7.3:post` -> OK
  - `npm run lint:ui-contrast` -> OK
  - `npm run audit:prod` -> OK (`found 0 vulnerabilities`)
  - `npm run audit:deps` -> OK (`(empty)`)
  - `npm run test:f7.4` -> OK (`decision=GO`)
- Gate F7.5:
  - `npm run test:f7.5` -> OK (`decision=GO`)
  - `node scripts/f7_5_validate_local.mjs --checkpoint pre-release --enforce-go` -> `GO` (exit `0`)
  - `node scripts/f7_5_validate_local.mjs --checkpoint post-release --enforce-go` -> `GO` (exit `0`)

### Etat gate F7.5

- `S1` PASS
- `S2` PASS
- `S3` PASS
- `S4` PASS
- `S5` PASS
- `S6` PASS
- `S7` PASS
- `S8` PASS (test runtime: origin interdite `403`, sans session `401`)
- `S9` PASS
- `S10` PASS
- decision stricte: `GO`

### Resolution des blocages initiaux

- Variables locales renseignees:
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - `SUPABASE_AUTH_CAPTCHA_SECRET`
  - `APP_ALLOWED_ORIGINS`
- Stack Supabase relancee avec secret CAPTCHA exporte dans le shell avant `npx supabase start`.
- Revalidation stricte `--enforce-go` reussie sur checkpoints `pre-release` et `post-release`.

### Perimetre / limites

- Aucune migration SQL ajoutee.
- Aucune ecriture DB distante.
- Aucun secret sensible ajoute au repo.
- F7.5 est ferme en local-first (`GO` strict), avec widget production/variables production a finaliser en Phase 8.

## 2026-02-23 - F7.4 Checklist de livraison et rollback

Statut: `FAIT` (dispositif) / Decision release courante: `NO_GO`

### Changements realises

- Runbook F7.4 livre:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/F7_4_CHECKLIST_LIVRAISON_ROLLBACK.md`
  - contenu livre:
    - Script A local obligatoire (pre-check, reset, gates qualite, non-regression, audits, decision)
    - Script B remote read-only optionnel (sans ecriture distante)
    - checklist stock/coherence (C1-C7) avec preuves attendues
    - checklist securite pre-release (S1-S10) avec statuts `PASS|FAIL|BLOCKED`
    - matrice `GO/NO_GO` deterministe (policy `block_always_on_security_non_compliance`)
    - protocole rollback local oriente retour service rapide
    - monitoring minimal erreurs critiques (M1-M5)
- Script local F7.4 ajoute:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/f7_4_validate_local.mjs`
  - comportement:
    - garde local-only via `npx supabase status -o env`
    - sortie standardisee:
      - `PASS_FAIL_BLOCKED_MATRIX`
      - `EVIDENCE_LOG`
      - `DECISION` (`GO` ou `NO_GO`)
    - mode enforcement optionnel:
      - `--enforce-go` (exit `2` si decision `NO_GO`)
- Script npm ajoute:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json`
  - `test:f7.4`
- Documentation gouvernance mise a jour:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F7.4` passe a `FAIT`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (nouvelle decision `D-038`)

### Verifications executees

- Pre-check local:
  - `npx supabase --version` -> OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'` -> OK (`29.2.0`)
  - `npx supabase status` -> OK (stack locale active)
- Setup local:
  - `npx supabase start` -> OK (stack deja active)
  - `npx supabase db reset --local` -> OK (baseline + migrations + seed)
- Gates techniques:
  - `npm ci` -> OK
  - `npm run lint` -> OK
  - `npm run typecheck` -> OK
  - `npm run build` -> OK
  - `npm run test` -> OK
  - `npm run test:f2.0` -> OK
  - `npm run test:f7.3:pre` -> OK
  - `npm run test:f7.3:post` -> OK
  - `npm run lint:ui-contrast` -> OK
  - `npm run audit:prod` -> OK (`found 0 vulnerabilities`)
  - `npm run audit:deps` -> OK (`(empty)`)
- Validation F7.4:
  - `npm run test:f7.4` -> OK (execution)
    - checkpoint: `pre-release`
    - gate technique: `PASS`
    - gate securite: `NO_GO`
    - decision: `NO_GO`
    - controles non-PASS:
      - `S5_captcha_enabled = BLOCKED`
      - `S8_cors_restrictions = BLOCKED`
  - `node scripts/f7_4_validate_local.mjs --checkpoint post-release` -> OK (execution)
    - gate technique: `PASS`
    - gate securite: `NO_GO`
    - decision: `NO_GO`
    - controles non-PASS:
      - `S5_captcha_enabled = BLOCKED`
      - `S8_cors_restrictions = BLOCKED`

### Validation fonctionnelle F7.4

- S1 runbook pre-release executable localement: PASS
- S2 checklist stock/coherence avec preuves: PASS
- S3 decision `GO/NO_GO` explicite et reproductible: PASS (`NO_GO` courant explicite)
- S4 protocole rollback local documente et testable (simulation guidee): PASS
- S5 checklist securite pre-release completee avec statuts + preuves: PASS
- S6 monitoring minimal erreurs critiques documente avec action immediate: PASS
- S7 non-regression des validations existantes: PASS

### Perimetre / limites

- Scope strict F7.4 respecte.
- Aucune migration SQL ajoutee.
- Aucune ecriture DB distante.
- Aucun secret sensible ajoute au repo.
- Les points securite `CAPTCHA` et `CORS` restent bloques (`NO_GO`) et sont a traiter en F7.5.

## 2026-02-23 - F7.3 Healthcheck DB pre-release / post-release

Statut: `FAIT`

### Changements realises

- Script local F7.3 ajoute:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/f7_3_validate_local.mjs`
  - comportement:
    - garde local-only (`npx supabase status -o env`, host `localhost/127.0.0.1` obligatoire)
    - parametre obligatoire `--checkpoint pre-release|post-release`
    - matrice pass/fail:
      - lisibilite vue `healthcheck_business_anomalies_v1`
      - anomalies globales
      - `stock_balance.quantity < 0`
      - lisibilite `stock_per_piece`, `stock_journal`, `piece_movements`
    - rapport standardise:
      - regroupement par `anomaly_family`
      - regroupement par `anomaly_family`/`anomaly_code`/`severity`
      - details actionnables si anomalies > 0
    - decision explicite:
      - `PASS` si gate vert
      - `BLOCKED` si `anomalies_total > 0`
    - codes de sortie:
      - `0`: vert
      - `2`: anomalies detectees
      - `1`: erreur technique/prerequis
- Scripts npm F7.3 ajoutes:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json`
  - `test:f7.3:pre`
  - `test:f7.3:post`
  - `test:f7.3` (`pre -> test -> test:f2.0 -> post`)
- Documentation F7.3 ajoutee:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/F7_3_HEALTHCHECK_DB.md`
- Documentation gouvernance mise a jour:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F7.3` passe a `FAIT`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (nouvelle decision `D-037`)

### Verifications executees

- Sequence locale imposee:
  - `npx supabase --version` -> OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'` -> OK (`29.2.0`)
  - `npx supabase status` -> OK (stack locale active)
  - `npx supabase start` -> OK
  - `npx supabase db reset --local` -> OK
  - `npm run test:f7.3:pre` -> OK
    - checkpoint timestamp: `2026-02-23T17:27:08.334Z`
    - `anomalies_total=0`
    - `decision=PASS`
  - `npm run test` -> OK
  - `npm run test:f2.0` -> OK
  - `npm run test:f7.3:post` -> OK
    - checkpoint timestamp: `2026-02-23T17:28:21.625Z`
    - `anomalies_total=0`
    - `decision=PASS`
  - `npm ci` -> OK (`0 vulnerabilities`)
  - `npm run lint` -> OK
  - `npm run typecheck` -> OK
  - `npm run build` -> OK
  - `npm run test` -> OK
  - `npm run test:f2.0` -> OK
  - `npm run lint:ui-contrast` -> OK

### Validation fonctionnelle F7.3

- S1 vue `healthcheck_business_anomalies_v1` lisible: PASS
- S2 checkpoint pre-release `healthcheck=0`: PASS
- S3 non-regression `npm run test` + `npm run test:f2.0`: PASS
- S4 checkpoint post-release local `healthcheck=0`: PASS
- S5 `stock_balance.quantity < 0` reste `0`: PASS
- S6 vues `stock_per_piece`, `stock_journal`, `piece_movements` lisibles: PASS
- S7 logique actionnable si anomalies > 0: PASS (code en place, non declenche car `0` anomalie)

### Perimetre / limites

- Scope strict F7.3 respecte.
- Aucune migration SQL ajoutee.
- Aucune ecriture DB distante.
- Aucun secret sensible ajoute au repo.

## 2026-02-23 - F7.2 Scenarios manuels de validation metier

Statut: `FAIT`

### Changements realises

- Documentation F7.2 livree:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/F7_2_SCENARIOS_MANUELS.md`
  - contenu livre:
    - strategie locale-first de validation manuelle metier
    - Script A (`npm run dev`) avec protocole executable S1-S12
    - Script B remote read-only (optionnel, sans ecriture)
    - checklists manuelles par page (routes coeur)
    - matrice pass/fail S1-S12
    - evidence log standardise + preuves locales executees
- Support de preuve F7.2 ajoute:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/f7_2_validate_local.mjs`
  - scenarios couverts:
    - refus vente PIECE en stock insuffisant
    - vente SET avec audit `sale_item_pieces`
    - coherence `set_with_completion` apres sortie stock
- Roadmap mise a jour:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - `F7.2` passe a `FAIT`

### Verifications executees

- Pre-check local:
  - `npx supabase --version` -> OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'` -> OK (`29.2.0`)
  - `npx supabase status` -> OK (stack locale active)
- Setup local:
  - `npx supabase start` -> OK (stack deja active)
  - `npx supabase db reset --local` -> OK (baseline + migrations + seed)
- Gates qualite:
  - `npm ci` -> OK (`0 vulnerabilities`)
  - `npm run lint` -> OK
  - `npm run typecheck` -> OK
  - `npm run build` -> OK
  - `npm run test` -> OK
  - `npm run test:f2.0` -> OK
  - `npm run lint:ui-contrast` -> OK
- Validation F7.2 d'appui:
  - `node scripts/f7_2_validate_local.mjs` -> OK
    - `S4` refus stock insuffisant valide
    - `S5` vente SET + audit pieces valide
    - `S10` completion catalogue coherente valide
- Validation auth route protegee (`npm run dev`):
  - `curl -D - http://127.0.0.1:3000/` -> `307 location: /login`
  - `curl -D - http://127.0.0.1:3000/ventes` -> `307 location: /login`
  - `curl -D - http://127.0.0.1:3000/compte` -> `307 location: /login`
  - `curl -D - http://127.0.0.1:3000/login` -> `200 OK`
- Verification attribution reports:
  - `docker exec ... psql ... information_schema.columns` -> 6 colonnes attribution presentes
  - verification code source:
    - `src/app/actions/report.ts` (mapping `created_by_*` / `closed_by_*`)
    - `src/components/report/ReportDialog.tsx` (affichage "Cree par", "Cloture/Ignore par")

### Validation fonctionnelle F7.2

- Scenarios critiques traces dans `docs/F7_2_SCENARIOS_MANUELS.md`:
  - S1 PASS
  - S2 PASS
  - S3 PASS
  - S4 PASS
  - S5 PASS
  - S6 PASS
  - S7 PASS avec reserve mineure non bloquante (H-006)
  - S8 PASS
  - S9 PASS
  - S10 PASS
  - S11 PASS partiel technique + validation visuelle manuelle guidee
  - S12 PASS
- Reserve mineure non bloquante:
  - comportement par defaut `include_cancelled=true` sur `/ventes` (decision ouverte H-006)

### Perimetre / limites

- Scope strict F7.2 respecte.
- Aucune migration SQL ajoutee.
- Aucune ecriture DB distante (`--linked` write non utilise).
- Aucun secret sensible ajoute au repo.
- Checklist securite F7.4 non implementee dans ce lot (hors scope, reference uniquement).

## 2026-02-23 - F7.1 Tests automatiques flux critiques

Statut: `FAIT`

### Changements realises

- Infrastructure de test F7.1 branchee dans:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json`
  - scripts ajoutes/mis a jour:
    - `test:unit` -> `node --test tests/unit/fifo.test.mjs`
    - `test:integration` -> `node scripts/f7_1_validate_local.mjs && npm run test:f2.0`
    - `test` -> orchestration `test:unit` + `test:integration`
    - `test:f2.0` conserve strictement (non-regression)
- Extraction FIFO pure et testable:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/stock-fifo.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/stock.ts`
  - objectif: isoler la logique buckets FIFO oldest-first sans changer le comportement metier
- Suite unitaire FIFO:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/tests/unit/fifo.test.mjs`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/tests/helpers/fifo-fixtures.mjs`
  - coverage:
    - consommation oldest-first
    - depletion partielle/complete multi-lots
    - ignorance des lignes `ADJUST` et quantites invalides
- Suite integration F7.1 locale:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/f7_1_validate_local.mjs`
  - garde local-only:
    - lecture `npx supabase status -o env`
    - echec immediat si `API_URL` n'est pas `localhost/127.0.0.1`
  - execution des server actions compilees avec mock defensif `revalidatePath`
  - fixtures isolees via token run (`F71_*`) et nettoyage best-effort
  - scenarios valides:
    - S1 FIFO oldest-first
    - S2 confirmation lot non vide -> `PURCHASE/IN` coherent
    - S3 confirmation lot vide/incoherent refusee
    - S4 annulation vente -> `CANCELLED` + mouvements IN miroirs + stock restaure
    - S5 coherence KPI exhaustive (`/ventes` + dashboard)
- Documentation:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F7.1` passe a `FAIT`, phase 7 passe a `EN COURS`)

### Verifications executees

- Pre-check local:
  - `npx supabase --version` -> OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'` -> OK (`29.2.0`)
  - `npx supabase status` -> OK (stack locale active)
- Setup local:
  - `npx supabase start` -> OK (stack deja active)
  - `npx supabase db reset --local` -> OK (baseline + migrations F1.x/F5.0.4/F6.4 + seed)
- Checks qualite:
  - `npm ci` -> OK (`added 188 packages`, `0 vulnerabilities`)
  - `npm run lint` -> OK
  - `npm run typecheck` -> OK
  - `npm run build` -> OK
  - `npm run test` -> OK (`test:unit` + `test:integration` + `test:f2.0`)
  - `npm run test:f2.0` -> OK
  - `npm run lint:ui-contrast` -> OK

### Validation fonctionnelle F7.1

- Valide automatiquement/localement:
  - FIFO protegee par tests unitaires + integration (S1)
  - confirmation lot protegee sur cas nominal et refus metier (S2/S3)
  - annulation vente protegee avec restauration stock/mouvements miroir (S4)
  - coherence KPI ventes/dashboard verifiee de maniere exhaustive sur fenetre date isolee (S5)
  - non-regression F2.0 confirmee (S6)
  - commande unique de campagne complete disponible (`npm run test`) (S7)
- A valider manuellement en navigateur local (`npm run dev`):
  - verification visuelle finale des cartes KPI `/ventes` et `/`
  - verification de la lisibilite metier des compteurs sur la plage de test

### Perimetre / limites

- Scope strict F7.1 respecte:
  - pas de migration SQL ajoutee
  - pas de changement de schema DB
  - pas de changement d'API/UI produit
- Aucune ecriture DB distante (`--linked` non utilise).
- Aucun secret sensible ajoute au repo.

## 2026-02-23 - F6.4 Compte/Parametres + attribution reports

Statut: `FAIT`

### Changements realises

- Navigation `Compte` alignee F6.4:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/AppSidebar.tsx`
  - clic direct vers `/compte` (desktop/mobile topbar), suppression du popover logout F6.3
- Protection route compte:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/proxy.ts`
  - ajout de `/compte/:path*` dans le matcher
- Nouvelle page `Compte / Parametres`:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/compte/page.tsx`
  - sections livrees:
    - `Reglages > Comptes` (liste admins existants via Supabase Auth Admin API, lecture seule)
    - `Securite` (formulaire changement mot de passe direct)
    - `Session` (logout session active via action serveur existante)
- Nouvelles actions serveur compte:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/compte/actions.ts`
  - verification mot de passe actuel + mise a jour mot de passe du compte connecte
- Attribution utilisateur des reports:
  - migration SQL:
    - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/migrations/20260223120000_f6_4_report_tickets_attribution.sql`
  - types Supabase:
    - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/types/supabase.ts`
  - actions report:
    - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/actions/report.ts`
    - attribution renseignee a la creation (`created_by_*`) et a la cloture/ignorance (`closed_by_*`)
    - reouverture = reset des champs `closed_by_*`
  - UI report tickets:
    - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/report/ReportDialog.tsx`
    - affichage `Cree par` / `Cloture/Ignore par` (fallback legacy: `Non renseigne`)
- Documentation:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F6.4` passe a `FAIT`)

### Verifications executees

- Pre-check local:
  - `npx supabase --version` -> OK (`2.65.10`)
  - `docker info` -> OK
  - `npx supabase status` -> OK
- Setup local:
  - `npx supabase start` -> OK (stack deja active)
  - `npx supabase db reset --local` -> OK (inclut migration F6.4)
- Checks qualite:
  - `npm ci` -> OK
  - `npm run lint` -> OK
  - `npm run typecheck` -> OK
  - `npm run build` -> OK
  - `npm run test:f2.0` -> OK
  - `npm run lint:ui-contrast` -> OK
- Verification schema locale F6.4:
  - `docker exec -e PGPASSWORD=postgres -i supabase_db_playnovus-manager psql -U postgres -d postgres -P pager=off -c "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='report_tickets' and column_name in ('created_by_user_id','created_by_email','created_by_display_name','closed_by_user_id','closed_by_email','closed_by_display_name') order by column_name;"` -> OK (6 colonnes presentes)
- Verification route protegee (non connecte):
  - `npm run dev` + `curl -I -s http://127.0.0.1:3000/compte` -> `307 location: /login`
  - `pkill -f "next dev"` -> arret du serveur de dev local

### Validation fonctionnelle F6.4

- Valide automatiquement/localement:
  - build/typecheck/lint verts avec nouvelle route `/compte`
  - redirection non connecte `/compte -> /login`
  - migration locale et type-check des nouveaux champs attribution
  - non-regression globale via `npm run test:f2.0`
- A valider manuellement en navigateur local (guide fourni dans rendu final):
  - affichage liste admins A/B dans `Compte / Parametres`
  - changement mot de passe puis relogin
  - logout depuis page compte
  - creation ticket par A puis cloture/ignorance par B avec attribution visible

### Perimetre / limites

- Aucun ajout de gestion avancee comptes/roles.
- Aucune ecriture DB distante SQL/migration/linked.
- DECISIONS non modifie: pas de nouvelle decision structurante dans ce lot.

## 2026-02-23 - F6.3 Creation et gestion des sessions (logout + expiration explicite)

Statut: `FAIT`

### Changements realises

- Logout de session active implemente cote serveur:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/login/actions.ts`
  - nouvelle action `logoutCurrentSession`:
    - tentative `signOut` Supabase scope `local` en best-effort
    - purge systematique des cookies auth applicatifs
    - redirection vers `/login` avec indicateur de deconnexion reussie
- Entree logout UI minimale (hors F6.4):
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/AppSidebar.tsx`
  - icone `Compte` transformee en menu popover avec action unique:
    - `Se deconnecter (cette session)`
- Expiration/invalidation de session rendue explicite:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/proxy.ts`
  - redirection vers `/login` avec raison explicite pour:
    - session legacy a purger
    - fenetre de session depassee (30j max / 7j inactivite)
    - token invalide/non rafraichissable
- Feedback utilisateur login enrichi:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/login/page.tsx`
  - nouveaux messages:
    - deconnexion reussie
    - session expiree (message non sensible)
- Constantes auth alignees:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/auth/constants.ts`
  - ajout des codes de notice login utilises par `proxy` et `logout`
- Documentation:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F6.3` passe a `FAIT`)

### Verifications executees

- Pre-check local:
  - `npx supabase --version` -> OK (`2.65.10`)
  - `docker info` -> OK
  - `npx supabase status` -> OK
- Setup local:
  - `npx supabase start` -> OK (stack deja active)
  - `npx supabase db reset --local` -> OK
- Gates qualite:
  - `npm ci` -> OK
  - `npm run lint` -> OK
  - `npm run typecheck` -> OK
  - `npm run build` -> OK
  - `npm run test:f2.0` -> OK
  - `npm run lint:ui-contrast` -> OK

### Validation fonctionnelle F6.3

- Valide automatiquement/localement:
  - garde d'acces routes metier non connecte (proxy)
  - maintien redirection connecte sur `/login`
  - politique session conservee (`30j max` + `7j inactivite`)
  - non-regression globale via `npm run test:f2.0`
- A valider manuellement (guide fourni dans le rendu final):
  - scenarios multi-session A/B simultanees (S2 a S6)
  - coherence UI complete des messages login/logout en contexte navigateur
  - scenarios d'expiration temporelle simules (S9/S10)

### Perimetre / limites

- Aucun ajout de page `Compte/Parametres` (F6.4 non implemente).
- Aucun changement roles/permissions ou attribution reports.
- Aucun changement schema DB.
- Aucune migration SQL ajoutee.
- Aucune ecriture DB distante via SQL/linked.

## 2026-02-23 - Correctif auth (proxy Next 16 + mot de passe oublie + session memorisee)

Statut: `FAIT`

### Changements realises

- Migration de convention Next.js:
  - suppression de `middleware.ts` au profit de:
    - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/proxy.ts`
  - warning `middleware-to-proxy` supprime au demarrage `npm run dev`
- Renforcement session applicative:
  - nouveaux cookies auth `httpOnly`: access/refresh/issuedAt/lastSeen/remember
  - nouvelle politique session:
    - duree max: `30 jours`
    - inactivite max: `7 jours`
    - mise a jour `lastSeen` cadencee (5 minutes)
  - refresh automatique du token en `proxy` si access token expire
  - purge de compatibilite du cookie legacy unique (`playnovus_auth_token`)
- UX login enrichie:
  - case `Se souvenir de moi` (cochee par defaut)
  - lien `Mot de passe oublie ?`
  - message succes apres reset (`/login?reset=success`)
- Nouveau flux `Mot de passe oublie`:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/forgot-password/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/forgot-password/actions.ts`
  - envoi email reset via Supabase avec message neutre anti-enumeration
- Nouveau flux `Reset mot de passe`:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/reset-password/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/reset-password/ResetPasswordClient.tsx`
  - mise a jour mot de passe + redirection vers login
- Procedure compte de test local documentee:
  - Studio local: `http://127.0.0.1:54323`
  - `Authentication > Users > Create user`
  - email + mot de passe utilises ensuite pour les scenarios S2/S4/S5

### Verifications executees

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:f2.0`
- `npm run lint:ui-contrast`
- `npm run dev`:
  - demarrage sans warning `middleware-to-proxy`

### Perimetre / limites

- Pas d'inscription utilisateur UI.
- Pas de gestion comptes/roles avancee (F6.4).
- F6.3 reste ouvert malgre avancement partiel session.
- Aucun changement schema DB.
- Aucune ecriture DB distante.

## 2026-02-23 - F6.2 Interface d'entree login + redirections d'acces

Statut: `FAIT`

### Changements realises

- Implementation de la route login:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/login/page.tsx`
  - ecran focus minimal avec formulaire `email + mot de passe`
  - feedback utilisateur explicite et actionnable en cas d'erreur de connexion
- Implementation de l'action serveur de connexion:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/login/actions.ts`
  - validation des champs requis
  - authentification Supabase `signInWithPassword`
  - pose d'un cookie applicatif `httpOnly` en cas de succes
  - redirection post-login vers `/` (Dashboard)
- Protection d'acces et redirections:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/proxy.ts`
  - utilisateur non connecte -> redirection `/login` sur routes metier cibles
  - utilisateur connecte sur `/login` -> redirection `/`
  - nettoyage du cookie si token invalide
- Helpers auth F6.2:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/auth/constants.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/auth/supabase-auth.ts`
- Ajustement shell pour un login sans navigation metier:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/AppSidebar.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/AppBackButton.tsx`
  - masquage topbar/back uniquement sur `/login`
- Documentation:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F6.2` passe a `FAIT`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (arbitrage auth structurel trace)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`
  - `docker info`
  - `npx supabase status`
- Setup local:
  - `npx supabase start`
  - `npx supabase db reset --local`
- Gates qualite:
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - `npm run test:f2.0`
  - `npm run lint:ui-contrast`
- Validation fonctionnelle F6.2:
  - S1 non connecte sur route metier -> `/login`
  - S2 login valide -> `/`
  - S3 login invalide -> erreur explicite
  - S4 utilisateur connecte sur `/login` -> `/`
  - S5 acces routes metier principales apres login

### Perimetre / limites

- Lot limite strictement a F6.2.
- Aucun changement F6.4 (page Compte/Parametres, attribution reports).
- Pas de gestion multi-session admin complete ni UI logout (reserve F6.3).
- Aucun changement schema DB.
- Aucune ecriture DB distante.

## 2026-02-23 - F6.1 Cadrage produit page Compte/Parametres

Statut: `FAIT`

### Changements realises

- Creation du cadrage produit F6.1 dans:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/F6_1_CADRAGE_COMPTE_PARAMETRES.md`
- Contenu formalise et valide dans le cadrage:
  - vision/objectifs/non-objectifs
  - parcours utilisateur desktop/mobile
  - architecture d'information et priorisation (MVP vs plus tard)
  - regles UX attendues (succes/erreur/vide/chargement)
  - cadrage attribution reports (auteur creation + cloture/ignorance) au niveau produit
  - frontieres explicites F6.1 -> F6.2/F6.3/F6.4
  - criteres d'acceptation et script de revue documentaire
- Mise a jour ROADMAP:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - `F6.1` passe a `FAIT`
  - `F6.2/F6.3/F6.4` maintenus a `A FAIRE`

### Verifications executees

- Verification documentaire locale:
  - coherence du cadrage F6.1 avec la section Phase 6 de la roadmap
  - coherence de scope: aucun glissement vers implementation F6.2/F6.3/F6.4
  - absence de contradiction avec les contraintes AS-IS/CDC (pas d'auth active implementee, pas d'admin avancee)
- Verification diff:
  - modifications limitees aux documents de pilotage (`docs/*`)
  - aucune modification dans `src/`
  - aucune modification dans `supabase/migrations/`

### Perimetre / limites

- Lot strictement documentaire (F6.1 uniquement).
- Aucun changement code applicatif.
- Aucun changement API/DB/routes/query params.
- Aucune migration SQL.
- Aucune ecriture DB distante.
- Aucun nouvel arbitrage structurant ajoute dans `docs/DECISIONS.md`.

## 2026-02-22 - Reordonnancement ROADMAP pre-Phase 6 (auth -> validation -> deploiement -> post-deploiement)

Statut: `FAIT`

### Changements realises

- Reorganisation chronologique des travaux restants dans `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - `Phase 6` recadree sur acces applicatif, sessions et comptes
  - `Phase 7` dediee a la validation finale pre-deploiement
  - `Phase 8` ajoutee pour le deploiement SaaS initial
  - `Phase 9` ajoutee pour la mise a jour fonctionnelle post-deploiement
- Deplacement sans changement de fond des items validation:
  - ancien `F6.1` -> `F7.1`
  - ancien `F6.2` -> `F7.2`
  - ancien `F6.3` -> `F7.3`
  - ancien `F6.4` -> `F7.4`
- Mise a jour des references internes impactees:
  - references F5.0.4 alignees vers `F6.2/F6.3/F6.4`
  - ordre recommande des features etendu jusqu'a `F9.1`

### Verifications executees

- Verification documentaire locale:
  - enchainement explicite `Phase 6 -> Phase 7 -> Phase 8 -> Phase 9`
  - coherence des renvois internes (`F5.0.4`, ordre recommande)
  - disparition des anciennes references operationnelles `F6.5/F6.6`

### Perimetre / limites

- Lot strictement documentaire (`ROADMAP` + `HISTORIQUE`).
- Aucun changement code applicatif.
- Aucun changement API/DB/routes/query params.

## 2026-02-22 - F5.6 Finitions UI/UX post-refonte (residuel priorise)

Statut: `FAIT`

### Changements realises

- Harmonisation icon-only stricte sur les actions metier (`edit/delete/close`) via `app-icon-action`:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SalesTable.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/EditSaleDialog.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SetSelector.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/PieceSelector.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SetPiecesDialog.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/report/ReportDialog.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/DeleteSetButton.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/catalogue/delete-piece-button.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/catalogue/edit-set-dialog.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/catalogue/edit-piece-dialog.tsx`
- Normalisation du chrome modal residuel:
  - ajout classes shared (`app-modal-standard`, `app-modal-wide`, `app-modal-header`, `app-modal-description`, `app-modal-footer`)
  - alignement des modales residuelles cibles (`EditSaleDialog`, `ReportDialog`, `edit-set-dialog`, `edit-piece-dialog`, `SetPiecesDialog`)
- Unification des toolbars filtres inter-pages:
  - ajout classes shared (`app-filter-toolbar-panel`, `app-filter-toolbar-field`, `app-filter-toolbar-actions`, `app-filter-active-badge`)
  - feedback actif explicite (`data-active` + badge) sur:
    - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/page.tsx`
    - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/page.tsx`
    - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/stock/page.tsx`
    - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/historique-stock/page.tsx`
    - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/page.tsx`
    - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardExecutiveView.tsx`
- Reduction de styles ad hoc au profit du socle shared dans:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/globals.css`
- Documentation F5.6 alignee:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/UI_AUDIT_F5.5.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/UX_AUDIT_F5.5.md`

### Verifications executees

- `npm ci`: OK
- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run test:f2.0`: OK
- `npm run lint:ui-contrast`: OK

### Perimetre / limites

- Scope strict F5.6 respecte:
  - finitions UI/UX residuelles uniquement
  - aucun changement metier
  - aucun changement API/DB
  - aucun changement routes/query params/tri/pagination
  - aucune ecriture DB distante
- Aucun arbitrage structurant supplementaire necessitant MAJ `docs/DECISIONS.md`.

## 2026-02-22 - F5.3 Verification responsive des routes cles

Statut: `FAIT`

### Changements realises

- Corrections responsive/UX visuelle appliquees sur les 5 routes cibles:
  - `/`
  - `/catalogue`
  - `/approvisionnement`
  - `/ventes`
  - `/stock`
- Dashboard (`/`):
  - header et panneau filtres rendus flexibles en mobile (empilement/wrap)
  - suppression des collisions titre/filtres sur petits ecrans
- Approvisionnement / Ventes:
  - popovers filtres convertis en layout `wrap` (plus de ligne forcee bloquante)
  - champs et actions (`Appliquer` / `Reinitialiser`) rendus actionnables en mobile
- Catalogue:
  - toolbar filtres rendue multi-lignes sur mobile
  - drawers filtres bornes au viewport (remplacement des rigidites `min-width`)
  - grilles filtres adaptees mobile/tablette/desktop
- Stock:
  - barre recherche + action `Historique` rendue plus lisible et utilisable en mobile
- Shared UI:
  - cibles tactiles pagination et actions icon-only augmentees en mobile
  - conservation du scroll horizontal local des tableaux (non bloquant)
- Fichiers principaux touches:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/globals.css`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardExecutiveView.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/stock/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/data-table.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SalesTable.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/button.tsx`

### Verifications executees

- `npm ci`: OK
- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run test:f2.0`: OK

### Perimetre / limites

- Scope strict F5.3 respecte:
  - responsive/layout/UX visuelle uniquement
  - aucun changement metier, API, DB, routes, query params
  - aucune ecriture DB distante
- F5.5 et F5.6 restent des lots distincts.

## 2026-02-22 - F5.5 Post-refonte: audit UI/UX + consolidation documentaire

Statut: `FAIT`

### Changements realises

- Construction d'une baseline factuelle unique post-F5.5 a partir de:
  - `docs/ROADMAP.md`
  - `docs/HISTORIQUE.md`
  - `git log` (features F5.x) + `git diff --name-only` courant
- Regle appliquee pour la consolidation:
  - seuls les elements valides sont repertories comme "faits"
- Audit UI mis a jour (etat actuel post-refonte):
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/UI_AUDIT_F5.5.md`
  - findings priorises (Critique/Majeur/Mineur), conformite contraste, plan court terme
- Audit UX cree (parcours metier + frictions + opportunites):
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/UX_AUDIT_F5.5.md`
- Roadmap consolidee:
  - enrichissement de `F5.5` avec sous-bilan valide par domaine
  - ajout de `F5.6` (finitions UI/UX residuelles) en statut `A FAIRE`
  - ordre recommande mis a jour pour inclure `F5.6`

### Consolidation "fait" depuis F5.5 (elements valides)

- Dashboard:
  - modales harmonisees, titres nettoyes, modal tendances en 4 vues onglets
  - theme sombre isole pour la modal Opportunites
- Approvisionnement:
  - layout/table/filtres alignes au pattern global
  - modales lot harmonisees
  - fournisseur en liste deroulante avec ajout local via `+`
- Ventes:
  - alignment visuel liste + details + modales New/Edit
  - libelles metier clarifies (`Commande n°`, `SETS/PIECES`)
  - references set rendues lisibles dans les details ventes
- Stock / Historique stock:
  - shell visuel coherent avec appro/ventes
  - historique conserve les lignes vert/rouge (IN/OUT)
- Catalogue:
  - barre de filtres drilldown en pills
  - detail set harmonise (cards/meta/table/actions)
- Navigation globale / topbar:
  - bouton retour global externe a la topbar
  - bouton compte a droite de `Report`
  - visibilite des icones retour/compte renforcee
- Design system:
  - enforcement contraste AA via `lint:ui-contrast`
  - harmonisation des actions edit/delete selon le style de reference appro (avec conservation des suppressions en `X` quand requis)
- Correctifs conversation recente:
  - modal `Ajouter un set` alignee sur le gabarit `Nouveau lot`
  - icones topbar retour + compte forcees visibles
  - uniformisation globale des boutons edit/delete sur les zones cibles

### Verifications executees

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run test:f2.0`: OK

### Perimetre / limites

- Lot strictement documentaire:
  - audits UI/UX + consolidation `ROADMAP`/`HISTORIQUE`
- Aucun changement metier, API, DB, query params, routes ou server actions dans ce lot.
- Les points residuels restent traces pour `F5.6`.

## 2026-02-22 - F5.5 Refonte globale UI/UX (Soft UI / Bento)

Statut: `FAIT`

### Changements realises

- Refonte globale du design system dans `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/globals.css`:
  - tokens visuels Soft UI/Bento (rayons XXL, surfaces douces, ombres diffuses, pills)
  - fond applicatif avec texture legere (dot-grid) et ambiance pastel
  - classes utilitaires transverses pour navigation flottante, surfaces, tableaux, progressions et badges
  - separateurs pointilles discrets privilegies
- Changement du paradigme de navigation global:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/layout.tsx` adapte au nouveau shell topbar + contenu principal
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/AppSidebar.tsx` refondu en topbar flottante 3 zones (logo, nav centrale, actions/profil) avec menu compact mobile
- Harmonisation des composants shared UI:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/button.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/badge.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/card.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/progress.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/data-table.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/page-header.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/clickable-table-row.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/kpi-card.tsx`
- Adaptations transverses dashboard:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardExecutiveView.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardModal.tsx`
- Ajustements responsive detail routes (suppression des rigidites `min-w-[1024px]`):
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/[id]/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/stock/[piece_ref]/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/[id]/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/historique-stock/page.tsx`

### Verifications executees

- Gates techniques completes:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK
- Re-execution `test:f2.0` post-install: OK (scenarios F2.0/F1.3/F1.4/F1.5 valides, healthcheck a 0)

### Perimetre / limites

- Scope strict F5.5 respecte:
  - refonte UI/UX globale uniquement
  - aucun changement de logique metier et de contrats URL publics
  - aucune migration SQL ajoutee
  - aucune ecriture DB distante
- F5.3 reste distinct et non absorbe dans ce lot (verification responsive globale dediee).

## 2026-02-20 - F5.2 Harmonisation styles globaux et tokens

Statut: `FAIT`

### Changements realises

- Harmonisation du socle global dans `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/globals.css`:
  - ajout de tokens d'ombres (`--app-shadow-*`)
  - normalisation surfaces (`app-card`, `app-table-head`, `app-table-row`)
  - ajout classes utilitaires transverses:
    - controles formulaire (`app-control`, `app-control--md`, `app-control--textarea`, `app-control-label`)
    - filtres (`app-filter-trigger`, `app-filter-panel`, `app-filter-actions`)
    - segments/onglets (`app-segmented`, `app-segmented-item`, etats actif/inactif)
    - dialogs (`app-dialog-overlay`, `app-dialog-surface`, `app-dialog-close`)
- Alignement des composants UI partages:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/button.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/badge.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/input.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/textarea.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/dialog.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/sheet.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/alert-dialog.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/filter-bar.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/data-table.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/kpi-card.tsx`
- Desad-hocisation des consommateurs pour harmoniser filtres, segments, actions et modales:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/stock/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/historique-stock/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/report/ReportDialog.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardExecutiveView.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardModal.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/nouvelle/NewSaleForm.tsx`
  - modales Catalogue/Approvisionnement/Ventes harmonisees (Add/Edit dialogs)
- Suppression des variations visuelles non desirees:
  - suppression des bordures noires sur les surfaces dialog harmonisees
  - alignement des dimensions/paddings des modales sur un langage commun

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK
- Supabase local:
  - `npx supabase start`: OK (`already running`)
  - `npx supabase db reset --local`: OK (`Finished supabase db reset on branch feat/F5.2.`)
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK
- Verifications SQL post-implementation:
  - `stock_balance.quantity < 0`: `0`
  - vues `stock_per_piece`, `stock_journal`, `piece_movements`: lisibles (`2` / `4` / `4` lignes local seed)
  - `healthcheck_business_anomalies_v1`: `0`

### Perimetre / limites

- Scope strict F5.2 respecte:
  - harmonisation visuelle et tokens uniquement
  - aucune modification des comportements metier (query params, filtres, tri, pagination, actions, navigation)
  - aucune migration SQL ajoutee
  - aucune ecriture DB distante
- F5.3 (responsive cross-routes) non traite dans ce lot.

## 2026-02-20 - F5.1 Normalisation des composants de structure (5 pages)

Statut: `FAIT`

### Changements realises

- Audit prealable confirme sur le perimetre documentaire/code:
  - verification des livraisons `F4.2 -> F5.0.4` deja presentes dans `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md` et `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - cartographie des patterns structures dupliques sur `/ventes`, `/approvisionnement`, `/stock`, `/historique-stock`, `/catalogue`
- Ajout des composants shared de structure dans `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/`:
  - `page-header.tsx`
  - `filter-bar.tsx`
  - `kpi-card.tsx`
  - `data-table.tsx`
  - `clickable-table-row.tsx`
- Unification KPI en compat stricte:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SalesStatCard.tsx` -> wrapper `kpi-card`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardStatCard.tsx` -> wrapper `kpi-card`
- Suppression de duplication de ligne cliquable:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/ClickableRow.tsx` -> re-export shared
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/ClickableRow.tsx` -> re-export shared
- Standardisation structurelle des tableaux / headers / filtres sur les 5 pages cibles:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/stock/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/historique-stock/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/page.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SalesTable.tsx`
- Scope F5.1 respecte:
  - aucune migration SQL ajoutee
  - aucun changement schema metier Supabase
  - aucune ecriture distante Supabase

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK
- Rejouabilite locale:
  - `npx supabase start --ignore-health-check`: OK (migrations + seed rejoues)
  - `npx supabase db reset --local --yes`: OK (`Finished supabase db reset on branch feat/F5.1.`)
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK
- Verifications SQL post-implementation (local):
  - `stock_balance.quantity < 0`: `0`
  - vues `stock_per_piece`, `stock_journal`, `piece_movements`: lisibles
  - `healthcheck_business_anomalies_v1`: `0`

### Perimetre / limites

- Feature strictement UI/structure (F5.1), sans extension F5.2/F5.3/F6+.
- Comportements metier preserves (query params, tri, pagination, actions de ligne, navigation).
- Observation environnement local: health-check `supabase_storage` parfois instable, resolu pendant la validation via relance propre `supabase stop --no-backup` puis `supabase start --ignore-health-check`.

## 2026-02-20 - ROADMAP auth pre-prod (F6.5/F6.6) + trajectoire reports

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - ajout de `F6.5 - Authentification applicative multi-session admin` en Phase 6
  - ajout de `F6.6 - Reglages comptes essentiels + attribution des reports` en Phase 6
  - remplacement de la note F5.0.4 "auth/session reportee" par une reference explicite vers `F6.5` et `F6.6`
  - ajout du cadrage futur associe:
    - impacts API/interfaces/types publics (session requise + attribution utilisateur reports + surface `Reglages > Comptes`)
    - scenarios de test cibles auth/reglages/reports
    - hypotheses/defaults explicites (email+mot de passe, role `ADMIN` unique au demarrage, modele extensible)
  - enrichissement des scenarios d'acceptation globaux:
    - blocage d'acces si utilisateur non connecte
    - multi-session admin avec memes donnees/permissions et tracabilite auteur+cloture sur reports
  - ordre recommande des features mis a jour avec:
    - `42. F6.5`
    - `43. F6.6`

### Verifications executees

- Verification documentaire locale:
  - sections F5.0.4, F6.5, F6.6 coherentes et reliees entre elles
  - scenarios d'acceptation globaux mis a jour
  - ordre recommande mis a jour avec les nouveaux items

### Perimetre / limites

- Changement strictement documentaire (ROADMAP uniquement).
- Aucun changement code applicatif.
- Aucune commande Supabase/DB executee.

## 2026-02-20 - F5.0.4 Report tickets internes (sidebar desktop + modale partagee)

Statut: `FAIT`

### Changements realises

- Ajout de la migration SQL `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/migrations/20260220143000_f5_0_4_report_tickets.sql`:
  - creation de `public.report_tickets`
  - colonnes: `id`, `target_scope`, `category`, `description`, `status`, `created_at`, `closed_at`
  - contraintes metier:
    - `status in ('OPEN','RESOLVED','IGNORED')`
    - `category in ('BUG','FEATURE','IMPROVEMENT')`
    - `target_scope in ('GLOBAL','HOME','APPROVISIONNEMENT','VENTES','STOCK','CATALOGUE','HISTORIQUE_STOCK')`
    - description non vide
  - index:
    - `idx_report_tickets_status_created_at`
    - `idx_report_tickets_target_scope_created_at`
  - RLS active + policy compat `p_report_tickets_compat_all`
  - grants CRUD `anon/authenticated` + grants sequence `report_tickets_id_seq`
- Ajout de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/report-types.ts`:
  - constantes/types partages pour `target_scope`, `category`, `status`
  - labels UI + garde-fous de validation
- Ajout de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/actions/report.ts`:
  - `createReportTicketAction(input)`
  - `listReportTicketsAction()`
  - `updateReportTicketAction(input)` (regles checkbox/statut + `closed_at`)
  - `deleteReportTicketAction(id)`
  - validations serveur: cible/categorie obligatoires, description trim non vide et `<= 2000`
- Ajout de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/report/ReportDialog.tsx`:
  - modale centree 2 onglets:
    - `Report`: creation ticket (`cible`, `categorie`, `description`)
    - `Tickets`: tableau (`ID`, `Cible`, `Categorie`, `Description`, `Date depot`, `Statut`, `Cloture ?`, `Date cloture`, `Actions`)
  - tri applique via action serveur: tickets `OPEN` d'abord, puis plus recents
  - cloture:
    - coche -> ticket clos (`RESOLVED/IGNORED`) + date de cloture auto
    - decoche -> ticket re-ouvert (`OPEN`) + `closed_at = null`
  - suppression ticket avec confirmation explicite
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/AppSidebar.tsx`:
  - remplacement du bouton `?` par le trigger `Report` sous `⚙️` (desktop sidebar)
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/types/supabase.ts`:
  - ajout du typage `public.report_tickets`
- Documentation:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`: ajout section F5.0.4 et passage a `FAIT`

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK
- Rejouabilite locale:
  - `npx supabase start`: OK
  - `npx supabase db reset --local`: OK (migrations F1.1 -> F1.7 + F5.0.4 + seed)
- Verifications SQL F5.0.4 (local):
  - table/policy/index/contraintes `report_tickets`: OK
  - CRUD SQL de controle (insert -> cloture -> reouverture -> suppression): OK
  - `stock_balance.quantity < 0`: `0`
  - vues `stock_per_piece`, `stock_journal`, `piece_movements`: lisibles
  - `healthcheck_business_anomalies_v1`: `0`
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK (non-regression F1.3/F1.4/F2.x)

### Perimetre / limites

- Scope strict F5.0.4 respecte (pas de refacto hors feature).
- Aucune ecriture DB distante (local only).
- Champ auteur/reporteur non implemente en V1 (prevu en phase auth ulterieure).

## 2026-02-20 - F5.0.3 Numerotation metier des ventes (MAX+1 avec reset si vide)

Statut: `FAIT`

### Changements realises

- Ajout de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/sale-number.ts`:
  - `parseBusinessSaleNumber(value)` pour parser `#123` / `123` (et ignorer les formats non numeriques)
  - `formatBusinessSaleNumberDisplay(rawSaleNumber, fallbackId)` pour l'affichage UI (`#N` + fallback legacy)
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/actions/sales.ts`:
  - attribution automatique du numero metier dans `createSaleAction` via `computeNextBusinessSaleNumber()`:
    - lecture de `sales.sale_number`
    - calcul `MAX + 1` sur valeurs numeriques
    - retour `1` si aucune valeur numerique
  - insertion `sale_number` en valeur brute numerique string (`"1"`, `"2"`, ...)
  - retry court (3 tentatives) en cas de collision unique `sales_sale_number_key`
  - verrouillage edition manuelle:
    - `sale_number` retire de `UpdateSaleMetaPayload`
    - rejet explicite si payload legacy contient `sale_number`:
      - `Le numéro métier est attribué automatiquement et ne peut pas être modifié manuellement.`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/sales.ts`:
  - `listSalesForTable` charge maintenant `sale_number`
  - `SalesListRow` expose:
    - `sale_number_raw`
    - `sale_number_display`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SalesTable.tsx`:
  - colonne principale `N° vente`
  - affichage `sale_number_display` en principal et `ID {sale_id}` en secondaire
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/[id]/page.tsx`:
  - titre detail `Vente {saleNumberDisplay}`
  - `ID technique: {id}` en information secondaire
- Documentation:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F5.0` et `F5.0.3` passes a `FAIT`)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK
- Rejouabilite locale:
  - `npx supabase start`: OK
  - `npx supabase db reset --local`: OK (migrations F1.1 -> F1.7 + seed)
- Scenarios F5.0.3 valides en local (script temporaire d'execution automatique):
  - `S1` table ventes vide -> premiere vente `#1`: OK
  - `S2` vente suivante -> `#2` (`MAX+1`): OK
  - `S3` annulation de `#1` -> suivante `#2`: OK
  - `S4` suppression de la seule vente -> suivante `#1`: OK
  - `S5` suppression d'une vente intermediaire -> pas de renumerotation, suivante `#4`: OK
  - `S6` affichage UI (liste + detail) du numero metier en principal: OK
  - `S7` edition manuelle du numero metier verrouillee (contrat TS + garde runtime): OK
  - `S8` creation/edition/annulation/suppression sans regression des flux stock attendus: OK
- Verifications SQL post-implementation:
  - unicite `sale_number`: OK (pas de doublon)
  - `stock_balance.quantity < 0`: `0`
  - vues `stock_per_piece`, `stock_journal`, `piece_movements`: lisibles
  - `healthcheck_business_anomalies_v1`: lisible, `0` anomalie locale
  - aucun `source_type` parasite lie a la numerotation des ventes
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK

### Perimetre / limites

- Scope strict F5.0.3 respecte (pas de F5.1+/F6+).
- Aucun changement SQL/migration.
- Aucune ecriture DB distante.
- Note technique legacy (hors scope F5.0.3):
  - la fonction `reset_sales_id_sequence` peut retourner `setval ... out of bounds` sur table `sales` vide (ID technique).
  - non bloquant pour la numerotation metier `sale_number` et non traite dans cette feature.

## 2026-02-20 - F5.0.2 Pieces jointes facture (photo/pdf) sur detail lot

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`:
  - ajout de la lecture server-side des pieces jointes facture lot: `getLotInvoiceAttachment(lotId)`
  - ajout de l'upload/remplacement server-side: `uploadLotInvoiceAttachment(lotId, formData)`
  - ajout de la suppression server-side: `deleteLotInvoiceAttachment(lotId)`
  - creation/verification automatique du bucket storage prive `lot-invoice-attachments`
  - politique cardinalite lot:
    - 1 piece jointe par lot
    - upload suivant = remplacement automatique de l'ancienne piece
  - validation stricte upload:
    - formats autorises: `PDF`, `JPG/JPEG`, `PNG`, `WEBP`, `HEIC`
    - taille max: `15 Mo`
    - rejet bloque avec message actionnable si invalide
  - consultation via URL signee (TTL 1h) pour ouverture depuis l'UI lot
  - aucun impact sur les flux stock (`stock_movements`/`stock_balance`) ou inventory existants
- Ajout de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/[id]/LotInvoiceAttachmentPanel.tsx`:
  - composant UI dedie "piece jointe facture"
  - upload fichier (photo/pdf) avec feedback simple succes/erreur
  - affichage meta piece jointe (nom/type/taille/date)
  - action `Ouvrir` (lien signe) + suppression manuelle
  - lot `confirmed` autorise (upload + suppression) selon decision produit
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/[id]/page.tsx`:
  - chargement server-side de la piece jointe facture du lot
  - integration du composant facture dans la colonne gauche du detail lot
  - conservation du flux pieces existant (ajout rapide, import CSV, edition/suppression lignes)
- Documentation:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F5.0.2` passe a `FAIT`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (D-032)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK
- Rejouabilite locale:
  - `npx supabase start`: OK
  - `npx supabase db reset --local`: OK (migrations F1.1 -> F1.7 + seed)
- Scenarios F5.0.2 validates en local (S1 -> S9): OK
  - `S1` lot draft upload photo valide
  - `S2` lot draft upload PDF valide
  - `S3` consultation de la piece jointe apres refresh
  - `S4` suppression manuelle depuis detail lot
  - `S5` lot confirmed upload autorise
  - `S6` lot confirmed suppression autorisee
  - `S7` fichier invalide bloque (format/taille)
  - `S8` remplacement automatique de la piece jointe existante
  - `S9` non-regression inventory (ajout/import/edition/suppression)
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK
- Verifications SQL post-implementation (lecture seule locale):
  - `stock_balance.quantity < 0`: `0`
  - vues `stock_per_piece`, `stock_journal`, `piece_movements`: lisibles (`2` / `4` / `4` lignes seed)
  - `healthcheck_business_anomalies_v1`: `0`
  - mouvements coeur (`PURCHASE`/`SALE`/`SALE_CANCEL`): inchanges par le flux documentaire
- Verifications storage locales:
  - bucket `lot-invoice-attachments`: present, prive (`public = false`)
  - objets restants `storage.objects` sur ce bucket apres nettoyage tests: `0`

### Perimetre / limites

- Scope strict F5.0.2 respecte (pas de F5.0.1/F5.0.3/F6+).
- Aucun changement SQL/migration.
- Aucune ecriture DB distante.

## 2026-02-20 - F5.0.1 Import CSV pieces depuis detail lot

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`:
  - ajout de la server action `importLotPiecesFromCsv(lotId, { csvContent })`
  - parsing CSV cote serveur:
    - delimiters `;` et `,`
    - entete optionnelle `Numero de piece` / `Quantite de piece` (tolerante casse/espaces/accents)
  - validation metier:
    - `piece_ref` non vide
    - `quantity` entier strictement positif
  - import partiel:
    - lignes valides appliquees
    - lignes invalides rejetees avec motif et numero de ligne
  - doublons internes CSV agreges (addition des quantites) avant application
  - application via la logique existante `addPieceToLot` pour conserver:
    - fusion `(lot_id, piece_ref)`
    - recalcul `lots.total_pieces`
    - recalcul `inventory.unit_cost`
    - verrou serveur sur lot `draft` uniquement
  - retour structure detaillee:
    - `summary` (total/valides/rejetees/importees/fusionnees/quantite totale)
    - `appliedRows`
    - `rejectedRows`
- Ajout de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/[id]/LotCsvImportDialog.tsx`:
  - UI `Importer CSV` avec 2 modes:
    - import fichier `.csv`
    - collage de contenu CSV
  - affichage d'un rapport detaille post-import:
    - lignes appliquees (ajoutees/fusionnees)
    - lignes rejetees (motif + numero de ligne)
  - message explicite et verrou UI si lot `confirmed`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/[id]/page.tsx`:
  - integration du bouton/dialog `Importer CSV` dans l'entete des pieces du lot
- Documentation:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F5.0.1` passe a `FAIT`)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK
- Rejouabilite locale:
  - `npx supabase start`: OK
  - `npx supabase db reset --local`: OK (migrations F1.1 -> F1.7 + seed)
- Scenarios F5.0.1 (server action, local-only):
  - `S1` import fichier CSV A/B: OK
  - `S2` import collage CSV: OK
  - `S3` piece inconnue catalogue acceptee: OK
  - `S4` doublons internes CSV additionnes: OK
  - `S5` lot `confirmed` bloque cote serveur: OK
  - `S6` ajout manuel existant conserve/verrouille sur lot `confirmed`: OK
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK
- Verifications SQL post-implementation (lecture seule locale):
  - `stock_balance.quantity < 0`: `[]` (aucune ligne negative)
  - vues `stock_per_piece`, `stock_journal`, `piece_movements`: HTTP `200`
  - `healthcheck_business_anomalies_v1`: `[]`
  - coherence lots confirmes (`inventory` vs `PURCHASE/IN`): OK via `npm run test:f2.0`

### Perimetre / limites

- Scope strict F5.0.1 respecte (pas de F5.0.2/F5.0.3/F6+).
- Aucun changement SQL/migration.
- Aucune ecriture DB distante.

## 2026-02-20 - F4.4 Extensions analytiques avancees (phase B)

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/dashboard.ts`:
  - extension additive du contrat `dashboard.v3`:
    - `forecast` (projections 30j/90j + signal achat global)
    - `salesChannelCohorts` (cohortes `sales_channel` et mix avance)
    - `sourcingChannelLeadTime` (lead-time par canal d'appro via `lots.supplier`)
    - `themeRotation` (rotation/couverture par `theme` des sets)
  - nouveaux chargements data locaux sans migration SQL:
    - `sold_pieces_journal`, `sale_items` (item_kind `SET`), `sets_catalog`, `set_with_completion`
  - ajout de codes `issues` F4.4 dedies (`*_UNAVAILABLE`, `*_DATA_INSUFFICIENT`)
  - conservation robuste `partial/issues/quality` et des query params publics (`preset/from/to`)
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardExecutiveView.tsx`:
  - bloc "Pilotage achats / stock" enrichi en apercu:
    - signal achat global + projection CA/marge 30j + couverture
  - modale bloc 4 etendue:
    - section Projection cash/profit
    - section Cohortes canaux ventes
    - section Lead-time canaux d'approvisionnement
    - section Rotation par theme
  - en cas d'insuffisance, message explicite affiche (section visible, non masquee):
    - `manque de donnees pour formuler une analyse fiable`
- Documentation:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F4.4` passe a `FAIT`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (D-030)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info`: OK
  - `npx supabase status`: OK
- Rejouabilite locale:
  - `npx supabase start`: OK
  - `npx supabase db reset --local`: OK (migrations F1.1 -> F1.7 + seed)
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK
- Verifications SQL post-implementation:
  - `stock_balance.quantity < 0`: `0`
  - vues `stock_per_piece`, `stock_journal`, `piece_movements`: lisibles
  - `healthcheck_business_anomalies_v1`: `0`
  - coherence lots confirmes (`inventory` vs `PURCHASE/IN`): OK via `test:f2.0`
- Smoke runtime local (`npm run dev` + requetes HTTP):
  - `/` = 200
  - `/ventes`, `/approvisionnement` = 307 canonique (sans erreur serveur)
  - `/stock`, `/catalogue`, `/historique-stock` = 200

### Perimetre / limites

- Scope strict F4.4 respecte (pas de F5+).
- Aucun changement SQL/migration.
- Aucune ecriture DB distante.

## 2026-02-20 - Dashboard V3.2.6 (header mono-ligne ultra compact)

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardExecutiveView.tsx`:
  - header compacte en mono-ligne (desktop prioritaire):
    - `DASHBOARD` a gauche
    - panneau filtre inline au centre (si ouvert)
    - bouton `Filtrer` a droite
  - suppression des informations secondaires du header:
    - libelle de version
    - badges `periode / preset / granularite`
  - panneau filtre conserve en inline, horizontal strict (`flex-nowrap`, `whitespace-nowrap`, `overflow-x-auto`)
  - reduction de hauteur du header via paddings compacts + panneau `h-10`
  - logique filtre inchangee:
    - presets instantanes
    - custom via `from/to` + `Appliquer`
    - reset `/?preset=total`
- Documentation mise a jour:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F4.12` ajoute)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (D-029)

### Verifications executees

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run test:f2.0`: OK

### Perimetre / limites

- Aucun changement SQL/migration.
- Aucun changement du contrat data dashboard.
- Aucune ecriture DB distante.

## 2026-02-20 - Dashboard V3.2.5 (filtre inline unique sans Sheet)

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardExecutiveView.tsx`:
  - suppression complete du mode `Sheet` pour le filtre dashboard
  - suppression du bouton mobile dedie; conservation d'un seul bouton `Filtrer`
  - panneau filtre rendu uniquement inline dans le header (zone centrale)
  - conservation de la disposition horizontale stricte des controles:
    - `Total/12m/90j/30j/7j`, `Personnalise`, `Du`, `Au`, `Appliquer`, `Reinitialiser`
  - conservation de la logique filtre:
    - presets instantanes
    - custom via `from/to` + `Appliquer`
    - reset vers `/?preset=total`
- Documentation mise a jour:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F4.11` ajoute)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (D-028)

### Verifications executees

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run test:f2.0`: OK

### Perimetre / limites

- Aucun changement SQL/migration.
- Aucun changement du contrat data dashboard.
- Aucune ecriture DB distante.

## 2026-02-20 - Dashboard V3.2.4 (header stabilise + filtre inline zone centrale)

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardExecutiveView.tsx`:
  - stabilisation du header desktop/tablette en 3 zones fixes:
    - gauche: titre + metadata
    - centre: panneau filtre inline
    - droite: bouton `Filtrer` fixe
  - panneau filtre desktop borne a la zone centrale:
    - rendu en flux normal (pas de panel flottant)
    - largeur limitee au slot central (`w-full`, `max-w-full`)
    - disposition strictement horizontale avec scroll horizontal si necessaire
  - robustesse viewport:
    - fermeture automatique du `Sheet` mobile si passage en desktop/tablette (`matchMedia`)
    - fermeture du panneau desktop si retour en mobile
  - logique filtre preservee:
    - presets instantanes
    - custom `from/to` via `Appliquer`
    - reset `/?preset=total`
- Documentation mise a jour:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F4.10` ajoute)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (D-027)

### Verifications executees

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run test:f2.0`: OK

### Perimetre / limites

- Aucun changement SQL/migration.
- Aucun changement du contrat data dashboard.
- Aucune ecriture DB distante.

## 2026-02-20 - Dashboard V3.2.2 (filtre inline horizontal desktop + drawer mobile)

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardExecutiveView.tsx`:
  - suppression du filtre flottant desktop/tablette (popover)
  - ajout d'un bandeau filtre inline dans le header (flux normal, sans overlap KPI)
  - disposition horizontale stricte des controles desktop:
    - presets `Total/12m/90j/30j/7j`
    - bouton `Personnalise`
    - champs `Du` / `Au`
    - actions `Appliquer` / `Reinitialiser`
  - fallback mobile only:
    - drawer filtre dedie (`Sheet`) pour petits ecrans
  - logique filtre preservee:
    - presets instantanes
    - custom via `Appliquer`
    - reset `/?preset=total`
- Uniformisation KPI conservee:
  - cards KPI gardent le style standard des cards dashboard (fond blanc, bordure legere, ombre douce)
- Documentation mise a jour:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F4.9` ajoute)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (D-026)

### Verifications executees

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run test:f2.0`: OK

### Perimetre / limites

- Aucun changement SQL/migration.
- Aucun changement du contrat data dashboard.
- Aucune ecriture DB distante.

## 2026-02-20 - Dashboard V3.2.1 (uniformisation KPI + filtre popover horizontal gauche)

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardExecutiveView.tsx`:
  - suppression du style KPI pastel/gradient
  - cards KPI alignees sur le style des autres cards dashboard (`MinimalCardButton`: fond blanc, bordure legere, ombre douce)
  - popover filtre repositionne a gauche du bouton `Filtrer` (`side=left`)
  - contenu du popover refondu en layout horizontal:
    - colonne presets/timeline
    - colonne actions + mode custom
  - presets instantanes, mode custom et reset `/?preset=total` conserves
- Documentation mise a jour:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F4.8` ajoute)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (D-025)

### Verifications executees

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run test:f2.0`: OK

### Perimetre / limites

- Aucun changement SQL/migration.
- Aucun changement du contrat data dashboard.
- Aucune ecriture DB distante.

## 2026-02-20 - Dashboard V3.2 (KPI unitaires, filtre inline, bento trend-dominant)

Statut: `FAIT`

### Changements realises

- Mise a jour UI dashboard dans `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardExecutiveView.tsx`:
  - suppression du wrapper global "Sante financiere"
  - rendu direct des KPI: `1 KPI = 1 card`
  - suppression du contour visuel dur des cards KPI (style pastel + ring leger)
  - densite KPI desktop fixee a 5 colonnes
  - remplacement du filtre `Sheet` lateral par un `Popover` compact dans le header
  - presets temps en application instantanee (`Total`, `12m`, `90j`, `30j`, `7j`)
  - mode `custom` conserve via `from/to` + bouton `Appliquer`
  - reset filtre sur `/?preset=total`
  - grille bento refondue en mode trend-dominant:
    - tendances en bloc majeur (`col-span-8`, `row-span-2` sur XL)
    - blocs secondaires repartis en tailles variees
  - previews condensees:
    - hauteurs graphiques reduites en dashboard
    - legendes masquees en preview
  - modales detaillees conservees au clic sur toute card
- Aucun changement du contrat data dashboard (`dashboard.v3`) ni des query params publics (`preset/from/to`).

### Verifications executees

- Gates techniques:
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK

### Perimetre / limites

- Aucun changement SQL/migration.
- Aucune ecriture DB distante.
- Ajustements limites au perimetre UX/UI dashboard.

## 2026-02-20 - Dashboard V3.1 (ajustements UX/UI cibles: cards compactes, filtres drawer, preset total)

Statut: `FAIT`

### Changements realises

- Evolution data dashboard dans `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/dashboard.ts`:
  - `DashboardPreset` officiel: `total|7|30|90|12m|custom`
  - fallback canonique par defaut vers `preset=total` (plus d'alias legacy vers `30`)
  - `total` calcule sur l'historique reel:
    - debut = plus ancienne date business exploitable (`sales.status=CONFIRMED` et `lots.status=confirmed`)
    - fin = date de reference courante
  - `activeBucket` et `stackedBucket` resolves sur la plage effective (y compris `total`)
- Canonicalisation SSR de `/` dans `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/page.tsx`:
  - `/` redirige vers `/?preset=total`
  - `preset` invalide redirige vers `/?preset=total`
  - `custom` conserve la normalisation stricte `from/to` (invalides ignores, permutation auto, borne unique => plage 1 jour)
- Refonte UI dashboard dans `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardExecutiveView.tsx`:
  - titre principal: `DASHBOARD`
  - suppression des chips de filtres visibles en header
  - bouton `Filtrer` ouvrant un drawer lateral droit (`Sheet`)
  - timeline discrete de presets dans le drawer: `Total`, `12m`, `90j`, `30j`, `7j` + mode `custom`
  - layout bento compact des blocs 2->5 (plus de sections longues empilees)
  - suppression des boutons `Agrandir`
  - ouverture des modales au clic sur toute la card
  - modale KPI: valeur KPI visible en tete, formule retiree de l'affichage
  - modale bloc 3: UX focalisee par vue (`Graphique`, `Tableau`, `Camembert`) avec vue initiale selon la card cliquee
- Ajustements composants dashboard:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardHubCharts.tsx`:
    - variantes compactes des charts pour previews cards
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardModal.tsx`:
    - support trigger optionnel + mode controle (`open`, `onOpenChange`)
    - animation overlay + scale dashboard-only conservee
- Documentation mise a jour:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (ajout F4.6 `FAIT`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (D-023)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK
  - `npx supabase start`: OK
- Rejouabilite DB locale:
  - `npx supabase db reset --local`: OK
  - note: un premier reset a remonte un etat transitoire `supabase_storage ... unhealthy`; un second run immediat a passe completement.
- Gates techniques:
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK (inclut checks SQL F1.3/F1.4/F1.5/F1.6/F1.7 + coherence inventory/PURCHASE)

### Perimetre / limites

- Aucun changement de schema SQL (aucune migration ajoutee).
- Aucune ecriture sur DB distante.
- Scope cible V3.1 respecte: UX/UI dashboard uniquement, sans derive F4.4+.

## 2026-02-19 - Dashboard V3 (refonte stricte vision produit: KPI + blocs + modales etendues)

Statut: `FAIT`

### Changements realises

- Refonte complete de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/page.tsx`:
  - abandon du layout V2 au profit de la composition V3 stricte en 5 blocs
  - branchement serveur sur `getDashboardExecutiveData(...)` + canonicalisation SSR via `normalizeDashboardExecutiveQuery(...)`
  - contrat URL applique:
    - `preset=7|30|90|12m|custom`
    - support legacy `preset=total` redirige en canonique `preset=30`
    - `from/to` invalides ignores, permutation auto si bornes inversees, plage 1 jour en custom si borne unique
- Ajout d'une vue client dediee `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardExecutiveView.tsx`:
  - bloc 1: 11 KPI finances/operations
  - bloc 2: tendances temporelles (courbes CA+marge + histogramme empile sets/pieces)
  - bloc 3: comparaison sets vs pieces (grouped chart CA/marge/taux + tableau + pie 2 segments)
  - bloc 4: pilotage achats/stock (histogramme mensuel + tendance)
  - bloc 5: opportunites catalogue (top completion exploitable)
  - suppression explicite des sections `Alertes actionnables` et `Drilldowns rapides`
- Ajout d'une modale dashboard-only `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardModal.tsx`:
  - overlay fondu `opacity 0 -> 0.5`
  - modale centree avec `opacity 0 -> 1` et `scale 0.95 -> 1`
  - duree `150ms`, easing `ease-out`, fermeture inverse
- Refonte des graphiques Recharts `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardHubCharts.tsx`:
  - courbes duales CA/Marge + courbes optionnelles modal
  - histogrammes empiles/groupes
  - pie Sets/Pieces 2 segments
  - series KPI miniatures pour modales KPI
- Extension/alignement data dashboard V3 dans `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/dashboard.ts` (v1 conservee):
  - preset `12m` (`365j glissants`)
  - formules verrouillees:
    - rotation stock = `CA periode / stock moyen (ouverture+cloture)/2`
    - immobilisation = `stock actuel / CA cumule 12 mois`
    - cout moyen piece achetee sur periode active
  - robustesse `partial=true` et rendu `—` cote UI si valeur non interpretable

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
  - `npx supabase start`: OK (stack deja active)
- Rejouabilite DB locale:
  - `npx supabase db reset --local`: OK (migrations F1.x + seed appliques)
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK
- Verifications SQL post-implementation (via `test:f2.0`):
  - anti-stock negatif actif (F1.3)
  - anti-doublon actif (F1.4)
  - `stock_balance.quantity < 0`: aucune ligne
  - vues `stock_per_piece`, `stock_journal`, `piece_movements`: lisibles
  - `healthcheck_business_anomalies_v1`: execution OK (`0` anomalie sur seed local)
  - coherence lots confirmes (`inventory` vs `PURCHASE/IN`): OK

### Perimetre / limites

- Aucun changement de schema SQL (aucune migration ajoutee).
- Aucune ecriture sur DB distante.
- Scope strict dashboard V3 sur `/` (pas de nouveaux ecrans analytiques dedies).

## 2026-02-19 - Dashboard V2 Hub analytique (profit/cash + drilldowns)

Statut: `FAIT`

### Changements realises

- Refonte complete de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/page.tsx`:
  - remplacement du dashboard minimal F4.2 par un hub analytique dense
  - contrat URL canonique `preset/from/to`:
    - presets `total|90|30|7|custom`
    - canonicalisation SSR (dates invalides ignorees, permutation auto si `from > to`, `from/to` force `preset=custom`)
  - filtres globaux:
    - chips rapides (`Total`, `90j`, `30j`, `7j`)
    - plage libre `from/to`
  - 8 KPI cliquables avec details metier + drilldowns:
    - CA net
    - marge nette
    - taux de marge
    - commandes confirmees
    - panier moyen
    - cout approvisionnements
    - valeur stock
    - rotation stock (proxy)
  - blocs analytiques:
    - trend business (CA net, marge nette, cout des ventes)
    - mix ventes (canal + type SET/PIECE)
    - bridge profit (CA -> cout ventes -> marge)
    - pression flux (appro vs cout ventes)
    - concentration stock
    - age du stock
    - opportunites catalogue (table compacte)
    - alertes actionnables (qualite + anomalies metier)
  - drilldowns rapides vers pages existantes:
    - `/approvisionnement`
    - `/ventes`
    - `/stock`
    - `/catalogue`
  - gestion explicite de `partial=true` conservee (bandeau + cartes en `—` si donnee partielle)
- Extension data en conservant la compatibilite v1 dans `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/dashboard.ts`:
  - ajout contrat `dashboard.v2`:
    - `DashboardPreset`
    - `DashboardHubFilters`
    - `DashboardComparisonMetric`
    - `DashboardKpiCard`
    - `DashboardSeriesPoint`
    - `DashboardBreakdownRow`
    - `DashboardAlertItem`
    - `DashboardHubData`
  - ajout `normalizeDashboardHubQuery(...)` et `getDashboardHubData(...)`
  - calcul des comparaisons vs periode precedente equivalente (quand applicable)
  - consolidation multi-sources sans migration SQL:
    - `sales`
    - `lots`
    - `stock_per_piece`
    - `stock_journal`
    - `sold_pieces_journal`
    - `set_with_completion`
    - `healthcheck_business_anomalies_v1`
- Ajout des composants Recharts dans `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardHubCharts.tsx`:
  - `TrendBusinessChart`
  - `SalesMixChart`
  - `ProfitBridgeChart`
  - `FlowPressureChart`
  - `StockConcentrationChart`
  - `StockAgeDonutChart`
- Mise a jour dependances:
  - ajout `recharts` dans `package.json` + lockfile regenere
- Mise a jour roadmap:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F4.3` passe a `FAIT`, `F4.4` cree pour phase B)

### Verifications executees

- Pre-check environnement local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
  - `npx supabase start`: OK (stack deja active)
- Rejouabilite DB locale:
  - `npx supabase db reset --local`: OK (migrations F1.x + seed appliques)
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK
- Verifications SQL post-implementation (via `test:f2.0`):
  - anti-stock negatif actif (F1.3)
  - anti-doublon actif (F1.4)
  - `stock_balance.quantity < 0`: aucune ligne
  - vues `stock_per_piece`, `stock_journal`, `piece_movements`: lisibles
  - `healthcheck_business_anomalies_v1`: execution OK (`0` anomalie sur seed local)
  - coherence lots confirmes (`inventory` vs `PURCHASE/IN`): OK

### Perimetre / limites

- Aucun changement de schema SQL (aucune migration ajoutee).
- Aucune ecriture sur DB distante.
- Scope livre = phase A du dashboard V2 (hub + drilldowns), phase B avancee conservee hors scope (`F4.4`).

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

## 2026-02-13 - F0.3 Nettoyage lint UI shared + Catalogue/Appro/Stock

Statut: `FAIT`

### Changements realises

- Nettoyage lint/type sur le perimetre F0.3:
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/input.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/ui/textarea.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/[id]/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/NewLotDialog.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/historique-stock/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/catalogue/delete-piece-button.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/catalogue/edit-piece-dialog.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/catalogue/set-image.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/[id]/[saleItemId]/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/DeleteSaleDialog.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/PieceSelector.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SetSelector.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SetPiecesDialog.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SalesTable.tsx`
- Corrections lint global complementaires validees:
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/DashboardStatCard.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/import-data.ts`
- Ajustements de typage necessaires pour gate `typecheck/build`:
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/[id]/page.tsx`
- `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/catalogue/actions.ts`

### Verifications executees

- `npm run lint`: OK (`0 error`, `0 warning`)
- `npm run typecheck`: OK
- `npm run build`: OK

### Perimetre / limites

- Aucune modification de logique metier applicative (FIFO, annulation, regles ventes/stock).
- Aucun changement de schema DB / migration.

## 2026-02-13 - Suppression lot confirme + sync statut/stock

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`:
- ajout d'un helper unique `getLotSalesUsage` pour detecter l'usage ventes d'un lot
- ajout des helpers `deletePurchaseMovementsForLot` et `createPurchaseMovementsForLot`
- `updateLotFromDialog` synchronise maintenant le stock selon transition:
- `draft -> confirmed`: recreation des mouvements `PURCHASE`
- `confirmed -> draft`: retrait des mouvements `PURCHASE` avec blocage si ventes liees
- `deleteLot` autorise suppression des lots `draft` et `confirmed` (y compris `LOT_0`) si aucune vente liee, avec suppression des effets stock/historique associes
- enrichissement des retours d'erreur (`reason`, `linkedSaleIds`, `linkedSalesCount`) sans rupture de compat
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/DeleteLotButton.tsx`:
- suppression du blocage client sur lot confirme
- confirmation utilisateur explicite pour l'impact stock/historique
- guidage utilisateur en cas de blocage `LOT_USED_BY_SALES`
- sans `console.error` client pour erreurs metier attendues
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`:
- ajout des decisions `D-010` (suppression controlee lot confirme) et `D-011` (synchronisation statut/stock)

### Verifications executees

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK

### Perimetre / limites

- Aucun changement de schema DB / migration.
- Aucune suppression en cascade des ventes.
- Blocage conserve si le lot a deja ete utilise dans des ventes.

## 2026-02-15 - Alignement documentation apres mises a jour lot/statut

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/AS_IS.md`:
- alignement du comportement Approvisionnement avec l'implementation reelle:
  - suppression lot `draft/confirmed` (incluant `LOT_0`) si non utilise en ventes
  - synchronisation `draft <-> confirmed` sur les mouvements `PURCHASE`
  - blocage si usage ventes detecte
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/CAHIER_DES_CHARGES.md`:
- regles cibles Approvisionnement mises a jour pour inclure:
  - retour `confirmed -> draft` conditionnel
  - suppression lot confirme conditionnelle
  - criteres d'acceptation anti-doublon mouvements
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
- `Phase 0` marquee `FAIT`
- ajout de `F2.0` (suppression lot confirme + sync statut/stock) marquee `FAIT`
- `Phase 2` marquee `EN COURS`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/00_START_HERE.md`:
- ordre de lecture complete avec `DECISIONS` et `HISTORIQUE`
- index des docs principales complete avec `HISTORIQUE`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/_archive/BACKLOG.md`:
- ticket `T-330` passe de bloque a traite (decision appliquee)

### Verifications executees

- revue de coherence sur tous les fichiers `docs/*` avec recherche ciblee des regles lot/statut

### Perimetre / limites

- Les docs archivees dans `docs/_archive/` restent historiques; seules les contradictions critiques ont ete corrigees.

## 2026-02-15 - F1.1 Initialiser les migrations versionnees

Statut: `FAIT`

### Changements realises

- Baseline migration generee depuis la DB Supabase reelle:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/migrations/20260215214134_f1_1_baseline_public.sql`
- Snapshot de securite pre-baseline cree:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/_snapshots/pre_f1_1_public.sql`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/config.toml`:
  - `[db.seed].enabled = false` (seed hors perimetre F1.1, traite en F1.2)
- Regeneration des types Supabase dans:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/types/supabase.ts`
- Ajustement de typage uniquement (sans changement metier) dans:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/actions/sales.ts`
  - prise en charge defensive de l'absence de colonne `sale_items.overrides` dans la DB reelle
- Mise a jour documentation F1.1:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`
- Mise a jour safety git:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/.gitignore` avec `_snapshots/`

### Verifications executees

- Supabase / migrations:
  - `npx supabase link --project-ref cxnbrqfhyyhnrhahdzcb --password <env>`: OK
  - `npx supabase db dump --linked --schema public --file supabase/_snapshots/pre_f1_1_public.sql --password <env>`: OK
  - `npx supabase db pull f1_1_baseline_public --linked --schema public --password <env>`: OK
  - `npx supabase start`: OK
  - `npx supabase db reset --local`: OK
- Verification objets cles apres reset (DB locale):
  - tables cles attendues: presentes (`inventory`, `lots`, `sales`, `sale_items`, `sale_item_pieces`, `stock_movements`, `sets_catalog`, `sets_bom`, `transactions`, `stock_balance`)
  - vues cles attendues: presentes (`stock_per_piece`, `stock_journal`, `piece_movements`, `set_with_completion`)
  - fonction attendue: presente (`reset_sales_id_sequence`)
- Qualite projet:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK

### Perimetre / limites

- Aucun changement de logique metier applicative.
- Aucun changement destructif applique au schema distant.

## 2026-02-15 - F1.2 Ajouter un seed minimal executable

Statut: `FAIT`

### Changements realises

- Creation de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/seed.sql`:
  - seed minimal deterministe et executable via reset local
  - insertion d'un set (`sets_catalog`) et BOM multi-pieces (`sets_bom`)
  - insertion d'un lot `confirmed` (`lots`) + lignes `inventory` coherentes
  - insertion des mouvements `PURCHASE/IN` dans `stock_movements`
  - insertion d'une vente `CONFIRMED` (`sales`) + ligne `sale_items` de type `SET`
  - insertion du detail `sale_item_pieces`
  - insertion des mouvements `SALE/OUT` relies au `sale_item_id`
  - aucune insertion directe dans `stock_balance` (alimente par trigger)
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/config.toml`:
  - `[db.seed].enabled = true`
  - `sql_paths = ["./seed.sql"]` conserve
- Mise a jour documentation F1.2:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F1.2` passe a `FAIT`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md` (cette entree)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale detectee en cours d'execution)
- Validation Supabase locale:
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local`: OK (baseline + seed appliques sans erreur)
- Verification SQL post-seed (DB locale):
  - objets cles presents:
    - `stock_per_piece`: present
    - `stock_journal`: present
    - `piece_movements`: present
    - `set_with_completion`: present
    - `reset_sales_id_sequence()`: presente
  - comptages seed:
    - `lots=1`
    - `stock_movements=4`
    - `sales=1`
    - `sale_items=1`
    - `sale_item_pieces=2`
    - `sets_catalog=1`
    - `sets_bom=2`
  - integrite:
    - `stock_balance.quantity < 0`: `0` ligne
    - vues non vides:
      - `stock_per_piece=2` lignes
      - `stock_journal=4` lignes
      - `set_with_completion=1` ligne
- Qualite projet:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK

### Perimetre / limites

- Aucun changement de schema distant Supabase.
- Aucune commande destructive remote executee.
- Aucune modification de logique metier applicative (hors ajout seed SQL et config locale associee).

## 2026-02-16 - F1.3 Bloquer le stock negatif au niveau DB

Statut: `FAIT`

### Changements realises

- Creation de la migration incrementale:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/migrations/20260216134316_f1_3_block_negative_stock.sql`
- Ajouts DB dans la migration:
  - fail-fast pre-migration si donnees invalides (`stock_balance.quantity < 0` ou `stock_movements IN/OUT` sans `lot_id`)
  - contrainte `ck_stock_balance_qty_nonneg` sur `public.stock_balance` (`quantity >= 0`)
  - fonction helper `public.apply_stock_balance_delta(piece_ref, lot_id, delta)` avec rejet explicite des resultats negatifs
  - remplacement de `public.apply_stock_balance_from_movements()` pour appliquer les deltas sans insert intermediaire negatif
  - fonction/trigger `public.reject_negative_stock_balance()` + `trg_reject_negative_stock_balance` sur `public.stock_balance`
  - contrainte `ck_stock_movements_lot_required_inout` sur `public.stock_movements`
  - grants explicites pour les nouvelles fonctions (`anon`, `authenticated`, `service_role`)
- Mise a jour documentation F1.3:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md` (cette entree)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
- Validation rejouabilite locale:
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local`: OK (baseline + F1.3 + seed F1.2)
- Verification SQL post-migration (DB locale):
  - inventaire contraintes/fonctions/triggers F1.3: OK
    - `ck_stock_balance_qty_nonneg`: presente
    - `ck_stock_movements_lot_required_inout`: presente
    - `trg_reject_negative_stock_balance`: present
    - `apply_stock_balance_delta`, `apply_stock_balance_from_movements`, `reject_negative_stock_balance`: presentes
  - test echec sortie invalide: OK (rejet DB explicite)
    - message: `Stock negatif interdit (...) Mouvement refuse.`
  - test succes sortie valide: OK (`BEGIN`, `INSERT 0 1`, `ROLLBACK`)
  - test lot obligatoire pour `IN/OUT`: OK (viol de `ck_stock_movements_lot_required_inout` quand `lot_id` est `NULL`)
  - integrite:
    - `stock_balance.quantity < 0`: `0` ligne
    - traces de tests (`source_id=F1_3_FAIL_TEST`, `F1_3_SUCCESS_TEST`): `0` ligne
  - vues operationnelles:
    - `stock_per_piece`: lisible
    - `stock_journal`: lisible
    - `piece_movements`: lisible
- Qualite projet:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK

### Perimetre / limites

- Aucun changement de schema distant Supabase.
- Aucune commande d'ecriture remote executee.
- Aucun ajout de secret sensible dans le repo.
- Aucun changement F1.4+ (pas d'anti-doublon, pas d'index perf additionnels).

## 2026-02-16 - F1.4 Anti-doublons de mouvements + indexes perf

Statut: `FAIT`

### Changements realises

- Creation de la migration incrementale:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/migrations/20260216144649_f1_4_anti_duplicate_movements_indexes.sql`
- Ajouts DB dans la migration:
  - fail-fast pre-migration si mouvements coeur sans `source_id` exploitable (`PURCHASE`, `SALE`, `SALE_CANCEL`)
  - fail-fast pre-migration si doublons deja presents sur la cle metier `(source_type, source_id, piece_ref, lot_id, direction)` pour flux coeur
  - contrainte `ck_stock_movements_source_id_required_core` sur `public.stock_movements`
  - index unique partiel `ux_stock_movements_no_duplicate_core` sur `(source_type, source_id, piece_ref, lot_id, direction)` (scope `PURCHASE|SALE|SALE_CANCEL`, `IN|OUT`)
  - index lookup source `idx_stock_movements_source_id_direction` sur `(source_type, source_id, direction)`
  - suppression des indexes redondants `idx_stock_movements_source` et `stock_movements_source_type_id_idx`
- Mise a jour documentation F1.4:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md` (cette entree)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale detectee)
- Validation rejouabilite locale:
  - `npx supabase start`: KO initial (conflit conteneur deja existant `supabase_db_playnovus-manager`)
  - `npx supabase stop --no-backup`: OK (remise a plat locale)
  - `npx supabase start`: OK (migrations F1.1 + F1.3 + F1.4 appliquees, seed execute)
  - `npx supabase db reset --local`: OK (baseline + F1.3 + F1.4 + seed)
- Verification SQL post-migration (DB locale):
  - inventaire contraintes/index/triggers/fonctions F1.4: OK
    - `ck_stock_movements_source_id_required_core`: presente
    - `ux_stock_movements_no_duplicate_core`: present
    - `idx_stock_movements_source_id_direction`: present
    - `idx_stock_movements_source` / `stock_movements_source_type_id_idx`: absents
    - `trg_stock_balance_ins|upd|del` et `trg_reject_negative_stock_balance`: presents
    - `apply_stock_balance_delta`, `apply_stock_balance_from_movements`, `reject_negative_stock_balance`: presentes
  - test echec doublon cible: OK (duplicate insert rejete, `unique_violation`)
  - test succes insertion legitime non dupliquee: OK (`INSERT 0 1` dans transaction de test puis `ROLLBACK`)
  - integrite:
    - `stock_balance.quantity < 0`: `0` ligne
  - vues operationnelles:
    - `stock_per_piece`: lisible (`2` lignes)
    - `stock_journal`: lisible (`4` lignes)
    - `piece_movements`: lisible (`4` lignes)
  - EXPLAIN requetes critiques:
    - lookup source (`source_type+source_id+direction`) utilise `ux_stock_movements_no_duplicate_core` / `idx_stock_movements_source_id_direction`
    - journal filtre `source_type` utilise `idx_stock_movements_source_id_direction`
    - FIFO force (`piece_ref + order created_at,id`) couvre `idx_stock_movements_piece_created_id`
- Qualite projet:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - warning non bloquant observe au build: `baseline-browser-mapping` data > 2 mois

### Perimetre / limites

- Aucun changement de schema distant Supabase.
- Aucune commande d'ecriture remote executee.
- Aucun ajout de secret sensible dans le repo.
- Aucun changement de logique metier applicative (scope strict DB + docs F1.4).
- Aucun changement F1.5+ (pas de healthcheck metier SQL additionnel).

## 2026-02-16 - F1.5 Healthcheck SQL des anomalies metier

Statut: `FAIT`

### Changements realises

- Creation de la migration incrementale:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/migrations/20260216164515_f1_5_healthcheck_sql_anomalies.sql`
- Ajouts DB dans la migration:
  - creation de la vue canonique `public.healthcheck_business_anomalies_v1`
  - contrat de sortie stable `v1` (14 colonnes):
    - `contract_version`
    - `anomaly_code`
    - `anomaly_family`
    - `severity`
    - `entity_table`
    - `entity_id`
    - `sale_id`
    - `sale_item_id`
    - `lot_id`
    - `movement_id`
    - `piece_ref`
    - `expected_quantity`
    - `observed_quantity`
    - `details`
  - couverture des anomalies:
    - `CONFIRMED_SALE`: `SALE_CONFIRMED_WITHOUT_ITEMS`, `SALE_ITEM_WITHOUT_SNAPSHOT`, `SALE_ITEM_MOVEMENT_QTY_MISMATCH`
    - `ORPHAN_MOVEMENT`: `ORPHAN_PURCHASE_MOVEMENT`, `ORPHAN_SALE_MOVEMENT`, `ORPHAN_SALE_CANCEL_MOVEMENT`, `ORPHAN_SALE_EDIT_MOVEMENT`
    - `INVENTORY_INCONSISTENCY`: `LOT_TOTAL_PIECES_MISMATCH`, `CONFIRMED_LOT_PURCHASE_INVENTORY_QTY_MISMATCH`
    - `NEGATIVE_STOCK`: `NEGATIVE_STOCK_BALANCE_ROW`
  - grants de lecture explicites sur la vue pour `anon`, `authenticated`, `service_role`
- Strategie appliquee:
  - audit `fail-open` (aucun blocage de migration sur anomalies metier detectees)
  - aucun changement des contraintes/triggers F1.3/F1.4
- Mise a jour documentation F1.5:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md` (cette entree)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info`: OK (Docker engine `29.2.0`)
  - `npx supabase status`: OK (stack locale active)
- Validation rejouabilite locale:
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local --debug`: OK (baseline + F1.3 + F1.4 + F1.5 + seed)
  - `npx supabase db reset --local`: OK (validation finale en mode standard)
- Verification SQL post-migration (DB locale):
  - vue `public.healthcheck_business_anomalies_v1`: presente
  - contrat colonnes/types: conforme (14 colonnes attendues)
  - etat nominal apres reset:
    - `anomalies total`: `0`
    - `stock_balance.quantity < 0`: `0`
  - tests d'injection controles (transaction + rollback): OK
    - `SALE_CONFIRMED_WITHOUT_ITEMS`: detecte (`detected_rows=1`)
    - `ORPHAN_SALE_MOVEMENT`: detecte (`detected_rows=1`)
    - `LOT_TOTAL_PIECES_MISMATCH`: detecte (`detected_rows=1`)
    - `CONFIRMED_LOT_PURCHASE_INVENTORY_QTY_MISMATCH`: detecte (`detected_rows=1`)
    - post-rollback: `anomalies total = 0`
  - non-regression F1.3/F1.4: OK
    - garde-fou anti-stock negatif: actif (test negatif bloque, `stock_balance.quantity < 0 = 0`)
    - anti-doublon metier: actif (`unique_violation` capturee sur tentative de doublon)
  - vues metier existantes toujours lisibles:
    - `stock_per_piece`: OK (`2` lignes seed)
    - `stock_journal`: OK (`4` lignes seed)
    - `piece_movements`: OK (`4` lignes seed)
- Qualite projet:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - warning non bloquant observe au build: `baseline-browser-mapping` data > 2 mois

### Perimetre / limites

- Aucun changement de schema distant Supabase.
- Aucune commande d'ecriture remote executee.
- Aucun ajout de secret sensible dans le repo.
- Aucun changement de logique metier applicative.
- Aucun changement F2+.

## 2026-02-16 - Correctif securite npm `supabase/tar`

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json`:
  - ajout de l'override npm:
    - `supabase -> tar@7.5.9`
- Regeneration du lockfile:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package-lock.json`
- Mise a jour gouvernance roadmap:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F0.4`)

### Verifications executees

- Stabilisation npm:
  - `chown -R $(id -u):$(id -g) ~/.npm`: OK
  - `npm config get cache`: OK (`/Users/bastienchristlen/.npm`)
  - `npm ping`: OK (`PONG`)
- Baseline vulnerabilites:
  - `npm ls supabase tar`: OK (`supabase@2.65.10 -> tar@7.5.2`)
  - `npm audit`: KO attendu (`2 high` sur `tar <= 7.5.6`)
- Apres correctif:
  - `npm install`: OK (`changed 1 package`)
  - `npm ls supabase tar`: OK (`tar@7.5.9 overridden`)
  - `npm audit`: OK (`found 0 vulnerabilities`)
- Smoke test Supabase CLI:
  - `npx supabase --version`: OK (`2.65.10`)
  - `npx supabase --help`: OK
  - `npx supabase status`: OK (stack locale active)
- Gates techniques:
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK

### Perimetre / limites

- Aucun changement de logique applicative.
- Aucun changement de schema DB (local/remote).
- Aucune ecriture distante Supabase.

## 2026-02-16 - F2.0 Revalidation merge-readiness (suppression lot confirme + sync statut/stock)

Statut: `FAIT`

### Changements realises

- Revalidation complete du perimetre F2.0 sans changement de code metier:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/DeleteLotButton.tsx`
- Verification documentaire F2.0:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md`
- Mise a jour roadmap F2.0 avec precision de revalidation locale et signalement de l'ecart remote en lecture seule.

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
- Baseline locale:
  - `npx supabase db reset --local`: OK (baseline + F1.3 + F1.4 + F1.5 + seed)
- Lecture remote strictement read-only:
  - `npx supabase link --project-ref <PROJECT_REF> --password \"$SUPABASE_DB_PASSWORD\"`: OK
  - `npx supabase db dump --linked --schema public --file /Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/_snapshots/pre_f2_0_public.sql --password \"$SUPABASE_DB_PASSWORD\"`: OK
- Verification SQL locale post-reset:
  - `stock_balance.quantity < 0`: `0`
  - `healthcheck_business_anomalies_v1`: `0` anomalie
  - vues lisibles:
    - `stock_per_piece`: `2` lignes
    - `stock_journal`: `4` lignes
    - `piece_movements`: `4` lignes
  - coherence lots confirmes (`inventory` vs `PURCHASE/IN`): OK
  - regression guards:
    - F1.3 anti-stock negatif: OK (test negatif rejete)
    - F1.4 anti-doublon: OK (test doublon rejete)
- Validation fonctionnelle F2.0 automatisee en local (harness server actions, build local env isole):
  - S1 suppression lot `draft` non utilise: OK
  - S2 suppression lot `confirmed` non utilise + retrait `PURCHASE`: OK
  - S3 suppression lot utilise: KO attendu (`reason=LOT_USED_BY_SALES`): OK
  - S4 transition `draft -> confirmed` (recreation `PURCHASE`): OK
  - S5 transition `confirmed -> draft` sans ventes: OK
  - S6 transition `confirmed -> draft` avec ventes: KO attendu (`reason=LOT_USED_BY_SALES`): OK
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK

### Perimetre / limites

- Aucun changement de logique metier F2.0 (implementation deja conforme).
- Aucun changement SQL/migration (scope F2.0 respecte).
- Aucun changement destructif distant.
- Ecart remote constate en lecture seule:
  - le dump `pre_f2_0_public.sql` ne contient pas les objets F1.3/F1.4/F1.5 attendus (`ck_stock_balance_qty_nonneg`, `ck_stock_movements_lot_required_inout`, `ck_stock_movements_source_id_required_core`, `ux_stock_movements_no_duplicate_core`, `idx_stock_movements_source_id_direction`, `trg_reject_negative_stock_balance`, `healthcheck_business_anomalies_v1`)
  - traitement de cet alignement remote explicitement hors scope F2.0 (politique: `Proceed + report`).

## 2026-02-17 - F2.0 hardening: cleanup remote test lots + script reproductible

Statut: `FAIT`

### Changements realises

- Nettoyage remote controle des lots de test F2.0 crees pendant les validations:
  - cibles: `lot_code like 'F2T_%'` et `lot_code = 'TMP_X'`
  - suppression effective: lots `14`, `15`, `17`
  - verification post-cleanup: `remaining=[]`
- Ajout d'un script local reproductible:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/f2_0_validate_local.mjs`
  - commande npm: `npm run test:f2.0`
  - objectif: executer automatiquement les scenarios F2.0 sans dependre d'un harness ad hoc.
- MAJ npm scripts:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json` -> `test:f2.0`

### Verifications executees

- Remote cleanup (ecriture distante explicite demandee):
  - dry-run securite: verification `sales_mov=0`, `sale_item_pieces=0`, `non_purchase_mov=0` sur chaque lot cible
  - suppression ciblee en sequence:
    - delete `stock_movements` (`PURCHASE` via `source_id` puis `lot_id`)
    - delete `inventory` par `lot_id`
    - delete `lots` par `id`
  - resultat final: plus aucun lot cible (`remaining=[]`)
- Script `npm run test:f2.0` (run vert):
  - S1 suppression lot `draft` non utilise: OK
  - S2 suppression lot `confirmed` non utilise + retrait `PURCHASE`: OK
  - S3 suppression lot utilise: KO attendu `LOT_USED_BY_SALES`: OK
  - S4 `draft -> confirmed` cree `PURCHASE`: OK
  - S5 `confirmed -> draft` sans ventes retire `PURCHASE`: OK
  - S6 `confirmed -> draft` avec ventes bloque `LOT_USED_BY_SALES`: OK
  - F1.3 anti-stock negatif actif: OK
  - F1.4 anti-doublon actif: OK
  - `stock_balance.quantity < 0`: OK
  - vues `stock_per_piece` / `stock_journal` / `piece_movements`: OK
  - `healthcheck_business_anomalies_v1 = 0`: OK

### Perimetre / limites

- Aucun changement de logique metier F2.0.
- Aucun ajout de migration SQL.
- Le drift schema remote F1.3/F1.4/F1.5 constate en lecture seule reste a traiter hors de cette entree.

## 2026-02-17 - F2.1 Garde-fou serveur lot vide non confirmable

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`:
  - `updateLotFromDialog` lit maintenant `status` et `total_pieces` du lot avant transition.
  - ajout d'un refus explicite sur `draft -> confirmed` si `total_pieces <= 0`.
  - message de refus: `Impossible de confirmer un lot vide. Ajoute au moins une piece avant de confirmer.`
  - le refus intervient avant toute creation de mouvements `PURCHASE`.
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - `F2.1` passe de `A FAIRE` a `FAIT` avec livrables et DoD completes.

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
- Reset local reproductible:
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local`: OK (baseline + F1.3 + F1.4 + F1.5 + seed)
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
- Validation fonctionnelle F2.1 (harness server action local, build local-only):
  - S1 creation lot `draft` vide: OK
  - S2 confirmation lot vide (`draft -> confirmed`): KO attendu avec message explicite: OK
  - S3 apres refus lot vide: aucun `PURCHASE` cree: OK
  - S4 confirmation lot non vide: OK, mouvements `PURCHASE/IN` coherents avec `inventory`
- Verifications SQL post-implementation:
  - `stock_balance.quantity < 0`: `0`
  - vues `stock_per_piece`, `stock_journal`, `piece_movements`: lisibles
  - `healthcheck_business_anomalies_v1`: `0` anomalie
  - coherence lots confirmes (`inventory` vs `PURCHASE/IN`): OK
- Non-regression F2.0 + F1.3/F1.4/F1.5:
  - `npm run test:f2.0`: OK (S1..S6 + checks SQL verts)

### Perimetre / limites

- Scope strict F2.1 respecte: blocage serveur `draft -> confirmed` pour lot vide.
- Aucun changement SQL/migration.
- Aucune ecriture distante Supabase.
- Aucun traitement F2.2+ dans cette livraison.

## 2026-02-17 - Draft-first: creation de lot forcee en brouillon

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`:
  - creation directe d'un lot `confirmed` explicitement refusee dans `createLot(formData)`.
  - creation directe d'un lot `confirmed` explicitement refusee dans `createLotFromDialog(input)`.
  - insertion creation forcee en `status='draft'` sur les deux chemins serveur.
  - message serveur unique: `La création directe d'un lot confirmé n'est pas autorisée. Crée d'abord le lot en brouillon.`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/NewLotDialog.tsx`:
  - suppression du select `Statut` a la creation (plus d'option `confirmed`).
  - creation alignee en brouillon uniquement.
  - ajout d'un guidage UX explicite: confirmation possible apres saisie des pieces.
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - ajout explicite de la regle draft-first et du refus de creation directe `confirmed` dans F2.1.

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local`: OK (baseline + F1.3 + F1.4 + F1.5 + seed)
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
- Validation fonctionnelle draft-first (harness local):
  - S1 creation via chemin `createLotFromDialog` => lot cree en `draft`: OK
  - S2 tentative creation `confirmed` via `createLotFromDialog` => refus explicite: OK
  - S3 tentative creation `confirmed` via `createLot(formData)`:
    - verification source explicite (guard + message + statut force `draft`): OK
    - note: `createLot` n'est pas exposee dans le manifest des server actions de la page approvisionnement
  - S3bis apres refus de creation `confirmed` => aucun lot cree: OK
  - S4 creation brouillon + ajout de pieces + confirmation => flux nominal conserve: OK
- Checks SQL post-run:
  - `stock_balance.quantity < 0`: `0`
  - vues `stock_per_piece`, `stock_journal`, `piece_movements`: lisibles
  - `healthcheck_business_anomalies_v1`: `0` anomalie
  - coherence lots confirmes (`inventory` vs `PURCHASE/IN`): OK
- Non-regression:
  - `npm run test:f2.0`: OK (S1..S6 + checks F1.3/F1.4/F1.5 verts)

### Perimetre / limites

- Aucun changement SQL/migration.
- Aucune ecriture distante Supabase.
- Les regles de confirmation existantes (dont garde-fou lot vide F2.1) restent inchangées.

## 2026-02-17 - F2.2 Alignement UI Appro sur la regle lot vide

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/EditLotDialog.tsx`:
  - ajout d'un garde client dans `handleSubmit` avant l'appel `updateLotFromDialog`.
  - blocage explicite de la tentative `draft -> confirmed` quand `lot.total_pieces <= 0`.
  - message inline explicite et actionnable dans la zone d'erreur existante:
    - `Impossible de confirmer un lot vide. Ajoute au moins une pièce avant de confirmer.`
  - comportement UX retenu preserve:
    - `Confirme` reste selectionnable
    - blocage applique au clic `Enregistrer` si lot vide.
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - `F2.2` passe de `A FAIRE` a `FAIT` avec livrables et DoD completes.

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local --debug`: OK (baseline + F1.3 + F1.4 + F1.5 + seed)
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK (S1..S6 + checks F1.3/F1.4/F1.5 verts)
- Verifications SQL post-implementation (DB locale):
  - `stock_balance.quantity < 0`: `0`
  - vues lisibles:
    - `stock_per_piece`: `2` lignes
    - `stock_journal`: `4` lignes
    - `piece_movements`: `4` lignes
  - `healthcheck_business_anomalies_v1`: `0` anomalie
  - coherence lots confirmes (`inventory` vs `PURCHASE/IN`): `0` mismatch
- Non-regression F2.1 (ciblee):
  - script local (build server actions) sur lot vide:
    - tentative `draft -> confirmed`: KO attendu (refus explicite) : OK
    - mouvements `PURCHASE` crees pour le lot vide: `0`

### Perimetre / limites

- Scope strict F2.2 respecte: UI Appro alignee sur la regle lot vide au submit.
- Aucun changement de logique serveur F2.1.
- Aucun changement SQL/migration.
- Aucune ecriture distante Supabase.
- Validation UX visuelle (message dans la modale) a confirmer via `npm run dev` (check manuel guide).

## 2026-02-17 - Correctif cohérence Qt lot après suppression de ligne inventory

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts` (`deleteInventoryLine`):
  - lecture du lot enrichie (`status`, `total_cost`) pour permettre un recalcul complet apres suppression.
  - apres suppression de la ligne:
    - recalcul de `totalQuantityForLot` depuis les lignes restantes `inventory`.
    - mise a jour de `lots.total_pieces` avec la nouvelle somme.
    - recalcul de `inventory.unit_cost` si `totalQuantityForLot > 0` et `total_cost > 0`.
  - alignement de la strategie fail-soft avec les autres flux:
    - si recalcul impossible apres suppression, retour `success: true` avec `warning`.
  - invalidation explicite de la page liste:
    - ajout de `revalidatePath("/approvisionnement")` (en plus du detail lot).

### Verifications executees

- Reproduction corrigee (attendu):
  - suppression d'une ligne inventory met a jour la quantite affichee en liste `/approvisionnement`.
  - `lots.total_pieces` reste coherent avec la somme des lignes `inventory` du lot.
- Gates techniques:
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK

### Perimetre / limites

- Aucun changement de schema SQL/migration.
- Aucun changement des regles F2.1/F2.2 hors ce correctif de coherence.
- Aucune ecriture distante Supabase.

## 2026-02-17 - Maintenance: purge remote des donnees de mouvement (catalogue conserve)

Statut: `FAIT`

### Changements realises

- Purge des donnees metier sur la base Supabase distante utilisee par `npm run dev`:
  - tables purgees: `lots`, `inventory`, `stock_movements`, `stock_balance`, `sales`, `sale_items`, `sale_item_pieces`, `transactions`
  - tables catalogue preservees: `sets_catalog`, `sets_bom`
- Execution en ecriture distante via API REST Supabase (`service_role`) en respectant l'ordre FK.

### Verifications executees

- Comptages avant purge:
  - `sets_catalog=5618`
  - `sets_bom=99162`
  - `lots=6`
  - `inventory=15`
  - `stock_movements=45`
  - `stock_balance=5`
  - `sales=5`
  - `sale_items=7`
  - `sale_item_pieces=23`
  - `transactions=0`
- Comptages apres purge:
  - `sets_catalog=5618` (inchange)
  - `sets_bom=99162` (inchange)
  - `lots=0`
  - `inventory=0`
  - `stock_movements=0`
  - `stock_balance=0`
  - `sales=0`
  - `sale_items=0`
  - `sale_item_pieces=0`
  - `transactions=0`
- Verifications complementaires:
  - vues `stock_per_piece`, `stock_journal`, `piece_movements`: `0` ligne
  - mouvements restants par type `PURCHASE|SALE|SALE_CANCEL`: `0`

### Perimetre / limites

- Aucun changement de code applicatif ni migration SQL.
- Limite connue: reset global des sequences non execute (absence d'acces SQL direct distant depuis l'environnement); objectif fonctionnel "plus aucun mouvement" atteint.

## 2026-02-17 - F2.4 Auto-attribution LotID a la creation

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`:
  - suppression de la saisie `lotCode` dans le flux de creation (`CreateLotInput` / `NormalizedLot`)
  - ajout d'un calcul serveur `LOT_N` (regex `^LOT_(\\d+)$`, regle `max+1`)
  - attribution automatique de `lot_code` a l'insert
  - ajout d'un retry anti-collision en cas de conflit d'unicite `lots_lot_code_key`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/NewLotDialog.tsx`:
  - suppression du champ `LotID (optionnel)` dans la modale de creation
  - suppression de l'envoi client de `lotCode` vers la server action
  - ajout d'un message UX explicite: le LotID est attribue automatiquement
- Mise a jour docs:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F2.4` ajoute en `FAIT`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (`D-016`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md` (cette entree)

### Verifications executees

- Creation lot sans champ LotID manuel: code attribue automatiquement en `LOT_N`.
- Edition manuelle du `lot_code` post-creation: conservee (flux d'edition inchange).
- Non-regression ciblee:
  - garde-fou lot vide F2.1/F2.2 inchange
  - correctif coherence Qt apres suppression inventory inchange

### Perimetre / limites

- Aucun changement de schema SQL/migration.
- Regle retenue: progression `max+1` globale (pas de reutilisation des trous).

## 2026-02-17 - UX Appro: ligne de tableau cliquable vers le detail lot

Statut: `FAIT`

### Changements realises

- Ajout de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/ClickableRow.tsx`:
  - composant client de navigation ligne entiere (`router.push`) pour les tables Appro.
  - exclusions interactives preservees (`a`, `button`, `input`, `select`, `textarea`, roles bouton/menu, `[data-row-action='true']`).
  - accessibilite clavier conservee (`tabIndex=0`, `Enter`/`Space`).
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/page.tsx`:
  - remplacement de la ligne `<tr>` par `ClickableRow` avec `href=/approvisionnement/[id]`.
  - suppression du lien dedie sur le texte `LotID` (evite la navigation partielle redondante).
  - conservation des boutons `EditLotDialog` et `DeleteLotButton` sans redirection parasite.
  - ajout de `data-row-action=\"true\"` dans la colonne Actions pour expliciter l'exclusion.
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - ajout d'une note de livraison UX sous `F2.4` (ligne cliquable hors actions).

### Verifications executees

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run test:f2.0`: OK (S1..S6 + checks F1.3/F1.4/F1.5 verts)

### Perimetre / limites

- Aucun changement de schema SQL/migration.
- Navigation de ligne en meme onglet (comportement standard `router.push`).
- Les boutons d'action restent prioritaires et fonctionnent comme avant.

## 2026-02-17 - Renumerotation auto des LOT_n apres suppression + protection LOT_0

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`:
  - ajout de la raison metier `LOT_INITIAL_PROTECTED`.
  - blocage serveur explicite de la suppression du lot initial `LOT_0`.
  - ajout d'un helper de renumerotation automatique apres suppression:
    - parse strict des codes `LOT_n` via regex `^LOT_(\\d+)$`
    - pour tout lot avec `k > n`, mise a jour en `LOT_{k-1}`
    - les codes personnalises (hors `LOT_n`) sont ignores.
  - execution de la renumerotation uniquement apres suppression effective du lot cible.
  - mode fail-soft si echec de renumerotation post-suppression:
    - suppression conservee
    - retour `success: true` avec `warning`.
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/DeleteLotButton.tsx`:
  - message UX explicite si tentative de suppression de `LOT_0`.
  - affichage du `warning` non bloquant si la renumerotation echoue apres suppression.
- Mise a jour docs:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (F2.4 enrichi avec renumerotation + protection `LOT_0`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (`D-017`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/HISTORIQUE.md` (cette entree)

### Verifications executees

- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run test:f2.0`: OK (S1..S6 + checks F1.3/F1.4/F1.5 verts)

### Perimetre / limites

- Aucun changement de schema SQL/migration.
- Regle appliquee uniquement aux codes conformes `LOT_n`.
- Edition manuelle de `lot_code` conservee.

## 2026-02-18 - F2.3 Confirmation lot atomique fonctionnelle + extension validation locale

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/action.ts`:
  - durcissement de `updateLotFromDialog` pour le flux `draft -> confirmed` avec snapshot inventory au moment de confirmer.
  - refus explicite si inventory vide/invalide, meme si `lots.total_pieces` est incoherent.
  - recreation des mouvements `PURCHASE/IN` depuis snapshot puis verification de coherence avant changement de statut.
  - garde de conflit sur transition (`update ... where id = ? and status = 'draft'`) avec retour metier explicite.
  - verification post-condition de confirmation:
    - lot en `confirmed`
    - `sum(inventory.quantity)` == `sum(stock_movements PURCHASE/IN)` pour le lot.
  - compensation verifiee en cas d'echec intermediaire (retour en `draft` + nettoyage PURCHASE + verification).
  - ajout de raisons metier explicites:
    - `LOT_CONFIRMATION_CONFLICT`
    - `LOT_CONFIRMATION_INCONSISTENT`
    - `LOT_CONFIRMATION_ROLLBACK_FAILED`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/f2_0_validate_local.mjs`:
  - ajout des scenarios F2.3:
    - S7 confirmation nominale coherente
    - S8 echec intermediaire simule sans etat partiel persistant
    - S9 lot incoherent refuse sans `PURCHASE`
    - S10 contournement UI (lot vide) bloque cote serveur
  - ajout non-regression F2.4:
    - S11 protection `LOT_0`
    - S12 renumerotation `LOT_n` apres suppression
  - ajout d'un check global de coherence des lots confirmes (`inventory == PURCHASE/IN`, aucun lot sans PURCHASE).
- Mise a jour docs:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`: F2.3 passe a `FAIT` avec livrables/DoD realises.
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md`: ajout `D-018`.

### Verifications executees

- Pre-check environnement local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK
  - `npx supabase start`: OK
  - `npx supabase db reset --local`: OK
- Gates techniques:
  - `npm ci`: OK
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK (incluant scenarios F2.3 S7..S10 et non-regressions S11..S12)
- Verification audit npm:
  - `npm audit`: KO (reseau indisponible: `ENOTFOUND registry.npmjs.org`)
  - `npm audit fix`: KO (meme cause reseau)
  - limite explicite: remediation automatique des vulnerabilites npm non finalisable sans acces registre npm.

### Perimetre / limites

- Aucun changement de schema SQL/migration.
- Aucune ecriture distante Supabase.
- Livraison F2.3 validee en local avec compensation fonctionnelle et checks de coherence lot/mouvements.

## 2026-02-18 - F1.6 Hardening securite Supabase + audit npm prod/dev mitigation

Statut: `FAIT` (DB) / `EN COURS` (audit npm live)

### Changements realises

- Ajout de migration SQL:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/migrations/20260218201000_f1_6_security_rls_views.sql`
  - contenu:
    - `ALTER VIEW ... SET (security_invoker = true)` sur:
      - `set_completion`
      - `stock_per_piece`
      - `sold_pieces_journal`
      - `piece_movements`
      - `set_with_completion`
      - `sale_item_movements`
      - `stock_journal`
    - `ENABLE ROW LEVEL SECURITY` sur:
      - `lots`, `inventory`, `sets_bom`, `sets_catalog`, `transactions`
      - `stock_balance`, `sale_items`, `sales`, `stock_movements`, `sale_item_pieces`
    - policies de compatibilite (`FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)`) sur les 10 tables cibles
    - nettoyage grants:
      - vues cibles: `anon/authenticated` en `SELECT` uniquement
      - tables cibles: `anon/authenticated` en `SELECT, INSERT, UPDATE, DELETE`
      - `service_role` inchange
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json`:
  - ajout script `audit:prod`
  - ajout script `audit:deps`
- Mise a jour docs:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (`F0.5`, `F1.6`)
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/DECISIONS.md` (`D-019`)

### Verifications executees

- DB locale / migration:
  - `npx supabase start`: OK
  - `npx supabase db reset --local --debug`: OK (incluant migration `20260218201000_f1_6_security_rls_views.sql`)
- Verifications SQL post-reset (DB locale):
  - RLS active (`relrowsecurity = true`) sur les 10 tables cibles: OK
  - `security_invoker=true` sur les 7 vues cibles: OK
  - policies compat presentes (`anon/authenticated`, `cmd=ALL`) sur les 10 tables: OK
  - privileges:
    - vues cibles: `SELECT` uniquement pour `anon/authenticated`: OK
    - tables cibles: `DELETE, INSERT, SELECT, UPDATE` pour `anon/authenticated`: OK
- Non-regression applicative:
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK
- Audit npm:
  - `npm run audit:deps`: OK (arbre dependances affiche)
  - `npm run audit:prod`: KO environnement (`ENOTFOUND registry.npmjs.org`)
  - tentative d'update non-cassante lint lancee sans `--force`, non finalisable dans cet environnement a cause de l'acces registre npm

### Perimetre / limites

- Aucune ecriture distante Supabase.
- Aucun changement de logique metier applicative.
- Objectif `0 vulnerabilite prod` non verifiable live dans cet environnement (DNS npm indisponible); rerun requis sur terminal connecte au registre npm.

## 2026-02-18 - Migration lint ESLint -> Biome pour sortie npm audit a 0

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json`:
  - suppression de `eslint` et `eslint-config-next`
  - ajout de `@biomejs/biome`
  - remplacement du script `lint`:
    - `lint:biome` -> `biome lint .`
    - `lint:next-img-guard` -> `node scripts/check_no_img_element.mjs`
  - script `audit:deps` rendu informatif (`npm ls ajv @eslint/eslintrc eslint || true`)
- Ajout de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/biome.json`:
  - ignore fichiers alignes avec l'existant (`.next`, `out`, `build`, `next-env.d.ts`, `node_modules`)
  - formatter desactive (pas de reformat global)
  - lint bloqueur configure sur un socle fiabilite avec exclusions ciblees pour eviter un refacto massif
- Ajout de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/scripts/check_no_img_element.mjs`:
  - scan de `src/` a la recherche de nouvelles occurrences `<img>`
  - allowlist stricte des 3 occurrences legacy:
    - `src/components/catalogue/set-image.tsx`
    - `src/app/catalogue/page.tsx`
    - `src/components/catalogue/edit-photo-button.tsx`
  - echec explicite du lint si nouvelle occurrence hors allowlist
- Suppression de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/eslint.config.mjs`.
- Regeneration lockfile via `npm install`:
  - disparition de la chaine `eslint -> @eslint/eslintrc -> ajv`.

### Verifications executees

- Audit dependances:
  - `npm ls ajv @eslint/eslintrc eslint`: `(empty)` (chaine retiree)
  - `npm audit`: `found 0 vulnerabilities`
  - `npm audit --omit=dev --audit-level=moderate`: `found 0 vulnerabilities`
- Gates techniques:
  - `npm ci`: OK (`found 0 vulnerabilities`)
  - `npm run lint`: OK (Biome + guard `<img>`)
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK (non-regression F2.0/F2.3/F2.4 + F1.3/F1.4/F1.5)

### Perimetre / limites

- Aucun changement de logique metier applicative.
- Aucun changement SQL/migration dans cette livraison.
- Le garde-fou Next est volontairement minimal sur `<img>` (controle cible, pas remplacement complet des regles ESLint Next historiques).

## 2026-02-18 - F1.7 Follow-up securite Supabase (healthcheck invoker + search_path functions)

Statut: `FAIT`

### Changements realises

- Ajout de migration SQL:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/supabase/migrations/20260218224500_f1_7_security_followup_healthcheck_functions.sql`
  - contenu:
    - `ALTER VIEW public.healthcheck_business_anomalies_v1 SET (security_invoker = true)`
    - `ALTER FUNCTION ... SET search_path = pg_catalog, public, pg_temp` sur:
      - `public.reset_sales_id_sequence()`
      - `public.apply_stock_balance_from_movements()`
      - `public.apply_stock_balance_delta(text, bigint, bigint)`
      - `public.reject_negative_stock_balance()`
- Mise a jour de:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md` (ajout `F1.7`)
- Aucun changement des policies RLS de compatibilite F1.6 (warnings `rls_policy_always_true` conserves volontairement pour eviter toute regression UX des flux `anon`).

### Verifications executees

- Validation locale:
  - `npx supabase start`: OK
  - `npx supabase db reset --local`: OK (incluant migration `20260218224500_f1_7_security_followup_healthcheck_functions.sql`)
  - SQL local:
    - `healthcheck_business_anomalies_v1` avec `security_invoker=true`: OK
    - `search_path` fige sur les 4 fonctions ciblees: OK
    - policies `p_*_compat_all` presentes: OK
    - lecture `healthcheck_business_anomalies_v1`: OK
    - RPC `reset_sales_id_sequence`: OK
- Deploiement distant:
  - `npx supabase db push --db-url <remote> --dry-run --yes`: OK (migration F1.7 detectee)
  - `npx supabase db push --db-url <remote> --yes`: OK (migration F1.7 appliquee)
  - SQL remote:
    - `security_invoker=true` sur `healthcheck_business_anomalies_v1`: OK
    - `search_path` fige sur les 4 fonctions ciblees: OK
- Linter remote:
  - `npx supabase db lint --db-url <remote> --schema public`: plus d'erreur `security_definer_view` sur `healthcheck_business_anomalies_v1`
  - plus de warning `function_search_path_mutable` sur les 4 fonctions ciblees
  - warnings `rls_policy_always_true` restants attendus (acceptes dans cette phase)
- Gates techniques:
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK

### Perimetre / limites

- Aucun changement d'API frontend/backend.
- Aucun durcissement RLS supplementaire dans cette iteration (intentionnel pour non-regression produit).
- Le traitement des warnings `rls_policy_always_true` est reporte a une phase dediee de durcissement auth/policies.

## 2026-02-18 - F3.1 Contrat query standardise pour /ventes

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/page.tsx`:
  - ajout d'un parseur canonique des query params `/ventes`:
    - `period=total|90|30|7` (defaut `30`)
    - `include_cancelled=true|false` (defaut `true`)
    - `channel` (trim + suppression si vide)
    - `sale_type=SET|PIECE`
    - `sort`, `dir`, `page` avec fallback strict
  - redirection automatique vers URL canonique si valeur invalide/manquante ou cles legacy detectees
  - suppression fonctionnelle des cles legacy `stats_window_*` via canonicalisation
  - alignement des filtres table:
    - `include_cancelled=false` => `status=CONFIRMED`
    - `channel`, `sale_type`, `sort`, `dir`, `page`
  - alignement des KPIs:
    - exclusion stricte `CANCELLED`
    - application de `period`
    - application de `channel` et `sale_type`
  - compteurs en-tete alignes sur les filtres actifs de la table
  - transmission d'un `baseQuery` canonique a `SalesTable` pour conserver les filtres dans tri/pagination
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SalesStatCardWithDialog.tsx`:
  - remplacement du modele `stats_window_*` par un unique parametre `period`
  - options periode unifiees: `Total`, `90`, `30`, `7`
  - UI conservee (cards + dialog), sans ajout de barre de filtres
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/sales.ts`:
  - convergence API listage vers `sale_type` (compat legacy `type` conservee)
  - documentation interne corrigee: inclusion des statuts par defaut et filtrage explicite via `status`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - `Phase 3` passe en `EN COURS`
  - `F3.1` passe en `FAIT` avec livrables et fallback documentes

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
- Validation DB locale:
  - `npx supabase start`: OK
  - `npx supabase db reset --local`: OK (baseline + F1.3/F1.4/F1.5/F1.6/F1.7 + seed)
- Gates techniques:
  - `npm ci`: OK (`found 0 vulnerabilities`)
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK (non-regression F2.x + checks F1.3/F1.4/F1.5)
- Scenarios F3.1 verifies via serveur local + `curl`:
  - S1 `/ventes` => `307` vers URL canonique `period=30&include_cancelled=true&sort=paid_at&dir=desc&page=1`
  - S2 `period=7` / `period=total` => valeur `period` bien propagee au SSR des cards KPI
  - S3 `include_cancelled=false` vs `true` => statuts visibles differents (confirmes seuls vs confirmes + annulees)
  - S4 `channel` + `sale_type` => filtres appliques a la table (rows vides si combinaison sans resultats) et KPIs alignes
  - S5 tri/pagination => liens reconstruits en conservant les filtres actifs (`period/include_cancelled/channel/sale_type`)
  - S6 params invalides (`period=999`, `dir=up`, `sort=bad`, etc.) => fallback + redirection canonique
  - S7 navigation detail conservee (table rendue avec lignes cliquables; verification fonctionnelle UX non regressive)
- Verifications SQL post-implementation:
  - `stock_balance.quantity < 0`: `0`
  - vues lisibles: `stock_per_piece`, `stock_journal`, `piece_movements` => OK
  - `healthcheck_business_anomalies_v1`: `0`
  - coherence lots confirmes (`inventory` vs `PURCHASE/IN`): `0` mismatch

### Perimetre / limites

- Aucun changement SQL/migration dans cette livraison F3.1.
- Aucun changement DB distante; validations effectuees en local uniquement.
- Aucun secret sensible ajoute au repo.

## 2026-02-19 - F3.2 Centralisation data `/ventes` via `getSalesPageData(filters)`

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/sales.ts`:
  - ajout des types du contrat unifie:
    - `SalesPageFilters`
    - `SalesPageData`
    - types associes table/KPIs/deltas/compteurs
  - ajout de `getSalesPageData(filters, client?)`:
    - centralisation listing table (`listSalesForTable`) avec tri/pagination/filtres existants
    - centralisation KPIs (`CA net`, `marge`, `taux`, commandes `SET`/`PIECE`)
    - centralisation deltas comparatifs (logique existante preservee)
    - centralisation compteurs en-tete (`confirmed`, `cancelled`, total liste)
    - fallback preserve:
      - erreurs KPI/count => fallback visible (0/`—`) sans crash
      - erreur listing => echec explicite
  - ajout d'une garde pagination pour eviter un crash sur page hors plage (`page` trop grande):
    - detection fallback et retour table vide au lieu d'un `500`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/page.tsx`:
  - conservation du contrat query F3.1 (normalisation + redirection canonique + `baseQuery`)
  - suppression de la logique KPI/deltas/compteurs/pagination dispersee
  - consommation unique de `getSalesPageData(...)` avec `supabaseServer`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - `F3.2` passe en `FAIT` avec livrables traces

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK
  - `npx supabase start`: OK
- Validation DB locale:
  - `npx supabase db reset --local`: OK
    - tentative 1: KO transitoire (`Error status 502`)
    - relance immediate: OK
- Gates techniques:
  - `npm ci`: OK (`found 0 vulnerabilities`)
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK (non-regressions F2.x + checks F1.3/F1.4/F1.5)
- Scenarios fonctionnels `/ventes` (serveur local + `curl`):
  - S1 `/ventes` sans query: `307` vers URL canonique
    - `/ventes?period=30&include_cancelled=true&sort=paid_at&dir=desc&page=1`
  - S2 filtres `period/include_cancelled/channel/sale_type`: OK (rendu KPI + table coherent, rows vides attendues si filtre sans resultat)
  - S3 tri/pagination: OK (liens de tri conservent les filtres; `page` hors plage renvoie `200` avec table vide, pas de crash)
  - S4 params invalides (`period=999`, `dir=up`, `sort=bad`, `page=0`, legacy `stats_window_*`): `307` vers fallback canonique
  - S5 navigation detail vente:
    - table cliquable (row `tabindex=\"0\"` presente)
    - route detail `/ventes/1`: `200`
- Verifications SQL post-implementation:
  - `stock_balance.quantity < 0`: `0`
  - vues lisibles:
    - `stock_per_piece`: OK
    - `stock_journal`: OK
    - `piece_movements`: OK
  - `healthcheck_business_anomalies_v1`: `0`
  - coherence lots confirmes (`inventory` vs `PURCHASE/IN`): `0` mismatch

### Perimetre / limites

- Aucun changement SQL/migration dans cette livraison F3.2.
- Aucun changement DB distante (local uniquement).
- Aucune decision structurante nouvelle: pas de mise a jour `docs/DECISIONS.md`.
- Aucun secret sensible ajoute au repo.

## 2026-02-19 - Pivot KPI tableau-first + simplification cards + filtre dates Ventes/Approvisionnement

Statut: `FAIT`

### Changements realises

- Cette livraison supersede la strategie KPI precedente basee sur `period` / `stats_window_*`:
  - KPI des cards alignes strictement au perimetre des lignes du tableau courant (strategie tableau-first)
  - cards simplifiees en mode `libelle + valeur` (sans tendance/periode embarquee)
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/sales.ts`:
  - extension `SalesPageFilters` avec `from` / `to`
  - normalisation/canonicalisation des bornes de dates
  - KPI alignes au perimetre du tableau filtre
  - `deltas` conserves dans le contrat data pour compatibilite, neutralises cote UI
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/page.tsx`:
  - URL canonique active sans `period` (legacy redirige)
  - ajout du filtre compact `Du/Au` (GET) applique au tableau et aux KPI
  - cards KPI simplifiees
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/page.tsx`:
  - URL canonique active sans `stats_window_*` (legacy redirige)
  - ajout du filtre compact `Du/Au` (GET) applique au tableau et aux KPI
  - KPI derives du meme perimetre que les lignes affichees
  - verification `LOT_0` conservee globale (hors filtre date) pour eviter toute recreation incorrecte
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/stock/page.tsx`:
  - cards KPI simplifiees (libelle + valeur), sans mecanique de tendance/periode

### Verifications executees

- Gates techniques:
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK
- Controles HTTP canoniques:
  - `307` attendu sur parametres legacy (`period`, `stats_window_*`) vers URL canonique
  - `307` attendu sur bornes inversees (`from > to`) avec inversion automatique appliquee

### Perimetre / limites

- Aucun changement SQL/migration/seed.
- Aucune ecriture sur DB distante.
- `period` et `stats_window_*` maintenus uniquement comme legacy redirige.

## 2026-02-19 - F3.4 Controle explicite du statut `include_cancelled` sur `/ventes`

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/page.tsx`:
  - ajout d'un controle UI explicite en 2 modes pour piloter `include_cancelled`:
    - `Inclure annulees` -> `include_cancelled=true`
    - `Exclure annulees` -> `include_cancelled=false`
  - reconstruction des liens statut en conservant le contexte actif:
    - `channel`, `sale_type`, `sort`, `dir`, `from`, `to`
    - reset pagination force a `page=1` sur bascule de statut
  - conservation stricte de la canonicalisation SSR existante (contrat query F3.1 inchange)
  - conservation du filtre date compact existant (propagation `include_cancelled` maintenue)
  - ajustement en-tete:
    - mode `include_cancelled=true`: total + confirmees + annulees
    - mode `include_cancelled=false`: indicateur `annulees` masque
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - `F3.4` passe de `EN COURS` a `FAIT`
  - livrables UI / pagination / preservation contexte documentes

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
- Validation DB locale:
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local`: OK (migrations + seed)
- Gates techniques:
  - `npm ci`: OK (`found 0 vulnerabilities`)
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK (non-regressions F2.x + checks F1.3/F1.4/F1.5)
- Scenarios fonctionnels `/ventes` (serveur local + `curl`):
  - S1 `/ventes` sans query: `307` vers URL canonique
    - `/ventes?include_cancelled=true&sort=paid_at&dir=desc&page=1`
  - S2 bascule statut UI:
    - controle `Inclure annulees` / `Exclure annulees` visible
    - en mode exclusion, le bloc en-tete ne rend plus la section `annulees`
  - S3 preservation contexte:
    - liens de bascule statut conservent `channel`, `sale_type`, `sort`, `dir`, `from`, `to`
    - `page` force a `1` sur la bascule
  - S4 params invalides (`include_cancelled=maybe`, `sort=bad`, `dir=up`, `page=0`, dates invalides):
    - `307` vers fallback canonique
  - S5 navigation detail:
    - ligne table focusable (`tabindex=\"0\"`)
    - route detail testee: `/ventes/21` -> `200`
- Verifications SQL post-implementation (local REST):
  - `stock_balance.quantity < 0`: `0`
  - vues lisibles:
    - `stock_per_piece`: HTTP `200`
    - `stock_journal`: HTTP `200`
    - `piece_movements`: HTTP `200`
  - `healthcheck_business_anomalies_v1`: `0`
  - coherence lots confirmes:
    - `inventory` vs `PURCHASE/IN` mismatch: `0`
    - lots confirmes sans `PURCHASE/IN`: `0`

### Perimetre / limites

- Aucun changement SQL/migration/seed.
- Aucun changement de schema sur DB distante.
- Aucune decision structurante nouvelle: pas de mise a jour `docs/DECISIONS.md`.

## 2026-02-19 - F3.5 Unifier l'entree `Nouvelle vente` via `/ventes` + pop-up

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/nouvelle/page.tsx`:
  - suppression du rendu page dediee
  - redirection serveur directe vers `/ventes?new=1`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/page.tsx`:
  - extension de la canonicalisation query SSR avec support de l'intent `new=1`
  - `new` accepte uniquement la valeur `1` (toute autre valeur est supprimee par canonicalisation)
  - propagation de `new=1` dans les liens SSR (`bascule statut`, `reset date`, filtre GET, tri/pagination via `baseQuery`) tant que l'intent est actif
  - conservation stricte du contrat F3.1/F3.4 pour `include_cancelled`, `channel`, `sale_type`, `sort`, `dir`, `page`, `from`, `to`
  - ouverture de la modale via `NewSaleDialog openFromIntent={normalized.newIntent}`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/NewSaleDialog.tsx`:
  - ouverture automatique de la modale quand l'intent URL `new=1` est present
  - fermeture manuelle: nettoyage URL (suppression de `new`) sans perdre les autres query params
  - soumission reussie (`onDone`): fermeture modale + nettoyage URL + `router.refresh()`
  - conservation du bouton `Nouvelle vente` et du flux local existant quand `new` est absent
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - `F3.5` passe de `EN COURS` a `FAIT`
  - livrables F3.5 traces dans la section dediee

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
- Validation DB locale:
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local`: OK (baseline + F1.3/F1.4/F1.5/F1.6/F1.7 + seed)
- Gates techniques:
  - `npm ci`: OK (`found 0 vulnerabilities`)
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK (S1..S12 + checks F1.3/F1.4/F1.5)
- Verification des scenarios F3.5:
  - tentative d'automatisation HTTP/UI via `npm run dev` + `curl`: KO environnement sandbox
    - erreur observee: `listen EPERM: operation not permitted 0.0.0.0:3000`
  - preuves locales de comportement (lecture code):
    - redirection `/ventes/nouvelle` -> `/ventes?new=1`: OK
    - canonicalisation `new=1` preservee sur `/ventes`: OK
    - ouverture/fermeture/succes pilotes par intent URL dans `NewSaleDialog`: OK
- Verifications SQL post-implementation (via `test:f2.0`):
  - `stock_balance.quantity < 0`: `0`
  - vues lisibles: `stock_per_piece`, `stock_journal`, `piece_movements`
  - `healthcheck_business_anomalies_v1`: `0`
  - coherence `inventory` vs `PURCHASE/IN` pour lots confirmes: OK
- Controle local REST lecture seule complementaire:
  - `stock_balance_negative_count=0`
  - `healthcheck_anomalies_count=0`
  - `stock_per_piece_http=200`
  - `stock_journal_http=200`
  - `piece_movements_http=200`

### Perimetre / limites

- Aucun changement SQL/migration/seed dans cette livraison F3.5.
- Aucune ecriture sur DB distante.
- `src/app/ventes/nouvelle/NewSaleForm.tsx` non modifie (pas necessaire pour F3.5).
- Verification UI finale des scenarios F3.5 a realiser en manuel sur un poste autorisant `npm run dev` (script manuel fourni dans le rendu de livraison).

## 2026-02-19 - F3.6 Finaliser audit interne sans page globale pieces vendues

Statut: `FAIT`

### Changements realises

- Suppression des composants UI legacy non branches:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SoldPiecesTable.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SaleDetailDialog.tsx`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/[id]/page.tsx`:
  - passage en `notFound()` sur vente introuvable (suppression de l'ecran debug JSON)
- Aucun changement de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/page.tsx` (contrat query conserve)
- Aucun changement de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/ventes/[id]/[saleItemId]/page.tsx` (message minimal snapshot vide conserve)
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - `F3.6` passe de `EN COURS` a `FAIT`
  - livrables traces (suppression legacy + 404 detail + non-regression contrat query)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
- Validation DB locale:
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local`: OK (migrations F1.1/F1.3/F1.4/F1.5/F1.6/F1.7 + seed)
- Gates techniques:
  - `npm ci`: OK (`found 0 vulnerabilities`)
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK (S1..S12 + checks F1.3/F1.4/F1.5)
    - note scenario S8: log attendu de conflit `lots_lot_code_key` (cas rollback), puis scenario valide
- Verifications SQL post-implementation (REST local lecture seule):
  - `stock_balance_negative_raw=[]`
  - `stock_per_piece_http=200`
  - `stock_journal_http=200`
  - `piece_movements_http=200`
  - `healthcheck_raw=[]`
- Verification fonctionnelle `/ventes` (serveur local + `curl`):
  - S1 canonicalisation `/ventes`: `307` vers `/ventes?include_cancelled=true&sort=paid_at&dir=desc&page=1`
  - S2 detail commande: `/ventes/21` -> `200`
  - S3 drilldown item set: `/ventes/21/43` -> `200`
  - S4 pas de route globale active "pieces vendues": `/ventes/pieces-vendues` -> `404`
  - S5 IDs invalides:
    - `/ventes/999999` -> `404`
    - `/ventes/21/999999` -> `404`
  - S6 non-regression filtres:
    - query valide `include_cancelled/channel/sale_type/sort/dir/page/from/to` -> `200`
    - query invalide -> `307` vers URL canonique
  - S7 non-regression globale: `npm run test:f2.0` -> OK

### Perimetre / limites

- Aucun changement SQL/migration/seed dans F3.6.
- Aucune ecriture sur DB distante.
- Aucune nouvelle decision structurante: `docs/DECISIONS.md` non modifie.

## 2026-02-19 - F3.7 Nettoyage des composants KPI legacy non utilises

Statut: `FAIT`

### Changements realises

- Suppression des composants KPI legacy orphelins:
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/sales/SalesStatCardWithDialog.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/components/dashboard/StatCardWithDialog.tsx`
  - `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/approvisionnement/ApproStatsSection.tsx`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - `F3.7` passe de `A FAIRE` a `FAIT`
  - correction du chemin cible vers `src/app/approvisionnement/ApproStatsSection.tsx`
  - `Phase 3` passe de `EN COURS` a `FAIT`
- Verification explicite:
  - plus aucune reference active aux composants KPI legacy supprimes
  - les routes actives conservent les composants KPI actuels:
    - `SalesStatCard` (`/ventes`, `/approvisionnement`, `/stock`, details `/ventes/[id]`)
    - `DashboardStatCard` (`/historique-stock`)

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
- Validation references F3.7:
  - `rg -n "SalesStatCardWithDialog|StatCardWithDialog|ApproStatsSection" src`: OK (0 resultat)
  - `rg -n "SalesStatCard|DashboardStatCard" src/app`: OK (usages actifs attendus)
- Validation DB locale:
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local`: OK (migrations F1.1/F1.3/F1.4/F1.5/F1.6/F1.7 + seed)
- Gates techniques:
  - `npm ci`: OK (`found 0 vulnerabilities`)
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK (S1..S12 + checks F1.3/F1.4/F1.5)
    - note scenario S8: log attendu de conflit `lots_lot_code_key` (cas rollback), puis scenario valide
- Verifications SQL post-implementation (via `npm run test:f2.0`):
  - `stock_balance.quantity < 0`: `0`
  - vues lisibles: `stock_per_piece`, `stock_journal`, `piece_movements`
  - `healthcheck_business_anomalies_v1`: `0`
  - coherence `inventory` vs `PURCHASE/IN` pour lots confirmes: OK

### Perimetre / limites

- Aucun changement SQL/migration/seed dans F3.7.
- Aucune ecriture sur DB distante.
- Aucune nouvelle decision structurante: `docs/DECISIONS.md` non modifie.

## 2026-02-19 - F4.1 Creer `src/lib/dashboard.ts` (contrat dashboard v1)

Statut: `FAIT`

### Changements realises

- Creation de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/lib/dashboard.ts`:
  - contrat data typé stable `dashboard.v1` pour la future UI dashboard (F4.2)
  - types exportes:
    - `DashboardDateRangeInput`
    - `DashboardDateRange`
    - `DashboardMetric`
    - `DashboardIssueCode`
    - `DashboardData`
  - fonctions exportees:
    - `normalizeDashboardDateRange(input?)`
    - `getDashboardData(client, input?)`
  - filtres/contrat `filters` inclus:
    - `from`, `to`, `mode` (`GLOBAL|RANGE`)
    - `salesStatus='CONFIRMED_ONLY'`
    - `procurementScope='CONFIRMED_LOTS'`
  - agregats centralises:
    - `netRevenue` (CA net ventes confirmees)
    - `netMargin` (marge nette, fallback `net - cost` si `total_margin_amount` null)
    - `stockValue` (snapshot somme `stock_per_piece.total_value`)
    - `procurementCost` (somme `lots.total_cost` sur lots `confirmed`)
  - fallback non bloquant par metrique:
    - `quality='partial'`
    - `issue` explicite
    - `partial` global + `issues` dedupliques
  - pagination defensive des aggregations (chunks de `1000`) pour respecter `supabase/config.toml` (`api.max_rows=1000`)
- Aucun changement de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/page.tsx` (placeholder dashboard conserve, F4.2 hors scope)
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - `Phase 4` passe de `A FAIRE` a `EN COURS`
  - `F4.1` passe de `A FAIRE` a `FAIT`
  - livrables realises F4.1 detailles

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
- Validation DB locale:
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local`: OK (migrations F1.1/F1.3/F1.4/F1.5/F1.6/F1.7 + seed)
- Verifications contrat F4.1:
  - presence exports types/fonctions dans `src/lib/dashboard.ts`: OK (`rg`)
  - `normalizeDashboardDateRange`:
    - global par defaut: `from=null`, `to=null`, `mode=GLOBAL`
    - inversion auto `from > to`: OK
    - date invalide ignoree: OK
  - execution `getDashboardData` sur client mock (sans I/O reseau): OK
    - calculs `netRevenue/netMargin/stockValue/procurementCost`: conformes
    - fallback partiel force (`SALES_DATA_UNAVAILABLE`): conforme (`partial=true`, metrics degradees)
- Coherence agregats metier (SQL local en lecture):
  - global (`sales CONFIRMED`, `lots confirmed`, `stock_per_piece`):
    - `net_revenue=10.0000`
    - `net_margin=8.7000`
    - `stock_value=7.1000`
    - `procurement_cost=8.4000`
  - periode bornee `2026-02-14`:
    - `net_revenue=10.0000`
    - `net_margin=8.7000`
    - `stock_value=7.1000` (snapshot non borne)
    - `procurement_cost=8.4000`
- Verifications SQL post-implementation:
  - `stock_balance.quantity < 0`: `0`
  - vues lisibles:
    - `stock_per_piece`: `2` lignes
    - `stock_journal`: `4` lignes
    - `piece_movements`: `4` lignes
  - `healthcheck_business_anomalies_v1`: `0` anomalie
  - coherence lots confirmes:
    - `inventory` vs `PURCHASE/IN` mismatch: `0`
    - lots confirmes sans `PURCHASE/IN`: `0`
- Gates techniques:
  - `npm ci`: OK (`found 0 vulnerabilities`)
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
  - `npm run test:f2.0`: OK (S1..S12 + checks F1.3/F1.4/F1.5)
    - note scenario S8: log attendu de conflit `lots_lot_code_key` (cas rollback), puis scenario valide

### Perimetre / limites

- Aucun changement SQL/migration/seed dans F4.1.
- Aucune ecriture sur DB distante.
- Aucun changement F4.2/F4.3+.
- `docs/DECISIONS.md` non modifie (pas de decision structurante supplementaire formalisee dans cette livraison).

## 2026-02-19 - F4.2 Remplacer le placeholder dashboard `/`

Statut: `FAIT`

### Changements realises

- Reecriture complete de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/src/app/page.tsx`:
  - suppression de tous les placeholders statiques/fictifs
  - route dynamique forcee (`dynamic = "force-dynamic"`)
  - contrat URL canonique sur `/`:
    - params supportes `from`, `to` uniquement
    - normalisation `YYYY-MM-DD` + inversion auto `from > to`
    - redirection SSR vers URL canonique (suppression params hors contrat)
  - branchement DB reel via:
    - `getDashboardData(...)`
    - client serveur `supabaseServer`
  - rendu des 4 KPI consolides reels:
    - `CA net`
    - `Marge nette`
    - `Valeur stock`
    - `Cout approvisionnements`
  - cards KPI cliquables (details F4.2):
    - definition metier
    - periode active
    - scope de calcul
    - etat qualite + issue eventuelle
    - renvoi explicite au filtre global `from/to`
  - filtre periode global partage (panneau `Filtrer`, `Du/Au`, `Appliquer`, `Reinitialiser`)
  - gestion explicite des donnees partielles:
    - bandeau visible si `partial=true`
    - mapping des `issues` en messages metier
    - affichage `—` sur KPI partiel (pas de faux `0`)
  - ajout des acces rapides vers:
    - `/approvisionnement`
    - `/ventes`
    - `/stock`
    - `/catalogue`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/docs/ROADMAP.md`:
  - `F4.2` passe de `A FAIRE` a `FAIT`
  - livrables F4.2 detailles

### Verifications executees

- Pre-check local:
  - `npx supabase --version`: OK (`2.65.10`)
  - `docker info --format '{{.ServerVersion}}'`: OK (`29.2.0`)
  - `npx supabase status`: OK (stack locale active)
- Validation DB locale:
  - `npx supabase start`: OK (stack deja active)
  - `npx supabase db reset --local`: OK (migrations F1.1/F1.3/F1.4/F1.5/F1.6/F1.7 + seed)
- Gates techniques:
  - `npm ci`: OK (`found 0 vulnerabilities`)
  - `npm run lint`: OK
  - `npm run typecheck`: OK
  - `npm run build`: OK
    - route dashboard racine compilee en SSR dynamique (`ƒ /`)
  - `npm run test:f2.0`: OK (S1..S12 + checks F1.3/F1.4/F1.5)
    - note scenario S8: log attendu de conflit `lots_lot_code_key` (cas rollback), puis scenario valide
- Verifications SQL post-implementation (via `npm run test:f2.0`):
  - `stock_balance.quantity < 0`: `0`
  - vues lisibles: `stock_per_piece`, `stock_journal`, `piece_movements`
  - `healthcheck_business_anomalies_v1`: `0`
  - coherence `inventory` vs `PURCHASE/IN` pour lots confirmes: OK

### Perimetre / limites

- Aucun changement SQL/migration/seed dans F4.2.
- Aucune ecriture sur DB distante.
- Aucun changement F4.3+ (pas de visualisations/tendances/split avances).
- `docs/DECISIONS.md` non modifie (aucune decision structurante supplementaire).
- Validation UI HTTP automatisee sur `npm run dev` non executable dans le sandbox actuel (`listen EPERM`); controles manuels `npm run dev` requis pour les scenarios UX finaux.

## 2026-02-20 - Stabilisation demarrage dev local (Turbopack + Webpack)

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json`:
  - conservation de `dev: next dev`
  - ajout de `dev:webpack: next dev --webpack`
  - ajout de `dev:turbo: next dev --turbopack`
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/README.md`:
  - ajout d'un fallback explicite `npm run dev:webpack` si `npm run dev` reste bloque sur `Starting...`
  - documentation des commandes `dev`, `dev:webpack`, `dev:turbo`

### Verifications executees

- `npm run dev:webpack`:
  - serveur `Ready`
  - reponse HTTP locale OK (`307` sur `/`)
- `npm run dev:turbo`:
  - reproduction du comportement bloque (`Starting...`) observe localement

### Perimetre / limites

- Aucun changement API/UI metier.
- Aucun changement SQL/migration/seed.
- Aucune ecriture sur DB distante.

## 2026-02-20 - Basculer `npm run dev` vers webpack par defaut

Statut: `FAIT`

### Changements realises

- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/package.json`:
  - `dev` passe de `next dev` a `next dev --webpack`
  - conservation de `dev:webpack` (alias explicite stable)
  - conservation de `dev:turbo` (Turbopack pour debug)
- Mise a jour de `/Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager/README.md`:
  - `npm run dev` documente comme mode stable par defaut (webpack)
  - `npm run dev:turbo` documente comme commande de diagnostic Turbopack

### Verifications executees

- `npm run dev`:
  - demarre en mode webpack (`Next.js 16.1.6 (webpack)`)
  - serveur `Ready`
  - reponse HTTP locale OK (`307` sur `/`)
- `npm run dev:turbo`:
  - reproduction du blocage local connu (`Starting...` sans reponse HTTP sous 40s)

### Perimetre / limites

- Aucun changement API/UI metier.
- Aucun changement SQL/migration/seed.
- Aucune ecriture sur DB distante.
