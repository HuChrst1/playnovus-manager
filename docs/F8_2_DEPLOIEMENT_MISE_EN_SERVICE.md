# F8.2 - Deploiement du logiciel (mise en service)

Date: 2026-02-24  
Statut lot: `FAIT`  
Decision release courante: `GO`  
Perimetre: Phase 8 / F8.2 uniquement (mise en service production, sans glissement F8.1/F8.3)

## 1) Cadrage F8.2

Objectif:
- executer la mise en service production du SaaS
- verifier la disponibilite des parcours metier critiques post-deploiement
- produire une decision explicite `GO/NO_GO` avec preuves horodatees

Contraintes appliquees:
- aucun secret en clair dans docs/repo
- aucune ecriture DB distante DDL/DML
- preservation des garde-fous F2.0/F7.1/F7.2/F7.3/F7.4/F7.5/F8.1
- priorite operationnelle: reduction maximale du risque

## 2) Preuves d'execution locale (pre-release)

Pre-check runtime:
- `npx supabase --version` -> `2.65.10` (`PASS`)
- `docker info --format '{{.ServerVersion}}'` -> `29.2.0` (`PASS`)
- `npx supabase status` -> stack locale active (`PASS`)
- `npx supabase start` -> stack deja active (`PASS`)
- `npx supabase db reset --local` -> migrations + seed executes (`PASS`)

Campagne qualite/tests:
- `npm ci` -> `PASS`
- `npm run lint` -> `PASS`
- `npm run typecheck` -> `PASS`
- `npm run build` -> `PASS`
- `npm run test` -> `PASS`
- `npm run test:f2.0` -> `PASS`
- `npm run test:f7.3:pre` -> `PASS`
- `npm run test:f7.3:post` -> `PASS`
- `npm run test:f7.4` -> `PASS` (`decision=GO`)
- `npm run test:f7.5` -> `PASS` (`decision=GO`)
- `npm run test:f8.1` -> `PASS` (`decision=GO`)
- `npm run lint:ui-contrast` -> `PASS`
- `npm run audit:prod` -> `PASS` (`0 vulnerability`)
- `npm run audit:deps` -> `PASS` (`(empty)`)

Notes:
- un echec transitoire `npm run audit:prod` (DNS sandbox) a ete resolu par rerun hors sandbox (`PASS`).
- un echec transitoire de `npm run test` a ete observe uniquement sur lock `.next` lors d'une execution parallele de `build`; rerun sequentiel `PASS`.

## 3) Preuves hosted (post-deploy, lecture seule)

URL cible observee:
- `https://playnovus-manager.vercel.app` (reponses `server: Vercel`)

Controles de disponibilite:
- `GET /` -> `307` vers `/login` (`PASS`)
- `GET /login` -> `200` (`PASS`)
- `GET /forgot-password` -> `200` (`PASS`)
- `GET /catalogue` -> `307` vers `/login` (`PASS`)
- `GET /approvisionnement` -> `307` vers `/login` (`PASS`)
- `GET /ventes` -> `307` vers `/login` (`PASS`)
- `GET /stock` -> `307` vers `/login` (`PASS`)
- `GET /historique-stock` -> `307` vers `/login` (`PASS`)

Controles Auth/CAPTCHA:
- page login contient `captchaToken` + message "Complete le CAPTCHA pour activer la connexion." (`PASS`)
- bouton `Se connecter` desactive avant validation CAPTCHA (`PASS`)
- flux login sans CAPTCHA via `POST` automatique: `PASS` (validation utilisateur sur environnement production)
- login valide avec credentials production: `PASS` (validation utilisateur sur environnement production)
- flux forgot/reset declenchable: `PASS` (validation utilisateur sur environnement production)

Controles API CORS/auth:
- origin non autorisee -> `403` + `{"error":"Origin non autorisee."}` (`PASS`)
- origin autorisee sans session -> `401` + `{"error":"Aucune session active detectee."}` (`PASS`)

## 4) Controles F8.2 et decision

| control_id | command | expected | observed | status |
|---|---|---|---|---|
| F82_C1_branch_main_aligned | source deployment Vercel | deployment production rattache a `main` | preuve utilisateur dashboard: source `main` + commit `f0f2cfc` | PASS |
| F82_C2_pre_release_local_matrix | campagne locale complete | tous les checks locaux verts | campagne complete `PASS` | PASS |
| F82_C3_prod_url_reachable | `GET /login` | `200` | `200` | PASS |
| F82_C4_smoke_routes_protected | `GET` routes metier | redirection login sans session | `307 /login` sur routes critiques | PASS |
| F82_C5_cors_forbidden_origin | `GET /api/sets/.../bom-stock` avec origin interdite | `403` | `403` | PASS |
| F82_C6_cors_allowed_no_session | `GET /api/sets/.../bom-stock` origin autorisee sans session | `401` | `401` | PASS |
| F82_C7_login_requires_captcha | lecture HTML login | blocage sans captcha visible | prompt captcha + submit desactive | PASS |
| F82_C8_prod_deploy_triggered | action Vercel deploy/redeploy | deployment lance | preuve utilisateur dashboard: deployment production cree | PASS |
| F82_C9_prod_deploy_success | statut deployment control-plane | `SUCCESS` | preuve utilisateur dashboard: status `Ready` (Production) | PASS |
| F82_C10_hosted_env_vars_verified | lecture env vars hebergees (sans valeurs) | 6 variables critiques presentes | validation utilisateur explicite: variables critiques production presentes | PASS |
| F82_C11_turnstile_hostnames_prod | lecture hostnames widget prod | conformes domaine prod | validation utilisateur explicite: Turnstile actif et conforme | PASS |
| F82_C12_login_valid_credentials | login prod valide | authentification fonctionnelle | validation utilisateur explicite: smoke auth complet valide | PASS |
| F82_C13_forgot_reset_trigger | declenchement flux reset | flux declenchable | validation utilisateur explicite: smoke auth complet valide | PASS |
| F82_C14_rollback_promotion_test | promotion dernier deployment stable | rollback actionnable teste | validation utilisateur explicite: procedure rollback validee | PASS |

Decision F8.2:
- politique: `strict_go_only_if_all_critical_pass`
- decision: `GO`
- raison: tous les controles critiques F8.2 sont a `PASS` (preuves locales + validations utilisateurs hebergees)

## 5) Script A (manuel, local) - Controle F8.2

Objectif:
- produire une preuve locale reproductible pre-release F8.2

```bash
#!/usr/bin/env bash
set -euo pipefail

TS_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
CP="pre-release"

log() {
  # format: timestamp_utc | checkpoint | control_id | command | expected | observed | status | decision | observation
  printf "%s | %s | %s | %s | %s | %s | %s | %s | %s\n" \
    "$TS_UTC" "$CP" "$1" "$2" "$3" "$4" "$5" "$6" "$7"
}

run_ok() {
  local id="$1"; shift
  local cmd="$1"; shift
  local expected="$1"; shift
  local out
  out="$(eval "$cmd" 2>&1 | tail -n 1)"
  log "$id" "$cmd" "$expected" "$out" "PASS" "GO" "ok"
}

run_ok "A1_supabase_version" "npx supabase --version" "Supabase CLI disponible"
run_ok "A2_docker_info" "docker info --format '{{.ServerVersion}}'" "Docker disponible"
run_ok "A3_supabase_status" "npx supabase status >/dev/null && echo stack_up" "stack Supabase locale active"
run_ok "A4_supabase_start" "npx supabase start >/dev/null && echo started" "stack locale demarree"
run_ok "A5_db_reset_local" "npx supabase db reset --local >/dev/null && echo reset_ok" "reset local OK"

run_ok "A6_npm_ci" "npm ci >/dev/null && echo ci_ok" "dependencies installees"
run_ok "A7_lint" "npm run lint >/dev/null && echo lint_ok" "lint vert"
run_ok "A8_typecheck" "npm run typecheck >/dev/null && echo typecheck_ok" "typecheck vert"
run_ok "A9_build" "npm run build >/dev/null && echo build_ok" "build vert"
run_ok "A10_test" "npm run test >/dev/null && echo test_ok" "tests verts"
run_ok "A11_test_f20" "npm run test:f2.0 >/dev/null && echo f20_ok" "gate F2.0 vert"
run_ok "A12_test_f73_pre" "npm run test:f7.3:pre >/dev/null && echo f73pre_ok" "gate F7.3 pre vert"
run_ok "A13_test_f73_post" "npm run test:f7.3:post >/dev/null && echo f73post_ok" "gate F7.3 post vert"
run_ok "A14_test_f74" "npm run test:f7.4 >/dev/null && echo f74_ok" "gate F7.4 vert"
run_ok "A15_test_f75" "npm run test:f7.5 >/dev/null && echo f75_ok" "gate F7.5 vert"
run_ok "A16_test_f81" "npm run test:f8.1 >/dev/null && echo f81_ok" "gate F8.1 vert"
run_ok "A17_lint_contrast" "npm run lint:ui-contrast >/dev/null && echo contrast_ok" "audit contraste vert"
run_ok "A18_audit_prod" "npm run audit:prod >/dev/null && echo auditprod_ok" "audit prod vert"
run_ok "A19_audit_deps" "npm run audit:deps >/dev/null && echo auditdeps_ok" "audit deps vert"
```

## 6) Script B (manuel, remote) - Deploy + verification + rollback

Objectif:
- executer F8.2 avec preuves sans exposer de secret

Etapes:
1. Vercel deployment:
  - confirmer `main` + commit cible
  - lancer redeploy production du commit cible
  - capturer deployment id + status final `SUCCESS`
2. Verification env hosted (sans valeurs):
  - confirmer presence de:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
    - `SUPABASE_AUTH_CAPTCHA_SECRET`
    - `APP_ALLOWED_ORIGINS`
3. Verification Supabase Auth hosted:
  - `site_url` + redirect URLs alignes domaine prod
  - CAPTCHA active
4. Verification Turnstile:
  - hostnames prod exacts
  - widget prod associe au domaine cible
5. Smoke checks post-deploy:
  - `/login`, `/forgot-password`, `/catalogue`, `/approvisionnement`, `/ventes`, `/stock`, `/historique-stock`
  - CORS/API: origin interdite `403`, origin autorisee sans session `401`
6. Rollback testable:
  - promouvoir dernier deployment stable
  - valider mini-smoke (`/login`, `/catalogue`, `/ventes`, `/stock`, CORS)
7. Decision:
  - `GO` si tous controles critiques `PASS`
  - sinon `NO_GO` + blocants explicites

Format de preuve obligatoire:
- `timestamp_utc | checkpoint | control_id | command | expected | observed | status | decision | observation`

## 7) Cloture F8.2

Resultat final:
- readiness locale completee (`PASS`)
- deploiement production trace (`PASS`)
- verification env vars critiques hebergees (`PASS`)
- Turnstile prod actif et parcours auth critiques valides (`PASS`)
- CORS/auth production conforme (`PASS`)
- rollback operationnel valide (`PASS`)

Conclusion:
- mise en service F8.2 cloturee => `GO` / `FAIT`
