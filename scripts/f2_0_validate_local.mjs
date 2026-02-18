#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseEnvBlock(raw) {
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);
    if (match) {
      env[match[1]] = match[2];
    }
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

function resolveApproPageChunks() {
  const pagePath = path.join(ROOT, ".next", "server", "app", "approvisionnement", "page.js");
  assert(fs.existsSync(pagePath), "Build artifact manquant: .next/server/app/approvisionnement/page.js");

  const pageJs = fs.readFileSync(pagePath, "utf8");
  const chunkRegex = /R\.c\("([^"]+)"\)/g;
  const chunks = [];
  let match;

  while ((match = chunkRegex.exec(pageJs)) !== null) {
    chunks.push(path.join(ROOT, ".next", match[1]));
  }

  assert(chunks.length > 0, "Aucun chunk resolu pour app/approvisionnement/page.");
  return chunks;
}

function assertBuildIsLocalOnly(chunkPaths, localApiUrl) {
  let foundLocalApiUrl = false;

  for (const chunkPath of chunkPaths) {
    if (!fs.existsSync(chunkPath)) {
      continue;
    }

    const content = fs.readFileSync(chunkPath, "utf8");
    if (content.includes(localApiUrl)) {
      foundLocalApiUrl = true;
    }
    assert(
      !content.includes(".supabase.co"),
      `Guard local-only: host remote detecte dans ${path.basename(chunkPath)}`
    );
  }

  assert(
    foundLocalApiUrl,
    "Guard local-only: aucune URL locale Supabase detectee dans les chunks de la page approvisionnement."
  );
}

function loadActionFunctions() {
  const pagePath = path.join(ROOT, ".next", "server", "app", "approvisionnement", "page.js");
  const manifestPath = path.join(
    ROOT,
    ".next",
    "server",
    "app",
    "approvisionnement",
    "page",
    "server-reference-manifest.json"
  );

  assert(fs.existsSync(pagePath), "Build artifact manquant: .next/server/app/approvisionnement/page.js");
  assert(
    fs.existsSync(manifestPath),
    "Build artifact manquant: server-reference-manifest.json"
  );

  const pageJs = fs.readFileSync(pagePath, "utf8");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  const runtimeFactory = require(path.join(
    ROOT,
    ".next",
    "server",
    "chunks",
    "ssr",
    "[turbopack]_runtime.js"
  ));
  const runtime = runtimeFactory("server/app/approvisionnement/page.js");

  const chunkRegex = /R\.c\("([^"]+)"\)/g;
  let match;
  while ((match = chunkRegex.exec(pageJs)) !== null) {
    runtime.c(match[1]);
  }

  try {
    const cacheExports = runtime.m(18558).exports;
    if (cacheExports && typeof cacheExports.revalidatePath === "function") {
      cacheExports.revalidatePath = () => {};
    }
  } catch {
    // Pas bloquant: certains builds peuvent remapper l'id interne.
  }

  try {
    const nextCache = require("next/cache");
    if (nextCache && typeof nextCache.revalidatePath === "function") {
      nextCache.revalidatePath = () => {};
    }
  } catch {
    // Pas bloquant: on patch au mieux pour l'execution hors requete HTTP.
  }

  const actionEntries = Object.entries(manifest.node ?? {});
  assert(actionEntries.length > 0, "Aucune server action detectee dans le manifest approvisionnement.");

  const worker = actionEntries[0][1]?.workers?.["app/approvisionnement/page"];
  const moduleId = worker?.moduleId;
  assert(Number.isInteger(moduleId), "moduleId action introuvable dans server-reference-manifest.");

  const moduleExports = runtime.m(moduleId).exports;

  const getAction = (exportedName) => {
    const entry = actionEntries.find(([, value]) => value?.exportedName === exportedName);
    assert(entry, `Action \`${exportedName}\` absente du manifest.`);

    const actionId = entry[0];
    const fn = moduleExports[actionId];
    assert(typeof fn === "function", `Action \`${exportedName}\` non resolvable dans le chunk serveur.`);
    return fn;
  };

  return {
    createLotFromDialog: getAction("createLotFromDialog"),
    updateLotFromDialog: getAction("updateLotFromDialog"),
    deleteLot: getAction("deleteLot"),
  };
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

async function sumInventoryQty(admin, lotId) {
  const { data, error } = await admin
    .from("inventory")
    .select("quantity")
    .eq("lot_id", lotId);
  if (error) throw new Error(`inventory sum failed for lot ${lotId}: ${error.message}`);
  return (data ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
}

async function sumPurchaseInQty(admin, lotId) {
  const { data, error } = await admin
    .from("stock_movements")
    .select("quantity")
    .eq("source_type", "PURCHASE")
    .eq("direction", "IN")
    .eq("lot_id", lotId);
  if (error) throw new Error(`stock_movements sum failed for lot ${lotId}: ${error.message}`);
  return (data ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
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

async function lotExists(admin, lotId) {
  const row = await querySingle(admin, "lots", "id", [["eq", "id", lotId]]);
  return Boolean(row);
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

async function createDraftLotWithInventory(admin, tag) {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const lotCode = `F2V_${tag}_${suffix}`;
  const label = `F2 Validate ${tag}`;

  const { data: lot, error: lotError } = await admin
    .from("lots")
    .insert({
      lot_code: lotCode,
      label,
      purchase_date: "2026-02-17",
      supplier: "F2 Validation",
      total_pieces: 3,
      total_cost: 3.0,
      status: "draft",
      notes: `Generated by scripts/f2_0_validate_local.mjs (${tag})`,
    })
    .select("id, purchase_date, label, supplier, lot_code, total_cost, status, notes")
    .single();

  if (lotError || !lot) {
    throw new Error(`create draft lot failed (${tag}): ${lotError?.message ?? "no lot returned"}`);
  }

  const inventoryRows = [
    {
      lot_id: lot.id,
      piece_ref: `F2P_${tag}_A`,
      quantity: 2,
      location: "F2_TEST",
      unit_cost: 1.0,
    },
    {
      lot_id: lot.id,
      piece_ref: `F2P_${tag}_B`,
      quantity: 1,
      location: "F2_TEST",
      unit_cost: 1.0,
    },
  ];

  const { error: invError } = await admin.from("inventory").insert(inventoryRows);
  if (invError) {
    throw new Error(`insert inventory failed for lot ${lot.id}: ${invError.message}`);
  }

  return lot;
}

async function createDraftLotWithoutInventory(admin, tag, options = {}) {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const lotCode = options.lotCode ?? `F2V_${tag}_${suffix}`;
  const label = options.label ?? `F2 Validate ${tag}`;
  const totalPieces = Number.isFinite(options.totalPieces)
    ? Number(options.totalPieces)
    : 0;
  const totalCost = Number.isFinite(options.totalCost)
    ? Number(options.totalCost)
    : 0;

  const { data: lot, error: lotError } = await admin
    .from("lots")
    .insert({
      lot_code: lotCode,
      label,
      purchase_date: "2026-02-18",
      supplier: "F2 Validation",
      total_pieces: totalPieces,
      total_cost: totalCost,
      status: "draft",
      notes: `Generated by scripts/f2_0_validate_local.mjs (${tag})`,
    })
    .select("id, purchase_date, label, supplier, lot_code, total_cost, status, notes")
    .single();

  if (lotError || !lot) {
    throw new Error(
      `create draft lot without inventory failed (${tag}): ${lotError?.message ?? "no lot returned"}`
    );
  }

  return lot;
}

async function cleanupLotHard(admin, lotId) {
  await admin.from("stock_movements").delete().eq("source_type", "PURCHASE").eq("source_id", String(lotId));
  await admin.from("stock_movements").delete().eq("source_type", "PURCHASE").eq("lot_id", lotId);
  await admin.from("inventory").delete().eq("lot_id", lotId);
  await admin.from("lots").delete().eq("id", lotId);
}

async function findUsedLot(admin) {
  const row = await querySingle(
    admin,
    "sale_item_pieces",
    "lot_id, sale_id",
    [["not_null", "lot_id", null]]
  );
  assert(row?.lot_id, "Aucun lot utilise en ventes n'a ete trouve (sale_item_pieces)." );

  const lot = await loadLotForUpdate(admin, row.lot_id);
  assert(
    lot.status === "confirmed",
    `Le lot utilise attendu doit etre \`confirmed\` (lot=${lot.id}, status=${lot.status}).`
  );

  return {
    lot,
    saleId: Number(row.sale_id),
  };
}

async function assertViewsReadable(admin) {
  const targets = ["stock_per_piece", "stock_journal", "piece_movements"];
  for (const view of targets) {
    const { error } = await admin.from(view).select("*", { head: true, count: "exact" });
    if (error) {
      throw new Error(`Vue ${view} illisible: ${error.message}`);
    }
  }
}

async function assertHealthcheck(admin) {
  const { data, error } = await admin
    .from("healthcheck_business_anomalies_v1")
    .select("*");
  if (error) {
    throw new Error(`healthcheck_business_anomalies_v1 illisible: ${error.message}`);
  }
  assert((data ?? []).length === 0, `Healthcheck F1.5 non nul: anomalies=${(data ?? []).length}`);
}

async function assertConfirmedLotsPurchaseConsistency(admin) {
  const { data: lots, error: lotsError } = await admin
    .from("lots")
    .select("id")
    .eq("status", "confirmed");

  if (lotsError) {
    throw new Error(`lots confirmed load failed: ${lotsError.message}`);
  }

  let mismatchCount = 0;
  let withoutPurchaseCount = 0;
  for (const lot of lots ?? []) {
    const lotId = Number(lot.id);
    const invQty = await sumInventoryQty(admin, lotId);
    const purchaseQty = await sumPurchaseInQty(admin, lotId);

    if (invQty !== purchaseQty) {
      mismatchCount += 1;
    }
    if (purchaseQty <= 0) {
      withoutPurchaseCount += 1;
    }
  }

  assert(
    mismatchCount === 0,
    `Incoherences detectees sur lots confirmes (inventory vs PURCHASE): ${mismatchCount}`
  );
  assert(
    withoutPurchaseCount === 0,
    `Lots confirmes sans PURCHASE/IN detectes: ${withoutPurchaseCount}`
  );
}

async function assertNegativeStockBlocked(admin) {
  const lot = await createDraftLotWithInventory(admin, "NEG");

  const { error: inError } = await admin.from("stock_movements").insert({
    piece_ref: "F2P_NEG_A",
    lot_id: lot.id,
    direction: "IN",
    quantity: 1,
    unit_cost: 1.0,
    source_type: "PURCHASE",
    source_id: String(lot.id),
    comment: "F2 negative stock guard prefill",
  });

  if (inError) {
    throw new Error(`Impossible de preparer le test anti-stock-negatif: ${inError.message}`);
  }

  const { error: outError } = await admin.from("stock_movements").insert({
    piece_ref: "F2P_NEG_A",
    lot_id: lot.id,
    direction: "OUT",
    quantity: 2,
    unit_cost: 1.0,
    source_type: "SALE",
    source_id: `F2_NEG_${lot.id}`,
    comment: "F2 negative stock guard should block",
  });

  assert(outError, "F1.3 attendu: insertion OUT menant au negatif devrait etre refusee.");

  await admin.from("stock_movements").delete().eq("source_type", "PURCHASE").eq("source_id", String(lot.id));
  await admin.from("inventory").delete().eq("lot_id", lot.id);
  await admin.from("lots").delete().eq("id", lot.id);
}

async function assertDuplicateGuardBlocked(admin) {
  const lot = await createDraftLotWithInventory(admin, "DUP");
  const sourceId = `F2_DUP_${lot.id}`;

  const payload = {
    piece_ref: "F2P_DUP_A",
    lot_id: lot.id,
    direction: "IN",
    quantity: 1,
    unit_cost: 1.0,
    source_type: "PURCHASE",
    source_id: sourceId,
    comment: "F2 duplicate guard",
  };

  const { error: firstError } = await admin.from("stock_movements").insert(payload);
  if (firstError) {
    throw new Error(`Impossible de preparer test anti-doublon: ${firstError.message}`);
  }

  const { error: secondError } = await admin.from("stock_movements").insert(payload);
  assert(secondError, "F1.4 attendu: le doublon de mouvement coeur devrait etre bloque.");

  await admin.from("stock_movements").delete().eq("source_type", "PURCHASE").eq("source_id", sourceId);
  await admin.from("inventory").delete().eq("lot_id", lot.id);
  await admin.from("lots").delete().eq("id", lot.id);
}

async function run() {
  console.log("[F2.0] Validation locale reproductible - demarrage");

  const localEnv = getLocalSupabaseEnv();

  console.log("[F2.0] Build local-only (actions compilees avec URL locale)");
  runLocalOnlyBuild(localEnv);

  const approChunks = resolveApproPageChunks();
  assertBuildIsLocalOnly(approChunks, localEnv.API_URL);

  process.env.NEXT_PUBLIC_SUPABASE_URL = localEnv.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = localEnv.ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = localEnv.SERVICE_ROLE_KEY;

  const actions = loadActionFunctions();
  const admin = createClient(localEnv.API_URL, localEnv.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const results = [];
  const record = (name) => {
    results.push(name);
    console.log(`[F2.0] OK - ${name}`);
  };

  // S1 - suppression draft non utilise
  {
    const lot = await createDraftLotWithInventory(admin, "S1");
    const result = await actions.deleteLot(lot.id);
    assert(result?.success === true, `S1 echec suppression draft: ${JSON.stringify(result)}`);
    assert(!(await lotExists(admin, lot.id)), `S1 echec: lot ${lot.id} encore present.`);
    record("S1 suppression draft non utilise");
  }

  // S2 - suppression confirmed non utilise + retrait PURCHASE
  {
    const lot = await createDraftLotWithInventory(admin, "S2");
    const before = await sumPurchaseInQty(admin, lot.id);
    assert(before === 0, `S2 precondition invalide: PURCHASE initial non nul (${before}).`);

    const confirmResult = await actions.updateLotFromDialog(
      lot.id,
      toUpdateArgs(lot, "confirmed")
    );
    assert(
      confirmResult?.success === true,
      `S2 echec confirmation lot: ${JSON.stringify(confirmResult)}`
    );

    const purchaseAfterConfirm = await sumPurchaseInQty(admin, lot.id);
    assert(
      purchaseAfterConfirm > 0,
      `S2 echec: aucun PURCHASE apres confirmation (lot=${lot.id}).`
    );

    const deleteResult = await actions.deleteLot(lot.id);
    assert(deleteResult?.success === true, `S2 echec suppression confirmed: ${JSON.stringify(deleteResult)}`);
    assert(!(await lotExists(admin, lot.id)), `S2 echec: lot ${lot.id} encore present apres delete.`);
    record("S2 suppression confirmed non utilise + retrait PURCHASE");
  }

  // S3 - suppression lot utilise bloquee
  {
    const used = await findUsedLot(admin);
    const result = await actions.deleteLot(used.lot.id);
    assert(result?.success === false, "S3 echec: suppression lot utilise devrait etre refusee.");
    assert(
      result?.reason === "LOT_USED_BY_SALES",
      `S3 echec: reason attendu LOT_USED_BY_SALES, recu ${result?.reason}`
    );
    assert(
      Number(result?.linkedSalesCount ?? 0) >= 1,
      `S3 echec: linkedSalesCount attendu >= 1, recu ${result?.linkedSalesCount}`
    );
    assert(Array.isArray(result?.linkedSaleIds), "S3 echec: linkedSaleIds devrait etre un tableau.");
    assert(await lotExists(admin, used.lot.id), `S3 echec: lot ${used.lot.id} ne devrait pas etre supprime.`);
    record("S3 suppression lot utilise bloquee (LOT_USED_BY_SALES)");
  }

  // S4 + S5 - draft->confirmed puis confirmed->draft sans ventes
  {
    const lot = await createDraftLotWithInventory(admin, "S45");

    const invQty = await sumInventoryQty(admin, lot.id);
    assert(invQty > 0, "S4 precondition invalide: inventory vide.");

    const toConfirmed = await actions.updateLotFromDialog(
      lot.id,
      toUpdateArgs(lot, "confirmed")
    );
    assert(toConfirmed?.success === true, `S4 echec: ${JSON.stringify(toConfirmed)}`);

    const purchaseQty = await sumPurchaseInQty(admin, lot.id);
    assert(
      purchaseQty === invQty,
      `S4 echec: PURCHASE (${purchaseQty}) != inventory (${invQty}) pour lot ${lot.id}.`
    );
    record("S4 transition draft->confirmed cree PURCHASE");

    const lotAfterConfirm = await loadLotForUpdate(admin, lot.id);
    const toDraft = await actions.updateLotFromDialog(
      lot.id,
      toUpdateArgs(lotAfterConfirm, "draft")
    );

    assert(toDraft?.success === true, `S5 echec: ${JSON.stringify(toDraft)}`);
    const purchaseAfterDraft = await sumPurchaseInQty(admin, lot.id);
    assert(
      purchaseAfterDraft === 0,
      `S5 echec: PURCHASE devrait etre a 0 apres downgrade (recu ${purchaseAfterDraft}).`
    );
    record("S5 transition confirmed->draft sans ventes retire PURCHASE");

    const cleanupResult = await actions.deleteLot(lot.id);
    assert(cleanupResult?.success === true, `S45 cleanup echec: ${JSON.stringify(cleanupResult)}`);
  }

  // S6 - confirmed->draft avec ventes bloque
  {
    const used = await findUsedLot(admin);
    const result = await actions.updateLotFromDialog(
      used.lot.id,
      toUpdateArgs(used.lot, "draft")
    );

    assert(result?.success === false, "S6 echec: downgrade lot utilise devrait etre refuse.");
    assert(
      result?.reason === "LOT_USED_BY_SALES",
      `S6 echec: reason attendu LOT_USED_BY_SALES, recu ${result?.reason}`
    );
    assert(
      Number(result?.linkedSalesCount ?? 0) >= 1,
      `S6 echec: linkedSalesCount attendu >= 1, recu ${result?.linkedSalesCount}`
    );

    const lotNow = await loadLotForUpdate(admin, used.lot.id);
    assert(
      lotNow.status === "confirmed",
      `S6 echec: statut lot utilise modifie (attendu confirmed, recu ${lotNow.status}).`
    );
    record("S6 transition confirmed->draft avec ventes bloquee (LOT_USED_BY_SALES)");
  }

  // S7 - F2.3 confirmation nominale coherente (draft non vide -> confirmed + PURCHASE/IN alignes)
  {
    const lot = await createDraftLotWithInventory(admin, "F23_S7");
    const toConfirmed = await actions.updateLotFromDialog(
      lot.id,
      toUpdateArgs(lot, "confirmed")
    );

    assert(
      toConfirmed?.success === true,
      `S7 echec confirmation nominale F2.3: ${JSON.stringify(toConfirmed)}`
    );

    const lotNow = await loadLotForUpdate(admin, lot.id);
    assert(
      lotNow.status === "confirmed",
      `S7 echec: lot ${lot.id} non confirme (status=${lotNow.status}).`
    );

    const invQty = await sumInventoryQty(admin, lot.id);
    const purchaseQty = await sumPurchaseInQty(admin, lot.id);
    assert(invQty > 0, "S7 precondition invalide: inventory vide.");
    assert(
      purchaseQty === invQty,
      `S7 echec: PURCHASE (${purchaseQty}) != inventory (${invQty}) pour lot ${lot.id}.`
    );

    const cleanupResult = await actions.deleteLot(lot.id);
    assert(cleanupResult?.success === true, `S7 cleanup echec: ${JSON.stringify(cleanupResult)}`);
    record("S7 F2.3 confirmation nominale coherente");
  }

  // S8 - F2.3 echec intermediaire (conflit lot_code) => rollback verifie, aucun etat partiel
  {
    const blocker = await createDraftLotWithoutInventory(admin, "F23_BLOCK", {
      totalPieces: 0,
      totalCost: 0,
    });
    const lot = await createDraftLotWithInventory(admin, "F23_S8");

    const updateArgs = {
      ...toUpdateArgs(lot, "confirmed"),
      lotCode: blocker.lot_code,
    };

    const result = await actions.updateLotFromDialog(lot.id, updateArgs);
    assert(result?.success === false, "S8 echec: la confirmation aurait du etre refusee.");
    assert(
      result?.reason === "LOT_CONFIRMATION_INCONSISTENT" ||
        result?.reason === "LOT_CONFIRMATION_ROLLBACK_FAILED" ||
        result?.reason === "UPDATE_FAILED",
      `S8 echec: reason inattendue (${result?.reason})`
    );

    const lotNow = await loadLotForUpdate(admin, lot.id);
    assert(
      lotNow.status === "draft",
      `S8 echec: statut attendu draft apres rollback, recu ${lotNow.status}.`
    );
    const purchaseQty = await sumPurchaseInQty(admin, lot.id);
    assert(
      purchaseQty === 0,
      `S8 echec: PURCHASE devrait etre a 0 apres echec intermediaire (recu ${purchaseQty}).`
    );

    await cleanupLotHard(admin, lot.id);
    await cleanupLotHard(admin, blocker.id);
    record("S8 F2.3 echec intermediaire sans etat partiel persistant");
  }

  // S9 - F2.3 lot incoherent (total_pieces > 0 mais inventory vide) => refus serveur + aucun PURCHASE
  {
    const lot = await createDraftLotWithoutInventory(admin, "F23_S9", {
      totalPieces: 5,
      totalCost: 10,
    });

    const result = await actions.updateLotFromDialog(
      lot.id,
      toUpdateArgs(lot, "confirmed")
    );

    assert(result?.success === false, "S9 echec: la confirmation incoherente devrait etre refusee.");
    assert(
      result?.reason === "LOT_CONFIRMATION_INCONSISTENT",
      `S9 echec: reason attendu LOT_CONFIRMATION_INCONSISTENT, recu ${result?.reason}`
    );

    const lotNow = await loadLotForUpdate(admin, lot.id);
    assert(
      lotNow.status === "draft",
      `S9 echec: le lot devrait rester draft (recu ${lotNow.status}).`
    );
    const purchaseQty = await sumPurchaseInQty(admin, lot.id);
    assert(purchaseQty === 0, `S9 echec: PURCHASE inattendu (${purchaseQty}).`);

    await cleanupLotHard(admin, lot.id);
    record("S9 F2.3 lot incoherent refuse sans mouvements PURCHASE");
  }

  // S10 - contournement UI (lot vide) => refus serveur inchange
  {
    const lot = await createDraftLotWithoutInventory(admin, "F23_S10", {
      totalPieces: 0,
      totalCost: 5,
    });

    const result = await actions.updateLotFromDialog(
      lot.id,
      toUpdateArgs(lot, "confirmed")
    );

    assert(result?.success === false, "S10 echec: un lot vide ne doit pas etre confirmable.");
    assert(
      result?.reason === "UPDATE_FAILED",
      `S10 echec: reason attendu UPDATE_FAILED, recu ${result?.reason}`
    );
    assert(
      String(result?.error ?? "").includes("lot vide"),
      `S10 echec: message attendu sur lot vide, recu ${result?.error}`
    );

    const purchaseQty = await sumPurchaseInQty(admin, lot.id);
    assert(purchaseQty === 0, `S10 echec: PURCHASE inattendu (${purchaseQty}).`);
    await cleanupLotHard(admin, lot.id);
    record("S10 contournement UI lot vide bloque cote serveur");
  }

  // S11 - non-regression F2.4 protection LOT_0
  {
    const existingLot0 = await querySingle(
      admin,
      "lots",
      "id, purchase_date, label, supplier, lot_code, total_cost, status, notes",
      [["eq", "lot_code", "LOT_0"]]
    );

    let lot0 = existingLot0;
    let createdForTest = false;
    if (!lot0) {
      lot0 = await createDraftLotWithoutInventory(admin, "F24_LOT0", {
        lotCode: "LOT_0",
        label: "LOT_0 protection test",
        totalPieces: 0,
        totalCost: 0,
      });
      createdForTest = true;
    }

    const result = await actions.deleteLot(lot0.id);
    assert(result?.success === false, "S11 echec: LOT_0 ne doit pas etre supprimable.");
    assert(
      result?.reason === "LOT_INITIAL_PROTECTED",
      `S11 echec: reason attendu LOT_INITIAL_PROTECTED, recu ${result?.reason}`
    );

    if (createdForTest) {
      await cleanupLotHard(admin, lot0.id);
    }
    record("S11 non-regression F2.4 protection LOT_0");
  }

  // S12 - non-regression F2.4 renumerotation auto apres suppression LOT_n
  {
    const base = `F24_${Date.now()}`;
    const sequenceBase = 100000 + Math.floor(Math.random() * 100000);
    const lotCodeA = `LOT_${sequenceBase}`;
    const lotCodeB = `LOT_${sequenceBase + 1}`;

    const lotA = await createDraftLotWithoutInventory(admin, "F24_S12_A", {
      lotCode: lotCodeA,
      label: `Renumber A ${base}`,
      totalPieces: 0,
      totalCost: 0,
    });
    const lotB = await createDraftLotWithoutInventory(admin, "F24_S12_B", {
      lotCode: lotCodeB,
      label: `Renumber B ${base}`,
      totalPieces: 0,
      totalCost: 0,
    });

    const deleteA = await actions.deleteLot(lotA.id);
    assert(deleteA?.success === true, `S12 echec suppression lot A: ${JSON.stringify(deleteA)}`);

    const lotBAfter = await querySingle(
      admin,
      "lots",
      "id, lot_code",
      [["eq", "id", lotB.id]]
    );
    assert(lotBAfter, `S12 echec: lot B (${lotB.id}) introuvable apres suppression lot A.`);
    assert(
      lotBAfter.lot_code === lotCodeA,
      `S12 echec: renumerotation attendue ${lotCodeA}, recu ${lotBAfter.lot_code}`
    );

    const deleteB = await actions.deleteLot(lotB.id);
    assert(deleteB?.success === true, `S12 cleanup echec lot B: ${JSON.stringify(deleteB)}`);
    record("S12 non-regression F2.4 renumerotation LOT_n");
  }

  await assertNegativeStockBlocked(admin);
  record("F1.3 anti-stock negatif actif");

  await assertDuplicateGuardBlocked(admin);
  record("F1.4 anti-doublon actif");

  const negativeRows = await countRows(admin, "stock_balance", [["lt", "quantity", 0]]);
  assert(negativeRows === 0, `Stock negatif detecte apres scenarios: ${negativeRows}`);
  record("stock_balance sans quantite negative");

  await assertViewsReadable(admin);
  record("vues stock_per_piece/stock_journal/piece_movements lisibles");

  await assertHealthcheck(admin);
  record("healthcheck_business_anomalies_v1 = 0");

  await assertConfirmedLotsPurchaseConsistency(admin);
  record("lots confirmes coherents (inventory = PURCHASE/IN, aucun lot sans PURCHASE)");

  console.log("[F2.0] Validation terminee - scenarios passes:");
  for (const name of results) {
    console.log(`- ${name}`);
  }
}

run().catch((error) => {
  console.error("[F2.0] FAILED:", error.message);
  process.exit(1);
});
