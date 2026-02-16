-- F1.4: Anti-doublons de mouvements + indexes perf
-- Scope strict:
--  - Bloquer les doubles insertions accidentelles sur PURCHASE/SALE/SALE_CANCEL
--  - Optimiser le lookup source sans redondance d'indexes
--  - Conserver le modele ledger existant et F1.3 intact

begin;

-- 1) Fail-fast explicite si des lignes coeur n'ont pas de source_id exploitable.
do $$
declare
  v_missing_source_id_count bigint;
begin
  select count(*)
  into v_missing_source_id_count
  from public.stock_movements sm
  where sm.source_type in ('PURCHASE', 'SALE', 'SALE_CANCEL')
    and (sm.source_id is null or btrim(sm.source_id) = '');

  if v_missing_source_id_count > 0 then
    raise exception
      using
        errcode = '23514',
        message = format(
          'F1.4 abort: %s mouvement(s) coeur sans source_id exploitable.',
          v_missing_source_id_count
        ),
        hint = 'Renseigner source_id (non vide) pour PURCHASE/SALE/SALE_CANCEL avant application de F1.4.';
  end if;
end
$$;

-- 2) Fail-fast explicite si doublons deja presents sur la cle metier cible.
do $$
declare
  v_duplicate_group_count bigint;
begin
  select count(*)
  into v_duplicate_group_count
  from (
    select
      sm.source_type,
      sm.source_id,
      sm.piece_ref,
      sm.lot_id,
      sm.direction
    from public.stock_movements sm
    where sm.source_type in ('PURCHASE', 'SALE', 'SALE_CANCEL')
      and sm.direction in ('IN', 'OUT')
    group by
      sm.source_type,
      sm.source_id,
      sm.piece_ref,
      sm.lot_id,
      sm.direction
    having count(*) > 1
  ) d;

  if v_duplicate_group_count > 0 then
    raise exception
      using
        errcode = '23505',
        message = format(
          'F1.4 abort: %s groupe(s) de doublons detecte(s) sur stock_movements.',
          v_duplicate_group_count
        ),
        hint = 'Dedupliquer manuellement les mouvements concernes avant de relancer la migration F1.4.';
  end if;
end
$$;

-- 3) Contrainte coeur: source_id obligatoire pour les flux critiques.
alter table public.stock_movements
  add constraint ck_stock_movements_source_id_required_core
  check (
    source_type not in ('PURCHASE', 'SALE', 'SALE_CANCEL')
    or nullif(btrim(source_id), '') is not null
  );

-- 4) Unicite metier stricte pour bloquer les doubles insertions accidentelles.
create unique index ux_stock_movements_no_duplicate_core
  on public.stock_movements (source_type, source_id, piece_ref, lot_id, direction)
  where source_type in ('PURCHASE', 'SALE', 'SALE_CANCEL')
    and direction in ('IN', 'OUT');

-- 5) Index lookup source optimise (avec direction).
create index idx_stock_movements_source_id_direction
  on public.stock_movements (source_type, source_id, direction);

-- 6) Nettoyage des redondances strictes source.
drop index if exists public.idx_stock_movements_source;
drop index if exists public.stock_movements_source_type_id_idx;

commit;
