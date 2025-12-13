import { supabase } from "@/lib/supabase";
import { NewLotDialog } from "./NewLotDialog";
import { DeleteLotButton } from "./DeleteLotButton";
import { EditLotDialog, LotForEdit } from "./EditLotDialog";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ApproStatCardWithDialog } from "@/components/dashboard/StatCardWithDialog";

export const dynamic = "force-dynamic";

type LotRow = {
  id: number;
  lot_code: string | null;
  label: string | null;
  purchase_date: string; // renvoyé en string ISO par Supabase
  supplier: string | null;
  total_pieces: number | null;
  total_cost: number; // numeric => string côté JS
  status: string;
  notes: string | null;
};

type SortColumn =
  | "id"
  | "purchase_date"
  | "label"
  | "supplier"
  | "total_pieces"
  | "total_cost"
  | "status";

  type ApproSearchParams = {
    sort?: string;
    dir?: string; // "asc" | "desc"
    stats_window_lots?: string;
    stats_window_pieces?: string;
    stats_window_cost?: string;
    stats_window_avgcpp?: string;
  };

type ApprovisionnementPageProps = {
  searchParams?: Promise<ApproSearchParams>;
};

export default async function ApprovisionnementPage({
  searchParams,
}: ApprovisionnementPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

    // Fenêtre de temps utilisée pour CHAQUE card (en jours)
    const windowLotsDays = parseWindowParam(
      resolvedSearchParams.stats_window_lots,
      30
    );
    const windowPiecesDays = parseWindowParam(
      resolvedSearchParams.stats_window_pieces,
      30
    );
    const windowCostDays = parseWindowParam(
      resolvedSearchParams.stats_window_cost,
      30
    );
    const windowAvgCppDays = parseWindowParam(
      resolvedSearchParams.stats_window_avgcpp,
      30
    );

  const sortParamRaw = (resolvedSearchParams.sort ?? "purchase_date").toString();
  let dir = (resolvedSearchParams.dir ?? "desc").toString().toLowerCase();
  if (dir !== "asc" && dir !== "desc") dir = "desc";

  const ALLOWED_SORT_COLUMNS: SortColumn[] = [
    "id",
    "purchase_date",
    "label",
    "supplier",
    "total_pieces",
    "total_cost",
    "status",
  ];

  let dbSortColumn: SortColumn = "purchase_date";
  let activeSortKey = sortParamRaw;

  if (
    (ALLOWED_SORT_COLUMNS as readonly string[]).includes(
      sortParamRaw as SortColumn
    )
  ) {
    dbSortColumn = sortParamRaw as SortColumn;
  } else {
    activeSortKey = "purchase_date";
    dbSortColumn = "purchase_date";
  }

  // 1) On charge les lots existants
  const { data, error } = await supabase
    .from("lots")
    .select(
      "id, lot_code, label, purchase_date, supplier, total_pieces, total_cost, status, notes"
    )
    .order(dbSortColumn, { ascending: dir === "asc" });

  if (error) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Approvisionnements
          </h1>
          <p className="text-sm text-muted-foreground">
            Erreur lors du chargement des lots : {error.message}
          </p>
        </div>
      </main>
    );
  }

  let lots = (data ?? []) as LotRow[];

  // 2) Vérifier si un Lot 0 existe déjà (stock initial)
  const hasLot0 = lots.some((lot) => lot.lot_code === "LOT_0");

  // 3) Si aucun Lot 0, on en crée un automatiquement
  if (!hasLot0) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const { data: created, error: createError } = await supabase
      .from("lots")
      .insert({
        lot_code: "LOT_0",
        label: "Stock initial",
        supplier: null,
        purchase_date: today,
        total_cost: 0,
        total_pieces: 0,
        status: "draft",
        notes: "Lot 0 – Stock initial (créé automatiquement)",
      })
      .select(
        "id, lot_code, label, purchase_date, supplier, total_pieces, total_cost, status, notes"
      )
      .single();

    if (!createError && created) {
      // On le met en tête de liste
      lots = [created as LotRow, ...lots];
    }
  }

    
      // On calcule les tendances pour chaque card avec sa propre fenêtre
  const statsLots = computeApproStats(lots, { windowDays: windowLotsDays });
  const statsPieces = computeApproStats(lots, { windowDays: windowPiecesDays });
  const statsCost = computeApproStats(lots, { windowDays: windowCostDays });
  const statsAvgCpp = computeApproStats(lots, { windowDays: windowAvgCppDays });

  // Les totaux globaux ne dépendent pas de la fenêtre,
  // on peut les lire depuis n'importe quelle structure.
  const baseTotals = statsLots;

  const baseParams = new URLSearchParams();
  baseParams.set("sort", activeSortKey);
  baseParams.set("dir", dir);
  baseParams.set("stats_window_lots", String(windowLotsDays));
  baseParams.set("stats_window_pieces", String(windowPiecesDays));
  baseParams.set("stats_window_cost", String(windowCostDays));
  baseParams.set("stats_window_avgcpp", String(windowAvgCppDays));

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
    return qs ? `/approvisionnement?${qs}` : "/approvisionnement";
  };

  const renderSortableHeader = (
    label: string,
    columnKey: string,
    align: "left" | "right" | "center" = "left"
  ) => {
    const isActive = activeSortKey === columnKey;
    const isAsc = dir === "asc";

    const alignClass =
      align === "right"
        ? "text-right"
        : align === "center"
        ? "text-center"
        : "text-left";

    return (
      <th key={columnKey} className={cn("px-4 py-3 font-medium", alignClass)}>
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

  return (
    <main className="space-y-6">
      {/* HEADER PAGE */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Approvisionnements
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestion des lots d&apos;achat et du stock initial.
          </p>
        </div>

        <NewLotDialog />
      </div>

            {/* CARDS STATS APPRO (1 card = 1 fenêtre d'analyse) */}
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-start">
        <ApproStatCardWithDialog
          id="lots"
          title="Lots confirmés"
          mainValue={baseTotals.totalLotsConfirmed.toLocaleString("fr-FR")}
          trendPercent={statsLots.lotsTrendPercent}
          color="indigo"
          windowDays={windowLotsDays}
        />

        <ApproStatCardWithDialog
          id="pieces"
          title="Nb pièces totales"
          mainValue={baseTotals.totalPiecesConfirmed.toLocaleString("fr-FR")}
          trendPercent={statsPieces.piecesTrendPercent}
          color="orange"
          windowDays={windowPiecesDays}
        />

        <ApproStatCardWithDialog
          id="cost"
          title="Coût total"
          mainValue={euro.format(baseTotals.totalCostConfirmed)}
          trendPercent={statsCost.costTrendPercent}
          color="amber"
          windowDays={windowCostDays}
        />

        <ApproStatCardWithDialog
          id="avgcpp"
          title="Coût / pièce moyen"
          mainValue={
            baseTotals.totalPiecesConfirmed > 0
              ? euro.format(baseTotals.avgCostPerPiece)
              : "—"
          }
          trendPercent={statsAvgCpp.avgCppTrendPercent}
          color="emerald"
          windowDays={windowAvgCppDays}
        />
      </section>

      {/* TABLE DES LOTS */}
      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="app-table-head">
              <tr>
                {renderSortableHeader("LotID", "id", "left")}
                {renderSortableHeader("Date", "purchase_date", "left")}
                {renderSortableHeader("Libellé", "label", "left")}
                {renderSortableHeader("Fournisseur", "supplier", "left")}
                {renderSortableHeader("Nb pièces", "total_pieces", "right")}
                {renderSortableHeader("Coût total", "total_cost", "right")}
                <th className="px-4 py-3 text-right font-medium">
                  Coût / pièce
                </th>
                {renderSortableHeader("Statut", "status", "center")}
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {lots.length === 0 ? (
                <tr className="border-t border-border">
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    Aucun lot d&apos;approvisionnement pour le moment.
                  </td>
                </tr>
              ) : (
                lots.map((lot) => {
                  const totalCostNumber = Number(lot.total_cost ?? 0);
                  const totalPieces = lot.total_pieces ?? 0;
                  const costPerPiece =
                    totalPieces > 0 ? totalCostNumber / totalPieces : 0;

                  const isInitialLot = lot.lot_code === "LOT_0";
                  const displayCode =
                    lot.lot_code || (isInitialLot ? "LOT_0" : `LOT_${lot.id}`);

                  const lotForEdit: LotForEdit = {
                    id: lot.id,
                    lot_code: lot.lot_code,
                    label: lot.label,
                    purchase_date: lot.purchase_date,
                    supplier: lot.supplier,
                    total_pieces: lot.total_pieces,
                    total_cost: lot.total_cost,
                    status: lot.status,
                    notes: lot.notes,
                  };

                  return (
                    <tr key={lot.id} className="app-table-row">
                      {/* LotID = lien vers la page de détail */}
                      <td className="px-4 py-3 font-mono text-xs">
                        <Link
                          href={`/approvisionnement/${lot.id}`}
                          className="underline-offset-2 hover:underline text-slate-900"
                        >
                          {displayCode}
                        </Link>
                      </td>

                      <td className="px-4 py-3">
                        {formatDate(lot.purchase_date)}
                      </td>

                      {/* Libellé : on met en avant le Lot 0 */}
                      <td className="px-4 py-3 max-w-xs truncate">
                        {lot.label || (isInitialLot ? "Stock initial" : "—")}
                        {isInitialLot && (
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            (Lot 0 – stock initial)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 max-w-xs truncate">
                        {lot.supplier || "—"}
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        {totalPieces}
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        {euro.format(totalCostNumber)}
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        {totalPieces > 0
                          ? euro.format(costPerPiece)
                          : "—"}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={
                            lot.status === "confirmed"
                              ? "inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700"
                              : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600"
                          }
                        >
                          {lot.status === "confirmed"
                            ? "Confirmé"
                            : "Brouillon"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <EditLotDialog lot={lotForEdit} />
                          <DeleteLotButton
                            lotId={lot.id}
                            lotLabel={displayCode}
                            isInitial={isInitialLot}
                            isConfirmed={lot.status === "confirmed"}
                          />
                        </div>
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

type ApproStats = {
  // Totaux “toute période” (uniquement lots confirmés)
  totalLotsConfirmed: number;
  totalPiecesConfirmed: number;
  totalCostConfirmed: number;
  avgCostPerPiece: number;

  // Fenêtre 30 derniers jours vs 30 jours précédents
  lotsLast30Days: number;
  lotsPrev30Days: number;
  lotsTrendPercent: number | null;

  piecesLast30Days: number;
  piecesPrev30Days: number;
  piecesTrendPercent: number | null;

  costLast30Days: number;
  costPrev30Days: number;
  costTrendPercent: number | null;

  avgCppLast30Days: number;
  avgCppPrev30Days: number;
  avgCppTrendPercent: number | null;
};

type ApproStatsDateConfig = {
  /**
   * Taille de la fenêtre mobile en jours pour calculer :
   * - "N derniers jours"
   * - et la période précédente de même taille.
   * Par défaut : 30.
   */
  windowDays?: number;
};

function parseWindowParam(value: string | undefined, fallback: number): number {
  const n = Number((value ?? "").toString());
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function computeApproStats(
  lots: LotRow[],
  config?: ApproStatsDateConfig
): ApproStats {
  // On travaille uniquement sur les lots confirmés
  const confirmedLots = lots.filter((lot) => lot.status === "confirmed");

  const today = new Date();
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  // Fenêtre configurable (par défaut 30 jours)
  const windowDays = config?.windowDays ?? 30;

  const windowAgo = new Date(todayMidnight.getTime() - windowDays * MS_PER_DAY);
  const prevWindowAgo = new Date(
    todayMidnight.getTime() - 2 * windowDays * MS_PER_DAY
  );

  let totalLotsConfirmed = 0;
  let totalPiecesConfirmed = 0;
  let totalCostConfirmed = 0;

  let lotsLast30Days = 0;
  let lotsPrev30Days = 0;

  let piecesLast30Days = 0;
  let piecesPrev30Days = 0;

  let costLast30Days = 0;
  let costPrev30Days = 0;

  for (const lot of confirmedLots) {
    const pieces = lot.total_pieces ?? 0;
    const cost = Number(lot.total_cost ?? 0);

    totalLotsConfirmed += 1;
    totalPiecesConfirmed += pieces;
    totalCostConfirmed += cost;

    const d = new Date(lot.purchase_date);
    if (Number.isNaN(d.getTime())) continue;

    if (d >= windowAgo && d < todayMidnight) {
      // Fenêtre : N derniers jours
      lotsLast30Days += 1;
      piecesLast30Days += pieces;
      costLast30Days += cost;
    } else if (d >= prevWindowAgo && d < windowAgo) {
      // Fenêtre : les N jours juste avant
      lotsPrev30Days += 1;
      piecesPrev30Days += pieces;
      costPrev30Days += cost;
    }
  }

  const avgCostPerPiece =
    totalPiecesConfirmed > 0 ? totalCostConfirmed / totalPiecesConfirmed : 0;

  const avgCppLast30Days =
    piecesLast30Days > 0 ? costLast30Days / piecesLast30Days : 0;
  const avgCppPrev30Days =
    piecesPrev30Days > 0 ? costPrev30Days / piecesPrev30Days : 0;

  const calcTrend = (current: number, previous: number): number | null => {
    if (current === 0 && previous === 0) return null;
    const base = previous === 0 ? 1 : previous;
    return ((current - previous) / base) * 100;
  };

  return {
    totalLotsConfirmed,
    totalPiecesConfirmed,
    totalCostConfirmed,
    avgCostPerPiece,

    lotsLast30Days,
    lotsPrev30Days,
    lotsTrendPercent: calcTrend(lotsLast30Days, lotsPrev30Days),

    piecesLast30Days,
    piecesPrev30Days,
    piecesTrendPercent: calcTrend(piecesLast30Days, piecesPrev30Days),

    costLast30Days,
    costPrev30Days,
    costTrendPercent: calcTrend(costLast30Days, costPrev30Days),

    avgCppLast30Days,
    avgCppPrev30Days,
    avgCppTrendPercent: calcTrend(avgCppLast30Days, avgCppPrev30Days),
  };
}

function formatDate(value: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});