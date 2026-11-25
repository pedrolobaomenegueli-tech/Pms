-- =============================================================================
-- Dados FICTÍCIOS para o ambiente de TESTES. NUNCA rode em produção.
-- Recusa rodar se o banco já tiver propriedades (proteção contra engano).
-- Rode no SQL Editor do projeto Supabase de testes, depois das migrações.
-- =============================================================================

do $$
declare
  p1 uuid; p2 uuid;
  u11 uuid; u12 uuid; u13 uuid; u21 uuid; u22 uuid;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if exists (select 1 from public.properties) then
    raise exception 'Banco já tem propriedades. Este seed é só para um banco de TESTES vazio.';
  end if;

  insert into public.properties (name, sort_order, checkin_time) values ('Pousada Teste A', 1, '15:00') returning id into p1;
  insert into public.properties (name, sort_order, checkin_time) values ('Casa Teste B', 2, '14:00') returning id into p2;

  insert into public.units (property_id, name, color, sort_order) values (p1, 'Quarto 1', '#0ea5e9', 1) returning id into u11;
  insert into public.units (property_id, name, color, sort_order) values (p1, 'Quarto 2', '#f59e0b', 2) returning id into u12;
  insert into public.units (property_id, name, color, sort_order) values (p1, 'Quarto 3', '#10b981', 3) returning id into u13;
  insert into public.units (property_id, name, color, sort_order) values (p2, 'Suíte', '#8b5cf6', 1) returning id into u21;
  insert into public.units (property_id, name, color, sort_order) values (p2, 'Quarto Família', '#ef4444', 2) returning id into u22;

  insert into public.checklist_items (property_id, label, sort_order)
  select p, l, o from (values
    (p1, 'Trocar roupa de cama', 1), (p1, 'Trocar toalhas', 2), (p1, 'Limpar banheiro', 3),
    (p1, 'Repor amenities', 4), (p1, 'Conferir controle do ar', 5),
    (p2, 'Trocar roupa de cama', 1), (p2, 'Limpar cozinha', 2), (p2, 'Limpar banheiro', 3)
  ) as t(p, l, o);
  insert into public.checklist_items (unit_id, label, sort_order) values (u21, 'Regar plantas da varanda', 1);

  insert into public.reservations (unit_id, source, kind, check_in, check_out, guest_name, guests, checked_in_at) values
    (u11, 'manual', 'reserva', hoje - 2, hoje,     'Hóspede Teste 1', 2, now()),
    (u11, 'manual', 'reserva', hoje,     hoje + 3, 'Hóspede Teste 2', 2, null),
    (u12, 'manual', 'reserva', hoje - 1, hoje + 1, 'Hóspede Teste 3', 1, now()),
    (u13, 'manual', 'bloqueio', hoje + 2, hoje + 5, null, null, null),
    (u21, 'manual', 'reserva', hoje + 1, hoje + 4, 'Hóspede Teste 4', 3, null),
    (u22, 'manual', 'reserva', hoje - 3, hoje,     'Hóspede Teste 5', 4, now());

  insert into public.maintenance_issues (unit_id, title, priority) values
    (u21, 'Chuveiro fraco (teste)', 'alta'),
    (u13, 'Lâmpada queimada (teste)', 'baixa');
end $$;
