# F7.5 - Checklist securite Phase 7 (gate bloquant)

Objectif: valider la posture securite avant toute livraison pre-prod/prod, avec un gate `GO` strict et des preuves horodatees.

## Politique de decision

- `GO` uniquement si tous les controles `S1..S10` sont `PASS`.
- `NO_GO` des qu'un controle est `FAIL` ou `BLOCKED`.
- Mode strict: utiliser `--enforce-go` (exit code `2` si `NO_GO`).

## Perimetre F7.5

- rate limits verifies (auth + mutations metier + route API exposee)
- RLS/policies/security_invoker verifies (compat RLS conservee)
- CAPTCHA Turnstile active + branchee sur login/forgot-password
- garde session + validation serveur sur toutes les mutations ciblees
- hygiene API keys / env vars (segmentation + absence de fuite client)
- CORS en allowlist explicite avec verification runtime locale
- dependency audits (`audit:prod`, `audit:deps`)

## Variables d'environnement attendues

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `SUPABASE_AUTH_CAPTCHA_SECRET`
- `APP_ALLOWED_ORIGINS`

Exemple local:

```bash
APP_ALLOWED_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
```

## Script A (local, obligatoire)

1. Pre-check runtime local:

```bash
npx supabase --version
docker info
npx supabase status
npx supabase start
npx supabase db reset --local
```

2. Qualite + non-regression:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:f2.0
npm run test:f7.3:pre
npm run test:f7.3:post
npm run test:f7.4
```

3. Gate securite F7.5:

```bash
npm run test:f7.5
node scripts/f7_5_validate_local.mjs --checkpoint pre-release --enforce-go
node scripts/f7_5_validate_local.mjs --checkpoint post-release --enforce-go
```

4. Audits:

```bash
npm run audit:prod
npm run audit:deps
```

## Script B (optionnel, read-only)

- inventaire lecture seule d'un projet distant lie
- strictement aucune ecriture distante
- hors execution par defaut

## Definition des controles S1..S10

- `S1_auth_and_mutation_rate_limits`
  - attendu: `[auth.rate_limit]` valide + scopes applicatifs presents (`auth_login`, `auth_forgot_password`, `compte_change_password`, `catalogue_mutations`, `appro_mutations`, `sales_mutations`, `report_mutations`, `api_bom_stock_read`)
- `S2_rls_enabled_on_public_tables`
  - attendu: RLS activee sur tables cibles
- `S3_rls_policies_present`
  - attendu: au moins une policy par table cible
- `S4_security_invoker_views`
  - attendu: vues critiques en `security_invoker=true`
- `S5_captcha_turnstile_enabled_and_wired`
  - attendu: `[auth.captcha] enabled=true`, `provider=turnstile`, secret via `env(SUPABASE_AUTH_CAPTCHA_SECRET)`, widget + token branches sur login/forgot-password, variables CAPTCHA presentes
- `S6_server_side_validation_signals`
  - attendu: garde session + validation serveur sur toutes les mutations ciblees
- `S7_api_keys_and_env_hygiene`
  - attendu: variables critiques presentes, aucune variable publique sensible, aucune fuite `SUPABASE_SERVICE_ROLE_KEY` en module client
- `S8_cors_allowlist_restrictions`
  - attendu: allowlist explicite + tests runtime locaux valides:
    - origin interdite => `403`
    - origin autorisee sans session => `401`
- `S9_dependency_audit_prod`
  - attendu: `npm run audit:prod` sans vulnerabilite bloquante
- `S10_dependency_audit_deps`
  - attendu: `npm run audit:deps` sans chaine `ajv/@eslint/eslintrc/eslint`

## Evidence log minimal

Format attendu:

```text
<timestamp_utc> | <checkpoint> | <control_id> | <status> | <observed> | <evidence>
```

Source de verite: sortie du script `scripts/f7_5_validate_local.mjs`.

## Monitoring minimum post-release

- echec `S2..S8` => incident securite bloquant, rollback release
- echec `S9/S10` => `NO_GO` jusqu'a correction/mitigation validee
- action immediate:
  - figer la livraison
  - collecter logs `PASS_FAIL_BLOCKED_MATRIX` + `EVIDENCE_LOG`
  - ouvrir ticket action corrective avec proprietaire + preuve de retest
