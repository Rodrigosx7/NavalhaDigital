# Adequação Supabase/Vercel — 17/10/2026

As Entregas 1 corrigida e 2 continuam prioritárias. Esta entrega substitui a infraestrutura sem mudar os perfis, regras de reserva, estados, UC09, históricos ou pagamentos presenciais. O diagnóstico de 16/10 descreve a versão SQLite anterior; este documento complementa essa evidência para a arquitetura atual.

## Implementação

- Repositório assíncrono único para SQLite local e PostgreSQL/Supabase; API e contratos do React preservados.
- Função Node na Vercel, roteamento de `/api/*`, páginas React com acesso direto e configuração que exige banco/chave/HTTPS em produção.
- Schema privado `navalha`, RLS e revogação de privilégios públicos; login de execução restrito, separado da conexão de migração.
- Conexão PostgreSQL com pool, TLS validado, consultas parametrizadas e sem prepared statements nomeados. Parâmetros de query da URI não substituem a configuração TLS.
- Transação usa uma conexão e bloqueio consultivo transacional compartilhado entre instâncias. A restrição de exclusão no banco impede intervalos sobrepostos por barbeiro em reservas não canceladas.
- Chave AES fixa e fingerprint, dados pessoais/observações cifrados, senha com scrypt, sessões no banco e tentativas de autenticação compartilhadas. Não há fallback para SQLite na Vercel.
- Convites profissionais no banco, consumidos atomicamente e sem leitura de arquivo em cold starts.
- Migração de schema explícita e idempotente. Importação SQLite somente leitura, com destino novo e mesma chave; IDs e snapshots mantidos. RESTART transacional das identities preserva o estado após rejeição.
- Backup lógico autenticado/cifrado, recuperação em destino novo e sem reativar sessões antigas. Procedimentos e limites em `../deploy.md`.
- Dependências atualizadas para Vite 8, React Router 7 e pg. Frontend continua React 18, com as mesmas rotas e regras.

## Rastreabilidade documental

| Requisitos | Preservação na migração |
|---|---|
| RF01, RN01–02, RNF01–02 | Contas, convite profissional e sessão continuam no servidor; chaves fora do frontend; isolamento por ator mantido. |
| RF02–04, RN03–04, RN07, RN11 | Catálogo, múltiplos serviços distintos, janela integral, revisão, totais históricos e confirmação transacional preservados. |
| RF05, RN05 | Cancelamento com motivo antes do início, somente pendente, sem prazo adicional inventado. |
| RF06–07, RN06 | Agenda própria e UC09 mantêm ID/cliente/barbeiro/status, recalculam proposta e conservam original em falha. |
| RF08, RN08 | Quatro estados, finalização só pelo responsável após término, sem reabertura de finais. |
| RF09, RN10 | Disponibilidade própria, sem sobreposição e com proteção de reservas futuras. |
| RF10, RN12 | Relatório e CSV próprios, somente concluídos e valores históricos. |
| RN09 | Pagamento permanece exclusivamente presencial. |
| RNF03–06 | Saúde consulta o banco; testes nativos de concorrência/rollback; rotas e interface preservadas. Desempenho remoto, disponibilidade mensal e revisão visual da instalação continuam dependentes do ambiente real. |

## Evidências e revisão

- `npm test`: 38 testes aprovados, incluindo os 28 testes anteriores, isolamento de transação assíncrona, PostgreSQL em memória, importação/rollback/identities, segurança de TLS e concorrência na admissão de autenticação.
- `npm run test:postgres`: PostgreSQL nativo temporário em loopback, API em duas instâncias, dois processos concorrentes, replay de chave de confirmação, restrição SQL, rollback UC09, históricos, cancelamento, finalização/relatório, sessões e usuário restrito com RLS. Resultado da execução em `postgres-local.json`.
- `npm run build`: aprovado com Vite 8.3.4; 1593 módulos; JS aproximadamente 239 kB/76 kB gzip; CSS 34 kB/8 kB gzip.
- `npm run test:load`: repetido após o repositório assíncrono, 50 clientes distintos, 150 consultas e 50 confirmações, zero erros. P95 de 148 ms/1101 ms, respectivamente, no SQLite temporário em loopback. Não é medição do Supabase/Vercel.
- `npm audit`: zero vulnerabilidades conhecidas no resultado consultado em 17/10/2026. Isso não equivale a uma certificação de segurança.
- Revisão independente identificou três problemas importantes. Os três foram reproduzidos por testes e corrigidos: sobrescrita de TLS pela URI, mudanças de sequência após rollback e corrida na reserva de vaga de autenticação. Revisor confirmou as correções. A criação do usuário também passou a recusar rotação implícita e guardar a nova credencial antes de confirmar a transação.

## Estado externo

O usuário informou que ainda não criou os projetos Supabase/Vercel e pediu ajuda nessa etapa depois da adaptação. Portanto não houve conexão a um Supabase real, migração remota ou deploy Vercel verificado. O guia contém os comandos e variáveis necessários; `deploy:check` confere a URL real depois da publicação.

O repositório GitHub fornecido posteriormente pelo usuário é o destino do código: `Rodrigosx7/NavalhaDigital`. Bancos, segredos, logs, caches e o pacote acadêmico original local são excluídos da publicação. Nenhum dado do SQLite original foi movido ou apagado nesta preparação.
