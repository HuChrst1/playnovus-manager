import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { NewLotDialog } from "./NewLotDialog";
import { DeleteLotButton } from "./DeleteLotButton";
import { EditLotDialog, LotForEdit } from "./EditLotDialog";
import { ClickableRow } from "./ClickableRow";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SalesStatCard } from "@/components/sales/SalesStatCard";

export const dynamic = "force-dynamic";

type LotRow = {
  id: number;
  lot_code: string | null;
  label: string | null;
  purchase_date: string;
  supplier: string | null;
  total_pieces: number | null;
  total_cost: number;
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

type RawApproSearchParams = Record<string, string | string[] | undefined>;

type ApprovisionnementPageProps = {
  searchParams?: Promise<RawApproSearchParams>;
};

type NormalizedApproQuery = {
  sort: SortColumn;
  dir: "asc" | "desc";
  from: string | null;
  to: string | null;
  canonicalQuery: string;
  baseQuery: string;
};

type ApproStats = {
  totalLotsConfirmed: number;
  totalPiecesConfirmed: number;
  totalCostConfirmed: number;
  avgCostPerPiece: number;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_SORT: SortColumn = "purchase_date";
const DEFAULT_DIR: "asc" | "desc" = "desc";
const ALLOWED_SORT_COLUMNS: ReadonlySet<SortColumn> = new Set([
  "id",
  "purchase_date",
  "label",
  "supplier",
  "total_pieces",
  "total_cost",
  "status",
]);

function getFirstParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toIncomingSearchParams(raw: RawApproSearchParams): URLSearchParams {
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

function normalizeApproQuery(raw: RawApproSearchParams): NormalizedApproQuery {
  const sortRaw = (getFirstParamValue(raw.sort) ?? "").trim() as SortColumn;
  const sort = ALLOWED_SORT_COLUMNS.has(sortRaw) ? sortRaw : DEFAULT_SORT;

  const dirRaw = (getFirstParamValue(raw.dir) ?? "").trim().toLowerCase();
  const dir: "asc" | "desc" = dirRaw === "asc" ? "asc" : DEFAULT_DIR;

  const { from, to } = normalizeDateRange(
    getFirstParamValue(raw.from),
    getFirstParamValue(raw.to)
  );

  const canonicalParams = new URLSearchParams();
  canonicalParams.set("sort", sort);
  canonicalParams.set("dir", dir);
  if (from) canonicalParams.set("from", from);
  if (to) canonicalParams.set("to", to);

  const baseParams = new URLSearchParams();
  baseParams.set("sort", sort);
  baseParams.set("dir", dir);
  if (from) baseParams.set("from", from);
  if (to) baseParams.set("to", to);

  return {
    sort,
    dir,
    from,
    to,
    canonicalQuery: canonicalParams.toString(),
    baseQuery: baseParams.toString(),
  };
}

function computeApproStats(lots: LotRow[]): ApproStats {
  const confirmedLots = lots.filter((lot) => lot.status === "confirmed");

  let totalLotsConfirmed = 0;
  let totalPiecesConfirmed = 0;
  let totalCostConfirmed = 0;

  for (const lot of confirmedLots) {
    totalLotsConfirmed += 1;
    totalPiecesConfirmed += lot.total_pieces ?? 0;
    totalCostConfirmed += Number(lot.total_cost ?? 0);
  }

  const avgCostPerPiece =
    totalPiecesConfirmed > 0 ? totalCostConfirmed / totalPiecesConfirmed : 0;

  return {
    totalLotsConfirmed,
    totalPiecesConfirmed,
    totalCostConfirmed,
    avgCostPerPiece,
  };
}

export default async function ApprovisionnementPage({
  searchParams,
}: ApprovisionnementPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const normalized = normalizeApproQuery(resolvedSearchParams);

  const incomingQuery = toIncomingSearchParams(resolvedSearchParams).toString();
  if (incomingQuery !== normalized.canonicalQuery) {
    redirect(`/approvisionnement?${normalized.canonicalQuery}`);
  }

  const { count: lot0Count, error: lot0CheckError } = await supabase
    .from("lots")
    .select("id", { count: "exact", head: true })
    .eq("lot_code", "LOT_0");

  if (lot0CheckError) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Approvisionnements</h1>
          <p className="text-sm text-muted-foreground">
            Erreur lors de la vérification du lot initial : {lot0CheckError.message}
          </p>
        </div>
      </main>
    );
  }

  if ((lot0Count ?? 0) === 0) {
    const today = new Date().toISOString().slice(0, 10);

    await supabase.from("lots").insert({
      lot_code: "LOT_0",
      label: "Stock initial",
      supplier: null,
      purchase_date: today,
      total_cost: 0,
      total_pieces: 0,
      status: "draft",
      notes: "Lot 0 – Stock initial (créé automatiquement)",
    });
  }

  let lotsQuery = supabase
    .from("lots")
    .select(
      "id, lot_code, label, purchase_date, supplier, total_pieces, total_cost, status, notes"
    );

  if (normalized.from) lotsQuery = lotsQuery.gte("purchase_date", normalized.from);
  if (normalized.to) lotsQuery = lotsQuery.lte("purchase_date", normalized.to);

  const { data, error } = await lotsQuery.order(normalized.sort, {
    ascending: normalized.dir === "asc",
  });

  if (error) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Approvisionnements</h1>
          <p className="text-sm text-muted-foreground">
            Erreur lors du chargement des lots : {error.message}
          </p>
        </div>
      </main>
    );
  }

  const lots = (data ?? []) as LotRow[];
  const stats = computeApproStats(lots);

  const makeSortHref = (columnKey: string) => {
    const params = new URLSearchParams(normalized.baseQuery);

    if (normalized.sort === columnKey) {
      const nextDir = normalized.dir === "asc" ? "desc" : "asc";
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
    const isActive = normalized.sort === columnKey;
    const isAsc = normalized.dir === "asc";

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
          <span className="text-[10px]">{isActive ? (isAsc ? "▲" : "▼") : "⇅"}</span>
        </Link>
      </th>
    );
  };

  const resetDateParams = new URLSearchParams();
  resetDateParams.set("sort", normalized.sort);
  resetDateParams.set("dir", normalized.dir);
  const resetDateHref = `/approvisionnement?${resetDateParams.toString()}`;

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Approvisionnements</h1>
          <p className="text-sm text-muted-foreground">
            Gestion des lots d&apos;achat et du stock initial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <details className="group relative">
            <summary className="list-none inline-flex h-9 cursor-pointer items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              Filtrer
            </summary>

            <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
              <form method="GET" className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-500">Du</label>
                    <input
                      type="date"
                      name="from"
                      defaultValue={normalized.from ?? ""}
                      className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs shadow-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-500">Au</label>
                    <input
                      type="date"
                      name="to"
                      defaultValue={normalized.to ?? ""}
                      className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs shadow-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <input type="hidden" name="sort" value={normalized.sort} />
                <input type="hidden" name="dir" value={normalized.dir} />

                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={resetDateHref}
                    className="inline-flex h-8 items-center rounded-full border border-slate-200 px-3 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Réinitialiser
                  </Link>
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center rounded-full bg-slate-900 px-3 text-[11px] font-medium text-white hover:bg-slate-800"
                  >
                    Appliquer
                  </button>
                </div>
              </form>
            </div>
          </details>

          <NewLotDialog />
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-start">
        <SalesStatCard
          title="Lots confirmés"
          mainValue={stats.totalLotsConfirmed.toLocaleString("fr-FR")}
          color="indigo"
        />

        <SalesStatCard
          title="Nb pièces totales"
          mainValue={stats.totalPiecesConfirmed.toLocaleString("fr-FR")}
          color="orange"
        />

        <SalesStatCard
          title="Coût total"
          mainValue={euro.format(stats.totalCostConfirmed)}
          color="amber"
        />

        <SalesStatCard
          title="Coût / pièce moyen"
          mainValue={
            stats.totalPiecesConfirmed > 0 ? euro.format(stats.avgCostPerPiece) : "—"
          }
          color="emerald"
        />
      </section>

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
                <th className="px-4 py-3 text-right font-medium">Coût / pièce</th>
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
                  const costPerPiece = totalPieces > 0 ? totalCostNumber / totalPieces : 0;

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
                    <ClickableRow key={lot.id} href={`/approvisionnement/${lot.id}`}>
                      <td className="px-4 py-3 font-mono text-xs">{displayCode}</td>

                      <td className="px-4 py-3">{formatDate(lot.purchase_date)}</td>

                      <td className="px-4 py-3 max-w-xs truncate">
                        {lot.label || (isInitialLot ? "Stock initial" : "—")}
                        {isInitialLot && (
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            (Lot 0 – stock initial)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 max-w-xs truncate">{lot.supplier || "—"}</td>

                      <td className="px-4 py-3 text-right tabular-nums">{totalPieces}</td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        {euro.format(totalCostNumber)}
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        {totalPieces > 0 ? euro.format(costPerPiece) : "—"}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={
                            lot.status === "confirmed"
                              ? "inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700"
                              : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600"
                          }
                        >
                          {lot.status === "confirmed" ? "Confirmé" : "Brouillon"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right" data-row-action="true">
                        <div className="inline-flex items-center gap-1.5" data-row-action="true">
                          <EditLotDialog lot={lotForEdit} />
                          <DeleteLotButton
                            lotId={lot.id}
                            lotLabel={displayCode}
                            isInitial={isInitialLot}
                            isConfirmed={lot.status === "confirmed"}
                          />
                        </div>
                      </td>
                    </ClickableRow>
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
