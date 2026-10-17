# Publicar Navalha Digital — Supabase + Vercel

As Entregas 1 corrigida e 2 continuam sendo a especificação do produto. Esta migração troca a infraestrutura; não acrescenta perfis, pagamentos, descontos ou notificações.

**Situação em 17/10/2026:** projetos Supabase e Vercel criados. Schema privado instalado no Supabase, chave original conferida e conexão do usuário restrito validada com o certificado oficial. Segredos configurados somente em Production na Vercel. Publicação e validação do domínio público em andamento. Testes locais não significam publicação concluída.

## 1. Criar os projetos, com acompanhamento

1. No Supabase, criar um projeto dedicado ao Navalha Digital. Escolher uma região próxima aos usuários e às funções da Vercel. Guardar a senha do banco em um gerenciador de senhas; não enviar pelo chat.
2. Em **Connect**, copiar a conexão PostgreSQL do **Transaction pooler** para execução da API. Copiar separadamente a conexão direta ou **Session pooler** para migração/administração; a conexão direta pode exigir IPv6.
3. Na Vercel, criar/vincular um projeto Vite na pasta atual. O projeto `navalha-digital` está conectado a `Rodrigosx7/NavalhaDigital`, branch `main`. Os documentos originais, bancos e segredos permanecem fora do Git. Um push para `main` pode iniciar uma publicação automaticamente; configurar o banco e as variáveis primeiro.
4. Identificar o domínio de produção atribuído pela Vercel; usar essa origem exata em `APP_ORIGIN`, incluindo `https://`, sem caminho ou barra final.

Não é necessário habilitar Supabase Auth nem usar `supabase-js`. O login existente permanece na API; os dados ficam no schema privado `navalha`, que não deve ser adicionado aos schemas expostos da Data API.

## 2. Preparar credenciais localmente

Requer Node **24.x**. Instalar com `npm ci`. Copiar `.env.example` para `.env.local`, que é ignorado pelo Git e pela Vercel.

```powershell
npm run chave:preparar
```

O comando copia a chave local existente para `.secrets/chave-vercel.env` em base64, sem exibi-la no terminal. Se já existir banco e a chave original estiver ausente, o comando recusa gerar outra. Se o arquivo de saída já existir, não o sobrescreve. Guardar a chave em local protegido separado dos backups; sua perda impede recuperar os dados pessoais.

Preencher **privadamente** `.env.local`:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | URI PostgreSQL do Transaction pooler; não é a URL HTTPS do projeto. |
| `DATABASE_MIGRATION_URL` | URI owner direta ou Session pooler; usada somente pelo operador. |
| `NAVALHA_ENCRYPTION_KEY` | Valor de `.secrets/chave-vercel.env`. Manter a mesma chave se importar dados locais. |
| `APP_ORIGIN` | Origem final do site na Vercel. |
| `NAVALHA_DATABASE_CA` | Somente se necessário, certificado CA confiável em PEM. Não desabilitar verificação TLS. |

Copiar as URIs pelo painel e substituir a senha localmente. Caracteres reservados na senha precisam estar codificados para uma URI. Não colar URIs, senhas ou arquivos `.env` no chat.

Se a conexão exigir a CA do Supabase, baixar **Download certificate** em **Database → Settings → SSL configuration** e configurar o conteúdo PEM em `NAVALHA_DATABASE_CA`. O erro `SELF_SIGNED_CERT_IN_CHAIN` é resolvido fornecendo a CA oficial ao driver, sem desativar a validação TLS. No `.env`, pode-se usar uma string entre aspas com `\n` literais; na interface da Vercel, colar o PEM completo com suas quebras de linha.

## 3. Criar o schema e decidir sobre os dados locais

```powershell
npm run db:migrate
npm run db:check
```

Migração cria schema, tabelas, índices, RLS e a restrição que impede reservas sobrepostas, e vincula a chave ao banco. Repetir com a mesma versão/chave apenas confere a instalação; não apaga dados. Nenhuma migração ou importação roda durante um acesso HTTP ou cold start.

O banco recebe somente o catálogo inicial dos documentos: Corte R$40/30min, Barba R$25/20min e Hidratação R$20/15min. Não recebe clientes, profissionais ou disponibilidades inventados.

Se quiser preservar cadastros e reservas do SQLite atual, **antes de começar a usar o banco remoto**:

```powershell
npm run backup -- criar
npm run db:importar
```

A importação lê SQLite em modo somente leitura e exige chave idêntica e destino novo, com no máximo o catálogo original inalterado. Mantém IDs, hashes de senha, dados cifrados, vínculos, valores/durações históricos e snapshots. Falha causa rollback; destino ocupado é recusado. Sessões, convites e confirmações antigas não são transferidos. Para uma origem diferente: `npm run db:importar -- C:\caminho\origem.sqlite`.

Para começar sem dados locais, apenas não executar a importação. O arquivo local permanece preservado.

## 4. Criar usuário restrito para a API

```powershell
npm run db:usuario
```

O operador usa `DATABASE_MIGRATION_URL` para criar o login `navalha_app`, sem privilégios de superusuário, criação de bancos/roles ou bypass de RLS. O usuário recebe acesso às tabelas do sistema pelas políticas da API, mas não pode alterar o schema ou a configuração da chave. As permissões de cliente/barbeiro continuam verificadas em cada endpoint.

O comando salva as variáveis em `.secrets/vercel.env` sem mostrar senhas. A URI é derivada de `DATABASE_URL`; por isso ela deve apontar para o Transaction pooler correto antes do comando. Após a criação, substituir a URI owner em `DATABASE_URL` pela URI restrita desse arquivo e executar `npm run db:check` novamente. Guardar `DATABASE_MIGRATION_URL` somente na máquina do operador.

O operador de um PostgreSQL gerenciado não precisa ser superusuário. O script confere que o login de execução não possui atributos elevados e só altera as propriedades permitidas ao operador. Se a CA foi necessária para conectar, incluí-la também na configuração de execução da Vercel; ela é independente da URI gerada.

Repetir `db:usuario` com um usuário já existente é recusado. Para uma rotação intencional, usar `npm run db:usuario -- --rotacionar`; ele grava um novo arquivo `.secrets/vercel-rotacao-<data>.env` antes de confirmar a senha no banco. Atualizar a variável correspondente na Vercel e republicar. Arquivos anteriores não são sobrescritos.

Não compartilhar a credencial de execução com o navegador nem com clientes. Ela permite operar as tabelas para o backend e depende das verificações da API para aplicar a propriedade de cada registro.

## 5. Configurar e publicar na Vercel

Adicionar como variáveis privadas de servidor, no ambiente **Production**:

- `DATABASE_URL` do usuário restrito/Transaction pooler.
- `NAVALHA_ENCRYPTION_KEY` original.
- `APP_ORIGIN` final em HTTPS.
- `NAVALHA_DATABASE_CA`, apenas se a conexão exigir esse CA.

**Não usar prefixo `VITE_` para segredos. Não enviar `DATABASE_MIGRATION_URL`, arquivos SQLite, chave binária ou documentos à Vercel.** `.vercelignore` exclui arquivos privados, documentos, Graphify, testes e scripts de operação do upload. `dist/` contém apenas o frontend; a função importa somente o backend necessário.

Configuração já está em `vercel.json`: Vite, `npm run build`, saída `dist`, API em função Node e fallback das páginas React. Escolher Node 24 nas configurações. Escolher, quando disponível no plano, uma região de função próxima ao Supabase. Cada instância abre no máximo três conexões; o pooler mantém as conexões PostgreSQL sob controle. Confirmar limites do plano conforme o volume real.

Na pasta do projeto, depois do login e vínculo na conta correta:

```powershell
npm test
npm run test:postgres
npm run build
npx vercel --prod
```

`npx vercel` pede autenticação quando necessário. Não publicar até as variáveis/schema/chave estarem conferidos. Instalações **Preview** devem ter banco separado, chave correspondente e `APP_ORIGIN` própria; não compartilhar o banco de produção com previews públicos. Em produção, ausência de configuração gera indisponibilidade controlada; não há fallback para um banco temporário.

## 6. Conferir o endereço publicado

```powershell
npm run deploy:check -- https://DOMINIO-REAL.vercel.app
```

O teste é somente leitura: início, URLs internas diretas, API, catálogo e proteção da agenda. Depois testar manualmente na URL real:

1. Criar cliente e acessar novamente com sua senha; confirmar persistência após nova publicação.
2. Autorizar barbeiro e criar conta profissional; cadastrar janelas reais.
3. Reservar múltiplos serviços, conferir duração/preço e testar disputa do mesmo intervalo em duas sessões.
4. Reagendar pelo barbeiro responsável, cancelar com motivo e conferir liberação do horário.
5. Após o término, finalizar e conferir relatório/CSV com valores históricos.
6. Confirmar HTTPS/cookie Secure, logout, acesso cruzado negado e ausência de segredos no bundle/logs.

Não há credencial padrão ou conta de administrador.

## Autorizar profissionais na nuvem

Com `.env.local` apontando para o PostgreSQL correto:

```powershell
npm run autorizar -- profissional@exemplo.com
npm run autorizar -- profissional@exemplo.com --revogar
```

O primeiro comando emite código pessoal de uso único/24h, que o operador entrega ao profissional verificado. PostgreSQL aplica imediatamente, sem reiniciar funções. Revogar só impede cadastro futuro; não altera contas existentes. O email é indexado com HMAC, o código é armazenado como hash e consumido na transação de cadastro.

## Backup e recuperação

```powershell
npm run db:backup -- criar
npm run db:backup -- restaurar C:\backup\arquivo.enc
```

O backup lógico cobre usuários/senhas cifradas, catálogo, janelas e reservas com snapshots; é consistente com as mutações da API e cifrado/autenticado com AES-256-GCM. Armazenar cópias fora da máquina e guardar a chave separada. Não inclui sessões/convites/limites transitórios e não substitui uma estratégia de recuperação de toda a infraestrutura.

Para restaurar, preparar **outro banco/projeto novo** com a mesma chave, executar `db:migrate`, apontar as variáveis do operador para ele e executar `db:backup -- restaurar`. Destino ocupado é recusado. Validar contagens/históricos e login antes de trocar as variáveis da publicação. Nenhuma sessão antiga é reativada.

Também configurar a política de backups oferecida pelo plano Supabase escolhido. Se restaurar um backup completo nativo que contenha sessões, antes de liberar tráfego limpar `navalha.sessoes`, `navalha.operacoes` e `navalha.tentativas`, exigindo novo login. Monitorar externamente site/API e medir a meta mensal de disponibilidade dos documentos; os testes locais não comprovam 99% mensal.

## Fontes oficiais

- [Conexões Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Segurança dos dados](https://supabase.com/docs/guides/database/secure-data)
- [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Node na Vercel](https://vercel.com/docs/functions/runtimes/node-js)
