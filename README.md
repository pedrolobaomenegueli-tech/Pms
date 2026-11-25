# PMS Temporada

Sistema de gestão de reservas para aluguel por temporada (Airbnb + Booking.com). As reservas virão do channel manager **HotelLink** via API (integração ainda não construída; enquanto isso, as reservas são lançadas manualmente).
Um único usuário. Next.js 16 (App Router) + TypeScript + Tailwind, Supabase (Postgres + Auth), hospedagem na Vercel.

**Módulos:** início com estado dos quartos e alertas, calendário, reservas, limpeza com checklist e link para a equipe, manutenção, propriedades e quartos.

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
   5. `20261128000001_channel_inbox.sql`
   6. `20261129000001_remove_ical.sql`

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

### 5. Deploy na Vercel

1. Suba este repositório no GitHub (já está).
2. Em <https://vercel.com/new>, importe o repositório. Framework: Next.js (detectado sozinho).
3. Em **Environment Variables**, cadastre as 5 variáveis (modelo em `.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `APP_ENV=production`.
   No primeiro deploy, se ainda não souber o domínio, use `https://NOME-DO-PROJETO.vercel.app`.
4. Clique em **Deploy**.
5. Confirme o domínio final em **Settings** > **Domains**. Se `APP_URL` estiver diferente, corrija e faça **Redeploy**
   (o link da equipe de limpeza usa essa variável).
6. Abra o app, faça login com o usuário criado no passo 3.

### 6. Cadastrar propriedades e quartos

Em **Quartos**:

1. Crie as 4 propriedades.
2. Dentro de cada propriedade, adicione os quartos (pode adicionar mais depois).
3. Clique em **Editar** na propriedade para montar o **checklist de limpeza** (modelo) e ajustar o **horário padrão de check-in**.
4. Abra cada quarto se quiser adicionar itens extras ao checklist.

---

## Ambientes: produção e testes

Use **dois projetos Supabase**: um de produção (suas reservas reais) e um de testes (dados fictícios e conexão com o sandbox do channel manager). Assim nenhum teste mexe nos dados reais.

| | Produção | Testes |
|---|---|---|
| Supabase | projeto atual | **novo projeto** (ex.: `pms-testes`) |
| Vercel | ambiente **Production** (branch `main`) | ambiente **Preview** (qualquer outra branch) |
| `APP_ENV` | `production` | `staging` |
| Aparência | normal | faixa amarela "AMBIENTE DE TESTES" e cabeçalho marrom |

**Passo a passo do ambiente de testes**

1. Crie um segundo projeto no Supabase (o plano gratuito permite dois), região São Paulo.
2. Rode as migrações na mesma ordem da produção (passo 2 da instalação).
3. Rode `supabase/seed-staging.sql` para ter dados fictícios. Ele se recusa a rodar se o banco já tiver propriedades.
4. Bloqueie cadastros e crie seu usuário de testes (passo 3 da instalação).
5. Na Vercel, em **Settings** > **Environment Variables**, cadastre as variáveis do projeto de testes marcando **só o ambiente Preview** (desmarque Production):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` (a URL de preview), `APP_ENV=staging` e `CHANNEL_INBOX_SECRET`.
6. Confira que as variáveis de produção estão marcadas **só em Production**, com `APP_ENV=production`.
7. Faça push em uma branch que não seja `main`: a Vercel gera uma URL de preview ligada ao banco de testes.


**Caixa de entrada do channel manager**

Enquanto a integração com a HotelLink não existe, o endereço `/api/channel/inbox` recebe e guarda **sem interpretar** tudo o que o channel manager enviar, para estudarmos o formato real.

- Fica **desligado** até você definir `CHANNEL_INBOX_SECRET` (mínimo 16 caracteres).
- URL para cadastrar no sandbox da HotelLink: `https://SUA-URL-DE-PREVIEW/api/channel/inbox?key=SEU_CHANNEL_INBOX_SECRET` (ou o cabeçalho `Authorization: Bearer ...`, se ela permitir).
- As mensagens ficam na tabela `channel_inbox` (Supabase > **Table Editor**). Credenciais em cabeçalhos e o parâmetro `key` **não** são guardados.
- Pode conter dados de hóspedes (LGPD): use só no ambiente de testes e apague o que não precisar (`delete from channel_inbox where received_at < now() - interval '30 days';`).

## Regras de negócio

**Conflitos**

- **Conflito (overbooking)**: duas **reservas** ativas que se sobrepõem no mesmo quarto. Check-out e check-in no mesmo dia não é conflito. Bloqueios não geram conflito.
- Ao salvar reserva manual, o sistema impede sobreposição com qualquer reserva ou bloqueio ativo.

**Fluxo da estadia (por reserva)**

Aguardando check-in → *Realizar check-in* → Hospedado → *Realizar check-out* → Em limpeza → *Finalizar limpeza* → Finalizado

- Cada passo grava data e hora e pode ser desfeito (volta uma etapa).
- Se você pular uma etapa (ex.: check-out sem ter marcado check-in), as anteriores são preenchidas junto.
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
- **Bloquear quarto**: ao registrar (ou depois, na tela do problema), escolha o período. O sistema cria um **bloqueio manual** no PMS. Se o período cair sobre uma reserva existente, o bloqueio é criado e a tela mostra um aviso. **Enquanto a integração com a HotelLink não existir, o bloqueio não chega às plataformas: bloqueie também na HotelLink.**
- Ao resolver um problema com bloqueio ativo, escolha **Resolver e remover bloqueio** ou **Resolver e manter bloqueio**.
- Histórico completo na tela de cada quarto.
- **Alertas na tela inicial**: manutenções urgentes abertas e check-ins entre hoje e daqui a 3 dias em quartos com manutenção alta ou urgente aberta.

## Limitações atuais

- **Sem integração com o channel manager ainda.** Reservas precisam ser lançadas à mão e bloqueios precisam ser repetidos na HotelLink. A caixa de entrada (`/api/channel/inbox`) só guarda mensagens para estudo.
- **Booking vende por tipo de quarto.** O modelo atual supõe que toda reserva já tem quarto definido; será preciso criar tipos de quarto e atribuição de quarto quando a integração for construída.

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
      unidades/            propriedades (checklist, link da equipe) e quartos
    equipe/[token]/        página pública da equipe (sem login)
    api/channel/inbox/     caixa de entrada do channel manager
  lib/
    domain/rules.ts        conflitos, fluxo da estadia, estado do quarto
    domain/cleaning.ts     checklist, limpeza no check-out, prioridade, visão da equipe
    domain/maintenance.ts  ordenação, bloqueio e alertas de manutenção
    channel/               caixa de entrada do channel manager
    supabase/              clientes (sessão do usuário e service role)
  proxy.ts                 renova a sessão e protege as páginas
supabase/
  migrations/              esquema + RLS
  seed-staging.sql         dados fictícios para o ambiente de testes
tests/                     vitest
```
