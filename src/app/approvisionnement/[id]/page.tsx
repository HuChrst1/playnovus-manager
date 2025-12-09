import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditLotDialog, LotForEdit } from "../EditLotDialog";
import { QuickAddPieceForm } from "./QuickAddPieceForm";
import { EditInventoryLineDialog } from "./EditInventoryLineDialog";
import { DeleteInventoryLineButton } from "./DeleteInventoryLineButton";

export const dynamic = "force-dynamic";

type LotRow = {
  id: number;
  lot_code: string | null;
  label: string | null;
  purchase_date: string; // ISO string
  supplier: string | null;
  total_pieces: number | null;
  total_cost: string; // numeric => string côté JS
  status: string;
  notes: string | null;
};

type InventoryLine = {
  id: number;
  piece_ref: string | null;
  quantity: number;
  location: string | null;
  created_at: string;
};

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lotId = Number(id);

  if (!Number.isFinite(lotId)) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Lot introuvable
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Identifiant invalide dans l&apos;URL.
        </p>
      </main>
    );
  }

  // 1. Charge le lot
  const { data: lotData, error: lotError } = await supabase
    .from("lots")
    .select(
      "id, lot_code, label, purchase_date, supplier, total_pieces, total_cost, status, notes"
    )
    .eq("id", lotId)
    .single();

  if (lotError || !lotData) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Lot introuvable
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Erreur lors du chargement du lot :{" "}
          {lotError?.message || "aucune donnée trouvée."}
        </p>
      </main>
    );
  }

  const lot = lotData as LotRow;

  // 2. Charge les lignes d'inventaire liées au lot
  const { data: inventoryData, error: inventoryError } = await supabase
    .from("inventory")
    .select("id, piece_ref, quantity, location, created_at")
    .eq("lot_id", lot.id)
    .order("created_at", { ascending: true });

  if (inventoryError) {
    console.error(
      "Erreur chargement inventory pour lot:",
      lot.id,
      inventoryError
    );
  }

  const lines = (inventoryData ?? []) as InventoryLine[];

  const totalCostNumber = Number(lot.total_cost ?? 0);
  const totalPieces = lot.total_pieces ?? 0;
  const costPerPiece = totalPieces > 0 ? totalCostNumber / totalPieces : 0;
  const displayCode = lot.lot_code || `LOT_${lot.id}`;

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
    <main className="space-y-6 min-w-[1024px]">
      {/* HEADER PAGE (aligné avec /catalogue/[id]) */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {displayCode}{" "}
            {lot.label ? `– ${lot.label}` : "– Détail du lot"}
          </h1>
        <p className="text-sm text-muted-foreground">
            Détail du lot d&apos;approvisionnement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="rounded-full px-4"
          >
            <Link href="/approvisionnement">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour lots
            </Link>
          </Button>
        </div>
      </div>

      {/* LAYOUT PRINCIPAL : résumé + pièces du lot */}
      <div className="grid gap-6 lg:grid-cols-[minmax(320px,360px)_1fr]">
        {/* COLONNE GAUCHE : résumé du lot */}
        <Card className="border-0 shadow-[0_18px_50px_rgba(15,23,42,0.16)] rounded-[28px] overflow-hidden bg-white/95">
          <CardHeader className="flex items-center justify-between py-3 px-5 border-b border-slate-100 bg-white/90">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-[0.22em]">
              Résumé du lot
            </CardTitle>

            {/* Petit bouton crayon dans l’en-tête de la card */}
            <EditLotDialog lot={lotForEdit} variant="card" />
          </CardHeader>

          <CardContent className="p-0 bg-white text-sm divide-y divide-slate-100">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-slate-500 font-medium">LotID</span>
              <span className="font-mono text-xs">{displayCode}</span>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-slate-500 font-medium">Date</span>
              <span>{formatDate(lot.purchase_date)}</span>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-slate-500 font-medium">Fournisseur</span>
              <span className="max-w-[180px] truncate text-right">
                {lot.supplier || "—"}
              </span>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-slate-500 font-medium">Nb pièces</span>
              <span className="tabular-nums font-semibold">
                {totalPieces}
              </span>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-slate-500 font-medium">Coût total</span>
              <span className="tabular-nums font-semibold">
                {euro.format(totalCostNumber)}
              </span>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-slate-500 font-medium">
                Coût / pièce
              </span>
              <span className="tabular-nums">
                {totalPieces > 0 ? euro.format(costPerPiece) : "—"}
              </span>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-slate-500 font-medium">Statut</span>
              <span
                className={
                  lot.status === "confirmed"
                    ? "inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700"
                    : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600"
                }
              >
                {lot.status === "confirmed" ? "Confirmé" : "Brouillon"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* COLONNE DROITE : pièces du lot */}
        <Card className="border-0 shadow-[0_18px_50px_rgba(15,23,42,0.16)] rounded-[28px] flex flex-col overflow-hidden bg-white/95">
          {/* Header de la card, aligné avec l'inventaire des sets */}
          <div className="px-6 py-5 border-b border-slate-100 bg-white">
            <div className="flex items-end justify-between gap-6">
                <div>
                <h2 className="text-sm font-semibold tracking-[0.16em] uppercase text-slate-500">
                    Pièces du lot ({lines.length})
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                    Saisie rapide : indique une référence de pièce Playmobil et une
                    quantité, puis ajoute-la à ce lot.
                </p>
                </div>

                <QuickAddPieceForm
                lotId={lot.id}
                isDraft={lot.status === "draft"}
                />
                </div>
            </div>

          {/* Tableau des pièces */}
          <div className="flex-1 bg-white overflow-y-auto max-h-[720px]">
            <table className="min-w-full text-sm">
            <thead className="app-table-head">
                <tr>
                    <th className="px-4 py-3 text-left font-medium">
                    Réf. pièce
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                    Quantité
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                    Créé le
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                    Actions
                    </th>
                </tr>
            </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr className="border-t border-border">
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-sm text-muted-foreground"
                    >
                      Aucune pièce enregistrée pour ce lot pour le
                      moment.
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => (
                    <tr
                        key={line.id}
                        className="border-t border-border hover:bg-sky-50/70 transition-colors"
                        >
                        <td className="px-4 py-3 font-mono text-xs">
                            {line.piece_ref || "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                            {line.quantity}
                        </td>
                        <td className="px-4 py-3">
                            {formatDateTime(line.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                            <EditInventoryLineDialog
                                lotId={lot.id}
                                lineId={line.id}
                                initialPieceRef={line.piece_ref}
                                initialQuantity={line.quantity}
                            />
                            <DeleteInventoryLineButton lotId={lot.id} lineId={line.id} />
                            </div>
                        </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}