import { redirect } from "next/navigation";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import { listSalesForTable } from "@/lib/sales";
import { SalesTable } from "@/components/sales/SalesTable";
import { SalesStatCardWithDialog } from "@/components/sales/SalesStatCardWithDialog";
import { NewSaleDialog } from "@/components/sales/NewSaleDialog";

export const dynamic = "force-dynamic";

type SortColumn =
  | "sale_id"
  | "paid_at"
  | "sales_channel"
  | "sale_type"
  | "status"
  | "net_seller_amount"
  | "total_cost_amount"
  | "total_margin_amount";

type SalesPeriod = "total" | "90" | "30" | "7";
type SalesSortDir = "asc" | "desc";
type SalesTypeFilter = "SET" | "PIECE";

type RawSalesSearchParams = Record<string, string | string[] | undefined>;

type SalesPageProps = {
  searchParams?: Promise<RawSalesSearchParams>;
};

type NormalizedSalesQuery = {
  period: SalesPeriod;
  includeCancelled: boolean;
  channel: string | null;
  saleType: SalesTypeFilter | null;
  sort: SortColumn;
  dir: SalesSortDir;
  page: number;
  canonicalQuery: string;
  baseQuery: string;
};

type SaleForStats = {
  paid_at: string | null;
  net_seller_amount: number | string | null;
  total_margin_amount: number | string | null;
  sale_type: string | null;
};

const PAGE_SIZE = 50;
const ALLOWED_SORT_COLUMNS: ReadonlySet<SortColumn> = new Set([
  "sale_id",
  "paid_at",
  "sale_type",
  "sales_channel",
  "status",
  "net_seller_amount",
  "total_cost_amount",
  "total_margin_amount",
]);
const ALLOWED_PERIODS: ReadonlySet<SalesPeriod> = new Set([
  "total",
  "90",
  "30",
  "7",
]);

const DEFAULT_PERIOD: SalesPeriod = "30";
const DEFAULT_INCLUDE_CANCELLED = true;
const DEFAULT_SORT: SortColumn = "paid_at";
const DEFAULT_DIR: SalesSortDir = "desc";
const DEFAULT_PAGE = 1;

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getFirstParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toIncomingSearchParams(raw: RawSalesSearchParams): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value[0] ?? "");
      continue;
    }

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return params;
}

function normalizeSalesQuery(raw: RawSalesSearchParams): NormalizedSalesQuery {
  const periodRaw = (getFirstParamValue(raw.period) ?? "")
    .trim()
    .toLowerCase() as SalesPeriod;
  const period = ALLOWED_PERIODS.has(periodRaw) ? periodRaw : DEFAULT_PERIOD;

  const includeCancelledRaw = (getFirstParamValue(raw.include_cancelled) ?? "")
    .trim()
    .toLowerCase();
  const includeCancelled =
    includeCancelledRaw === "true"
      ? true
      : includeCancelledRaw === "false"
      ? false
      : DEFAULT_INCLUDE_CANCELLED;

  const channelRaw = (getFirstParamValue(raw.channel) ?? "").trim();
  const channel = channelRaw.length > 0 ? channelRaw : null;

  const saleTypeRaw = (getFirstParamValue(raw.sale_type) ?? "")
    .trim()
    .toUpperCase();
  const saleType =
    saleTypeRaw === "SET" || saleTypeRaw === "PIECE"
      ? (saleTypeRaw as SalesTypeFilter)
      : null;

  const sortRaw = (getFirstParamValue(raw.sort) ?? "").trim() as SortColumn;
  const sort = ALLOWED_SORT_COLUMNS.has(sortRaw) ? sortRaw : DEFAULT_SORT;

  const dirRaw = (getFirstParamValue(raw.dir) ?? "").trim().toLowerCase();
  const dir: SalesSortDir = dirRaw === "asc" ? "asc" : DEFAULT_DIR;

  const pageRaw = (getFirstParamValue(raw.page) ?? "").trim();
  const parsedPage = Number.parseInt(pageRaw, 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : DEFAULT_PAGE;

  const canonicalParams = new URLSearchParams();
  canonicalParams.set("period", period);
  canonicalParams.set("include_cancelled", includeCancelled ? "true" : "false");
  if (channel) canonicalParams.set("channel", channel);
  if (saleType) canonicalParams.set("sale_type", saleType);
  canonicalParams.set("sort", sort);
  canonicalParams.set("dir", dir);
  canonicalParams.set("page", String(page));

  const baseParams = new URLSearchParams();
  baseParams.set("period", period);
  baseParams.set("include_cancelled", includeCancelled ? "true" : "false");
  if (channel) baseParams.set("channel", channel);
  if (saleType) baseParams.set("sale_type", saleType);

  return {
    period,
    includeCancelled,
    channel,
    saleType,
    sort,
    dir,
    page,
    canonicalQuery: canonicalParams.toString(),
    baseQuery: baseParams.toString(),
  };
}

function getPeriodDays(period: SalesPeriod): number | null {
  if (period === "total") return null;
  return Number.parseInt(period, 10);
}

function toNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default async function VentesPage({ searchParams }: SalesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const normalized = normalizeSalesQuery(resolvedSearchParams);

  const incomingQuery = toIncomingSearchParams(resolvedSearchParams).toString();
  if (incomingQuery !== normalized.canonicalQuery) {
    redirect(`/ventes?${normalized.canonicalQuery}`);
  }

  const offset = (normalized.page - 1) * PAGE_SIZE;

  const statusFilter = normalized.includeCancelled ? undefined : "CONFIRMED";

  const { rows: rawRows, total } = await listSalesForTable(supabase, {
    limit: PAGE_SIZE,
    offset,
    sort: normalized.sort,
    dir: normalized.dir,
    channel: normalized.channel ?? undefined,
    sale_type: normalized.saleType ?? undefined,
    status: statusFilter,
  });

  const totalCount = total ?? 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 1;
  const pageFrom = totalCount === 0 ? 0 : offset + 1;
  const pageTo = Math.min(offset + PAGE_SIZE, totalCount);

  let pageNumbers: Array<number | "dots"> = [];
  if (totalPages <= 7) {
    pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    const siblings = 1;
    const startPage = Math.max(2, normalized.page - siblings);
    const endPage = Math.min(totalPages - 1, normalized.page + siblings);

    pageNumbers = [1];
    if (startPage > 2) pageNumbers.push("dots");
    for (let p = startPage; p <= endPage; p += 1) pageNumbers.push(p);
    if (endPage < totalPages - 1) pageNumbers.push("dots");
    pageNumbers.push(totalPages);
  }

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const periodDays = getPeriodDays(normalized.period);
  const maxDaysNeeded = periodDays === null ? null : Math.max(60, periodDays);

  let salesForStatsQuery = supabase
    .from("sales")
    .select("paid_at, net_seller_amount, total_margin_amount, sale_type")
    .eq("status", "CONFIRMED");

  if (normalized.channel) {
    salesForStatsQuery = salesForStatsQuery.eq("sales_channel", normalized.channel);
  }

  if (normalized.saleType) {
    salesForStatsQuery = salesForStatsQuery.eq("sale_type", normalized.saleType);
  }

  if (maxDaysNeeded !== null) {
    const cutoff = new Date(todayMidnight.getTime() - maxDaysNeeded * MS_PER_DAY);
    salesForStatsQuery = salesForStatsQuery.gte("paid_at", cutoff.toISOString());
  }

  const { data: salesForStatsRaw, error: salesForStatsError } = await salesForStatsQuery;

  if (salesForStatsError) {
    console.error("VentesPage - erreur chargement stats cards:", salesForStatsError);
  }

  const salesForStats = (salesForStatsRaw ?? []) as SaleForStats[];

  const isInLastNDays = (paidAt: string | null, days: number): boolean => {
    if (!paidAt) return false;
    const d = new Date(paidAt);
    if (Number.isNaN(d.getTime())) return false;

    const windowAgo = new Date(todayMidnight.getTime() - days * MS_PER_DAY);
    return d >= windowAgo && d < todayMidnight;
  };

  const isInPrevNDays = (paidAt: string | null, days: number): boolean => {
    if (!paidAt) return false;
    const d = new Date(paidAt);
    if (Number.isNaN(d.getTime())) return false;

    const windowAgo = new Date(todayMidnight.getTime() - days * MS_PER_DAY);
    const prevWindowAgo = new Date(todayMidnight.getTime() - 2 * days * MS_PER_DAY);
    return d >= prevWindowAgo && d < windowAgo;
  };

  const calcTrend = (current: number, previous: number): number | null => {
    if (current === 0 && previous === 0) return null;
    const base = previous === 0 ? 1 : previous;
    return ((current - previous) / base) * 100;
  };

  const sumNet = (arr: SaleForStats[]) =>
    arr.reduce((acc, s) => acc + toNumber(s.net_seller_amount, 0), 0);

  const sumMargin = (arr: SaleForStats[]) =>
    arr.reduce((acc, s) => acc + toNumber(s.total_margin_amount, 0), 0);

  const countSets = (arr: SaleForStats[]) =>
    arr.filter((s) => s.sale_type === "SET").length;

  const countPieces = (arr: SaleForStats[]) =>
    arr.filter((s) => s.sale_type === "PIECE").length;

  const salesInPeriod =
    periodDays === null
      ? salesForStats
      : salesForStats.filter((s) => isInLastNDays(s.paid_at, periodDays));

  const netWindowValue = sumNet(salesInPeriod);
  const marginWindowValue = sumMargin(salesInPeriod);

  const rateNet = sumNet(salesInPeriod);
  const rateMargin = sumMargin(salesInPeriod);
  const avgMarginRateWindowValue = rateNet > 0 ? rateMargin / rateNet : 0;

  const setsWindowValue = countSets(salesInPeriod);
  const piecesWindowValue = countPieces(salesInPeriod);

  const last30 = salesForStats.filter((s) => isInLastNDays(s.paid_at, 30));
  const prev30 = salesForStats.filter((s) => isInPrevNDays(s.paid_at, 30));

  const netTrend = calcTrend(sumNet(last30), sumNet(prev30));
  const marginTrend = calcTrend(sumMargin(last30), sumMargin(prev30));

  const rateLast30Net = sumNet(last30);
  const ratePrev30Net = sumNet(prev30);
  const rateLast30Margin = sumMargin(last30);
  const ratePrev30Margin = sumMargin(prev30);

  const rateLast30 = rateLast30Net > 0 ? rateLast30Margin / rateLast30Net : 0;
  const ratePrev30 = ratePrev30Net > 0 ? ratePrev30Margin / ratePrev30Net : 0;
  const rateTrend = calcTrend(rateLast30, ratePrev30);

  const setsTrend = calcTrend(countSets(last30), countSets(prev30));
  const piecesTrend = calcTrend(countPieces(last30), countPieces(prev30));

  const countSalesByStatus = async (status: "CONFIRMED" | "CANCELLED") => {
    let q = supabase.from("sales").select("id", { count: "exact", head: true });

    if (normalized.channel) q = q.eq("sales_channel", normalized.channel);
    if (normalized.saleType) q = q.eq("sale_type", normalized.saleType);

    q = q.eq("status", status);

    const { count, error } = await q;
    if (error) {
      console.error(`VentesPage - erreur count ${status}:`, error);
      return 0;
    }

    return count ?? 0;
  };

  const [confirmedCount, cancelledCount] = await Promise.all([
    countSalesByStatus("CONFIRMED"),
    normalized.includeCancelled ? countSalesByStatus("CANCELLED") : Promise.resolve(0),
  ]);

  const totalSalesCount = totalCount;

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ventes</h1>
          <p className="text-sm text-muted-foreground">
            Suivi des ventes de sets et de pièces au détail.
          </p>
          {totalSalesCount > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {totalSalesCount.toLocaleString("fr-FR")} commandes
              {" • "}
              <span className="text-emerald-700">
                {confirmedCount.toLocaleString("fr-FR")} confirmées
              </span>
              {" • "}
              <span className="text-rose-700">
                {cancelledCount.toLocaleString("fr-FR")} annulées
              </span>
            </p>
          )}
        </div>

        <NewSaleDialog />
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-start">
        <SalesStatCardWithDialog
          id="net"
          title="CA net (ventes confirmées)"
          mainValue={euro.format(netWindowValue)}
          trendPercent={netTrend}
          color="indigo"
          period={normalized.period}
        />

        <SalesStatCardWithDialog
          id="margin"
          title="Marge totale"
          mainValue={euro.format(marginWindowValue)}
          trendPercent={marginTrend}
          color="orange"
          period={normalized.period}
        />

        <SalesStatCardWithDialog
          id="rate"
          title="Taux de marge moyen"
          mainValue={
            rateNet > 0 ? `${(avgMarginRateWindowValue * 100).toFixed(1)}%` : "—"
          }
          trendPercent={rateTrend}
          color="amber"
          period={normalized.period}
        />

        <SalesStatCardWithDialog
          id="sets"
          title="Commandes avec set(s)"
          mainValue={setsWindowValue.toLocaleString("fr-FR")}
          trendPercent={setsTrend}
          color="emerald"
          period={normalized.period}
        />

        <SalesStatCardWithDialog
          id="pieces"
          title="Commandes avec pièce(s)"
          mainValue={piecesWindowValue.toLocaleString("fr-FR")}
          trendPercent={piecesTrend}
          color="emerald"
          period={normalized.period}
        />
      </section>

      <SalesTable
        rows={rawRows}
        activeSortKey={normalized.sort}
        sortDir={normalized.dir}
        baseQuery={normalized.baseQuery}
        pagination={{
          currentPage: normalized.page,
          totalPages,
          pageNumbers,
          pageFrom,
          pageTo,
          totalCount,
        }}
      />
    </main>
  );
}
