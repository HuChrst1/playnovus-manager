# F8.1 - Preparation deploiement production (Vercel)

Date: 2026-02-23  
Statut lot: `BLOQUE`  
Perimetre: Phase 8 / F8.1 uniquement (preparation deploiement production, sans execution F8.2)

## 1) Cadrage F8.1

Objectif:
- preparer un deploiement production previsible, reproductible et auditable
- minimiser le risque operationnel (priorite: reduction maximale du risque)
- imposer un passage preprod obligatoire avant toute mise en service production
- formaliser une decision `GO/NO_GO` F8.1 basee sur preuves

Hors scope:
- execution du deploiement production (F8.2)
- stabilisation post go-live (F8.3)
- ecriture DB distante (`supabase db push --linked`, `supabase migration up --linked`, DDL/DML remote)
- ajout de migrations SQL

## 2) Strategie de deploiement (Vercel + Supabase + Turnstile)

Stack retenue:
- frontend/app Next.js: Vercel
- backend data/auth: Supabase heberge
- anti-bot auth: Cloudflare Turnstile
- DNS/domaines: fournisseur DNS du domaine (verification read-only requise avant F8.2)

Principes:
- local-first pour preparation, documentation et validation
- preprod obligatoire avec variables et hostnames alignes prod
- preuves externes obligatoires avant passage effectif a F8.2

## 3) Prerequis techniques et operationnels

Prerequis runtime local:
- Node/npm installes
- Supabase CLI disponible
- Docker actif
- stack Supabase locale operationnelle

Prerequis organisationnels:
- acces Vercel (projet + variables d'environnement)
- acces Cloudflare Turnstile (widget prod + hostnames)
- acces DNS (lecture pour verification hostnames/certificats)
- responsable GO/NO_GO identifie

Regles de securite:
- aucun secret en clair dans repo/docs/scripts
- preuves journalisees sans valeurs sensibles
- separation stricte des variables publiques et secrets

## 4) Sequence preparation preprod -> prod (sans execution F8.2)

### 4.1 Pre-check local obligatoire

```bash
cd /Users/bastienchristlen/PLAYNOVUS_APP/playnovus-manager
npx supabase --version
docker info
npx supabase status
```

### 4.2 Validation locale pre-release (gates existants + gate F8.1)

```bash
npx supabase start
npx supabase db reset --local
npm run test
npm run test:f2.0
npm run test:f7.3:pre
npm run test:f7.3:post
npm run test:f7.4
npm run test:f7.5
npm run test:f8.1
```

### 4.3 Verification qualite complete

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
npm run test:f7.5
npm run lint:ui-contrast
npm run audit:prod
npm run audit:deps
```

### 4.4 Preparation preprod (actions manuelles exterieures)

1. Verifier le projet Vercel preprod (read-only si possible).
2. Verifier les variables preprod obligatoires sans divulgation de valeurs.
3. Verifier la configuration Turnstile preprod (widget, hostnames).
4. Executer la checklist smoke preprod.
5. Capturer les preuves (horodatage UTC + statut PASS/FAIL/BLOCKED).

### 4.5 Gate preprod

- `GO` preprod uniquement si tous controles critiques sont `PASS`.
- tout `FAIL`/`BLOCKED` critique implique `NO_GO` vers prod.

### 4.6 Preparation production (actions manuelles exterieures)

1. Verifier le projet Vercel production.
2. Verifier variables production obligatoires.
3. Verifier Turnstile prod (widget + hostnames de production).
4. Verifier prerequis DNS/domain/certificat.
5. Capturer preuves externes E1/E2.

Important:
- cette phase prepare la mise en service mais n'execute pas F8.2.

## 5) Checklist variables d'environnement et secrets (local/preprod/prod)

| Variable | Classification | Local | Preprod | Prod | Source de verite | Responsable | Rotation | Verification | Preuve attendue |
|---|---|---|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | publique | obligatoire | obligatoire | obligatoire | Vercel env / `.env.local` | owner app | n/a | URL valide, domaine attendu | capture ecran sans valeur sensible |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publique | obligatoire | obligatoire | obligatoire | Vercel env / `.env.local` | owner app | selon politique Supabase | cle presente uniquement en public | checklist env |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | obligatoire | obligatoire | obligatoire | secret manager Vercel / local shell | owner infra | periodique | jamais exposee cote client | checklist env + scan code |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | publique | obligatoire | obligatoire | obligatoire | Cloudflare Turnstile + Vercel env | owner securite | selon changement widget | cle publiee associee au widget cible | preuve Turnstile |
| `SUPABASE_AUTH_CAPTCHA_SECRET` | secret | obligatoire | obligatoire | obligatoire | Cloudflare Turnstile secret + Supabase/Vercel env | owner securite | selon politique | liee a `env(SUPABASE_AUTH_CAPTCHA_SECRET)` | preuve config sans valeur |
| `APP_ALLOWED_ORIGINS` | configuration securite | obligatoire | obligatoire | obligatoire | Vercel env / `.env.local` | owner app | a chaque changement domaine | origines strictement autorisees | test runtime CORS |

Regles:
- ne jamais copier une valeur sensible dans docs, ticket ou commit
- n'utiliser que des placeholders (`<value>`, `<secret>`)
- verifier la coherence preprod/prod avant GO F8.1

## 6) Procedure Turnstile production (widget + hostnames + mapping)

### 6.1 Creation/verification widget production

1. Ouvrir Cloudflare Turnstile.
2. Creer (ou verifier) un widget dedie production.
3. Configurer les hostnames production exacts (et preprod si necessaire).
4. Recuperer:
- site key (publique)
- secret key (secret)

### 6.2 Mapping variables

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` <- site key du widget cible
- `SUPABASE_AUTH_CAPTCHA_SECRET` <- secret key du widget cible
- `supabase/config.toml` doit rester branche sur `env(SUPABASE_AUTH_CAPTCHA_SECRET)`

### 6.3 Verification applicative

1. Login: CAPTCHA requis, token present, soumission bloquee sans token.
2. Forgot password: CAPTCHA requis et valide.
3. Controle d'erreur: token invalide => erreur metier attendue.

### 6.4 Verification hostnames

Pass si:
- hostnames preprod/prod configures et conformes aux domaines cibles
- aucun wildcard non maitrise
- coherents avec `APP_ALLOWED_ORIGINS`

## 7) Checklist go-live + smoke checks metier critiques

Checklist pre-go-live:
- healthcheck local DB (`test:f7.3:pre/post`) PASS
- gate livraison (`test:f7.4`) execute
- gate securite (`test:f7.5`) execute
- gate preparation F8.1 (`test:f8.1`) execute
- audits (`audit:prod`, `audit:deps`) executes

Smoke checks metier critiques:
1. Auth:
- acces `/login` OK
- login valide fonctionne
- route protegee redirige si session absente
2. Catalogue:
- page chargee sans erreur bloquante
3. Approvisionnement:
- lecture lots OK
4. Ventes:
- liste commandes chargee
5. Stock:
- `/stock` et `/historique-stock` accessibles
6. API ciblee:
- route `bom-stock` respecte CORS et auth (`403` origine interdite, `401` sans session)

## 8) Matrice GO / NO_GO F8.1

| Condition | Regle | Decision |
|---|---|---|
| pre-check runtime local PASS | prerequis techniques valides | eligible |
| runbook complet + checklist env/secrets + procedure Turnstile + smoke checks + matrice presents | preparation documentaire complete | eligible |
| garde-fous F7.4/F7.5 preserves | non-regression gouvernance | eligible |
| aucune migration SQL ajoutee | perimetre respecte | eligible |
| preuves externes E1/E2 PASS | prerequis preprod/prod verifies | `GO` possible vers F8.2 |
| au moins un controle critique `FAIL` | blocage | `NO_GO` |
| au moins un controle critique `BLOCKED` | blocage | `NO_GO` |

Policy:
- `GO` uniquement si tous les controles critiques sont `PASS`.
- si E1/E2 non valides, F8.1 reste `BLOQUE`.

## 9) Rollback de deploiement (niveau preparation F8.1)

Declencheurs:
- incoherence variables/hostnames
- preuve externe invalide
- gate securite ou qualite en echec

Actions:
1. stopper la progression vers F8.2
2. conserver l'etat de production inchangé
3. revenir a l'etape preprod de la checklist
4. corriger les ecarts et reexecuter les gates
5. tracer cause, action corrective, nouvelle decision

## 10) Format de collecte de preuves

Format obligatoire:

`timestamp_utc | checkpoint | control_id | command | expected | observed | status | decision | observation`

Statuts autorises:
- `PASS`
- `FAIL`
- `BLOCKED`

Checkpoints:
- `pre-release`
- `post-release`

## 11) Script A et Script B

Script A (local, obligatoire):
- pre-check runtime local
- validations F7.x + F8.1
- collecte evidences et decision F8.1

Script B (optionnel, remote read-only, sur demande):
- inventaire prerequis Vercel/Turnstile/DNS
- strictement aucune ecriture DB distante

## 12) Etat preuves externes obligatoires (DoD stricte)

E1_turnstile_prod_domain_validated: BLOCKED  
E2_hosted_env_security_vars_verified: BLOCKED

Interpretation:
- tant que E1/E2 ne sont pas `PASS`, le lot F8.1 est `BLOQUE` et F8.2 ne doit pas demarrer.
