-- F6.4 - Attribution utilisateur des tickets report
-- Scope:
--  - enrichir public.report_tickets avec les champs d'attribution
--  - conserver compatibilite avec les tickets legacy (colonnes nullables)

begin;

alter table if exists public.report_tickets
  add column if not exists created_by_user_id uuid null,
  add column if not exists created_by_email text null,
  add column if not exists created_by_display_name text null,
  add column if not exists closed_by_user_id uuid null,
  add column if not exists closed_by_email text null,
  add column if not exists closed_by_display_name text null;

commit;
