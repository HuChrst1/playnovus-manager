import { supabase } from "@/lib/supabase";
import { NewLotDialog } from "./NewLotDialog";
import { DeleteLotButton } from "./DeleteLotButton";
import { EditLotDialog, LotForEdit } from "./EditLotDialog";
import Link from "next/link";

export const dynamic = "force-dynamic";

type LotRow = {
  id: number;
  lot_code: string | null;
  label: string | null;
  purchase_date: string; // renvoyé en string ISO par Supabase
  supplier: string | null;
  total_pieces: number | null;
  total_cost: string; // numeric => string côté JS
  status: string;
  notes: string | null;
};

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(value: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}

export default async function ApprovisionnementPage() {
  // 1) On charge les lots existants
  const { data, error } = await supabase
    .from("lots")
    .select(
      "id, lot_code, label, purchase_date, supplier, total_pieces, total_cost, status, notes"
    )
    .order("purchase_date", { ascending: false });

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

      {/* TABLE DES LOTS */}
      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="px-4 py-3 text-left font-medium">LotID</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Libellé</th>
                <th className="px-4 py-3 text-left font-medium">
                  Fournisseur
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Nb pièces
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Coût total
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Coût / pièce
                </th>
                <th className="px-4 py-3 text-center font-medium">Statut</th>
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