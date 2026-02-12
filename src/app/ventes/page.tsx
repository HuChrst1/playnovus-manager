import { supabaseServer as supabase } from "@/lib/supabase-server";
import { listSalesForTable } from "@/lib/sales";
import { SalesTable } from "@/components/sales/SalesTable";
import { SalesStatCardWithDialog } from "@/components/sales/SalesStatCardWithDialog";
import { NewSaleDialog } from "@/components/sales/NewSaleDialog";

export const dynamic = "force-dynamic";

// Colonnes triables pour la liste des ventes
type SortColumn =
  | "sale_id"
  | "paid_at"
  | "sales_channel"
  | "sale_type"
  | "status"
  | "net_seller_amount"
  | "total_cost_amount"
  | "total_margin_amount";

type SalesSearchParams = {
  sort?: string;
  dir?: string; // "asc" | "desc"
  page?: string; // pagination (ex: "1", "2", ...)

  // Fenêtres par card (même pattern qu'Appro : stats_window_<id>)
  stats_window_net?: string;
  stats_window_margin?: string;
  stats_window_rate?: string;
  stats_window_sets?: string;
  stats_window_pieces?: string;
};

type SalesPageProps = {
  searchParams?: Promise<SalesSearchParams>;
};

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parseWindowParam(value: string | undefined, fallback: number): number {
  const n = Number((value ?? "").toString());
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export default async function VentesPage({ searchParams }: SalesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const PAGE_SIZE = 50;

  // ----------------------------
  // Pagination / tri (table)
  // ----------------------------
  const pageRaw = (resolvedSearchParams.page ?? "1").toString();
  const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const sortParamRaw = (resolvedSearchParams.sort ?? "paid_at").toString();
  let dir = (resolvedSearchParams.dir ?? "desc").toString().toLowerCase();
  if (dir !== "asc" && dir !== "desc") dir = "desc";

  const ALLOWED_SORT_COLUMNS: SortColumn[] = [
    "sale_id",
    "paid_at",
    "sale_type",
    "sales_channel",
    "status",
    "net_seller_amount",
    "total_cost_amount",
    "total_margin_amount",
  ];

  let activeSortKey = sortParamRaw;
  let dbSortColumn: SortColumn = "paid_at";

  if ((ALLOWED_SORT_COLUMNS as readonly string[]).includes(sortParamRaw)) {
    dbSortColumn = sortParamRaw as SortColumn;
  } else {
    activeSortKey = "paid_at";
    dbSortColumn = "paid_at";
  }

  // 1) Charger la liste agrégée (1 ligne = 1 commande)
  const { rows: rawRows, total } = await listSalesForTable(supabase, {
    limit: PAGE_SIZE,
    offset,
    sort: dbSortColumn,
    dir: dir === "asc" ? "asc" : "desc",
  });

  const totalCount = total ?? 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 1;
  const pageFrom = totalCount === 0 ? 0 : offset + 1;
  const pageTo = Math.min(offset + PAGE_SIZE, totalCount);

  // Pages à afficher (compacte avec "…") — même logique que /catalogue
  let pageNumbers: (number | "dots")[] = [];

  if (totalPages <= 7) {
    pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    const siblings = 1;

    const startPage = Math.max(2, page - siblings);
    const endPage = Math.min(totalPages - 1, page + siblings);

    pageNumbers = [1];

    if (startPage > 2) pageNumbers.push("dots");

    for (let p = startPage; p <= endPage; p++) pageNumbers.push(p);

    if (endPage < totalPages - 1) pageNumbers.push("dots");

    pageNumbers.push(totalPages);
  }

  // Rows déjà triées côté SQL (listSalesForTable) => pagination cohérente
  const rows = rawRows;

  // ----------------------------
  // 3.6.3 — STATS CARDS
  // - mainValue : dépend de la fenêtre par card (7/30/90)
  // - trend (%) : TOUJOURS 30j vs 30j précédents (indépendant du filtre)
  // - UNIQUEMENT ventes CONFIRMED
  // - Date = paid_at
  // ----------------------------

  const windowNetDays = parseWindowParam(resolvedSearchParams.stats_window_net, 30);
  const windowMarginDays = parseWindowParam(
    resolvedSearchParams.stats_window_margin,
    30
  );
  const windowRateDays = parseWindowParam(resolvedSearchParams.stats_window_rate, 30);
  const windowSetsDays = parseWindowParam(resolvedSearchParams.stats_window_sets, 30);
  const windowPiecesDays = parseWindowParam(
    resolvedSearchParams.stats_window_pieces,
    30
  );

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const today = new Date();
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  // On limite la requête à ce qui est strictement nécessaire :
  // max(window choisi, 60j pour trend 30j vs 30j).
  const maxDaysNeeded = Math.max(
    60,
    windowNetDays,
    windowMarginDays,
    windowRateDays,
    windowSetsDays,
    windowPiecesDays
  );

  const cutoff = new Date(todayMidnight.getTime() - maxDaysNeeded * MS_PER_DAY);

  const { data: salesForStatsRaw, error: salesForStatsError } = await supabase
    .from("sales")
    .select("paid_at, net_seller_amount, total_margin_amount, sale_items(item_kind)")
    .eq("status", "CONFIRMED")
    .gte("paid_at", cutoff.toISOString());

  if (salesForStatsError) {
    console.error(
      "VentesPage - erreur chargement stats cards:",
      salesForStatsError
    );
  }

  type SaleForStats = {
    paid_at: string | null;
    net_seller_amount: number | string | null;
    total_margin_amount: number | string | null;
    sale_items?: { item_kind: "SET" | "PIECE" | string | null }[] | null;
  };

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

  const hasSet = (s: SaleForStats) =>
    Array.isArray(s.sale_items) &&
    s.sale_items.some((it) => it?.item_kind === "SET");

  const hasPiece = (s: SaleForStats) =>
    Array.isArray(s.sale_items) &&
    s.sale_items.some((it) => it?.item_kind === "PIECE");

  const sumNet = (arr: SaleForStats[]) =>
    arr.reduce((acc, s) => acc + Number(s.net_seller_amount ?? 0), 0);

  const sumMargin = (arr: SaleForStats[]) =>
    arr.reduce((acc, s) => acc + Number(s.total_margin_amount ?? 0), 0);

  const countWithSet = (arr: SaleForStats[]) => arr.filter(hasSet).length;
  const countWithPiece = (arr: SaleForStats[]) => arr.filter(hasPiece).length;

  const filterLastWindow = (days: number) =>
    salesForStats.filter((s) => isInLastNDays(s.paid_at, days));

  // KPI affichés (dépendent de la fenêtre choisie)
  const salesNetW = filterLastWindow(windowNetDays);
  const salesMarginW = filterLastWindow(windowMarginDays);
  const salesRateW = filterLastWindow(windowRateDays);
  const salesSetsW = filterLastWindow(windowSetsDays);
  const salesPiecesW = filterLastWindow(windowPiecesDays);

  const netWindowValue = sumNet(salesNetW);
  const marginWindowValue = sumMargin(salesMarginW);

  const rateNet = sumNet(salesRateW);
  const rateMargin = sumMargin(salesRateW);
  const avgMarginRateWindowValue = rateNet > 0 ? rateMargin / rateNet : 0;

  const setsWindowValue = countWithSet(salesSetsW);
  const piecesWindowValue = countWithPiece(salesPiecesW);

  // Trends TOUJOURS sur 30j vs 30j précédents
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

  const setsTrend = calcTrend(countWithSet(last30), countWithSet(prev30));
  const piecesTrend = calcTrend(countWithPiece(last30), countWithPiece(prev30));

  // Header (cohérent avec le total global) — 1 seule requête
  // totalSalesCount = total (pagination) => toutes ventes (tous statuts)
  // confirmedCount = count DB (CONFIRMED)
  // cancelledCount = total - confirmed (hypothèse : statuts = CONFIRMED | CANCELLED)
  const { count: confirmedCountRaw, error: confirmedCountErr } = await supabase
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("status", "CONFIRMED");

  if (confirmedCountErr) {
    console.error("VentesPage - erreur count CONFIRMED:", confirmedCountErr);
  }

  const totalSalesCount = totalCount;
  const confirmedCount = confirmedCountRaw ?? 0;
  const cancelledCount = Math.max(0, totalSalesCount - confirmedCount);

  return (
    <main className="space-y-6">
      {/* HEADER PAGE */}
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

      {/* CARDS STATS — même UX que /approvisionnement */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-start">
        <SalesStatCardWithDialog
          id="net"
          title="CA net (ventes confirmées)"
          mainValue={euro.format(netWindowValue)}
          trendPercent={netTrend}
          color="indigo"
          windowDays={windowNetDays}
        />

        <SalesStatCardWithDialog
          id="margin"
          title="Marge totale"
          mainValue={euro.format(marginWindowValue)}
          trendPercent={marginTrend}
          color="orange"
          windowDays={windowMarginDays}
        />

        <SalesStatCardWithDialog
          id="rate"
          title="Taux de marge moyen"
          mainValue={
            rateNet > 0 ? `${(avgMarginRateWindowValue * 100).toFixed(1)}%` : "—"
          }
          trendPercent={rateTrend}
          color="amber"
          windowDays={windowRateDays}
        />

        <SalesStatCardWithDialog
          id="sets"
          title="Commandes avec set(s)"
          mainValue={setsWindowValue.toLocaleString("fr-FR")}
          trendPercent={setsTrend}
          color="emerald"
          windowDays={windowSetsDays}
        />

        <SalesStatCardWithDialog
          id="pieces"
          title="Commandes avec pièce(s)"
          mainValue={piecesWindowValue.toLocaleString("fr-FR")}
          trendPercent={piecesTrend}
          color="emerald"
          windowDays={windowPiecesDays}
        />
      </section>

      {/* TABLE "COMMANDES" */}
      <SalesTable
        rows={rows}
        activeSortKey={activeSortKey}
        sortDir={dir === "asc" ? "asc" : "desc"}
        baseQuery=""
        pagination={{
          currentPage: page,
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