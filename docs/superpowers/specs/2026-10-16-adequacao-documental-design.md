# Adequação do Navalha Digital aos documentos do projeto

Data: 16/10/2026. Estado: **execução autorizada pelo usuário em 16/10/2026**. Resultados e limites da implementação constam em `docs/compatibilidade/2026-10-16-resultado-adequacao.md`.

## 1. Objetivo e fonte principal

Adequar o site existente ao mesmo projeto descrito nas Entregas 1 e 2 do pacote enviado por Rodrigo. O objetivo é permitir demonstrar cada caso de uso com suas regras e relacionar os comportamentos aos diagramas, sem tratar extras anteriormente sugeridos no chat como requisitos superiores aos documentos.

A Entrega 1 corrigida é a base de escopo, RF01–RF10, RN01–RN12, RNF01–RNF06 e UC01–UC12. A Entrega 2 detalha UC09, sem adicionar classes de domínio ou funcionalidades. Os PDFs, DOCX, diagramas editáveis e imagens foram preservados em `docs/referencias/pacote-completo/`. A matriz completa está em `docs/compatibilidade/2026-10-16-matriz-documentos-sistema.md`.

O resultado esperado é uma aplicação integrada de cliente e barbeiro com autenticação, agenda por profissional, seleção de serviços múltiplos e gravação consistente. Metas que dependem de hospedagem e medição devem permanecer identificadas como metas até existir evidência.

## 2. Situação atual e decisões propostas

O projeto usa React 18, Vite, React Router e persistência em localStorage. Não possui servidor, contas de clientes, cadastro profissional, janelas editáveis nem transações compartilhadas. A aplicação oferece cupons, busca por telefone, administração global e estados diferentes dos documentos.

Foram consideradas três alternativas:

1. **Reaproveitar React e acrescentar servidor Node com banco transacional. Recomendada.** Preserva a interface e os componentes enquanto substitui a persistência e as operações incompatíveis. O Node disponível no ambiente é v24.20.0; o banco SQLite permite execução local e transações. A camada de infraestrutura deve proteger dados pessoais e backups.
2. **Reaproveitar React e construir servidor Java.** Facilita uma correspondência literal com tipos como BigDecimal e LocalDateTime, mas exige outro ambiente e mais configuração. Os documentos descrevem UML e não obrigam a linguagem Java.
3. **Modificar somente a interface e continuar em localStorage.** Permite uma demonstração visual parcial, mas não satisfaz autorização, concorrência, criptografia e RNF05. Não atende ao pedido de compatibilidade integral.

Esta proposta adota a primeira alternativa. A escolha deve ser confirmada na revisão desta especificação antes de detalhar o plano e implementar.

## 3. Limites do produto

Os perfis de domínio são somente Cliente e Barbeiro. O painel profissional corresponde ao Barbeiro; não existe um dono com acesso global a todas as agendas. O catálogo é da barbearia e pode ser mantido por barbeiros autorizados. As janelas e reservas pertencem a profissionais específicos.

Pagamento é presencial. Não implementar cobrança, pagamento on-line, quitação, comissões, estoque, notificações externas, cupons, descontos ou taxas. Os relatórios apresentam valores dos atendimentos, sem afirmar recebimento. Retirar cupons, avaliações e integração Google Calendar do fluxo da versão alinhada; preservar os arquivos anteriores até a migração estar validada.

As páginas públicas de apresentação, Sobre e Contato e a paleta marrom/bege podem ser reaproveitadas, pois os documentos não impõem outro estilo. Textos inventados de endereço, história e estatísticas não devem ser apresentados como dados reais confirmados da barbearia. Não prometer lembrete 24h antes ou cancelamento com limite mínimo de 2h.

## 4. Arquitetura e fronteiras

### 4.1 Interface

Manter React/Vite e os componentes reutilizáveis. Substituir operações locais do BookingContext por chamadas à API. O cliente não determina perfil, cliente proprietário, valores finais, duração total ou elegibilidade: o servidor calcula e valida esses campos.

Sessões e operações protegidas serão compartilhadas por todas as telas através de um contexto de autenticação. Preferências visuais podem permanecer no navegador; dados de agenda e autorização não dependem de flags no sessionStorage ou de busca pública por telefone.

### 4.2 Servidor

Separar transporte HTTP, autenticação/autorização, operações de domínio e repositório transacional. Usar respostas com categorias distintas para validação, falta de autenticação, permissão, conflito e falha de persistência. Nunca retornar senhaHash ou dados privados de terceiros.

As operações centrais mantêm os nomes conceituais dos documentos: cadastrar, autenticar, atualizarDados, agendar, confirmar, cancelar, reagendar, concluir, alterarStatus, consultarAgenda, possuiDisponibilidade, calcularValorTotal e calcularDuracaoTotal. Assinaturas UML orientam os contratos; o mecanismo HTTP é infraestrutura, não uma classe nova de negócio.

### 4.3 Persistência

Usar SQLite com chaves estrangeiras, restrições de unicidade, validações e transações explícitas. A operação de escrita adquire a proteção necessária antes da última leitura de elegibilidade/conflito. Toda gravação de reserva, serviços, totais, disponibilidade e datas conclui na mesma transação ou sofre rollback.

O isolamento deve funcionar entre conexões e processos, não apenas por variável ou mutex em memória. Tratar contenção com tempo de espera limitado e mensagem que preserve escolhas; não converter falhas de lock em sucesso.

### 4.4 Estrutura prevista

- `server/auth/`: sessão, hash de senha, autorização e cadastro profissional autorizado.
- `server/domain/`: regras das cinco entidades concretas e enumerações; cálculos e elegibilidade.
- `server/db/`: schema, migrações, transações e consultas com filtro de responsabilidade.
- `server/security/`: criptografia de dados pessoais e gestão das chaves externas ao banco.
- `server/http/`: rotas e mapeamento de erros, sem duplicar regras.
- `src/services/`: cliente HTTP e contratos para interface.
- `src/contexts/`: autenticação e carregamento de dados do usuário.
- `src/pages/`: cadastro/login, fluxo de reserva, área do cliente e área do barbeiro.
- `tests/`: testes dos contratos novos de domínio, API, concorrência e aceitação documental.

Não é necessário criar microserviços, uma nova aplicação externa ou um banco hospedado para executar localmente.

## 5. Modelo de domínio

| Entidade | Atributos e restrições |
|---|---|
| Usuario, abstrata | id numérico, nome, e-mail único, senhaHash, telefone, dataCadastro. Nunca instanciar um usuário sem o perfil concreto correspondente. |
| Cliente | Dados herdados; dataNascimento e endereco opcionais. Sem limite etário acrescentado. |
| Barbeiro | Dados herdados; registroProfissional e bio. Somente profissional autorizado fora do sistema. |
| Servico | id, nome, descricao, categoria, duracaoMinutos >0, preco >=0 e ativo. |
| Disponibilidade | id, barbeiro, diaSemana, horaInicio < horaFim, intervaloMinutos >0 e ativo. |
| Agendamento | id, cliente, barbeiro, disponibilidade, dataHora, status, observacao, dataCriacao, dataAtualizacao, servicos não vazios, valorTotal e duracaoTotalMinutos. |

Enumerações exatas:

- CategoriaServico: `CORTE`, `BARBA`, `TRATAMENTO`, `OUTRO`.
- DiaSemana: `SEGUNDA`, `TERCA`, `QUARTA`, `QUINTA`, `SEXTA`, `SABADO`, `DOMINGO`.
- StatusAgendamento: `PENDENTE`, `CONCLUIDO`, `NAO_COMPARECEU`, `CANCELADO`.

Cada reserva tem exatamente um cliente, um barbeiro e uma janela do mesmo barbeiro. Possui um ou mais serviços distintos. Um serviço pode estar em várias reservas e uma janela recorrente pode atender reservas de várias datas. São associações persistentes, sem exclusão em cascata que apague histórico.

Usar valores monetários exatos: armazenamento em centavos inteiros e conversão decimal controlada na fronteira da API, sem soma em ponto flutuante binário. Isso representa o significado de BigDecimal, sem exigir Java. Documentar o mapeamento no dicionário técnico.

Persistir valorTotal e duracaoTotalMinutos na criação e na alteração confirmada. Preservar também os valores dos itens usados na confirmação, como detalhe de persistência da associação, para permitir explicar o total histórico. Não recalcular a duração de uma reserva consultando o preço/duração atuais do catálogo.

Datas de atendimento seguem o horário civil da barbearia em `America/Sao_Paulo`, explicitamente configurado. Todas as verificações de futuro, término e dia da semana usam a mesma referência de relógio; testes podem injetar um relógio fixo. Não usar silenciosamente o fuso do dispositivo do cliente.

## 6. Cadastro, sessão e responsabilidade

Cadastro de cliente recebe nome, e-mail, telefone e senha, com nascimento/endereço opcionais. Normalizar e-mail antes da verificação de unicidade. Rejeitar a duplicidade também no banco, incluindo cadastros concorrentes.

Cadastro profissional usa dados obrigatórios e registro/bio. A autorização é configurada pelo operador fora do sistema, por lista de profissionais autorizados; uma requisição com perfil Barbeiro não basta para conceder privilégio. Não acrescentar um terceiro papel de administrador ao domínio.

Hash de senha resistente com salt aleatório por conta, realizado no servidor. Sessão opaca em cookie HttpOnly, SameSite e Secure no ambiente HTTPS, com expiração e encerramento no logout. Usar proteção contra requisições forjadas e validação de origem nas escritas. Não colocar tokens ou senhas em URL/localStorage.

Em cada operação, derivar o usuário da sessão. Cliente vê/cancela apenas as próprias reservas; não pesquisa reservas alheias por telefone. Barbeiro vê, altera, cancela e atualiza status apenas de sua agenda. Para criar reserva profissional, selecionar um cliente já cadastrado, com exposição apenas dos dados necessários.

Atualização de dados do cadastro mantém unicidade e permissões. Recuperação por SMS/e-mail não será acrescentada, pois notificações externas não pertencem ao escopo.

## 7. Fluxos e regras de agenda

### 7.1 Nova reserva UC04 e seleção UC06

1. Autenticar e identificar o cliente. No fluxo profissional, selecionar cliente cadastrado.
2. Escolher um barbeiro específico e um ou mais serviços ativos, sem repetir o mesmo ID.
3. Calcular total e duração da seleção; consultar opções nas janelas daquele profissional.
4. Selecionar início futuro. Permitir atendimento no mesmo dia se o início ainda não ocorreu.
5. Exibir revisão com cliente, barbeiro, lista de serviços, data/hora, duração, término e total; informar pagamento presencial.
6. Na confirmação, repetir validações de sessão, responsabilidade, serviços e disponibilidade dentro da transação.
7. Gravar uma reserva PENDENTE com associação de serviços, janela e totais registrados; emitir comprovante na própria sessão.

Não reservar intervalo ao apenas consultar ou selecionar. Rejeição por concorrência informa Horário não está mais disponível e preserva serviços/escolhas ainda válidos. Falha de gravação não deixa reserva parcial. Controlar submissão duplicada para não criar duas reservas no duplo clique ou repetição da mesma confirmação.

### 7.2 Disponibilidade e conflitos

Uma opção é válida quando sua janela está ativa, seu dia da semana coincide, o início está na grade a partir de horaInicio e todo o atendimento termina no mesmo dia até horaFim. Grade positiva e duração positiva são condições obrigatórias. O início não pode ser igual ao fechamento.

A duração não precisa ser múltipla da grade. Uma janela 08:00–18:00 com grade 10 admite atendimento de 35 minutos começando às 11:00.

Há conflito se `novoInicio < fimExistente && inicioExistente < novoFim` para o mesmo barbeiro. Desconsiderar somente CANCELADO e, no reagendamento, o próprio ID. Atendimentos consecutivos são válidos. Não bloquear o horário de um barbeiro por reserva de outro.

### 7.3 Cancelamento UC05

Permitir exclusivamente para PENDENTE com início futuro e responsabilidade válida. Mostrar os dados, pedir confirmação e motivo. Na transação, revalidar, registrar motivo em observacao, atualizar dataAtualizacao e mudar para CANCELADO. Preservar histórico e liberar o intervalo. Não há antecedência mínima adicional.

### 7.4 Alteração UC09

Apenas o barbeiro responsável, antes do início de reserva PENDENTE, altera serviços, data ou horário. Cliente e barbeiro da reserva não são trocados por essa operação.

Editar em proposta isolada: calcular preço/duração sobre os mesmos serviços candidatos, identificar janela compatível e comparar conflitos ignorando a própria reserva. Exibir revisão e permitir revisar, cancelar a edição ou confirmar. Nada muda publicamente antes da transação concluída.

Na confirmação, repetir todas as validações na mesma transação que grava dataHora, serviços, disponibilidade, valorTotal, duracaoTotalMinutos e dataAtualizacao. Manter ID, cliente, barbeiro, dataCriacao e PENDENTE. Ao mudar intervalo, o anterior só é liberado após a confirmação bem-sucedida.

Resultados conforme E2: sucesso apresenta reserva atualizada; inelegibilidade encerra edição; escolhas rejeitadas permitem revisão; falha de persistência mantém original e permite nova tentativa. A interação HTTP não deve bloquear a interface; cálculos independentes não exigem gravações paralelas nem um novo método público no domínio.

### 7.5 Estados UC12

| Origem | Destino | Quem e quando |
|---|---|---|
| Nova reserva | PENDENTE | Confirmação válida da criação. |
| PENDENTE | PENDENTE | Sem mudança de estado; reagendamento mantém o estado, quando elegível. |
| PENDENTE | CANCELADO | Cliente proprietário ou barbeiro responsável, exclusivamente antes do início, pela operação de cancelamento. |
| PENDENTE | CONCLUIDO | Barbeiro responsável após o término previsto. |
| PENDENTE | NAO_COMPARECEU | Barbeiro responsável após o término previsto. |
| Estado final | Outro estado | Proibido neste escopo. |

Não permitir que um cliente conclua o próprio atendimento ou reative um cancelado. Não usar CONFIRMADO ou AGENDADO como valores de status. A interface pode dizer Reserva realizada, com status Pendente.

### 7.6 Catálogo UC10 e janelas UC11

Cadastrar/atualizar serviços com categorias e valores válidos. Desativar preserva referências e bloqueia novas seleções. Edição de reserva usa os serviços ativos e valores vigentes na nova confirmação. Reservas existentes não são reprecificadas quando o catálogo muda.

Cada profissional mantém suas janelas semanais. Impedir sobreposição de janelas ativas no mesmo dia. Bloquear atualização ou desativação que torne alguma reserva futura PENDENTE incompatível com o dia, os limites ou a grade; apresentar as reservas afetadas para que sejam tratadas primeiro. Não movê-las nem cancelá-las automaticamente.

### 7.7 Relatórios UC08

Exigir período com início <= fim. Consultar somente reservas CONCLUIDO do barbeiro autenticado, com data do atendimento nos limites inclusivos. Exibir cliente, data, serviços e valorTotal registrado, com totalização informativa. CSV é uma forma de exportar o mesmo conjunto filtrado; não incluir outros estados escondidos na exportação.

Usar rótulos Relatório de atendimentos e Valor dos atendimentos concluídos. Não afirmar faturamento recebido, pagamentos ou quitação. Neutralizar células exportadas que possam ser interpretadas como fórmulas, sem alterar os dados de domínio armazenados.

## 8. Telas e contratos de navegação

- Área pública: apresentação, catálogo de serviços ativos, Sobre/Contato e acesso a cadastro/login.
- Autenticação: cadastro de cliente/profissional autorizado, login, dados da conta e sair.
- Cliente: nova reserva, comprovante e lista de seus agendamentos com próximos/histórico e cancelamento elegível.
- Barbeiro: agenda do dia/semana, nova reserva para cliente cadastrado, revisão/alteração UC09, cancelamento com motivo, status elegível, catálogo, janelas e relatório.

Reutilizar o passo a passo visual e adaptar para seleção múltipla. O resumo deve acompanhar os cálculos do servidor. Desabilitar somente as ações impossíveis e explicar o motivo. Preservar dados válidos ao receber conflito ou falha. Não apagar um formulário completo por uma rejeição de horário.

Redirecionar rotas antigas do painel quando houver correspondência. Rotas de cupons e avaliações não permanecem como funções ativas. A URL de comprovante exige permissão para a reserva indicada; conhecer o ID não concede acesso.

## 9. Segurança e requisitos de infraestrutura

RNF01 exige HTTPS e criptografia de dados pessoais persistidos e dos backups. A implementação local deve incluir hash de senha com salt, criptografia autenticada dos campos pessoais e backups, chaves fora do banco/controle de versão e testes de leitura/gravação/recuperação. Índice de e-mail único pode usar impressão criptográfica com chave e campo cifrado, sem e-mail em texto aberto no banco. Não enviar PII a logs ou mensagens de erro.

Sessões, chaves, arquivos do banco, cópias de segurança e qualquer mapa de autorização profissional devem ficar fora do bundle e do versionamento. Não reutilizar valores senhaHash ilustrativos do snapshot como hash válido de cadastro nem credencial de acesso.

HTTP em loopback pode servir para desenvolvimento, mas deve ser marcado como ambiente local e não comprova RNF01. A publicação exige configuração HTTPS válida e testes nessa configuração; não desativar validação de certificado nem ignorar aviso do navegador para declarar conformidade.

RNF03 permanece meta de disponibilidade mensal >=99% durante o funcionamento cadastrado, excluindo manutenções comunicadas. Incluir procedimento de monitoramento e cálculo; conformidade mensal depende de observação real após a publicação.

RNF04 exige teste com até 50 usuários simultâneos e P95 <=2 segundos para consultar e confirmar, com ambiente, conjunto de dados, taxa de falhas e percentis registrados. Não converter o tempo de build em prova de desempenho da aplicação.

RNF05 exige teste concorrente por intervalo sobreposto e simulação de falhas de gravação. A proteção deve cobrir criação, alteração e cancelamento. RNF06 exige verificar revisão, campos obrigatórios, total/duração, mensagens, telas móveis e preservação de escolhas.

## 10. Dados existentes e cenário acadêmico

O localStorage atual é dado legado de demonstração. Não excluir automaticamente nem converter telefone em conta autenticada. Fazer backup/exportação antes de qualquer migração; não inventar e-mail, vínculo de propriedade, autorização profissional ou credenciais para preencher dados ausentes. Um importador posterior só aceita registros com vínculos verificáveis e apresenta rejeições, sem sobrescrever dados existentes.

Se um registro anterior usou cupom ou não contém duração/valor histórico confiável, mantê-lo em arquivo legado separado; não apresentá-lo como atendimento conforme RN07. Não prometer que uma migração removeu PII antiga de todos os navegadores sem verificação.

Criar fixture isolada para o snapshot de E2: clientes Ana Souza, Bruno Lima e Carla Alves; barbeiros Diego Rocha, Eduardo Silva e Felipe Costa; serviços Corte id201 R$40/30min, Barba id202 R$25/20min e Hidratacao id203 R$20/15min; janelas 301–303 sexta-feira 08:00–18:00, grade10; reservas 401–403.

Com relógio de 23/10/2026 07:45, UC09 muda a reserva401 de 10:00 para 09:00 com Corte+Barba. Às 08:00, confirmar total65, duração50, dataAtualizacao07:45 e PENDENTE. Reservas402 e403 mantêm R$40/30min e R$45/35min. Os 15 objetos e suas referências permanecem coerentes; os objetos compartilhados s1/s2 não são duplicados.

Esses valores servem para validar o modelo. Não fixar sexta-feira, grade10 ou os nomes fictícios como única configuração de produção. Dados da fixture não devem aparecer automaticamente como reservas reais.

## 11. Critérios de aceitação e rastreabilidade

A matriz de compatibilidade é a lista de conferência dos 28 requisitos/regras. Cada RF deve ter demonstração funcional e cada RN uma verificação da regra; RNFs devem ter implementação ou evidência correspondente, com pendências operacionais visíveis.

As verificações mínimas devem cobrir:

1. Cadastro concorrente com e-mail duplicado; profissional não autorizado; login/logout; nenhuma senha original persistida ou devolvida.
2. Clientes e barbeiros diferentes tentando ler ou alterar reservas alheias, inclusive por ID direto e parâmetros adulterados.
3. Vários serviços, seleção vazia/repetida/inativa, valores negativos e preço zero válido; soma exata e duração registrada.
4. Grade a partir de horaInicio, atendimento consecutivo, diferentes profissionais, 09:05 fora da grade10, início no fechamento e término após a janela.
5. Confirmações concorrentes do mesmo intervalo: só uma aceita, nenhuma parcial; requisição repetida não duplica reserva.
6. Cancelamento com motivo antes do início, inclusive menos de 2h antes; negar no início, após início e em estado final.
7. UC09 com próprio ID ignorado, novo conflito, outra agenda, serviço desativado, desistência e falha de gravação; original intacto em cada rejeição.
8. Mudança posterior no catálogo sem alterar totais/duração históricos; edição confirmada usando valores vigentes.
9. CONCLUIDO/NAO_COMPARECEU somente pelo barbeiro após o término; estados finais não reabrem; CANCELADO só pela operação de cancelamento.
10. Janelas inválidas/sobrepostas e edição que invalida reserva futura; desativação preserva vínculos.
11. Relatório próprio, somente concluídos, limites inclusivos e período invertido rejeitado; CSV e tela com os mesmos registros e totais históricos.
12. Cenário numérico completo de E2 com relógio fixo, três reservas e quinze instâncias coerentes.
13. Interface responsiva, navegação por teclado, revisão e preservação das escolhas em todos os erros descritos nos casos de uso.
14. Testes de criptografia, restauração de backup e carga, com resultados registrados separadamente das metas ainda não medidas.

## 12. Ordem de entrega proposta

A implementação forma um único sistema, dividido em etapas dependentes: infraestrutura de dados e autenticação; catálogo e janelas; reserva de múltiplos serviços e consulta; área cliente e cancelamento; painel barbeiro com UC09/status; relatórios e aceitação documental. Nenhuma etapa parcial deve ser anunciada como conformidade integral.

Após a revisão desta especificação, produzir um plano com arquivos, contratos e verificações por etapa. Só então iniciar a alteração de arquitetura. Não há repositório Git nesta pasta; não criar commits ou branches por conta própria.
