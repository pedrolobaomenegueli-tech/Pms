# PMS Temporada

Sistema de gestão de reservas para aluguel por temporada (Airbnb + Booking.com), sincronizado por iCal.
Um único usuário. Next.js 16 (App Router) + TypeScript + Tailwind, Supabase (Postgres + Auth), hospedagem na Vercel.

**Módulos:** início com estado dos quartos e alertas, calendário, reservas, limpeza com checklist e link para a equipe, manutenção, propriedades/quartos/feeds iCal.

---

## Passo a passo de instalação

### 1. Criar o projeto no Supabase

1. Acesse <https://supabase.com/dashboard> e clique em **New project**.
2. Região: **South America (São Paulo)**. Guarde a senha do banco.
3. Aguarde o projeto ficar pronto.

### 2. Rodar as migrações

Opção A (mais simples, pelo painel):

1. No Supabase, abra **SQL Editor** > **New query**.
2. Rode, **um de cada vez e nesta ordem**, o conteúdo de cada arquivo de `supabase/migrations/` (cole e clique em **Run**):
   1. `20261125000001_schema.sql`
   2. `20261126000001_checkin_checkout.sql`
   3. `20261127000001_checklists_cleanings.sql`
   4. `20261127000002_maintenance.sql`

Opção B (Supabase CLI):

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

### 3. Bloquear cadastros e criar o seu usuário

1. **Authentication** > **Sign In / Providers**: desative **Allow new users to sign up**.
   Isso é importante: as políticas RLS liberam acesso para qualquer usuário autenticado, então o único usuário precisa ser você.
2. Ainda em **Email**, deixe o provedor de e-mail habilitado.
3. **Authentication** > **Users** > **Add user** > **Create new user**: informe seu e-mail e senha e marque **Auto Confirm User**.

### 4. Copiar as chaves

Em **Project Settings** > **API Keys** (e **Data API** para a URL):

| Variável | Onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave `anon` (legada) ou a **publishable key** (`sb_publishable_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` (legada) ou a **secret key** (`sb_secret_...`). **Nunca** exponha. |

Gere também o segredo do sync:

```bash
openssl rand -hex 32
```

### 5. Deploy na Vercel

1. Suba este repositório no GitHub (já está).
2. Em <https://vercel.com/new>, importe o repositório. Framework: Next.js (detectado sozinho).
3. Em **Environment Variables**, cadastre as 5 variáveis (modelo em `.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SYNC_SECRET`, `APP_URL`.
   No primeiro deploy, se ainda não souber o domínio, use `https://NOME-DO-PROJETO.vercel.app`.
4. Clique em **Deploy**.
5. Confirme o domínio final em **Settings** > **Domains**. Se `APP_URL` estiver diferente, corrija e faça **Redeploy**
   (os links de exportação iCal usam essa variável).
6. Abra o app, faça login com o usuário criado no passo 3.

### 6. Cadastrar propriedades e quartos

Em **Quartos**:

1. Crie as 4 propriedades.
2. Dentro de cada propriedade, adicione os quartos (pode adicionar mais depois).
3. Clique em **Editar** na propriedade para montar o **checklist de limpeza** (modelo) e ajustar o **horário padrão de check-in**.
4. Abra cada quarto para colar os feeds iCal (passo 7) e, se quiser, adicionar itens extras ao checklist.

### 7. Conectar Airbnb e Booking (iCal)

Cada quarto tem **dois sentidos** de sincronização com cada plataforma:

- **Importar** (plataforma → PMS): você copia o link de exportação da plataforma e cola no PMS.
- **Exportar** (PMS → plataforma): você copia o link do PMS e cola na plataforma.

Os nomes dos menus abaixo podem mudar conforme a plataforma atualiza o painel.

**Airbnb** (por anúncio):

1. **Agenda/Calendário** > escolha o anúncio > **Disponibilidade** > **Conectar calendários** (ou **Sincronizar calendários**).
2. **Exportar calendário**: copie o link `.ics` do Airbnb. No PMS, em **Quartos** > quarto > **Adicionar feed**, escolha *Airbnb* e cole.
3. **Importar calendário**: no PMS, copie o link **"Para o Airbnb"** (termina em `/airbnb.ics`) e cole no Airbnb. Nome sugerido: "PMS".

**Booking.com** (Extranet, por acomodação):

1. **Tarifas e disponibilidade** > **Sincronizar calendários** > selecione a acomodação.
2. **Exportar calendário**: copie o link do Booking. No PMS, **Adicionar feed** > *Booking.com* > cole.
3. **Importar calendário** / **Adicionar conexão de calendário**: cole o link **"Para o Booking.com"** do PMS (termina em `/booking.ics`).

Ao salvar um feed, o PMS sincroniza na hora e mostra se deu certo.

### 8. Ativar a sincronização automática (a cada 15 minutos)

O cron da Vercel no plano Hobby não roda a cada 15 min, então usamos `pg_cron` + `pg_net` no Supabase.

1. Abra `supabase/cron.sql`.
2. Troque `<APP_URL>` pela URL do app (sem barra no final) e `<SYNC_SECRET>` pelo mesmo segredo da Vercel.
3. Cole no **SQL Editor** do Supabase e rode.
4. Depois de 15 minutos, confira:

```sql
select * from cron.job_run_details order by start_time desc limit 5;
select status_code, content from net._http_response order by created desc limit 5;
```

`status_code = 200` significa que a rota respondeu. O conteúdo traz o resumo (`ok`, `erro`, `alerta`).

Teste manual da rota:

```bash
curl -X POST https://SEU-APP.vercel.app/api/sync -H "Authorization: Bearer SEU_SYNC_SECRET"
```

---

## Regras de negócio

**Importação**

- Upsert por `(feed_id, external_uid)`.
- Airbnb: `SUMMARY` "Reserved" = reserva; contendo "Not available" = bloqueio. Booking: tudo entra como reserva (o iCal do Booking não diferencia).
- A sincronização atualiza só datas, tipo e dados originais (SUMMARY/DESCRIPTION). **Nome do hóspede, nº de hóspedes, observações e limpeza nunca são sobrescritos.**
- Evento que sumiu do feed vira **cancelado** (não é apagado), mas **só se ainda não terminou**: os feeds removem reservas antigas com o tempo e isso não é cancelamento.
- Se o evento reaparecer, a reserva volta a ficar ativa.
- Feed com erro (HTTP, tempo esgotado, resposta que não é iCal): o erro é salvo, aparece aviso na tela inicial e **nada é cancelado**.
- Feed válido mas vazio, quando havia reservas futuras: status **alerta**, nada é cancelado.
- Horários com fuso são convertidos para a data em America/Sao_Paulo.

**Exportação**

- `/api/ical/[token]/airbnb.ics` e `/api/ical/[token]/booking.ics`.
- Inclui reservas e bloqueios ativos com check-out a partir de 30 dias atrás, **exceto** os originados no canal de destino e os ecos.
- Eventos de dia inteiro, `DTEND` = check-out (exclusivo), `SUMMARY` = "Reservado", sem nome do hóspede.
- O token é secreto. Se vazar, use **Gerar novos links** na tela do quarto e recole nas plataformas.

**Eco e conflitos**

- **Eco**: evento importado com check-in e check-out **idênticos** a outro evento ativo de outra origem e "mais forte" (reserva manual/Airbnb > evento do Booking > bloqueio). Ex.: reserva do Booking exportada ao Airbnb volta como "Not available". Ecos ficam ocultos no calendário, não contam como conflito e não são exportados.
- **Conflito (overbooking)**: duas **reservas** ativas, não-eco, que se sobrepõem no mesmo quarto. Check-out e check-in no mesmo dia não é conflito. Bloqueios não geram conflito.
- Ao salvar reserva manual, o sistema impede sobreposição com qualquer reserva ou bloqueio ativo.

**Fluxo da estadia (por reserva)**

Aguardando check-in → *Realizar check-in* → Hospedado → *Realizar check-out* → Em limpeza → *Finalizar limpeza* → Finalizado

- Cada passo grava data e hora e pode ser desfeito (volta uma etapa).
- Se você pular uma etapa (ex.: check-out sem ter marcado check-in), as anteriores são preenchidas junto.
- A sincronização iCal nunca altera esses campos.
- Bloqueios não têm fluxo.

**Estado do quarto (tela inicial)**

Calculado a partir do fluxo das reservas do quarto:

| Estado | Quando |
|---|---|
| Hospedado | há reserva com check-in feito e sem check-out. Avisos: "Sai hoje" ou "Saída atrasada". |
| Em limpeza | check-out feito e limpeza não finalizada |
| Aguardando check-in | reserva em andamento (chegada hoje ou antes) sem check-in. Aviso "Check-in atrasado" se a chegada foi antes de hoje. |
| Bloqueado | bloqueio cobrindo hoje |
| Livre | nenhum dos anteriores |

Quando há chegada hoje e o quarto ainda está "Hospedado" ou "Em limpeza", o cartão mostra ⚡.
Reservas que terminaram há mais de 7 dias com o fluxo aberto são ignoradas na tela inicial.

---

## Limpeza

**Checklist**

- Cada propriedade tem um **modelo** (ex.: trocar roupa de cama, repor amenities, limpar banheiro). Edite em **Quartos** > **Editar** na propriedade: adicionar, remover e reordenar (↑ ↓).
- Cada quarto herda o modelo e pode ter **itens extras** (tela do quarto).

**Execução**

- A limpeza é **criada ao realizar o check-out**, com uma **cópia** do checklist do quarto naquele momento. Mudar o modelo depois não altera limpezas já criadas.
- Em **Limpeza**, toque em **Abrir limpeza**, marque os itens um a um e toque em **Concluída**. Dá para concluir com itens pendentes; a tela mostra quantos ficaram de fora.
- **Concluída** é o mesmo que **Finalizar limpeza** no fluxo da estadia (os dois marcam a estadia como Finalizada). **Reabrir** desfaz.
- Quartos com check-out feito antes desta versão ganham a limpeza quando você a abre.
- Na limpeza, **Registrar problema** cria uma manutenção já vinculada ao quarto.

**Prioridade (lista do dia)**

1. **Urgente · virada**: sai e entra no mesmo dia no mesmo quarto.
2. **Check-in amanhã**.
3. **Saída do dia**.
4. **Pendente de dias anteriores**: check-out feito há até 14 dias e limpeza não concluída.

Concluídas vão para o fim. O horário do próximo check-in é o da reserva (campo **Horário de check-in**, opcional) ou o padrão da propriedade.

**Link da equipe (WhatsApp)**

1. Em **Limpeza**, abra **📲 Enviar para a equipe**.
2. Em cada propriedade, **Copiar mensagem para WhatsApp** copia um texto com a data, a lista resumida e o link. Cole no grupo da equipe.
3. O link abre uma página leve, sem login, com propriedade, quarto, prioridade, horário do próximo check-in e checklist. **Não mostra** nome, telefone, nº de hóspedes, observações nem dados da reserva (LGPD).
4. A página tem botões de dia anterior/próximo. O link é por propriedade: quem tem o link vê qualquer dia daquela propriedade, só para leitura.
5. **Gerar novo link** invalida o anterior na hora (use se o link vazar ou alguém sair da equipe). Também fica em **Quartos** > **Editar** na propriedade.
6. Antes do check-out, a página mostra o checklist previsto; depois, a cópia da limpeza com o que já foi marcado.

## Manutenção

- Menu **Manutenção**: lista com filtros (propriedade, quarto, status, prioridade). Não resolvidas primeiro, por prioridade (urgente, alta, média, baixa).
- Campos: título, descrição, prioridade, status (aberto, em andamento, resolvido), data de abertura, data de resolução (automática), custo e observações.
- **Bloquear quarto**: ao registrar (ou depois, na tela do problema), escolha o período. O sistema cria um **bloqueio manual** que entra na exportação iCal para o Airbnb e o Booking. Se o período cair sobre uma reserva existente, o bloqueio é criado e a tela mostra um aviso.
- Ao resolver um problema com bloqueio ativo, escolha **Resolver e remover bloqueio** ou **Resolver e manter bloqueio**.
- Histórico completo na tela de cada quarto.
- **Alertas na tela inicial**: manutenções urgentes abertas e check-ins entre hoje e daqui a 3 dias em quartos com manutenção alta ou urgente aberta.

## Limitações conhecidas

- **iCal tem atraso**: Airbnb e Booking leem o feed do PMS no ritmo deles (pode levar horas). O PMS detecta overbooking, mas não impede.
- O Booking marca datas fechadas manualmente da mesma forma que reservas. Elas aparecem como reserva e entram na lista de limpeza.
- Bloqueios do Airbnb (inclusive a janela de disponibilidade futura e o tempo de preparação) são exportados para o Booking como datas indisponíveis.

---

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase
npm run dev                  # http://localhost:3000
npm test                     # testes (vitest)
npm run build
```

Estrutura:

```
src/
  app/
    login/                 login por e-mail e senha
    (app)/                 páginas autenticadas
      page.tsx             início: estado dos quartos + alertas
      calendario/          quartos x 30 dias
      reservas/            lista, nova, detalhe/edição
      limpeza/             lista do dia por prioridade, detalhe com checklist, tarefas
      manutencao/          problemas por quarto, bloqueio
      unidades/            propriedades (checklist, link da equipe), quartos, feeds e exportação
    equipe/[token]/        página pública da equipe (sem login)
    api/sync/              POST protegido por SYNC_SECRET
    api/ical/[token]/[file]/  exportação airbnb.ics / booking.ics
  lib/
    ical/                  parser e gerador iCal
    domain/rules.ts        eco, conflitos, exclusão por canal, estado do quarto
    domain/cleaning.ts     checklist, limpeza no check-out, prioridade, visão da equipe
    domain/maintenance.ts  ordenação, bloqueio e alertas de manutenção
    sync/                  plano (puro) e execução da sincronização
    supabase/              clientes (sessão do usuário e service role)
  proxy.ts                 renova a sessão e protege as páginas
supabase/
  migrations/              esquema + RLS
  cron.sql                 agendamento pg_cron (rodar manualmente após o deploy)
tests/                     vitest + exemplos de feed Airbnb/Booking
```
