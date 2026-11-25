# Reunião com a HotelLink: perguntas para a integração via API

Contexto para eles: temos um PMS próprio (uso interno, não comercial), 4 propriedades com vários quartos, vendidos no Airbnb e no Booking.com. No Booking vendemos **por tipo de quarto**. Na primeira fase a HotelLink será a **dona do calendário** (o PMS lê reservas e envia bloqueios de manutenção). Depois queremos que o **PMS vire o dono** (enviando disponibilidade, tarifas e restrições).

Marque as respostas ao lado de cada pergunta. Peça que mandem por escrito tudo o que for técnico.

---

## As 10 essenciais (se o tempo for curto, faça só estas)

1. Um PMS desenvolvido por nós, para uso próprio, pode se conectar à API? Precisamos virar parceiro certificado? Como é o processo e quanto tempo leva?
2. Tem custo? (taxa de integração, mensalidade extra, cobrança por uso)
3. Como recebemos acesso à documentação técnica da API? Podem enviar hoje?
4. Existe ambiente de testes (sandbox) separado da produção, onde dá para criar reservas de teste (nova, alteração, cancelamento)?
5. As reservas chegam ao PMS **na hora** (a HotelLink chama uma URL nossa) ou o PMS precisa **consultar** de tempos em tempos? Se for consulta, com que frequência podemos consultar?
6. Precisamos **confirmar o recebimento** de cada reserva? O que acontece se não confirmarmos?
7. Quando o Booking vende por **tipo de quarto**, a reserva chega com o quarto físico definido ou só com o tipo? Quem atribui o quarto: a HotelLink ou o PMS?
8. Podemos **bloquear um quarto específico** (manutenção) via API? Se o tipo tem 3 quartos e bloqueamos 1, o estoque do tipo cai para 2 automaticamente nas plataformas?
9. Quais dados do hóspede vêm na reserva? (nome, telefone, e-mail, nº de adultos e crianças, horário previsto de chegada, pedidos especiais, valores)
10. Quem é o nosso contato técnico e qual o canal de suporte (e-mail, WhatsApp, idioma, horário)?

---

## 1. Viabilidade, contrato e suporte

- [ ] Existe algum requisito mínimo para conectar um PMS próprio (empresa, CNPJ, volume de quartos)?
- [ ] Há contrato ou termos de uso específicos da API? Podem enviar?
- [ ] Qual a disponibilidade garantida da API (SLA)? Existe página de status?
- [ ] Como avisam mudanças na API (novas versões, campos que deixam de existir)? Com quanto tempo de antecedência?
- [ ] Já existem outros PMSs brasileiros conectados? Podem indicar uma referência?
- [ ] O que precisam receber de nós para liberar o acesso? (nome do sistema, URL, IPs, responsável técnico)

## 2. Ambiente de testes

- [ ] As credenciais do sandbox são separadas das de produção?
- [ ] No sandbox, as reservas de teste simulam Airbnb e Booking?
- [ ] Conseguimos disparar alterações e cancelamentos de teste por conta própria, ou depende da equipe de vocês?
- [ ] Há um processo de homologação antes de liberar a produção? O que é testado?

## 3. Autenticação e segurança

- [ ] Como funciona a autenticação? (chave de API, usuário e senha, OAuth, assinatura)
- [ ] A credencial é por hotel (propriedade) ou uma para a conta toda? Temos 4 propriedades.
- [ ] As chaves expiram? Como trocar uma chave se ela vazar?
- [ ] Se a HotelLink chama uma URL nossa: como confirmamos que a mensagem veio mesmo de vocês? (assinatura, IPs fixos, certificado)
- [ ] Quais IPs de origem vocês usam?

## 4. Recebimento de reservas

- [ ] Formato das mensagens: JSON ou XML? Seguem algum padrão (ex.: OpenTravel/OTA)?
- [ ] Se enviam para nossa URL: quantas vezes tentam de novo em caso de falha, por quanto tempo, e qual o tempo máximo de resposta que esperam?
- [ ] Se nosso servidor ficar fora do ar, por quanto tempo guardam as mensagens? Existe consulta para recuperar reservas de um período?
- [ ] Que eventos existem: nova, alterada, cancelada, no-show? Algum outro?
- [ ] Uma alteração chega com a reserva completa ou só com o que mudou?
- [ ] Existe número de versão ou data de modificação para saber qual mensagem é a mais recente (caso cheguem fora de ordem)?
- [ ] Quais identificadores vêm: ID da reserva na HotelLink, código da reserva no Airbnb/Booking? O ID continua o mesmo depois de alterações?
- [ ] Como vem o canal de origem (Airbnb, Booking, site próprio, outros)?
- [ ] Ao conectar, conseguimos importar de uma vez todas as reservas futuras já existentes?
- [ ] Reservas diretas (motor de reservas da HotelLink, se usarmos) também chegam pela API?
- [ ] Datas e horários: em que formato e fuso horário?

## 5. Dados do hóspede e valores

- [ ] O Airbnb e o Booking mascaram algum dado (telefone, e-mail) na reserva que chega?
- [ ] Vêm adultos e crianças separados?
- [ ] Vem o horário previsto de chegada informado pelo hóspede?
- [ ] Vêm os valores: total, por diária, comissão da plataforma, impostos, taxa de limpeza?
- [ ] Vêm dados de cartão de crédito? (Preferimos **não** receber, por segurança.) Dá para desligar?
- [ ] Vem a situação do pagamento (pago, cartão virtual do Booking, pagamento no local)?

## 6. Quartos, tipos e atribuição

- [ ] A API trabalha com tipos de quarto, quartos individuais, ou os dois?
- [ ] Conseguimos listar pela API os tipos de quarto, os quartos e os planos de tarifa, com seus IDs, para fazer o mapeamento?
- [ ] Se atribuirmos o quarto físico no PMS, precisamos avisar a HotelLink?
- [ ] No Airbnb, cada anúncio corresponde a um quarto. Como isso fica mapeado na HotelLink (tipo com 1 unidade)?
- [ ] Se mudarmos a configuração de quartos no painel de vocês, os IDs mudam?

## 7. Disponibilidade e bloqueios (fase 1: HotelLink dona do calendário)

- [ ] O bloqueio é por quarto específico ou só reduzindo a quantidade disponível do tipo?
- [ ] Conseguimos ler pela API a disponibilidade atual por tipo e por data?
- [ ] Dá para ter um acesso que só lê reservas e envia bloqueios, sem risco de alterar tarifas?
- [ ] Quanto tempo leva para um bloqueio chegar ao Airbnb e ao Booking?

## 8. Fase 2: PMS dono do calendário

- [ ] Como enviamos disponibilidade, tarifas e restrições (mínimo/máximo de noites, fechado para chegada/saída, stop sell)?
- [ ] Dá para enviar por período (ex.: 01/12 a 31/12 de uma vez) ou é dia a dia?
- [ ] Até quantos dias à frente podemos enviar?
- [ ] Tarifas por número de hóspedes e planos de tarifa derivados são suportados?
- [ ] Quando o PMS for o dono, ainda dá para editar pelo painel da HotelLink? O que prevalece se os dois mudarem?
- [ ] Existe um caminho recomendado para migrar da fase 1 para a fase 2 sem risco de overbooking?

## 9. Operação e confiabilidade

- [ ] Limites de requisições (quantas por minuto ou por hora)?
- [ ] Atraso típico entre a reserva no Airbnb/Booking e a chegada ao PMS?
- [ ] Como a HotelLink trata duas plataformas vendendo o mesmo quarto quase ao mesmo tempo?
- [ ] Existe painel com o registro das mensagens enviadas e dos erros (a "API visualization" citada no site de ajuda)?
- [ ] Há janelas de manutenção programadas? Como avisam?

## 10. LGPD

- [ ] Onde os dados ficam armazenados (país)?
- [ ] A HotelLink oferece contrato de tratamento de dados (operador e controlador)?
- [ ] Por quanto tempo os dados de uma reserva ficam disponíveis pela API?

---

## Peça para enviarem depois da reunião

- [ ] Documentação técnica da API (versão atual)
- [ ] Credenciais do sandbox
- [ ] Exemplos reais de mensagens: reserva nova, alterada e cancelada (com dados fictícios)
- [ ] Contrato ou termos da API e custos por escrito
- [ ] Nome e contato do responsável técnico
