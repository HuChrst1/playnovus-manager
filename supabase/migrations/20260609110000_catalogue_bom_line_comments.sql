alter table public.sets_bom
  add column line_comment text;

alter table public.sets_bom
  add constraint sets_bom_line_comment_length_check
  check (
    line_comment is null
    or char_length(line_comment) <= 240
  );
