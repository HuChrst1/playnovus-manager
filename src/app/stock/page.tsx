// src/app/stock/page.tsx

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { History } from "lucide-react";
import { SalesStatCard } from "@/components/sales/SalesStatCard";
import { PageHeader } from "@/components/ui/page-header";
import { SortableTableHeader, TableCard, TableOverflow } from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";

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
      <PageHeader
        title="Stock de pièces"
        description="Vue agrégée par numéro de pièce à partir des lots confirmés."
      />

      <FilterBar className="p-3">
        <div className="flex w-full flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-end">
          <form method="GET" className="flex flex-1 items-center gap-2">
            <input
              type="text"
              name="q"
              placeholder="Filtrer par réf. pièce..."
              defaultValue={searchQuery}
              className="w-full rounded-full border border-border bg-white px-3 py-2 text-sm shadow-[0_8px_20px_rgba(15,23,42,0.08)] outline-none focus:border-primary"
            />

            <input type="hidden" name="sort" value={activeSortKey} />
            <input type="hidden" name="dir" value={dir} />

            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-full bg-slate-900 px-4 text-xs font-medium text-white shadow-[0_10px_25px_rgba(15,23,42,0.35)] transition-colors hover:bg-slate-800"
            >
              Rechercher
            </button>
          </form>

          <Link
            href="/historique-stock"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_10px_25px_rgba(15,23,42,0.35)] transition-colors hover:bg-slate-800"
            aria-label="Voir l'historique des mouvements de stock"
          >
            <History className="h-4 w-4" />
          </Link>
        </div>
      </FilterBar>

      {/* CARDS DE TOTAUX STOCK */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SalesStatCard
          title="Pièces en stock"
          mainValue={stockStats.totalPieces.toLocaleString("fr-FR")}
          color="indigo"
        />

        <SalesStatCard
          title="Valeur totale stock"
          mainValue={euro.format(stockStats.totalValue)}
          color="orange"
        />

        <SalesStatCard
          title="Coût unitaire moyen"
          mainValue={
            stockStats.totalPieces > 0
              ? euro.format(stockStats.avgCostPerPiece)
              : "—"
          }
          color="amber"
        />
      </section>

      {/* TABLEAU STOCK */}
      <TableCard>
        <TableOverflow>
          <table className="min-w-full text-sm">
            <thead className="app-table-head">
              <tr>
                <SortableTableHeader
                  label="Réf. pièce"
                  columnKey="piece_ref"
                  activeSortKey={activeSortKey}
                  sortDir={dir as "asc" | "desc"}
                  href={makeSortHref("piece_ref")}
                />
                <SortableTableHeader
                  label="Quantité"
                  columnKey="total_quantity"
                  activeSortKey={activeSortKey}
                  sortDir={dir as "asc" | "desc"}
                  href={makeSortHref("total_quantity")}
                  align="right"
                />
                <SortableTableHeader
                  label="PUMP (moyen)"
                  columnKey="avg_unit_cost"
                  activeSortKey={activeSortKey}
                  sortDir={dir as "asc" | "desc"}
                  href={makeSortHref("avg_unit_cost")}
                  align="right"
                />
                <SortableTableHeader
                  label="Valeur totale"
                  columnKey="total_value"
                  activeSortKey={activeSortKey}
                  sortDir={dir as "asc" | "desc"}
                  href={makeSortHref("total_value")}
                  align="right"
                />
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
                        <Link
                            href={`/stock/${encodeURIComponent(row.piece_ref)}`}
                            className="underline-offset-2 hover:underline text-slate-900"
                        >
                            {row.piece_ref}
                        </Link>
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
        </TableOverflow>
      </TableCard>
    </main>
  );
}
