begin;

create index if not exists sale_item_pieces_lot_id_idx
  on public.sale_item_pieces (lot_id);

drop function if exists public.finalize_lot0_confirmation_reprice(bigint);

create or replace function public.finalize_lot0_confirmation_reprice(
  p_lot_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lot_code text;
  v_status text;
  v_total_cost numeric(12,2);
  v_total_pieces integer;
  v_unit_cost numeric(12,4);
  v_sale_items_updated integer := 0;
  v_sales_updated integer := 0;
begin
  if p_lot_id is null or p_lot_id <= 0 then
    raise exception using
      message = 'Lot invalide pour recalcul LOT_0.',
      detail = format('p_lot_id=%s', coalesce(p_lot_id::text, '<null>'));
  end if;

  select
    l.lot_code,
    l.status,
    l.total_cost,
    l.total_pieces
  into
    v_lot_code,
    v_status,
    v_total_cost,
    v_total_pieces
  from public.lots l
  where l.id = p_lot_id
  for update;

  if not found then
    raise exception using
      message = 'Lot introuvable pour recalcul LOT_0.',
      detail = format('lot_id=%s', p_lot_id);
  end if;

  if coalesce(v_lot_code, '') <> 'LOT_0' then
    raise exception using
      message = 'Recalcul reserve au lot initial LOT_0.',
      detail = format('lot_id=%s lot_code=%s', p_lot_id, coalesce(v_lot_code, '<null>'));
  end if;

  if coalesce(v_status, '') <> 'confirmed' then
    raise exception using
      message = 'LOT_0 doit etre confirme avant recalcul.',
      detail = format('lot_id=%s status=%s', p_lot_id, coalesce(v_status, '<null>'));
  end if;

  if coalesce(v_total_pieces, 0) <= 0 then
    raise exception using
      message = 'LOT_0 confirme sans pieces: recalcul impossible.',
      detail = format('lot_id=%s total_pieces=%s', p_lot_id, coalesce(v_total_pieces::text, '<null>'));
  end if;

  v_unit_cost := round(
    coalesce(v_total_cost, 0)::numeric / v_total_pieces::numeric,
    4
  );

  if v_unit_cost < 0 then
    v_unit_cost := 0;
  end if;

  update public.inventory i
  set unit_cost = v_unit_cost
  where i.lot_id = p_lot_id
    and i.quantity > 0;

  update public.stock_movements sm
  set unit_cost = v_unit_cost
  where sm.lot_id = p_lot_id
    and sm.unit_cost is distinct from v_unit_cost;

  update public.sale_item_pieces sip
  set unit_cost = v_unit_cost
  where sip.lot_id = p_lot_id
    and sip.unit_cost is distinct from v_unit_cost;

  with impacted_sale_items as (
    select distinct sip.sale_item_id
    from public.sale_item_pieces sip
    where sip.lot_id = p_lot_id
  ),
  recomputed_sale_items as (
    select
      si.id as sale_item_id,
      coalesce(
        sum((coalesce(sip.quantity, 0)::numeric) * coalesce(sip.unit_cost, 0)),
        0
      )::numeric(12,4) as cost_amount,
      case
        when si.net_amount is null or si.net_amount <= 0 then null
        else (
          si.net_amount - coalesce(
            sum((coalesce(sip.quantity, 0)::numeric) * coalesce(sip.unit_cost, 0)),
            0
          )
        )::numeric(12,4)
      end as margin_amount
    from impacted_sale_items isi
    join public.sale_items si
      on si.id = isi.sale_item_id
    left join public.sale_item_pieces sip
      on sip.sale_item_id = si.id
    group by
      si.id,
      si.net_amount
  )
  update public.sale_items si
  set
    cost_amount = rsi.cost_amount,
    margin_amount = rsi.margin_amount
  from recomputed_sale_items rsi
  where si.id = rsi.sale_item_id;

  get diagnostics v_sale_items_updated = row_count;

  with impacted_sales as (
    select distinct si.sale_id
    from public.sale_items si
    join public.sale_item_pieces sip
      on sip.sale_item_id = si.id
    where sip.lot_id = p_lot_id
  ),
  recomputed_sales as (
    select
      s.id as sale_id,
      coalesce(sum(coalesce(si.cost_amount, 0)), 0)::numeric(12,4) as total_cost_amount
    from impacted_sales isales
    join public.sales s
      on s.id = isales.sale_id
    left join public.sale_items si
      on si.sale_id = s.id
    group by s.id
  )
  update public.sales s
  set
    total_cost_amount = rs.total_cost_amount,
    total_margin_amount = (
      coalesce(s.net_seller_amount, 0) - rs.total_cost_amount
    )::numeric(12,4),
    margin_rate = case
      when coalesce(s.net_seller_amount, 0) > 0 then (
        (coalesce(s.net_seller_amount, 0) - rs.total_cost_amount)
        / s.net_seller_amount
      )::numeric(4,3)
      else null
    end
  from recomputed_sales rs
  where s.id = rs.sale_id;

  get diagnostics v_sales_updated = row_count;

  return jsonb_build_object(
    'lot_id', p_lot_id,
    'lot_code', v_lot_code,
    'unit_cost', v_unit_cost,
    'sale_items_updated', v_sale_items_updated,
    'sales_updated', v_sales_updated
  );
end;
$$;

revoke all on function public.finalize_lot0_confirmation_reprice(bigint)
  from public;
grant all on function public.finalize_lot0_confirmation_reprice(bigint)
  to anon;
grant all on function public.finalize_lot0_confirmation_reprice(bigint)
  to authenticated;
grant all on function public.finalize_lot0_confirmation_reprice(bigint)
  to service_role;

commit;
