# Adequação após conferência dos diagramas — 17/10/2026

## Resultado

O desvio de encerramento de UC09 foi corrigido e ensaiado no navegador. As classes Usuario, Cliente e Barbeiro agora expõem as operações dos diagramas; a API usa essas classes e delega persistência aos serviços assíncronos. Nenhuma migração de banco, alteração de credenciais ou substituição de dados reais faz parte desta correção.

A referência continua sendo a Entrega 1 corrigida e o detalhamento de UC09 na Entrega 2. Foram verificados os hashes dos 39 arquivos preservados no manifesto: nenhuma divergência. A [conferência inicial](2026-10-17-conferencia-diagramas.md) registra o diagnóstico anterior à correção.

## Rastreabilidade das vistas

Os nomes abaixo identificam as páginas dos arquivos editáveis originais. As três imagens compostas de Atividades, Sequência e Objetos reúnem as vistas da Entrega 2; não criam entidades ou regras adicionais.

| Vista | Implementação e verificação |
|---|---|
| E1 — 01_casos_de_uso_compartilhados | Cadastro/login, consulta, seleção múltipla, reserva e cancelamento em `app.mjs`, `users.mjs`, `booking.mjs` e páginas System. Testes de autenticação, perfil, proprietário, serviços ativos distintos e motivo/prazo de cancelamento. |
| E1 — 01b_casos_de_uso_barbeiro | Comandos reais de Barbeiro para agenda, nova reserva para cliente cadastrado, horários, serviços, edição, status e relatório. As rotas verificam o perfil e a agenda responsável. |
| E1 — 02_classes_usuarios | Usuario abstrato: cadastrar, autenticar e atualizarDados. Cliente: consultarAgenda(barbeiroId), agendar e cancelarAgendamento. Barbeiro: consultarAgenda, agendar, cancelarAgendamento, cadastrarHorarios, cadastrarServicos, alterarAgendamento, gerarRelatorio e alterarStatus. Métodos em `domain.mjs`, I/O em UsuariosService/AgendaService. Testes diretos sobre contas e reservas persistidas, além das rotas HTTP. |
| E1 — 02b_classes_catalogo | Servico valida nome/categoria/preço/duração/ativo, com atualizar/desativar; enumerações documentadas. Preço zero permitido, duração positiva e catálogo compartilhado. Alterações não reescrevem itens históricos. |
| E1 — 03_classes_agendamento | Agendamento, Disponibilidade e quatro estados documentados; vínculos por IDs, sem exclusão em cascata do histórico. Soma de preço/duração e janela completa/grade verificadas. Reservas exigem um cliente, um barbeiro, uma janela compatível e serviços distintos. |
| E2 — 01_atividades_alterar_agendamento | Proposta separada, revisão/cancelamento/confirmação. Inelegibilidade encerra a edição; escolhas rejeitadas retornam à revisão; falhas permitem repetir a confirmação com segurança; sucesso mostra a reserva gravada. Ensaio real de navegador descrito abaixo. |
| E2 — 02_atividades_validar_e_gravar | Revalidação de proprietário, PENDENTE/início futuro, serviços, preço/duração, janela e ocupação na transação. Rejeição/rollback preservam a reserva. Testes SQLite e PostgreSQL nativo. |
| E2 — 03_sequencia_alterar_agendamentos | Rota chama Barbeiro.alterarAgendamento, que delega ao serviço transacional e usa Agendamento.reagendar. Retorno HTTP diferencia os resultados da interação. Códigos RESERVA_INELEGIVEL, RESERVA_SEM_ACESSO e RESERVA_NAO_ENCONTRADA encerram a edição aberta. |
| E2 — 04_sequencia_validar_e_gravar | Candidato isolado, totais sobre os mesmos serviços, Disponibilidade.possuiDisponibilidade, leitura da ocupação ignorando a própria reserva e as canceladas, gravação atômica mantendo ID e PENDENTE. Concorrência entre instâncias/processos e exclusão PostgreSQL também verificadas. |
| E2 — 05_objetos_vista_A | Fixture do snapshot preserva identidades, vínculos e valores das três reservas documentadas. |
| E2 — 06_objetos_vista_B | Mesma fixture e mesmos IDs de serviços; os objetos repetidos são vistas do mesmo modelo, não cadastros adicionais. |
| E2 — 07_objetos_vista_C | Mesma fixture; Corte + Barba = R$65/50min e Barba + Hidratação = R$45/35min. Os exemplos fictícios não são inseridos na produção. |

## Equivalências de implementação

- **Operações UML e infraestrutura:** as classes expõem os comandos; Usuario mantém o serviço em campo privado, fora do JSON. Autenticação HTTP, sessão/CSRF e limitação de tentativas continuam na fronteira HTTP. Hash/cifra, consultas e transações ficam em serviços/repositório. Operações que acessam o banco retornam Promises; o HTTP devolve a entidade atualizada onde o UML indica void/boolean. Isso mantém a informação necessária à interface sem mudar permissões ou regras de negócio.
- **Consulta do cliente:** Cliente.consultarAgenda retorna janelas ativas do barbeiro; a consulta HTTP de horários acrescenta data, soma das durações e ocupação. Barbeiro.consultarAgenda retorna suas reservas, utilizada também pelo relatório.
- **Tipos UML:** IDs Long correspondem a IDs inteiros validados, enumerações a valores fechados e LocalDateTime ao horário civil de São Paulo. Valores monetários são persistidos em centavos inteiros e somados nessa unidade; a saída em reais tem duas casas, sem desconto ou taxa. Não é uma implementação Java de BigDecimal.
- **Associações e histórico:** os IDs preservam a identidade de Cliente/Barbeiro/Disponibilidade/Servico. Itens JSON guardam uma fotografia dos serviços no momento da confirmação, permitindo explicar preço/duração históricos mesmo depois de editar o catálogo. Snapshots não criam um novo serviço de catálogo por reserva.
- **Fork/join e par:** preço e duração são cálculos independentes sobre a mesma proposta e ambos ficam prontos antes da revisão/validação. O texto E2 diz que podem ocorrer em paralelo, não exige threads; as somas pequenas continuam síncronas e independentes. Não há gravações paralelas nem promessa de paralelismo físico.
- **Autorização profissional:** código individual de uso único, validade e geração pelo operador são implementação de RN01. Os documentos não exigem uma tela de geração nem definem formato/órgão verificador de registroProfissional.

## Evidências desta correção

- `npm test`: **42 testes aprovados**, zero falhas. Regressões novas para perda de elegibilidade, decisão da interface e operações das classes com dados persistidos. Verificados também os contratos de permissão após a extração das operações.
- `npm run test:postgres`: **sete testes aprovados** em PostgreSQL nativo temporário, incluindo o cenário principal com API, duas instâncias/processos, rollback, relatório, sessões e credencial restrita. O log de falha P0001 é a falha intencional por trigger do ensaio de rollback.
- `npm run build`: aprovado. Aviso informativo de duração de callbacks do bundler; sem erro de compilação.
- Originais: **39 hashes conferidos**, zero divergências.
- Revisão independente do diff: nenhum achado de regressão; conferidos autorização, histórico, idempotência, contratos HTTP e isolamento do ensaio. O revisor também executou os três testes de confirmação.

### Ensaio de navegador isolado

Executado no frontend real, com banco SQLite e chave temporários, relógio controlado em 23/10/2026 e contas fictícias. Origem `http://127.0.0.2:5187`, separada inclusive do cookie do ambiente local habitual. Harness reproduzível: `node tests/ui-fixture.mjs`; comandos no terminal cancelar/preco/falhar/recuperar/conferir/sair. Não usa DATABASE_URL, chave ou banco de produção.

| Cenário | Resultado observado |
|---|---|
| Cancelamento por outra sessão depois de abrir a revisão | Confirmar mostra **Edição encerrada**, informa o motivo e oferece Voltar à agenda. Formulário de edição removido; proposta não é gravada. |
| Preço alterado depois da revisão | Confirmar retorna à escolha de horário, mantém seleção/data, atualiza total para R$75 e exige nova revisão. Consulta independente comprova original ainda em R$40. Nova confirmação grava no mesmo ID, PENDENTE, no horário escolhido. |
| Falha real de UPDATE por trigger | Interface informa erro e permite Verificar confirmação. Consulta independente comprova snapshot original intacto. Removida a falha, a mesma confirmação é recuperada com sucesso no mesmo ID. |
| Desistir após selecionar mais um serviço | Cancelar edição retorna à agenda. Consulta independente comprova snapshot original integralmente preservado. |

Imagens locais em `tmp/uc09-edicao-encerrada.png`, `tmp/uc09-revisao-confirmada.png` e `tmp/uc09-falha-recuperavel.png`. O harness é apenas para ensaio e não cria rotas de controle na aplicação.

## Limites da conclusão

Os desvios funcionais identificados nesta conferência têm correção/verificação registrada. A implementação continua com as equivalências de linguagem e persistência descritas acima; não deve ser apresentada como cópia literal de todos os tipos/chamadas UML. A revisão das vistas e os testes não certificam disponibilidade mensal de produção, P95 remoto ou acessibilidade completa. Essas metas exigem medições/ensaios próprios.

O ensaio detalhado desta rodada cobre as alternativas de UC09. Para os outros casos de uso, a evidência são as regressões de domínio/API e verificações anteriores; não foi repetido um ensaio manual de todas as telas na produção.
