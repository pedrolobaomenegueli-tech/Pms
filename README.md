# PMS Temporada

Sistema de gestão de reservas para aluguel por temporada (Airbnb + Booking.com), sincronizado por iCal.
Um único usuário. Next.js 16 (App Router) + TypeScript + Tailwind, Supabase (Postgres + Auth), hospedagem na Vercel.

**Módulos:** início com estado dos quartos, calendário, reservas, limpeza/tarefas, propriedades/quartos/feeds iCal.

---

## Passo a passo de instalação

### 1. Criar o projeto no Supabase

1. Acesse <https://supabase.com/dashboard> e clique em **New project**.
2. Região: **South America (São Paulo)**. Guarde a senha do banco.
3. Aguarde o projeto ficar pronto.

### 2. Rodar as migrações

Opção A (mais simples, pelo painel):

1. No Supabase, abra **SQL Editor** > **New query**.
2. Cole todo o conteúdo de `supabase/migrations/20261125000001_schema.sql` e clique em **Run**.

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
3. Abra cada quarto para colar os feeds iCal (passo 7).

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

**Estado do quarto (tela inicial)**

Ocupado · Check-out hoje · Em limpeza · Limpeza pendente (saída nos últimos 7 dias sem limpeza marcada) · Check-in hoje · Bloqueado · Livre.
Quando há check-in no mesmo dia de uma saída ainda suja, o cartão mostra ⚡.

---

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
      limpeza/             check-outs do dia e tarefas
      unidades/            propriedades, quartos, feeds e exportação
    api/sync/              POST protegido por SYNC_SECRET
    api/ical/[token]/[file]/  exportação airbnb.ics / booking.ics
  lib/
    ical/                  parser e gerador iCal
    domain/rules.ts        eco, conflitos, exclusão por canal, estado do quarto
    sync/                  plano (puro) e execução da sincronização
    supabase/              clientes (sessão do usuário e service role)
  proxy.ts                 renova a sessão e protege as páginas
supabase/
  migrations/              esquema + RLS
  cron.sql                 agendamento pg_cron (rodar manualmente após o deploy)
tests/                     vitest + exemplos de feed Airbnb/Booking
```
