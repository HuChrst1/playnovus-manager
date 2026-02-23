export function movement(args) {
  return {
    id: args.id ?? null,
    piece_ref: args.pieceRef,
    direction: args.direction,
    quantity: args.quantity,
    unit_cost: args.unitCost ?? null,
    lot_id: args.lotId ?? null,
  };
}
