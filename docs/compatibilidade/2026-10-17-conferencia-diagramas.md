# Conferência dos diagramas — 17/10/2026

**Atualização:** o desvio e os ajustes apontados abaixo foram tratados posteriormente em [resultado da adequação aos diagramas](2026-10-17-resultado-diagramas.md). Este arquivo preserva o diagnóstico anterior à correção.

## Conclusão

Os fluxos principais têm implementação e testes, mas não cabe declarar correspondência integral e literal com todos os diagramas. Há adaptações de arquitetura e um desvio identificado por leitura do tratamento de erros da interface de UC09. Esta conferência não altera o sistema publicado nem os documentos originais.

## Fontes e verificação

Foram lidas as cinco vistas editáveis da Entrega 1 corrigida, as sete vistas editáveis da Entrega 2 e os textos pertinentes dos dois documentos Word. Também foram inspecionadas as três imagens compostas identificadas como Atividades, Sequência e Objetos; elas reúnem as vistas complementares da Entrega 2.

Foram conferidos `server/domain.mjs`, `server/booking.mjs`, `server/app.mjs`, o schema PostgreSQL e a interface de reserva/reagendamento. O grafo foi usado como índice; as conclusões abaixo vêm das fontes originais e do código, não das ligações inferidas do grafo.

Nova execução local: `npm test` passou com 38 testes; `npm run test:postgres` passou com sete testes, incluindo a suíte principal. Estes resultados não são um ensaio completo de todos os caminhos da interface na produção.

## Comparação

| Diagramas | Resultado e limite |
|---|---|
| Casos de uso compartilhados e do barbeiro | Cadastro/login, consultas, seleção de serviços, reserva, cancelamento, gestão de horários/serviços, edição, status e relatório têm rotas e operações ativas. Testes cobrem autorização e regras centrais. Isso não substitui testar manualmente cada alternativa de interface. |
| Classes de usuários | Usuario/Cliente/Barbeiro existem, mas Cliente e Barbeiro não contêm os métodos operacionais desenhados no UML. Essas responsabilidades estão na API e em AgendaService. Equivalência funcional não significa correspondência literal entre métodos/classes. |
| Catálogo e agendamento | Entidades, enumerações, vínculos, totais e duração têm representação no sistema. Dinheiro usa centavos inteiros em vez de BigDecimal; serviços de uma reserva são snapshots JSON com identificadores, e não uma tabela associativa nem referências compartilhadas entre instâncias JavaScript. Essas são decisões de representação; os testes verificam valores históricos e identificadores compartilhados. |
| Atividades de alteração e validação/gravação | Servidor revalida responsável, PENDENTE, início futuro, serviços, janela e conflito; grava em transação e mantém a reserva original em rejeição/falha. A interface mantém proposta separada até confirmar. Há uma diferença no encerramento da edição quando a reserva se torna inelegível durante a confirmação, descrita abaixo. |
| Sequência principal e interação referenciada | Reagendamento, cálculo de preço/duração, checagem de janela/ocupação, exclusão da própria reserva dos conflitos e rollback têm implementação e testes. As chamadas passam por API/AgendaService, em vez da cadeia literal Barbeiro → Agendamento → Disponibilidade. As somas são independentes, mas executadas sequencialmente; o fragmento par/fork-join não representa paralelismo físico implementado. O texto diz que os cálculos podem ocorrer em paralelo, portanto isso não prova, isoladamente, erro funcional. |
| Objetos A/B/C e imagem composta | O teste do snapshot reproduz as três reservas, totais/durações, datas e identificadores compartilhados dos serviços. Os nomes/IDs/datas são exemplos fictícios da modelagem, não cadastros obrigatórios da produção. O banco real não precisa conter Ana/Diego nem ter as janelas de exemplo para atender às regras. |

## Desvio de interface identificado

As vistas de atividades e sequência determinam informar a rejeição e encerrar a edição se a reserva estiver inelegível na confirmação. Em `src/pages/System/Booking.jsx`, o catch da confirmação trata 409/422 retornando à etapa de data/horário. Ele não distingue uma escolha rejeitada da perda de elegibilidade nem recarrega a reserva original para encerrar esse caso.

Exemplo: a reserva é cancelada em outra sessão enquanto a edição continua aberta. O servidor recusa corretamente a alteração por não estar mais PENDENTE. Porém, a tela conserva o fluxo de revisão, em vez de encerrar a edição como desenhado. Este achado decorre da leitura do código; não foi provocado sobre uma reserva real da produção nesta conferência. Os testes de servidor passando não demonstram o encerramento correto da interface.

## O que ainda precisa de decisão/verificação

- Corrigir e testar na interface o ramo de inelegibilidade durante a confirmação.
- Registrar explicitamente a equivalência entre os métodos UML e a camada API/serviços, ou ajustar o código se a avaliação exigir a mesma distribuição de métodos pelas classes.
- Código de autorização, uso único, prazo de 24 horas e geração por terminal são decisões técnicas para RN01; não são exigências literais dos diagramas. `registroProfissional` consta como String, sem formato ou verificação externa definidos.
- Completar o ensaio manual das alternativas dos fluxos na instalação publicada. As metas de disponibilidade mensal, desempenho remoto e acessibilidade também não podem ser declaradas atendidas apenas por estes testes locais.
