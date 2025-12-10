// src/app/stock/page.tsx

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";

export const dynamic = "force-dynamic";

type StockRow = {
  piece_ref: string;
  total_quantity: number;
  avg_unit_cost: string | number | null;
  total_value: string | number | null;
};

type StockSearchParams = {
    sort?: string;
    dir?: string; // "asc" | "desc"
    q?: string;   // recherche par référence de pièce
  };

type StockPageProps = {
  searchParams?: Promise<StockSearchParams>;
};

type SortColumn =
  | "piece_ref"
  | "total_quantity"
  | "avg_unit_cost"
  | "total_value";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type StockStats = {
    totalPieces: number;
    totalValue: number;
    avgCostPerPiece: number;
  };
  
  // Calcule les totaux globaux à partir des lignes de stock_per_piece
  function computeStockStats(rows: StockRow[]): StockStats {
    let totalPieces = 0;
    let totalValue = 0;
  
    for (const row of rows) {
      totalPieces += Number(row.total_quantity ?? 0);
  
      const v = row.total_value;
      if (v !== null && v !== undefined) {
        totalValue += Number(v);
      }
    }
  
    const avgCostPerPiece =
      totalPieces > 0 ? totalValue / totalPieces : 0;
  
    return {
      totalPieces,
      totalValue,
      avgCostPerPiece,
    };
  }

export default async function StockPage({ searchParams }: StockPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const searchQuery = (resolvedSearchParams.q ?? "").toString().trim();

  // --------- Gestion du tri ---------
  const sortParamRaw = (resolvedSearchParams.sort ?? "piece_ref").toString();
  let dir = (resolvedSearchParams.dir ?? "asc").toString().toLowerCase();
  if (dir !== "asc" && dir !== "desc") dir = "asc";

  const ALLOWED_SORT_COLUMNS: SortColumn[] = [
    "piece_ref",
    "total_quantity",
    "avg_unit_cost",
    "total_value",
  ];

  let dbSortColumn: SortColumn = "piece_ref";
  let activeSortKey = sortParamRaw;

  if (
    (ALLOWED_SORT_COLUMNS as readonly string[]).includes(
      sortParamRaw as SortColumn
    )
  ) {
    dbSortColumn = sortParamRaw as SortColumn;
  } else {
    activeSortKey = "piece_ref";
    dbSortColumn = "piece_ref";
  }

    // --------- Requête stock_per_piece ---------
    let query = supabase
    .from("stock_per_piece")
    .select("piece_ref, total_quantity, avg_unit_cost, total_value");

    // Filtre par référence (recherche simple sur piece_ref)
    if (searchQuery) {
        query = query.ilike("piece_ref", `%${searchQuery}%`);
    }

    const { data, error } = await query.order(dbSortColumn, {
        ascending: dir === "asc",
    });

  const rows = (data ?? []) as StockRow[];
  const stockStats = computeStockStats(rows);

    // --------- Helpers tri (URLs) ---------
    const baseParams = new URLSearchParams();
    baseParams.set("sort", activeSortKey);
    baseParams.set("dir", dir);
    if (searchQuery) {
      baseParams.set("q", searchQuery);
    }

  const makeSortHref = (columnKey: string) => {
    const params = new URLSearchParams(baseParams.toString());

    if (activeSortKey === columnKey) {
      const nextDir = dir === "asc" ? "desc" : "asc";
      params.set("sort", columnKey);
      params.set("dir", nextDir);
    } else {
      params.set("sort", columnKey);
      params.set("dir", "asc");
    }

    const qs = params.toString();
    return qs ? `/stock?${qs}` : "/stock";
  };

  const renderSortableHeader = (
    label: string,
    columnKey: string,
    align: "left" | "right" = "left"
  ) => {
    const isActive = activeSortKey === columnKey;
    const isAsc = dir === "asc";

    const alignClass = align === "right" ? "text-right" : "text-left";

    return (
      <th
        key={columnKey}
        className={cn("px-4 py-3 font-medium", alignClass)}
      >
        <Link
          href={makeSortHref(columnKey)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-primary",
            isActive && "text-primary"
          )}
        >
          <span>{label}</span>
          <span className="text-[10px]">
            {isActive ? (isAsc ? "▲" : "▼") : "⇅"}
          </span>
        </Link>
      </th>
    );
  };

  // --------- RENDER ---------
  if (error) {
    return (
      <main className="space-y-6">
        <div className="app-card p-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Stock de pièces
          </h1>
          <p className="text-sm text-red-500 mt-2">
            Erreur lors du chargement du stock : {error.message}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
            {/* HEADER PAGE */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Stock de pièces
          </h1>
          <p className="text-sm text-muted-foreground">
            Vue agrégée par numéro de pièce à partir des lots confirmés.
          </p>
        </div>

        {/* Formulaire de recherche (GET) */}
        <form method="GET" className="flex w-full max-w-xs items-center gap-2">
          <input
            type="text"
            name="q"
            placeholder="Filtrer par réf. pièce..."
            defaultValue={searchQuery}
            className="w-full rounded-full border border-border bg-white px-3 py-2 text-sm shadow-[0_8px_20px_rgba(15,23,42,0.08)] outline-none focus:border-primary"
          />

          {/* On garde le tri actuel quand on applique la recherche */}
          <input type="hidden" name="sort" value={activeSortKey} />
          <input type="hidden" name="dir" value={dir} />

          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-full bg-slate-900 px-4 text-xs font-medium text-white shadow-[0_10px_25px_rgba(15,23,42,0.35)] hover:bg-slate-800 transition-colors"
          >
            Rechercher
          </button>
        </form>
      </div>

        {/* CARDS DE TOTAUX STOCK */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashboardStatCard
          title="Pièces en stock"
          mainValue={stockStats.totalPieces.toLocaleString("fr-FR")}
          trendPercent={null}
          color="indigo"
          windowLabel="vs 30 derniers jours"
        />

        <DashboardStatCard
          title="Valeur totale stock"
          mainValue={euro.format(stockStats.totalValue)}
          trendPercent={null}
          color="orange"
          windowLabel="vs 30 derniers jours"
        />

        <DashboardStatCard
          title="Coût unitaire moyen"
          mainValue={
            stockStats.totalPieces > 0
              ? euro.format(stockStats.avgCostPerPiece)
              : "—"
          }
          trendPercent={null}
          color="amber"
          windowLabel="vs 30 derniers jours"
        />
      </section>

      {/* TABLEAU STOCK */}
      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="app-table-head">
              <tr>
                {renderSortableHeader("Réf. pièce", "piece_ref", "left")}
                {renderSortableHeader("Quantité", "total_quantity", "right")}
                {renderSortableHeader("PUMP (moyen)", "avg_unit_cost", "right")}
                {renderSortableHeader("Valeur totale", "total_value", "right")}
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr className="border-t border-border">
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    Aucune pièce en stock pour le moment.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const qty = Number(row.total_quantity ?? 0);

                  const avg =
                    row.avg_unit_cost === null ||
                    row.avg_unit_cost === undefined
                      ? null
                      : Number(row.avg_unit_cost);

                  const total =
                    row.total_value === null ||
                    row.total_value === undefined
                      ? null
                      : Number(row.total_value);

                  return (
                    <tr key={row.piece_ref} className="app-table-row">
                      <td className="px-4 py-3 font-mono text-xs">
                        {row.piece_ref}
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        {qty}
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        {avg !== null && Number.isFinite(avg)
                          ? euro.format(avg)
                          : "—"}
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        {total !== null && Number.isFinite(total)
                          ? euro.format(total)
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}