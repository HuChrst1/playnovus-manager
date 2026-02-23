#!/usr/bin/env node
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const HEALTHCHECK_VIEW = "healthcheck_business_anomalies_v1";
const ALLOWED_CHECKPOINTS = new Set(["pre-release", "post-release"]);
const ACTIONABLE_DETAILS_LIMIT = 200;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseArgs(argv) {
  let checkpoint = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--checkpoint") {
      checkpoint = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg.startsWith("--checkpoint=")) {
      checkpoint = arg.slice("--checkpoint=".length);
    }
  }

  assert(
    checkpoint && ALLOWED_CHECKPOINTS.has(checkpoint),
    "Usage: node scripts/f7_3_validate_local.mjs --checkpoint pre-release|post-release"
  );

  return { checkpoint };
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
  const raw = execSync("npx supabase status -o env", {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const env = parseEnvBlock(raw);
  assert(env.API_URL, "API_URL introuvable dans `npx supabase status -o env`.");
  assert(env.ANON_KEY, "ANON_KEY introuvable dans `npx supabase status -o env`.");
  assert(
    env.SERVICE_ROLE_KEY,
    "SERVICE_ROLE_KEY introuvable dans `npx supabase status -o env`."
  );

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
  const { count, error } = await admin
    .from(viewName)
    .select("*", { head: true, count: "exact" });
  if (error) {
    throw new Error(`Vue ${viewName} illisible: ${error.message}`);
  }
  return count ?? 0;
}

async function fetchAnomalies(admin, anomaliesTotal) {
  if (anomaliesTotal <= 0) return [];

  const pageSize = 500;
  const rows = [];
  const columns = [
    "anomaly_family",
    "anomaly_code",
    "severity",
    "entity_table",
    "entity_id",
    "sale_id",
    "sale_item_id",
    "lot_id",
    "movement_id",
    "piece_ref",
    "expected_quantity",
    "observed_quantity",
    "details",
  ].join(", ");

  for (let from = 0; from < anomaliesTotal; from += pageSize) {
    const to = Math.min(from + pageSize - 1, anomaliesTotal - 1);
    const { data, error } = await admin
      .from(HEALTHCHECK_VIEW)
      .select(columns)
      .order("anomaly_family", { ascending: true })
      .order("anomaly_code", { ascending: true })
      .order("entity_table", { ascending: true })
      .order("entity_id", { ascending: true })
      .range(from, to);

    if (error) throw new Error(`Lecture anomalies failed: ${error.message}`);
    rows.push(...(data ?? []));
  }

  return rows;
}

function aggregateByFamilyCode(rows) {
  const map = new Map();
  for (const row of rows) {
    const family = String(row.anomaly_family ?? "<null>");
    const code = String(row.anomaly_code ?? "<null>");
    const severity = String(row.severity ?? "<null>");
    const key = `${family}||${code}||${severity}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const out = [];
  for (const [key, count] of map.entries()) {
    const [anomaly_family, anomaly_code, severity] = key.split("||");
    out.push({ anomaly_family, anomaly_code, severity, count });
  }

  out.sort((a, b) =>
    a.anomaly_family.localeCompare(b.anomaly_family) ||
    a.anomaly_code.localeCompare(b.anomaly_code) ||
    a.severity.localeCompare(b.severity)
  );
  return out;
}

function aggregateByFamily(rows) {
  const map = new Map();
  for (const row of rows) {
    const family = String(row.anomaly_family ?? "<null>");
    map.set(family, (map.get(family) ?? 0) + 1);
  }

  return [...map.entries()]
    .map(([anomaly_family, count]) => ({ anomaly_family, count }))
    .sort((a, b) => a.anomaly_family.localeCompare(b.anomaly_family));
}

function toScalar(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function pad(value, width) {
  const asString = String(value);
  return asString.length >= width ? asString : `${asString}${" ".repeat(width - asString.length)}`;
}

function printFamilyTable(rows) {
  console.log("[F7.3] ANOMALIES_BY_FAMILY");
  if (rows.length === 0) {
    console.log("- none");
    return;
  }
  console.log("anomaly_family | count");
  for (const row of rows) {
    console.log(`${row.anomaly_family} | ${row.count}`);
  }
}

function printFamilyCodeTable(rows) {
  console.log("[F7.3] ANOMALIES_BY_FAMILY_CODE");
  if (rows.length === 0) {
    console.log("- none");
    return;
  }

  const familyWidth = Math.max(
    "anomaly_family".length,
    ...rows.map((row) => row.anomaly_family.length)
  );
  const codeWidth = Math.max("anomaly_code".length, ...rows.map((row) => row.anomaly_code.length));
  const severityWidth = Math.max("severity".length, ...rows.map((row) => row.severity.length));

  console.log(
    `${pad("anomaly_family", familyWidth)} | ${pad("anomaly_code", codeWidth)} | ${pad(
      "severity",
      severityWidth
    )} | count`
  );
  for (const row of rows) {
    console.log(
      `${pad(row.anomaly_family, familyWidth)} | ${pad(row.anomaly_code, codeWidth)} | ${pad(
        row.severity,
        severityWidth
      )} | ${row.count}`
    );
  }
}

function printActionableDetails(rows) {
  console.log("[F7.3] ACTIONABLE_DETAILS");
  if (rows.length === 0) {
    console.log("- none");
    return;
  }

  const limitedRows = rows.slice(0, ACTIONABLE_DETAILS_LIMIT);
  for (let index = 0; index < limitedRows.length; index += 1) {
    const row = limitedRows[index];
    console.log(
      `- #${index + 1}` +
        ` family=${toScalar(row.anomaly_family)}` +
        ` code=${toScalar(row.anomaly_code)}` +
        ` severity=${toScalar(row.severity)}` +
        ` entity=${toScalar(row.entity_table)}:${toScalar(row.entity_id)}` +
        ` sale_id=${toScalar(row.sale_id)}` +
        ` sale_item_id=${toScalar(row.sale_item_id)}` +
        ` lot_id=${toScalar(row.lot_id)}` +
        ` movement_id=${toScalar(row.movement_id)}` +
        ` piece_ref=${toScalar(row.piece_ref)}` +
        ` expected=${toScalar(row.expected_quantity)}` +
        ` observed=${toScalar(row.observed_quantity)}` +
        ` details=${toScalar(row.details)}`
    );
  }

  if (rows.length > limitedRows.length) {
    console.log(
      `- ... truncated: displayed ${limitedRows.length}/${rows.length} anomalies (limit=${ACTIONABLE_DETAILS_LIMIT})`
    );
  }
}

async function run() {
  const { checkpoint } = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();

  console.log("[F7.3] Healthcheck DB gate - demarrage");
  console.log(`[F7.3] checkpoint=${checkpoint}`);
  console.log(`[F7.3] timestamp_utc=${startedAt}`);

  const localEnv = getLocalSupabaseEnv();
  const admin = createClient(localEnv.API_URL, localEnv.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const matrix = [];
  const addMatrix = (check, observed, expected, pass) => {
    matrix.push({
      check,
      observed: toScalar(observed),
      expected: toScalar(expected),
      status: pass ? "PASS" : "FAIL",
    });
  };

  const healthcheckRows = await assertViewReadable(admin, HEALTHCHECK_VIEW);
  addMatrix("S1_healthcheck_view_readable", healthcheckRows, "readable", true);

  const anomaliesTotal = await countRows(admin, HEALTHCHECK_VIEW);
  addMatrix("S2_healthcheck_anomalies_total", anomaliesTotal, 0, anomaliesTotal === 0);

  const anomalies = await fetchAnomalies(admin, anomaliesTotal);
  assert(
    anomalies.length === anomaliesTotal,
    `Nombre d'anomalies incoherent: count=${anomaliesTotal}, fetched=${anomalies.length}`
  );

  const negativeStockRows = await countRows(admin, "stock_balance", [["lt", "quantity", 0]]);
  addMatrix("S5_negative_stock_rows", negativeStockRows, 0, negativeStockRows === 0);

  const stockPerPieceRows = await assertViewReadable(admin, "stock_per_piece");
  addMatrix("S6_stock_per_piece_readable", stockPerPieceRows, "readable", true);

  const stockJournalRows = await assertViewReadable(admin, "stock_journal");
  addMatrix("S6_stock_journal_readable", stockJournalRows, "readable", true);

  const pieceMovementsRows = await assertViewReadable(admin, "piece_movements");
  addMatrix("S6_piece_movements_readable", pieceMovementsRows, "readable", true);

  const familySummary = aggregateByFamily(anomalies);
  const familyCodeSummary = aggregateByFamilyCode(anomalies);

  console.log("");
  console.log("[F7.3] PASS_FAIL_MATRIX");
  for (const row of matrix) {
    console.log(
      `- ${row.check} | status=${row.status} | observed=${row.observed} | expected=${row.expected}`
    );
  }

  console.log("");
  printFamilyTable(familySummary);

  console.log("");
  printFamilyCodeTable(familyCodeSummary);

  console.log("");
  printActionableDetails(anomalies);

  const gateFailedOutsideAnomalies = matrix.some(
    (row) => row.status === "FAIL" && row.check !== "S2_healthcheck_anomalies_total"
  );
  const blocked = anomaliesTotal > 0;
  const decision = blocked ? "BLOCKED" : "PASS";

  console.log("");
  console.log("[F7.3] DECISION");
  console.log("- policy=strict_blocking");
  console.log(`- checkpoint=${checkpoint}`);
  console.log(`- decision=${decision}`);
  console.log(`- anomalies_total=${anomaliesTotal}`);
  console.log(`- negative_stock_rows=${negativeStockRows}`);

  if (blocked) {
    console.error(`[F7.3] BLOCKED: anomalies detectees (${anomaliesTotal}).`);
    process.exit(2);
  }

  if (gateFailedOutsideAnomalies) {
    console.error("[F7.3] FAILED: un controle critique hors anomalies est en echec.");
    process.exit(1);
  }

  console.log("[F7.3] PASS: gate healthcheck valide.");
  process.exit(0);
}

run().catch((error) => {
  console.error("[F7.3] FAILED:", error.message);
  process.exit(1);
});
