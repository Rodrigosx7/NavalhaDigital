# Adequação documental Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Executar os dez RF e as doze RN do pacote prioritário em um sistema local integrado, registrando separadamente as metas operacionais de RNF ainda não medidas.

**Architecture:** Preservar React/Vite e o estilo atual; acrescentar API Node e SQLite transacional. A API deriva responsabilidades da sessão e calcula valores/durações. A interface não usa localStorage para contas ou reservas.

**Tech Stack:** React 18, Vite 5, Node 24, node:sqlite, node:crypto, node:test.

**Spec:** docs/superpowers/specs/2026-10-16-adequacao-documental-design.md

## Global Constraints

- Documentos enviados prevalecem. Apenas Cliente e Barbeiro; estados PENDENTE/CONCLUIDO/NAO_COMPARECEU/CANCELADO.
- Um ou mais serviços, barbeiro específico, cliente cadastrado e janela obrigatórios; sem repetição, descontos, taxas ou integrações de notificação.
- Cancelamento/reagendamento: reserva pendente e início futuro, sem antecedência mínima adicional. Conclusão/falta apenas pelo barbeiro após término.
- Preservar históricos, totais e duração; revalidar dentro da mesma transação que grava.
- Sem commits/worktrees: esta pasta não é um repositório Git. Não apagar dados legados.
- A autorização do usuário para começar a adequação em 16/10/2026 cobre execução nesta sessão. Não interromper para repetir aprovação entre etapas.

## Review Focus

- Dois usuários competindo pelo mesmo intervalo: somente uma confirmação, sem gravação parcial.
- Reagendamento e alterações de janela que invalidam reservas futuras: rejeição mantém o estado anterior.
- IDs e perfis adulterados: identidade sempre derivada da sessão; nenhum acesso cruzado.
- Catálogo alterado após reserva: totais/duração históricos independentes; preço zero válido.
- Data/hora em São Paulo, limites de grade e término; preservar escolhas quando uma confirmação falha.

### Task 1: Domínio e persistência

**Files:** server/domain.mjs, server/security.mjs, server/store.mjs; tests/system.test.mjs.
**Interfaces:** createApplication({databasePath,keyPath,authorizedBarbers,clock}) retorna {server,store,close}; API JSON em /api. Entidades/DTOs em português, IDs numéricos, dinheiro em centavos no banco e preco/valorTotal decimal na API.

- [x] Escrever testes de cadastro, sessão e cálculo/grade/overlap antes de implementar e verificar falha por módulo inexistente.
- [x] Implementar classes e armazenamento SQLite com transações, chaves estrangeiras, hash de senha com salt e PII cifrada.
- [x] Rodar node --test tests/system.test.mjs; verificar regras numéricas e ausência de PII em banco/backup.

### Task 2: Autenticação e catálogo/janelas

**Files:** server/app.mjs, server/index.mjs; tests/system.test.mjs.
**Interfaces:** /auth/cadastro, /auth/login, /auth/sessao, /auth/sair, /conta, /catalogo, /clientes, /servicos, /disponibilidades. Cookie de sessão HttpOnly, token CSRF retornado em /auth/sessao e enviado em X-CSRF-Token nas escritas autenticadas.

- [x] Exercitar primeiro cadastro duplicado, profissional sem autorização, acesso sem sessão e gerenciamento cruzado.
- [x] Implementar permissões por usuário e gestão de serviços/janelas; proteger janelas com reservas futuras.
- [x] Verificar cadastro/login/logout, categoria/preço/duração e desativação sem perda histórica.

### Task 3: Reservas, cancelamento e UC09/status

**Files:** server/booking.mjs, server/app.mjs; tests/system.test.mjs, tests/concurrency-worker.mjs.
**Interfaces:** GET /horarios?barbeiroId&servicoIds&data&excluirId; GET/POST /agendamentos; GET /agendamentos/:id; PUT /agendamentos/:id; POST /agendamentos/:id/cancelar; POST /agendamentos/:id/status. Reserva inclui objetos cliente/barbeiro/servicos e campos totais/status do modelo.

- [x] Testar seleção repetida/inativa, conflito e concorrência antes de corrigir implementação.
- [x] Implementar validação e gravação atômicas, motivo de cancelamento e UC09 com preservação do original.
- [x] Verificar snapshot de E2 com relógio fixo, limites de tempo, estados finais e dois processos escrevendo no mesmo banco.

### Task 4: Interface integrada

**Files:** src/services/api.js, src/contexts/AuthContext.jsx, src/contexts/BookingContext.jsx, src/pages/System/*, src/App.jsx, Header/Footer e páginas institucionais.
**Interfaces:** api(path,{method,body}) usa cookies e CSRF; useAuth expõe usuario,carregando,entrar,cadastrar,sair,atualizar; catálogo fornece servicos/barbeiros/disponibilidades públicas sem PII. As páginas antigas ficam fora das rotas ativas.

- [x] Implementar cadastro/login/conta e proteção de rotas por papel.
- [x] Adaptar fluxo de múltiplos serviços, cliente próprio ou selecionado pelo barbeiro, revisão, erros preservados e comprovante protegido.
- [x] Implementar listagem cliente e painel profissional com agenda diária/semanal, edição, cancelamento, status, catálogo, janelas e relatórios.
- [x] Remover extras incompatíveis das rotas/menus/textos e verificar npm run build.

### Task 5: Relatórios, segurança e operação local

**Files:** server/app.mjs, scripts/dev.mjs, scripts/backup.mjs, scripts/load-test.mjs, package.json, vite.config.js, .gitignore, README.md.
**Interfaces:** GET /relatorios?inicio&fim retorna somente CONCLUIDO do barbeiro; /api/health sem PII. node scripts/backup.mjs cria backup cifrado com a chave local externa ao banco. npm run dev inicia API e Vite juntos em loopback.

- [x] Testar período invertido, limites inclusivos, usuário incorreto, valores históricos e CSV sem fórmulas executáveis.
- [x] Incluir backup/restauração testáveis, cookies/CSRF/origem, limite de payload, limite de tentativas e chaves fora do bundle.
- [x] Executar carga com 50 usuários no ambiente local e registrar resultados reais; não declarar 99% mensal ou HTTPS de produção verificados localmente.

### Task 6: Aceitação e revisão

**Files:** docs/compatibilidade/*, docs/superpowers/progress-adequacao.md, README.md, AGENTS.md.

- [x] Rodar suíte completa, build e verificações HTTP do site/API/Graphify; registrar evidências por RF/RN/RNF.
- [x] Solicitar uma revisão independente de todo o conjunto e corrigir achados importantes com regressão antes da entrega.
- [x] Atualizar matriz e instruções com o que foi implementado e os limites operacionais reais.

## Verificação esperada

node --test tests/*.test.mjs deve passar; npm run build deve gerar dist sem importações quebradas; npm run dev deve servir site em 5174 e API em 5180, ambos apenas em loopback. Nenhuma publicação ou envio de mensagens faz parte desta execução.
