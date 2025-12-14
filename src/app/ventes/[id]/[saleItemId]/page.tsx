import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; saleItemId: string }>;
};

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function SaleSetPiecesPage({ params }: Props) {
  const { id, saleItemId } = await params;

  const saleId = Number(id);
  const itemId = Number(saleItemId);

  if (!Number.isFinite(saleId) || saleId <= 0) notFound();
  if (!Number.isFinite(itemId) || itemId <= 0) notFound();

  // 1) Charger la ligne de vente
  const { data: item, error: itemError } = await supabaseServer
    .from("sale_items")
    .select("*")
    .eq("id", itemId)
    .eq("sale_id", saleId)
    .single();

  if (itemError || !item) notFound();
  if (item.item_kind !== "SET") notFound();

  // 2) Charger snapshot des pièces réellement vendues
  type SaleItemPieceSnapshotRow = {
    piece_ref: string;
    quantity: number;
    unit_cost: number | null;
    lot_id: string | null; // bigint-safe
  };

  const sb = supabaseServer as any;

  const { data: rowsRaw, error: rowsError } = await sb
    .from("sale_item_pieces")
    .select("piece_ref, quantity, unit_cost, lot_id")
    .eq("sale_id", saleId)
    .eq("sale_item_id", itemId)
    .order("piece_ref", { ascending: true });

  const pieces = ((rowsRaw ?? []) as any[]).map((r) => {
    const unitCost = r.unit_cost;
    const lotId = r.lot_id;

    return {
      piece_ref: String(r.piece_ref ?? ""),
      quantity: Number(r.quantity ?? 0),
      unit_cost:
        unitCost === null || unitCost === undefined ? null : Number(unitCost),
      lot_id: lotId === null || lotId === undefined ? null : String(lotId),
    } satisfies SaleItemPieceSnapshotRow;
  });

  if (rowsError) {
    return (
      <main className="space-y-4">
        <h1 className="text-xl font-semibold">Erreur chargement pièces</h1>
        <pre className="text-xs bg-black/5 p-3 rounded">
          {JSON.stringify({ saleId, itemId, rowsError }, null, 2)}
        </pre>
        <Link className="underline" href={`/ventes/${saleId}`}>
          ← Retour à la vente
        </Link>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Set vendu : {item.set_id ?? "—"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Vente #{saleId} · Ligne #{item.line_index + 1} · Qté : {item.quantity}
          </p>
        </div>

        <Link
          href={`/ventes/${saleId}`}
          className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          ← Retour à la vente
        </Link>
      </div>

      <section className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="app-table-head">
              <tr>
                <th className={cn("px-4 py-3 font-medium text-left")}>Pièce</th>
                <th className={cn("px-4 py-3 font-medium text-right")}>
                  Quantité vendue
                </th>
                <th className={cn("px-4 py-3 font-medium text-right")}>
                  Coût unitaire (FIFO)
                </th>
                <th className={cn("px-4 py-3 font-medium text-right")}>Lot</th>
              </tr>
            </thead>
            <tbody>
              {pieces.length === 0 ? (
                <tr className="border-t border-border">
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    Aucune pièce snapshotée pour cette ligne (ancienne vente ou snapshot non encore branché).
                  </td>
                </tr>
              ) : (
                pieces.map((p) => (
                  <tr key={`${p.piece_ref}`} className="app-table-row">
                    <td className="px-4 py-3">{p.piece_ref}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {typeof p.unit_cost === "number" ? euro.format(p.unit_cost) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.lot_id ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}