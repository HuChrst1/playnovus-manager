begin;

-- F1.2: minimal executable seed for local reset
-- Scope: sets_catalog, sets_bom, lots, inventory, stock_movements, sales, sale_items, sale_item_pieces

insert into public.sets_catalog (
  id,
  display_ref,
  name,
  version,
  year_start,
  year_end,
  image_url,
  created_at,
  theme
)
values (
  'SEED_SET_F1_2_001',
  'SEED-F1.2-001',
  'Seed Set F1.2',
  '1',
  1998,
  2000,
  null,
  '2026-02-14T09:00:00+00',
  'SEED'
);

insert into public.sets_bom (
  set_id,
  piece_ref,
  quantity,
  piece_name
)
values
  ('SEED_SET_F1_2_001', 'P-SEED-RED-2X2', 2, 'Brick red 2x2'),
  ('SEED_SET_F1_2_001', 'P-SEED-BLUE-1X4', 1, 'Plate blue 1x4');

do $seed$
declare
  v_lot_id bigint;
  v_sale_id bigint;
  v_sale_item_id bigint;
begin
  insert into public.lots (
    lot_code,
    label,
    purchase_date,
    supplier,
    total_pieces,
    total_cost,
    status,
    notes,
    created_at
  )
  values (
    'SEED_LOT_F1_2_001',
    'Seed lot F1.2',
    date '2026-02-14',
    'Seed Supplier',
    20,
    8.40,
    'confirmed',
    'Minimal seed lot for local reset',
    '2026-02-14T09:05:00+00'
  )
  returning id into v_lot_id;

  insert into public.inventory (
    piece_ref,
    quantity,
    location,
    created_at,
    lot_id,
    unit_cost
  )
  values
    ('P-SEED-RED-2X2', 12, 'SEED_BIN_A', '2026-02-14T09:06:00+00', v_lot_id, 0.5000),
    ('P-SEED-BLUE-1X4', 8, 'SEED_BIN_A', '2026-02-14T09:06:00+00', v_lot_id, 0.3000);

  insert into public.stock_movements (
    piece_ref,
    lot_id,
    direction,
    quantity,
    unit_cost,
    source_type,
    source_id,
    created_at,
    comment
  )
  values
    ('P-SEED-RED-2X2', v_lot_id, 'IN', 12, 0.5000, 'PURCHASE', v_lot_id::text, '2026-02-14T09:10:00+00', 'Seed F1.2 purchase movement'),
    ('P-SEED-BLUE-1X4', v_lot_id, 'IN', 8, 0.3000, 'PURCHASE', v_lot_id::text, '2026-02-14T09:10:00+00', 'Seed F1.2 purchase movement');

  insert into public.sales (
    sale_number,
    sale_type,
    sales_channel,
    status,
    net_seller_amount,
    currency,
    buyer_paid_total,
    vat_rate,
    total_cost_amount,
    total_margin_amount,
    margin_rate,
    paid_at,
    created_at,
    comment
  )
  values (
    'SEED-SALE-F1.2-001',
    'SET',
    'DIRECT',
    'CONFIRMED',
    10.00,
    'EUR',
    10.00,
    null,
    1.3000,
    8.7000,
    0.870,
    '2026-02-14T10:00:00+00',
    '2026-02-14T10:00:00+00',
    'Minimal confirmed sale seeded for F1.2'
  )
  returning id into v_sale_id;

  insert into public.sale_items (
    sale_id,
    line_index,
    item_kind,
    set_id,
    piece_ref,
    quantity,
    is_partial_set,
    net_amount,
    cost_amount,
    margin_amount,
    comment
  )
  values (
    v_sale_id,
    1,
    'SET',
    'SEED_SET_F1_2_001',
    null,
    1,
    false,
    10.00,
    1.3000,
    8.7000,
    'Seed F1.2 set line'
  )
  returning id into v_sale_item_id;

  insert into public.sale_item_pieces (
    sale_id,
    sale_item_id,
    piece_ref,
    quantity,
    unit_cost,
    lot_id,
    created_at
  )
  values
    (v_sale_id, v_sale_item_id, 'P-SEED-RED-2X2', 2, 0.5000, v_lot_id, '2026-02-14T10:01:00+00'),
    (v_sale_id, v_sale_item_id, 'P-SEED-BLUE-1X4', 1, 0.3000, v_lot_id, '2026-02-14T10:01:00+00');

  insert into public.stock_movements (
    piece_ref,
    lot_id,
    direction,
    quantity,
    unit_cost,
    source_type,
    source_id,
    created_at,
    comment
  )
  values
    ('P-SEED-RED-2X2', v_lot_id, 'OUT', 2, 0.5000, 'SALE', v_sale_item_id::text, '2026-02-14T10:02:00+00', 'Seed F1.2 sale movement'),
    ('P-SEED-BLUE-1X4', v_lot_id, 'OUT', 1, 0.3000, 'SALE', v_sale_item_id::text, '2026-02-14T10:02:00+00', 'Seed F1.2 sale movement');
end
$seed$;

commit;
