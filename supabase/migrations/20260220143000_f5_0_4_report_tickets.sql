-- F5.0.4 - Report tickets internes (sidebar desktop + modale partagée)
-- Scope:
--  - nouvelle table public.report_tickets
--  - contraintes métier statut/categorie/cible
--  - index de lecture tableau
--  - RLS + policy compat anon/authenticated
--  - grants CRUD alignés F1.6

begin;

create table if not exists public.report_tickets (
  id bigserial primary key,
  target_scope text not null,
  category text not null,
  description text not null,
  status text not null default 'OPEN',
  created_at timestamptz not null default now(),
  closed_at timestamptz null,
  constraint report_tickets_status_check
    check (status = any (array['OPEN'::text, 'RESOLVED'::text, 'IGNORED'::text])),
  constraint report_tickets_category_check
    check (category = any (array['BUG'::text, 'FEATURE'::text, 'IMPROVEMENT'::text])),
  constraint report_tickets_target_scope_check
    check (
      target_scope = any (
        array[
          'GLOBAL'::text,
          'HOME'::text,
          'APPROVISIONNEMENT'::text,
          'VENTES'::text,
          'STOCK'::text,
          'CATALOGUE'::text,
          'HISTORIQUE_STOCK'::text
        ]
      )
    ),
  constraint report_tickets_description_not_blank
    check (char_length(btrim(description)) > 0)
);

alter table public.report_tickets owner to postgres;

create index if not exists idx_report_tickets_status_created_at
  on public.report_tickets (status, created_at desc);

create index if not exists idx_report_tickets_target_scope_created_at
  on public.report_tickets (target_scope, created_at desc);

alter table public.report_tickets enable row level security;

drop policy if exists p_report_tickets_compat_all on public.report_tickets;
create policy p_report_tickets_compat_all
  on public.report_tickets
  for all
  to anon, authenticated
  using (true)
  with check (true);

revoke all on table public.report_tickets from anon, authenticated;
grant select, insert, update, delete on table public.report_tickets to anon, authenticated;
grant all on table public.report_tickets to service_role;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'S'
      and n.nspname = 'public'
      and c.relname = 'report_tickets_id_seq'
  ) then
    grant usage, select, update on sequence public.report_tickets_id_seq to anon, authenticated, service_role;
  end if;
end;
$$;

commit;
