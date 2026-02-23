#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RUNBOOK_PATH = "docs/F8_1_PREPARATION_DEPLOIEMENT_PRODUCTION.md";
const ALLOWED_CHECKPOINTS = new Set(["pre-release", "post-release"]);

const EXPECTED_MIGRATIONS = [
  "20260215214134_f1_1_baseline_public.sql",
  "20260216134316_f1_3_block_negative_stock.sql",
  "20260216144649_f1_4_anti_duplicate_movements_indexes.sql",
  "20260216164515_f1_5_healthcheck_sql_anomalies.sql",
  "20260218201000_f1_6_security_rls_views.sql",
  "20260218224500_f1_7_security_followup_healthcheck_functions.sql",
  "20260220143000_f5_0_4_report_tickets.sql",
  "20260223120000_f6_4_report_tickets_attribution.sql",
];

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
    "Usage: node scripts/f8_1_validate_local.mjs [--checkpoint pre-release|post-release] [--enforce-go]"
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
    return { ok: true, command, stdout, stderr: "", exitCode: 0 };
  } catch (error) {
    const stdout = toText(error.stdout);
    const stderr = toText(error.stderr);
    const exitCode = Number.isInteger(error.status) ? error.status : 1;

    if (!allowFailure) {
      throw new Error(`Command failed (${command}): ${(stderr || stdout || "unknown error").trim()}`);
    }

    return { ok: false, command, stdout, stderr, exitCode };
  }
}

function getRunbookContent() {
  const absolutePath = path.join(ROOT, RUNBOOK_PATH);
  if (!existsSync(absolutePath)) {
    return null;
  }
  return readFileSync(absolutePath, "utf8");
}

function printSectionHeader(title) {
  console.log("");
  console.log(title);
}

function evaluateRunbookSections(content) {
  const requiredTokens = [
    "## 2) Strategie de deploiement (Vercel + Supabase + Turnstile)",
    "## 3) Prerequis techniques et operationnels",
    "## 4) Sequence preparation preprod -> prod (sans execution F8.2)",
    "## 5) Checklist variables d'environnement et secrets (local/preprod/prod)",
    "## 6) Procedure Turnstile production (widget + hostnames + mapping)",
    "## 7) Checklist go-live + smoke checks metier critiques",
    "## 8) Matrice GO / NO_GO F8.1",
    "## 9) Rollback de deploiement (niveau preparation F8.1)",
    "## 10) Format de collecte de preuves",
  ];

  const missing = requiredTokens.filter((token) => !content.includes(token));
  if (missing.length > 0) {
    return {
      status: "FAIL",
      observed: `${missing.length} section(s) runbook manquante(s)`,
      evidence: missing.join("; "),
    };
  }

  return {
    status: "PASS",
    observed: "sections obligatoires du runbook presentes",
    evidence: RUNBOOK_PATH,
  };
}

function evaluateEnvMatrix(content) {
  const requiredVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "SUPABASE_AUTH_CAPTCHA_SECRET",
    "APP_ALLOWED_ORIGINS",
  ];

  const hasTableHeader =
    content.includes("| Variable |") &&
    content.includes("| Local |") &&
    content.includes("| Preprod |") &&
    content.includes("| Prod |");

  const missingVars = requiredVars.filter((name) => !content.includes(name));

  if (!hasTableHeader) {
    return {
      status: "FAIL",
      observed: "matrice env/secrets absente ou incomplete",
      evidence: "Tableau local/preprod/prod non detecte.",
    };
  }

  if (missingVars.length > 0) {
    return {
      status: "FAIL",
      observed: `${missingVars.length} variable(s) critique(s) absente(s) de la matrice`,
      evidence: missingVars.join(", "),
    };
  }

  return {
    status: "PASS",
    observed: "matrice env/secrets complete (local/preprod/prod)",
    evidence: RUNBOOK_PATH,
  };
}

function evaluateTurnstileProcedure(content) {
  const checks = [
    { token: "widget", test: /widget/i.test(content) },
    { token: "hostnames", test: content.includes("hostnames") },
    { token: "NEXT_PUBLIC_TURNSTILE_SITE_KEY", test: content.includes("NEXT_PUBLIC_TURNSTILE_SITE_KEY") },
    { token: "SUPABASE_AUTH_CAPTCHA_SECRET", test: content.includes("SUPABASE_AUTH_CAPTCHA_SECRET") },
    { token: "supabase/config.toml", test: content.includes("supabase/config.toml") },
  ];

  const missing = checks.filter((entry) => !entry.test).map((entry) => entry.token);
  if (missing.length > 0) {
    return {
      status: "FAIL",
      observed: `${missing.length} element(s) Turnstile manquant(s)`,
      evidence: missing.join("; "),
    };
  }

  return {
    status: "PASS",
    observed: "procedure Turnstile production documentee",
    evidence: RUNBOOK_PATH,
  };
}

function evaluateGoLiveSmoke(content) {
  const requiredTokens = [
    "Checklist go-live",
    "Smoke checks metier critiques",
    "login",
    "Ventes",
    "Stock",
    "403",
    "401",
  ];
  const missing = requiredTokens.filter((token) => !content.includes(token));

  if (missing.length > 0) {
    return {
      status: "FAIL",
      observed: `${missing.length} element(s) smoke checks manquant(s)`,
      evidence: missing.join("; "),
    };
  }

  return {
    status: "PASS",
    observed: "checklist go-live et smoke checks documentees",
    evidence: RUNBOOK_PATH,
  };
}

function evaluateGoNoGoMatrix(content) {
  const hasMatrix =
    content.includes("## 8) Matrice GO / NO_GO F8.1") &&
    content.includes("| Condition | Regle | Decision |") &&
    content.includes("GO") &&
    content.includes("NO_GO");

  if (!hasMatrix) {
    return {
      status: "FAIL",
      observed: "matrice GO/NO_GO F8.1 absente/incomplete",
      evidence: RUNBOOK_PATH,
    };
  }

  return {
    status: "PASS",
    observed: "matrice GO/NO_GO F8.1 presente",
    evidence: RUNBOOK_PATH,
  };
}

function evaluateNoPlaintextSecrets(content) {
  const detectors = [
    { id: "supabase_secret_token", pattern: /sb_secret_[A-Za-z0-9_-]{16,}/g },
    { id: "private_key_block", pattern: /-----BEGIN [A-Z ]+-----/g },
    { id: "inline_service_role", pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!<|env\(|\*|changeme|example)[^\s`]+/gi },
    { id: "inline_turnstile_secret", pattern: /SUPABASE_AUTH_CAPTCHA_SECRET\s*=\s*(?!<|env\(|\*|changeme|example)[^\s`]+/gi },
  ];

  const findings = [];
  for (const detector of detectors) {
    const match = content.match(detector.pattern);
    if (match && match.length > 0) {
      findings.push(`${detector.id}:${match[0]}`);
    }
  }

  if (findings.length > 0) {
    return {
      status: "FAIL",
      observed: `${findings.length} signal(aux) de secret en clair detecte(s)`,
      evidence: findings.join("; "),
    };
  }

  return {
    status: "PASS",
    observed: "aucun secret en clair detecte dans le runbook",
    evidence: RUNBOOK_PATH,
  };
}

function evaluateF7GuardsPreserved() {
  const packageJsonPath = path.join(ROOT, "package.json");
  if (!existsSync(packageJsonPath)) {
    return {
      status: "FAIL",
      observed: "package.json introuvable",
      evidence: packageJsonPath,
    };
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const scripts = packageJson.scripts ?? {};
  const missingScripts = ["test:f7.4", "test:f7.5"].filter((name) => !scripts[name]);

  const missingFiles = [
    "scripts/f7_4_validate_local.mjs",
    "scripts/f7_5_validate_local.mjs",
  ].filter((filePath) => !existsSync(path.join(ROOT, filePath)));

  if (missingScripts.length > 0 || missingFiles.length > 0) {
    return {
      status: "FAIL",
      observed: "garde-fous F7.4/F7.5 non preserves",
      evidence: `missing_scripts=${missingScripts.join(", ") || "none"}; missing_files=${missingFiles.join(", ") || "none"}`,
    };
  }

  return {
    status: "PASS",
    observed: "garde-fous F7.4/F7.5 preserves",
    evidence: "package.json + scripts/f7_4_validate_local.mjs + scripts/f7_5_validate_local.mjs",
  };
}

function evaluateMigrationsScope() {
  const migrationsDir = path.join(ROOT, "supabase/migrations");
  if (!existsSync(migrationsDir)) {
    return {
      status: "FAIL",
      observed: "dossier migrations introuvable",
      evidence: migrationsDir,
    };
  }

  const actual = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
  const expected = [...EXPECTED_MIGRATIONS].sort();

  const missing = expected.filter((file) => !actual.includes(file));
  const extra = actual.filter((file) => !expected.includes(file));

  if (missing.length > 0 || extra.length > 0) {
    return {
      status: "FAIL",
      observed: "scope migrations F8.1 non respecte",
      evidence: `missing=${missing.join(", ") || "none"}; extra=${extra.join(", ") || "none"}`,
    };
  }

  return {
    status: "PASS",
    observed: "aucune migration SQL additionnelle detectee",
    evidence: "supabase/migrations",
  };
}

function evaluateExternalEvidence(content, controlId, regex, expectedLabel) {
  const match = content.match(regex);
  if (!match) {
    return {
      id: controlId,
      status: "BLOCKED",
      observed: `${controlId} non renseigne dans le runbook`,
      evidence: `Ajouter la ligne '${expectedLabel}: PASS|BLOCKED' dans ${RUNBOOK_PATH}`,
    };
  }

  const status = String(match[1] ?? "").toUpperCase();
  if (status === "PASS") {
    return {
      id: controlId,
      status: "PASS",
      observed: `${controlId} valide`,
      evidence: `${expectedLabel}: PASS`,
    };
  }

  return {
    id: controlId,
    status: "BLOCKED",
    observed: `${controlId} en attente de preuve externe`,
    evidence: `${expectedLabel}: ${status || "BLOCKED"}`,
  };
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
      command: payload.command,
      expected: payload.expected,
      observed: payload.observed,
      evidence: payload.evidence,
    });
  };

  console.log("[F8.1] Preparation deploiement production - demarrage");
  console.log(`[F8.1] checkpoint=${checkpoint}`);
  console.log(`[F8.1] timestamp_utc=${startedAt}`);

  const supabaseVersion = runCommand("npx supabase --version", { allowFailure: true });
  addCheck({
    id: "P1_supabase_cli_available",
    group: "prereq",
    status: supabaseVersion.ok ? "PASS" : "BLOCKED",
    command: "npx supabase --version",
    expected: "Supabase CLI disponible",
    observed: supabaseVersion.ok
      ? `version=${supabaseVersion.stdout.trim()}`
      : (supabaseVersion.stderr || supabaseVersion.stdout || "commande en echec").trim(),
    evidence: "pre-check runtime local",
  });

  const dockerInfo = runCommand("docker info --format '{{.ServerVersion}}'", { allowFailure: true });
  addCheck({
    id: "P2_docker_available",
    group: "prereq",
    status: dockerInfo.ok ? "PASS" : "BLOCKED",
    command: "docker info --format '{{.ServerVersion}}'",
    expected: "Docker disponible",
    observed: dockerInfo.ok
      ? `server_version=${dockerInfo.stdout.trim()}`
      : (dockerInfo.stderr || dockerInfo.stdout || "commande en echec").trim(),
    evidence: "pre-check runtime local",
  });

  const supabaseStatus = runCommand("npx supabase status", { allowFailure: true });
  const statusSignal = supabaseStatus.ok ? "PASS" : "BLOCKED";
  addCheck({
    id: "P3_supabase_local_status",
    group: "prereq",
    status: statusSignal,
    command: "npx supabase status",
    expected: "stack Supabase locale active",
    observed: supabaseStatus.ok
      ? `signal=${statusSignal}`
      : (supabaseStatus.stderr || supabaseStatus.stdout || "commande en echec").trim(),
    evidence: "pre-check runtime local",
  });

  const runbookContent = getRunbookContent();
  if (!runbookContent) {
    addCheck({
      id: "D1_runbook_exists",
      group: "documentation",
      status: "FAIL",
      command: `test -f ${RUNBOOK_PATH}`,
      expected: "runbook F8.1 present",
      observed: "fichier absent",
      evidence: RUNBOOK_PATH,
    });
  } else {
    addCheck({
      id: "D1_runbook_exists",
      group: "documentation",
      status: "PASS",
      command: `test -f ${RUNBOOK_PATH}`,
      expected: "runbook F8.1 present",
      observed: "fichier present",
      evidence: RUNBOOK_PATH,
    });

    const runbookSections = evaluateRunbookSections(runbookContent);
    addCheck({
      id: "D2_runbook_sections_complete",
      group: "documentation",
      status: runbookSections.status,
      command: `scan ${RUNBOOK_PATH}`,
      expected: "sections obligatoires du runbook presentes",
      observed: runbookSections.observed,
      evidence: runbookSections.evidence,
    });

    const envMatrix = evaluateEnvMatrix(runbookContent);
    addCheck({
      id: "D3_env_matrix_complete",
      group: "documentation",
      status: envMatrix.status,
      command: `scan ${RUNBOOK_PATH}`,
      expected: "checklist env/secrets complete local|preprod|prod",
      observed: envMatrix.observed,
      evidence: envMatrix.evidence,
    });

    const turnstileProcedure = evaluateTurnstileProcedure(runbookContent);
    addCheck({
      id: "D4_turnstile_prod_procedure_defined",
      group: "documentation",
      status: turnstileProcedure.status,
      command: `scan ${RUNBOOK_PATH}`,
      expected: "procedure Turnstile production documentee",
      observed: turnstileProcedure.observed,
      evidence: turnstileProcedure.evidence,
    });

    const goLiveSmoke = evaluateGoLiveSmoke(runbookContent);
    addCheck({
      id: "D5_go_live_smoke_defined",
      group: "documentation",
      status: goLiveSmoke.status,
      command: `scan ${RUNBOOK_PATH}`,
      expected: "checklist go-live et smoke checks documentees",
      observed: goLiveSmoke.observed,
      evidence: goLiveSmoke.evidence,
    });

    const goNoGo = evaluateGoNoGoMatrix(runbookContent);
    addCheck({
      id: "D6_go_no_go_matrix_defined",
      group: "documentation",
      status: goNoGo.status,
      command: `scan ${RUNBOOK_PATH}`,
      expected: "matrice GO/NO_GO F8.1 explicite",
      observed: goNoGo.observed,
      evidence: goNoGo.evidence,
    });

    const noSecrets = evaluateNoPlaintextSecrets(runbookContent);
    addCheck({
      id: "D7_no_plaintext_secret_in_docs",
      group: "documentation",
      status: noSecrets.status,
      command: `scan ${RUNBOOK_PATH}`,
      expected: "aucun secret en clair dans la documentation F8.1",
      observed: noSecrets.observed,
      evidence: noSecrets.evidence,
    });

    const externalE1 = evaluateExternalEvidence(
      runbookContent,
      "E1_external_turnstile_prod_domain",
      /E1_turnstile_prod_domain_validated:\s*(PASS|BLOCKED)/i,
      "E1_turnstile_prod_domain_validated"
    );
    addCheck({
      id: externalE1.id,
      group: "external",
      status: externalE1.status,
      command: `manual evidence in ${RUNBOOK_PATH}`,
      expected: "preuve externe Turnstile domaine prod = PASS",
      observed: externalE1.observed,
      evidence: externalE1.evidence,
    });

    const externalE2 = evaluateExternalEvidence(
      runbookContent,
      "E2_external_hosted_env_security_vars",
      /E2_hosted_env_security_vars_verified:\s*(PASS|BLOCKED)/i,
      "E2_hosted_env_security_vars_verified"
    );
    addCheck({
      id: externalE2.id,
      group: "external",
      status: externalE2.status,
      command: `manual evidence in ${RUNBOOK_PATH}`,
      expected: "preuve externe variables securite hebergees = PASS",
      observed: externalE2.observed,
      evidence: externalE2.evidence,
    });
  }

  const f7Guards = evaluateF7GuardsPreserved();
  addCheck({
    id: "G1_existing_f7_gates_preserved",
    group: "governance",
    status: f7Guards.status,
    command: "scan package.json + scripts/f7_*",
    expected: "garde-fous F7.4/F7.5 preserves",
    observed: f7Guards.observed,
    evidence: f7Guards.evidence,
  });

  const migrationScope = evaluateMigrationsScope();
  addCheck({
    id: "G2_no_new_sql_migration",
    group: "governance",
    status: migrationScope.status,
    command: "ls supabase/migrations",
    expected: "aucune migration SQL additionnelle dans F8.1",
    observed: migrationScope.observed,
    evidence: migrationScope.evidence,
  });

  const decision = matrix.every((row) => row.status === "PASS") ? "GO" : "NO_GO";
  const noPassChecks = matrix.filter((row) => row.status !== "PASS");

  printSectionHeader("[F8.1] PASS_FAIL_BLOCKED_MATRIX");
  for (const row of matrix) {
    console.log(
      `- ${row.id} | group=${row.group} | status=${row.status} | expected=${row.expected} | observed=${row.observed} | evidence=${row.evidence}`
    );
  }

  printSectionHeader("[F8.1] EVIDENCE_LOG");
  for (const row of matrix) {
    const controlDecision = row.status === "PASS" ? "GO" : "NO_GO";
    console.log(
      `${startedAt} | ${checkpoint} | ${row.id} | ${row.command} | ${row.expected} | ${row.observed} | ${row.status} | ${controlDecision} | ${row.evidence}`
    );
  }

  printSectionHeader("[F8.1] DECISION");
  console.log("- policy=strict_go_only_if_all_critical_pass");
  console.log(`- checkpoint=${checkpoint}`);
  console.log(`- decision=${decision}`);
  console.log(`- non_pass_checks=${noPassChecks.length}`);
  if (noPassChecks.length > 0) {
    console.log(`- reasons=${noPassChecks.map((row) => `${row.id}:${row.status}`).join(", ")}`);
  } else {
    console.log("- reasons=none");
  }

  if (enforceGo && decision !== "GO") {
    console.error("[F8.1] NO_GO (enforce-go actif).");
    process.exit(2);
  }

  console.log(`[F8.1] DONE: decision=${decision} (enforce-go=${enforceGo ? "true" : "false"}).`);
  process.exit(0);
}

run().catch((error) => {
  console.error("[F8.1] FAILED:", error.message);
  process.exit(1);
});
