# BuyerLab — Plano do MVP

Simulador de negociação com fornecedor interpretado por IA, com dossiê, sala de negociação, proposta final estruturada e diagnóstico por evidências. No MVP tudo roda com um motor mock determinístico por seed, atrás de uma camada de serviço trocável por API real depois.

## Premissas registradas

- Sem login, sem backend no MVP. Persistência local no navegador.
- Um único cenário (Orion x Nexa) com muitas variações internas.
- Idioma da interface: português do Brasil.
- Dados 100% fictícios; nenhuma marca de terceiros.
- Não haverá painel de instrutor complexo: apenas configurar + gerar link.

## 1. Rotas e arquitetura de informação

```text
/                     Apresentação (marca, promessa, CTAs)
/configurar           Modo, dificuldade, perfil, urgência, seed
/instrutor            Configuração avançada + geração de link
/preparacao/$runId    Dossiê em abas + anotações privadas
/negociacao/$runId    Sala de negociação (chat + proposta pública)
/proposta/$runId      Proposta final estruturada + resumo
/diagnostico/$runId   Relatório de desempenho (imprimível)
/impacto              ODS e aplicabilidade
```

Configuração compartilhável por query string em `/configurar` e `/instrutor` (`?modo=&dif=&perfil=&urgencia=&seed=`). Cada rota tem `head()` próprio.

## 2. Jornada do usuário

1. Abre a home, entende em 15 segundos o que é e clica em "Iniciar treinamento".
2. Escolhe modo e dificuldade (padrões prontos, pode só clicar em iniciar).
3. Lê o dossiê: mandato, contrato, desempenho do fornecedor, riscos, alternativas. Anota.
4. Negocia por turnos. O fornecedor responde conforme perfil, estado emocional oculto e escada de concessões. Eventos condicionais aparecem como cartões.
5. Quando pronto, estrutura a proposta final; vê resumo e confirma.
6. Recebe diagnóstico com nota, resultado, melhor resultado viável, perda de oportunidade, evidências por turno, forças, oportunidades, erros críticos e recomendação.
7. Repete com a mesma seed, gera nova variação, copia link ou imprime.

## 3. Componentes e estados de interface

- `Header` / `Footer` (com o aviso educacional), `SectionHero`, `FeatureCard`.
- `ConfigForm` com labels reais, ajuda por campo, `SeedField` (gerar/copiar).
- `DossierTabs` com cartões: empresa, mandato, contrato, mercado, histórico, entrega/qualidade, riscos, notas.
- `NotesPanel` (privado, autosave local), reutilizado na negociação em bloco recolhível.
- `ChatTranscript` + `MessageBubble` (papéis distintos por forma, ícone e rótulo, não só cor), `Composer` (Enter envia, Shift+Enter quebra linha), `TypingIndicator`, `TurnCounter`, `EventCard`, `PublicOfferPanel`.
- `FinalOfferForm` (13 campos) + `OfferReview`.
- `ScoreDial`, `CompetencyBars`, `EvidenceList`, `TimelineDecisive`, `ReportActions`.
- Estados: vazio, carregando, enviando, erro com "tentar novamente", execução retomada, execução encerrada, sem execução encontrada.
- Acessibilidade: foco visível, `aria-live` no transcript, alvos ≥44px, `prefers-reduced-motion`, contraste AA, folha de impressão para o relatório.

## 4. Identidade visual

Tokens em `src/styles.css`: fundo claro neutro + superfícies; azul-marinho profundo como primária, teal como acento analítico, âmbar para alertas/eventos. Tipografia: display geométrica para títulos, sans neutra para texto. Cartões sóbrios, sem gradiente roxo, sem foto de executivo. Nenhuma cor fixa em componentes — só tokens e variantes.

## 5. Modelos de dados (contratos futuros do backend)

Em `src/domain/`, tipos apenas:

- `ScenarioBlueprint` — id, versão, `PublicBrief`, `BuyerMandate`, variáveis negociáveis, `ConcessionLadder`, `ConditionalEvent[]`, pesos de pontuação.
- `PublicBrief`, `BuyerMandate` (limite R$107, demanda, estoque, impacto de parada, alternativa).
- `SupplierPrivateConfig` — alvo ~R$112, piso R$105, ocupação, cliente concorrente, interesses, moedas de troca, sensibilidades. Arquivo separado marcado como provisório (`supplier.private.mock.ts`).
- `ConcessionLadder` — degraus 118/114/112/109/107/105 com pré-requisitos.
- `SimulationRun` — id, seed, modo, dificuldade, perfil, urgência, criado em, status.
- `PublicNegotiationState` — turno, oferta pública, eventos visíveis, status.
- `PrivateNegotiationState` — confiança, frustração, abertura, pressão, poder, aversão a risco, relacionamento (0–100), degrau atual, contrapartidas obtidas. Nunca renderizado.
- `NegotiationMessage` — id, turno, autor, texto, `BuyerActionTag[]`.
- `StructuredFinalOffer`, `EvaluationReport`, `EvidenceReference`, `Outcome` (`acordo | acordo_fragil | impasse | encerrado`).

## 6. Camada de serviço

```ts
interface SimulationProvider {
  createRun(config): Promise<SimulationRun>;
  getRun(runId): Promise<RunSnapshot>; // só estado público
  sendBuyerMessage(runId, text): Promise<TurnResult>;
  submitFinalOffer(runId, offer): Promise<Outcome>;
  getReport(runId): Promise<EvaluationReport>;
}
```

`MockSimulationProvider` (MVP, localStorage + PRNG por seed) e `ApiSimulationProvider` (stub que já compila, apontando para futuras server functions). A UI consome só a interface, via um contexto/`useSimulation`.

## 7. Funcionamento do simulador mock

1. PRNG determinístico (mulberry32) semeado por `seed` → perfil, confiança inicial, poder, urgência, ordem e sorteios de eventos. Mesma seed = mesma execução.
2. Classificador de mensagem do comprador por heurística (léxico + padrões): pergunta aberta, diagnóstico, uso de dados, ancoragem, demanda, proposta, concessão unilateral, troca condicional, ameaça, empatia, reformulação, resumo, fechamento, pedido antiético, tentativa de extrair sistema/limites.
3. Atualização de estados privados por perfil: ameaça derruba confiança e sobe frustração (mais forte em defensivo); dados sobem abertura em analítico; empatia sobe relacionamento em colaborativo; firmeza fundamentada ganha respeito do dominante.
4. Escada de concessões: só desce um degrau quando os pré-requisitos daquele degrau estão satisfeitos (argumento crível, reciprocidade, contrapartidas relevantes). Nunca abaixo de R$105.
5. Resposta roteirizada condicional: template escolhido por (perfil × estado × ação do comprador × degrau), com variação lexical pela seed. Pedido de prompt/limites → recusa firme sem revelar nada.
6. Eventos: verificação por turno com pré-requisitos e probabilidades (18/20/15/20/15%), 0–2 no treinamento, controlado pela seed na avaliação. Nunca liberam concessão impossível.
7. Persistência: `buyerlab.run.<id>` + índice de execuções; retomada após recarregar. Modo "falha simulada" para demonstrar erro e nova tentativa.
8. Pontuação: 60 determinísticos calculados da proposta final versus limites do cenário (valor comercial 20, continuidade/lead time 15, qualidade/risco 15, condições/fechamento 10) + 40 qualitativos por ações efetivamente detectadas, cada ponto ancorado em um turno real. Sem evidência, sem ponto. Melhor resultado viável derivado dos limites do cenário; perda de oportunidade = viável − alcançado.
9. Trajetórias demonstráveis garantidas: comprador eficaz > comprador fraco; tentativa indevida recusada e penalizada em ética.

## 8. Etapas de implementação

**P0 (obrigatório)**

1. Design system + layout base + rodapé com aviso.
2. Domínio, cenário e dados privados mock; PRNG; provider abstrato.
3. Home, Configuração, Instrutor (link + seed).
4. Preparação (dossiê + anotações).
5. Motor mock: classificador, estados, escada, respostas, eventos.
6. Sala de negociação completa com persistência e estados de erro.
7. Proposta final + resumo + confirmação.
8. Diagnóstico com nota, evidências, timeline, ações (repetir, nova variação, copiar link, imprimir).
9. Impacto; README e `docs/especificacao.md`; polimento, mobile, console limpo.

**P1 (se houver tempo)**

- Dicas discretas no treinamento; comparativo entre execuções da mesma seed; exportar relatório em JSON; micro-gráfico de evolução da conversa; atalhos de teclado extra.

## 9. Critérios de aceite e testes

- Iniciar sem instruções; nenhum botão sem função; console sem erros.
- Mesma seed reproduz a mesma abertura, perfil e eventos; nova seed varia.
- Estados privados e piso de preço nunca aparecem no DOM (verificação por busca no transcript).
- Caminho eficaz gera nota e preço melhores que o caminho fraco.
- Tentativa de extrair prompt/limites é recusada e registrada como falha ética.
- Recarregar a página retoma a execução; encerrar leva ao diagnóstico.
- Relatório imprimível legível; navegação completa por teclado; ok em 375px e desktop.
- Verificação de fluxo com Playwright nas três trajetórias.

## 10. Riscos e simplificações

- Classificador heurístico pode errar intenção → léxico amplo + fallback neutro que não pune.
- Respostas roteirizadas podem parecer repetitivas → variação lexical por seed e por estado.
- Escopo grande para o prazo → P1 só depois do fluxo P0 fechado; nenhum cenário extra.
- Dados privados no cliente são provisórios e assim marcados; migram para o servidor na versão com IA real.
- Sem voz, avatar, multiplayer, ranking, autenticação, pagamentos ou RAG.
