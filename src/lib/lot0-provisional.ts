import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export const LOT_0_CODE = "LOT_0";
export const LOT_0_PROVISIONAL_UNIT_COST = 0;

export function isLot0Code(lotCode: string | null | undefined): boolean {
  return (lotCode ?? "").trim() === LOT_0_CODE;
}

export function isLot0DraftProvisional(
  lotCode: string | null | undefined,
  status: string | null | undefined
): boolean {
  return isLot0Code(lotCode) && (status ?? "").trim() === "draft";
}

export async function getDraftLot0Id(
  client: SupabaseClient<Database>
): Promise<{ lotId: number | null; error: string | null }> {
  const { data, error } = await client
    .from("lots")
    .select("id, lot_code, status")
    .eq("lot_code", LOT_0_CODE)
    .maybeSingle();

  if (error) {
    return {
      lotId: null,
      error: "Impossible de verifier le statut provisoire de LOT_0.",
    };
  }

  if (!data || !isLot0DraftProvisional(data.lot_code, data.status)) {
    return { lotId: null, error: null };
  }

  return { lotId: data.id, error: null };
}
