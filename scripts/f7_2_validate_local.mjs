#!/usr/bin/env node
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const BUILD_RUNTIME_PATH = path.join(
  ROOT,
  ".next",
  "server",
  "chunks",
  "ssr",
  "[turbopack]_runtime.js"
);
const TOKEN = `F72_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
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

function setupLocalEnv(localEnv) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = localEnv.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = localEnv.ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = localEnv.SERVICE_ROLE_KEY;
}

function runLocalOnlyBuild(localEnv) {
  const buildEnv = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: localEnv.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: localEnv.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: localEnv.SERVICE_ROLE_KEY,
  };

  execSync("npm run build", {
    cwd: ROOT,
    stdio: "inherit",
    env: buildEnv,
  });
}

function loadRuntimeForRoute(routePath) {
  const relativePagePath = routePath
    ? path.join(".next", "server", "app", routePath, "page.js")
    : path.join(".next", "server", "app", "page.js");
  const runtimeKey = routePath
    ? `server/app/${routePath}/page.js`
    : "server/app/page.js";
  const pagePath = path.join(ROOT, relativePagePath);
  const pageJs = readFileSync(pagePath, "utf8");

  const runtimeFactory = require(BUILD_RUNTIME_PATH);
  const runtime = runtimeFactory(runtimeKey);

  for (const match of pageJs.matchAll(/R\.c\("([^"]+)"\)/g)) {
    runtime.c(match[1]);
  }

  return runtime;
}

function patchNextCacheForRuntime(runtime) {
  try {
    const cacheExports = runtime.m(18558).exports;
    if (cacheExports && typeof cacheExports.revalidatePath === "function") {
      cacheExports.revalidatePath = () => {};
    }
  } catch {
    // non bloquant
  }

  try {
    const nextCache = require("next/cache");
    if (nextCache && typeof nextCache.revalidatePath === "function") {
      nextCache.revalidatePath = () => {};
    }
  } catch {
    // non bloquant
  }
}

function loadServerActions(routePath, actionNames) {
  const runtime = loadRuntimeForRoute(routePath);
  patchNextCacheForRuntime(runtime);

  const manifestPath = path.join(
    ROOT,
    ".next",
    "server",
    "app",
    routePath,
    "page",
    "server-reference-manifest.json"
  );

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const actionEntries = Object.entries(manifest.node ?? {});
  assert(actionEntries.length > 0, `Aucune server action detectee pour ${routePath}.`);

  const workerKey = `app/${routePath}/page`;
  const worker = actionEntries[0][1]?.workers?.[workerKey];
  const moduleId = worker?.moduleId;
  assert(Number.isInteger(moduleId), `moduleId action introuvable pour ${workerKey}.`);

  const moduleExports = runtime.m(moduleId).exports;
  const actions = {};

  for (const exportedName of actionNames) {
    const entry = actionEntries.find(([, value]) => value?.exportedName === exportedName);
    assert(entry, `Action \`${exportedName}\` absente du manifest (${workerKey}).`);

    const actionId = entry[0];
    const fn = moduleExports[actionId];
    assert(typeof fn === "function", `Action \`${exportedName}\` non resolvable.`);
    actions[exportedName] = fn;
  }

  return actions;
}

async function querySingle(admin, table, columns, filters = []) {
  let query = admin.from(table).select(columns).limit(1).maybeSingle();
  for (const [op, field, value] of filters) {
    if (op === "eq") query = query.eq(field, value);
  }

  const { data, error } = await query;
  if (error) throw new Error(`${table} select single failed: ${error.message}`);
  return data;
}

async function queryRows(admin, table, columns, filters = [], orderBy) {
  let query = admin.from(table).select(columns).limit(1000);

  for (const [op, field, value] of filters) {
    if (op === "eq") query = query.eq(field, value);
    if (op === "in") query = query.in(field, value);
    if (op === "like") query = query.like(field, value);
  }

  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending });
  }

  const { data, error } = await query;
  if (error) throw new Error(`${table} select failed: ${error.message}`);
  return data ?? [];
}

async function createDraftLot(approActions, input) {
  const result = await approActions.createLotFromDialog({
    purchaseDate: input.purchaseDate,
    label: input.label,
    supplier: "F7.2 Validation",
    totalCost: input.totalCost,
    status: "draft",
    notes: `${TOKEN} ${input.label}`,
  });

  assert(result?.success === true, `Creation lot draft echouee: ${JSON.stringify(result)}`);
  assert(Number.isFinite(result?.lotId), `lotId invalide: ${JSON.stringify(result)}`);
  return Number(result.lotId);
}

async function insertInventoryRows(admin, lotId, rows) {
  const payload = rows.map((row) => ({
    lot_id: lotId,
    piece_ref: row.pieceRef,
    quantity: row.quantity,
    location: "F72_TEST",
    unit_cost: row.unitCost,
  }));

  const { error } = await admin.from("inventory").insert(payload);
  if (error) throw new Error(`insert inventory failed for lot ${lotId}: ${error.message}`);

  const totalPieces = rows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
  const { error: updateLotError } = await admin
    .from("lots")
    .update({ total_pieces: totalPieces })
    .eq("id", lotId);

  if (updateLotError) {
    throw new Error(`update lot total_pieces failed for lot ${lotId}: ${updateLotError.message}`);
  }
}

async function loadLotForUpdate(admin, lotId) {
  const lot = await querySingle(
    admin,
    "lots",
    "id, purchase_date, label, supplier, lot_code, total_cost, status, notes",
    [["eq", "id", lotId]]
  );
  assert(lot, `Lot ${lotId} introuvable.`);
  return lot;
}

function toUpdateArgs(lot, nextStatus) {
  return {
    purchaseDate: lot.purchase_date,
    label: lot.label ?? undefined,
    supplier: lot.supplier ?? undefined,
    lotCode: lot.lot_code ?? undefined,
    totalCost: Number(lot.total_cost ?? 0),
    status: nextStatus,
    notes: lot.notes ?? undefined,
  };
}

async function confirmLot(approActions, admin, lotId) {
  const lot = await loadLotForUpdate(admin, lotId);
  const result = await approActions.updateLotFromDialog(
    lotId,
    toUpdateArgs(lot, "confirmed")
  );
  assert(result?.success === true, `Confirmation lot ${lotId} echouee: ${JSON.stringify(result)}`);
}

async function getStockBalanceQty(admin, pieceRef, lotId) {
  const row = await querySingle(
    admin,
    "stock_balance",
    "quantity",
    [
      ["eq", "piece_ref", pieceRef],
      ["eq", "lot_id", lotId],
    ]
  );
  return Number(row?.quantity ?? 0);
}

function aggregateByPiece(rows) {
  const map = new Map();
  for (const row of rows) {
    const ref = String(row.piece_ref ?? "").trim();
    const qty = Number(row.quantity ?? 0);
    if (!ref || !Number.isFinite(qty)) continue;
    map.set(ref, (map.get(ref) ?? 0) + qty);
  }
  return map;
}

async function run() {
  console.log("[F7.2] Validation locale d'appui - demarrage");
  console.log(`[F7.2] Run token: ${TOKEN}`);

  const localEnv = getLocalSupabaseEnv();
  setupLocalEnv(localEnv);

  console.log("[F7.2] Build local-only (actions/pages compilees avec URL locale)");
  runLocalOnlyBuild(localEnv);

  const admin = createClient(localEnv.API_URL, localEnv.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const approActions = loadServerActions("approvisionnement", [
    "createLotFromDialog",
    "updateLotFromDialog",
  ]);

  const salesActions = loadServerActions("ventes", [
    "createSaleAction",
    "deleteSaleAction",
  ]);

  const lotIds = [];
  const setIds = [];
  const saleIds = [];
  const records = [];
  const record = (name) => {
    records.push(name);
    console.log(`[F7.2] OK - ${name}`);
  };

  const pieceInsufficient = `${TOKEN}_PIECE_INSUFF`;
  const pieceSetA = `${TOKEN}_SET_A`;
  const pieceSetB = `${TOKEN}_SET_B`;
  const setId = `${TOKEN}_SET`;

  try {
    // S4 - vente PIECE refusee si stock insuffisant
    {
      const lotId = await createDraftLot(approActions, {
        purchaseDate: "2029-01-10",
        label: `${TOKEN} S4 LOT`,
        totalCost: 20,
      });
      lotIds.push(lotId);

      await insertInventoryRows(admin, lotId, [
        { pieceRef: pieceInsufficient, quantity: 2, unitCost: 10 },
      ]);
      await confirmLot(approActions, admin, lotId);

      const beforeQty = await getStockBalanceQty(admin, pieceInsufficient, lotId);
      assert(beforeQty === 2, `S4 stock initial attendu=2, recu=${beforeQty}`);

      const saleResult = await salesActions.createSaleAction({
        sale_type: "PIECE",
        sales_channel: "DIRECT",
        paid_at: "2029-01-11T10:00:00.000Z",
        net_seller_amount: 100,
        currency: "EUR",
        comment: `${TOKEN} S4 INSUFF`,
        items: [
          {
            item_kind: "PIECE",
            piece_ref: pieceInsufficient,
            quantity: 3,
            is_partial_set: false,
            net_amount: 100,
            comment: `${TOKEN} S4 INSUFF ITEM`,
          },
        ],
      });

      assert(
        saleResult?.success === false,
        `S4 attendu refuse (stock insuffisant), recu=${JSON.stringify(saleResult)}`
      );

      const afterQty = await getStockBalanceQty(admin, pieceInsufficient, lotId);
      assert(afterQty === beforeQty, `S4 stock ne doit pas bouger: avant=${beforeQty}, apres=${afterQty}`);

      const leakedSales = await queryRows(
        admin,
        "sales",
        "id",
        [["like", "comment", `${TOKEN} S4 INSUFF%`]]
      );
      assert(leakedSales.length === 0, `S4 vente residuelle inattendue: count=${leakedSales.length}`);

      record("S4 vente PIECE refusee si stock insuffisant");
    }

    // S5 + S10 - vente SET + audit detail pieces + coherence completion catalogue
    {
      const { error: setInsertError } = await admin.from("sets_catalog").insert({
        id: setId,
        display_ref: setId,
        name: `${TOKEN} Test Set`,
        theme: "F72",
        version: "v1",
      });
      if (setInsertError) {
        throw new Error(`Insertion set echouee: ${setInsertError.message}`);
      }
      setIds.push(setId);

      const { error: bomError } = await admin.from("sets_bom").insert([
        { set_id: setId, piece_ref: pieceSetA, quantity: 2, piece_name: `${TOKEN} Piece A` },
        { set_id: setId, piece_ref: pieceSetB, quantity: 1, piece_name: `${TOKEN} Piece B` },
      ]);
      if (bomError) {
        throw new Error(`Insertion BOM echouee: ${bomError.message}`);
      }

      const lotAId = await createDraftLot(approActions, {
        purchaseDate: "2029-02-01",
        label: `${TOKEN} S5 LOT A`,
        totalCost: 10,
      });
      lotIds.push(lotAId);
      await insertInventoryRows(admin, lotAId, [
        { pieceRef: pieceSetA, quantity: 10, unitCost: 1 },
      ]);
      await confirmLot(approActions, admin, lotAId);

      const lotBId = await createDraftLot(approActions, {
        purchaseDate: "2029-02-01",
        label: `${TOKEN} S5 LOT B`,
        totalCost: 20,
      });
      lotIds.push(lotBId);
      await insertInventoryRows(admin, lotBId, [
        { pieceRef: pieceSetB, quantity: 10, unitCost: 2 },
      ]);
      await confirmLot(approActions, admin, lotBId);

      const completionBefore = await querySingle(
        admin,
        "set_with_completion",
        "id, max_complete_sets, total_parts_owned, total_parts_needed, completion_percent",
        [["eq", "id", setId]]
      );
      assert(completionBefore, "S10 set_with_completion introuvable avant vente.");
      const maxBefore = Number(completionBefore.max_complete_sets ?? 0);
      assert(maxBefore >= 5, `S10 max_complete_sets avant vente inattendu: ${maxBefore}`);

      const saleResult = await salesActions.createSaleAction({
        sale_type: "SET",
        sales_channel: "DIRECT",
        paid_at: "2029-02-02T10:00:00.000Z",
        net_seller_amount: 120,
        currency: "EUR",
        comment: `${TOKEN} S5 SET`,
        items: [
          {
            item_kind: "SET",
            set_id: setId,
            quantity: 2,
            is_partial_set: false,
            net_amount: 120,
            comment: `${TOKEN} S5 SET ITEM`,
          },
        ],
      });

      assert(saleResult?.success === true, `S5 vente SET echouee: ${JSON.stringify(saleResult)}`);
      assert(Number.isFinite(saleResult?.saleId), `S5 saleId invalide: ${JSON.stringify(saleResult)}`);
      const saleId = Number(saleResult.saleId);
      saleIds.push(saleId);

      const saleItems = await queryRows(
        admin,
        "sale_items",
        "id, item_kind, set_id",
        [["eq", "sale_id", saleId]]
      );
      assert(saleItems.length === 1, `S5 sale_items attendu=1, recu=${saleItems.length}`);
      assert(
        String(saleItems[0].item_kind ?? "") === "SET" &&
          String(saleItems[0].set_id ?? "") === setId,
        `S5 ligne SET inattendue: ${JSON.stringify(saleItems[0])}`
      );

      const snapshotRows = await queryRows(
        admin,
        "sale_item_pieces",
        "piece_ref, quantity",
        [["eq", "sale_id", saleId]]
      );
      const snapshotByPiece = aggregateByPiece(snapshotRows);
      assert(snapshotByPiece.get(pieceSetA) === 4, `S5 snapshot ${pieceSetA} attendu=4`);
      assert(snapshotByPiece.get(pieceSetB) === 2, `S5 snapshot ${pieceSetB} attendu=2`);

      const stockAAfter = await getStockBalanceQty(admin, pieceSetA, lotAId);
      const stockBAfter = await getStockBalanceQty(admin, pieceSetB, lotBId);
      assert(stockAAfter === 6, `S5 stock ${pieceSetA} attendu=6, recu=${stockAAfter}`);
      assert(stockBAfter === 8, `S5 stock ${pieceSetB} attendu=8, recu=${stockBAfter}`);

      const completionAfter = await querySingle(
        admin,
        "set_with_completion",
        "id, max_complete_sets, total_parts_owned, total_parts_needed, completion_percent",
        [["eq", "id", setId]]
      );
      assert(completionAfter, "S10 set_with_completion introuvable apres vente.");
      const maxAfter = Number(completionAfter.max_complete_sets ?? 0);
      assert(maxAfter === maxBefore - 2, `S10 max_complete_sets attendu=${maxBefore - 2}, recu=${maxAfter}`);

      record("S5 vente SET creee avec audit sale_item_pieces coherent");
      record("S10 completion catalogue coherente avec la sortie stock");
    }

    console.log("[F7.2] Validation terminee - scenarios passes:");
    for (const name of records) console.log(`- ${name}`);
  } finally {
    for (const saleId of [...saleIds].reverse()) {
      try {
        await salesActions.deleteSaleAction(saleId);
      } catch {
        // best-effort
      }
    }

    if (lotIds.length > 0) {
      await admin.from("stock_movements").delete().in("lot_id", lotIds);
      await admin.from("inventory").delete().in("lot_id", lotIds);
      await admin.from("lots").delete().in("id", lotIds);
    }

    if (setIds.length > 0) {
      await admin.from("sets_bom").delete().in("set_id", setIds);
      await admin.from("sets_catalog").delete().in("id", setIds);
    }
  }
}

run().catch((error) => {
  console.error("[F7.2] FAILED:", error.message);
  process.exit(1);
});
