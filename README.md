# Navalha Digital

Sistema web de gerenciamento de agendamentos, alinhado às Entregas 1 corrigida e 2 de Émily Ricardo e Rodrigo Justo. Os documentos originais em `docs/referencias/pacote-completo/` são a referência principal.

## Supabase e Vercel

O sistema suporta PostgreSQL no Supabase e API/React na Vercel. O código e os testes locais foram adaptados; **os projetos externos ainda precisam ser criados e configurados**, e não existe deploy remoto verificado nesta entrega.

O guia completo está em [docs/deploy.md](docs/deploy.md): criação dos projetos, chave privada, migração do schema, importação opcional do SQLite, usuário restrito, variáveis da Vercel, publicação e recuperação. O login atual permanece; não é necessário Supabase Auth. `vercel.json` configura API e páginas React.

```powershell
npm run chave:preparar
# Preencher .env.local privadamente conforme o guia
npm run db:migrate
# Opcional, somente para destino novo, preservando a chave original:
npm run db:importar
npm run db:usuario
# Trocar DATABASE_URL pela credencial restrita salva em .secrets/vercel.env
npm run db:check
```

`DATABASE_URL` ativa PostgreSQL; sem ela, o desenvolvimento mantém SQLite. A Vercel exige PostgreSQL, chave fixa e origem HTTPS e nunca usa arquivos locais como fallback. Não adicionar prefixo `VITE_` aos segredos nem expor o schema `navalha` na Data API.

`npm run test:postgres` inicia PostgreSQL nativo temporário e verifica regras, duas instâncias e disputa entre dois processos. `npm test` também verifica o motor PostgreSQL via PGlite, migração, configuração e HTTP. Para conferir uma publicação real: `npm run deploy:check -- https://DOMINIO-REAL.vercel.app`.

No modo PostgreSQL, `npm run autorizar` grava o convite imediatamente no banco, sem reiniciar a API; backups usam `npm run db:backup -- criar`. Os procedimentos SQLite abaixo continuam válidos para o modo local.

## Rodar localmente

Requer Node 24.x.

```powershell
npm install
npm run dev
```

Abra http://127.0.0.1:5174/. O comando inicia a API em 127.0.0.1:5180 e o Vite na porta 5174. As portas são fixas e o sistema informa erro se estiverem ocupadas. Ambos escutam somente em loopback.

`npm run build` gera o frontend em `dist/`. Para conferir o build local, mantenha `npm run api` em um terminal e `npm run preview` em outro.

## Primeiros acessos

1. Crie uma conta de cliente em `/cadastro`, informando nome, e-mail, telefone e senha de 10 a 128 caracteres.
2. O operador verifica o profissional fora do sistema e executa `npm run autorizar -- email-do-profissional@exemplo.com`. O comando exibe um código pessoal de uso único, vinculado ao e-mail e válido por 24h. Reinicie a API e entregue o código ao profissional verificado. Não existem contas, senhas ou e-mails profissionais autorizados automaticamente.
3. O profissional escolhe Barbeiro autorizado no cadastro, informa o código pessoal e seus dados e cria sua própria senha. Só conhecer um e-mail não permite obter esse perfil.
4. Entre como barbeiro e cadastre suas janelas em `/barbeiro/horarios`. Nenhuma janela real é inventada automaticamente.
5. Os clientes poderão escolher esse profissional, combinar serviços, consultar horários e confirmar a reserva. O barbeiro também pode reservar em nome de um cliente já cadastrado.
6. A antiga credencial admin/1234 e a busca pública por telefone não concedem acesso ao novo sistema.

Para autorizar outro profissional, o operador faz a verificação fora do sistema e executa:

```powershell
npm run autorizar -- profissional@exemplo.com
```

Reinicie a API após a alteração. `--revogar` remove a autorização para **cadastro futuro**, sem excluir ou desativar contas existentes. A lista em `.secrets/profissionais.json` guarda índices HMAC do e-mail e hash do código, sem e-mails ou códigos em texto aberto. O código é consumido na mesma transação que cria a conta. Não existe um terceiro perfil de administrador no produto.

## Regras implementadas

- Cadastro/login de Cliente e Barbeiro, com e-mail único, autorização profissional e dados opcionais do cliente.
- Catálogo com categoria, preço não negativo, duração positiva e desativação sem perda histórica.
- Janelas semanais por profissional, grade de início, ausência de sobreposição e proteção de reservas futuras.
- Reservas com um ou mais serviços ativos sem repetição, cliente e barbeiro específicos, duração total e revisão.
- Revalidação e escrita SQLite na mesma transação; conflito rejeita sem gravação parcial.
- Reagendamento UC09 pelo barbeiro responsável; mantém identificador, cliente, barbeiro e PENDENTE; atualiza valores pela seleção vigente e preserva o original em falha.
- Cancelamento com motivo somente para pendentes antes do início, sem prazo adicional de 2h.
- Estados PENDENTE, CONCLUIDO, NAO_COMPARECEU e CANCELADO; conclusão/falta só pelo barbeiro após o término, sem reabrir estados finais.
- Totais e duração históricos registrados; mudanças no catálogo não alteram as reservas já gravadas.
- Relatório/CSV apenas dos próprios atendimentos concluídos, período inclusivo e valores registrados.
- Pagamento exclusivamente presencial. Não há cupons, descontos, taxas, quitação ou notificações externas no fluxo ativo.

## Dados e proteção

A API armazena dados em `.data/navalha.sqlite`. Dados pessoais e observações são cifrados com AES-256-GCM; a unicidade do e-mail usa HMAC. Senhas usam scrypt com salt aleatório; sessões opacas têm cookie HttpOnly/SameSite, expiração, logout e CSRF. As permissões são verificadas em cada operação.

A chave fica em `.secrets/navalha.key`, fora do banco e do bundle. **Guarde essa chave separadamente e proteja suas permissões de acesso.** Sua perda torna os dados cifrados irrecuperáveis; a aplicação se recusa a gerar outra chave para um banco existente. Chave e banco não são servidos pelo Vite. Em ambiente de hospedagem, configure o armazenamento seguro da chave e as permissões dos arquivos.

Os diretórios de dados/chaves, temporários e logs são ignorados pelo Git. Dados antigos do navegador não são importados nem apagados automaticamente. Eles não possuem necessariamente contas, propriedade ou duração histórica verificáveis. Não trate o novo banco como uma migração completa do legado.

## Backup e restauração

```powershell
npm run backup -- criar
npm run backup -- restaurar .data/backups/arquivo.enc .data/restaurado.sqlite
```

O backup é uma cópia consistente do SQLite, cifrada e autenticada. A restauração exige a chave original, só grava um **novo arquivo**, invalida todas as sessões e nunca sobrescreve um banco existente. É necessário novo login. Valide a cópia antes de trocar o arquivo em uso. Mantenha backups e chave em locais protegidos distintos.

## Verificações

```powershell
npm test
npm run build
npm run test:load
```

Os testes cobrem as regras e o cenário numérico da Entrega 2, permissões entre usuários, valores históricos, estados, CSRF, rollback com falha SQLite real e dois processos disputando um intervalo. O teste de carga cria **50 contas distintas em banco temporário**, mede consultas e confirmações simultâneas e grava resultados em `docs/compatibilidade/carga-local.json`.

## Limites operacionais

A aplicação local usa HTTP de loopback. **HTTPS, custódia da chave e backups em produção ainda precisam de configuração e verificação na instalação real.** Na Vercel, a API exige PostgreSQL, `NAVALHA_ENCRYPTION_KEY` e `APP_ORIGIN=https://...`, habilita cookie Secure e usa o encaminhamento de `/api` definido em `vercel.json`. Migrações não rodam durante cold starts.

Configure as autorizações profissionais explicitamente antes de iniciar produção. Não publique `graphify-out/`, fontes, documentos ou chaves junto do `dist/` por engano.

Na agenda aberta há um botão Atualizar para renovar dados e liberar ações cujo horário de término já passou; a tela não faz atualização automática contínua.

99% de disponibilidade mensal é uma **meta**, que exige monitoramento no ambiente real durante o horário cadastrado. O teste de carga local registra somente o cenário medido; não garante desempenho de qualquer hospedagem ou volume de dados.

## Rastreabilidade e Graphify

- `docs/compatibilidade/2026-10-16-matriz-documentos-sistema.md`: auditoria inicial das divergências.
- `docs/compatibilidade/2026-10-16-resultado-adequacao.md`: estado após implementação e evidências.
- `docs/superpowers/specs/2026-10-16-adequacao-documental-design.md`: decisões de arquitetura.
- `graphify-out/graph.html`: mapa interativo disponível localmente em http://127.0.0.1:5174/graphify-out/graph.html.

As páginas antigas de demonstração foram mantidas no código como referência, mas não pertencem mais às rotas ativas. Não reative cupons, avaliações, status CONFIRMADO ou acesso por telefone sem alterar formalmente a especificação.
