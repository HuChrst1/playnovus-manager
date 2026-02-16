-- F1.5: Healthcheck SQL des anomalies metier
-- Scope strict:
--  - Audit non bloquant via vue SQL (fail-open)
--  - Couverture des anomalies CONFIRMED_SALE / ORPHAN_MOVEMENT / INVENTORY_INCONSISTENCY / NEGATIVE_STOCK
--  - Aucun changement des garde-fous F1.3/F1.4

begin;

create or replace view public.healthcheck_business_anomalies_v1 as
with
confirmed_sales as (
  select s.id as sale_id
  from public.sales s
  where s.status = 'CONFIRMED'
),
confirmed_sale_items as (
  select
    si.id as sale_item_id,
    si.sale_id
  from public.sale_items si
  join confirmed_sales cs
    on cs.sale_id = si.sale_id
),
expected_sale_item_snapshot as (
  select
    csi.sale_id,
    sip.sale_item_id,
    sip.piece_ref,
    sip.lot_id,
    sum(sip.quantity)::numeric as expected_quantity
  from confirmed_sale_items csi
  join public.sale_item_pieces sip
    on sip.sale_item_id = csi.sale_item_id
  group by
    csi.sale_id,
    sip.sale_item_id,
    sip.piece_ref,
    sip.lot_id
),
observed_sale_item_movements as (
  select
    csi.sale_id,
    csi.sale_item_id,
    sm.piece_ref,
    sm.lot_id,
    sum(sm.quantity)::numeric as observed_quantity
  from public.stock_movements sm
  join confirmed_sale_items csi
    on csi.sale_item_id = case
      when nullif(btrim(sm.source_id), '') ~ '^[0-9]+$' then sm.source_id::bigint
      else null
    end
  where sm.source_type = 'SALE'
    and sm.direction = 'OUT'
  group by
    csi.sale_id,
    csi.sale_item_id,
    sm.piece_ref,
    sm.lot_id
),
stock_movements_enriched as (
  select
    sm.*,
    nullif(btrim(sm.source_id), '') as source_id_trimmed,
    case
      when nullif(btrim(sm.source_id), '') ~ '^[0-9]+$' then sm.source_id::bigint
      else null
    end as source_id_bigint
  from public.stock_movements sm
),
expected_confirmed_inventory as (
  select
    l.id as lot_id,
    i.piece_ref,
    sum(i.quantity)::numeric as expected_quantity
  from public.lots l
  join public.inventory i
    on i.lot_id = l.id
  where l.status = 'confirmed'
  group by
    l.id,
    i.piece_ref
),
observed_confirmed_purchase as (
  select
    l.id as lot_id,
    sm.piece_ref,
    sum(sm.quantity)::numeric as observed_quantity
  from public.lots l
  join public.stock_movements sm
    on sm.lot_id = l.id
  where l.status = 'confirmed'
    and sm.source_type = 'PURCHASE'
    and sm.direction = 'IN'
  group by
    l.id,
    sm.piece_ref
)
select
  1::smallint as contract_version,
  'SALE_CONFIRMED_WITHOUT_ITEMS'::text as anomaly_code,
  'CONFIRMED_SALE'::text as anomaly_family,
  'ERROR'::text as severity,
  'sales'::text as entity_table,
  cs.sale_id::text as entity_id,
  cs.sale_id as sale_id,
  null::bigint as sale_item_id,
  null::bigint as lot_id,
  null::bigint as movement_id,
  null::text as piece_ref,
  null::numeric as expected_quantity,
  null::numeric as observed_quantity,
  jsonb_build_object(
    'reason', 'confirmed_sale_has_no_sale_items'
  ) as details
from confirmed_sales cs
left join public.sale_items si
  on si.sale_id = cs.sale_id
group by cs.sale_id
having count(si.id) = 0

union all

select
  1::smallint as contract_version,
  'SALE_ITEM_WITHOUT_SNAPSHOT'::text as anomaly_code,
  'CONFIRMED_SALE'::text as anomaly_family,
  'ERROR'::text as severity,
  'sale_items'::text as entity_table,
  csi.sale_item_id::text as entity_id,
  csi.sale_id as sale_id,
  csi.sale_item_id as sale_item_id,
  null::bigint as lot_id,
  null::bigint as movement_id,
  null::text as piece_ref,
  null::numeric as expected_quantity,
  null::numeric as observed_quantity,
  jsonb_build_object(
    'reason', 'confirmed_sale_item_has_no_sale_item_pieces_snapshot'
  ) as details
from confirmed_sale_items csi
left join public.sale_item_pieces sip
  on sip.sale_item_id = csi.sale_item_id
group by
  csi.sale_id,
  csi.sale_item_id
having count(sip.id) = 0

union all

select
  1::smallint as contract_version,
  'SALE_ITEM_MOVEMENT_QTY_MISMATCH'::text as anomaly_code,
  'CONFIRMED_SALE'::text as anomaly_family,
  'ERROR'::text as severity,
  'sale_items'::text as entity_table,
  format(
    '%s|%s|%s',
    coalesce(e.sale_item_id, o.sale_item_id)::text,
    coalesce(e.piece_ref, o.piece_ref),
    coalesce(coalesce(e.lot_id, o.lot_id)::text, '<null>')
  )::text as entity_id,
  coalesce(e.sale_id, o.sale_id) as sale_id,
  coalesce(e.sale_item_id, o.sale_item_id) as sale_item_id,
  coalesce(e.lot_id, o.lot_id) as lot_id,
  null::bigint as movement_id,
  coalesce(e.piece_ref, o.piece_ref) as piece_ref,
  coalesce(e.expected_quantity, 0::numeric) as expected_quantity,
  coalesce(o.observed_quantity, 0::numeric) as observed_quantity,
  jsonb_build_object(
    'reason', 'snapshot_vs_sale_out_mismatch',
    'key', jsonb_build_object(
      'sale_item_id', coalesce(e.sale_item_id, o.sale_item_id),
      'piece_ref', coalesce(e.piece_ref, o.piece_ref),
      'lot_id', coalesce(e.lot_id, o.lot_id)
    )
  ) as details
from expected_sale_item_snapshot e
full join observed_sale_item_movements o
  on e.sale_id = o.sale_id
 and e.sale_item_id = o.sale_item_id
 and e.piece_ref = o.piece_ref
 and e.lot_id is not distinct from o.lot_id
where coalesce(e.expected_quantity, 0::numeric) <> coalesce(o.observed_quantity, 0::numeric)

union all

select
  1::smallint as contract_version,
  'ORPHAN_PURCHASE_MOVEMENT'::text as anomaly_code,
  'ORPHAN_MOVEMENT'::text as anomaly_family,
  'ERROR'::text as severity,
  'stock_movements'::text as entity_table,
  sm.id::text as entity_id,
  null::bigint as sale_id,
  null::bigint as sale_item_id,
  sm.lot_id as lot_id,
  sm.id as movement_id,
  sm.piece_ref as piece_ref,
  null::numeric as expected_quantity,
  sm.quantity::numeric as observed_quantity,
  jsonb_build_object(
    'reason', 'purchase_movement_source_or_lot_invalid',
    'source_id', sm.source_id,
    'source_id_bigint', sm.source_id_bigint,
    'lot_id', sm.lot_id,
    'lot_exists_by_lot_id', (l_by_lot.id is not null),
    'lot_exists_by_source_id', (l_by_source.id is not null)
  ) as details
from stock_movements_enriched sm
left join public.lots l_by_lot
  on l_by_lot.id = sm.lot_id
left join public.lots l_by_source
  on l_by_source.id = sm.source_id_bigint
where sm.source_type = 'PURCHASE'
  and (
    sm.lot_id is null
    or l_by_lot.id is null
    or sm.source_id_trimmed is null
    or sm.source_id_bigint is null
    or l_by_source.id is null
    or sm.lot_id is distinct from l_by_source.id
  )

union all

select
  1::smallint as contract_version,
  'ORPHAN_SALE_MOVEMENT'::text as anomaly_code,
  'ORPHAN_MOVEMENT'::text as anomaly_family,
  'ERROR'::text as severity,
  'stock_movements'::text as entity_table,
  sm.id::text as entity_id,
  null::bigint as sale_id,
  sm.source_id_bigint as sale_item_id,
  sm.lot_id as lot_id,
  sm.id as movement_id,
  sm.piece_ref as piece_ref,
  null::numeric as expected_quantity,
  sm.quantity::numeric as observed_quantity,
  jsonb_build_object(
    'reason', 'sale_movement_source_id_not_found_in_sale_items',
    'source_id', sm.source_id
  ) as details
from stock_movements_enriched sm
left join public.sale_items si
  on si.id = sm.source_id_bigint
where sm.source_type = 'SALE'
  and (
    sm.source_id_trimmed is null
    or sm.source_id_bigint is null
    or si.id is null
  )

union all

select
  1::smallint as contract_version,
  'ORPHAN_SALE_CANCEL_MOVEMENT'::text as anomaly_code,
  'ORPHAN_MOVEMENT'::text as anomaly_family,
  'ERROR'::text as severity,
  'stock_movements'::text as entity_table,
  sm.id::text as entity_id,
  null::bigint as sale_id,
  sm.source_id_bigint as sale_item_id,
  sm.lot_id as lot_id,
  sm.id as movement_id,
  sm.piece_ref as piece_ref,
  null::numeric as expected_quantity,
  sm.quantity::numeric as observed_quantity,
  jsonb_build_object(
    'reason', 'sale_cancel_movement_source_id_not_found_in_sale_items',
    'source_id', sm.source_id
  ) as details
from stock_movements_enriched sm
left join public.sale_items si
  on si.id = sm.source_id_bigint
where sm.source_type = 'SALE_CANCEL'
  and (
    sm.source_id_trimmed is null
    or sm.source_id_bigint is null
    or si.id is null
  )

union all

select
  1::smallint as contract_version,
  'ORPHAN_SALE_EDIT_MOVEMENT'::text as anomaly_code,
  'ORPHAN_MOVEMENT'::text as anomaly_family,
  'ERROR'::text as severity,
  'stock_movements'::text as entity_table,
  sm.id::text as entity_id,
  sm.source_id_bigint as sale_id,
  null::bigint as sale_item_id,
  sm.lot_id as lot_id,
  sm.id as movement_id,
  sm.piece_ref as piece_ref,
  null::numeric as expected_quantity,
  sm.quantity::numeric as observed_quantity,
  jsonb_build_object(
    'reason', 'sale_edit_movement_source_id_not_found_in_sales',
    'source_id', sm.source_id
  ) as details
from stock_movements_enriched sm
left join public.sales s
  on s.id = sm.source_id_bigint
where sm.source_type = 'SALE_EDIT'
  and (
    sm.source_id_trimmed is null
    or sm.source_id_bigint is null
    or s.id is null
  )

union all

select
  1::smallint as contract_version,
  'LOT_TOTAL_PIECES_MISMATCH'::text as anomaly_code,
  'INVENTORY_INCONSISTENCY'::text as anomaly_family,
  'ERROR'::text as severity,
  'lots'::text as entity_table,
  l.id::text as entity_id,
  null::bigint as sale_id,
  null::bigint as sale_item_id,
  l.id as lot_id,
  null::bigint as movement_id,
  null::text as piece_ref,
  l.total_pieces::numeric as expected_quantity,
  coalesce(sum(i.quantity), 0)::numeric as observed_quantity,
  jsonb_build_object(
    'reason', 'lots_total_pieces_differs_from_inventory_sum',
    'lot_code', l.lot_code,
    'lot_status', l.status
  ) as details
from public.lots l
left join public.inventory i
  on i.lot_id = l.id
group by
  l.id,
  l.lot_code,
  l.status,
  l.total_pieces
having l.total_pieces::numeric <> coalesce(sum(i.quantity), 0)::numeric

union all

select
  1::smallint as contract_version,
  'CONFIRMED_LOT_PURCHASE_INVENTORY_QTY_MISMATCH'::text as anomaly_code,
  'INVENTORY_INCONSISTENCY'::text as anomaly_family,
  'ERROR'::text as severity,
  'inventory'::text as entity_table,
  format(
    '%s|%s',
    coalesce(e.lot_id, o.lot_id)::text,
    coalesce(e.piece_ref, o.piece_ref)
  )::text as entity_id,
  null::bigint as sale_id,
  null::bigint as sale_item_id,
  coalesce(e.lot_id, o.lot_id) as lot_id,
  null::bigint as movement_id,
  coalesce(e.piece_ref, o.piece_ref) as piece_ref,
  coalesce(e.expected_quantity, 0::numeric) as expected_quantity,
  coalesce(o.observed_quantity, 0::numeric) as observed_quantity,
  jsonb_build_object(
    'reason', 'confirmed_lot_inventory_vs_purchase_in_mismatch',
    'lot_status', 'confirmed'
  ) as details
from expected_confirmed_inventory e
full join observed_confirmed_purchase o
  on e.lot_id = o.lot_id
 and e.piece_ref = o.piece_ref
where coalesce(e.expected_quantity, 0::numeric) <> coalesce(o.observed_quantity, 0::numeric)

union all

select
  1::smallint as contract_version,
  'NEGATIVE_STOCK_BALANCE_ROW'::text as anomaly_code,
  'NEGATIVE_STOCK'::text as anomaly_family,
  'ERROR'::text as severity,
  'stock_balance'::text as entity_table,
  format('%s|%s', sb.piece_ref, sb.lot_id)::text as entity_id,
  null::bigint as sale_id,
  null::bigint as sale_item_id,
  sb.lot_id as lot_id,
  null::bigint as movement_id,
  sb.piece_ref as piece_ref,
  0::numeric as expected_quantity,
  sb.quantity::numeric as observed_quantity,
  jsonb_build_object(
    'reason', 'stock_balance_quantity_is_negative'
  ) as details
from public.stock_balance sb
where sb.quantity < 0;

comment on view public.healthcheck_business_anomalies_v1 is
  'F1.5 business healthcheck view (contract v1). Non-blocking audit of data anomalies.';

grant select on public.healthcheck_business_anomalies_v1 to anon;
grant select on public.healthcheck_business_anomalies_v1 to authenticated;
grant select on public.healthcheck_business_anomalies_v1 to service_role;

commit;
