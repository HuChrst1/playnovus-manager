import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { NewLotDialog } from "./NewLotDialog";
import { DeleteLotButton } from "./DeleteLotButton";
import { EditLotDialog, LotForEdit } from "./EditLotDialog";
import { ClickableRow } from "./ClickableRow";
import Link from "next/link";
import { Boxes, Calculator, Filter, Package, Wallet } from "lucide-react";
import { SalesStatCard } from "@/components/sales/SalesStatCard";
import { Button } from "@/components/ui/button";
import {
  SortableTableHeader,
  TableCard,
  TableOverflow,
  TableStatusBadge,
} from "@/components/ui/data-table";
import { buildSupplierOptionsFromDb } from "./supplier-options";

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
  confirmedLotsCount: number;
  totalPieces: number;
  totalCost: number;
  avgCostPerPiece: number;
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const INITIAL_LOT_CODE = "LOT_0";
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
  let confirmedLotsCount = 0;
  let totalPieces = 0;
  let totalCost = 0;

  for (const lot of lots) {
    const isConfirmed = lot.status === "confirmed";
    const isInitialLot = lot.lot_code === INITIAL_LOT_CODE;

    if (isConfirmed) {
      confirmedLotsCount += 1;
    }

    if (isConfirmed || isInitialLot) {
      totalPieces += lot.total_pieces ?? 0;
      totalCost += Number(lot.total_cost ?? 0);
    }
  }

  const avgCostPerPiece =
    totalPieces > 0 ? totalCost / totalPieces : 0;

  return {
    confirmedLotsCount,
    totalPieces,
    totalCost,
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
    .eq("lot_code", INITIAL_LOT_CODE);

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
      lot_code: INITIAL_LOT_CODE,
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
  const { data: supplierRows, error: supplierRowsError } = await supabase
    .from("lots")
    .select("supplier")
    .not("supplier", "is", null);

  if (supplierRowsError) {
    console.error(
      "ApprovisionnementPage - erreur chargement fournisseurs:",
      supplierRowsError
    );
  }

  const supplierOptions = buildSupplierOptionsFromDb(
    (supplierRows ?? []).map((row) => row.supplier)
  );

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

  const resetDateParams = new URLSearchParams();
  resetDateParams.set("sort", normalized.sort);
  resetDateParams.set("dir", normalized.dir);
  const resetDateHref = `/approvisionnement?${resetDateParams.toString()}`;
  const activeFilterCount = Number(Boolean(normalized.from)) + Number(Boolean(normalized.to));

  return (
    <main className="space-y-6">
      <header className="px-1 md:px-2">
        <div className="min-w-0">
          <h1 className="text-3xl font-medium tracking-tight text-slate-900 md:text-[42px] md:leading-none">
            Approvisionnements
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestion des lots d&apos;achat et du stock initial.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-start">
        <SalesStatCard
          title="Lots confirmés"
          mainValue={stats.confirmedLotsCount.toLocaleString("fr-FR")}
          color="indigo"
          variant="neutral"
          icon={<Package className="h-4 w-4" />}
          iconGradientClassName="from-sky-700 to-blue-500"
        />

        <SalesStatCard
          title="Nb pièces totales"
          mainValue={stats.totalPieces.toLocaleString("fr-FR")}
          color="azure"
          variant="neutral"
          icon={<Boxes className="h-4 w-4" />}
          iconGradientClassName="from-cyan-600 to-sky-400"
        />

        <SalesStatCard
          title="Coût total"
          mainValue={euro.format(stats.totalCost)}
          color="sky"
          variant="neutral"
          icon={<Wallet className="h-4 w-4" />}
          iconGradientClassName="from-blue-700 to-indigo-500"
        />

        <SalesStatCard
          title="Coût / pièce moyen"
          mainValue={stats.totalPieces > 0 ? euro.format(stats.avgCostPerPiece) : "—"}
          color="emerald"
          variant="neutral"
          icon={<Calculator className="h-4 w-4" />}
          iconGradientClassName="from-sky-600 to-blue-400"
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
                htmlFor="lots-from"
                className="app-filter-toolbar-field"
              >
                <span>Du</span>
                <input
                  id="lots-from"
                  type="date"
                  name="from"
                  defaultValue={normalized.from ?? ""}
                  className="app-control h-8 w-[132px] px-3 text-[11px]"
                />
              </label>

              <label
                htmlFor="lots-to"
                className="app-filter-toolbar-field"
              >
                <span>Au</span>
                <input
                  id="lots-to"
                  type="date"
                  name="to"
                  defaultValue={normalized.to ?? ""}
                  className="app-control h-8 w-[132px] px-3 text-[11px]"
                />
              </label>

              <input type="hidden" name="sort" value={normalized.sort} />
              <input type="hidden" name="dir" value={normalized.dir} />

              <div className="app-filter-toolbar-actions">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="text-[11px]"
                >
                  <Link href={resetDateHref}>Réinitialiser</Link>
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="text-[11px] font-semibold"
                >
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

        <NewLotDialog
          supplierOptions={supplierOptions}
          triggerClassName="h-9 gap-2 px-4 text-xs font-medium"
        />
      </div>

      <TableCard className="appro-table-shell">

        <TableOverflow className="appro-table-scroll">
          <table className="appro-table min-w-full text-sm">
            <thead className="appro-table-header">
              <tr>
                <SortableTableHeader
                  label="LotID"
                  columnKey="id"
                  activeSortKey={normalized.sort}
                  sortDir={normalized.dir}
                  href={makeSortHref("id")}
                />
                <SortableTableHeader
                  label="Date"
                  columnKey="purchase_date"
                  activeSortKey={normalized.sort}
                  sortDir={normalized.dir}
                  href={makeSortHref("purchase_date")}
                />
                <SortableTableHeader
                  label="Libellé"
                  columnKey="label"
                  activeSortKey={normalized.sort}
                  sortDir={normalized.dir}
                  href={makeSortHref("label")}
                />
                <SortableTableHeader
                  label="Fournisseur"
                  columnKey="supplier"
                  activeSortKey={normalized.sort}
                  sortDir={normalized.dir}
                  href={makeSortHref("supplier")}
                />
                <SortableTableHeader
                  label="Nb pièces"
                  columnKey="total_pieces"
                  activeSortKey={normalized.sort}
                  sortDir={normalized.dir}
                  href={makeSortHref("total_pieces")}
                  align="right"
                />
                <SortableTableHeader
                  label="Coût total"
                  columnKey="total_cost"
                  activeSortKey={normalized.sort}
                  sortDir={normalized.dir}
                  href={makeSortHref("total_cost")}
                  align="right"
                />
                <th className="px-4 py-3 text-right font-medium">Coût / pièce</th>
                <SortableTableHeader
                  label="Statut"
                  columnKey="status"
                  activeSortKey={normalized.sort}
                  sortDir={normalized.dir}
                  href={makeSortHref("status")}
                  align="center"
                />
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {lots.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    Aucun lot d&apos;approvisionnement pour le moment.
                  </td>
                </tr>
              ) : (
                lots.map((lot) => {
                  const totalCostNumber = Number(lot.total_cost ?? 0);
                  const totalPieces = lot.total_pieces ?? 0;
                  const costPerPiece = totalPieces > 0 ? totalCostNumber / totalPieces : 0;

                  const isInitialLot = lot.lot_code === INITIAL_LOT_CODE;
                  const displayCode =
                    lot.lot_code || (isInitialLot ? INITIAL_LOT_CODE : `LOT_${lot.id}`);

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
                    <ClickableRow
                      key={lot.id}
                      href={`/approvisionnement/${lot.id}`}
                      className="appro-table-row cursor-pointer focus-visible:outline-none"
                    >
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
                        <TableStatusBadge
                          label={lot.status === "confirmed" ? "Confirmé" : "Brouillon"}
                          tone={lot.status === "confirmed" ? "success" : "muted"}
                          className="px-3 py-1 font-medium"
                        />
                      </td>

                      <td className="px-4 py-3 text-right" data-row-action="true">
                        <div className="inline-flex items-center gap-1.5" data-row-action="true">
                          <EditLotDialog lot={lotForEdit} supplierOptions={supplierOptions} />
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
        </TableOverflow>
      </TableCard>
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
