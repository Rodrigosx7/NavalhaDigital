# Compatibilidade entre os documentos e o sistema

Data da análise: 16/10/2026. Esta matriz compara as fontes do pacote com o código lido nesta sessão. Nenhuma adequação funcional foi implementada nesta etapa.

## Fontes

- E1: `../referencias/pacote-completo/01_Entrega_1_Corrigida/Navalha_Digital_Entrega_1_corrigida.pdf`. As páginas indicadas abaixo são páginas físicas do PDF; a numeração impressa é uma unidade menor a partir da definição de escopo.
- E2: `../referencias/pacote-completo/02_Entrega_2/Navalha_Digital_Entrega_2.docx`, seções citadas por título.
- Diagramas: pastas `Diagramas/` das duas entregas e as três imagens compostas da pasta `03_Tres_Diagramas_Identificados/`.
- Código: `src/`, `package.json`, `vite.config.js` e `README.md`.
- Graphify: `graphify-out/graph.json` contém o retrato inicial de 168 nós, 505 ligações e 8 comunidades, anterior à indexação do pacote. O grafo orientou a localização dos arquivos; a verificação das regras foi feita lendo as fontes.

Legenda: **ausente**, **parcial** ou **divergente** descrevem a implementação observada. Não são resultados de testes de execução.

## Requisitos funcionais

| Código | Documento | Situação observada | Adequação necessária e evidência principal |
|---|---|---|---|
| RF01 | E1 p. 5, RN01 e RN02 | Ausente | Criar cadastro/login de Cliente e Barbeiro com nome, e-mail único, telefone e senha; autorizar profissionais fora do sistema. `AdminLoginPage.jsx` usa admin/1234 e `RequireAdmin.jsx` confia em sessionStorage. Não há cadastro de clientes. |
| RF02 | E1 p. 5 e p. 8 | Parcial | Manter nome, descrição, categoria, preço não negativo, duração positiva e ativo. `AdminServices.jsx` tem cadastro/edição, mas não categoria nem desativação; `BookingContext.jsx` exclui serviços fisicamente. |
| RF03 | E1 p. 5 e RN04/RN10; E2 §5.2 | Parcial | Calcular duração de todos os serviços e usar janela do barbeiro. `getAvailableSlots()` usa horário global e só um serviço. A opção com barbeiro nulo diverge da associação obrigatória. |
| RF04 | E1 p. 5 e p. 12–13 | Divergente | Exigir cliente cadastrado, barbeiro específico e serviços múltiplos sem repetição; resumo e revalidação na gravação. `BookingPage.jsx` guarda um `serviceId`, nome/telefone livres, admite barbeiro nulo e não revalida o intervalo ao gravar. |
| RF05 | E1 p. 5 e p. 14 | Parcial | Cancelar apenas PENDENTE antes do início, com motivo, autoria e histórico. `cancelAppointment()` altera qualquer registro por ID, sem verificar perfil, horário ou estado. |
| RF06 | E1 p. 5 | Parcial | Filtrar agenda diária/semanal pelo barbeiro autenticado no servidor. `AdminDashboard.jsx` e `AdminAgenda.jsx` exibem dados globais do navegador. |
| RF07 | E1 p. 15; E2 §§1.2, 2, 3 e 5.1 | Ausente | Implementar alteração pelo barbeiro responsável, sem mudar ID, cliente ou barbeiro; revisar, recalcular, excluir a própria reserva dos conflitos e efetivar tudo ou nada. Não há fluxo de edição persistida nem operação de reagendamento. |
| RF08 | E1 p. 8, RN08 | Divergente | Usar PENDENTE, CONCLUIDO, NAO_COMPARECEU e CANCELADO. Apenas barbeiro pode registrar conclusão/falta após o término previsto. O código usa confirmed/completed/cancelled, não possui falta e oferece Compareci ao cliente. |
| RF09 | E1 p. 5 e RN10 | Ausente | Criar gestão de janelas semanais por barbeiro, com grade positiva, limites válidos e proteção de reservas futuras. `businessHours.js` é uma constante global. |
| RF10 | E1 p. 5 e RN12 | Divergente | Relatar somente CONCLUIDO do barbeiro autenticado, período inclusivo válido e total registrado. `AdminReport.jsx` exporta todos os estados e soma confirmed/completed em métricas globais; usa linguagem de faturamento. |

## Regras de negócio

| Código | Fonte | Situação e critério de aceitação |
|---|---|---|
| RN01 | E1 p. 7 | Ausente. Cadastro exige nome, e-mail único, telefone e senha; nascimento/endereço opcionais no cliente; sem restrição etária inventada. O profissional só obtém perfil Barbeiro se previamente autorizado fora do sistema. |
| RN02 | E1 p. 7 | Divergente. Todas as operações de agenda autenticadas; cliente só opera suas reservas; barbeiro só sua agenda, podendo reservar para cliente cadastrado. Busca pública por telefone e flag admin não satisfazem a regra. |
| RN03 | E1 p. 7; E2 §1.3 | Parcial. Data e hora juntas devem ser futuras; hoje é permitido se o início ainda não ocorreu. Exigir cliente, barbeiro e pelo menos um serviço ativo sem repetição, com revisão antes de confirmar. |
| RN04 | E1 p. 7; E2 §§3.5 e 5.2 | Parcial. Somar durações, caber integralmente numa janela ativa e impedir sobreposição com qualquer reserva não cancelada do mesmo barbeiro. Revalidar atomicamente ao gravar. Intervalos consecutivos são permitidos. |
| RN05 | E1 p. 7 e p. 14 | Divergente. Somente PENDENTE com início futuro; aplicar CANCELADO, registrar motivo/dataAtualizacao, liberar intervalo e manter histórico. Não há prazo adicional de 2h nem cooldown. O comprovante atual afirma limite de 2h. |
| RN06 | E1 p. 7 e p. 15; E2 §5.1 | Ausente. Barbeiro responsável pode reagendar reserva pendente ainda futura. Rejeição, desistência e falha mantêm integralmente os dados originais. |
| RN07 | E1 p. 8; E2 §§3.5 e 5.3 | Divergente. Total é soma exata dos preços, sem desconto/taxa; registrar valorTotal e duracaoTotalMinutos. Catálogo posterior não altera reservas; edição confirmada usa valores vigentes. Cupons e duração consultada no catálogo atual violam a regra. |
| RN08 | E1 p. 8; E2 §6.1 | Divergente. Nova reserva inicia PENDENTE; conclusão/falta só pelo barbeiro após o término; cancelamento por operação própria; estados finais não retornam. Compareci sobre cancelado também viola a irreversibilidade. |
| RN09 | E1 p. 4 e p. 8; E2 §1.1 | Parcial. Pagamento exclusivamente presencial, sem cobrança, quitação, pagamentos ou receita recebida. Não há processamento de pagamento, mas rótulos de faturamento/receita precisam mudar. |
| RN10 | E1 p. 8; E2 §5.2 | Ausente. Janelas por profissional/dia com início < fim, intervalo positivo e sem sobreposição ativa. Alteração/desativação deve ser rejeitada se invalidar reserva futura pendente. Grade parte da hora inicial e não exige duração múltipla do intervalo. |
| RN11 | E1 p. 8 | Divergente. CORTE/BARBA/TRATAMENTO/OUTRO; preço >= 0, duração > 0, ativo. Desativação impede novas escolhas, sem apagar vínculos históricos; janelas utilizadas também não são excluídas. |
| RN12 | E1 p. 8 | Divergente. Apenas CONCLUIDO, próprio barbeiro e limites inclusivos com início <= fim; utilizar valorTotal gravado. Não interpretar o relatório como recebimentos. |

## Requisitos não funcionais

| Código | Fonte | Situação e verificação necessária |
|---|---|---|
| RNF01 | E1 p. 6 e p. 23 | Não atendido. PII no localStorage em texto aberto, senha demo no bundle e ausência de camada servidor. Implementar hash com salt, criptografia de PII persistida/backups, HTTPS e gestão de chaves. HTTP local não comprova HTTPS de produção. |
| RNF02 | E1 p. 6 e p. 23 | Não atendido. Autorização deve ocorrer em cada operação no servidor. Testar acesso cruzado entre clientes/barbeiros por IDs e parâmetros adulterados. |
| RNF03 | E1 p. 6 e p. 23 | Meta não medida. >=99% mensal durante funcionamento, excluindo manutenções comunicadas; requer hospedagem, monitoramento e janela mensal definida. Nenhum build local comprova essa meta. |
| RNF04 | E1 p. 6 e p. 23 | Meta não medida. P95 <=2s nas consultas e confirmações com até 50 usuários simultâneos em ambiente especificado. Exige teste de carga, cenário, erros e percentis registrados. |
| RNF05 | E1 p. 6 e p. 23; E2 §§2.1, 3.5 e 5.1 | Não atendido. localStorage não garante transação compartilhada entre usuários. Exige validação/gravação na mesma transação, teste concorrente de sobreposição e falha forçada com rollback. |
| RNF06 | E1 p. 6 e p. 23 | Parcial, sem auditoria visual integral nesta etapa. Há layout responsivo, formulário e resumo; falta preservação coerente das escolhas após rejeição real do servidor. Validar telas móveis, teclado e mensagens dos fluxos documentados. |

## Recursos atuais que não pertencem à base documental

- Cupons e descontos contradizem RN07; retirar a aplicação e o cadastro da versão alinhada.
- Compareci pelo cliente contradiz RN02/RN08; retirar a ação e deixar status no painel do barbeiro.
- Lembrete externo e promessa de envio 24h antes contradizem a delimitação do escopo; retirar a promessa e qualquer automação desse tipo.
- Integração de reserva com Google Calendar e avaliações não estão nos casos de uso; retirar do fluxo principal da versão acadêmica, sem acrescentar entidades ao modelo por causa desses extras.
- Dono/admin global não é um terceiro perfil de domínio. O painel profissional deve representar o Barbeiro autenticado.
- Sobre, Contato e apresentação visual podem permanecer como conteúdo institucional, desde que não inventem requisitos, garantias de serviço ou identidades reais da barbearia.

## Cenário de referência da Entrega 2

Usar relógio controlado de 23/10/2026 08:00 para o snapshot e 07:45 para o ato de edição. Trata-se de fixture, não do horário real do sistema.

| Reserva | Cliente | Barbeiro | Serviços | Início final | Valor | Duração |
|---|---|---|---|---|---|---|
| 401 | Ana Souza, id 1 | Diego Rocha, id 101 | Corte 201 + Barba 202 | 23/10/2026 09:00 | R$65,00 | 50 min |
| 402 | Bruno Lima, id 2 | Eduardo Silva, id 102 | Corte 201 | 23/10/2026 10:00 | R$40,00 | 30 min |
| 403 | Carla Alves, id 3 | Felipe Costa, id 103 | Barba 202 + Hidratacao 203 | 23/10/2026 11:00 | R$45,00 | 35 min |

As janelas 301–303 são de sexta-feira, 08:00–18:00, grade de 10 minutos. A reserva 401 muda de 10:00 para 09:00, com dataAtualizacao 07:45; mantém ID e PENDENTE. Os hashes fictícios desenhados nos diagramas não devem ser importados como credenciais reais.

## Conclusão

O site atual é uma demonstração local que não satisfaz o conjunto documental. A adequação exige domínio, autenticação, persistência transacional e interface conectados, além da verificação de infraestrutura. A proposta correspondente está em `../superpowers/specs/2026-10-16-adequacao-documental-design.md`.
