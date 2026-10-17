# Correção após conferência dos diagramas

Autorização: solicitação direta do usuário em 17/10/2026, mantendo o pacote original como referência principal.

1. Reproduzir a perda de elegibilidade na confirmação de UC09. Identificar esse resultado no servidor e encerrar a edição na interface; escolhas rejeitadas continuam revisáveis e respostas incertas conservam a confirmação idempotente.
2. Distribuir os comandos de usuário nas classes Usuario, Cliente e Barbeiro, com persistência assíncrona delegada aos serviços da aplicação. Usar esses comandos nas rotas reais. Manter validações, autorização, transações, históricos e contratos HTTP.
3. Conferir as cinco vistas da Entrega 1 e sete da Entrega 2, incluindo os exemplos de objetos. Registrar equivalências de tipos, snapshots e cálculos independentes; não introduzir gravações paralelas nem alterar os documentos originais.
4. Executar regressões, PostgreSQL temporário, build e ensaio de interface isolado. Revisar o diff, corrigir achados e publicar a versão verificada pelo fluxo Git/Vercel já autorizado.

Limites: não alterar cadastros ou reservas reais nos ensaios. Disponibilidade mensal e desempenho remoto exigem medições próprias e não são comprovados pela correspondência dos diagramas.
