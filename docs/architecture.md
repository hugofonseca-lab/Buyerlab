# Arquitetura

O fluxo principal agora é a compra paramétrica de alumínio. A extensão de domínio, migração aditiva, fornecedores independentes e histórico estão descritos em [Alumínio](aluminum.md). O desenho abaixo continua válido; o cenário K-17 permanece para compatibilidade.

TanStack Start/React/Tailwind preservados. Nitro usa preset `vercel` quando `VERCEL` está definido (build da própria Vercel) e `node-server` localmente (`bun run build && bun run start`, usado por e2e e verificação manual); o wrapper SSR encaminha `/api/*` ao servidor da simulação.

```mermaid
flowchart LR
  UI[React: briefing, chat, proposta, relatório] --> API[API / sessão HttpOnly]
  API --> Classifier[Regex + classify() de IA opcional]
  Classifier --> Engine[State Engine: advanceWithTags]
  Blueprint[Blueprint versionado] --> Engine
  Engine --> Actor[Supplier Actor: OpenAI, Gemini ou Mock]
  Engine --> Evaluator[Evaluator determinístico]
  Actor --> Qual[Qualitativo validado por evidências]
  Evaluator --> Coach[Coach pedagógico]
  Qual --> Coach
  API --> DB[(Postgres/Supabase / migrations)]
```

O classificador de intenção do comprador é sempre regex primeiro (`classifyBuyerMessage`), que decide sozinho as tags de segurança (antietico/extração de sistema). Só quando o regex não reconhece nada ("neutro") e há IA configurada, `provider.classify()` complementa com o mesmo vocabulário fechado de tags — nunca abre a classificação para texto livre, e o motor (`advanceWithTags`) continua sendo o único a decidir estado a partir das tags, venham elas de onde vierem.

## Separação

- `domain/scenario.ts`: projeção pública, mandato, dossiê e pesos.
- `server/scenario.server.ts` + `rules.server.ts`: blueprint privado v2.0.0, escada, pacotes, eventos, matriz e coeficientes.
- `engine.server.ts`: estados, ações, PRNG, abertura, profundidade de concessão contínua e sorteios.
- `concession.server.ts`: limites de concessão do turno (`ConcessionEnvelope`) a partir de confiança/reciprocidade.
- `providers.server.ts`: MockSimulationProvider, OpenAISimulationProvider, GeminiSimulationProvider (mesmas instruções e payload de contexto), Structured Outputs e validação.
- `evaluator.server.ts`: viabilidade, pontuação objetiva e enumeração do melhor resultado.
- `qualitative.server.ts`: fallback por ações e trechos observados.
- `coach.server.ts`: relatório pedagógico.
- `store.server.ts`: Postgres (Supabase); banco inacessível diretamente pelo frontend.

O modelo recebe perfil, conversa limitada, oferta autorizada e informações reveláveis. Não recebe piso nem estados numéricos; o motor os controla. Texto gerado não pode introduzir valores numéricos: o servidor anexa condições públicas. Isso restringe liberdade verbal para preservar consistência.

## API

`POST /api/simulations` exige JSON, Origin igual à aplicação e UUID em `Idempotency-Key`.

| action   | Campos                      | Resultado                       |
| -------- | --------------------------- | ------------------------------- |
| start    | config                      | execução pública                |
| message  | runId, text, expectedTurn   | snapshot e eventos              |
| notes    | runId, notes                | confirmação                     |
| finalize | runId, offer, accepted:true | resultado; avaliação persistida |
| evaluate | runId                       | avaliação final existente       |
| retry    | runId, sameSeed             | nova execução                   |
| share    | runId                       | token do relatório              |

`GET /api/simulations/:id` exige sessão proprietária. `GET /api/reports/:token` entrega somente relatório final. Erros estruturados: `error.code`, `error.message`.

## Persistência

Postgres (Supabase), via `postgres` (postgres.js) sobre o pooler de transação (porta 6543 — obrigatório em ambiente serverless; `prepare:false` porque o pooler multiplexa conexões físicas por transação). Migration `001_initial.sql` cria oito entidades de domínio, sessões, controle de versão, rate limits e idempotência; `Store.create()` aplica as três migrations e o seed automaticamente a cada conexão (idempotente: `CREATE TABLE IF NOT EXISTS`/`ON CONFLICT DO NOTHING`). UUID de execução independe da seed. Token de sessão tem 256 bits e é armazenado por hash.

Operações de cada sessão são serializadas **dentro do mesmo processo/instância** (`queues` em `api.server.ts`); em serverless com múltiplas instâncias simultâneas, essa serialização não é global — ver limitações abaixo. Turno esperado (`expectedTurn`) impede a maioria dos conflitos entre abas/requisições duplicadas. Transação Postgres real (`sql.begin`) grava execução, mensagens, snapshot, sorteios e resposta idempotente juntos; repetição retorna a mesma resposta. Não existe transação aberta durante chamada à IA. Rate limit usa `INSERT ... ON CONFLICT ... RETURNING` atômico (um único round-trip, sem corrida entre leitura e incremento).

Snapshots registram estado público/privado e provider utilizado. Eventos registram probabilidade, sorteio e resultado, inclusive não ocorrência. Postgres não tem RLS habilitado aqui: banco é exclusivo do servidor (a chave de conexão nunca chega ao cliente) e consultas filtram o proprietário na aplicação.

Deploy: Vercel (função serverless, preset `nitro: vercel`) + Supabase Postgres. `DATABASE_URL` aponta para o pooler de transação do Supabase. Duas instâncias simultâneas da função compartilham o mesmo banco (correto), mas não compartilham a fila de serialização por sessão em memória — uma corrida rara entre duas requisições *concorrentes* da mesma sessão em instâncias diferentes não é bloqueada por essa fila (o `expectedTurn` ainda barra a maioria dos casos reais, como duplo clique). Aceitável para um simulador educacional; não é a garantia de uma trava distribuída de verdade.

Referência da integração: [documentação oficial OpenAI de Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), consultada em 15/09/2026.
