-- F1.3: Bloquer le stock negatif au niveau DB
-- Scope strict:
--  - Interdire stock_balance.quantity < 0
--  - Interdire les mouvements IN/OUT sans lot_id
--  - Lever un message SQL explicite en cas de tentative menant au negatif

begin;

-- 1) Fail-fast si des donnees existantes violent deja les invariants cibles.
do $$
begin
  if exists (
    select 1
    from public.stock_balance
    where quantity < 0
  ) then
    raise exception
      using
        errcode = '23514',
        message = 'F1.3 abort: stock_balance contient deja des quantites negatives.',
        hint = 'Corriger les lignes negatives avant d''appliquer la migration F1.3.';
  end if;

  if exists (
    select 1
    from public.stock_movements
    where direction in ('IN', 'OUT')
      and lot_id is null
  ) then
    raise exception
      using
        errcode = '23514',
        message = 'F1.3 abort: stock_movements contient des IN/OUT sans lot_id.',
        hint = 'Renseigner lot_id pour tous les mouvements IN/OUT avant d''appliquer la migration F1.3.';
  end if;
end
$$;

-- 2) Contrainte structurelle: impossible d'avoir un stock negatif persiste.
alter table public.stock_balance
  add constraint ck_stock_balance_qty_nonneg
  check (quantity >= 0);

-- 3) Helper robuste: applique un delta et bloque tout resultat negatif.
create or replace function public.apply_stock_balance_delta(
  p_piece_ref text,
  p_lot_id bigint,
  p_delta bigint
)
returns void
language plpgsql
as $$
declare
  v_has_row boolean := false;
  v_current_qty bigint := 0;
  v_next_qty bigint := 0;
begin
  if p_delta = 0 then
    return;
  end if;

  select sb.quantity
  into v_current_qty
  from public.stock_balance sb
  where sb.piece_ref = p_piece_ref
    and sb.lot_id = p_lot_id
  for update;

  v_has_row := found;

  if not v_has_row then
    v_current_qty := 0;
  end if;

  v_next_qty := v_current_qty + p_delta;

  if v_next_qty < 0 then
    raise exception
      using
        errcode = '23514',
        message = format(
          'Stock negatif interdit (piece_ref=%s, lot_id=%s, quantity=%s). Mouvement refuse.',
          coalesce(p_piece_ref, '<null>'),
          coalesce(p_lot_id::text, '<null>'),
          v_next_qty::text
        ),
        hint = 'Verifier le stock disponible pour ce couple piece_ref/lot_id avant insertion OUT.';
  end if;

  if not v_has_row then
    if v_next_qty > 0 then
      insert into public.stock_balance (piece_ref, lot_id, quantity)
      values (p_piece_ref, p_lot_id, v_next_qty);
    end if;
    return;
  end if;

  if v_next_qty = 0 then
    delete from public.stock_balance
    where piece_ref = p_piece_ref
      and lot_id = p_lot_id;
    return;
  end if;

  update public.stock_balance
  set quantity = v_next_qty
  where piece_ref = p_piece_ref
    and lot_id = p_lot_id;
end
$$;

-- 4) Remplacement de la fonction trigger baseline pour eviter tout insert de delta negatif.
create or replace function public.apply_stock_balance_from_movements()
returns trigger
language plpgsql
as $$
declare
  r record;
begin
  if tg_op = 'INSERT' then
    for r in
      select
        piece_ref,
        lot_id,
        sum(case when direction = 'IN' then quantity else -quantity end)::bigint as delta
      from new_table
      where piece_ref is not null
        and lot_id is not null
        and direction in ('IN', 'OUT')
      group by piece_ref, lot_id
    loop
      perform public.apply_stock_balance_delta(r.piece_ref, r.lot_id, r.delta);
    end loop;
    return null;

  elsif tg_op = 'DELETE' then
    for r in
      select
        piece_ref,
        lot_id,
        -sum(case when direction = 'IN' then quantity else -quantity end)::bigint as delta
      from old_table
      where piece_ref is not null
        and lot_id is not null
        and direction in ('IN', 'OUT')
      group by piece_ref, lot_id
    loop
      perform public.apply_stock_balance_delta(r.piece_ref, r.lot_id, r.delta);
    end loop;
    return null;

  elsif tg_op = 'UPDATE' then
    for r in
      with old_agg as (
        select
          piece_ref,
          lot_id,
          sum(case when direction = 'IN' then quantity else -quantity end)::bigint as delta
        from old_table
        where piece_ref is not null
          and lot_id is not null
          and direction in ('IN', 'OUT')
        group by piece_ref, lot_id
      ),
      new_agg as (
        select
          piece_ref,
          lot_id,
          sum(case when direction = 'IN' then quantity else -quantity end)::bigint as delta
        from new_table
        where piece_ref is not null
          and lot_id is not null
          and direction in ('IN', 'OUT')
        group by piece_ref, lot_id
      ),
      diff as (
        select
          coalesce(n.piece_ref, o.piece_ref) as piece_ref,
          coalesce(n.lot_id, o.lot_id) as lot_id,
          coalesce(n.delta, 0) - coalesce(o.delta, 0) as delta
        from new_agg n
        full join old_agg o using (piece_ref, lot_id)
        where (coalesce(n.delta, 0) - coalesce(o.delta, 0)) <> 0
      )
      select piece_ref, lot_id, delta
      from diff
    loop
      perform public.apply_stock_balance_delta(r.piece_ref, r.lot_id, r.delta);
    end loop;
    return null;
  end if;

  return null;
end
$$;

-- 5) Erreur explicite metier en cas de tentative de passage sous zero.
create or replace function public.reject_negative_stock_balance()
returns trigger
language plpgsql
as $$
declare
  v_existing_qty bigint;
  v_result_qty bigint;
begin
  if tg_op = 'INSERT' then
    select sb.quantity
    into v_existing_qty
    from public.stock_balance sb
    where sb.piece_ref = new.piece_ref
      and sb.lot_id = new.lot_id;

    v_result_qty := coalesce(v_existing_qty, 0) + coalesce(new.quantity, 0);
  else
    v_result_qty := coalesce(new.quantity, 0);
  end if;

  if v_result_qty < 0 then
    raise exception
      using
        errcode = '23514',
        message = format(
          'Stock negatif interdit (piece_ref=%s, lot_id=%s, quantity=%s). Mouvement refuse.',
          coalesce(new.piece_ref, '<null>'),
          coalesce(new.lot_id::text, '<null>'),
          v_result_qty::text
        ),
        hint = 'Verifier le stock disponible pour ce couple piece_ref/lot_id avant insertion OUT.';
  end if;

  return new;
end
$$;

-- 6) Trigger BEFORE pour rejeter atomiquement avant persistance.
drop trigger if exists trg_reject_negative_stock_balance on public.stock_balance;

create trigger trg_reject_negative_stock_balance
before insert or update on public.stock_balance
for each row
execute function public.reject_negative_stock_balance();

-- 7) Contrainte structurelle: tout IN/OUT doit etre rattache a un lot (FIFO lot-scoped).
alter table public.stock_movements
  add constraint ck_stock_movements_lot_required_inout
  check (
    direction not in ('IN', 'OUT')
    or lot_id is not null
  );

-- 8) Grants explicites pour execution via roles applicatifs.
grant all on function public.apply_stock_balance_delta(text, bigint, bigint) to anon;
grant all on function public.apply_stock_balance_delta(text, bigint, bigint) to authenticated;
grant all on function public.apply_stock_balance_delta(text, bigint, bigint) to service_role;

grant all on function public.reject_negative_stock_balance() to anon;
grant all on function public.reject_negative_stock_balance() to authenticated;
grant all on function public.reject_negative_stock_balance() to service_role;

commit;
