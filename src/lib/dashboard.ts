import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/supabase";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const AGGREGATION_PAGE_SIZE = 1000;

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

type StockValueAggregationRow = Pick<Tables<"stock_per_piece">, "piece_ref" | "total_value">;

type ProcurementAggregationRow = Pick<Tables<"lots">, "id" | "total_cost">;

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

function toSalesDateRangeIso(range: DashboardDateRange): {
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
  range: DashboardDateRange
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
  range: DashboardDateRange
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
