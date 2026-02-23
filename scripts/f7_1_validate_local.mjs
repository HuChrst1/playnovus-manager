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
const KPI_RANGE = {
  from: "2028-06-01",
  to: "2028-06-10",
};
const TOKEN = `F71_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertAlmostEqual(actual, expected, label, epsilon = 1e-6) {
  if (actual === null || expected === null) {
    assert(actual === expected, `${label}: attendu=${expected}, recu=${actual}`);
    return;
  }

  const a = Number(actual);
  const e = Number(expected);
  assert(Number.isFinite(a), `${label}: valeur actuelle non numerique (${actual})`);
  assert(Number.isFinite(e), `${label}: valeur attendue non numerique (${expected})`);

  const delta = Math.abs(a - e);
  assert(
    delta <= epsilon,
    `${label}: attendu=${e}, recu=${a}, delta=${delta}, epsilon=${epsilon}`
  );
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

  return { runtime, pageJs };
}

function patchNextCacheForRuntime(runtime) {
  try {
    const cacheExports = runtime.m(18558).exports;
    if (cacheExports && typeof cacheExports.revalidatePath === "function") {
      cacheExports.revalidatePath = () => {};
    }
  } catch {
    // Non bloquant: l'id interne peut varier selon le build.
  }

  try {
    const nextCache = require("next/cache");
    if (nextCache && typeof nextCache.revalidatePath === "function") {
      nextCache.revalidatePath = () => {};
    }
  } catch {
    // Non bloquant hors runtime HTTP Next.
  }
}

function loadServerActions(routePath, actionNames) {
  const { runtime } = loadRuntimeForRoute(routePath);
  patchNextCacheForRuntime(runtime);

  const manifestPath = routePath
    ? path.join(
        ROOT,
        ".next",
        "server",
        "app",
        routePath,
        "page",
        "server-reference-manifest.json"
      )
    : path.join(
        ROOT,
        ".next",
        "server",
        "app",
        "page",
        "server-reference-manifest.json"
      );

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const actionEntries = Object.entries(manifest.node ?? {});
  assert(actionEntries.length > 0, `Aucune server action detectee pour ${routePath || "/"}.`);

  const workerKey = routePath ? `app/${routePath}/page` : "app/page";
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

function findModuleIds(runtime, predicate, maxId = 150000) {
  const ids = [];
  for (let id = 1; id <= maxId; id += 1) {
    try {
      const exports = runtime.m(id).exports;
      if (exports && predicate(exports, id)) ids.push(id);
    } catch {
      // module id absent ou echec d'evaluation non pertinent
    }
  }
  return ids;
}

async function querySingle(admin, table, columns, filters = []) {
  let query = admin.from(table).select(columns).limit(1).maybeSingle();
  for (const [op, field, value] of filters) {
    if (op === "eq") query = query.eq(field, value);
    if (op === "not_null") query = query.not(field, "is", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(`${table} select single failed: ${error.message}`);
  return data;
}

async function queryRows(admin, table, columns, filters = [], orderBy) {
  let query = admin.from(table).select(columns).limit(1000);

  for (const [op, field, value] of filters) {
    if (op === "eq") query = query.eq(field, value);
    if (op === "gte") query = query.gte(field, value);
    if (op === "lte") query = query.lte(field, value);
    if (op === "lt") query = query.lt(field, value);
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

async function countRows(admin, table, filters = []) {
  let query = admin.from(table).select("*", { head: true, count: "exact" });
  for (const [op, field, value] of filters) {
    if (op === "eq") query = query.eq(field, value);
    if (op === "lt") query = query.lt(field, value);
    if (op === "in") query = query.in(field, value);
  }

  const { count, error } = await query;
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

async function sumInventoryQty(admin, lotId) {
  const rows = await queryRows(admin, "inventory", "quantity", [["eq", "lot_id", lotId]]);
  return rows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
}

async function sumPurchaseInQty(admin, lotId) {
  const rows = await queryRows(
    admin,
    "stock_movements",
    "quantity",
    [
      ["eq", "source_type", "PURCHASE"],
      ["eq", "direction", "IN"],
      ["eq", "lot_id", lotId],
    ]
  );
  return rows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
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

async function insertInventoryRows(admin, lotId, rows) {
  const payload = rows.map((row) => ({
    lot_id: lotId,
    piece_ref: row.pieceRef,
    quantity: row.quantity,
    location: "F71_TEST",
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

async function createDraftLot(approActions, input) {
  const result = await approActions.createLotFromDialog({
    purchaseDate: input.purchaseDate,
    label: input.label,
    supplier: "F7.1 Validation",
    totalCost: input.totalCost,
    status: "draft",
    notes: `${TOKEN} ${input.label}`,
  });

  assert(result?.success === true, `Creation lot draft echouee: ${JSON.stringify(result)}`);
  assert(Number.isFinite(result?.lotId), `lotId invalide: ${JSON.stringify(result)}`);
  return Number(result.lotId);
}

async function createConfirmedLotForKpi(admin, payload) {
  const { data, error } = await admin
    .from("lots")
    .insert({
      lot_code: `${TOKEN}_${payload.code}`,
      label: `${TOKEN} KPI ${payload.code}`,
      purchase_date: payload.purchaseDate,
      supplier: "F7.1 KPI",
      total_pieces: payload.totalPieces,
      total_cost: payload.totalCost,
      status: "confirmed",
      notes: `${TOKEN} KPI lot`,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`creation lot KPI echouee: ${error?.message ?? "no data"}`);
  }

  return Number(data.id);
}

async function insertKpiSales(admin, salesRows) {
  const payload = salesRows.map((row, index) => ({
    sale_number: `${TOKEN}_KPI_${index + 1}`,
    sale_type: row.saleType,
    sales_channel: row.channel,
    status: row.status,
    net_seller_amount: row.net,
    currency: "EUR",
    buyer_paid_total: row.net,
    vat_rate: null,
    total_cost_amount: row.cost,
    total_margin_amount: row.margin,
    margin_rate: row.net > 0 ? row.margin / row.net : null,
    paid_at: row.paidAt,
    comment: `${TOKEN} KPI SALE`,
  }));

  const { data, error } = await admin
    .from("sales")
    .insert(payload)
    .select("id");
  if (error) throw new Error(`insert sales KPI failed: ${error.message}`);

  return (data ?? []).map((row) => Number(row.id));
}

function sumNumbers(values) {
  return values.reduce((sum, value) => sum + Number(value ?? 0), 0);
}

function walkReactTree(node, visitor) {
  if (node === null || node === undefined) return;

  if (Array.isArray(node)) {
    for (const item of node) walkReactTree(item, visitor);
    return;
  }

  if (typeof node !== "object") return;

  visitor(node);
  const props = node.props;
  if (!props) return;

  if ("children" in props) {
    walkReactTree(props.children, visitor);
  }
}

async function fetchSalesViewFromPage(ventesRuntime, params) {
  const candidates = findModuleIds(
    ventesRuntime,
    (exports) =>
      typeof exports?.default === "function" && exports?.dynamic === "force-dynamic",
    150000
  );
  assert(candidates.length > 0, "Module page ventes introuvable.");

  for (const moduleId of candidates) {
    const pageModule = ventesRuntime.m(moduleId).exports;
    if (typeof pageModule.default !== "function") continue;

    try {
      const element = await pageModule.default({
        searchParams: Promise.resolve(params),
      });

      const cards = {};
      let tableTotalCount = null;

      walkReactTree(element, (node) => {
        const props = node?.props;
        if (!props) return;

        if (typeof props.title === "string" && "mainValue" in props) {
          cards[props.title] = String(props.mainValue);
        }

        if (
          props.pagination &&
          Number.isFinite(Number(props.pagination.totalCount))
        ) {
          tableTotalCount = Number(props.pagination.totalCount);
        }
      });

      if (
        Object.keys(cards).length >= 5 &&
        tableTotalCount !== null
      ) {
        return { cards, tableTotalCount };
      }
    } catch {
      // On tente le module candidat suivant.
    }
  }

  throw new Error("Impossible de recuperer les KPIs de la page /ventes.");
}

async function fetchDashboardFromPage(dashboardRuntime, params) {
  const candidates = findModuleIds(
    dashboardRuntime,
    (exports) =>
      typeof exports?.default === "function" && exports?.dynamic === "force-dynamic",
    150000
  );
  assert(candidates.length > 0, "Module page dashboard introuvable.");

  for (const moduleId of candidates) {
    const pageModule = dashboardRuntime.m(moduleId).exports;
    if (typeof pageModule.default !== "function") continue;

    try {
      const element = await pageModule.default({
        searchParams: Promise.resolve(params),
      });
      const dashboard = element?.props?.dashboard;
      if (dashboard?.contractVersion) return dashboard;
    } catch {
      // On tente le module candidat suivant.
    }
  }

  throw new Error("Impossible de recuperer les donnees dashboard depuis la page.");
}

function getKpiValue(dashboard, key) {
  const row = (dashboard.kpis ?? []).find((kpi) => kpi.key === key);
  assert(row, `KPI dashboard manquant: ${key}`);
  return row.value;
}

async function run() {
  console.log("[F7.1] Validation locale flux critiques - demarrage");
  console.log(`[F7.1] Run token: ${TOKEN}`);

  const localEnv = getLocalSupabaseEnv();
  setupLocalEnv(localEnv);

  console.log("[F7.1] Build local-only (actions/pages compilees avec URL locale)");
  runLocalOnlyBuild(localEnv);

  const admin = createClient(localEnv.API_URL, localEnv.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const approActions = loadServerActions("approvisionnement", [
    "createLotFromDialog",
    "updateLotFromDialog",
    "deleteLot",
  ]);

  const salesActions = loadServerActions("ventes", [
    "createSaleAction",
    "cancelSaleAction",
    "deleteSaleAction",
  ]);

  const { runtime: ventesRuntime } = loadRuntimeForRoute("ventes");
  const { runtime: dashboardRuntime } = loadRuntimeForRoute("");

  const actionSaleIds = [];
  const directSaleIds = [];
  const lotIds = [];
  const records = [];
  const record = (name) => {
    records.push(name);
    console.log(`[F7.1] OK - ${name}`);
  };

  const fifoPieceRef = `${TOKEN}_FIFO_PIECE`;
  const cancelPieceRef = `${TOKEN}_CANCEL_PIECE`;
  const kpiChannel = "DIRECT";

  try {
    // S1 - FIFO oldest-first
    {
      const lot1Id = await createDraftLot(approActions, {
        purchaseDate: "2027-01-10",
        label: `${TOKEN} S1 LOT1`,
        totalCost: 2,
      });
      lotIds.push(lot1Id);
      await insertInventoryRows(admin, lot1Id, [
        { pieceRef: fifoPieceRef, quantity: 2, unitCost: 1.0 },
      ]);
      const lot1 = await loadLotForUpdate(admin, lot1Id);
      const lot1Confirm = await approActions.updateLotFromDialog(
        lot1Id,
        toUpdateArgs(lot1, "confirmed")
      );
      assert(lot1Confirm?.success === true, `S1 lot1 confirm echec: ${JSON.stringify(lot1Confirm)}`);

      const lot2Id = await createDraftLot(approActions, {
        purchaseDate: "2027-01-11",
        label: `${TOKEN} S1 LOT2`,
        totalCost: 6,
      });
      lotIds.push(lot2Id);
      await insertInventoryRows(admin, lot2Id, [
        { pieceRef: fifoPieceRef, quantity: 3, unitCost: 2.0 },
      ]);
      const lot2 = await loadLotForUpdate(admin, lot2Id);
      const lot2Confirm = await approActions.updateLotFromDialog(
        lot2Id,
        toUpdateArgs(lot2, "confirmed")
      );
      assert(lot2Confirm?.success === true, `S1 lot2 confirm echec: ${JSON.stringify(lot2Confirm)}`);

      const saleResult = await salesActions.createSaleAction({
        sale_type: "PIECE",
        sales_channel: "DIRECT",
        paid_at: "2027-01-12T10:00:00.000Z",
        net_seller_amount: 40,
        currency: "EUR",
        comment: `${TOKEN} S1 FIFO`,
        items: [
          {
            item_kind: "PIECE",
            piece_ref: fifoPieceRef,
            quantity: 4,
            is_partial_set: false,
            net_amount: 40,
            comment: `${TOKEN} S1 FIFO item`,
          },
        ],
      });

      assert(saleResult?.success === true, `S1 createSaleAction echec: ${JSON.stringify(saleResult)}`);
      assert(Number.isFinite(saleResult?.saleId), `S1 saleId invalide: ${JSON.stringify(saleResult)}`);

      const saleId = Number(saleResult.saleId);
      actionSaleIds.push(saleId);

      const snapshotRows = await queryRows(
        admin,
        "sale_item_pieces",
        "lot_id, quantity, piece_ref",
        [
          ["eq", "sale_id", saleId],
          ["eq", "piece_ref", fifoPieceRef],
        ],
        { column: "id", ascending: true }
      );

      assert(snapshotRows.length === 2, `S1 snapshot attendu=2, recu=${snapshotRows.length}`);
      assert(
        Number(snapshotRows[0].lot_id) === lot1Id &&
          Number(snapshotRows[0].quantity) === 2,
        `S1 FIFO lot1 attendu qty=2, recu=${JSON.stringify(snapshotRows[0])}`
      );
      assert(
        Number(snapshotRows[1].lot_id) === lot2Id &&
          Number(snapshotRows[1].quantity) === 2,
        `S1 FIFO lot2 attendu qty=2, recu=${JSON.stringify(snapshotRows[1])}`
      );

      const lot1Qty = await getStockBalanceQty(admin, fifoPieceRef, lot1Id);
      const lot2Qty = await getStockBalanceQty(admin, fifoPieceRef, lot2Id);
      assert(lot1Qty === 0, `S1 stock lot1 attendu=0, recu=${lot1Qty}`);
      assert(lot2Qty === 1, `S1 stock lot2 attendu=1, recu=${lot2Qty}`);

      record("S1 FIFO oldest-first coherent");
    }

    // S2 - confirmation lot draft non vide -> PURCHASE/IN coherent
    {
      const lotId = await createDraftLot(approActions, {
        purchaseDate: "2027-02-01",
        label: `${TOKEN} S2 LOT`,
        totalCost: 5,
      });
      lotIds.push(lotId);
      await insertInventoryRows(admin, lotId, [
        { pieceRef: `${TOKEN}_S2_A`, quantity: 2, unitCost: 1.2 },
        { pieceRef: `${TOKEN}_S2_B`, quantity: 1, unitCost: 0.8 },
      ]);

      const lot = await loadLotForUpdate(admin, lotId);
      const result = await approActions.updateLotFromDialog(
        lotId,
        toUpdateArgs(lot, "confirmed")
      );
      assert(result?.success === true, `S2 confirmation echec: ${JSON.stringify(result)}`);

      const invQty = await sumInventoryQty(admin, lotId);
      const purchaseQty = await sumPurchaseInQty(admin, lotId);
      assert(invQty === 3, `S2 inventory attendue=3, recu=${invQty}`);
      assert(
        purchaseQty === invQty,
        `S2 incoherence PURCHASE/IN vs inventory: purchase=${purchaseQty}, inventory=${invQty}`
      );

      record("S2 confirmation lot non vide coherent");
    }

    // S3 - refus confirmation lot vide / incoherent
    {
      const lotId = await createDraftLot(approActions, {
        purchaseDate: "2027-02-02",
        label: `${TOKEN} S3 LOT`,
        totalCost: 5,
      });
      lotIds.push(lotId);

      const lotEmpty = await loadLotForUpdate(admin, lotId);
      const emptyResult = await approActions.updateLotFromDialog(
        lotId,
        toUpdateArgs(lotEmpty, "confirmed")
      );
      assert(emptyResult?.success === false, "S3 (lot vide) devrait etre refuse.");
      assert(
        String(emptyResult?.error ?? "").toLowerCase().includes("lot vide"),
        `S3 (lot vide) message inattendu: ${JSON.stringify(emptyResult)}`
      );

      const purchaseAfterEmpty = await sumPurchaseInQty(admin, lotId);
      assert(purchaseAfterEmpty === 0, `S3 (lot vide) PURCHASE inattendu: ${purchaseAfterEmpty}`);

      const { error: forcePiecesError } = await admin
        .from("lots")
        .update({ total_pieces: 5 })
        .eq("id", lotId);
      if (forcePiecesError) {
        throw new Error(`S3 setup incoherent failed: ${forcePiecesError.message}`);
      }

      const lotInconsistent = await loadLotForUpdate(admin, lotId);
      const inconsistentResult = await approActions.updateLotFromDialog(
        lotId,
        toUpdateArgs(lotInconsistent, "confirmed")
      );
      assert(
        inconsistentResult?.success === false &&
          inconsistentResult?.reason === "LOT_CONFIRMATION_INCONSISTENT",
        `S3 (incoherent) attendu LOT_CONFIRMATION_INCONSISTENT, recu=${JSON.stringify(inconsistentResult)}`
      );

      const purchaseAfterInconsistent = await sumPurchaseInQty(admin, lotId);
      assert(
        purchaseAfterInconsistent === 0,
        `S3 (incoherent) PURCHASE inattendu: ${purchaseAfterInconsistent}`
      );

      record("S3 refus confirmation lot vide/incoherent");
    }

    // S4 - annulation vente: CANCELLED + mouvements IN miroirs + stock restaure
    {
      const lotId = await createDraftLot(approActions, {
        purchaseDate: "2027-03-01",
        label: `${TOKEN} S4 LOT`,
        totalCost: 10,
      });
      lotIds.push(lotId);
      await insertInventoryRows(admin, lotId, [
        { pieceRef: cancelPieceRef, quantity: 5, unitCost: 2.0 },
      ]);
      const lot = await loadLotForUpdate(admin, lotId);
      const confirm = await approActions.updateLotFromDialog(
        lotId,
        toUpdateArgs(lot, "confirmed")
      );
      assert(confirm?.success === true, `S4 setup confirmation echec: ${JSON.stringify(confirm)}`);

      const stockBeforeSale = await getStockBalanceQty(admin, cancelPieceRef, lotId);
      assert(stockBeforeSale === 5, `S4 stock initial attendu=5, recu=${stockBeforeSale}`);

      const saleResult = await salesActions.createSaleAction({
        sale_type: "PIECE",
        sales_channel: "DIRECT",
        paid_at: "2027-03-02T10:00:00.000Z",
        net_seller_amount: 30,
        currency: "EUR",
        comment: `${TOKEN} S4 CANCEL`,
        items: [
          {
            item_kind: "PIECE",
            piece_ref: cancelPieceRef,
            quantity: 3,
            is_partial_set: false,
            net_amount: 30,
            comment: `${TOKEN} S4 item`,
          },
        ],
      });
      assert(saleResult?.success === true, `S4 createSaleAction echec: ${JSON.stringify(saleResult)}`);
      assert(Number.isFinite(saleResult?.saleId), `S4 saleId invalide: ${JSON.stringify(saleResult)}`);

      const saleId = Number(saleResult.saleId);
      actionSaleIds.push(saleId);

      const stockAfterSale = await getStockBalanceQty(admin, cancelPieceRef, lotId);
      assert(stockAfterSale === 2, `S4 stock apres vente attendu=2, recu=${stockAfterSale}`);

      const cancelResult = await salesActions.cancelSaleAction(saleId);
      assert(cancelResult?.ok === true, `S4 cancelSaleAction echec: ${JSON.stringify(cancelResult)}`);

      const saleRow = await querySingle(
        admin,
        "sales",
        "status",
        [["eq", "id", saleId]]
      );
      assert(saleRow?.status === "CANCELLED", `S4 statut attendu=CANCELLED, recu=${saleRow?.status}`);

      const saleItems = await queryRows(
        admin,
        "sale_items",
        "id",
        [["eq", "sale_id", saleId]]
      );
      const saleItemIds = saleItems.map((row) => String(row.id));
      assert(saleItemIds.length > 0, "S4 sale_items introuvables.");

      const outCount = await countRows(admin, "stock_movements", [
        ["in", "source_id", saleItemIds],
        ["eq", "source_type", "SALE"],
        ["eq", "direction", "OUT"],
      ]);
      const cancelInCount = await countRows(admin, "stock_movements", [
        ["in", "source_id", saleItemIds],
        ["eq", "source_type", "SALE_CANCEL"],
        ["eq", "direction", "IN"],
      ]);

      assert(outCount > 0, `S4 mouvements OUT introuvables (count=${outCount}).`);
      assert(
        cancelInCount === outCount,
        `S4 mouvements miroirs incoherents: SALE_CANCEL/IN=${cancelInCount}, SALE/OUT=${outCount}`
      );

      const stockAfterCancel = await getStockBalanceQty(admin, cancelPieceRef, lotId);
      assert(
        stockAfterCancel === stockBeforeSale,
        `S4 stock non restaure: attendu=${stockBeforeSale}, recu=${stockAfterCancel}`
      );

      record("S4 annulation vente coherent (CANCELLED + IN miroir + stock restaure)");
    }

    // S5 - coherence KPI exhaustive (ventes + dashboard)
    {
      const kpiLotAId = await createConfirmedLotForKpi(admin, {
        code: "LOT_A",
        purchaseDate: "2028-06-02",
        totalCost: 200,
        totalPieces: 100,
      });
      const kpiLotBId = await createConfirmedLotForKpi(admin, {
        code: "LOT_B",
        purchaseDate: "2028-06-05",
        totalCost: 50,
        totalPieces: 25,
      });
      lotIds.push(kpiLotAId, kpiLotBId);

      const insertedSales = await insertKpiSales(admin, [
        {
          saleType: "SET",
          channel: kpiChannel,
          status: "CONFIRMED",
          net: 100,
          cost: 60,
          margin: 40,
          paidAt: "2028-06-03T10:00:00.000Z",
        },
        {
          saleType: "PIECE",
          channel: kpiChannel,
          status: "CONFIRMED",
          net: 50,
          cost: 30,
          margin: 20,
          paidAt: "2028-06-04T10:00:00.000Z",
        },
        {
          saleType: "SET",
          channel: kpiChannel,
          status: "CANCELLED",
          net: 999,
          cost: 100,
          margin: 899,
          paidAt: "2028-06-05T10:00:00.000Z",
        },
      ]);
      directSaleIds.push(...insertedSales);

      const salesView = await fetchSalesViewFromPage(ventesRuntime, {
        include_cancelled: "false",
        channel: kpiChannel,
        sort: "paid_at",
        dir: "desc",
        page: "1",
        from: KPI_RANGE.from,
        to: KPI_RANGE.to,
      });

      const euro = new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      assert(
        salesView.cards["CA net (ventes confirmées)"] === euro.format(150),
        `S5 ventes CA net incoherent: ${salesView.cards["CA net (ventes confirmées)"]}`
      );
      assert(
        salesView.cards["Marge totale"] === euro.format(60),
        `S5 ventes Marge totale incoherente: ${salesView.cards["Marge totale"]}`
      );
      assert(
        salesView.cards["Taux de marge moyen"] === "40.0%",
        `S5 ventes Taux de marge incoherent: ${salesView.cards["Taux de marge moyen"]}`
      );
      assert(
        salesView.cards["Commandes avec set(s)"] === "1",
        `S5 ventes Commandes set(s) incoherent: ${salesView.cards["Commandes avec set(s)"]}`
      );
      assert(
        salesView.cards["Commandes avec pièce(s)"] === "1",
        `S5 ventes Commandes piece(s) incoherent: ${salesView.cards["Commandes avec pièce(s)"]}`
      );
      assert(
        salesView.tableTotalCount === 2,
        `S5 ventes table.totalCount attendu=2, recu=${salesView.tableTotalCount}`
      );

      const dashboard = await fetchDashboardFromPage(dashboardRuntime, {
        preset: "custom",
        from: KPI_RANGE.from,
        to: KPI_RANGE.to,
      });

      assert(dashboard.contractVersion === "dashboard.v3", `S5 dashboard contract inattendu: ${dashboard.contractVersion}`);
      assert(
        Array.isArray(dashboard.kpis) && dashboard.kpis.length === 11,
        `S5 dashboard.kpis attendu=11, recu=${dashboard.kpis?.length}`
      );

      const confirmedSalesRows = await queryRows(
        admin,
        "sales",
        "net_seller_amount, total_margin_amount, total_cost_amount, sale_type",
        [
          ["eq", "status", "CONFIRMED"],
          ["gte", "paid_at", `${KPI_RANGE.from}T00:00:00.000Z`],
          ["lte", "paid_at", `${KPI_RANGE.to}T23:59:59.999Z`],
        ]
      );

      const netRevenue = sumNumbers(confirmedSalesRows.map((row) => row.net_seller_amount));
      const netMargin = confirmedSalesRows.reduce((sum, row) => {
        if (row.total_margin_amount !== null && row.total_margin_amount !== undefined) {
          return sum + Number(row.total_margin_amount);
        }
        return sum + Number(row.net_seller_amount ?? 0) - Number(row.total_cost_amount ?? 0);
      }, 0);
      const salesCount = confirmedSalesRows.length;

      const setRows = confirmedSalesRows.filter((row) => String(row.sale_type ?? "").toUpperCase() === "SET");
      const pieceRows = confirmedSalesRows.filter((row) => String(row.sale_type ?? "").toUpperCase() === "PIECE");
      const setRevenue = sumNumbers(setRows.map((row) => row.net_seller_amount));
      const setMargin = setRows.reduce((sum, row) => {
        if (row.total_margin_amount !== null && row.total_margin_amount !== undefined) {
          return sum + Number(row.total_margin_amount);
        }
        return sum + Number(row.net_seller_amount ?? 0) - Number(row.total_cost_amount ?? 0);
      }, 0);
      const pieceRevenue = sumNumbers(pieceRows.map((row) => row.net_seller_amount));
      const pieceMargin = pieceRows.reduce((sum, row) => {
        if (row.total_margin_amount !== null && row.total_margin_amount !== undefined) {
          return sum + Number(row.total_margin_amount);
        }
        return sum + Number(row.net_seller_amount ?? 0) - Number(row.total_cost_amount ?? 0);
      }, 0);

      const procurementRows = await queryRows(
        admin,
        "lots",
        "total_cost, total_pieces",
        [
          ["eq", "status", "confirmed"],
          ["gte", "purchase_date", KPI_RANGE.from],
          ["lte", "purchase_date", KPI_RANGE.to],
        ]
      );
      const procurementCost = sumNumbers(procurementRows.map((row) => row.total_cost));
      const procurementPieces = sumNumbers(procurementRows.map((row) => row.total_pieces));
      const confirmedLotsCount = procurementRows.length;

      const stockRows = await queryRows(admin, "stock_per_piece", "total_value");
      const stockCurrentValue = sumNumbers(stockRows.map((row) => row.total_value));

      const openingRows = await queryRows(
        admin,
        "stock_journal",
        "total_value",
        [["lt", "created_at", `${KPI_RANGE.from}T00:00:00.000Z`]]
      );
      const closingRows = await queryRows(
        admin,
        "stock_journal",
        "total_value",
        [["lte", "created_at", `${KPI_RANGE.to}T23:59:59.999Z`]]
      );
      const stockOpeningValue = sumNumbers(openingRows.map((row) => row.total_value));
      const stockClosingValue = sumNumbers(closingRows.map((row) => row.total_value));
      const stockAverage = (stockOpeningValue + stockClosingValue) / 2;
      const stockRotation = stockAverage > 0 ? netRevenue / stockAverage : null;

      const twelveMonthsFromDate = new Date(`${KPI_RANGE.to}T00:00:00.000Z`);
      twelveMonthsFromDate.setUTCDate(twelveMonthsFromDate.getUTCDate() - 364);
      const twelveMonthsFrom = twelveMonthsFromDate.toISOString().slice(0, 10);
      const sales12mRows = await queryRows(
        admin,
        "sales",
        "net_seller_amount",
        [
          ["eq", "status", "CONFIRMED"],
          ["gte", "paid_at", `${twelveMonthsFrom}T00:00:00.000Z`],
          ["lte", "paid_at", `${KPI_RANGE.to}T23:59:59.999Z`],
        ]
      );
      const ca12m = sumNumbers(sales12mRows.map((row) => row.net_seller_amount));
      const immobilizationRate = ca12m > 0 ? stockCurrentValue / ca12m : null;

      assertAlmostEqual(getKpiValue(dashboard, "netRevenue"), netRevenue, "S5 dashboard.netRevenue");
      assertAlmostEqual(getKpiValue(dashboard, "netMargin"), netMargin, "S5 dashboard.netMargin");
      assertAlmostEqual(
        getKpiValue(dashboard, "marginRate"),
        netRevenue > 0 ? (netMargin / netRevenue) * 100 : null,
        "S5 dashboard.marginRate"
      );
      assertAlmostEqual(
        getKpiValue(dashboard, "stockCurrentValue"),
        stockCurrentValue,
        "S5 dashboard.stockCurrentValue"
      );
      assertAlmostEqual(getKpiValue(dashboard, "salesCount"), salesCount, "S5 dashboard.salesCount");
      assertAlmostEqual(
        getKpiValue(dashboard, "procurementCost"),
        procurementCost,
        "S5 dashboard.procurementCost"
      );
      assertAlmostEqual(
        getKpiValue(dashboard, "avgPurchasePieceCost"),
        procurementPieces > 0 ? procurementCost / procurementPieces : null,
        "S5 dashboard.avgPurchasePieceCost"
      );
      assertAlmostEqual(
        getKpiValue(dashboard, "confirmedLotsCount"),
        confirmedLotsCount,
        "S5 dashboard.confirmedLotsCount"
      );
      assertAlmostEqual(
        getKpiValue(dashboard, "averageBasket"),
        salesCount > 0 ? netRevenue / salesCount : null,
        "S5 dashboard.averageBasket"
      );
      assertAlmostEqual(
        getKpiValue(dashboard, "stockRotation"),
        stockRotation !== null ? stockRotation * 100 : null,
        "S5 dashboard.stockRotation"
      );
      assertAlmostEqual(
        getKpiValue(dashboard, "immobilizationRate"),
        immobilizationRate !== null ? immobilizationRate * 100 : null,
        "S5 dashboard.immobilizationRate"
      );

      const comparison = dashboard.setPieceComparison;
      assertAlmostEqual(comparison.totals.sets.ordersCount, setRows.length, "S5 comparison.sets.ordersCount");
      assertAlmostEqual(comparison.totals.sets.netRevenue, setRevenue, "S5 comparison.sets.netRevenue");
      assertAlmostEqual(comparison.totals.sets.netMargin, setMargin, "S5 comparison.sets.netMargin");
      assertAlmostEqual(comparison.totals.pieces.ordersCount, pieceRows.length, "S5 comparison.pieces.ordersCount");
      assertAlmostEqual(comparison.totals.pieces.netRevenue, pieceRevenue, "S5 comparison.pieces.netRevenue");
      assertAlmostEqual(comparison.totals.pieces.netMargin, pieceMargin, "S5 comparison.pieces.netMargin");
      assertAlmostEqual(comparison.pieRevenueShare.sets, setRevenue, "S5 pieRevenueShare.sets");
      assertAlmostEqual(comparison.pieRevenueShare.pieces, pieceRevenue, "S5 pieRevenueShare.pieces");

      record("S5 coherence KPI exhaustive (ventes + dashboard)");
    }

    console.log("[F7.1] Validation terminee - scenarios passes:");
    for (const name of records) console.log(`- ${name}`);
  } finally {
    // Cleanup best-effort
    for (const saleId of [...actionSaleIds].reverse()) {
      try {
        await salesActions.deleteSaleAction(saleId);
      } catch {
        // best-effort
      }
    }

    if (directSaleIds.length > 0) {
      await admin.from("sales").delete().in("id", directSaleIds);
    }

    if (lotIds.length > 0) {
      await admin.from("stock_movements").delete().in("lot_id", lotIds);
      await admin.from("inventory").delete().in("lot_id", lotIds);
      await admin.from("lots").delete().in("id", lotIds);
    }
  }
}

run().catch((error) => {
  console.error("[F7.1] FAILED:", error.message);
  process.exit(1);
});
