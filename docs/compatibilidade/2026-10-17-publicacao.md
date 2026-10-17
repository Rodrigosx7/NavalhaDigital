# Publicação — 17/10/2026

Site: https://navalha-digital-rodrigosx7.vercel.app

Vercel: projeto `navalha-digital`, Git `Rodrigosx7/NavalhaDigital`, branch `main`, Node 24, funções em São Paulo (`gru1`). Primeiro deploy de produção: `a662576`, status Ready. Supabase: projeto Navalha Digital em São Paulo (`sa-east-1`), schema privado `navalha`, versão 1, nove tabelas com RLS e os três serviços dos documentos.

## Configuração conferida

- API conecta pelo Transaction pooler com `navalha_app`; conexão administrativa fica somente local.
- Login restrito não pode criar tabelas nem alterar a configuração da chave.
- Chave de criptografia original mantida; TLS verifica certificado e hostname com a CA oficial do Supabase.
- `DATABASE_URL`, `NAVALHA_ENCRYPTION_KEY` e `NAVALHA_DATABASE_CA` salvos como Secret exclusivamente em Production. `APP_ORIGIN` identifica a origem HTTPS pública.
- Banco e segredos locais não foram versionados. Documentos originais continuam preservados localmente.

## Verificação na instalação publicada

`npm run deploy:check -- https://navalha-digital-rodrigosx7.vercel.app` passou: início, login, URL interna direta, saúde da API, catálogo e recusa de agenda sem sessão (401).

Teste adicional pela API HTTPS real passou com uma conta sintética temporária:

- Cadastro, cookie `Secure`/`HttpOnly`/`SameSite=Strict`, recuperação da sessão e consulta autenticada.
- Escrita sem CSRF e origem externa recusadas (403).
- Logout revoga a sessão; reutilizar o cookie anterior não abre a agenda (401).
- Novo login recupera o cadastro persistido no Supabase; dados pessoais armazenados cifrados.
- Conta temporária, sessões e limites correspondentes removidos, sem alterar usuários reais.

No navegador, o menu Agendar abriu `entrar?destino=%2Fagendar`, com a explicação de autenticação obrigatória e o destino preservado no link de cadastro.

Antes da publicação, passaram os 38 testes gerais, os sete testes de PostgreSQL nativo e o build Vite. O teste de provisionamento agora usa um operador sem SUPERUSER, reproduzindo a restrição real do PostgreSQL gerenciado antes de verificar a credencial de execução.

## Preparação operacional restante

O banco remoto começou apenas com o catálogo documental. Não foram importados automaticamente cadastros do SQLite nem criados barbeiros ou disponibilidades fictícias. Um profissional real precisa receber autorização, cadastrar sua conta e configurar suas janelas para abrir horários aos clientes.

Reservas, conflitos simultâneos, reagendamento UC09, relatórios e restauração têm cobertura local com PostgreSQL nativo; esses fluxos ainda não foram exercitados com profissionais reais na produção. Esta verificação não comprova disponibilidade mensal nem substitui a rotina de backups e monitoramento.
