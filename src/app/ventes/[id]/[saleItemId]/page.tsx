import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";
import { formatSetReferenceDisplay } from "@/lib/sale-number";
import { Badge } from "@/components/ui/badge";
import { getDraftLot0Id } from "@/lib/lot0-provisional";

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

  let setDisplayRef: string | null = null;
  const setIdRaw = String(item.set_id ?? "").trim();
  if (setIdRaw.length > 0) {
    const { data: setRefRow, error: setRefError } = await supabaseServer
      .from("sets_catalog")
      .select("display_ref")
      .eq("id", setIdRaw)
      .maybeSingle();

    if (setRefError) {
      console.error("SaleSetPiecesPage - erreur chargement display_ref set:", setRefError);
    } else {
      const displayRef = String(setRefRow?.display_ref ?? "").trim();
      if (displayRef.length > 0) {
        setDisplayRef = displayRef;
      }
    }
  }

  const setReferenceDisplay = formatSetReferenceDisplay(item.set_id, setDisplayRef) || "—";
  const pageTitle =
    item.item_kind === "SET"
      ? `Set n°${setReferenceDisplay}`
      : `Pièce n°${itemId}`;

  // 2) Charger snapshot des pièces réellement vendues
  type SaleItemPieceSnapshotRow = {
    piece_ref: string;
    quantity: number;
    unit_cost: number | null;
    lot_id: string | null; // bigint-safe
    is_provisional_lot0: boolean;
  };

  const { data: rowsRaw, error: rowsError } = await supabaseServer
    .from("sale_item_pieces")
    .select("piece_ref, quantity, unit_cost, lot_id")
    .eq("sale_id", saleId)
    .eq("sale_item_id", itemId)
    .order("piece_ref", { ascending: true });

  const lot0Lookup = await getDraftLot0Id(supabaseServer);
  if (lot0Lookup.error) {
    console.error("SaleSetPiecesPage - lot0 lookup error:", lot0Lookup.error);
  }
  const draftLot0Id = lot0Lookup.lotId;

  const pieces = (rowsRaw ?? []).map((r) => {
    const unitCost = r.unit_cost;
    const lotId = r.lot_id;
    const lotIdNumber =
      lotId === null || lotId === undefined ? null : Number(lotId);
    const isProvisionalLot0 =
      draftLot0Id !== null &&
      lotIdNumber !== null &&
      Number.isFinite(lotIdNumber) &&
      lotIdNumber === draftLot0Id;

    return {
      piece_ref: String(r.piece_ref ?? ""),
      quantity: Number(r.quantity ?? 0),
      unit_cost:
        unitCost === null || unitCost === undefined ? null : Number(unitCost),
      lot_id: lotId === null || lotId === undefined ? null : String(lotId),
      is_provisional_lot0: isProvisionalLot0,
    } satisfies SaleItemPieceSnapshotRow;
  });
  const hasProvisionalPieces = pieces.some((piece) => piece.is_provisional_lot0);

  if (rowsError) {
    return (
      <main className="space-y-4">
        <h1 className="text-xl font-semibold">Erreur chargement pièces</h1>
        <pre className="text-xs bg-black/5 p-3 rounded">
          {JSON.stringify({ saleId, itemId, rowsError }, null, 2)}
        </pre>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 px-1 md:px-2">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-slate-900 md:text-[42px] md:leading-none">
            {pageTitle}
          </h1>
        </div>
      </header>

      <section className="app-surface-muted p-4 sm:p-5">
        <p className="app-section-label mb-2">Résumé de la ligne</p>
        <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Set</span>
            <span className="mt-0.5 block font-medium text-slate-900">{setReferenceDisplay}</span>
          </p>
          <p>
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Quantité vendue</span>
            <span className="mt-0.5 block font-medium text-slate-900">{item.quantity}</span>
          </p>
          <p>
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Net ligne</span>
            <span className="mt-0.5 block font-medium text-slate-900">
              {euro.format(Number(item.net_amount ?? 0))}
            </span>
          </p>
          <p>
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Marge ligne</span>
            <span className="mt-0.5 block font-medium text-slate-900">
              {euro.format(Number(item.margin_amount ?? 0))}
            </span>
          </p>
        </div>
      </section>

      {hasProvisionalPieces ? (
        <section className="app-surface-muted border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-sky-900">
          Cette ligne de set contient des pièces issues de LOT_0 provisoire
          (brouillon). Les coûts FIFO affichés restent indicatifs jusqu&apos;à la
          confirmation finale de LOT_0.
        </section>
      ) : null}

      <section className="appro-table-shell">
        <div className="appro-table-scroll overflow-x-auto">
          <table className="appro-table min-w-full text-sm">
            <thead className="appro-table-header">
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
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    Aucune pièce snapshotée pour cette ligne (ancienne vente ou snapshot non encore branché).
                  </td>
                </tr>
              ) : (
                pieces.map((p) => (
                  <tr key={`${p.piece_ref}`} className="appro-table-row">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{p.piece_ref}</span>
                        {p.is_provisional_lot0 ? (
                          <Badge variant="warning">Coût provisoire LOT_0</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {typeof p.unit_cost === "number" || p.is_provisional_lot0
                        ? euro.format(Number(p.unit_cost ?? 0))
                        : "—"}
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
