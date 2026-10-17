# Supabase + Vercel — arquitetura autorizada

O usuário autorizou adaptar e publicar o projeto, preservando como prioridade as Entregas 1 corrigida e 2. O objetivo é operar pela internet sem depender do computador local. Implementação local e preparação da publicação estão autorizadas; publicação efetiva depende de acesso aos projetos e da configuração privada das credenciais.

## Decisões

- React/Vite estático na Vercel; `/api/*` encaminhado a uma função Node 24, sem servidor persistente nem arquivos graváveis em produção.
- Supabase usado como PostgreSQL, com `pg` e transaction pooler, consultas parametrizadas sem prepared statements nomeados. A API continua responsável por autenticação e permissões. Supabase Auth não integra esta migração.
- Repositório assíncrono compartilhado preserva contratos JSON e regras de domínio. SQLite permanece como modo local explícito; a Vercel exige PostgreSQL, HTTPS e chave configurados e nunca recua silenciosamente para SQLite.
- Schema privado `navalha`, sem acesso para público/anon/authenticated. Criação/alteração do schema por comando de migração do operador, nunca no início de uma função. Chaves e URLs somente no servidor.
- Transações usam uma conexão do pool, AsyncLocalStorage e bloqueio transacional no banco para serializar mutações do domínio, equivalente à exclusão de escrita do SQLite atual. Uma exclusion constraint também impede intervalos sobrepostos por barbeiro em reservas não canceladas. Essa serialização privilegia correção no volume inicial; desempenho remoto será medido no ambiente real.
- Cliente/Barbeiro, estados, múltiplos serviços distintos, históricos, cancelamento, UC09 e relatórios são preservados. Nenhum pagamento remoto, desconto ou novo perfil.
- Mantém AES-256-GCM, HMAC, scrypt, cookies HttpOnly/Secure/SameSite e CSRF. Chave fixa de 32 bytes em variável privada; fingerprint no banco detecta chave errada. Sessões persistem no banco; limites de tentativas de autenticação também devem funcionar entre instâncias.
- Convites são gravados no PostgreSQL por CLI do operador, consumidos atomicamente; nenhuma leitura de arquivo de convites por cold start.
- Migração SQLite→Postgres explícita e transacional para destino vazio; mantém IDs, snapshots e dados cifrados com a mesma chave; não importa sessões, idempotências transitórias ou convites antigos automaticamente. Origem não é modificada. Backup/restauração de produção usa ferramentas PostgreSQL/Supabase e preserva chave separada, com invalidação de sessões na restauração.

## Aceitação e limites

Testar regras existentes no SQLite e no motor PostgreSQL, rollback, conflitos, idempotência e múltiplas instâncias; build do frontend; handler Vercel e rewrites sem expor arquivos privados. Conexão ao Supabase, execução remota de migrações e teste do domínio publicado só podem ser declarados após verificação efetiva. Sem credenciais, entregar código, scripts e instruções concretos e indicar a pendência externa.
