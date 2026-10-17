# Supabase + Vercel Implementation Plan

> Execução nativa nesta sessão; usar executing-plans. Autorização direta do usuário: adaptar tudo para Supabase e publicar na Vercel, documentos como prioridade.

**Goal:** preparar e validar o sistema completo para PostgreSQL/Supabase e Vercel.
**Architecture:** repositório assíncrono, pool PostgreSQL, função Node e frontend estático.
**Tech Stack:** Node 24, pg, PostgreSQL, React/Vite, Vercel.
**Spec:** docs/superpowers/specs/2026-10-16-supabase-vercel-design.md.

## Restrições globais

Preservar RF/RN/UC; não sobrescrever banco existente; nunca publicar dados/chaves/documentos; não afirmar deploy sem URL validada. Ambiente atual não é repositório Git, portanto não criar worktree ou commits fictícios. Credenciais não devem aparecer em saídas.

## Review Focus

Perda de resposta e replay; concorrência de dois processos; chave ausente/incorreta; dados privados por Data API/frontend; transações e inicialização simultâneas sem apagar convites.

## Tarefas

- [x] 1. Escrever testes de configuração/repositório/transações/handler inicialmente falhando. Introduzir contratos assíncronos na API e agenda, mantendo testes locais verdes. Arquivos: server/repository.mjs, server/app.mjs, server/booking.mjs, tests/system.test.mjs, tests/concurrency-worker.mjs.
- [x] 2. Implementar adapter `PostgresDatabase` com `prepare().get/all/run`, `transaction(operation)`, `close()`, schema/migração e testes PostgreSQL. Arquivos: server/postgres.mjs, supabase/migrations/0001_navalha.sql, scripts/database.mjs, tests/postgres.test.mjs. Transactions fixam conexão; nenhuma mutação depende de memória de instância.
- [x] 3. Implementar configuração segura/handler Vercel, `/api/*` e fallback SPA. Arquivos: server/config.mjs, server/runtime.mjs, api/index.mjs, vercel.json, .vercelignore, .env.example. Erros de configuração são genéricos no HTTP e não revelam segredos.
- [x] 4. Implementar autorização profissional remota e importação SQLite com verificação de chave/destino vazio, preservação de IDs, snapshots e contagens e invalidação de sessões. Arquivos: scripts/authorize.mjs, scripts/import-sqlite.mjs. Rejeições não alteram destino/origem.
- [x] 5. Executar suíte e build, revisar independentemente, corrigir problemas e documentar passos de configuração/deploy. Tentar publicação apenas quando acesso e variáveis estiverem disponíveis; caso contrário registrar exatamente dependências externas. Atualizar README, AGENTS e rastreabilidade.

## Publicação externa

Adaptação e validação local concluídas. Projetos Supabase/Vercel ainda serão criados com o usuário; nenhum deploy remoto é declarado. Envio do código ao repositório GitHub foi autorizado posteriormente e é registrado no ledger.
