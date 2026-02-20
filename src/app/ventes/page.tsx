import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";
import {
  getSalesPageData,
  type SalesPageSortColumn,
  type SalesPageSortDir,
} from "@/lib/sales";
import { SalesTable } from "@/components/sales/SalesTable";
import { SalesStatCard } from "@/components/sales/SalesStatCard";
import { NewSaleDialog } from "@/components/sales/NewSaleDialog";
import { PageHeader } from "@/components/ui/page-header";
import { FilterPopover } from "@/components/ui/filter-bar";

export const dynamic = "force-dynamic";

type SortColumn = SalesPageSortColumn;
type SalesSortDir = SalesPageSortDir;
type SalesTypeFilter = "SET" | "PIECE";

type RawSalesSearchParams = Record<string, string | string[] | undefined>;

type SalesPageProps = {
  searchParams?: Promise<RawSalesSearchParams>;
};

type NormalizedSalesQuery = {
  includeCancelled: boolean;
  newIntent: boolean;
  channel: string | null;
  saleType: SalesTypeFilter | null;
  sort: SortColumn;
  dir: SalesSortDir;
  page: number;
  from: string | null;
  to: string | null;
  canonicalQuery: string;
  baseQuery: string;
};

const PAGE_SIZE = 50;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
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
): { from: string | null; to: string | null } {
  let from = normalizeDateOnly(fromInput);
  let to = normalizeDateOnly(toInput);

  if (from && to && from > to) {
    const oldFrom = from;
    from = to;
    to = oldFrom;
  }

  return { from, to };
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
  const includeCancelledRaw = (getFirstParamValue(raw.include_cancelled) ?? "")
    .trim()
    .toLowerCase();
  const includeCancelled =
    includeCancelledRaw === "true"
      ? true
      : includeCancelledRaw === "false"
      ? false
      : DEFAULT_INCLUDE_CANCELLED;
  const newRaw = (getFirstParamValue(raw.new) ?? "").trim();
  const newIntent = newRaw === "1";

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
  const { from, to } = normalizeDateRange(
    getFirstParamValue(raw.from),
    getFirstParamValue(raw.to)
  );

  const canonicalParams = new URLSearchParams();
  canonicalParams.set("include_cancelled", includeCancelled ? "true" : "false");
  if (newIntent) canonicalParams.set("new", "1");
  if (channel) canonicalParams.set("channel", channel);
  if (saleType) canonicalParams.set("sale_type", saleType);
  canonicalParams.set("sort", sort);
  canonicalParams.set("dir", dir);
  canonicalParams.set("page", String(page));
  if (from) canonicalParams.set("from", from);
  if (to) canonicalParams.set("to", to);

  const baseParams = new URLSearchParams();
  baseParams.set("include_cancelled", includeCancelled ? "true" : "false");
  if (newIntent) baseParams.set("new", "1");
  if (channel) baseParams.set("channel", channel);
  if (saleType) baseParams.set("sale_type", saleType);
  if (from) baseParams.set("from", from);
  if (to) baseParams.set("to", to);

  return {
    includeCancelled,
    newIntent,
    channel,
    saleType,
    sort,
    dir,
    page,
    from,
    to,
    canonicalQuery: canonicalParams.toString(),
    baseQuery: baseParams.toString(),
  };
}

export default async function VentesPage({ searchParams }: SalesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const normalized = normalizeSalesQuery(resolvedSearchParams);

  const incomingQuery = toIncomingSearchParams(resolvedSearchParams).toString();
  if (incomingQuery !== normalized.canonicalQuery) {
    redirect(`/ventes?${normalized.canonicalQuery}`);
  }

  const salesPageData = await getSalesPageData(
    {
      includeCancelled: normalized.includeCancelled,
      channel: normalized.channel,
      saleType: normalized.saleType,
      sort: normalized.sort,
      dir: normalized.dir,
      page: normalized.page,
      pageSize: PAGE_SIZE,
      from: normalized.from,
      to: normalized.to,
    },
    supabase
  );

  const { table, kpis, headerCounts } = salesPageData;
  const totalSalesCount = headerCounts.totalSalesCount;

  const buildStatusToggleHref = (includeCancelled: boolean) => {
    const params = new URLSearchParams();
    params.set("include_cancelled", includeCancelled ? "true" : "false");
    if (normalized.newIntent) params.set("new", "1");
    if (normalized.channel) params.set("channel", normalized.channel);
    if (normalized.saleType) params.set("sale_type", normalized.saleType);
    params.set("sort", normalized.sort);
    params.set("dir", normalized.dir);
    params.set("page", "1");
    if (normalized.from) params.set("from", normalized.from);
    if (normalized.to) params.set("to", normalized.to);
    return `/ventes?${params.toString()}`;
  };

  const includeCancelledHref = buildStatusToggleHref(true);
  const excludeCancelledHref = buildStatusToggleHref(false);

  const resetDateParams = new URLSearchParams();
  resetDateParams.set(
    "include_cancelled",
    normalized.includeCancelled ? "true" : "false"
  );
  if (normalized.newIntent) resetDateParams.set("new", "1");
  if (normalized.channel) resetDateParams.set("channel", normalized.channel);
  if (normalized.saleType) resetDateParams.set("sale_type", normalized.saleType);
  resetDateParams.set("sort", normalized.sort);
  resetDateParams.set("dir", normalized.dir);
  resetDateParams.set("page", "1");
  const resetDateHref = `/ventes?${resetDateParams.toString()}`;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Ventes"
        description="Suivi des ventes de sets et de pièces au détail."
        meta={
          totalSalesCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {totalSalesCount.toLocaleString("fr-FR")} commandes
              {" • "}
              <span className="text-emerald-700">
                {headerCounts.confirmedCount.toLocaleString("fr-FR")} confirmées
              </span>
              {normalized.includeCancelled ? (
                <>
                  {" • "}
                  <span className="text-rose-700">
                    {headerCounts.cancelledCount.toLocaleString("fr-FR")} annulées
                  </span>
                </>
              ) : null}
            </p>
          ) : null
        }
        actions={
          <>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
              <Link
                href={includeCancelledHref}
                className={cn(
                  "inline-flex h-7 items-center rounded-full px-3 text-[11px] font-medium transition-colors",
                  normalized.includeCancelled
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                Inclure annulées
              </Link>
              <Link
                href={excludeCancelledHref}
                className={cn(
                  "inline-flex h-7 items-center rounded-full px-3 text-[11px] font-medium transition-colors",
                  !normalized.includeCancelled
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                Exclure annulées
              </Link>
            </div>

            <FilterPopover>
              <form method="GET" className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-500">Du</label>
                    <input
                      type="date"
                      name="from"
                      defaultValue={normalized.from ?? ""}
                      className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs shadow-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-500">Au</label>
                    <input
                      type="date"
                      name="to"
                      defaultValue={normalized.to ?? ""}
                      className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs shadow-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <input
                  type="hidden"
                  name="include_cancelled"
                  value={normalized.includeCancelled ? "true" : "false"}
                />
                {normalized.newIntent && <input type="hidden" name="new" value="1" />}
                {normalized.channel ? (
                  <input type="hidden" name="channel" value={normalized.channel} />
                ) : null}
                {normalized.saleType ? (
                  <input type="hidden" name="sale_type" value={normalized.saleType} />
                ) : null}
                <input type="hidden" name="sort" value={normalized.sort} />
                <input type="hidden" name="dir" value={normalized.dir} />
                <input type="hidden" name="page" value="1" />

                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={resetDateHref}
                    className="inline-flex h-8 items-center rounded-full border border-slate-200 px-3 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Réinitialiser
                  </Link>
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center rounded-full bg-slate-900 px-3 text-[11px] font-medium text-white hover:bg-slate-800"
                  >
                    Appliquer
                  </button>
                </div>
              </form>
            </FilterPopover>

            <NewSaleDialog openFromIntent={normalized.newIntent} />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-start">
        <SalesStatCard
          title="CA net (ventes confirmées)"
          mainValue={euro.format(kpis.netWindowValue)}
          color="indigo"
        />

        <SalesStatCard
          title="Marge totale"
          mainValue={euro.format(kpis.marginWindowValue)}
          color="orange"
        />

        <SalesStatCard
          title="Taux de marge moyen"
          mainValue={
            kpis.netWindowValue > 0
              ? `${(kpis.avgMarginRateWindowValue * 100).toFixed(1)}%`
              : "—"
          }
          color="amber"
        />

        <SalesStatCard
          title="Commandes avec set(s)"
          mainValue={kpis.setsWindowValue.toLocaleString("fr-FR")}
          color="emerald"
        />

        <SalesStatCard
          title="Commandes avec pièce(s)"
          mainValue={kpis.piecesWindowValue.toLocaleString("fr-FR")}
          color="emerald"
        />
      </section>

      <SalesTable
        rows={table.rows}
        activeSortKey={normalized.sort}
        sortDir={normalized.dir}
        baseQuery={normalized.baseQuery}
        pagination={{
          currentPage: table.currentPage,
          totalPages: table.totalPages,
          pageNumbers: table.pageNumbers,
          pageFrom: table.pageFrom,
          pageTo: table.pageTo,
          totalCount: table.totalCount,
        }}
      />
    </main>
  );
}
