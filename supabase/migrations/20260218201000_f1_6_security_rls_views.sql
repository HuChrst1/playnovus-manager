-- F1.6 - Security hardening compatible with current anon/authenticated flows.
-- Goals:
-- 1) remove linter errors on SECURITY DEFINER views
-- 2) enable RLS on exposed public tables
-- 3) keep app behavior unchanged (compat policies)
-- 4) reduce overly broad grants on target objects

begin;

-- 1) Views: enforce invoker security so caller permissions/RLS are applied.
alter view public.set_completion set (security_invoker = true);
alter view public.stock_per_piece set (security_invoker = true);
alter view public.sold_pieces_journal set (security_invoker = true);
alter view public.piece_movements set (security_invoker = true);
alter view public.set_with_completion set (security_invoker = true);
alter view public.sale_item_movements set (security_invoker = true);
alter view public.stock_journal set (security_invoker = true);

-- 2) RLS activation on public tables flagged by Supabase linter.
alter table public.lots enable row level security;
alter table public.inventory enable row level security;
alter table public.sets_bom enable row level security;
alter table public.sets_catalog enable row level security;
alter table public.transactions enable row level security;
alter table public.stock_balance enable row level security;
alter table public.sale_items enable row level security;
alter table public.sales enable row level security;
alter table public.stock_movements enable row level security;
alter table public.sale_item_pieces enable row level security;

-- 3) Compatibility policies: preserve current behavior without user auth rollout.
drop policy if exists p_lots_compat_all on public.lots;
create policy p_lots_compat_all
  on public.lots
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists p_inventory_compat_all on public.inventory;
create policy p_inventory_compat_all
  on public.inventory
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists p_sets_bom_compat_all on public.sets_bom;
create policy p_sets_bom_compat_all
  on public.sets_bom
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists p_sets_catalog_compat_all on public.sets_catalog;
create policy p_sets_catalog_compat_all
  on public.sets_catalog
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists p_transactions_compat_all on public.transactions;
create policy p_transactions_compat_all
  on public.transactions
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists p_stock_balance_compat_all on public.stock_balance;
create policy p_stock_balance_compat_all
  on public.stock_balance
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists p_sale_items_compat_all on public.sale_items;
create policy p_sale_items_compat_all
  on public.sale_items
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists p_sales_compat_all on public.sales;
create policy p_sales_compat_all
  on public.sales
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists p_stock_movements_compat_all on public.stock_movements;
create policy p_stock_movements_compat_all
  on public.stock_movements
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists p_sale_item_pieces_compat_all on public.sale_item_pieces;
create policy p_sale_item_pieces_compat_all
  on public.sale_item_pieces
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- 4) Privileges cleanup (targeted objects only):
--    - views: read only for anon/authenticated
--    - tables: CRUD only for anon/authenticated
--    service_role unchanged.

revoke all on table public.set_completion from anon, authenticated;
revoke all on table public.stock_per_piece from anon, authenticated;
revoke all on table public.sold_pieces_journal from anon, authenticated;
revoke all on table public.piece_movements from anon, authenticated;
revoke all on table public.set_with_completion from anon, authenticated;
revoke all on table public.sale_item_movements from anon, authenticated;
revoke all on table public.stock_journal from anon, authenticated;

grant select on table public.set_completion to anon, authenticated;
grant select on table public.stock_per_piece to anon, authenticated;
grant select on table public.sold_pieces_journal to anon, authenticated;
grant select on table public.piece_movements to anon, authenticated;
grant select on table public.set_with_completion to anon, authenticated;
grant select on table public.sale_item_movements to anon, authenticated;
grant select on table public.stock_journal to anon, authenticated;

revoke all on table public.lots from anon, authenticated;
revoke all on table public.inventory from anon, authenticated;
revoke all on table public.sets_bom from anon, authenticated;
revoke all on table public.sets_catalog from anon, authenticated;
revoke all on table public.transactions from anon, authenticated;
revoke all on table public.stock_balance from anon, authenticated;
revoke all on table public.sale_items from anon, authenticated;
revoke all on table public.sales from anon, authenticated;
revoke all on table public.stock_movements from anon, authenticated;
revoke all on table public.sale_item_pieces from anon, authenticated;

grant select, insert, update, delete on table public.lots to anon, authenticated;
grant select, insert, update, delete on table public.inventory to anon, authenticated;
grant select, insert, update, delete on table public.sets_bom to anon, authenticated;
grant select, insert, update, delete on table public.sets_catalog to anon, authenticated;
grant select, insert, update, delete on table public.transactions to anon, authenticated;
grant select, insert, update, delete on table public.stock_balance to anon, authenticated;
grant select, insert, update, delete on table public.sale_items to anon, authenticated;
grant select, insert, update, delete on table public.sales to anon, authenticated;
grant select, insert, update, delete on table public.stock_movements to anon, authenticated;
grant select, insert, update, delete on table public.sale_item_pieces to anon, authenticated;

commit;
