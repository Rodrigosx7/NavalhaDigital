# Resultado da adequação documental

**Atualização posterior:** a adaptação para Supabase/PostgreSQL e Vercel está descrita em [2026-10-17-supabase-vercel.md](2026-10-17-supabase-vercel.md). Os números abaixo registram a entrega local original de 16/10.

Verificação em 16/10/2026, no ambiente local Windows com Node v24.20.0. A referência principal permanece o pacote original preservado em `../referencias/pacote-completo/`.

O sistema foi convertido de demonstração em localStorage para frontend React conectado a uma API Node com SQLite. As regras são verificadas no servidor, com sessão por usuário, proteção de dados pessoais e escrita transacional. Esta entrega é uma implementação local; não representa uma certificação de produção ou uma auditoria visual completa.

## Evidências executadas

- `npm test`: **28 testes aprovados**, sem falhas. Inclui domínio, API, dois processos concorrentes, rollback real por trigger SQLite, backup/restauração em arquivo, autorização profissional, CSRF, sessões, recuperação de resposta perdida e CSV.
- `npm run build`: build de produção aprovado, 1604 módulos transformados. Bundle JavaScript aproximadamente 225 kB, cerca de 70 kB gzip; CSS cerca de 34 kB.
- `npm run test:load`: 50 contas autenticadas distintas, 150 consultas e 50 confirmações em lotes concorrentes de 50, sem erros. **P95 de 128 ms para consultas e 447 ms para confirmações** na medição final. Máximos 129 e 448 ms. Dados completos em `carga-local-2026-10-16.json`.
- O teste de carga usa loopback HTTP, banco temporário, um barbeiro, um serviço de 5 minutos e janela 08:00–18:00 com grade de 10 minutos. Cadastro/login são preparação e ficam fora da medição dos dois fluxos exigidos por RNF04. Esses valores não garantem o desempenho de outro ambiente ou outro volume de dados.
- Acesso HTTP à chave e ao banco pelo Vite foi rejeitado com **403**; site, API e Graphify foram verificados localmente.
- Revisão independente, somente leitura, concluída. Os quatro achados importantes foram reproduzidos em testes e corrigidos antes da entrega.

## Requisitos funcionais

| Requisito | Implementação ativa | Evidência |
|---|---|---|
| RF01 | Cadastro/login de Cliente e Barbeiro; nome, e-mail único, telefone, senha com salt; dados opcionais do cliente; código profissional de uso único emitido fora do sistema. | Testes de unicidade, autorização, sessão, logout, criptografia e bloqueio por conta. |
| RF02 | Cadastro/edição/desativação com categoria, preço >=0 e duração >0. | Testes de validação e preservação de vínculo histórico; tela Serviços. |
| RF03 | Consulta pela duração conjunta, janela e grade do profissional; início futuro em São Paulo. | Testes de grade, dia, fechamento, sobreposição e consulta de ocupação. |
| RF04 | Cliente próprio ou cliente cadastrado escolhido pelo barbeiro; múltiplos serviços sem repetição, revisão e reserva PENDENTE. | Testes de criação, duplicidade, valores, revisão desatualizada, idempotência e concorrência. |
| RF05 | Cancelamento com motivo, proprietário/profissional responsável, apenas PENDENTE antes do início; preservação do histórico. | Testes de prazo, permissão, liberação do intervalo e irreversibilidade. |
| RF06 | Área do barbeiro com visão diária/semanal e navegação por datas, limitada à sua agenda. | Isolamento de consultas na API; componentes Agenda e BarberLayout. |
| RF07 | UC09 altera data/horário/serviços, mantém ID/cliente/barbeiro/PENDENTE, recalcula totais e preserva original em falha. | Testes de conflito, próprio ID, rollback, papel e repetição de resposta perdida. |
| RF08 | PENDENTE/CONCLUIDO/NAO_COMPARECEU/CANCELADO; somente barbeiro finaliza após término. | Testes de limites, perfis e estados finais. |
| RF09 | Janelas semanais próprias, intervalo, ativo, sem sobreposição; proteção de reservas futuras com indicação dos IDs afetados. | Testes de sobreposição, desativação e informação de reserva afetada. |
| RF10 | Relatório/CSV dos próprios atendimentos CONCLUIDO, período inclusivo válido e totais registrados. | Testes de período, estado, valor histórico e escape CSV. |

## Regras de negócio

| Regra | Resultado |
|---|---|
| RN01 | Campos obrigatórios, e-mail único, nascimento/endereço opcionais e autorização profissional comprovada por código pessoal. Sem corte etário acrescentado. |
| RN02 | Responsabilidade derivada da sessão em todas as operações protegidas. Cliente não acessa terceiros; barbeiro não gerencia outra agenda. |
| RN03 | Cliente, barbeiro, início futuro e serviços ativos distintos obrigatórios. Revisão no frontend e verificação adicional de totais/duração na confirmação. |
| RN04 | Soma de durações; intervalo integral dentro de janela; checagem final protegida por BEGIN IMMEDIATE e conflito por intervalo. |
| RN05 | Cancelamento futuro pendente, com motivo/dataAtualizacao, sem antecedência adicional; sem apagar histórico. |
| RN06 | UC09 com proposta isolada e gravação/rollback completos; ID original ignorado no confronto. |
| RN07 | Centavos inteiros; valorTotal e duracaoTotalMinutos gravados; catálogo posterior não altera reservas; edição usa valores atuais. Sem desconto/taxa. |
| RN08 | Quatro estados documentados; conclusão/falta só após término pelo barbeiro; cancelamento próprio; estados finais não reabrem. |
| RN09 | Pagamento exclusivamente presencial; rótulos informativos de reserva/atendimento, sem registro de quitação. |
| RN10 | Janelas do próprio barbeiro, dia/limites/grade válidos e sem sobreposição ativa; rejeitar alteração que invalide reserva futura. |
| RN11 | Categorias documentadas, preço zero permitido, duração positiva e desativação; nenhum endpoint de exclusão física de serviços/janelas/reservas utilizados. |
| RN12 | Relatórios somente CONCLUIDO, próprios, limites inclusivos e período válido; usam valores históricos. |

## Requisitos não funcionais e limites

| Requisito | Evidência local | Pendência real |
|---|---|---|
| RNF01 | AES-256-GCM para dados pessoais e observações; HMAC de e-mail; scrypt com salt; backup autenticado; chaves/banco bloqueados por HTTP. Restauração invalida sessões. | HTTPS válido na hospedagem, permissões/ACL de arquivos e chave, custódia da chave e política real de backups ainda precisam de configuração e verificação no ambiente de publicação. |
| RNF02 | Autorização no servidor, cookie HttpOnly/SameSite, CSRF, expiração/logout, convite de uso único e testes de acesso cruzado. | Revisão e configuração do proxy/TLS da instalação real. |
| RNF03 | Endpoint `/api/health` disponível e procedimento de monitoramento descrito abaixo. | 99% mensal não é mensurável numa sessão local; requer observação contínua da hospedagem. |
| RNF04 | P95 abaixo de 2 segundos no cenário local de 50 usuários registrado em JSON. | Repetir o ensaio com infraestrutura e conjunto de dados reais antes de afirmar desempenho nessa instalação. |
| RNF05 | Transações SQLite, teste em dois processos, rollback de criação/alteração e validação final. | Continuar os ensaios se o modo de hospedagem, banco ou número de instâncias mudar. |
| RNF06 | Layout responsivo implementado, rótulos/obrigatórios, preço/duração/término, revisão, erros preservados e recuperação de confirmação. Build aprovado. | Revisão visual e teste manual completo em dispositivos/leitor de tela permanecem pendentes; não se declara certificação WCAG. |

## Como conferir a aplicação

1. `npm run dev`: site em `http://127.0.0.1:5174/` e API em 5180, ambos em loopback.
2. Cliente cria sua conta em `/cadastro`.
3. Operador verifica o profissional fora do sistema e executa `npm run autorizar -- email@exemplo.com`. Reinicia a API e entrega o código pessoal ao profissional. Nenhuma conta ou senha é criada automaticamente.
4. Barbeiro se cadastra com esse e-mail/código, cria suas janelas e mantém o catálogo.
5. Cliente seleciona serviços e barbeiro, consulta um horário e confirma. Barbeiro pode reservar para cliente cadastrado, editar reservas elegíveis e finalizar após o término.
6. Relatório inclui somente concluídos; a situação Não compareceu e cancelamentos permanecem no histórico.

O cenário numérico de E2 é testado com relógio fixo e dados fictícios: Corte+Barba = R$65/50min; Corte = R$40/30min; Barba+Hidratação = R$45/35min; vínculos compartilhados preservados. As datas do fixture não alteram o relógio real da aplicação.

## Monitoramento da meta RNF03

Na instalação real, coletar periodicamente uma verificação externa do site e de `/api/health`, com data/hora, resultado e duração. Conservar os registros por mês. O tempo monitorado deve cobrir a união das janelas ativas da barbearia, sem duplicar minutos quando profissionais trabalham simultaneamente.

Registrar início/fim de cada manutenção previamente comunicada. Calcular `100 × minutos disponíveis / minutos monitoráveis`, excluindo somente essas manutenções do denominador. Uma manutenção não comunicada conta como indisponibilidade. Documentar a resolução da coleta e os intervalos sem dados; não presumir que ausência de amostras significa disponibilidade. Verificar a meta de 99% ao concluir o mês.

## Decisões e revisão

- Pasta atual usada sem worktree/commits porque não existe repositório Git.
- React existente foi mantido; Node/SQLite usam valores monetários em centavos e nomes de domínio em português. Os tipos UML foram preservados em significado, sem exigir uma migração para Java.
- Autorização profissional exige código emitido pelo operador fora do sistema; conhecer o e-mail não basta. Isso concretiza a autorização prevista em RN01 sem criar um terceiro perfil de domínio.
- Identificação das reservas afetadas e término no resumo foram tratados como importantes para concluir os fluxos da especificação e possuem testes de regressão.
- Disponibilidade mensal, TLS de produção e ACL foram mantidos como verificações operacionais; não foram declarados aprovados por um teste local.
- Os dados antigos em localStorage não foram apagados nem associados automaticamente a contas. Não há migração de PII legada garantida.

**Melhoria menor adiada:** a agenda não atualiza continuamente o relógio. O botão Atualizar renova a consulta para liberar ações após o término; o servidor sempre revalida, impedindo transições indevidas mesmo se a tela estiver desatualizada.

## Graphify

O mapa local inclui o código atualizado, os 28 requisitos da Entrega 1 e o detalhamento de UC09 da Entrega 2. Relações entre requisitos e arquivos são identificadas como inferências; a comprovação funcional está nos testes, não na quantidade de ligações. Nós semânticos antigos do protótipo foram marcados como históricos para preservar rastreabilidade.

Os diagramas foram consultados na análise, mas as várias cópias PNG/PDF não foram todas extraídas semanticamente para o grafo. Arquivos antigos de demonstração podem aparecer no mapa, embora não tenham rotas ativas. O relatório e o JSON não substituem a especificação original nem a análise de segurança.
