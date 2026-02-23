#!/usr/bin/env node
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const HEALTHCHECK_VIEW = "healthcheck_business_anomalies_v1";
const ALLOWED_CHECKPOINTS = new Set(["pre-release", "post-release"]);

const RATE_LIMIT_KEYS = [
  "email_sent",
  "sms_sent",
  "anonymous_users",
  "token_refresh",
  "sign_in_sign_ups",
  "token_verifications",
  "web3",
];

const RLS_TABLES = [
  "lots",
  "inventory",
  "sets_bom",
  "sets_catalog",
  "transactions",
  "stock_balance",
  "sale_items",
  "sales",
  "stock_movements",
  "sale_item_pieces",
  "report_tickets",
];

const SECURITY_INVOKER_VIEWS = [
  "healthcheck_business_anomalies_v1",
  "stock_per_piece",
  "stock_journal",
  "piece_movements",
];

const STOCK_VIEWS = ["stock_per_piece", "stock_journal", "piece_movements"];
const STOCK_VIEW_CONTROL_IDS = {
  stock_per_piece: "C4",
  stock_journal: "C5",
  piece_movements: "C6",
};

const APP_RATE_LIMIT_SCOPES = [
  { scope: "auth_login", files: ["src/app/login/actions.ts"] },
  { scope: "auth_forgot_password", files: ["src/app/forgot-password/actions.ts"] },
  { scope: "compte_change_password", files: ["src/app/compte/actions.ts"] },
  {
    scope: "catalogue_mutations",
    files: [
      "src/app/actions/update-bom.ts",
      "src/app/actions/update-set-info.ts",
      "src/app/actions/update-set.ts",
      "src/app/catalogue/actions.ts",
    ],
  },
  { scope: "appro_mutations", files: ["src/app/approvisionnement/action.ts"] },
  {
    scope: "sales_mutations",
    files: ["src/app/actions/sales.ts", "src/app/actions/stock-movements.ts"],
  },
  { scope: "report_mutations", files: ["src/app/actions/report.ts"] },
  { scope: "api_bom_stock_read", files: ["src/app/api/sets/[setId]/bom-stock/route.ts"] },
];

const SECURITY_MUTATION_FILES = [
  "src/app/actions/update-bom.ts",
  "src/app/actions/update-set-info.ts",
  "src/app/actions/update-set.ts",
  "src/app/catalogue/actions.ts",
  "src/app/actions/stock-movements.ts",
  "src/app/approvisionnement/action.ts",
  "src/app/actions/sales.ts",
  "src/app/actions/report.ts",
  "src/app/compte/actions.ts",
  "src/app/login/actions.ts",
  "src/app/forgot-password/actions.ts",
];

const CORS_ROUTE_FILE = "src/app/api/sets/[setId]/bom-stock/route.ts";
const CORS_HELPER_FILE = "src/lib/security/cors.ts";
const DEFAULT_SEED_SET_ID = "SEED_SET_F1_2_001";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toText(value) {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return "";
}

function toScalar(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseArgs(argv) {
  let checkpoint = "pre-release";
  let enforceGo = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--checkpoint") {
      checkpoint = argv[i + 1] ?? checkpoint;
      i += 1;
      continue;
    }
    if (arg.startsWith("--checkpoint=")) {
      checkpoint = arg.slice("--checkpoint=".length);
      continue;
    }
    if (arg === "--enforce-go") {
      enforceGo = true;
      continue;
    }
  }

  assert(
    ALLOWED_CHECKPOINTS.has(checkpoint),
    "Usage: node scripts/f7_5_validate_local.mjs [--checkpoint pre-release|post-release] [--enforce-go]"
  );

  return { checkpoint, enforceGo };
}

function runCommand(command, options = {}) {
  const { allowFailure = false } = options;

  try {
    const stdout = execSync(command, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      ok: true,
      command,
      stdout,
      stderr: "",
      exitCode: 0,
    };
  } catch (error) {
    const stdout = toText(error.stdout);
    const stderr = toText(error.stderr);
    const exitCode = Number.isInteger(error.status) ? error.status : 1;

    if (!allowFailure) {
      throw new Error(`Command failed (${command}): ${(stderr || stdout || "unknown error").trim()}`);
    }

    return {
      ok: false,
      command,
      stdout,
      stderr,
      exitCode,
    };
  }
}

function parseEnvBlock(raw) {
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

function getLocalSupabaseEnv() {
  const statusEnv = runCommand("npx supabase status -o env");
  const env = parseEnvBlock(statusEnv.stdout);

  assert(env.API_URL, "API_URL introuvable dans `npx supabase status -o env`.");
  assert(env.ANON_KEY, "ANON_KEY introuvable dans `npx supabase status -o env`.");
  assert(env.SERVICE_ROLE_KEY, "SERVICE_ROLE_KEY introuvable dans `npx supabase status -o env`.");

  const apiUrl = new URL(env.API_URL);
  assert(
    apiUrl.hostname === "127.0.0.1" || apiUrl.hostname === "localhost",
    `Refus d'execution: API_URL non locale detectee (${env.API_URL}).`
  );

  return env;
}

async function countRows(admin, table, filters = []) {
  let query = admin.from(table).select("*", { head: true, count: "exact" });
  for (const [op, field, value] of filters) {
    if (op === "eq") query = query.eq(field, value);
    if (op === "lt") query = query.lt(field, value);
  }

  const { count, error } = await query;
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

async function assertViewReadable(admin, viewName) {
  const { count, error } = await admin.from(viewName).select("*", { head: true, count: "exact" });
  if (error) throw new Error(`Vue ${viewName} illisible: ${error.message}`);
  return count ?? 0;
}

function getProjectIdFromConfig(configText) {
  const match = configText.match(/^\s*project_id\s*=\s*"([^"]+)"/m);
  return match ? match[1] : null;
}

function parseTomlSection(configText, sectionName) {
  const lines = configText.split(/\r?\n/);
  const sectionRegex = new RegExp(`^\\[${escapeRegExp(sectionName)}\\]$`);

  let inSection = false;
  const entries = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inSection) {
      if (trimmed.startsWith("#")) continue;
      if (sectionRegex.test(trimmed)) {
        inSection = true;
      }
      continue;
    }

    if (trimmed === "" || trimmed.startsWith("#")) continue;
    if (/^\[.*\]$/.test(trimmed)) break;

    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!match) continue;
    entries[match[1]] = match[2].trim();
  }

  return { found: inSection, entries };
}

function parseTomlNumber(rawValue) {
  const normalized = String(rawValue ?? "")
    .trim()
    .replace(/^"|"$/g, "")
    .replaceAll("_", "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTomlBoolean(rawValue) {
  const normalized = String(rawValue ?? "")
    .trim()
    .replace(/^"|"$/g, "");
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function parseEnvKeysFromDotEnv(envPath) {
  const content = readFileSync(envPath, "utf8");
  const keys = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (match) keys.push(match[1]);
  }
  return [...new Set(keys)];
}

function getDbContainerName(projectId) {
  const { stdout } = runCommand("docker ps --format '{{.Names}}'");
  const names = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const preferred = projectId ? `supabase_db_${projectId}` : null;
  if (preferred && names.includes(preferred)) {
    return preferred;
  }

  return names.find((name) => name.startsWith("supabase_db_")) ?? null;
}

function runPsqlQuery(containerName, sql) {
  const escapedSql = sql.replaceAll('"', '\\"');
  const result = runCommand(
    `docker exec -e PGPASSWORD=postgres -i ${containerName} psql -U postgres -d postgres -t -A -F '|' -P pager=off -c "${escapedSql}"`,
    { allowFailure: true }
  );

  if (!result.ok) {
    throw new Error(`psql query failed: ${(result.stderr || result.stdout).trim()}`);
  }

  return result.stdout.trim();
}

function parsePipeRows(raw) {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|").map((cell) => cell.trim()));
}

function readFileIfExists(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!existsSync(absolutePath)) {
    return null;
  }
  return readFileSync(absolutePath, "utf8");
}

function evaluateAppMutationRateLimitSignals() {
  const missing = [];

  for (const scopeConfig of APP_RATE_LIMIT_SCOPES) {
    const scopeTokenA = `"${scopeConfig.scope}"`;
    const scopeTokenB = `'${scopeConfig.scope}'`;

    for (const file of scopeConfig.files) {
      const content = readFileIfExists(file);
      if (!content) {
        missing.push(`${file} (fichier manquant)`);
        continue;
      }

      const hasScope =
        content.includes(scopeTokenA) || content.includes(scopeTokenB);
      if (!hasScope) {
        missing.push(`${file} (scope manquant: ${scopeConfig.scope})`);
      }

      if (!content.includes("enforceRateLimit(")) {
        missing.push(`${file} (appel enforceRateLimit manquant)`);
      }
    }
  }

  if (missing.length > 0) {
    return {
      status: "FAIL",
      observed: `${missing.length} signal(s) app rate-limit manquant(s)`,
      evidence: missing.join("; "),
    };
  }

  return {
    status: "PASS",
    observed: `scopes app detectes (${APP_RATE_LIMIT_SCOPES.length})`,
    evidence: APP_RATE_LIMIT_SCOPES.map((row) => `${row.scope}`).join(", "),
  };
}

function evaluateServerValidationSignals() {
  const missing = [];

  for (const file of SECURITY_MUTATION_FILES) {
    const content = readFileIfExists(file);
    if (!content) {
      missing.push(`${file} (fichier manquant)`);
      continue;
    }

    const hasServerAction =
      content.includes('"use server"') || content.includes("'use server'");
    if (!hasServerAction) {
      missing.push(`${file} (directive use server manquante)`);
    }

    if (!content.includes("export async function")) {
      missing.push(`${file} (aucune mutation exportee detectee)`);
    }

    if (file === "src/app/login/actions.ts" || file === "src/app/forgot-password/actions.ts") {
      if (!content.includes("captchaToken")) {
        missing.push(`${file} (captchaToken manquant)`);
      }
      if (!content.includes("enforceRateLimit(")) {
        missing.push(`${file} (rate-limit auth manquant)`);
      }
      continue;
    }

    if (!content.includes("requireActiveSession")) {
      missing.push(`${file} (garde session requireActiveSession manquante)`);
    }
  }

  if (missing.length > 0) {
    return {
      status: "FAIL",
      observed: `${missing.length} signal(s) validation serveur manquant(s)`,
      evidence: missing.join("; "),
    };
  }

  return {
    status: "PASS",
    observed: "garde session + validations serveur detectees sur toutes les mutations ciblees",
    evidence: SECURITY_MUTATION_FILES.join(", "),
  };
}

function isClientFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const header = content.split(/\r?\n/).slice(0, 8).join("\n");
  return header.includes('"use client"') || header.includes("'use client'");
}

function evaluateApiKeysAndEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) {
    return {
      status: "BLOCKED",
      observed: ".env.local absent",
      evidence: "Verifier les variables d'environnement sur le poste d'execution.",
    };
  }

  const keys = parseEnvKeysFromDotEnv(envPath);
  const requiredBase = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const requiredF75 = [
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "SUPABASE_AUTH_CAPTCHA_SECRET",
    "APP_ALLOWED_ORIGINS",
  ];

  const missingBase = requiredBase.filter((key) => !keys.includes(key));
  const missingF75 = requiredF75.filter((key) => !keys.includes(key));

  const forbiddenPublicKeys = keys.filter((key) =>
    /^NEXT_PUBLIC_.*(SERVICE_ROLE|SECRET|PASSWORD)/.test(key)
  );

  const serviceRoleRefs = runCommand('rg -n "SUPABASE_SERVICE_ROLE_KEY" src', {
    allowFailure: true,
  });
  const clientLeaks = [];

  for (const line of serviceRoleRefs.stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const filePath = trimmed.split(":")[0];
    const absolutePath = path.join(ROOT, filePath);
    if (existsSync(absolutePath) && isClientFile(absolutePath)) {
      clientLeaks.push(trimmed);
    }
  }

  if (missingBase.length > 0) {
    return {
      status: "FAIL",
      observed: `${missingBase.length} variable(s) runtime de base absente(s)`,
      evidence: `Variables manquantes: ${missingBase.join(", ")}`,
    };
  }

  if (forbiddenPublicKeys.length > 0) {
    return {
      status: "FAIL",
      observed: "variables publiques sensibles detectees",
      evidence: forbiddenPublicKeys.join(", "),
    };
  }

  if (clientLeaks.length > 0) {
    return {
      status: "FAIL",
      observed: "SUPABASE_SERVICE_ROLE_KEY referencee dans un module client",
      evidence: clientLeaks.join("; "),
    };
  }

  if (missingF75.length > 0) {
    return {
      status: "BLOCKED",
      observed: `${missingF75.length} variable(s) F7.5 absente(s)`,
      evidence: `Variables manquantes: ${missingF75.join(", ")}`,
    };
  }

  return {
    status: "PASS",
    observed: "hygiene env/keys conforme (base + F7.5)",
    evidence: "Analyse .env.local (noms uniquement) + scan src",
  };
}

function evaluateCaptchaSignals(configText) {
  const envPath = path.join(ROOT, ".env.local");
  const envKeys = existsSync(envPath) ? parseEnvKeysFromDotEnv(envPath) : [];

  const captchaSection = parseTomlSection(configText, "auth.captcha");
  if (!captchaSection.found) {
    return {
      status: "BLOCKED",
      observed: "section [auth.captcha] absente ou commentee",
      evidence: "supabase/config.toml",
    };
  }

  const enabled = parseTomlBoolean(captchaSection.entries.enabled);
  const provider = String(captchaSection.entries.provider ?? "")
    .trim()
    .replace(/^\"|\"$/g, "");
  const secret = String(captchaSection.entries.secret ?? "")
    .trim()
    .replace(/^\"|\"$/g, "");

  if (enabled !== true) {
    return {
      status: "BLOCKED",
      observed: `captcha desactive (enabled=${toScalar(enabled)})`,
      evidence: "supabase/config.toml [auth.captcha]",
    };
  }

  if (provider !== "turnstile") {
    return {
      status: "FAIL",
      observed: `provider invalide: ${provider || "<vide>"}`,
      evidence: "supabase/config.toml [auth.captcha]",
    };
  }

  if (!secret.includes("env(SUPABASE_AUTH_CAPTCHA_SECRET)")) {
    return {
      status: "FAIL",
      observed: "secret captcha non branche sur env(SUPABASE_AUTH_CAPTCHA_SECRET)",
      evidence: "supabase/config.toml [auth.captcha]",
    };
  }

  const loginPage = readFileIfExists("src/app/login/page.tsx") ?? "";
  const forgotPage = readFileIfExists("src/app/forgot-password/page.tsx") ?? "";
  const loginAction = readFileIfExists("src/app/login/actions.ts") ?? "";
  const forgotAction = readFileIfExists("src/app/forgot-password/actions.ts") ?? "";
  const turnstileComponent = readFileIfExists("src/components/security/TurnstileField.tsx") ?? "";

  const wiringMissing = [];
  if (!turnstileComponent.includes("NEXT_PUBLIC_TURNSTILE_SITE_KEY")) {
    wiringMissing.push("src/components/security/TurnstileField.tsx (site key non detectee)");
  }
  if (!loginPage.includes("TurnstileField")) {
    wiringMissing.push("src/app/login/page.tsx (TurnstileField manquant)");
  }
  if (!forgotPage.includes("TurnstileField")) {
    wiringMissing.push("src/app/forgot-password/page.tsx (TurnstileField manquant)");
  }
  if (!loginAction.includes("captchaToken") || !loginAction.includes("signInWithPassword")) {
    wiringMissing.push("src/app/login/actions.ts (captchaToken/signInWithPassword manquant)");
  }
  if (!forgotAction.includes("captchaToken") || !forgotAction.includes("resetPasswordForEmail")) {
    wiringMissing.push("src/app/forgot-password/actions.ts (captchaToken/resetPasswordForEmail manquant)");
  }

  if (wiringMissing.length > 0) {
    return {
      status: "FAIL",
      observed: `${wiringMissing.length} branchement(s) CAPTCHA manquant(s)`,
      evidence: wiringMissing.join("; "),
    };
  }

  const missingEnv = ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "SUPABASE_AUTH_CAPTCHA_SECRET"].filter(
    (key) => !envKeys.includes(key)
  );
  if (missingEnv.length > 0) {
    return {
      status: "BLOCKED",
      observed: `${missingEnv.length} variable(s) CAPTCHA absente(s)`,
      evidence: `Variables manquantes: ${missingEnv.join(", ")}`,
    };
  }

  return {
    status: "PASS",
    observed: "CAPTCHA Turnstile active et branchee sur login/forgot-password",
    evidence:
      "supabase/config.toml + src/components/security/TurnstileField.tsx + src/app/login/* + src/app/forgot-password/*",
  };
}

async function waitForHttpReady(url, timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.status >= 200 && response.status < 500) {
        return true;
      }
    } catch {
      // server pas encore pret
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return false;
}

function collectStreamOutput(stream, target) {
  stream.on("data", (chunk) => {
    target.push(chunk.toString("utf8"));
  });
}

async function evaluateCorsSignals(localEnv) {
  const corsHelper = readFileIfExists(CORS_HELPER_FILE);
  const routeFile = readFileIfExists(CORS_ROUTE_FILE);

  if (!corsHelper || !routeFile) {
    return {
      status: "FAIL",
      observed: "socle CORS manquant",
      evidence: `${CORS_HELPER_FILE} et/ou ${CORS_ROUTE_FILE} absent`,
    };
  }

  const staticMissing = [];
  for (const token of ["resolveAllowedOrigins", "buildCorsHeaders", "APP_ALLOWED_ORIGINS"]) {
    if (!corsHelper.includes(token)) {
      staticMissing.push(`${CORS_HELPER_FILE} (token manquant: ${token})`);
    }
  }

  for (const token of ["export async function OPTIONS", "requireActiveSession", "isOriginAllowed"]) {
    if (!routeFile.includes(token)) {
      staticMissing.push(`${CORS_ROUTE_FILE} (token manquant: ${token})`);
    }
  }

  if (staticMissing.length > 0) {
    return {
      status: "FAIL",
      observed: `${staticMissing.length} signal(s) CORS manquant(s)`,
      evidence: staticMissing.join("; "),
    };
  }

  if (!localEnv) {
    return {
      status: "BLOCKED",
      observed: "env Supabase local indisponible pour test runtime CORS",
      evidence: "npx supabase status -o env",
    };
  }

  const port = 3105;
  const baseUrl = `http://127.0.0.1:${port}`;
  const stdoutChunks = [];
  const stderrChunks = [];

  const child = spawn("npm", ["run", "start", "--", "--port", String(port)], {
    cwd: ROOT,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: localEnv.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: localEnv.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: localEnv.SERVICE_ROLE_KEY,
      APP_ALLOWED_ORIGINS:
        process.env.APP_ALLOWED_ORIGINS ??
        "http://127.0.0.1:3000,http://localhost:3000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  collectStreamOutput(child.stdout, stdoutChunks);
  collectStreamOutput(child.stderr, stderrChunks);

  let forbiddenStatus = null;
  let unauthorizedStatus = null;

  try {
    const ready = await waitForHttpReady(`${baseUrl}/login`);
    if (!ready) {
      return {
        status: "BLOCKED",
        observed: "serveur Next indisponible pour les tests CORS runtime",
        evidence: `${stdoutChunks.join("").trim()} ${stderrChunks.join("").trim()}`.trim(),
      };
    }

    const forbiddenResponse = await fetch(
      `${baseUrl}/api/sets/${encodeURIComponent(DEFAULT_SEED_SET_ID)}/bom-stock`,
      {
        method: "GET",
        headers: {
          Origin: "http://forbidden.example",
          Accept: "application/json",
        },
      }
    );
    forbiddenStatus = forbiddenResponse.status;

    const unauthorizedResponse = await fetch(
      `${baseUrl}/api/sets/${encodeURIComponent(DEFAULT_SEED_SET_ID)}/bom-stock`,
      {
        method: "GET",
        headers: {
          Origin: "http://127.0.0.1:3000",
          Accept: "application/json",
        },
      }
    );
    unauthorizedStatus = unauthorizedResponse.status;
  } catch (error) {
    return {
      status: "BLOCKED",
      observed: `test runtime CORS indisponible: ${error.message}`,
      evidence: "Demarrer le serveur Next local puis relancer la verification.",
    };
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      child.once("exit", () => resolve());
      setTimeout(() => resolve(), 5_000);
    });
  }

  if (forbiddenStatus !== 403 || unauthorizedStatus !== 401) {
    return {
      status: "FAIL",
      observed: `status inattendus (origin interdite=${forbiddenStatus}, sans session=${unauthorizedStatus})`,
      evidence: "Attendu: 403 sur origin interdite et 401 sans session.",
    };
  }

  return {
    status: "PASS",
    observed: "allowlist CORS active (403 origin interdite, 401 sans session)",
    evidence: `${CORS_HELPER_FILE} + ${CORS_ROUTE_FILE} + test runtime local`,
  };
}

function evaluateAuditProd() {
  const result = runCommand("npm run audit:prod", { allowFailure: true });

  if (result.ok) {
    const foundZero = /found\s+0\s+vulnerabilities/i.test(result.stdout);
    return {
      status: foundZero ? "PASS" : "FAIL",
      observed: foundZero ? "0 vulnerability (prod)" : "resultat audit: valeur inattendue",
      evidence: "npm run audit:prod",
    };
  }

  const combined = `${result.stdout}\n${result.stderr}`;
  if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|network/i.test(combined)) {
    return {
      status: "BLOCKED",
      observed: "audit prod non executable (reseau indisponible)",
      evidence: "Relancer npm run audit:prod avec acces registry.npmjs.org",
    };
  }

  return {
    status: "FAIL",
    observed: "audit prod en echec",
    evidence: "npm run audit:prod",
  };
}

function evaluateAuditDeps() {
  const result = runCommand("npm run audit:deps", { allowFailure: true });
  if (!result.ok) {
    return {
      status: "FAIL",
      observed: "audit deps en echec",
      evidence: "npm run audit:deps",
    };
  }

  const clean = /\(empty\)/i.test(result.stdout);
  return {
    status: clean ? "PASS" : "FAIL",
    observed: clean
      ? "arbre ajv/@eslint/eslintrc/eslint vide"
      : "dependances ajv/@eslint/eslintrc/eslint detectees",
    evidence: "npm run audit:deps",
  };
}

function printSectionHeader(title) {
  console.log("");
  console.log(title);
}

async function run() {
  const { checkpoint, enforceGo } = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const matrix = [];

  const addCheck = (payload) => {
    matrix.push({
      id: payload.id,
      group: payload.group,
      status: payload.status,
      expected: payload.expected,
      observed: payload.observed,
      evidence: payload.evidence,
    });
  };

  console.log("[F7.5] Checklist securite Phase 7 - demarrage");
  console.log(`[F7.5] checkpoint=${checkpoint}`);
  console.log(`[F7.5] timestamp_utc=${startedAt}`);

  const configPath = path.join(ROOT, "supabase/config.toml");
  const configText = readFileSync(configPath, "utf8");
  const projectId = getProjectIdFromConfig(configText);

  const supabaseVersion = runCommand("npx supabase --version", { allowFailure: true });
  addCheck({
    id: "P1_supabase_cli_available",
    group: "prereq",
    status: supabaseVersion.ok ? "PASS" : "BLOCKED",
    expected: "Supabase CLI disponible",
    observed: supabaseVersion.ok ? supabaseVersion.stdout.trim() : "Supabase CLI indisponible",
    evidence: "npx supabase --version",
  });

  const dockerInfo = runCommand("docker info --format '{{.ServerVersion}}'", {
    allowFailure: true,
  });
  addCheck({
    id: "P2_docker_available",
    group: "prereq",
    status: dockerInfo.ok ? "PASS" : "BLOCKED",
    expected: "Docker disponible",
    observed: dockerInfo.ok ? dockerInfo.stdout.trim() : "Docker indisponible",
    evidence: "docker info",
  });

  const supabaseStatus = runCommand("npx supabase status", { allowFailure: true });
  addCheck({
    id: "P3_supabase_stack_running",
    group: "prereq",
    status: supabaseStatus.ok ? "PASS" : "BLOCKED",
    expected: "Stack Supabase locale active",
    observed: supabaseStatus.ok ? "stack locale detectee" : "stack locale indisponible",
    evidence: "npx supabase status",
  });

  let localEnv = null;
  let admin = null;
  let dbContainer = null;

  try {
    localEnv = getLocalSupabaseEnv();
    admin = createClient(localEnv.API_URL, localEnv.SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  } catch (error) {
    addCheck({
      id: "P4_local_only_guard",
      group: "prereq",
      status: "BLOCKED",
      expected: "API_URL locale (127.0.0.1/localhost) + env Supabase disponible",
      observed: error.message,
      evidence: "npx supabase status -o env",
    });
  }

  if (projectId) {
    dbContainer = getDbContainerName(projectId);
  } else {
    dbContainer = getDbContainerName(null);
  }

  if (!dbContainer) {
    addCheck({
      id: "P5_db_container_detected",
      group: "prereq",
      status: "BLOCKED",
      expected: "container docker `supabase_db_*` detecte",
      observed: "aucun container supabase_db_* detecte",
      evidence: "docker ps --format '{{.Names}}'",
    });
  } else {
    addCheck({
      id: "P5_db_container_detected",
      group: "prereq",
      status: "PASS",
      expected: "container docker `supabase_db_*` detecte",
      observed: dbContainer,
      evidence: "docker ps --format '{{.Names}}'",
    });
  }

  if (admin) {
    try {
      const healthcheckRows = await assertViewReadable(admin, HEALTHCHECK_VIEW);
      addCheck({
        id: "C1_healthcheck_view_readable",
        group: "stock_coherence",
        status: "PASS",
        expected: "vue healthcheck lisible",
        observed: `${HEALTHCHECK_VIEW} rows=${healthcheckRows}`,
        evidence: `select from ${HEALTHCHECK_VIEW}`,
      });
    } catch (error) {
      addCheck({
        id: "C1_healthcheck_view_readable",
        group: "stock_coherence",
        status: "FAIL",
        expected: "vue healthcheck lisible",
        observed: error.message,
        evidence: `select from ${HEALTHCHECK_VIEW}`,
      });
    }

    try {
      const anomaliesTotal = await countRows(admin, HEALTHCHECK_VIEW);
      addCheck({
        id: "C2_healthcheck_anomalies_total",
        group: "stock_coherence",
        status: anomaliesTotal === 0 ? "PASS" : "FAIL",
        expected: "anomalies_total = 0",
        observed: `anomalies_total=${anomaliesTotal}`,
        evidence: `count(*) ${HEALTHCHECK_VIEW}`,
      });
    } catch (error) {
      addCheck({
        id: "C2_healthcheck_anomalies_total",
        group: "stock_coherence",
        status: "FAIL",
        expected: "anomalies_total = 0",
        observed: error.message,
        evidence: `count(*) ${HEALTHCHECK_VIEW}`,
      });
    }

    try {
      const negativeStockRows = await countRows(admin, "stock_balance", [["lt", "quantity", 0]]);
      addCheck({
        id: "C3_negative_stock_rows",
        group: "stock_coherence",
        status: negativeStockRows === 0 ? "PASS" : "FAIL",
        expected: "stock_balance.quantity < 0 = 0",
        observed: `negative_stock_rows=${negativeStockRows}`,
        evidence: "count(*) stock_balance where quantity < 0",
      });
    } catch (error) {
      addCheck({
        id: "C3_negative_stock_rows",
        group: "stock_coherence",
        status: "FAIL",
        expected: "stock_balance.quantity < 0 = 0",
        observed: error.message,
        evidence: "count(*) stock_balance where quantity < 0",
      });
    }

    for (const view of STOCK_VIEWS) {
      const controlId = STOCK_VIEW_CONTROL_IDS[view] ?? "C4";
      try {
        const rows = await assertViewReadable(admin, view);
        addCheck({
          id: `${controlId}_${view}_readable`,
          group: "stock_coherence",
          status: "PASS",
          expected: `${view} lisible`,
          observed: `${view} rows=${rows}`,
          evidence: `select from ${view}`,
        });
      } catch (error) {
        addCheck({
          id: `${controlId}_${view}_readable`,
          group: "stock_coherence",
          status: "FAIL",
          expected: `${view} lisible`,
          observed: error.message,
          evidence: `select from ${view}`,
        });
      }
    }
  } else {
    addCheck({
      id: "C1_to_C4_stock_checks",
      group: "stock_coherence",
      status: "BLOCKED",
      expected: "checks stock/coherence executables",
      observed: "client Supabase local indisponible",
      evidence: "npx supabase status -o env",
    });
  }

  const rateLimitSection = parseTomlSection(configText, "auth.rate_limit");
  const authRateLimitSignal = (() => {
    if (!rateLimitSection.found) {
      return {
        status: "FAIL",
        observed: "section [auth.rate_limit] absente",
        evidence: "supabase/config.toml [auth.rate_limit]",
      };
    }

    const missingKeys = RATE_LIMIT_KEYS.filter(
      (key) => parseTomlNumber(rateLimitSection.entries[key]) === null
    );
    const nonPositiveKeys = RATE_LIMIT_KEYS.filter((key) => {
      const value = parseTomlNumber(rateLimitSection.entries[key]);
      return value !== null && value <= 0;
    });

    if (missingKeys.length > 0 || nonPositiveKeys.length > 0) {
      return {
        status: "FAIL",
        observed: `missing=${missingKeys.join(", ") || "none"}; non_positive=${nonPositiveKeys.join(", ") || "none"}`,
        evidence: "supabase/config.toml [auth.rate_limit]",
      };
    }

    return {
      status: "PASS",
      observed: RATE_LIMIT_KEYS.map((key) => `${key}=${parseTomlNumber(rateLimitSection.entries[key])}`).join(", "),
      evidence: "supabase/config.toml [auth.rate_limit]",
    };
  })();

  const appRateLimitSignal = evaluateAppMutationRateLimitSignals();
  const s1Status =
    authRateLimitSignal.status === "FAIL" || appRateLimitSignal.status === "FAIL"
      ? "FAIL"
      : authRateLimitSignal.status === "BLOCKED" || appRateLimitSignal.status === "BLOCKED"
        ? "BLOCKED"
        : "PASS";

  addCheck({
    id: "S1_auth_and_mutation_rate_limits",
    group: "security",
    status: s1Status,
    expected: "rate limits verifies sur auth + mutations metier",
    observed: `auth=${authRateLimitSignal.status}; app=${appRateLimitSignal.status}`,
    evidence: `${authRateLimitSignal.evidence} || ${appRateLimitSignal.evidence}`,
  });

  if (dbContainer) {
    try {
      const rlsRows = parsePipeRows(
        runPsqlQuery(
          dbContainer,
          `select relname, relrowsecurity
             from pg_class c
             join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relkind = 'r'
              and relname = any (array[${RLS_TABLES.map((name) => `'${name}'`).join(", ")}])
            order by relname;`
        )
      );

      const rlsMap = new Map(rlsRows.map((row) => [row[0], row[1]]));
      const missingTables = RLS_TABLES.filter((table) => !rlsMap.has(table));
      const rlsDisabled = RLS_TABLES.filter((table) => rlsMap.get(table) !== "t");

      addCheck({
        id: "S2_rls_enabled_on_public_tables",
        group: "security",
        status: missingTables.length === 0 && rlsDisabled.length === 0 ? "PASS" : "FAIL",
        expected: "RLS activee sur tables publiques cibles",
        observed:
          missingTables.length === 0 && rlsDisabled.length === 0
            ? `tables_ok=${RLS_TABLES.length}`
            : `missing=${missingTables.join(", ") || "none"}; disabled=${rlsDisabled.join(", ") || "none"}`,
        evidence: "pg_class.relrowsecurity (psql local)",
      });

      const policyRows = parsePipeRows(
        runPsqlQuery(
          dbContainer,
          `select tablename, count(*)::text
             from pg_policies
            where schemaname = 'public'
              and tablename = any (array[${RLS_TABLES.map((name) => `'${name}'`).join(", ")}])
            group by tablename
            order by tablename;`
        )
      );

      const policyMap = new Map(policyRows.map((row) => [row[0], Number(row[1])]));
      const tablesWithoutPolicy = RLS_TABLES.filter((table) => (policyMap.get(table) ?? 0) <= 0);

      addCheck({
        id: "S3_rls_policies_present",
        group: "security",
        status: tablesWithoutPolicy.length === 0 ? "PASS" : "FAIL",
        expected: "au moins une policy RLS par table cible",
        observed:
          tablesWithoutPolicy.length === 0
            ? `policies_ok=${RLS_TABLES.length}`
            : `missing_policy=${tablesWithoutPolicy.join(", ")}`,
        evidence: "pg_policies (psql local)",
      });

      const invokerRows = parsePipeRows(
        runPsqlQuery(
          dbContainer,
          `select relname, coalesce(array_to_string(reloptions, ','), '')
             from pg_class c
             join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and c.relkind = 'v'
              and relname = any (array[${SECURITY_INVOKER_VIEWS.map((name) => `'${name}'`).join(", ")}])
            order by relname;`
        )
      );

      const invokerMap = new Map(invokerRows.map((row) => [row[0], row[1]]));
      const invokerMissing = SECURITY_INVOKER_VIEWS.filter((view) => !invokerMap.has(view));
      const invokerDisabled = SECURITY_INVOKER_VIEWS.filter((view) => {
        const opts = invokerMap.get(view) ?? "";
        return !opts.includes("security_invoker=true");
      });

      addCheck({
        id: "S4_security_invoker_views",
        group: "security",
        status: invokerMissing.length === 0 && invokerDisabled.length === 0 ? "PASS" : "FAIL",
        expected: "security_invoker=true sur vues critiques",
        observed:
          invokerMissing.length === 0 && invokerDisabled.length === 0
            ? `views_ok=${SECURITY_INVOKER_VIEWS.length}`
            : `missing=${invokerMissing.join(", ") || "none"}; not_invoker=${invokerDisabled.join(", ") || "none"}`,
        evidence: "pg_class.reloptions (psql local)",
      });
    } catch (error) {
      addCheck({
        id: "S2_to_S4_db_security_evidence",
        group: "security",
        status: "BLOCKED",
        expected: "preuves DB security (RLS/policies/security_invoker) disponibles",
        observed: error.message,
        evidence: "docker exec ... psql",
      });
    }
  } else {
    addCheck({
      id: "S2_to_S4_db_security_evidence",
      group: "security",
      status: "BLOCKED",
      expected: "preuves DB security (RLS/policies/security_invoker) disponibles",
      observed: "container DB non detecte",
      evidence: "docker ps",
    });
  }

  const captchaSignal = evaluateCaptchaSignals(configText);
  addCheck({
    id: "S5_captcha_turnstile_enabled_and_wired",
    group: "security",
    status: captchaSignal.status,
    expected: "CAPTCHA Turnstile actif et branche sur auth",
    observed: captchaSignal.observed,
    evidence: captchaSignal.evidence,
  });

  const serverValidationSignal = evaluateServerValidationSignals();
  addCheck({
    id: "S6_server_side_validation_signals",
    group: "security",
    status: serverValidationSignal.status,
    expected: "validation serveur + garde session sur toutes les mutations ciblees",
    observed: serverValidationSignal.observed,
    evidence: serverValidationSignal.evidence,
  });

  const apiKeysSignal = evaluateApiKeysAndEnv();
  addCheck({
    id: "S7_api_keys_and_env_hygiene",
    group: "security",
    status: apiKeysSignal.status,
    expected: "API keys/env vars segmentees et sans fuite client",
    observed: apiKeysSignal.observed,
    evidence: apiKeysSignal.evidence,
  });

  const corsSignal = await evaluateCorsSignals(localEnv);
  addCheck({
    id: "S8_cors_allowlist_restrictions",
    group: "security",
    status: corsSignal.status,
    expected: "CORS allowlist active + route API testee (403/401)",
    observed: corsSignal.observed,
    evidence: corsSignal.evidence,
  });

  const auditProdSignal = evaluateAuditProd();
  addCheck({
    id: "S9_dependency_audit_prod",
    group: "security",
    status: auditProdSignal.status,
    expected: "npm audit prod sans vulnerabilite bloquante",
    observed: auditProdSignal.observed,
    evidence: auditProdSignal.evidence,
  });

  const auditDepsSignal = evaluateAuditDeps();
  addCheck({
    id: "S10_dependency_audit_deps",
    group: "security",
    status: auditDepsSignal.status,
    expected: "arbre ajv/@eslint/eslintrc/eslint vide",
    observed: auditDepsSignal.observed,
    evidence: auditDepsSignal.evidence,
  });

  const technicalCriticalChecks = matrix.filter(
    (row) => row.group === "prereq" || row.group === "stock_coherence"
  );
  const securityChecks = matrix.filter((row) => row.group === "security");

  const technicalGateOpen = technicalCriticalChecks.every((row) => row.status === "PASS");
  const securityGateOpen = securityChecks.every((row) => row.status === "PASS");
  const decision = technicalGateOpen && securityGateOpen ? "GO" : "NO_GO";

  const noGoReasons = matrix
    .filter((row) => row.status !== "PASS")
    .map((row) => `${row.id}:${row.status}`);

  printSectionHeader("[F7.5] PASS_FAIL_BLOCKED_MATRIX");
  for (const row of matrix) {
    console.log(
      `- ${row.id} | group=${row.group} | status=${row.status} | expected=${row.expected} | observed=${row.observed} | evidence=${row.evidence}`
    );
  }

  printSectionHeader("[F7.5] EVIDENCE_LOG");
  for (const row of matrix) {
    console.log(
      `${startedAt} | ${checkpoint} | ${row.id} | ${row.status} | ${row.observed} | ${row.evidence}`
    );
  }

  printSectionHeader("[F7.5] DECISION");
  console.log("- policy=block_always_on_security_non_compliance");
  console.log(`- checkpoint=${checkpoint}`);
  console.log(`- technical_gate=${technicalGateOpen ? "PASS" : "NO_GO"}`);
  console.log(`- security_gate=${securityGateOpen ? "PASS" : "NO_GO"}`);
  console.log(`- decision=${decision}`);
  console.log(`- non_pass_checks=${noGoReasons.length}`);
  if (noGoReasons.length > 0) {
    console.log(`- reasons=${noGoReasons.join(", ")}`);
  } else {
    console.log("- reasons=none");
  }

  if (enforceGo && decision !== "GO") {
    console.error("[F7.5] NO_GO (enforce-go actif).");
    process.exit(2);
  }

  console.log(`[F7.5] DONE: decision=${decision} (enforce-go=${enforceGo ? "true" : "false"}).`);
  process.exit(0);
}

run().catch((error) => {
  console.error("[F7.5] FAILED:", error.message);
  process.exit(1);
});
