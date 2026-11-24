# Roteiro da demonstração — Projeto Final (10–11/12/2026)

Site: https://navalha-digital-rodrigosx7.vercel.app

Duração sugerida: 8 a 10 minutos. Use duas janelas do navegador (uma normal e uma anônima) para manter cliente e barbeiro logados ao mesmo tempo.

## Contas de demonstração

As senhas **não** ficam neste arquivo (o repositório é público). Anote-as em local privado.

| Papel | Nome | E-mail | Observação |
|---|---|---|---|
| Barbeiro | Diego Barbeiro | barbeiro.demo@navalha.test | conta criada como cliente e promovida a BARBEIRO via SQL em 24/11 (chave de produção indisponível para `npm run autorizar`) |
| Cliente 1 | André Cliente | andre.cliente@navalha.test | usada nos fluxos de sucesso |
| Cliente 2 | Bruno Cliente | bruno.cliente@navalha.test | dono das reservas que ocupam horários (conflito) |

## Preparação (até 09/12)

> Itens 1–4 já feitos em produção em 24/11/2026 com a conta Diego Barbeiro: janelas #13–#18 e reservas #6 (Bruno, 14/12 10:00), #7 (André, 14/12 14:00), #8 (André, 14/12 16:00) e #9 (André, 09/12 17:00).
>
> **Atenção:** o Supabase gratuito pausa o projeto após ~7 dias sem acesso (a API passa a responder 503). Abra o site pelo menos uma vez por semana até a apresentação; se pausar, use **Resume project** no painel da Supabase.

1. Barbeiro → **Serviços**: conferir Corte (30 min, R$ 40), Barba (20 min, R$ 25) e Hidratação (15 min, R$ 20) ativos.
2. Barbeiro → **Janelas de atendimento**: uma janela por dia, de segunda a sábado, 08:00–18:00, início a cada 30 min.
3. Reservas futuras (todas na segunda, 14/12/2026):
   - Cliente 2: 10:00, Corte — **ocupa o horário** do teste de conflito.
   - Cliente 1: 14:00, Corte + Barba — será **alterada** ao vivo.
   - Cliente 1: 16:00, Barba — será **cancelada** ao vivo.
4. Para demonstrar **Concluído**, crie antes de 09/12 às 17h uma reserva do Cliente 1 para **quarta, 09/12, 17:00** (Barba). Na apresentação ela já terá terminado.
5. Na véspera, abra o site uma vez para "acordar" a API e o banco (a primeira requisição após inatividade é lenta).

## Fluxos de sucesso

| # | Ação na tela | O que dizer (classe / método) |
|---|---|---|
| 1 | Página inicial → **Entrar** como Cliente 1. | `Usuario.autenticar(email, senha)`: o próprio objeto confere a senha com seu hash privado (Information Expert). A `FabricaUsuarios` decidiu instanciar `Cliente` a partir do perfil gravado (padrão Factory). |
| 2 | **Agendar** → marcar Corte e Hidratação → escolher Diego Barbeiro. Mostrar o total no painel lateral. | `Agendamento.calcularValorTotal()` e `calcularDuracaoTotal()` somam os `Servico` escolhidos. Valor em centavos é privado (`#valorCentavos`). |
| 3 | Escolher terça, 15/12 → mostrar só horários livres → 09:00 → **Revisar** → **Confirmar**. | `Cliente.agendar()` → `AgendaService.criar()` (Facade) monta o `Agendamento` e chama `confirmar()`, que valida a proposta e atribui `PENDENTE`. |
| 4 | Janela do barbeiro → **Agenda semanal** (semana de 14/12). | `Barbeiro.consultarAgenda()`; o repositório devolve instâncias de `Agendamento` (Repository/Data Mapper). |
| 5 | Reserva 14/12 14:00 → **Alterar reserva** → adicionar Hidratação → mudar para 14:30 → **Confirmar alteração**. (15:00 não aparece: com 65 min invadiria a reserva das 16:00.) Mostrar que o número da reserva continua o mesmo e o total foi recalculado. | **UC09** — `Barbeiro.alterarAgendamento()` resolve os serviços e envia `Agendamento.reagendar(novaDataHora, novosServicos)`: `#verificarElegibilidade` → `#validarProposta` → `Disponibilidade.possuiDisponibilidade()` → `Barbeiro.consultarAgenda()` → `#aplicar`. Id e `PENDENTE` são preservados. |
| 6 | Reserva 14/12 16:00 → **Cancelar reserva** → motivo "Cliente pediu para remarcar". | `Agendamento.cancelar(motivo)`: exige reserva pendente e futura; o registro permanece no histórico. |
| 7 | **Agenda do dia** em 09/12 → reserva das 17:00 → **Marcar concluído**. | `Barbeiro.alterarStatus()` → `Agendamento.concluir()`, permitido só após o término previsto (`#fim()`). |
| 8 | **Relatório** → período 01/12 a 31/12 → **Consultar** → **Baixar CSV**. | `Barbeiro.gerarRelatorio()`: somente atendimentos concluídos; valores informativos, sem pagamento. |

## Fluxos de exceção

| # | Ação | Resultado esperado | O que dizer |
|---|---|---|---|
| E1 | Entrar com senha errada. | "E-mail ou senha incorretos." | `autenticar` retorna falso; a mensagem não revela qual campo errou. |
| E2 | Alterar uma reserva para 14/12 10:00 (ocupado pelo Cliente 2). | A tela não oferece o horário. Para mostrar a regra no servidor, abra a alteração em duas abas: na primeira escolha 10:30 e pare na revisão; na segunda, agende 10:30 para o Cliente 2; volte à primeira e confirme → "Horário não está mais disponível". Reserva original intacta. | `#validarProposta` chama `consultarAgenda()` e rejeita sobreposição (409) **antes** de `#aplicar`; nada é gravado. |
| E3 | Tentar marcar **Concluído** em uma reserva futura (via detalhes). | "Aguarde o término previsto do atendimento." | Regra RN08 em `#finalizar`. |
| E4 | Reserva já cancelada: não há botão de cancelar. | Estado final não volta atrás. | `#verificarElegibilidade` → `RESERVA_INELEGIVEL`. |
| E5 | **Janelas** → nova janela segunda 12:00–20:00. | "Essa janela se sobrepõe a outra janela ativa." | `Disponibilidade.sobrepoe(outra)` (RN10). |
| E6 | **Serviços** → desativar Hidratação → como cliente, abrir Agendar. | Hidratação não aparece; reservas antigas mantêm o serviço. Reative em seguida. | `Servico.desativar()` preserva o histórico. |

## Arquitetura (slide de fechamento)

- Domínio (`server/domain.mjs`): atributos privados `#` com getters; estado muda só por métodos de negócio.
- Serviço (`AgendaService`, `UsuariosService`): Facade/Pure Fabrication — transação, idempotência, persistência.
- Persistência: Repository + Adapter (SQLite local, PostgreSQL/Supabase em produção).
- Padrões: Factory, Adapter, Facade, Repository; GRASP Information Expert, Creator, Controller; SOLID SRP, OCP/DIP, LSP.
- Testes: `tests/modelo.test.mjs` verifica a ordem das mensagens do UC09.

## Plano B

Se o site estiver fora do ar: `npm run dev` e demonstrar em http://127.0.0.1:5174 com o mesmo roteiro (dados locais em SQLite).
