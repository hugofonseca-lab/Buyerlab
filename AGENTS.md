<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## BuyerLab

- Stack: TanStack Start, React 19, TypeScript estrito, Tailwind 4, Nitro Node, SQLite.
- Requisitos: Node >=22.16, Bun >=1.2.22. Instalar: `bun install --frozen-lockfile`.
- Dev: `bun run dev --port 8080`. Produção: `bun run build`, `bun run start`.
- Qualidade: `bun run lint`, `bun run typecheck`, `bun run test`, `bun run test:e2e`.
- Playwright: `bunx playwright install chromium`; `CHROME_PATH` opcional para Chrome local.
- Preserve componentes Lovable, português brasileiro, dados fictícios, labels e foco visível.
- Não fazer commit, publicar ou enviar documentos sem autorização explícita.
- Sensíveis: `.env`, `.data/`, cookies, tokens e logs. Nunca versionar. `.env.example` sem segredos.
- Cliente importa somente cenário público e contratos. `src/server/*.server.ts` é exclusivo do servidor.
- Blueprint: `scenario.server.ts` + `rules.server.ts`; versionar mudanças de condições/matriz.
- Engine decide estados, eventos, degraus, acordo e pontos objetivos. IA apenas verbaliza e avalia evidências.
- Alteração de engine exige testes de seed, viabilidade, segurança, idempotência e avaliação.
- SQLite exige um processo Node e disco persistente; não usar em Workers ou filesystem efêmero.
- Migrations em `migrations/` aplicadas ao iniciar a API. Banco sempre fora de `public/`.
- Migração explícita: `bun run db:migrate`; preserve dados legados. Alumínio: `aluminum.server.ts`, `market.server.ts`, `sourcing-score.server.ts` e `docs/aluminum.md`.
- Uma troca por execução, estados/conversas por fornecedor; benchmark e TCO no servidor. Sourcing integra os 60 pontos, sem aumentar a escala 100.
- Mercado: `live-market.server.ts` consulta fontes no servidor; ver `docs/market-data.md`. Treinamento usa snapshot externo quando disponível; avaliação usa estático. Retry preserva snapshot persistido. Nunca rotular fallback simulado como cotação real nem expor chave Metals.Dev.
- Contrato atual do fornecedor: dado hipotético/mockado gerado em `aluminum.server.ts` (`generateSupplierContract`), tabela `supplier_contracts` (`003_supplier_contracts.sql`), endpoint `/api/simulations/:id/contrato`. Ver `docs/aluminum.md`.
- Painel de indicadores do dossiê (`market-indicators.server.ts`, `GET /api/market-indicators`) é independente do benchmark de negociação acima; não usar para pontuação. PTAX e IBGE SIDRA são públicos; alumínio exige `ALPHA_VANTAGE_API_KEY` própria, nunca expor a chave. Ver `docs/market-data.md`.
