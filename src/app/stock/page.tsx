// src/app/stock/page.tsx

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Boxes, Calculator, History, Wallet } from "lucide-react";
import { SalesStatCard } from "@/components/sales/SalesStatCard";
import { Button } from "@/components/ui/button";
import { SortableTableHeader, TableCard, TableOverflow } from "@/components/ui/data-table";

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
      <header className="px-1 md:px-2">
        <div className="min-w-0">
          <h1 className="text-3xl font-medium tracking-tight text-slate-900 md:text-[42px] md:leading-none">
            Stock de pièces
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Vue agrégée par numéro de pièce à partir des lots confirmés.
          </p>
        </div>
      </header>

      {/* CARDS DE TOTAUX STOCK */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SalesStatCard
          title="Pièces en stock"
          mainValue={stockStats.totalPieces.toLocaleString("fr-FR")}
          color="indigo"
          variant="neutral"
          icon={<Boxes className="h-4 w-4" />}
          iconGradientClassName="from-sky-700 to-blue-500"
        />

        <SalesStatCard
          title="Valeur totale stock"
          mainValue={euro.format(stockStats.totalValue)}
          color="azure"
          variant="neutral"
          icon={<Wallet className="h-4 w-4" />}
          iconGradientClassName="from-cyan-600 to-sky-400"
        />

        <SalesStatCard
          title="Coût unitaire moyen"
          mainValue={
            stockStats.totalPieces > 0
              ? euro.format(stockStats.avgCostPerPiece)
              : "—"
          }
          color="sky"
          variant="neutral"
          icon={<Calculator className="h-4 w-4" />}
          iconGradientClassName="from-blue-700 to-indigo-500"
        />
      </section>

      <section className="grid gap-2 px-1 md:grid-cols-2 md:items-center md:px-2 xl:grid-cols-3">
        <form method="GET" className="col-span-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <input
            type="text"
            name="q"
            placeholder="Filtrer par réf. pièce..."
            defaultValue={searchQuery}
            className="app-control app-control--md h-9 w-full min-w-0"
          />

          <input type="hidden" name="sort" value={activeSortKey} />
          <input type="hidden" name="dir" value={dir} />

          <Button type="submit" className="h-9 px-4 text-xs font-medium">
            Rechercher
          </Button>
        </form>

        <div className="col-span-1 flex items-start justify-end md:col-start-2 xl:col-start-3">
          <Button
            asChild
            className="h-9 gap-2 px-4 text-xs font-medium"
          >
            <Link href="/historique-stock">
              <History className="h-4 w-4" />
              Historique
            </Link>
          </Button>
        </div>
      </section>

      {/* TABLEAU STOCK */}
      <TableCard className="appro-table-shell">
        <TableOverflow className="appro-table-scroll">
          <table className="appro-table min-w-full text-sm">
            <thead className="appro-table-header">
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
                    <tr key={row.piece_ref} className="appro-table-row">
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
