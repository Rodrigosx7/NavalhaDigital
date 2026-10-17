# Ledger — plan: docs/superpowers/plans/2026-10-16-adequacao-documental.md

Spec: docs/superpowers/specs/2026-10-16-adequacao-documental-design.md

Autorização: usuário solicitou iniciar a adequação, priorizando os documentos, em 16/10/2026.

Ruling: executar na pasta atual, sem worktree/commits — não existe repositório Git; o pedido se refere a este projeto local.
Ruling: usar Node 24 e SQLite nativos com React existente — os tipos UML não obrigam Java; centavos e classes em português preservam o domínio.
Pre-flight: API e frontend compartilham os contratos listados no plano; servidor é a autoridade de perfil, conflitos e totais.

Task 1: complete — domínio, SQLite, cifra, salt e validações; testes de domínio e proteção passaram.
Task 2: complete — cadastro/login/logout, responsabilidade e catálogo/janelas; verificações API passaram.
Task 3: complete — múltiplos serviços, UC09, cancelamento, estados e histórico; 19 testes passaram, inclusive falha de gravação e disputa entre processos.
Task 4: complete — novas rotas ativas cliente/barbeiro e compilação Vite aprovada; sem verificação visual automatizada nesta sessão.
Task 5: complete — runner conjunto e backup implementados; arquivos sensíveis negados por HTTP 403. Primeiro teste de carga sofreu reset; identificada consulta da agenda 58 vezes para uma grade. Teste de regressão RED→GREEN após ler ocupação uma vez. Carga local: 50 usuários, 150 consultas, 50 confirmações, zero erros; P95 137ms/568ms nesse cenário. Medição final será registrada em carga-local.json.
Task 6: complete — revisão independente concluída; quatro achados importantes e dois ajustes de fluxo reproduzidos e corrigidos com RED→GREEN; suíte final 28/28 e build aprovados. Verificação HTTP: site/Graphify/API 200, chave/banco 403. Versão final reiniciada localmente.

Final: fixed autorização profissional — convite pessoal de uso único, vinculado ao e-mail e com prazo; removed autorização automática dos exemplos. Teste HTTP RED→GREEN.
Final: fixed bloqueio geral de login pelo proxy — limitação por identidade HMAC da conta/operação e limite global apenas de concorrência; teste RED→GREEN.
Final: fixed resposta perdida — proposta/chave retidas até repetir a mesma confirmação; idempotência também em UC09. Testes do cliente de confirmação e HTTP RED→GREEN.
Final: fixed sessão restaurada — restauração limpa sessões antes de usar a cópia; teste com arquivo real RED→GREEN.
Final: Ruling: promover identificação das reservas afetadas e término no resumo a ajustes importantes — usuário precisa saber quais reservas tratar e revisar o intervalo completo; custo de deixar faltar seria um fluxo incompleto da especificação. Ambos têm regressões RED→GREEN.
Final: minor (deferred): a agenda usa o horário da última consulta; o botão Atualizar renova a elegibilidade. O servidor revalida sempre; não há transição incorreta por tela desatualizada.
Final: finding already resolved: a consulta por opção de início já havia sido reduzida a uma leitura da agenda durante o teste de carga anterior à revisão.
Final: Ruling: HTTPS/99% mensal continuam metas operacionais — não podem ser comprovados em loopback; serão explicitados na entrega. Revisão visual completa, ACL da hospedagem e operação real de recuperação permanecem verificações manuais; backup/restore local possui teste automatizado.

Verificação final de carga: 50 usuários distintos, 150 consultas e 50 confirmações, zero erros; P95 128ms e 447ms, em loopback e dados temporários. Evidência: docs/compatibilidade/carga-local.json.
Graphify final: 448 nós, 1237 ligações; 28 requisitos prioritários e UC09 com fontes documentais. Nós antigos do README marcados como históricos; proteção de exportação respeitada sem forçar perda de nós.
Limpeza: pasta de trabalho preservada, pois não existe histórico Git que possa recuperar este ledger. Nenhuma publicação, merge, commit ou envio de mensagem realizado.
