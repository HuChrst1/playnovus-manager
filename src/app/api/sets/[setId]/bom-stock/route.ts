// src/app/api/sets/[setId]/bom-stock/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type BomStockRow = {
  piece_ref: string;
  piece_name: string | null;
  bom_qty: number;
  stock_qty: number;
  avg_unit_cost: number | null;
  total_value: number | null;
  missing_qty: number;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const { setId } = await params;

  if (!setId || typeof setId !== "string") {
    return NextResponse.json({ error: "setId manquant." }, { status: 400 });
  }

  // 1) BOM
  const { data: bom, error: bomError } = await supabaseServer
    .from("sets_bom")
    .select("piece_ref, piece_name, quantity")
    .eq("set_id", setId);

  if (bomError) {
    return NextResponse.json({ error: bomError.message }, { status: 500 });
  }

  const bomRows = (bom ?? []).map((r) => ({
    piece_ref: r.piece_ref,
    piece_name: r.piece_name,
    bom_qty: Number(r.quantity ?? 0),
  }));

  if (bomRows.length === 0) {
    return NextResponse.json(
      { set_id: setId, pieces: [], note: "Aucune BOM trouvée pour ce set." },
      { status: 200 }
    );
  }

  // 2) Stock (view stock_per_piece)
  const pieceRefs = Array.from(new Set(bomRows.map((r) => r.piece_ref)));

  const { data: stock, error: stockError } = await supabaseServer
    .from("stock_per_piece")
    .select("piece_ref, total_quantity, avg_unit_cost, total_value")
    .in("piece_ref", pieceRefs);

  if (stockError) {
    return NextResponse.json({ error: stockError.message }, { status: 500 });
  }

  const stockByRef = new Map(
    (stock ?? []).map((s) => [
      String(s.piece_ref ?? ""),
      {
        stock_qty: Number(s.total_quantity ?? 0),
        avg_unit_cost: s.avg_unit_cost ?? null,
        total_value: s.total_value ?? null,
      },
    ])
  );

  // 3) Merge BOM + stock
  const pieces: BomStockRow[] = bomRows.map((r) => {
    const st = stockByRef.get(r.piece_ref) ?? {
      stock_qty: 0,
      avg_unit_cost: null,
      total_value: null,
    };

    const missing = Math.max(0, Number(r.bom_qty) - Number(st.stock_qty));

    return {
      piece_ref: r.piece_ref,
      piece_name: r.piece_name,
      bom_qty: r.bom_qty,
      stock_qty: st.stock_qty,
      avg_unit_cost: st.avg_unit_cost,
      total_value: st.total_value,
      missing_qty: missing,
    };
  });

  return NextResponse.json(
    { set_id: setId, pieces },
    { status: 200 }
  );
}