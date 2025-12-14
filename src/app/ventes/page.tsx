import { supabaseServer as supabase } from "@/lib/supabase-server";
import type { SaleRow } from "@/lib/sales-types";
import { SalesTable } from "@/components/sales/SalesTable";
import { SalesStatCard } from "@/components/sales/SalesStatCard";
import { NewSaleDialog } from "@/components/sales/NewSaleDialog";

export const dynamic = "force-dynamic";

// Colonnes triables pour la liste des ventes
type SortColumn =
  | "id"
  | "paid_at"
  | "sale_type"
  | "sales_channel"
  | "net_seller_amount"
  | "total_margin_amount"
  | "status";

type SalesSearchParams = {
  sort?: string;
  dir?: string; // "asc" | "desc"
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

export default async function VentesPage({
  searchParams,
}: SalesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const sortParamRaw = (resolvedSearchParams.sort ?? "paid_at").toString();
  let dir = (resolvedSearchParams.dir ?? "desc").toString().toLowerCase();
  if (dir !== "asc" && dir !== "desc") dir = "desc";

  const ALLOWED_SORT_COLUMNS: SortColumn[] = [
    "id",
    "paid_at",
    "sale_type",
    "sales_channel",
    "net_seller_amount",
    "total_margin_amount",
    "status",
  ];

  let dbSortColumn: SortColumn = "paid_at";
  let activeSortKey = sortParamRaw;

  if ((ALLOWED_SORT_COLUMNS as readonly string[]).includes(sortParamRaw)) {
    dbSortColumn = sortParamRaw as SortColumn;
  } else {
    activeSortKey = "paid_at";
    dbSortColumn = "paid_at";
  }

  // 1) Charger les ventes existantes
  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, paid_at, sale_type, sales_channel, net_seller_amount, total_cost_amount, total_margin_amount, margin_rate, status"
    )
    .order(dbSortColumn, { ascending: dir === "asc" });

  if (error) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ventes</h1>
          <p className="text-sm text-muted-foreground">
            Erreur lors du chargement des ventes : {error.message}
          </p>
        </div>
      </main>
    );
  }

  const sales = (data ?? []) as SaleRow[];

  // 2) Calcul de quelques stats simples
  const confirmedSales = sales.filter(
    (sale) => sale.status === "CONFIRMED"
  );

  const totalSalesCount = confirmedSales.length;
  const totalNet = confirmedSales.reduce(
    (acc, sale) => acc + Number(sale.net_seller_amount ?? 0),
    0
  );
  const totalMargin = confirmedSales.reduce(
    (acc, sale) => acc + Number(sale.total_margin_amount ?? 0),
    0
  );
  const avgMarginRate =
    confirmedSales.length > 0 ? totalMargin / (totalNet || 1) : 0;

  const totalPieceSalesCount = confirmedSales.filter(
    (sale) => sale.sale_type === "PIECE"
  ).length;
  const totalSetSalesCount = confirmedSales.filter(
    (sale) => sale.sale_type === "SET"
  ).length;

  const baseParams = new URLSearchParams();
  baseParams.set("sort", activeSortKey);
  baseParams.set("dir", dir);

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
    return qs ? `/ventes?${qs}` : "/ventes";
  };

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
              {totalSalesCount.toLocaleString("fr-FR")} ventes confirmées.
            </p>
          )}
        </div>

        {/* Bouton "Nouvelle vente" en modale */}
        <NewSaleDialog />
      </div>

      {/* CARDS STATS VENTES – même style qu'Approvisionnements */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-start">
        <SalesStatCard
          title="CA net (ventes confirmées)"
          mainValue={euro.format(totalNet)}
          color="indigo"
          subtitle={
            totalSalesCount > 0
              ? `${totalSalesCount.toLocaleString("fr-FR")} ventes confirmées`
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
          mainValue={
            totalNet > 0 ? `${(avgMarginRate * 100).toFixed(1)}%` : "—"
          }
          color="amber"
        />

        <SalesStatCard
          title="Ventes de sets"
          mainValue={totalSetSalesCount.toLocaleString("fr-FR")}
          color="emerald"
          subtitle="Ventes de sets confirmées"
        />

        <SalesStatCard
          title="Ventes de pièces au détail"
          mainValue={totalPieceSalesCount.toLocaleString("fr-FR")}
          color="emerald"
          subtitle="Ventes de pièces confirmées"
        />
      </section>

      {/* TABLE DES VENTES */}
      <SalesTable
        sales={sales}
        activeSortKey={activeSortKey}
        sortDir={dir === "asc" ? "asc" : "desc"}
        makeSortHref={makeSortHref}
      />
    </main>
  );
}