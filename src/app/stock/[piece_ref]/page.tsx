// src/app/stock/[piece_ref]/page.tsx

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type MovementRow = {
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

export default async function PieceHistoryPage({
  params,
}: {
  params: Promise<{ piece_ref: string }>;
}) {
  const { piece_ref } = await params;
  const decodedRef = decodeURIComponent(piece_ref);

  if (!decodedRef) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pièce introuvable
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Référence de pièce invalide dans l&apos;URL.
        </p>
      </main>
    );
  }

  // 1. Charger les mouvements pour cette pièce
  const { data, error } = await supabase
  .from("piece_movements")
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
  .eq("piece_ref", decodedRef)
  .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur chargement piece_movements:", error);
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Historique de la pièce
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

  const rows: MovementRow[] = (data ?? []) as unknown as MovementRow[];

  // 2. Petites stats de synthèse
  let totalIn = 0;
  let totalOut = 0;
  let totalAdjust = 0;

  for (const m of rows) {
    const qty = m.quantity ?? 0;
    if (m.direction === "IN") totalIn += qty;
    else if (m.direction === "OUT") totalOut += qty;
    else if (m.direction === "ADJUST") totalAdjust += qty;
  }

  const currentStock = totalIn - totalOut + totalAdjust;

  const firstMovementDate =
    rows.length > 0
      ? formatDate(rows[rows.length - 1].created_at)
      : "—";
  const lastMovementDate =
    rows.length > 0 ? formatDate(rows[0].created_at) : "—";

  const renderDirectionBadge = (direction: MovementRow["direction"]) => {
    if (direction === "IN") {
      return (
        <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
          Entrée
        </span>
      );
    }
    if (direction === "OUT") {
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

  const renderSource = (m: MovementRow) => {
    if (m.source_type === "PURCHASE" && m.lot_id) {
      const label =
        m.lot_code || `LOT_${m.lot_id}`;
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Pièce {decodedRef}
          </h1>
          <p className="text-sm text-muted-foreground">
            Historique des mouvements de stock pour cette référence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="rounded-full px-4"
          >
            <Link href="/stock">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour stock
            </Link>
          </Button>
        </div>
      </div>

      {/* LAYOUT PRINCIPAL : résumé + historique */}
      <div className="grid gap-6 lg:grid-cols-[minmax(320px,360px)_1fr]">
        {/* COLONNE GAUCHE : résumé synthétique */}
        <Card className="border-0 shadow-[0_18px_50px_rgba(15,23,42,0.16)] rounded-[28px] overflow-hidden bg-white/95">
          <CardHeader className="py-3 px-5 border-b border-slate-100 bg-white/90">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-[0.22em]">
              Résumé de la pièce
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0 bg-white text-sm divide-y divide-slate-100">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-slate-500 font-medium">
                Référence
              </span>
              <span className="font-mono text-xs">{decodedRef}</span>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-slate-500 font-medium">
                Stock actuel
              </span>
              <span className="tabular-nums font-semibold">
                {currentStock}
              </span>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-slate-500 font-medium">
                Total entrées
              </span>
              <span className="tabular-nums">{totalIn}</span>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-slate-500 font-medium">
                Total sorties
              </span>
              <span className="tabular-nums">{totalOut}</span>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-slate-500 font-medium">
                Premier mouvement
              </span>
              <span>{firstMovementDate}</span>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-slate-500 font-medium">
                Dernier mouvement
              </span>
              <span>{lastMovementDate}</span>
            </div>
          </CardContent>
        </Card>

        {/* COLONNE DROITE : tableau des mouvements */}
        <Card className="border-0 shadow-[0_18px_50px_rgba(15,23,42,0.16)] rounded-[28px] flex flex-col overflow-hidden bg-white/95">
          <div className="px-6 py-5 border-b border-slate-100 bg-white">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="text-sm font-semibold tracking-[0.16em] uppercase text-slate-500">
                  Mouvements ({rows.length})
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Entrées, sorties et ajustements de stock pour cette pièce.
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white overflow-y-auto max-h-[720px]">
            <table className="min-w-full text-sm">
              <thead className="app-table-head">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    Date
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
                      colSpan={7}
                      className="px-4 py-6 text-center text-sm text-muted-foreground"
                    >
                      Aucun mouvement enregistré pour cette pièce.
                    </td>
                  </tr>
                ) : (
                  rows.map((m) => {
                    const qty = m.quantity ?? 0;
                    const sign =
                      m.direction === "OUT" ? "-" : m.direction === "IN" ? "+" : "";
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
                        className="border-t border-border hover:bg-sky-50/70 transition-colors"
                      >
                        <td className="px-4 py-3">
                          {formatDateTime(m.created_at)}
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
        </Card>
      </div>
    </main>
  );
}