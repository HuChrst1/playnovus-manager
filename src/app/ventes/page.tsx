import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import {
  getSalesPageData,
  type SalesPageSortColumn,
  type SalesPageSortDir,
} from "@/lib/sales";
import { SalesTable } from "@/components/sales/SalesTable";
import { SalesStatCard } from "@/components/sales/SalesStatCard";
import { NewSaleDialog } from "@/components/sales/NewSaleDialog";
import { Button } from "@/components/ui/button";
import {
  Boxes,
  Calculator,
  ChartColumnIncreasing,
  Filter,
  Package,
  Wallet,
} from "lucide-react";

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

  const { table, kpis } = salesPageData;

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
  const activeFilterCount =
    Number(normalized.includeCancelled !== DEFAULT_INCLUDE_CANCELLED) +
    Number(Boolean(normalized.from)) +
    Number(Boolean(normalized.to));

  return (
    <main className="space-y-6">
      <header className="px-1 md:px-2">
        <div className="min-w-0">
          <h1 className="text-3xl font-medium tracking-tight text-slate-900 md:text-[42px] md:leading-none">
            Ventes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Suivi des ventes de sets et de pièces au détail.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-start">
        <SalesStatCard
          title="CA net (ventes confirmées)"
          mainValue={euro.format(kpis.netWindowValue)}
          color="indigo"
          variant="neutral"
          icon={<Wallet className="h-4 w-4" />}
          iconGradientClassName="from-sky-700 to-blue-500"
        />

        <SalesStatCard
          title="Marge totale"
          mainValue={euro.format(kpis.marginWindowValue)}
          color="azure"
          variant="neutral"
          icon={<ChartColumnIncreasing className="h-4 w-4" />}
          iconGradientClassName="from-cyan-600 to-sky-400"
        />

        <SalesStatCard
          title="Taux de marge moyen"
          mainValue={
            kpis.netWindowValue > 0
              ? `${(kpis.avgMarginRateWindowValue * 100).toFixed(1)}%`
              : "—"
          }
          color="sky"
          variant="neutral"
          icon={<Calculator className="h-4 w-4" />}
          iconGradientClassName="from-blue-700 to-indigo-500"
        />

        <SalesStatCard
          title="Commandes avec set(s)"
          mainValue={kpis.setsWindowValue.toLocaleString("fr-FR")}
          color="emerald"
          variant="neutral"
          icon={<Package className="h-4 w-4" />}
          iconGradientClassName="from-sky-600 to-blue-400"
        />

        <SalesStatCard
          title="Commandes avec pièce(s)"
          mainValue={kpis.piecesWindowValue.toLocaleString("fr-FR")}
          color="emerald"
          variant="neutral"
          icon={<Boxes className="h-4 w-4" />}
          iconGradientClassName="from-blue-600 to-cyan-400"
        />
      </section>

      <div className="appro-actions-bar">
        <details className="group relative">
          <summary
            className="appro-filter-trigger-icon"
            data-active={activeFilterCount > 0 ? "true" : "false"}
            aria-label="Filtrer"
            title={activeFilterCount > 0 ? `Filtrer (${activeFilterCount} actif)` : "Filtrer"}
          >
            <Filter className="h-4 w-4" />
          </summary>

          <div className="appro-filter-popover-left hidden group-open:block">
            <form method="GET" className="app-filter-toolbar-panel">
              <label
                htmlFor="sales-include-cancelled"
                className="app-filter-toolbar-field"
              >
                <span>Statut</span>
                <select
                  id="sales-include-cancelled"
                  name="include_cancelled"
                  defaultValue={normalized.includeCancelled ? "true" : "false"}
                  className="app-control h-8 w-[168px] px-3 text-[11px]"
                >
                  <option value="true">Inclure annulées</option>
                  <option value="false">Exclure annulées</option>
                </select>
              </label>

              <label
                htmlFor="sales-from"
                className="app-filter-toolbar-field"
              >
                <span>Du</span>
                <input
                  id="sales-from"
                  type="date"
                  name="from"
                  defaultValue={normalized.from ?? ""}
                  className="app-control h-8 w-[132px] px-3 text-[11px]"
                />
              </label>

              <label
                htmlFor="sales-to"
                className="app-filter-toolbar-field"
              >
                <span>Au</span>
                <input
                  id="sales-to"
                  type="date"
                  name="to"
                  defaultValue={normalized.to ?? ""}
                  className="app-control h-8 w-[132px] px-3 text-[11px]"
                />
              </label>
              {normalized.newIntent ? <input type="hidden" name="new" value="1" /> : null}
              {normalized.channel ? (
                <input type="hidden" name="channel" value={normalized.channel} />
              ) : null}
              {normalized.saleType ? (
                <input type="hidden" name="sale_type" value={normalized.saleType} />
              ) : null}
              <input type="hidden" name="sort" value={normalized.sort} />
              <input type="hidden" name="dir" value={normalized.dir} />
              <input type="hidden" name="page" value="1" />

              <div className="app-filter-toolbar-actions">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="text-[11px]"
                >
                  <Link href={resetDateHref}>Réinitialiser</Link>
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="text-[11px] font-semibold"
                >
                  Appliquer
                </Button>
              </div>
            </form>
          </div>
        </details>

        {activeFilterCount > 0 ? (
          <span className="app-filter-active-badge" aria-live="polite">
            {activeFilterCount} filtre actif
            {activeFilterCount > 1 ? "s" : ""}
          </span>
        ) : null}

        <NewSaleDialog
          openFromIntent={normalized.newIntent}
          triggerClassName="h-9 gap-2 px-4 text-xs font-medium"
        />
      </div>

      <SalesTable
        rows={table.rows}
        activeSortKey={normalized.sort}
        sortDir={normalized.dir}
        baseQuery={normalized.baseQuery}
        variant="appro"
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
