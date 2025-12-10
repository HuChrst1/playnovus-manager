// src/app/historique-stock/page.tsx

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";

export const dynamic = "force-dynamic";

type JournalRow = {
  id: number;
  piece_ref: string;
  created_at: string;
  direction: "IN" | "OUT" | "ADJUST";
  quantity: number;
  unit_cost: string | number | null;
  total_value: string | number | null;
  source_type: string;
  source_id: string | null;
  lot_id: number | null;
  lot_code: string | null;
  lot_purchase_date: string | null;
  lot_label: string | null;
  lot_status: string | null;
  comment: string | null;
};

type HistorySearchParams = {
  from?: string;        // YYYY-MM-DD
  to?: string;          // YYYY-MM-DD
  piece?: string;       // filtre par ref
  direction?: string;   // IN / OUT / ADJUST / ALL
  source_type?: string; // PURCHASE / SALE / ADJUSTMENT / ALL
};

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function StockHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<HistorySearchParams>;
}) {
  const resolved = searchParams ? await searchParams : {};

  const from = (resolved.from ?? "").toString();
  const to = (resolved.to ?? "").toString();
  const piece = (resolved.piece ?? "").toString().trim();
  const direction = (resolved.direction ?? "ALL").toString();
  const sourceType = (resolved.source_type ?? "ALL").toString();

  // ----- Requête sur la vue stock_journal -----
  let query = supabase
    .from("stock_journal")
    .select(
      [
        "id",
        "piece_ref",
        "created_at",
        "direction",
        "quantity",
        "unit_cost",
        "total_value",
        "source_type",
        "source_id",
        "lot_id",
        "lot_code",
        "lot_purchase_date",
        "lot_label",
        "lot_status",
        "comment",
      ].join(", ")
    )
    .order("created_at", { ascending: false });

  if (from) {
    // on prend à partir de 00:00
    query = query.gte("created_at", from + "T00:00:00Z");
  }
  if (to) {
    // on va jusqu'à 23:59:59
    query = query.lte("created_at", to + "T23:59:59Z");
  }
  if (piece) {
    query = query.ilike("piece_ref", `%${piece}%`);
  }
  if (direction !== "ALL") {
    query = query.eq("direction", direction);
  }
  if (sourceType !== "ALL") {
    query = query.eq("source_type", sourceType);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erreur chargement stock_journal:", error);
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Historique de stock
        </h1>
        <p className="text-sm text-red-500 mt-2">
          Erreur lors du chargement de l&apos;historique : {error.message}
        </p>

        <div className="mt-4">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/stock">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour au stock
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  const rows: JournalRow[] = (data ?? []) as unknown as JournalRow[];

  // Petites stats globales
  let totalIn = 0;
  let totalOut = 0;
  let totalAdjust = 0;

  for (const m of rows) {
    const qty = m.quantity ?? 0;
    if (m.direction === "IN") totalIn += qty;
    else if (m.direction === "OUT") totalOut += qty;
    else if (m.direction === "ADJUST") totalAdjust += qty;
  }

  const renderDirectionBadge = (dir: JournalRow["direction"]) => {
    if (dir === "IN") {
      return (
        <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
          Entrée
        </span>
      );
    }
    if (dir === "OUT") {
      return (
        <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-[11px] font-medium text-red-700">
          Sortie
        </span>
      );
    }
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700">
        Ajustement
      </span>
    );
  };

  const renderSource = (m: JournalRow) => {
    if (m.source_type === "PURCHASE" && m.lot_id) {
      const label = m.lot_code || `LOT_${m.lot_id}`;
      return (
        <Link
          href={`/approvisionnement/${m.lot_id}`}
          className="underline-offset-2 hover:underline text-slate-900"
        >
          Lot {label}
        </Link>
      );
    }

    if (m.source_type === "SALE" && m.source_id) {
      return (
        <span className="text-xs font-medium text-slate-700">
          Vente #{m.source_id}
        </span>
      );
    }

    if (m.source_type === "ADJUSTMENT") {
      return (
        <span className="text-xs text-slate-500">
          Ajustement manuel
        </span>
      );
    }

    return <span className="text-xs text-slate-400">—</span>;
  };

  return (
    <main className="space-y-6 min-w-[1024px]">
      {/* HEADER PAGE */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Historique de stock
          </h1>
          <p className="text-sm text-muted-foreground">
            Journal global des mouvements de stock (entrées, sorties,
            ajustements).
          </p>
        </div>

        {/* Bouton retour vers vue agrégée */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="rounded-full px-4"
          >
            <Link href="/stock">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Vue stock par pièce
            </Link>
          </Button>
        </div>
      </div>

      {/* FILTRES */}
      <Card className="app-card p-4 md:p-5 rounded-3xl">
        <form
          method="GET"
          className="grid gap-3 md:grids-cols-5 items-end"
        >
          {/* Date de / à */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">
              Du
            </label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-full border border-border bg-white px-3 py-2 text-xs shadow-[0_6px_14px_rgba(15,23,42,0.08)] outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">
              Au
            </label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-full border border-border bg-white px-3 py-2 text-xs shadow-[0_6px_14px_rgba(15,23,42,0.08)] outline-none focus:border-primary"
            />
          </div>

          {/* Ref pièce */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">
              Réf. pièce
            </label>
            <input
              type="text"
              name="piece"
              placeholder="ex : 30000000"
              defaultValue={piece}
              className="w-full rounded-full border border-border bg-white px-3 py-2 text-xs shadow-[0_6px_14px_rgba(15,23,42,0.08)] outline-none focus:border-primary"
            />
          </div>

          {/* Sens */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">
              Sens
            </label>
            <select
              name="direction"
              defaultValue={direction}
              className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs shadow-sm"
            >
              <option value="ALL">Tous</option>
              <option value="IN">Entrées</option>
              <option value="OUT">Sorties</option>
              <option value="ADJUST">Ajustements</option>
            </select>
          </div>

          {/* Type de source */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">
              Type
            </label>
            <select
              name="source_type"
              defaultValue={sourceType}
              className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs shadow-sm"
            >
              <option value="ALL">Tous</option>
              <option value="PURCHASE">Achats (lots)</option>
              <option value="SALE">Ventes</option>
              <option value="ADJUSTMENT">Ajustements</option>
            </select>
          </div>

          {/* Bouton submit : sur mobile, il passera à la ligne */}
          <div className="md:col-span-5 flex justify-end mt-2">
            <Button
              type="submit"
              className="h-9 rounded-full px-5 bg-slate-900 text-white text-xs font-medium shadow-[0_10px_25px_rgba(15,23,42,0.35)] hover:bg-slate-900/90"
            >
              Filtrer
            </Button>
          </div>
        </form>
      </Card>

      {/* Stats rapides */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashboardStatCard
          title="Nombre de mouvements"
          mainValue={rows.length.toLocaleString("fr-FR")}
          trendPercent={null}
          color="indigo"
        />

        <DashboardStatCard
          title="Total entrées"
          mainValue={totalIn.toLocaleString("fr-FR")}
          trendPercent={null}
          color="orange"
        />

        <DashboardStatCard
          title="Total sorties"
          mainValue={totalOut.toLocaleString("fr-FR")}
          trendPercent={null}
          color="amber"
        />
      </section>

      {/* TABLEAU JOURNAL */}
      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Réf. pièce
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Sens
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Quantité
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Coût unitaire
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Valeur
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Source
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Commentaire
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr className="border-t border-border">
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    Aucun mouvement ne correspond à ces filtres.
                  </td>
                </tr>
              ) : (
                rows.map((m) => {
                  const qty = m.quantity ?? 0;
                  const sign =
                    m.direction === "OUT"
                      ? "-"
                      : m.direction === "IN"
                      ? "+"
                      : "";
                  const unit =
                    m.unit_cost === null || m.unit_cost === undefined
                      ? null
                      : Number(m.unit_cost);
                  const value =
                    m.total_value === null || m.total_value === undefined
                      ? null
                      : Number(m.total_value);

                  return (
                    <tr
                      key={m.id}
                      className={`app-table-row transition-colors ${
                        m.direction === "IN"
                          ? "bg-emerald-100 hover:bg-emerald-200"
                          : m.direction === "OUT"
                          ? "bg-red-50 hover:bg-red-100"
                          : "hover:bg-sky-50/70"
                      }`}
                    >
                      <td className="px-4 py-3">
                        {formatDateTime(m.created_at)}
                      </td>

                      <td className="px-4 py-3 font-mono text-xs">
                        <Link
                          href={`/stock/${encodeURIComponent(m.piece_ref)}`}
                          className="underline-offset-2 hover:underline text-slate-900"
                        >
                          {m.piece_ref}
                        </Link>
                      </td>

                      <td className="px-4 py-3">
                        {renderDirectionBadge(m.direction)}
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        {sign}
                        {qty}
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        {unit !== null && Number.isFinite(unit)
                          ? euro.format(unit)
                          : "—"}
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        {value !== null && Number.isFinite(value)
                          ? euro.format(value)
                          : "—"}
                      </td>

                      <td className="px-4 py-3">
                        {renderSource(m)}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                        {m.comment || "—"}
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