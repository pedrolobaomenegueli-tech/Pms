-- Fluxo da estadia: aguardando check-in -> hospedado -> em limpeza -> finalizado
--   checked_in_at     preenchido = hóspede fez check-in
--   checked_out_at    preenchido = hóspede saiu; o quarto entra em limpeza
--   cleaning_done_at  preenchido = limpeza finalizada (estadia finalizada)
-- A sincronização iCal nunca altera esses campos.

alter table public.reservations
  add column checked_in_at  timestamptz,
  add column checked_out_at timestamptz;

-- Aproveita marcações antigas de limpeza, se houver
update public.reservations
   set checked_out_at = coalesce(cleaning_started_at, cleaning_done_at),
       checked_in_at  = coalesce(cleaning_started_at, cleaning_done_at)
 where cleaning_started_at is not null or cleaning_done_at is not null;

-- "Em limpeza" agora é: checked_out_at preenchido e cleaning_done_at vazio
alter table public.reservations drop column cleaning_started_at;
