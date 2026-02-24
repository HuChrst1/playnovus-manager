import { supabase } from "@/lib/supabase";
import type {
  PieceDemand,
  SaleItemDraft,
  SaleItemPieceDraftInput,
  SaleItemSetDraftInput,
} from "@/lib/sales-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/supabase";
import { formatBusinessSaleNumberDisplay } from "@/lib/sale-number";
import { getDraftLot0Id } from "@/lib/lot0-provisional";

// Helper: nettoie/valide overrides (attendu: { [piece_ref]: number })
function normalizeOverrides(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;

  const raw = v as Record<string, unknown>;
  const out: Record<string, number> = {};

  for (const [k, val] of Object.entries(raw)) {
    const key = String(k ?? "").trim();
    const n = Number(val);
    if (!key) continue;
    // IMPORTANT: on accepte 0 (set incomplet), on interdit seulement < 0
    if (!Number.isFinite(n) || n < 0) continue;
    // stocker un int propre (le front envoie déjà des entiers)
    out[key] = Math.floor(n);
  }

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Charge le BOM d'un set et le renvoie sous forme de { piece_ref, quantity }.
 */
async function fetchBomForSet(setId: string): Promise<PieceDemand[]> {
  if (!setId) return [];

  const { data, error } = await supabase
    .from("sets_bom")
    .select("piece_ref, quantity")
    .eq("set_id", setId);

  if (error) {
    console.error("fetchBomForSet - erreur lors du chargement du BOM:", error);
    throw new Error(`Impossible de charger le BOM pour le set ${setId}`);
  }

  if (!data || data.length === 0) {
    console.warn(
      `fetchBomForSet - aucun BOM trouvé pour le set ${setId}. Vérifier sets_bom.`
    );
    return [];
  }

  return data.map((row) => ({
    piece_ref: row.piece_ref,
    quantity: Number(row.quantity ?? 0),
  }));
}

/**
 * 3.2.2.2 - Cas item_kind = 'PIECE'
 */
export function getPiecesForSaleItemPiece(
  item: SaleItemPieceDraftInput
): PieceDemand[] {
  if (!item.piece_ref) {
    throw new Error(
      "getPiecesForSaleItemPiece - piece_ref manquant pour une ligne PIECE"
    );
  }

  const qty = Number(item.quantity ?? 0);
  if (!Number.isFinite(qty) || qty <= 0) return [];

  return [{ piece_ref: item.piece_ref, quantity: qty }];
}

/**
 * 3.2.2.3 - Cas item_kind = 'SET'
 *
 * - Charge le BOM du set
 * - Multiplie les quantités par item.quantity (nb d'exemplaires vendus)
 * - Applique éventuellement les overrides (mapping piece_ref -> quantité finale)
 */
export async function getPiecesForSaleItemSet(
  item: SaleItemSetDraftInput
): Promise<PieceDemand[]> {
  if (!item.set_id) {
    throw new Error(
      "getPiecesForSaleItemSet - set_id manquant pour une ligne SET"
    );
  }

  const qtySets = Number(item.quantity ?? 0);
  if (!Number.isFinite(qtySets) || qtySets <= 0) return [];

  // ✅ OPTIMISÉ : si overrides existe => on NE CHARGE PAS le BOM
  const ov = normalizeOverrides(item.overrides);
  if (ov) {
    return Object.entries(ov)
      .filter(([, q]) => Number(q) > 0)
      .map(([piece_ref, quantity]) => ({ piece_ref, quantity }));
  }
  
  const ovLegacyMap = normalizeOverrides(item.piece_overrides);
  if (ovLegacyMap) {
    return Object.entries(ovLegacyMap)
      .filter(([, q]) => Number(q) > 0)
      .map(([piece_ref, quantity]) => ({ piece_ref, quantity }));
  }

  // 1) BOM
  const bomRows = await fetchBomForSet(item.set_id);

  // 2) BOM * quantité de sets vendus
  const aggregated = new Map<string, number>();

  for (const row of bomRows) {
    const baseQty = Number(row.quantity ?? 0);
    if (!Number.isFinite(baseQty) || baseQty <= 0) continue;

    const totalForThisPiece = baseQty * qtySets;
    aggregated.set(
      row.piece_ref,
      (aggregated.get(row.piece_ref) ?? 0) + totalForThisPiece
    );
  }

  // 3) Compat temporaire (ANCIEN format): tableau piece_overrides
  if (Array.isArray(item.piece_overrides) && item.piece_overrides.length > 0) {
    for (const override of item.piece_overrides) {
      const pieceRef = override.piece_ref;
      const overrideQty = Number(override.quantity ?? 0);
      if (!pieceRef) continue;

      if (!Number.isFinite(overrideQty) || overrideQty <= 0) {
        aggregated.delete(pieceRef);
      } else {
        aggregated.set(pieceRef, overrideQty);
      }
    }
  }

  // 4) Map -> tableau
  const result: PieceDemand[] = [];
  for (const [piece_ref, quantity] of aggregated.entries()) {
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    result.push({ piece_ref, quantity });
  }

  return result;
}

/**
 * 3.2.2.4 - Helper unifié
 */
export async function getPiecesForSaleItem(
  item: SaleItemDraft
): Promise<PieceDemand[]> {
  if (item.item_kind === "PIECE") {
    return getPiecesForSaleItemPiece(item);
  }
  // item_kind === "SET"
  return getPiecesForSaleItemSet(item);
}

// ------------------------------------------------------------
// 3.6.1 (A) DATA — Liste "commandes" pour /ventes (agrégée)
// ------------------------------------------------------------

export type SalesListParams = {
  from?: string; // ISO date/time
  to?: string; // ISO date/time
  channel?: string;
  status?: string; // ex: "CONFIRMED" ou "CANCELLED"
  sale_type?: "SET" | "PIECE";
  /**
   * Compat legacy temporaire.
   * Preferer `sale_type` pour coller au contrat query /ventes.
   */
  type?: "SET" | "PIECE";
  limit?: number;
  offset?: number;
  sort?: string;
  dir?: "asc" | "desc";
};

export type SalesListRow = {
  sale_id: number;
  sale_number_raw: string | null;
  sale_number_display: string;
  paid_at: string;
  sales_channel: string;
  sale_type: "SET" | "PIECE" | "MIXED";
  status: string; // "CONFIRMED" | "CANCELLED" (selon ta DB)
  net_seller_amount: number;

  total_cost_amount: number;
  total_margin_amount: number;
  margin_rate: number | null;

  sets_count: number;
  pieces_lines_count: number;
  pieces_qty_total: number;
  has_provisional_lot0_cost: boolean;
};

type SalesDbRow = Pick<
  Tables<"sales">,
  | "id"
  | "sale_number"
  | "paid_at"
  | "sales_channel"
  | "sale_type"
  | "status"
  | "net_seller_amount"
  | "total_cost_amount"
  | "total_margin_amount"
  | "margin_rate"
>;

type SaleItemMini = Pick<
  Tables<"sale_items">,
  "item_kind" | "quantity" | "cost_amount"
>;

type SalesWithItems = SalesDbRow & {
  sale_items: SaleItemMini[] | null;
};

const toNumber = (v: unknown, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

async function getProvisionalLot0SaleIdsForPage(
  client: SupabaseClient<Database>,
  lot0Id: number,
  saleIds: number[]
): Promise<Set<number>> {
  if (saleIds.length === 0) {
    return new Set<number>();
  }

  const { data, error } = await client
    .from("sale_item_pieces")
    .select("sale_id")
    .eq("lot_id", lot0Id)
    .in("sale_id", saleIds);

  if (error) {
    console.error(
      "getProvisionalLot0SaleIdsForPage - erreur chargement sale_item_pieces:",
      error
    );
    return new Set<number>();
  }

  const out = new Set<number>();
  for (const row of data ?? []) {
    const saleId = Number(row.sale_id ?? 0);
    if (Number.isFinite(saleId) && saleId > 0) {
      out.add(saleId);
    }
  }
  return out;
}

async function countProvisionalLot0SalesForFilters(
  client: SupabaseClient<Database>,
  lot0Id: number,
  filters: {
    statusFilter?: string;
    channel?: string | null;
    saleType?: SalesPageSaleType | null;
    fromIso?: string;
    toIso?: string;
  }
): Promise<number> {
  let query = client
    .from("sale_item_pieces")
    .select("sale_id, sales!inner(id, status, sales_channel, sale_type, paid_at)")
    .eq("lot_id", lot0Id);

  if (filters.statusFilter) query = query.eq("sales.status", filters.statusFilter);
  if (filters.channel) query = query.eq("sales.sales_channel", filters.channel);
  if (filters.saleType) query = query.eq("sales.sale_type", filters.saleType);
  if (filters.fromIso) query = query.gte("sales.paid_at", filters.fromIso);
  if (filters.toIso) query = query.lte("sales.paid_at", filters.toIso);

  const { data, error } = await query;
  if (error) {
    console.error(
      "countProvisionalLot0SalesForFilters - erreur chargement des ventes provisoires:",
      error
    );
    return 0;
  }

  const saleIds = new Set<number>();
  for (const row of data ?? []) {
    const saleId = Number((row as { sale_id?: unknown }).sale_id ?? 0);
    if (Number.isFinite(saleId) && saleId > 0) {
      saleIds.add(saleId);
    }
  }

  return saleIds.size;
}

/**
 * Liste paginée des ventes pour la table "commandes".
 * - 1 seul appel PostgREST : sales + embed sale_items
 * - Agrégation côté JS (robuste + simple à maintenir)
 * - Inclut CONFIRMED + CANCELLED par défaut (pas de filtre statut implicite)
 * - Le filtrage explicite du statut est piloté par `params.status`
 */
export async function listSalesForTable(
  client: SupabaseClient<Database>,
  params: SalesListParams = {}
): Promise<{ rows: SalesListRow[]; total: number | null }> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);
  const sortRaw = (params.sort ?? "paid_at").toString();
  const dir: "asc" | "desc" = params.dir === "asc" ? "asc" : "desc";

  const allowed = new Set([
    "sale_id",
    "paid_at",
    "sales_channel",
    "sale_type",
    "status",
    "net_seller_amount",
    "total_cost_amount",
    "total_margin_amount",
  ]);

  const sortKey = allowed.has(sortRaw) ? sortRaw : "paid_at";

  // mapping UI -> DB
  const primaryDbCol = sortKey === "sale_id" ? "id" : sortKey;

  let q = client
    .from("sales")
    .select(
      `
        id,
        sale_number,
        paid_at,
        sales_channel,
        sale_type,
        status,
        net_seller_amount,
        total_cost_amount,
        total_margin_amount,
        margin_rate,
        sale_items (
          item_kind,
          quantity,
          cost_amount
        )
      `,
      { count: "exact" }
    );

  // Inclus par defaut tous les statuts.
  // Le caller peut forcer un statut cible via params.status.
  if (params.status) q = q.eq("status", params.status);

  if (params.channel) q = q.eq("sales_channel", params.channel);
  if (params.from) q = q.gte("paid_at", params.from);
  if (params.to) q = q.lte("paid_at", params.to);
  const saleTypeFilter = params.sale_type ?? params.type;
  if (saleTypeFilter) q = q.eq("sale_type", saleTypeFilter);

  // IMPORTANT: on garde .returns() à la toute fin, sinon TS perd .eq/.gte/... selon les versions
  let q2 = q.order(primaryDbCol, {
    ascending: dir === "asc",
    nullsFirst: dir === "asc",
  });

  // tie-breaker stable (sauf si on trie déjà par id)
  if (primaryDbCol !== "id") {
    q2 = q2.order("id", { ascending: false });
  }

  const { data, error, count } = await q2
    .range(offset, offset + limit - 1)
    .returns<SalesWithItems[]>();

  if (error) throw error;

  const baseRows: SalesListRow[] = (data ?? []).map((s) => {
    const items = Array.isArray(s.sale_items) ? s.sale_items : [];

    const sets_count = items.filter((i) => i.item_kind === "SET").length;
    const pieces_lines_count = items.filter((i) => i.item_kind === "PIECE").length;
    const pieces_qty_total = items
      .filter((i) => i.item_kind === "PIECE")
      .reduce((acc, i) => acc + toNumber(i.quantity, 0), 0);

    // Fallback coût si sales.total_cost_amount est null (ou pas encore rempli)
    const fallbackCost = items.reduce(
      (acc, i) => acc + toNumber(i.cost_amount, 0),
      0
    );

    const net = toNumber(s.net_seller_amount, 0);
    const cost = s.total_cost_amount ?? fallbackCost;
    const margin = s.total_margin_amount ?? net - cost;
    const marginRate = s.margin_rate ?? (net > 0 ? margin / net : null);

    const derivedType: "SET" | "PIECE" | "MIXED" =
      sets_count > 0 && pieces_lines_count > 0
        ? "MIXED"
        : sets_count > 0
          ? "SET"
          : "PIECE";

    // sale_type DB peut être null/unknown selon ton schéma => on sécurise
    const saleTypeFromDb =
      s.sale_type === "SET" || s.sale_type === "PIECE" ? s.sale_type : null;

    const paid_at = typeof s.paid_at === "string" ? s.paid_at : "";
    const sales_channel =
      typeof s.sales_channel === "string" ? s.sales_channel : "";
    const saleNumberRaw = typeof s.sale_number === "string" ? s.sale_number : null;
    const saleNumberDisplay = formatBusinessSaleNumberDisplay(saleNumberRaw, s.id);

    const statusSafe =
      s.status === "CONFIRMED" || s.status === "CANCELLED"
        ? s.status
        : "CONFIRMED";

    return {
      sale_id: s.id,
      sale_number_raw: saleNumberRaw,
      sale_number_display: saleNumberDisplay,
      paid_at,
      sales_channel,
      sale_type: saleTypeFromDb ?? derivedType,
      status: statusSafe,
      net_seller_amount: net,
      total_cost_amount: cost,
      total_margin_amount: margin,
      margin_rate: marginRate,
      sets_count,
      pieces_lines_count,
      pieces_qty_total,
      has_provisional_lot0_cost: false,
    };
  });

  const { lotId: draftLot0Id, error: lot0LookupError } = await getDraftLot0Id(
    client
  );
  if (lot0LookupError) {
    console.error("listSalesForTable - lot0 lookup error:", lot0LookupError);
  }

  if (draftLot0Id === null || baseRows.length === 0) {
    return { rows: baseRows, total: count ?? null };
  }

  const provisionalSaleIds = await getProvisionalLot0SaleIdsForPage(
    client,
    draftLot0Id,
    baseRows.map((row) => row.sale_id)
  );

  const rows = baseRows.map((row) => ({
    ...row,
    has_provisional_lot0_cost: provisionalSaleIds.has(row.sale_id),
  }));

  return { rows, total: count ?? null };
}

// ------------------------------------------------------------
// F3.2 DATA — Contrat unifie pour /ventes (liste + KPI + compteurs)
// ------------------------------------------------------------

export type SalesPageSortColumn =
  | "sale_id"
  | "paid_at"
  | "sales_channel"
  | "sale_type"
  | "status"
  | "net_seller_amount"
  | "total_cost_amount"
  | "total_margin_amount";

export type SalesPageSortDir = "asc" | "desc";
export type SalesPageSaleType = "SET" | "PIECE";

export type SalesPageFilters = {
  includeCancelled: boolean;
  channel?: string | null;
  saleType?: SalesPageSaleType | null;
  sort: SalesPageSortColumn;
  dir: SalesPageSortDir;
  page: number;
  pageSize?: number;
  from?: string | null;
  to?: string | null;
};

export type SalesPageTableData = {
  rows: SalesListRow[];
  currentPage: number;
  totalPages: number;
  pageNumbers: Array<number | "dots">;
  pageFrom: number;
  pageTo: number;
  totalCount: number;
  pageSize: number;
};

export type SalesPageKpis = {
  netWindowValue: number;
  marginWindowValue: number;
  avgMarginRateWindowValue: number;
  setsWindowValue: number;
  piecesWindowValue: number;
};

export type SalesPageDeltas = {
  netTrend: number | null;
  marginTrend: number | null;
  rateTrend: number | null;
  setsTrend: number | null;
  piecesTrend: number | null;
};

export type SalesPageHeaderCounts = {
  totalSalesCount: number;
  confirmedCount: number;
  cancelledCount: number;
};

export type SalesPageData = {
  table: SalesPageTableData;
  kpis: SalesPageKpis;
  deltas: SalesPageDeltas;
  headerCounts: SalesPageHeaderCounts;
  provisionalSalesCount: number;
};

type SaleForStats = {
  net_seller_amount: number | string | null;
  total_margin_amount: number | string | null;
  sale_type: string | null;
};

const DEFAULT_SALES_PAGE_SIZE = 50;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_SALES_SORT_COLUMNS: ReadonlySet<SalesPageSortColumn> = new Set([
  "sale_id",
  "paid_at",
  "sale_type",
  "sales_channel",
  "status",
  "net_seller_amount",
  "total_cost_amount",
  "total_margin_amount",
]);

type NormalizedDateRange = {
  from: string | null;
  to: string | null;
};

function normalizeSalesPageSize(value: number | undefined): number {
  const n = Number(value ?? DEFAULT_SALES_PAGE_SIZE);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_SALES_PAGE_SIZE;
  return Math.min(Math.floor(n), 200);
}

function normalizeSalesPage(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function normalizeSalesSort(value: string): SalesPageSortColumn {
  if (ALLOWED_SALES_SORT_COLUMNS.has(value as SalesPageSortColumn)) {
    return value as SalesPageSortColumn;
  }
  return "paid_at";
}

function normalizeSalesSortDir(value: string): SalesPageSortDir {
  return value === "asc" ? "asc" : "desc";
}

function normalizeDateOnly(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (!DATE_ONLY_RE.test(raw)) return null;

  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== raw) return null;

  return raw;
}

function normalizeDateRange(
  fromInput: string | null | undefined,
  toInput: string | null | undefined
): NormalizedDateRange {
  let from = normalizeDateOnly(fromInput);
  let to = normalizeDateOnly(toInput);

  if (from && to && from > to) {
    const oldFrom = from;
    from = to;
    to = oldFrom;
  }

  return { from, to };
}

function toDateRangeIso(range: NormalizedDateRange): {
  fromIso?: string;
  toIso?: string;
} {
  return {
    fromIso: range.from ? `${range.from}T00:00:00.000Z` : undefined,
    toIso: range.to ? `${range.to}T23:59:59.999Z` : undefined,
  };
}

function buildPageNumbers(
  totalPages: number,
  currentPage: number
): Array<number | "dots"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const siblings = 1;
  const startPage = Math.max(2, currentPage - siblings);
  const endPage = Math.min(totalPages - 1, currentPage + siblings);

  const pageNumbers: Array<number | "dots"> = [1];
  if (startPage > 2) pageNumbers.push("dots");
  for (let p = startPage; p <= endPage; p += 1) pageNumbers.push(p);
  if (endPage < totalPages - 1) pageNumbers.push("dots");
  pageNumbers.push(totalPages);

  return pageNumbers;
}

function sumNet(arr: SaleForStats[]): number {
  return arr.reduce((acc, s) => acc + toNumber(s.net_seller_amount, 0), 0);
}

function sumMargin(arr: SaleForStats[]): number {
  return arr.reduce((acc, s) => acc + toNumber(s.total_margin_amount, 0), 0);
}

function countSets(arr: SaleForStats[]): number {
  return arr.filter((s) => s.sale_type === "SET").length;
}

function countPieces(arr: SaleForStats[]): number {
  return arr.filter((s) => s.sale_type === "PIECE").length;
}

export async function getSalesPageData(
  filters: SalesPageFilters,
  client: SupabaseClient<Database> = supabase
): Promise<SalesPageData> {
  const pageSize = normalizeSalesPageSize(filters.pageSize);
  const currentPage = normalizeSalesPage(filters.page);
  const sort = normalizeSalesSort(filters.sort);
  const dir = normalizeSalesSortDir(filters.dir);
  const channel = filters.channel ?? null;
  const saleType = filters.saleType ?? null;
  const includeCancelled = filters.includeCancelled;
  const dateRange = normalizeDateRange(filters.from ?? null, filters.to ?? null);
  const { fromIso, toIso } = toDateRangeIso(dateRange);

  const offset = (currentPage - 1) * pageSize;
  const statusFilter = includeCancelled ? undefined : "CONFIRMED";

  let rows: SalesListRow[] = [];
  let totalCount = 0;

  try {
    const list = await listSalesForTable(client, {
      limit: pageSize,
      offset,
      sort,
      dir,
      channel: channel ?? undefined,
      sale_type: saleType ?? undefined,
      status: statusFilter,
      from: fromIso,
      to: toIso,
    });

    rows = list.rows;
    totalCount = list.total ?? 0;
  } catch (error) {
    if (offset === 0) throw error;

    let tableCountQuery = client
      .from("sales")
      .select("id", { count: "exact", head: true });

    if (statusFilter) tableCountQuery = tableCountQuery.eq("status", statusFilter);
    if (channel) tableCountQuery = tableCountQuery.eq("sales_channel", channel);
    if (saleType) tableCountQuery = tableCountQuery.eq("sale_type", saleType);
    if (fromIso) tableCountQuery = tableCountQuery.gte("paid_at", fromIso);
    if (toIso) tableCountQuery = tableCountQuery.lte("paid_at", toIso);

    const { count: tableCount, error: tableCountError } = await tableCountQuery;
    if (tableCountError) throw error;

    totalCount = tableCount ?? 0;
    if (offset < totalCount) throw error;

    rows = [];
  }

  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;
  const pageFrom = totalCount === 0 ? 0 : offset + 1;
  const pageTo = Math.min(offset + pageSize, totalCount);
  const pageNumbers = buildPageNumbers(totalPages, currentPage);

  let salesForStatsQuery = client
    .from("sales")
    .select("net_seller_amount, total_margin_amount, sale_type");

  if (statusFilter) salesForStatsQuery = salesForStatsQuery.eq("status", statusFilter);
  if (channel) salesForStatsQuery = salesForStatsQuery.eq("sales_channel", channel);
  if (saleType) salesForStatsQuery = salesForStatsQuery.eq("sale_type", saleType);
  if (fromIso) salesForStatsQuery = salesForStatsQuery.gte("paid_at", fromIso);
  if (toIso) salesForStatsQuery = salesForStatsQuery.lte("paid_at", toIso);

  const { data: salesForStatsRaw, error: salesForStatsError } =
    await salesForStatsQuery;

  if (salesForStatsError) {
    console.error(
      "getSalesPageData - erreur chargement stats cards:",
      salesForStatsError
    );
  }

  const salesForStats = (salesForStatsRaw ?? []) as SaleForStats[];
  const netWindowValue = sumNet(salesForStats);
  const marginWindowValue = sumMargin(salesForStats);
  const avgMarginRateWindowValue =
    netWindowValue > 0 ? marginWindowValue / netWindowValue : 0;
  const setsWindowValue = countSets(salesForStats);
  const piecesWindowValue = countPieces(salesForStats);

  const countSalesByStatus = async (status: "CONFIRMED" | "CANCELLED") => {
    let q = client.from("sales").select("id", { count: "exact", head: true });

    if (channel) q = q.eq("sales_channel", channel);
    if (saleType) q = q.eq("sale_type", saleType);
    if (fromIso) q = q.gte("paid_at", fromIso);
    if (toIso) q = q.lte("paid_at", toIso);

    q = q.eq("status", status);

    const { count, error } = await q;
    if (error) {
      console.error(`getSalesPageData - erreur count ${status}:`, error);
      return 0;
    }

    return count ?? 0;
  };

  const [confirmedCount, cancelledCount] = includeCancelled
    ? await Promise.all([
        countSalesByStatus("CONFIRMED"),
        countSalesByStatus("CANCELLED"),
      ])
    : [totalCount, 0];

  let provisionalSalesCount = 0;
  const lot0Lookup = await getDraftLot0Id(client);
  if (lot0Lookup.error) {
    console.error("getSalesPageData - lot0 lookup error:", lot0Lookup.error);
  } else if (lot0Lookup.lotId !== null) {
    provisionalSalesCount = await countProvisionalLot0SalesForFilters(
      client,
      lot0Lookup.lotId,
      {
        statusFilter,
        channel,
        saleType,
        fromIso,
        toIso,
      }
    );
  }

  return {
    table: {
      rows,
      currentPage,
      totalPages,
      pageNumbers,
      pageFrom,
      pageTo,
      totalCount,
      pageSize,
    },
    kpis: {
      netWindowValue,
      marginWindowValue,
      avgMarginRateWindowValue,
      setsWindowValue,
      piecesWindowValue,
    },
    deltas: {
      netTrend: null,
      marginTrend: null,
      rateTrend: null,
      setsTrend: null,
      piecesTrend: null,
    },
    headerCounts: {
      totalSalesCount: totalCount,
      confirmedCount,
      cancelledCount,
    },
    provisionalSalesCount,
  };
}
