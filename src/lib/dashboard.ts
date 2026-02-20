import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/supabase";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const AGGREGATION_PAGE_SIZE = 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type DashboardDateRangeInput = {
  from?: string | null;
  to?: string | null;
};

export type DashboardDateRange = {
  from: string | null;
  to: string | null;
  mode: "GLOBAL" | "RANGE";
};

export type DashboardIssueCode =
  | "SALES_DATA_UNAVAILABLE"
  | "STOCK_VALUE_UNAVAILABLE"
  | "PROCUREMENT_COST_UNAVAILABLE";

export type DashboardMetric = {
  amount: number;
  quality: "ok" | "partial";
  issue: DashboardIssueCode | null;
};

export type DashboardData = {
  contractVersion: "dashboard.v1";
  generatedAt: string;
  filters: DashboardDateRange & {
    salesStatus: "CONFIRMED_ONLY";
    procurementScope: "CONFIRMED_LOTS";
  };
  metrics: {
    netRevenue: DashboardMetric;
    netMargin: DashboardMetric;
    stockValue: DashboardMetric;
    procurementCost: DashboardMetric;
  };
  partial: boolean;
  issues: DashboardIssueCode[];
};

type SalesAggregationRow = Pick<
  Tables<"sales">,
  "id" | "net_seller_amount" | "total_margin_amount" | "total_cost_amount"
>;

type StockValueAggregationRow = Pick<
  Tables<"stock_per_piece">,
  "piece_ref" | "total_value"
>;

type ProcurementAggregationRow = Pick<Tables<"lots">, "id" | "total_cost">;

type DateRangeLike = {
  from: string | null;
  to: string | null;
};

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
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

function toUtcDateFromDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateOnlyUtc(value: Date): string {
  const utcDate = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
  return utcDate.toISOString().slice(0, 10);
}

function addDaysDateOnly(value: string, days: number): string {
  const date = toUtcDateFromDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function diffDaysInclusive(from: string, to: string): number {
  const fromTs = toUtcDateFromDateOnly(from).getTime();
  const toTs = toUtcDateFromDateOnly(to).getTime();
  return Math.floor((toTs - fromTs) / DAY_IN_MS) + 1;
}

function extractDateOnlyFromIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toSalesDateRangeIso(range: DateRangeLike): {
  fromIso?: string;
  toIso?: string;
} {
  return {
    fromIso: range.from ? `${range.from}T00:00:00.000Z` : undefined,
    toIso: range.to ? `${range.to}T23:59:59.999Z` : undefined,
  };
}

function okMetric(amount: number): DashboardMetric {
  return {
    amount,
    quality: "ok",
    issue: null,
  };
}

function partialMetric(issue: DashboardIssueCode): DashboardMetric {
  return {
    amount: 0,
    quality: "partial",
    issue,
  };
}

async function loadSalesAggregationRows(
  client: SupabaseClient<Database>,
  range: DateRangeLike
): Promise<SalesAggregationRow[]> {
  const rows: SalesAggregationRow[] = [];
  const { fromIso, toIso } = toSalesDateRangeIso(range);
  let offset = 0;

  while (true) {
    let query = client
      .from("sales")
      .select("id, net_seller_amount, total_margin_amount, total_cost_amount")
      .eq("status", "CONFIRMED")
      .order("id", { ascending: true })
      .range(offset, offset + AGGREGATION_PAGE_SIZE - 1);

    if (fromIso) query = query.gte("paid_at", fromIso);
    if (toIso) query = query.lte("paid_at", toIso);

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data ?? []) as SalesAggregationRow[];
    rows.push(...batch);

    if (batch.length < AGGREGATION_PAGE_SIZE) break;
    offset += AGGREGATION_PAGE_SIZE;
  }

  return rows;
}

async function loadStockValueRows(
  client: SupabaseClient<Database>
): Promise<StockValueAggregationRow[]> {
  const rows: StockValueAggregationRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from("stock_per_piece")
      .select("piece_ref, total_value")
      .order("piece_ref", { ascending: true })
      .range(offset, offset + AGGREGATION_PAGE_SIZE - 1);

    if (error) throw error;

    const batch = (data ?? []) as StockValueAggregationRow[];
    rows.push(...batch);

    if (batch.length < AGGREGATION_PAGE_SIZE) break;
    offset += AGGREGATION_PAGE_SIZE;
  }

  return rows;
}

async function loadProcurementRows(
  client: SupabaseClient<Database>,
  range: DateRangeLike
): Promise<ProcurementAggregationRow[]> {
  const rows: ProcurementAggregationRow[] = [];
  let offset = 0;

  while (true) {
    let query = client
      .from("lots")
      .select("id, total_cost")
      .eq("status", "confirmed")
      .order("id", { ascending: true })
      .range(offset, offset + AGGREGATION_PAGE_SIZE - 1);

    if (range.from) query = query.gte("purchase_date", range.from);
    if (range.to) query = query.lte("purchase_date", range.to);

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data ?? []) as ProcurementAggregationRow[];
    rows.push(...batch);

    if (batch.length < AGGREGATION_PAGE_SIZE) break;
    offset += AGGREGATION_PAGE_SIZE;
  }

  return rows;
}

export function normalizeDashboardDateRange(
  input?: DashboardDateRangeInput
): DashboardDateRange {
  let from = normalizeDateOnly(input?.from ?? null);
  let to = normalizeDateOnly(input?.to ?? null);

  if (from && to && from > to) {
    const originalFrom = from;
    from = to;
    to = originalFrom;
  }

  return {
    from,
    to,
    mode: from || to ? "RANGE" : "GLOBAL",
  };
}

export async function getDashboardData(
  client: SupabaseClient<Database>,
  input?: DashboardDateRangeInput
): Promise<DashboardData> {
  const range = normalizeDashboardDateRange(input);
  const issues = new Set<DashboardIssueCode>();

  let netRevenue = okMetric(0);
  let netMargin = okMetric(0);
  let stockValue = okMetric(0);
  let procurementCost = okMetric(0);

  try {
    const salesRows = await loadSalesAggregationRows(client, range);
    let revenueAmount = 0;
    let marginAmount = 0;

    for (const row of salesRows) {
      const netAmount = toNumber(row.net_seller_amount, 0);
      const marginAmountFromRow =
        row.total_margin_amount !== null
          ? toNumber(row.total_margin_amount, 0)
          : netAmount - toNumber(row.total_cost_amount, 0);

      revenueAmount += netAmount;
      marginAmount += marginAmountFromRow;
    }

    netRevenue = okMetric(revenueAmount);
    netMargin = okMetric(marginAmount);
  } catch (error) {
    console.error("getDashboardData - sales aggregation failed:", error);
    netRevenue = partialMetric("SALES_DATA_UNAVAILABLE");
    netMargin = partialMetric("SALES_DATA_UNAVAILABLE");
    issues.add("SALES_DATA_UNAVAILABLE");
  }

  try {
    const stockRows = await loadStockValueRows(client);
    const totalStockValue = stockRows.reduce(
      (acc, row) => acc + toNumber(row.total_value, 0),
      0
    );
    stockValue = okMetric(totalStockValue);
  } catch (error) {
    console.error("getDashboardData - stock value aggregation failed:", error);
    stockValue = partialMetric("STOCK_VALUE_UNAVAILABLE");
    issues.add("STOCK_VALUE_UNAVAILABLE");
  }

  try {
    const procurementRows = await loadProcurementRows(client, range);
    const procurementAmount = procurementRows.reduce(
      (acc, row) => acc + toNumber(row.total_cost, 0),
      0
    );
    procurementCost = okMetric(procurementAmount);
  } catch (error) {
    console.error("getDashboardData - procurement aggregation failed:", error);
    procurementCost = partialMetric("PROCUREMENT_COST_UNAVAILABLE");
    issues.add("PROCUREMENT_COST_UNAVAILABLE");
  }

  const issueList = Array.from(issues);

  return {
    contractVersion: "dashboard.v1",
    generatedAt: new Date().toISOString(),
    filters: {
      from: range.from,
      to: range.to,
      mode: range.mode,
      salesStatus: "CONFIRMED_ONLY",
      procurementScope: "CONFIRMED_LOTS",
    },
    metrics: {
      netRevenue,
      netMargin,
      stockValue,
      procurementCost,
    },
    partial: issueList.length > 0,
    issues: issueList,
  };
}

export type DashboardPreset = "total" | "7" | "30" | "90" | "12m" | "custom";
export type DashboardTimeBucket = "day" | "week" | "month";

export type DashboardExecutiveFilterInput = {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
};

export type DashboardFinancialKpiKey =
  | "netRevenue"
  | "netMargin"
  | "marginRate"
  | "stockCurrentValue"
  | "salesCount"
  | "procurementCost"
  | "avgPurchasePieceCost"
  | "confirmedLotsCount"
  | "averageBasket"
  | "stockRotation"
  | "immobilizationRate";

export type DashboardExecutiveIssueCode =
  | DashboardIssueCode
  | "STOCK_TIMELINE_UNAVAILABLE"
  | "CATALOGUE_OPPORTUNITIES_UNAVAILABLE"
  | "IMMOBILIZATION_UNAVAILABLE";

export type DashboardFinancialKpi = {
  key: DashboardFinancialKpiKey;
  label: string;
  kind: "currency" | "percent" | "count";
  value: number | null;
  quality: "ok" | "partial";
  issue: DashboardExecutiveIssueCode | null;
  definition: string;
  formula: string;
  periodScope: string;
};

export type DashboardTrendPoint = {
  key: string;
  label: string;
  from: string;
  to: string;
  netRevenue: number;
  netMargin: number;
  marginRate: number | null;
  stockValue: number | null;
  salesCount: number;
  procurementCost: number;
  avgPurchasePieceCost: number | null;
  confirmedLotsCount: number;
  averageBasket: number | null;
  stockRotation: number | null;
  immobilizationRate: number | null;
  setOrders: number;
  pieceOrders: number;
  setRevenue: number;
  pieceRevenue: number;
  setMargin: number;
  pieceMargin: number;
  setMarginRate: number | null;
  pieceMarginRate: number | null;
};

export type DashboardTrendSeries = {
  activeBucket: DashboardTimeBucket;
  byBucket: Record<DashboardTimeBucket, DashboardTrendPoint[]>;
};

export type DashboardStackedSalesPoint = {
  key: string;
  label: string;
  sets: number;
  pieces: number;
};

export type DashboardStackedSalesSeries = {
  defaultBucket: "week" | "month";
  byBucket: {
    week: DashboardStackedSalesPoint[];
    month: DashboardStackedSalesPoint[];
  };
};

export type DashboardSetPieceGroupedPoint = {
  key: string;
  label: string;
  setRevenue: number;
  pieceRevenue: number;
  setMargin: number;
  pieceMargin: number;
  setMarginRate: number | null;
  pieceMarginRate: number | null;
};

export type DashboardSetPieceTotals = {
  ordersCount: number;
  netRevenue: number;
  netMargin: number;
  marginRate: number | null;
  averageBasket: number | null;
};

export type DashboardSetPieceComparison = {
  defaultBucket: "week" | "month";
  groupedByBucket: {
    week: DashboardSetPieceGroupedPoint[];
    month: DashboardSetPieceGroupedPoint[];
  };
  totals: {
    sets: DashboardSetPieceTotals;
    pieces: DashboardSetPieceTotals;
  };
  pieRevenueShare: {
    sets: number;
    pieces: number;
  };
};

export type DashboardProcurementStockPoint = {
  key: string;
  label: string;
  procurementCost: number;
  procurementTrend: number;
  salesNetRevenue: number;
};

export type DashboardProcurementStockSeries = {
  points: DashboardProcurementStockPoint[];
};

export type DashboardSetOpportunity = {
  key: string;
  setId: string;
  displayRef: string;
  name: string;
  completionPercent: number;
  maxCompleteSets: number;
  totalPartsOwned: number;
  totalPartsNeeded: number;
};

export type DashboardModalConfig = {
  key: string;
  title: string;
  description: string;
  filterLabels: string[];
};

export type DashboardExecutiveFilters = {
  preset: DashboardPreset;
  from: string;
  to: string;
  mode: "RANGE";
  activeBucket: DashboardTimeBucket;
  stackedBucket: "week" | "month";
  activePeriodLabel: string;
};

export type DashboardExecutiveNormalizedQuery = DashboardExecutiveFilters & {
  canonicalQuery: string;
};

export type DashboardExecutiveData = {
  contractVersion: "dashboard.v3";
  generatedAt: string;
  filters: DashboardExecutiveFilters & {
    salesStatus: "CONFIRMED_ONLY";
    procurementScope: "CONFIRMED_LOTS";
  };
  kpis: DashboardFinancialKpi[];
  trendSeries: DashboardTrendSeries;
  stackedSalesSeries: DashboardStackedSalesSeries;
  setPieceComparison: DashboardSetPieceComparison;
  procurementStockSeries: DashboardProcurementStockSeries;
  opportunities: DashboardSetOpportunity[];
  modalConfigs: DashboardModalConfig[];
  partial: boolean;
  issues: DashboardExecutiveIssueCode[];
};

export const DASHBOARD_EXECUTIVE_ISSUE_MESSAGES: Record<DashboardExecutiveIssueCode, string> = {
  SALES_DATA_UNAVAILABLE:
    "Le calcul des ventes confirmees est temporairement indisponible.",
  STOCK_VALUE_UNAVAILABLE:
    "La valorisation du stock n'a pas pu etre recuperee.",
  PROCUREMENT_COST_UNAVAILABLE:
    "Le cout des lots confirmes n'a pas pu etre calcule.",
  STOCK_TIMELINE_UNAVAILABLE:
    "L'evolution temporelle du stock n'a pas pu etre reconstruite depuis le journal.",
  CATALOGUE_OPPORTUNITIES_UNAVAILABLE:
    "Les opportunites catalogue ne sont pas disponibles temporairement.",
  IMMOBILIZATION_UNAVAILABLE:
    "Le taux d'immobilisation n'a pas pu etre calcule.",
};

type SalesHubRow = Pick<
  Tables<"sales">,
  | "id"
  | "paid_at"
  | "net_seller_amount"
  | "total_margin_amount"
  | "total_cost_amount"
  | "sale_type"
>;

type LotHubRow = Pick<Tables<"lots">, "id" | "purchase_date" | "total_cost" | "total_pieces">;

type StockSnapshotRow = Pick<
  Tables<"stock_per_piece">,
  "piece_ref" | "total_value" | "total_quantity"
>;

type StockJournalRow = Pick<
  Tables<"stock_journal">,
  "created_at" | "direction" | "quantity" | "total_value" | "unit_cost"
>;

type SetOpportunitySourceRow = Pick<
  Tables<"set_with_completion">,
  | "id"
  | "display_ref"
  | "name"
  | "completion_percent"
  | "max_complete_sets"
  | "total_parts_owned"
  | "total_parts_needed"
>;

type OldestSalesDateRow = Pick<Tables<"sales">, "paid_at">;
type OldestLotDateRow = Pick<Tables<"lots">, "purchase_date">;

type DailySalesAccumulator = {
  netRevenue: number;
  netMargin: number;
  ordersCount: number;
  setOrders: number;
  pieceOrders: number;
  setRevenue: number;
  pieceRevenue: number;
  setMargin: number;
  pieceMargin: number;
};

type DailyProcurementAccumulator = {
  procurementCost: number;
  procurementPieces: number;
  confirmedLotsCount: number;
};

type BucketAccumulator = {
  key: string;
  label: string;
  from: string;
  to: string;
  netRevenue: number;
  netMargin: number;
  salesCount: number;
  procurementCost: number;
  procurementPieces: number;
  confirmedLotsCount: number;
  setOrders: number;
  pieceOrders: number;
  setRevenue: number;
  pieceRevenue: number;
  setMargin: number;
  pieceMargin: number;
  firstStock: number | null;
  lastStock: number | null;
};

type StockTimelineResult = {
  openingValue: number | null;
  closingValue: number | null;
  dayCloseMap: Record<string, number>;
  hasAnomaly: boolean;
};

function formatDateOnly(value: string): string {
  const parsed = toUtcDateFromDateOnly(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function formatPeriodLabel(range: { from: string; to: string }): string {
  if (range.from === range.to) {
    return `Le ${formatDateOnly(range.from)}`;
  }

  return `Du ${formatDateOnly(range.from)} au ${formatDateOnly(range.to)}`;
}

function normalizePreset(rawValue: string | null | undefined): DashboardPreset {
  const value = (rawValue ?? "").trim().toLowerCase();

  if (
    value === "total" ||
    value === "7" ||
    value === "30" ||
    value === "90" ||
    value === "12m" ||
    value === "custom"
  ) {
    return value;
  }

  return "total";
}

function getPresetRange(preset: DashboardPreset, referenceDate: Date): {
  from: string;
  to: string;
} {
  const today = toDateOnlyUtc(referenceDate);

  if (preset === "custom" || preset === "total") {
    return { from: today, to: today };
  }

  const days =
    preset === "7" ? 7 : preset === "30" ? 30 : preset === "90" ? 90 : 365;

  return {
    from: addDaysDateOnly(today, -(days - 1)),
    to: today,
  };
}

function resolveActiveBucket(preset: DashboardPreset, from: string, to: string): DashboardTimeBucket {
  if (preset === "7" || preset === "30") return "day";
  if (preset === "90") return "week";
  if (preset === "12m") return "month";

  const span = diffDaysInclusive(from, to);
  if (span <= 30) return "day";
  if (span <= 120) return "week";
  return "month";
}

function resolveStackedBucket(
  preset: DashboardPreset,
  from: string,
  to: string
): "week" | "month" {
  if (preset === "12m") return "month";
  if ((preset === "custom" || preset === "total") && diffDaysInclusive(from, to) > 120) {
    return "month";
  }
  return "week";
}

function buildCanonicalQuery(filters: {
  preset: DashboardPreset;
  from: string;
  to: string;
}): string {
  const params = new URLSearchParams();
  params.set("preset", filters.preset);

  if (filters.preset === "custom") {
    params.set("from", filters.from);
    params.set("to", filters.to);
  }

  return params.toString();
}

export function normalizeDashboardExecutiveQuery(
  input?: DashboardExecutiveFilterInput,
  referenceDate = new Date()
): DashboardExecutiveNormalizedQuery {
  let preset = normalizePreset(input?.preset ?? null);
  let from = normalizeDateOnly(input?.from ?? null);
  let to = normalizeDateOnly(input?.to ?? null);

  if (from && to && from > to) {
    const oldFrom = from;
    from = to;
    to = oldFrom;
  }

  if (from || to) {
    preset = "custom";
  }

  if (preset !== "custom") {
    const range = getPresetRange(preset, referenceDate);
    from = range.from;
    to = range.to;
  } else {
    const today = toDateOnlyUtc(referenceDate);
    if (!from && !to) {
      from = today;
      to = today;
    } else {
      if (!from && to) from = to;
      if (!to && from) to = from;
    }
  }

  const safeFrom = from ?? toDateOnlyUtc(referenceDate);
  const safeTo = to ?? safeFrom;
  const activeBucket = resolveActiveBucket(preset, safeFrom, safeTo);
  const stackedBucket = resolveStackedBucket(preset, safeFrom, safeTo);

  return {
    preset,
    from: safeFrom,
    to: safeTo,
    mode: "RANGE",
    activeBucket,
    stackedBucket,
    activePeriodLabel: formatPeriodLabel({ from: safeFrom, to: safeTo }),
    canonicalQuery: buildCanonicalQuery({
      preset,
      from: safeFrom,
      to: safeTo,
    }),
  };
}

function getBucketKey(dateOnly: string, bucket: DashboardTimeBucket): string {
  if (bucket === "day") return dateOnly;

  if (bucket === "week") {
    const date = toUtcDateFromDateOnly(dateOnly);
    const day = date.getUTCDay();
    const delta = day === 0 ? -6 : 1 - day;
    date.setUTCDate(date.getUTCDate() + delta);
    return date.toISOString().slice(0, 10);
  }

  return dateOnly.slice(0, 7);
}

function getBucketLabel(key: string, bucket: DashboardTimeBucket): string {
  if (bucket === "day") {
    return formatDateOnly(key);
  }

  if (bucket === "week") {
    return `Sem. ${formatDateOnly(key)}`;
  }

  const [year, month] = key.split("-");
  const monthNumber = Number.parseInt(month ?? "1", 10);
  const monthLabel = Number.isFinite(monthNumber)
    ? new Date(Date.UTC(2000, monthNumber - 1, 1)).toLocaleDateString("fr-FR", {
        month: "short",
      })
    : month;

  return `${monthLabel} ${year}`;
}

function getBucketRange(key: string, bucket: DashboardTimeBucket): {
  from: string;
  to: string;
} {
  if (bucket === "day") {
    return { from: key, to: key };
  }

  if (bucket === "week") {
    return {
      from: key,
      to: addDaysDateOnly(key, 6),
    };
  }

  const date = toUtcDateFromDateOnly(`${key}-01`);
  const from = date.toISOString().slice(0, 10);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  const to = date.toISOString().slice(0, 10);

  return { from, to };
}

function listDateRangeDays(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;

  while (cursor <= to) {
    days.push(cursor);
    cursor = addDaysDateOnly(cursor, 1);
  }

  return days;
}

async function loadSalesRows(
  client: SupabaseClient<Database>,
  range: DateRangeLike
): Promise<SalesHubRow[]> {
  const rows: SalesHubRow[] = [];
  const { fromIso, toIso } = toSalesDateRangeIso(range);
  let offset = 0;

  while (true) {
    let query = client
      .from("sales")
      .select(
        "id, paid_at, net_seller_amount, total_margin_amount, total_cost_amount, sale_type"
      )
      .eq("status", "CONFIRMED")
      .order("id", { ascending: true })
      .range(offset, offset + AGGREGATION_PAGE_SIZE - 1);

    if (fromIso) query = query.gte("paid_at", fromIso);
    if (toIso) query = query.lte("paid_at", toIso);

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data ?? []) as SalesHubRow[];
    rows.push(...batch);

    if (batch.length < AGGREGATION_PAGE_SIZE) break;
    offset += AGGREGATION_PAGE_SIZE;
  }

  return rows;
}

async function loadLotsRows(
  client: SupabaseClient<Database>,
  range: DateRangeLike
): Promise<LotHubRow[]> {
  const rows: LotHubRow[] = [];
  let offset = 0;

  while (true) {
    let query = client
      .from("lots")
      .select("id, purchase_date, total_cost, total_pieces")
      .eq("status", "confirmed")
      .order("id", { ascending: true })
      .range(offset, offset + AGGREGATION_PAGE_SIZE - 1);

    if (range.from) query = query.gte("purchase_date", range.from);
    if (range.to) query = query.lte("purchase_date", range.to);

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data ?? []) as LotHubRow[];
    rows.push(...batch);

    if (batch.length < AGGREGATION_PAGE_SIZE) break;
    offset += AGGREGATION_PAGE_SIZE;
  }

  return rows;
}

async function loadOldestConfirmedSalesDate(
  client: SupabaseClient<Database>
): Promise<string | null> {
  const { data, error } = await client
    .from("sales")
    .select("paid_at")
    .eq("status", "CONFIRMED")
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const row = data as OldestSalesDateRow | null;
  return extractDateOnlyFromIso(row?.paid_at);
}

async function loadOldestConfirmedLotDate(
  client: SupabaseClient<Database>
): Promise<string | null> {
  const { data, error } = await client
    .from("lots")
    .select("purchase_date")
    .eq("status", "confirmed")
    .not("purchase_date", "is", null)
    .order("purchase_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const row = data as OldestLotDateRow | null;
  return normalizeDateOnly(row?.purchase_date ?? null);
}

function getEarliestDate(values: Array<string | null | undefined>): string | null {
  const validDates = values.filter((value): value is string => Boolean(value));
  if (validDates.length === 0) return null;
  validDates.sort();
  return validDates[0] ?? null;
}

async function loadStockSnapshotRows(
  client: SupabaseClient<Database>
): Promise<StockSnapshotRow[]> {
  const rows: StockSnapshotRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from("stock_per_piece")
      .select("piece_ref, total_value, total_quantity")
      .order("piece_ref", { ascending: true })
      .range(offset, offset + AGGREGATION_PAGE_SIZE - 1);

    if (error) throw error;

    const batch = (data ?? []) as StockSnapshotRow[];
    rows.push(...batch);

    if (batch.length < AGGREGATION_PAGE_SIZE) break;
    offset += AGGREGATION_PAGE_SIZE;
  }

  return rows;
}

async function loadStockJournalRowsUntil(
  client: SupabaseClient<Database>,
  to: string
): Promise<StockJournalRow[]> {
  const rows: StockJournalRow[] = [];
  let offset = 0;
  const toIso = `${to}T23:59:59.999Z`;

  while (true) {
    const { data, error } = await client
      .from("stock_journal")
      .select("created_at, direction, quantity, total_value, unit_cost")
      .lte("created_at", toIso)
      .order("created_at", { ascending: true })
      .range(offset, offset + AGGREGATION_PAGE_SIZE - 1);

    if (error) throw error;

    const batch = (data ?? []) as StockJournalRow[];
    rows.push(...batch);

    if (batch.length < AGGREGATION_PAGE_SIZE) break;
    offset += AGGREGATION_PAGE_SIZE;
  }

  return rows;
}

async function loadSetOpportunitiesRows(
  client: SupabaseClient<Database>
): Promise<SetOpportunitySourceRow[]> {
  const { data, error } = await client
    .from("set_with_completion")
    .select(
      "id, display_ref, name, completion_percent, max_complete_sets, total_parts_owned, total_parts_needed"
    )
    .order("max_complete_sets", { ascending: false, nullsFirst: false })
    .order("completion_percent", { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as SetOpportunitySourceRow[];
}

function getSignedStockMovementValue(row: StockJournalRow): {
  signedValue: number | null;
  hasAnomaly: boolean;
} {
  const direction = (row.direction ?? "").toUpperCase();
  const quantity = toNumber(row.quantity, 0);

  let totalValue = row.total_value !== null ? toNumber(row.total_value, 0) : null;

  if (totalValue === null) {
    if (row.unit_cost !== null && row.quantity !== null) {
      totalValue = Math.abs(toNumber(row.unit_cost, 0) * quantity);
    }
  }

  if (totalValue === null) {
    return { signedValue: null, hasAnomaly: true };
  }

  const absValue = Math.abs(totalValue);

  if (direction === "IN") {
    return { signedValue: absValue, hasAnomaly: false };
  }

  if (direction === "OUT") {
    return { signedValue: -absValue, hasAnomaly: false };
  }

  if (direction === "ADJUST") {
    const sign = quantity < 0 ? -1 : 1;
    return { signedValue: sign * absValue, hasAnomaly: false };
  }

  return { signedValue: null, hasAnomaly: true };
}

function buildStockTimelineFromJournal(options: {
  rows: StockJournalRow[];
  from: string;
  to: string;
}): StockTimelineResult {
  const dayDeltaMap: Record<string, number> = {};
  let openingValue = 0;
  let hasAnomaly = false;

  for (const row of options.rows) {
    const dateOnly = extractDateOnlyFromIso(row.created_at);
    if (!dateOnly) {
      hasAnomaly = true;
      continue;
    }

    const movement = getSignedStockMovementValue(row);
    if (movement.hasAnomaly || movement.signedValue === null) {
      hasAnomaly = true;
      continue;
    }

    if (dateOnly < options.from) {
      openingValue += movement.signedValue;
      continue;
    }

    if (dateOnly > options.to) continue;

    dayDeltaMap[dateOnly] = (dayDeltaMap[dateOnly] ?? 0) + movement.signedValue;
  }

  const days = listDateRangeDays(options.from, options.to);
  const dayCloseMap: Record<string, number> = {};
  let running = openingValue;

  for (const day of days) {
    running += dayDeltaMap[day] ?? 0;
    dayCloseMap[day] = running;
  }

  return {
    openingValue,
    closingValue: days.length > 0 ? dayCloseMap[days[days.length - 1] ?? ""] ?? openingValue : openingValue,
    dayCloseMap,
    hasAnomaly,
  };
}

function getOrInitDailySales(
  map: Map<string, DailySalesAccumulator>,
  key: string
): DailySalesAccumulator {
  const existing = map.get(key);
  if (existing) return existing;

  const next: DailySalesAccumulator = {
    netRevenue: 0,
    netMargin: 0,
    ordersCount: 0,
    setOrders: 0,
    pieceOrders: 0,
    setRevenue: 0,
    pieceRevenue: 0,
    setMargin: 0,
    pieceMargin: 0,
  };

  map.set(key, next);
  return next;
}

function getOrInitDailyProcurement(
  map: Map<string, DailyProcurementAccumulator>,
  key: string
): DailyProcurementAccumulator {
  const existing = map.get(key);
  if (existing) return existing;

  const next: DailyProcurementAccumulator = {
    procurementCost: 0,
    procurementPieces: 0,
    confirmedLotsCount: 0,
  };

  map.set(key, next);
  return next;
}

function getOrInitBucket(
  map: Map<string, BucketAccumulator>,
  key: string,
  bucket: DashboardTimeBucket
): BucketAccumulator {
  const existing = map.get(key);
  if (existing) return existing;

  const range = getBucketRange(key, bucket);
  const next: BucketAccumulator = {
    key,
    label: getBucketLabel(key, bucket),
    from: range.from,
    to: range.to,
    netRevenue: 0,
    netMargin: 0,
    salesCount: 0,
    procurementCost: 0,
    procurementPieces: 0,
    confirmedLotsCount: 0,
    setOrders: 0,
    pieceOrders: 0,
    setRevenue: 0,
    pieceRevenue: 0,
    setMargin: 0,
    pieceMargin: 0,
    firstStock: null,
    lastStock: null,
  };

  map.set(key, next);
  return next;
}

function buildTrendPointsByBucket(options: {
  bucket: DashboardTimeBucket;
  days: string[];
  salesByDay: Map<string, DailySalesAccumulator>;
  procurementByDay: Map<string, DailyProcurementAccumulator>;
  dayStockCloseMap: Record<string, number> | null;
  ca12m: number | null;
}): DashboardTrendPoint[] {
  const bucketMap = new Map<string, BucketAccumulator>();

  for (const day of options.days) {
    const bucketKey = getBucketKey(day, options.bucket);
    const bucket = getOrInitBucket(bucketMap, bucketKey, options.bucket);

    const daySales = options.salesByDay.get(day);
    const dayProc = options.procurementByDay.get(day);

    bucket.netRevenue += daySales?.netRevenue ?? 0;
    bucket.netMargin += daySales?.netMargin ?? 0;
    bucket.salesCount += daySales?.ordersCount ?? 0;
    bucket.procurementCost += dayProc?.procurementCost ?? 0;
    bucket.procurementPieces += dayProc?.procurementPieces ?? 0;
    bucket.confirmedLotsCount += dayProc?.confirmedLotsCount ?? 0;
    bucket.setOrders += daySales?.setOrders ?? 0;
    bucket.pieceOrders += daySales?.pieceOrders ?? 0;
    bucket.setRevenue += daySales?.setRevenue ?? 0;
    bucket.pieceRevenue += daySales?.pieceRevenue ?? 0;
    bucket.setMargin += daySales?.setMargin ?? 0;
    bucket.pieceMargin += daySales?.pieceMargin ?? 0;

    const stockValue = options.dayStockCloseMap ? options.dayStockCloseMap[day] : undefined;

    if (typeof stockValue === "number") {
      if (bucket.firstStock === null) bucket.firstStock = stockValue;
      bucket.lastStock = stockValue;
    }
  }

  const keys = Array.from(bucketMap.keys()).sort();

  return keys.map((key) => {
    const bucket = bucketMap.get(key);
    if (!bucket) {
      return {
        key,
        label: getBucketLabel(key, options.bucket),
        from: key,
        to: key,
        netRevenue: 0,
        netMargin: 0,
        marginRate: null,
        stockValue: null,
        salesCount: 0,
        procurementCost: 0,
        avgPurchasePieceCost: null,
        confirmedLotsCount: 0,
        averageBasket: null,
        stockRotation: null,
        immobilizationRate: null,
        setOrders: 0,
        pieceOrders: 0,
        setRevenue: 0,
        pieceRevenue: 0,
        setMargin: 0,
        pieceMargin: 0,
        setMarginRate: null,
        pieceMarginRate: null,
      };
    }

    const marginRate =
      bucket.netRevenue > 0 ? (bucket.netMargin / bucket.netRevenue) * 100 : null;

    const averageBasket =
      bucket.salesCount > 0 ? bucket.netRevenue / bucket.salesCount : null;

    const avgPurchasePieceCost =
      bucket.procurementPieces > 0
        ? bucket.procurementCost / bucket.procurementPieces
        : null;

    const averageStock =
      bucket.firstStock !== null && bucket.lastStock !== null
        ? (bucket.firstStock + bucket.lastStock) / 2
        : null;

    const stockRotation =
      averageStock !== null && averageStock > 0
        ? bucket.netRevenue / averageStock
        : null;

    const setMarginRate =
      bucket.setRevenue > 0 ? (bucket.setMargin / bucket.setRevenue) * 100 : null;

    const pieceMarginRate =
      bucket.pieceRevenue > 0 ? (bucket.pieceMargin / bucket.pieceRevenue) * 100 : null;

    const stockValue = bucket.lastStock;

    const immobilizationRate =
      stockValue !== null && options.ca12m !== null && options.ca12m > 0
        ? stockValue / options.ca12m
        : null;

    return {
      key: bucket.key,
      label: bucket.label,
      from: bucket.from,
      to: bucket.to,
      netRevenue: bucket.netRevenue,
      netMargin: bucket.netMargin,
      marginRate,
      stockValue,
      salesCount: bucket.salesCount,
      procurementCost: bucket.procurementCost,
      avgPurchasePieceCost,
      confirmedLotsCount: bucket.confirmedLotsCount,
      averageBasket,
      stockRotation,
      immobilizationRate,
      setOrders: bucket.setOrders,
      pieceOrders: bucket.pieceOrders,
      setRevenue: bucket.setRevenue,
      pieceRevenue: bucket.pieceRevenue,
      setMargin: bucket.setMargin,
      pieceMargin: bucket.pieceMargin,
      setMarginRate,
      pieceMarginRate,
    };
  });
}

function toMovingAverage(values: number[], windowSize: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - (windowSize - 1));
    const subset = values.slice(start, index + 1);
    const sum = subset.reduce((acc, value) => acc + value, 0);
    return subset.length > 0 ? sum / subset.length : 0;
  });
}

function buildFinancialKpi(options: {
  key: DashboardFinancialKpiKey;
  label: string;
  kind: "currency" | "percent" | "count";
  value: number | null;
  issue: DashboardExecutiveIssueCode | null;
  definition: string;
  formula: string;
  periodScope: string;
}): DashboardFinancialKpi {
  return {
    key: options.key,
    label: options.label,
    kind: options.kind,
    value: options.value,
    quality: options.issue ? "partial" : "ok",
    issue: options.issue,
    definition: options.definition,
    formula: options.formula,
    periodScope: options.periodScope,
  };
}

function buildModalConfigs(): DashboardModalConfig[] {
  return [
    {
      key: "kpi-all",
      title: "KPIs financiers",
      description: "Vue etendue par KPI avec mini-serie temporelle.",
      filterLabels: ["Granularite", "Serie KPI"],
    },
    {
      key: "block-trends",
      title: "Tendances temporelles",
      description: "Courbes CA/marge avec variables additionnelles optionnelles.",
      filterLabels: ["Granularite", "Variables visibles"],
    },
    {
      key: "block-set-piece",
      title: "Comparaison Sets vs Pieces",
      description: "Histogramme groupe par metrique avec bascule CA/Marge/Taux.",
      filterLabels: ["Metrique", "Regroupement"],
    },
    {
      key: "block-procurement",
      title: "Pilotage achats/stock",
      description: "Vue mensuelle achats + tendance, avec correlation ventes optionnelle.",
      filterLabels: ["Correlation ventes"],
    },
    {
      key: "block-opportunities",
      title: "Opportunites catalogue",
      description: "Classement des sets avec meilleur potentiel de completion.",
      filterLabels: ["Volume affiche"],
    },
  ];
}

export async function getDashboardExecutiveData(
  client: SupabaseClient<Database>,
  input?: DashboardExecutiveFilterInput
): Promise<DashboardExecutiveData> {
  const normalized = normalizeDashboardExecutiveQuery(input);

  const issues = new Set<DashboardExecutiveIssueCode>();

  async function loadRequired<T>(
    label: string,
    issue: DashboardExecutiveIssueCode,
    fallback: T,
    loader: () => Promise<T>
  ): Promise<T> {
    try {
      return await loader();
    } catch (error) {
      console.error(`getDashboardExecutiveData - ${label} failed:`, error);
      issues.add(issue);
      return fallback;
    }
  }

  let effectiveFrom = normalized.from;
  let effectiveTo = normalized.to;
  const effectivePreset = normalized.preset;

  if (effectivePreset === "total") {
    const [oldestSalesDate, oldestLotDate] = await Promise.all([
      loadRequired(
        "oldest confirmed sale date",
        "SALES_DATA_UNAVAILABLE",
        null as string | null,
        () => loadOldestConfirmedSalesDate(client)
      ),
      loadRequired(
        "oldest confirmed lot date",
        "PROCUREMENT_COST_UNAVAILABLE",
        null as string | null,
        () => loadOldestConfirmedLotDate(client)
      ),
    ]);

    const earliestBusinessDate = getEarliestDate([oldestSalesDate, oldestLotDate]);
    effectiveFrom = earliestBusinessDate ?? normalized.to;
    effectiveTo = normalized.to;
  }

  const effectiveActiveBucket = resolveActiveBucket(
    effectivePreset,
    effectiveFrom,
    effectiveTo
  );
  const effectiveStackedBucket = resolveStackedBucket(
    effectivePreset,
    effectiveFrom,
    effectiveTo
  );
  const effectiveActivePeriodLabel = formatPeriodLabel({
    from: effectiveFrom,
    to: effectiveTo,
  });

  const [salesRows, procurementRows, stockRows, stockJournalRows, opportunitiesRows] =
    await Promise.all([
      loadRequired("sales", "SALES_DATA_UNAVAILABLE", [] as SalesHubRow[], () =>
        loadSalesRows(client, {
          from: effectiveFrom,
          to: effectiveTo,
        })
      ),
      loadRequired(
        "procurement",
        "PROCUREMENT_COST_UNAVAILABLE",
        [] as LotHubRow[],
        () =>
          loadLotsRows(client, {
            from: effectiveFrom,
            to: effectiveTo,
          })
      ),
      loadRequired(
        "stock snapshot",
        "STOCK_VALUE_UNAVAILABLE",
        [] as StockSnapshotRow[],
        () => loadStockSnapshotRows(client)
      ),
      loadRequired(
        "stock journal",
        "STOCK_TIMELINE_UNAVAILABLE",
        [] as StockJournalRow[],
        () => loadStockJournalRowsUntil(client, effectiveTo)
      ),
      loadRequired(
        "set opportunities",
        "CATALOGUE_OPPORTUNITIES_UNAVAILABLE",
        [] as SetOpportunitySourceRow[],
        () => loadSetOpportunitiesRows(client)
      ),
    ]);

  const salesUnavailable = issues.has("SALES_DATA_UNAVAILABLE");
  const procurementUnavailable = issues.has("PROCUREMENT_COST_UNAVAILABLE");
  const stockSnapshotUnavailable = issues.has("STOCK_VALUE_UNAVAILABLE");

  const stockTimeline = buildStockTimelineFromJournal({
    rows: stockJournalRows,
    from: effectiveFrom,
    to: effectiveTo,
  });

  if (stockTimeline.hasAnomaly) {
    issues.add("STOCK_TIMELINE_UNAVAILABLE");
  }

  const stockValueCurrent = stockRows.reduce(
    (acc, row) => acc + toNumber(row.total_value, 0),
    0
  );

  const salesTotals = salesRows.reduce(
    (acc, row) => {
      const revenue = toNumber(row.net_seller_amount, 0);
      const cost = toNumber(row.total_cost_amount, 0);
      const margin =
        row.total_margin_amount !== null
          ? toNumber(row.total_margin_amount, 0)
          : revenue - cost;

      acc.netRevenue += revenue;
      acc.netMargin += margin;
      acc.salesCount += 1;

      const saleType = (row.sale_type ?? "").toUpperCase();
      if (saleType === "SET") {
        acc.setOrders += 1;
        acc.setRevenue += revenue;
        acc.setMargin += margin;
      } else if (saleType === "PIECE") {
        acc.pieceOrders += 1;
        acc.pieceRevenue += revenue;
        acc.pieceMargin += margin;
      }

      return acc;
    },
    {
      netRevenue: 0,
      netMargin: 0,
      salesCount: 0,
      setOrders: 0,
      pieceOrders: 0,
      setRevenue: 0,
      pieceRevenue: 0,
      setMargin: 0,
      pieceMargin: 0,
    }
  );

  const procurementTotals = procurementRows.reduce(
    (acc, row) => {
      acc.procurementCost += toNumber(row.total_cost, 0);
      acc.procurementPieces += toNumber(row.total_pieces, 0);
      acc.confirmedLotsCount += 1;
      return acc;
    },
    {
      procurementCost: 0,
      procurementPieces: 0,
      confirmedLotsCount: 0,
    }
  );

  const marginRate =
    salesTotals.netRevenue > 0
      ? (salesTotals.netMargin / salesTotals.netRevenue) * 100
      : null;

  const averageBasket =
    salesTotals.salesCount > 0
      ? salesTotals.netRevenue / salesTotals.salesCount
      : null;

  const avgPurchasePieceCost =
    procurementTotals.procurementPieces > 0
      ? procurementTotals.procurementCost / procurementTotals.procurementPieces
      : null;

  const stockOpening = stockTimeline.openingValue;
  const stockClosing = stockTimeline.closingValue;

  const stockAverageForPeriod =
    stockOpening !== null && stockClosing !== null
      ? (stockOpening + stockClosing) / 2
      : null;

  const stockRotation =
    stockAverageForPeriod !== null && stockAverageForPeriod > 0
      ? salesTotals.netRevenue / stockAverageForPeriod
      : null;

  const immobilizationAnchorFrom = addDaysDateOnly(effectiveTo, -364);

  const sales12mRows = await loadRequired(
    "sales 12m",
    "IMMOBILIZATION_UNAVAILABLE",
    [] as SalesHubRow[],
    () =>
      loadSalesRows(client, {
        from: immobilizationAnchorFrom,
        to: effectiveTo,
      })
  );

  const ca12m = sales12mRows.reduce(
    (acc, row) => acc + toNumber(row.net_seller_amount, 0),
    0
  );

  const immobilizationRate =
    ca12m > 0 ? stockValueCurrent / ca12m : null;

  const salesByDay = new Map<string, DailySalesAccumulator>();
  for (const row of salesRows) {
    const dateOnly = extractDateOnlyFromIso(row.paid_at);
    if (!dateOnly) continue;
    if (dateOnly < effectiveFrom || dateOnly > effectiveTo) continue;

    const target = getOrInitDailySales(salesByDay, dateOnly);
    const revenue = toNumber(row.net_seller_amount, 0);
    const margin =
      row.total_margin_amount !== null
        ? toNumber(row.total_margin_amount, 0)
        : revenue - toNumber(row.total_cost_amount, 0);

    target.netRevenue += revenue;
    target.netMargin += margin;
    target.ordersCount += 1;

    const saleType = (row.sale_type ?? "").toUpperCase();
    if (saleType === "SET") {
      target.setOrders += 1;
      target.setRevenue += revenue;
      target.setMargin += margin;
    } else if (saleType === "PIECE") {
      target.pieceOrders += 1;
      target.pieceRevenue += revenue;
      target.pieceMargin += margin;
    }
  }

  const procurementByDay = new Map<string, DailyProcurementAccumulator>();
  for (const row of procurementRows) {
    const dateOnly = normalizeDateOnly(row.purchase_date);
    if (!dateOnly) continue;
    if (dateOnly < effectiveFrom || dateOnly > effectiveTo) continue;

    const target = getOrInitDailyProcurement(procurementByDay, dateOnly);
    target.procurementCost += toNumber(row.total_cost, 0);
    target.procurementPieces += toNumber(row.total_pieces, 0);
    target.confirmedLotsCount += 1;
  }

  const days = listDateRangeDays(effectiveFrom, effectiveTo);

  const trendByBucket: Record<DashboardTimeBucket, DashboardTrendPoint[]> = {
    day: buildTrendPointsByBucket({
      bucket: "day",
      days,
      salesByDay,
      procurementByDay,
      dayStockCloseMap: issues.has("STOCK_TIMELINE_UNAVAILABLE")
        ? null
        : stockTimeline.dayCloseMap,
      ca12m: ca12m > 0 ? ca12m : null,
    }),
    week: buildTrendPointsByBucket({
      bucket: "week",
      days,
      salesByDay,
      procurementByDay,
      dayStockCloseMap: issues.has("STOCK_TIMELINE_UNAVAILABLE")
        ? null
        : stockTimeline.dayCloseMap,
      ca12m: ca12m > 0 ? ca12m : null,
    }),
    month: buildTrendPointsByBucket({
      bucket: "month",
      days,
      salesByDay,
      procurementByDay,
      dayStockCloseMap: issues.has("STOCK_TIMELINE_UNAVAILABLE")
        ? null
        : stockTimeline.dayCloseMap,
      ca12m: ca12m > 0 ? ca12m : null,
    }),
  };

  const stackedSalesSeries: DashboardStackedSalesSeries = {
    defaultBucket: effectiveStackedBucket,
    byBucket: {
      week: trendByBucket.week.map((point) => ({
        key: point.key,
        label: point.label,
        sets: point.setOrders,
        pieces: point.pieceOrders,
      })),
      month: trendByBucket.month.map((point) => ({
        key: point.key,
        label: point.label,
        sets: point.setOrders,
        pieces: point.pieceOrders,
      })),
    },
  };

  const groupedWeek: DashboardSetPieceGroupedPoint[] = trendByBucket.week.map((point) => ({
    key: point.key,
    label: point.label,
    setRevenue: point.setRevenue,
    pieceRevenue: point.pieceRevenue,
    setMargin: point.setMargin,
    pieceMargin: point.pieceMargin,
    setMarginRate: point.setMarginRate,
    pieceMarginRate: point.pieceMarginRate,
  }));

  const groupedMonth: DashboardSetPieceGroupedPoint[] = trendByBucket.month.map((point) => ({
    key: point.key,
    label: point.label,
    setRevenue: point.setRevenue,
    pieceRevenue: point.pieceRevenue,
    setMargin: point.setMargin,
    pieceMargin: point.pieceMargin,
    setMarginRate: point.setMarginRate,
    pieceMarginRate: point.pieceMarginRate,
  }));

  const setPieceComparison: DashboardSetPieceComparison = {
    defaultBucket: effectiveStackedBucket,
    groupedByBucket: {
      week: groupedWeek,
      month: groupedMonth,
    },
    totals: {
      sets: {
        ordersCount: salesTotals.setOrders,
        netRevenue: salesTotals.setRevenue,
        netMargin: salesTotals.setMargin,
        marginRate:
          salesTotals.setRevenue > 0
            ? (salesTotals.setMargin / salesTotals.setRevenue) * 100
            : null,
        averageBasket:
          salesTotals.setOrders > 0
            ? salesTotals.setRevenue / salesTotals.setOrders
            : null,
      },
      pieces: {
        ordersCount: salesTotals.pieceOrders,
        netRevenue: salesTotals.pieceRevenue,
        netMargin: salesTotals.pieceMargin,
        marginRate:
          salesTotals.pieceRevenue > 0
            ? (salesTotals.pieceMargin / salesTotals.pieceRevenue) * 100
            : null,
        averageBasket:
          salesTotals.pieceOrders > 0
            ? salesTotals.pieceRevenue / salesTotals.pieceOrders
            : null,
      },
    },
    pieRevenueShare: {
      sets: salesTotals.setRevenue,
      pieces: salesTotals.pieceRevenue,
    },
  };

  const monthlyPoints = trendByBucket.month;
  const procurementTrendValues = toMovingAverage(
    monthlyPoints.map((point) => point.procurementCost),
    3
  );

  const procurementStockSeries: DashboardProcurementStockSeries = {
    points: monthlyPoints.map((point, index) => ({
      key: point.key,
      label: point.label,
      procurementCost: point.procurementCost,
      procurementTrend: procurementTrendValues[index] ?? 0,
      salesNetRevenue: point.netRevenue,
    })),
  };

  const opportunities = opportunitiesRows
    .map((row) => {
      const setId = row.id ?? "";
      const displayRef = (row.display_ref ?? "").trim() || setId;
      const name = (row.name ?? "").trim() || "Set sans nom";

      return {
        key: setId || `${displayRef}-${name}`,
        setId,
        displayRef,
        name,
        completionPercent: toNumber(row.completion_percent, 0),
        maxCompleteSets: toNumber(row.max_complete_sets, 0),
        totalPartsOwned: toNumber(row.total_parts_owned, 0),
        totalPartsNeeded: toNumber(row.total_parts_needed, 0),
      } satisfies DashboardSetOpportunity;
    })
    .filter((row) => row.setId.length > 0)
    .sort((a, b) => {
      if (b.maxCompleteSets !== a.maxCompleteSets) {
        return b.maxCompleteSets - a.maxCompleteSets;
      }
      return b.completionPercent - a.completionPercent;
    })
    .slice(0, 12);

  const kpis: DashboardFinancialKpi[] = [
    buildFinancialKpi({
      key: "netRevenue",
      label: "CA net",
      kind: "currency",
      value: salesTotals.netRevenue,
      issue: salesUnavailable ? "SALES_DATA_UNAVAILABLE" : null,
      definition: "Somme des montants nets des ventes confirmees sur la periode active.",
      formula: "sum(sales.net_seller_amount)",
      periodScope: effectiveActivePeriodLabel,
    }),
    buildFinancialKpi({
      key: "netMargin",
      label: "Marge nette",
      kind: "currency",
      value: salesTotals.netMargin,
      issue: salesUnavailable ? "SALES_DATA_UNAVAILABLE" : null,
      definition: "Somme des marges nettes des ventes confirmees.",
      formula: "sum(sales.total_margin_amount) avec fallback (net - cost)",
      periodScope: effectiveActivePeriodLabel,
    }),
    buildFinancialKpi({
      key: "marginRate",
      label: "Taux de marge",
      kind: "percent",
      value: marginRate,
      issue: salesUnavailable ? "SALES_DATA_UNAVAILABLE" : null,
      definition: "Marge nette globale rapportee au CA net.",
      formula: "marge_nette / ca_net",
      periodScope: effectiveActivePeriodLabel,
    }),
    buildFinancialKpi({
      key: "stockCurrentValue",
      label: "Valeur du stock actuel",
      kind: "currency",
      value: stockValueCurrent,
      issue: stockSnapshotUnavailable ? "STOCK_VALUE_UNAVAILABLE" : null,
      definition: "Valorisation instantanee du stock disponible a l'instant T.",
      formula: "sum(stock_per_piece.total_value)",
      periodScope: "Snapshot courant",
    }),
    buildFinancialKpi({
      key: "salesCount",
      label: "Nombre de ventes",
      kind: "count",
      value: salesTotals.salesCount,
      issue: salesUnavailable ? "SALES_DATA_UNAVAILABLE" : null,
      definition: "Nombre de commandes confirmees sur la periode active.",
      formula: "count(sales.id)",
      periodScope: effectiveActivePeriodLabel,
    }),
    buildFinancialKpi({
      key: "procurementCost",
      label: "Cout d'approvisionnement",
      kind: "currency",
      value: procurementTotals.procurementCost,
      issue: procurementUnavailable ? "PROCUREMENT_COST_UNAVAILABLE" : null,
      definition: "Somme des couts des lots confirmes sur la periode active.",
      formula: "sum(lots.total_cost)",
      periodScope: effectiveActivePeriodLabel,
    }),
    buildFinancialKpi({
      key: "avgPurchasePieceCost",
      label: "Cout moyen d'une piece achetee",
      kind: "currency",
      value: avgPurchasePieceCost,
      issue: procurementUnavailable ? "PROCUREMENT_COST_UNAVAILABLE" : null,
      definition: "Cout unitaire moyen des pieces achetees dans la periode active.",
      formula: "sum(lots.total_cost) / sum(lots.total_pieces)",
      periodScope: effectiveActivePeriodLabel,
    }),
    buildFinancialKpi({
      key: "confirmedLotsCount",
      label: "Nombre de lots confirmes",
      kind: "count",
      value: procurementTotals.confirmedLotsCount,
      issue: procurementUnavailable ? "PROCUREMENT_COST_UNAVAILABLE" : null,
      definition: "Nombre de lots d'achat confirmes sur la periode active.",
      formula: "count(lots.id)",
      periodScope: effectiveActivePeriodLabel,
    }),
    buildFinancialKpi({
      key: "averageBasket",
      label: "Panier moyen",
      kind: "currency",
      value: averageBasket,
      issue: salesUnavailable ? "SALES_DATA_UNAVAILABLE" : null,
      definition: "Montant net moyen par commande confirmee.",
      formula: "ca_net / nb_ventes",
      periodScope: effectiveActivePeriodLabel,
    }),
    buildFinancialKpi({
      key: "stockRotation",
      label: "Rotation stock",
      kind: "percent",
      value: stockRotation !== null ? stockRotation * 100 : null,
      issue:
        salesUnavailable || issues.has("STOCK_TIMELINE_UNAVAILABLE")
          ? "STOCK_TIMELINE_UNAVAILABLE"
          : null,
      definition:
        "Vitesse de rotation economique du stock sur la periode active.",
      formula: "ca_net_periode / ((stock_ouverture + stock_cloture) / 2)",
      periodScope: effectiveActivePeriodLabel,
    }),
    buildFinancialKpi({
      key: "immobilizationRate",
      label: "Taux d'immobilisation",
      kind: "percent",
      value: immobilizationRate !== null ? immobilizationRate * 100 : null,
      issue: issues.has("IMMOBILIZATION_UNAVAILABLE")
        ? "IMMOBILIZATION_UNAVAILABLE"
        : null,
      definition:
        "Part de capital immobilisee dans le stock actuel rapportee au CA cumule 12 mois.",
      formula: "valeur_stock_actuelle / ca_12m_glissants",
      periodScope: `Ancre au ${formatDateOnly(effectiveTo)}`,
    }),
  ];

  const issueList = Array.from(issues);

  return {
    contractVersion: "dashboard.v3",
    generatedAt: new Date().toISOString(),
    filters: {
      preset: effectivePreset,
      from: effectiveFrom,
      to: effectiveTo,
      mode: normalized.mode,
      activeBucket: effectiveActiveBucket,
      stackedBucket: effectiveStackedBucket,
      activePeriodLabel: effectiveActivePeriodLabel,
      salesStatus: "CONFIRMED_ONLY",
      procurementScope: "CONFIRMED_LOTS",
    },
    kpis,
    trendSeries: {
      activeBucket: effectiveActiveBucket,
      byBucket: trendByBucket,
    },
    stackedSalesSeries,
    setPieceComparison,
    procurementStockSeries,
    opportunities,
    modalConfigs: buildModalConfigs(),
    partial: issueList.length > 0,
    issues: issueList,
  };
}
