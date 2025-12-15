import Link from "next/link";
import { supabaseServer as supabase } from "@/lib/supabase-server";
import { listSalesForTable, type SalesListRow } from "@/lib/sales";
import { SalesTable } from "@/components/sales/SalesTable";
import { SalesStatCard } from "@/components/sales/SalesStatCard";
import { NewSaleDialog } from "@/components/sales/NewSaleDialog";
import { SoldPiecesTable, type SoldPiecesRow } from "@/components/sales/SoldPiecesTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SourceFilterDropdown } from "@/components/sales/SourceFilterDropdown";
import type { Tables } from "@/types/supabase";

export const dynamic = "force-dynamic";

// Colonnes triables pour la liste des ventes
type SortColumn =
  | "sale_id"
  | "paid_at"
  | "sale_type"
  | "sales_channel"
  | "net_seller_amount"
  | "total_cost_amount"
  | "total_margin_amount"
  | "margin_rate"
  | "sets_count"
  | "pieces_qty_total";

  type SalesSearchParams = {
    tab?: string;      // "sales" | "pieces"
    sort?: string;
    dir?: string;      // "asc" | "desc"
  
    // Filtres sales tab
    from?: string;
    to?: string;
    channel?: string;
    type?: string;     // "SET" | "PIECE"
  
    // Filtres pieces tab
    piece?: string;
    source?: string;   // "SET" | "PIECE"
  };

type SalesPageProps = {
  searchParams?: Promise<SalesSearchParams>;
};

type SoldPiecesJournalRow = Tables<"sold_pieces_journal">;

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function VentesPage({
  searchParams,
}: SalesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const tabRaw = (resolvedSearchParams.tab ?? "sales").toString().toLowerCase();
  const tab: "sales" | "pieces" = tabRaw === "pieces" ? "pieces" : "sales";

  if (tab === "pieces") {
    const pieceFilter = (resolvedSearchParams.piece ?? "").toString().trim();
    const sourceRaw = (resolvedSearchParams.source ?? "").toString().trim().toUpperCase();
    const sourceFilter = sourceRaw === "SET" || sourceRaw === "PIECE" ? sourceRaw : "";
  
    let q = supabase
      .from("sold_pieces_journal")
      .select(
        "piece_ref, source, sale_id, sale_item_id, paid_at, sales_channel, sale_type, status, quantity, unit_cost, total_cost, lot_id"
      );

    if (pieceFilter) {
      q = q.ilike("piece_ref", `%${pieceFilter}%`);
    }
    if (sourceFilter) {
      q = q.eq("source", sourceFilter);
    }

    const { data: soldData, error: soldError } = await q
      .order("paid_at", { ascending: false })
      .limit(200)
      .returns<SoldPiecesJournalRow[]>();
  
    if (soldError) {
      return (
        <main className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Ventes</h1>
              <p className="text-sm text-muted-foreground">
                Erreur lors du chargement des pièces vendues : {soldError.message}
              </p>
            </div>
            <NewSaleDialog />
          </div>
  
          {/* Tabs */}
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/ventes">Ventes</Link>
            </Button>
            <Button asChild variant="default" size="sm">
              <Link href="/ventes?tab=pieces">Pièces vendues</Link>
            </Button>
          </div>
        </main>
      );
    }
  
    const rows: SoldPiecesRow[] = (soldData ?? []).map((r) => ({
      ...r,
      // Normalisation des champs nullable de la vue pour correspondre au type UI (SoldPiecesRow)
      piece_ref: r.piece_ref ?? "",
      source: r.source ?? "",
      paid_at: r.paid_at ?? "",
      sales_channel: r.sales_channel ?? "",
      sale_type: r.sale_type ?? "",
      status: r.status ?? "",
      sale_id: r.sale_id === null ? "" : String(r.sale_id),
      sale_item_id: r.sale_item_id === null ? "" : String(r.sale_item_id),
      quantity: r.quantity ?? 0,
      unit_cost: r.unit_cost ?? 0,
      total_cost: r.total_cost ?? 0,
      lot_id: r.lot_id === null ? "" : String(r.lot_id),
    }));
  
    return (
      <main className="space-y-6">
        {/* HEADER PAGE */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ventes</h1>
            <p className="text-sm text-muted-foreground">
              Suivi des ventes de sets et de pièces au détail.
            </p>
          </div>
          <NewSaleDialog />
        </div>
  
        {/* Tabs */}
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/ventes">Ventes</Link>
          </Button>
          <Button asChild variant="default" size="sm">
            <Link href="/ventes?tab=pieces">Pièces vendues</Link>
          </Button>
        </div>
  
        {/* Filtres */}
        <form className="flex flex-wrap gap-2 items-end" method="get" action="/ventes">
          <input type="hidden" name="tab" value="pieces" />
  
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Pièce</label>
            <Input
              name="piece"
              defaultValue={pieceFilter}
              placeholder="ex: 3001"
              className="h-8"
            />
          </div>

          <SourceFilterDropdown defaultValue={sourceFilter} />
  
          <Button type="submit" variant="secondary" size="sm">
            Filtrer
          </Button>
  
          {(pieceFilter || sourceFilter) && (
            <Button asChild variant="ghost" size="sm">
            <Link href="/ventes?tab=pieces">Reset</Link>
          </Button>
          )}
        </form>
  
        <SoldPiecesTable rows={rows} />
      </main>
    );
  }

    // ----------------------------
  // ONGLET "VENTES" (commandes)
  // ----------------------------

  const sortParamRaw = (resolvedSearchParams.sort ?? "paid_at").toString();
  let dir = (resolvedSearchParams.dir ?? "desc").toString().toLowerCase();
  if (dir !== "asc" && dir !== "desc") dir = "desc";

  const ALLOWED_SORT_COLUMNS: SortColumn[] = [
    "sale_id",
    "paid_at",
    "sale_type",
    "sales_channel",
    "net_seller_amount",
    "total_cost_amount",
    "total_margin_amount",
    "margin_rate",
    "sets_count",
    "pieces_qty_total",
  ];

  let activeSortKey = sortParamRaw;
  let dbSortColumn: SortColumn = "paid_at";

  if ((ALLOWED_SORT_COLUMNS as readonly string[]).includes(sortParamRaw)) {
    dbSortColumn = sortParamRaw as SortColumn;
  } else {
    activeSortKey = "paid_at";
    dbSortColumn = "paid_at";
  }

  // (Filtres futurs, déjà parsés)
  const from = (resolvedSearchParams.from ?? "").toString().trim();
  const to = (resolvedSearchParams.to ?? "").toString().trim();
  const channel = (resolvedSearchParams.channel ?? "").toString().trim();
  const typeRaw = (resolvedSearchParams.type ?? "").toString().trim().toUpperCase();
  const type = typeRaw === "SET" || typeRaw === "PIECE" ? (typeRaw as "SET" | "PIECE") : undefined;

  // Normalisation simple des dates (si on reçoit YYYY-MM-DD)
  const fromIso = from && from.length === 10 ? `${from}T00:00:00.000Z` : from;
  const toIso = to && to.length === 10 ? `${to}T23:59:59.999Z` : to;

  // Liste des canaux (dropdown)
  const { data: channelData } = await supabase
    .from("sales")
    .select("sales_channel")
    .neq("status", "CANCELLED")
    .limit(2000);

  const channels = Array.from(
    new Set(
      (channelData ?? [])
        .map((r: any) => String(r.sales_channel ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "fr"));

  // 1) Charger la liste agrégée (1 ligne = 1 commande)
  const { rows: rawRows } = await listSalesForTable(supabase, {
    status: "CONFIRMED",
    from: fromIso || undefined,
    to: toIso || undefined,
    channel: channel || undefined,
    type,
    limit: 200,
    offset: 0,
  });

  // 2) Tri serveur (sur le tableau)
  const rows = [...rawRows].sort((a, b) => {
    const sgn = dir === "asc" ? 1 : -1;

    const get = (r: SalesListRow): any => {
      switch (dbSortColumn) {
        case "sale_id":
          return r.sale_id;
        case "paid_at":
          return new Date(r.paid_at).getTime();
        case "sale_type":
          return r.sale_type;
        case "sales_channel":
          return r.sales_channel;
        case "net_seller_amount":
          return r.net_seller_amount;
        case "total_cost_amount":
          return r.total_cost_amount;
        case "total_margin_amount":
          return r.total_margin_amount;
        case "margin_rate":
          return r.margin_rate ?? -1;
        case "sets_count":
          return r.sets_count;
        case "pieces_qty_total":
          return r.pieces_qty_total;
        default:
          return 0;
      }
    };

    const av = get(a);
    const bv = get(b);

    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sgn;
    return String(av).localeCompare(String(bv), "fr") * sgn;
  });

  // 3) Stats (sur les lignes de commandes)
  const totalSalesCount = rows.length;
  const totalNet = rows.reduce((acc, r) => acc + Number(r.net_seller_amount ?? 0), 0);
  const totalMargin = rows.reduce((acc, r) => acc + Number(r.total_margin_amount ?? 0), 0);
  const avgMarginRate = totalNet > 0 ? totalMargin / totalNet : 0;

  // compte "ventes contenant au moins 1 set" / "ventes contenant au moins 1 ligne piece"
  const totalSetSalesCount = rows.filter((r) => r.sets_count > 0).length;
  const totalPieceSalesCount = rows.filter((r) => r.pieces_lines_count > 0).length;

    // 4) baseQuery (on conserve tab=sales + filtres) — SANS sort/dir
    const baseParams = new URLSearchParams();
    baseParams.set("tab", "sales");
    if (from) baseParams.set("from", from);
    if (to) baseParams.set("to", to);
    if (channel) baseParams.set("channel", channel);
    if (type) baseParams.set("type", type);
  
    const baseQuery = baseParams.toString();

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
              {totalSalesCount.toLocaleString("fr-FR")} commandes confirmées.
            </p>
          )}
        </div>

        <NewSaleDialog />
      </div>

      {/* Tabs */}
            {/* Tabs */}
            <div className="flex gap-2">
        <Button asChild variant="default" size="sm">
          <Link href="/ventes?tab=sales">Ventes</Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/ventes?tab=pieces">Pièces vendues</Link>
        </Button>
      </div>

      {/* Filtres (onglet ventes) */}
      <form className="flex flex-wrap gap-2 items-end" method="get" action="/ventes">
        <input type="hidden" name="tab" value="sales" />
        <input type="hidden" name="sort" value={activeSortKey} />
        <input type="hidden" name="dir" value={dir} />

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Du</label>
          <Input
            type="date"
            name="from"
            defaultValue={from}
            className="h-8"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Au</label>
          <Input
            type="date"
            name="to"
            defaultValue={to}
            className="h-8"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Canal</label>
          <select
            name="channel"
            defaultValue={channel}
            className="h-8 rounded-full border border-slate-200 bg-slate-100 px-3 text-[11px] shadow-[0_6px_18px_rgba(15,23,42,0.06)]"
          >
            <option value="">Tous</option>
            {channels.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Type</label>
          <select
            name="type"
            defaultValue={typeRaw === "SET" || typeRaw === "PIECE" ? typeRaw : ""}
            className="h-8 rounded-full border border-slate-200 bg-slate-100 px-3 text-[11px] shadow-[0_6px_18px_rgba(15,23,42,0.06)]"
          >
            <option value="">Tous</option>
            <option value="SET">SET</option>
            <option value="PIECE">PIECE</option>
          </select>
        </div>

        <Button type="submit" variant="secondary" size="sm">
          Filtrer
        </Button>

        {(from || to || channel || type) && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/ventes?tab=sales">Reset</Link>
          </Button>
        )}
      </form>

      {/* CARDS STATS */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-start">
        <SalesStatCard
          title="CA net (commandes confirmées)"
          mainValue={euro.format(totalNet)}
          color="indigo"
          subtitle={
            totalSalesCount > 0
              ? `${totalSalesCount.toLocaleString("fr-FR")} commandes confirmées`
              : undefined
          }
        />

        <SalesStatCard
          title="Marge totale"
          mainValue={euro.format(totalMargin)}
          color="orange"
        />

        <SalesStatCard
          title="Taux de marge moyen"
          mainValue={totalNet > 0 ? `${(avgMarginRate * 100).toFixed(1)}%` : "—"}
          color="amber"
        />

        <SalesStatCard
          title="Commandes avec set(s)"
          mainValue={totalSetSalesCount.toLocaleString("fr-FR")}
          color="emerald"
          subtitle="Au moins 1 set"
        />

        <SalesStatCard
          title="Commandes avec pièce(s)"
          mainValue={totalPieceSalesCount.toLocaleString("fr-FR")}
          color="emerald"
          subtitle="Au moins 1 ligne pièce"
        />
      </section>

      {/* TABLE "COMMANDES" */}
      <SalesTable
        rows={rows}
        activeSortKey={activeSortKey}
        sortDir={dir === "asc" ? "asc" : "desc"}
        baseQuery={baseQuery}
      />
    </main>
  );
}