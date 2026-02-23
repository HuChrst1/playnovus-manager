// src/app/historique-stock/page.tsx

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, ChartColumnIncreasing, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalesStatCard } from "@/components/sales/SalesStatCard";
import { TableCard, TableOverflow } from "@/components/ui/data-table";

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
  const activeFilterCount =
    Number(Boolean(from)) +
    Number(Boolean(to)) +
    Number(Boolean(piece)) +
    Number(direction !== "ALL") +
    Number(sourceType !== "ALL");

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
      </main>
    );
  }

  const rows: JournalRow[] = (data ?? []) as unknown as JournalRow[];

  // Petites stats globales
  let totalIn = 0;
  let totalOut = 0;

  for (const m of rows) {
    const qty = m.quantity ?? 0;
    if (m.direction === "IN") totalIn += qty;
    else if (m.direction === "OUT") totalOut += qty;
  }

  const renderDirectionBadge = (dir: JournalRow["direction"]) => {
    if (dir === "IN") {
      return (
        <span className="app-status-pill app-status-pill--good">
          Entrée
        </span>
      );
    }
    if (dir === "OUT") {
      return (
        <span className="app-status-pill app-status-pill--bad">
          Sortie
        </span>
      );
    }
    return (
      <span className="app-status-pill bg-slate-100 text-slate-700">
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
    <main className="space-y-6">
      <header className="px-1 md:px-2">
        <div className="min-w-0">
          <h1 className="text-3xl font-medium tracking-tight text-slate-900 md:text-[42px] md:leading-none">
            Historique de stock
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Journal global des mouvements de stock (entrées, sorties, ajustements).
          </p>
        </div>
      </header>

      {/* Stats rapides */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SalesStatCard
          title="Nombre de mouvements"
          mainValue={rows.length.toLocaleString("fr-FR")}
          color="indigo"
          variant="neutral"
          icon={<ChartColumnIncreasing className="h-4 w-4" />}
          iconGradientClassName="from-sky-700 to-blue-500"
        />

        <SalesStatCard
          title="Total entrées"
          mainValue={totalIn.toLocaleString("fr-FR")}
          color="azure"
          variant="neutral"
          icon={<ArrowDown className="h-4 w-4" />}
          iconGradientClassName="from-cyan-600 to-sky-400"
        />

        <SalesStatCard
          title="Total sorties"
          mainValue={totalOut.toLocaleString("fr-FR")}
          color="sky"
          variant="neutral"
          icon={<ArrowUp className="h-4 w-4" />}
          iconGradientClassName="from-blue-700 to-indigo-500"
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
                htmlFor="history-from"
                className="app-filter-toolbar-field app-filter-toolbar-field--compact"
              >
                <span>Du</span>
                <input
                  id="history-from"
                  type="date"
                  name="from"
                  defaultValue={from}
                  className="app-control h-8 w-[104px] px-2.5 text-[11px]"
                />
              </label>

              <label
                htmlFor="history-to"
                className="app-filter-toolbar-field app-filter-toolbar-field--compact"
              >
                <span>Au</span>
                <input
                  id="history-to"
                  type="date"
                  name="to"
                  defaultValue={to}
                  className="app-control h-8 w-[104px] px-2.5 text-[11px]"
                />
              </label>

              <label
                htmlFor="history-piece"
                className="app-filter-toolbar-field app-filter-toolbar-field--compact"
              >
                <span>Réf.</span>
                <input
                  id="history-piece"
                  type="text"
                  name="piece"
                  placeholder="ex : 30000000"
                  defaultValue={piece}
                  className="app-control h-8 w-[118px] px-2.5 text-[11px]"
                />
              </label>

              <label
                htmlFor="history-direction"
                className="app-filter-toolbar-field app-filter-toolbar-field--compact"
              >
                <span>Sens</span>
                <select
                  id="history-direction"
                  name="direction"
                  defaultValue={direction}
                  className="app-control h-8 w-[94px] px-2.5 text-[11px]"
                >
                  <option value="ALL">Tous</option>
                  <option value="IN">Entrées</option>
                  <option value="OUT">Sorties</option>
                  <option value="ADJUST">Ajustements</option>
                </select>
              </label>

              <label
                htmlFor="history-source"
                className="app-filter-toolbar-field app-filter-toolbar-field--compact"
              >
                <span>Type</span>
                <select
                  id="history-source"
                  name="source_type"
                  defaultValue={sourceType}
                  className="app-control h-8 w-[132px] px-2.5 text-[11px]"
                >
                  <option value="ALL">Tous</option>
                  <option value="PURCHASE">Achats (lots)</option>
                  <option value="SALE">Ventes</option>
                  <option value="ADJUSTMENT">Ajustements</option>
                </select>
              </label>

              <div className="app-filter-toolbar-actions">
                <Button variant="outline" size="sm" asChild className="shrink-0 text-[11px]">
                  <Link href="/historique-stock">Réinitialiser</Link>
                </Button>
                <Button type="submit" size="sm" className="shrink-0 text-[11px] font-semibold">
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

        <Button
          variant="outline"
          size="sm"
          asChild
          className="h-9 gap-2 px-4 text-xs font-medium"
        >
          <Link href="/stock">
            <ArrowLeft className="h-4 w-4" />
            Vue stock par pièce
          </Link>
        </Button>
      </div>

      {/* TABLEAU JOURNAL */}
      <TableCard className="appro-table-shell">
        <TableOverflow className="appro-table-scroll">
          <table className="appro-table min-w-full text-sm">
            <thead className="appro-table-header">
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
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-sm text-slate-500"
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
                      className={`appro-table-row transition-colors ${
                        m.direction === "IN"
                          ? "history-table-row--in"
                          : m.direction === "OUT"
                          ? "history-table-row--out"
                          : "history-table-row--adjust"
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
        </TableOverflow>
      </TableCard>
    </main>
  );
}
