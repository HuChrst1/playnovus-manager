#!/usr/bin/env node
import { execSync } from "node:child_process";
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
    "Usage: node scripts/f7_4_validate_local.mjs [--checkpoint pre-release|post-release] [--enforce-go]"
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

function evaluateServerValidationSignals() {
  const checks = [
    {
      file: "src/app/login/actions.ts",
      tokens: ['"use server"', "if (!email || !password)", "signInWithPassword"],
    },
    {
      file: "src/app/compte/actions.ts",
      tokens: ['"use server"', "MIN_PASSWORD_LENGTH", "signInWithPassword", "updateUserById"],
    },
    {
      file: "src/app/approvisionnement/action.ts",
      tokens: ['"use server"', "createLotFromDialog", "updateLotFromDialog", "deleteLot", "LOT_CONFIRMATION_INCONSISTENT"],
    },
    {
      file: "src/app/actions/sales.ts",
      tokens: ['"use server"', "validateSaleDraft", "validateSaleItemDraft", "createSaleAction", "updateSaleAction"],
    },
  ];

  const missing = [];

  for (const check of checks) {
    const absolutePath = path.join(ROOT, check.file);
    if (!existsSync(absolutePath)) {
      missing.push(`${check.file} (fichier manquant)`);
      continue;
    }

    const content = readFileSync(absolutePath, "utf8");
    for (const token of check.tokens) {
      if (!content.includes(token)) {
        missing.push(`${check.file} (token manquant: ${token})`);
      }
    }
  }

  if (missing.length > 0) {
    return {
      status: "FAIL",
      observed: `${missing.length} signal(s) manquant(s)`,
      evidence: missing.join("; "),
    };
  }

  return {
    status: "PASS",
    observed: "signaux de validation serveur trouves sur auth/lot/vente/compte",
    evidence:
      "src/app/login/actions.ts + src/app/compte/actions.ts + src/app/approvisionnement/action.ts + src/app/actions/sales.ts",
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
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missingRequired = required.filter((key) => !keys.includes(key));

  const forbiddenPublicKeys = keys.filter((key) =>
    /^NEXT_PUBLIC_.*(SERVICE_ROLE|SECRET|PASSWORD|TOKEN)/.test(key)
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

  if (missingRequired.length > 0) {
    return {
      status: "FAIL",
      observed: `${missingRequired.length} variable(s) requise(s) absente(s)`,
      evidence: `Variables manquantes: ${missingRequired.join(", ")}`,
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

  return {
    status: "PASS",
    observed: "separation anon/service_role conforme, aucune fuite client detectee",
    evidence: "Analyse .env.local (noms uniquement) + scan src",
  };
}

function evaluateCorsSignals() {
  const result = runCommand(
    'rg -n "Access-Control-Allow-Origin|access-control-allow-origin|allowedOrigins|allowed_origins|cors" next.config.ts src/app/api',
    { allowFailure: true }
  );

  const output = result.stdout.trim();
  if (!output) {
    return {
      status: "BLOCKED",
      observed: "aucune restriction CORS explicite detectee dans next.config.ts / src/app/api",
      evidence: "Ajouter une configuration CORS explicite ou formaliser l'absence volontaire.",
    };
  }

  if (output.includes("*")) {
    return {
      status: "FAIL",
      observed: "wildcard CORS detecte",
      evidence: output,
    };
  }

  return {
    status: "PASS",
    observed: "signaux CORS detectes sans wildcard",
    evidence: output,
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

  console.log("[F7.4] Checklist livraison + rollback - demarrage");
  console.log(`[F7.4] checkpoint=${checkpoint}`);
  console.log(`[F7.4] timestamp_utc=${startedAt}`);

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
  if (!rateLimitSection.found) {
    addCheck({
      id: "S1_auth_rate_limit_configured",
      group: "security",
      status: "FAIL",
      expected: "[auth.rate_limit] present + valeurs numeriques > 0",
      observed: "section [auth.rate_limit] absente",
      evidence: "supabase/config.toml",
    });
  } else {
    const missingKeys = RATE_LIMIT_KEYS.filter(
      (key) => parseTomlNumber(rateLimitSection.entries[key]) === null
    );
    const nonPositiveKeys = RATE_LIMIT_KEYS.filter((key) => {
      const value = parseTomlNumber(rateLimitSection.entries[key]);
      return value !== null && value <= 0;
    });

    const status =
      missingKeys.length === 0 && nonPositiveKeys.length === 0 ? "PASS" : "FAIL";
    const observed =
      status === "PASS"
        ? RATE_LIMIT_KEYS.map((key) => `${key}=${parseTomlNumber(rateLimitSection.entries[key])}`).join(", ")
        : `missing=${missingKeys.join(", ") || "none"}; non_positive=${nonPositiveKeys.join(", ") || "none"}`;

    addCheck({
      id: "S1_auth_rate_limit_configured",
      group: "security",
      status,
      expected: "[auth.rate_limit] present + valeurs numeriques > 0",
      observed,
      evidence: "supabase/config.toml [auth.rate_limit]",
    });
  }

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

  const captchaSection = parseTomlSection(configText, "auth.captcha");
  if (!captchaSection.found) {
    addCheck({
      id: "S5_captcha_enabled",
      group: "security",
      status: "BLOCKED",
      expected: "[auth.captcha] enabled=true + provider valide",
      observed: "section [auth.captcha] absente ou commentee",
      evidence: "supabase/config.toml",
    });
  } else {
    const enabled = parseTomlBoolean(captchaSection.entries.enabled);
    const provider = String(captchaSection.entries.provider ?? "")
      .trim()
      .replace(/^"|"$/g, "");
    const providerValid = provider === "hcaptcha" || provider === "turnstile";

    let status = "PASS";
    if (enabled !== true) status = "BLOCKED";
    if (enabled === true && !providerValid) status = "FAIL";

    addCheck({
      id: "S5_captcha_enabled",
      group: "security",
      status,
      expected: "[auth.captcha] enabled=true + provider valide",
      observed: `enabled=${toScalar(enabled)}, provider=${provider || "<vide>"}`,
      evidence: "supabase/config.toml [auth.captcha]",
    });
  }

  const serverValidationSignal = evaluateServerValidationSignals();
  addCheck({
    id: "S6_server_side_validation_signals",
    group: "security",
    status: serverValidationSignal.status,
    expected: "validations serveur presentes sur auth/lot/vente/compte",
    observed: serverValidationSignal.observed,
    evidence: serverValidationSignal.evidence,
  });

  const apiKeysSignal = evaluateApiKeysAndEnv();
  addCheck({
    id: "S7_api_keys_and_env_hygiene",
    group: "security",
    status: apiKeysSignal.status,
    expected: "separation anon/service_role + variables critiques presentes + aucune fuite client",
    observed: apiKeysSignal.observed,
    evidence: apiKeysSignal.evidence,
  });

  const corsSignal = evaluateCorsSignals();
  addCheck({
    id: "S8_cors_restrictions",
    group: "security",
    status: corsSignal.status,
    expected: "restriction CORS explicite sur surfaces exposees",
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

  printSectionHeader("[F7.4] PASS_FAIL_BLOCKED_MATRIX");
  for (const row of matrix) {
    console.log(
      `- ${row.id} | group=${row.group} | status=${row.status} | expected=${row.expected} | observed=${row.observed} | evidence=${row.evidence}`
    );
  }

  printSectionHeader("[F7.4] EVIDENCE_LOG");
  for (const row of matrix) {
    console.log(
      `${startedAt} | ${checkpoint} | ${row.id} | ${row.status} | ${row.observed} | ${row.evidence}`
    );
  }

  printSectionHeader("[F7.4] DECISION");
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
    console.error("[F7.4] NO_GO (enforce-go actif).");
    process.exit(2);
  }

  console.log(`[F7.4] DONE: decision=${decision} (enforce-go=${enforceGo ? "true" : "false"}).`);
  process.exit(0);
}

run().catch((error) => {
  console.error("[F7.4] FAILED:", error.message);
  process.exit(1);
});
