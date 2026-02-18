-- F1.7 - Security follow-up: clear remaining linter error + function warnings
-- Scope strict:
--  - Set healthcheck view to security_invoker
--  - Lock function search_path on flagged functions
--  - Keep current RLS compatibility behavior unchanged

begin;

-- 1) Remove remaining security_definer_view error on healthcheck.
alter view public.healthcheck_business_anomalies_v1
  set (security_invoker = true);

-- 2) Remove function_search_path_mutable warnings (trusted schemas only).
alter function public.reset_sales_id_sequence()
  set search_path = pg_catalog, public, pg_temp;

alter function public.apply_stock_balance_from_movements()
  set search_path = pg_catalog, public, pg_temp;

alter function public.apply_stock_balance_delta(text, bigint, bigint)
  set search_path = pg_catalog, public, pg_temp;

alter function public.reject_negative_stock_balance()
  set search_path = pg_catalog, public, pg_temp;

commit;
