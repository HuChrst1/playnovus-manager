export type StockMovementFifoInput = {
  id?: number | null;
  piece_ref: string | null;
  direction: string | null;
  quantity: number | null;
  unit_cost: number | null;
  lot_id: string | number | bigint | null;
};

export type FifoChunk = {
  pieceRef: string;
  lotId: string | null;
  quantity: number;
  unitCost: number;
  movementId?: number;
};

export type FifoAllocationResult = {
  pieceRef: string;
  requestedQuantity: number;
  totalQuantity: number;
  totalCost: number;
  chunks: FifoChunk[];
};

export type FifoBucket = {
  pieceRef: string;
  lotId: string | null;
  unitCost: number;
  quantityAvailable: number;
  firstMovementId?: number;
};

export function toNullableBigintString(v: unknown): string | null {
  if (v === null || v === undefined) return null;

  if (typeof v === "bigint") return v.toString();

  if (typeof v === "string") {
    const s = v.trim();
    return s.length ? s : null;
  }

  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.trunc(v));
  }

  return null;
}

export function buildFifoBuckets(
  movements: StockMovementFifoInput[]
): FifoBucket[] {
  const buckets: FifoBucket[] = [];

  for (const movement of movements) {
    const pieceRef = movement.piece_ref;
    if (!pieceRef) continue;

    const qty = Number(movement.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const unitCost =
      movement.unit_cost !== null && movement.unit_cost !== undefined
        ? Number(movement.unit_cost)
        : 0;

    const lotId = toNullableBigintString(movement.lot_id);

    if (movement.direction === "IN") {
      buckets.push({
        pieceRef,
        lotId,
        unitCost,
        quantityAvailable: qty,
        firstMovementId: movement.id ?? undefined,
      });
    } else if (movement.direction === "OUT") {
      let remaining = qty;

      for (const bucket of buckets) {
        if (remaining <= 0) break;
        if (bucket.quantityAvailable <= 0) continue;

        const take = Math.min(bucket.quantityAvailable, remaining);
        bucket.quantityAvailable -= take;
        remaining -= take;
      }
    } else if (movement.direction === "ADJUST") {
      continue;
    }
  }

  return buckets.filter((bucket) => bucket.quantityAvailable > 0);
}
