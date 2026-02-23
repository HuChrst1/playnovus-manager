import assert from "node:assert/strict";
import test from "node:test";
import { buildFifoBuckets } from "../../src/lib/stock-fifo.ts";
import { movement } from "../helpers/fifo-fixtures.mjs";

test("FIFO consume oldest lot first", () => {
  const buckets = buildFifoBuckets([
    movement({
      id: 1001,
      pieceRef: "F71_FIFO_A",
      direction: "IN",
      quantity: 2,
      unitCost: 1,
      lotId: "10",
    }),
    movement({
      id: 1002,
      pieceRef: "F71_FIFO_A",
      direction: "IN",
      quantity: 3,
      unitCost: 2,
      lotId: "20",
    }),
    movement({
      id: 1003,
      pieceRef: "F71_FIFO_A",
      direction: "OUT",
      quantity: 4,
      unitCost: 0,
      lotId: "10",
    }),
  ]);

  assert.equal(buckets.length, 1);
  assert.deepEqual(buckets[0], {
    pieceRef: "F71_FIFO_A",
    lotId: "20",
    unitCost: 2,
    quantityAvailable: 1,
    firstMovementId: 1002,
  });
});

test("FIFO handles partial and full depletion across multiple lots", () => {
  const buckets = buildFifoBuckets([
    movement({
      id: 2001,
      pieceRef: "F71_FIFO_B",
      direction: "IN",
      quantity: 5,
      unitCost: 1.5,
      lotId: "30",
    }),
    movement({
      id: 2002,
      pieceRef: "F71_FIFO_B",
      direction: "IN",
      quantity: 4,
      unitCost: 1.8,
      lotId: "40",
    }),
    movement({
      id: 2003,
      pieceRef: "F71_FIFO_B",
      direction: "OUT",
      quantity: 3,
      unitCost: 0,
      lotId: "30",
    }),
    movement({
      id: 2004,
      pieceRef: "F71_FIFO_B",
      direction: "OUT",
      quantity: 4,
      unitCost: 0,
      lotId: "30",
    }),
  ]);

  assert.equal(buckets.length, 1);
  assert.deepEqual(buckets[0], {
    pieceRef: "F71_FIFO_B",
    lotId: "40",
    unitCost: 1.8,
    quantityAvailable: 2,
    firstMovementId: 2002,
  });
});

test("FIFO ignores ADJUST rows and invalid quantities", () => {
  const buckets = buildFifoBuckets([
    movement({
      id: 3001,
      pieceRef: "F71_FIFO_C",
      direction: "IN",
      quantity: 6,
      unitCost: 0.5,
      lotId: "50",
    }),
    movement({
      id: 3002,
      pieceRef: "F71_FIFO_C",
      direction: "ADJUST",
      quantity: 999,
      unitCost: 0,
      lotId: "50",
    }),
    movement({
      id: 3003,
      pieceRef: "F71_FIFO_C",
      direction: "IN",
      quantity: 0,
      unitCost: 1.1,
      lotId: "51",
    }),
    movement({
      id: 3004,
      pieceRef: "F71_FIFO_C",
      direction: "OUT",
      quantity: 2,
      unitCost: 0,
      lotId: "50",
    }),
  ]);

  assert.equal(buckets.length, 1);
  assert.deepEqual(buckets[0], {
    pieceRef: "F71_FIFO_C",
    lotId: "50",
    unitCost: 0.5,
    quantityAvailable: 4,
    firstMovementId: 3001,
  });
});
