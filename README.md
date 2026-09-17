# BuyerLab

Simulador educacional de negociação corporativa para o II Inovathon SemAd 2026. O fluxo principal gera uma compra de chapas de alumínio (5052-H32, 6061-T6 ou 7075-T6), com três fornecedores comparáveis, uma troca permitida e avaliação híbrida. Todos os dados são fictícios. Execuções antigas do Módulo K-17 permanecem compatíveis.

## Compra paramétrica de alumínio

A interface acompanha a [referência atualizada do Lovable no GitHub](docs/ui-reference.md), com dossiê em abas, chat com painel lateral e diálogo de troca. O material é definido pela seed; o documento mostra como fixar 6061-T6 por link para a demonstração.

- A seed congela material, demanda, estoque, mercado e candidatos. Repetir a seed preserva as condições quando os parâmetros e versões também são iguais.
- Compare Nexa Alumínio Nacional, Atlas Metais Internacionais e Circular Chapas Industriais. Preços em reais por tonelada; componente importado incorpora exposição cambial.
- Uma troca justificada preserva conversas e inicia uma relação independente. Homologação, capacidade, prazo, custo de troca e momento da decisão afetam a viabilidade.
- O servidor calcula o melhor TCO viável por enumeração. Sourcing integra os 60 pontos objetivos; a IA avalia até 40 pontos com evidências reais. Falhas usam avaliação provisória por regras.
- `/historico` reúne relatórios da sessão anônima e compara grupos compatíveis de material, rubrica, dificuldade, modo e origem da avaliação. Apagar cookies perde o acesso local ao histórico.
- Mercado v1 é uma referência educacional estática de 16/09/2026, não uma consulta real a cotações. Consulte [regras e fórmulas](docs/aluminum.md).
- Links antigos com seed e sem `cenario=aluminum` continuam abrindo o cenário legado.

Migrations aditivas: `bun run db:migrate` (também aplicadas automaticamente pela API). Preserve o banco e faça backup com o servidor parado antes de atualizar uma instalação existente.

## Cotações de mercado

Novos treinamentos consultam PTAX no Banco Central e uma fonte pública de alumínio, sem chave. A data é verificada; fallback é identificado como **SIMULADO**. A fonte pública de alumínio estava desatualizada em 16/09/2026: não há garantia de preço diário gratuito. Conector opcional com chave própria, configuração e limites em [docs/market-data.md](docs/market-data.md). Execuções existentes mantêm o snapshot original; inicie uma nova variação para consultar o mercado.

## Indicadores de mercado do dossiê

O topo do dossiê do cenário (`/preparacao/:runId`) mostra um painel independente do motor de negociação: PTAX (compra/venda), preço do alumínio primário e o índice de produção industrial do IBGE, além de uma projeção de tendência para o próximo trimestre. Endpoint `GET /api/market-indicators`, cache diário e fallback por indicador — nunca quebra a tela. Fontes, limites e a variável `ALPHA_VANTAGE_API_KEY` estão documentados em [docs/market-data.md](docs/market-data.md).

## Contrato atual com o fornecedor

Cada cenário de alumínio inclui um contrato hipotético/mockado com o fornecedor incumbente (categoria, valor, vigência, reajuste, SLA, desempenho histórico e multa de rescisão), gerado de forma determinística pela seed. Consulte via `GET /api/simulations/:id/contrato` ou na aba "Contrato atual" do dossiê. Não é uma integração real com nenhum fornecedor.

## Executar

Requisitos: **Node.js 22.16+** e **Bun 1.2.22+**. Node executa servidor e testes; Bun instala dependências. Não executar com `bun --bun`: o banco usa `node:sqlite`.

```sh
bun install --frozen-lockfile
cp .env.example .env
bun run dev --port 8080
```

No PowerShell: `Copy-Item .env.example .env`. Abra `http://localhost:8080`. Mock funciona sem cadastro ou chave.

```sh
bun run build
bun run start
```

Execute da raiz, mantendo `migrations/` disponível. A migration é aplicada no primeiro acesso à API. `.data/buyerlab.sqlite` persiste execuções, mensagens, estados, sorteios e relatórios. Backup: copie `.data/` com servidor parado. Nunca coloque o banco em `public/`.

### Ferramentas portáteis nesta máquina Windows

Runtimes locais estão em `.tools/`, ignorado pelo Git. Antes dos comandos nesta máquina:

```powershell
$env:PATH = "$PWD/.tools;$PWD/.tools/bun-windows-x64;" + $env:PATH
```

Em outra máquina, instale os requisitos normalmente.

## Variáveis no servidor

| Variável                        | Uso                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BUYERLAB_PROVIDER=mock`        | Sem API externa                                                                                                                                                                                                                                                                                                                                        |
| `BUYERLAB_PROVIDER=openai`      | OpenAI com fallback automático (padrão)                                                                                                                                                                                                                                                                                                                |
| `OPENAI_API_KEY`                | Chave secreta                                                                                                                                                                                                                                                                                                                                          |
| `OPENAI_MODEL`                  | Modelo da conta compatível com Responses e Structured Outputs; nenhum nome fixo no código                                                                                                                                                                                                                                                              |
| `BUYERLAB_PROVIDER=gemini`      | Google Gemini como alternativa ao OpenAI, com o mesmo contrato de segurança e fallback                                                                                                                                                                                                                                                                 |
| `GEMINI_API_KEY`                | Chave secreta; gratuita em [aistudio.google.com/apikey](https://aistudio.google.com/apikey)                                                                                                                                                                                                                                                            |
| `GEMINI_MODEL`                  | Modelo da conta compatível com saída JSON estruturada; nenhum nome fixo no código. Validado com `gemini-3.1-flash-lite` (~5-25s por resposta). Modelos "thinking" (ex.: `gemini-3.6-flash`) responderam de forma correta mas muito mais lentos (20s+ até para "diga oi"); variantes "flash" não-lite tiveram picos de indisponibilidade (503) no teste |
| `BUYERLAB_DB_PATH`              | Padrão `.data/buyerlab.sqlite`                                                                                                                                                                                                                                                                                                                         |
| `PORT`                          | Porta de produção; exemplo 8080                                                                                                                                                                                                                                                                                                                        |
| `CHROME_PATH`                   | Opcional: Chrome local nos testes E2E                                                                                                                                                                                                                                                                                                                  |
| `BUYERLAB_MARKET_PROVIDER=live` | Mercado do benchmark de negociação consultado no servidor; `static` para ensaio offline                                                                                                                                                                                                                                                                |
| `METALS_DEV_API_KEY`            | Opcional: conector de alumínio do benchmark com chave própria, exclusivamente no servidor                                                                                                                                                                                                                                                              |
| `ALPHA_VANTAGE_API_KEY`         | Painel "Indicadores de mercado" do dossiê: preço do alumínio (`function=ALUMINUM`). Gratuita em [alphavantage.co](https://www.alphavantage.co/support/#api-key); sem chave, o indicador aparece como SIMULADO                                                                                                                                          |

Sem chave/modelo, falha, timeout ou saída inválida, usa mock. Avaliação qualitativa de fallback aparece como **provisória**. Uma chamada por turno e uma avaliação final. SDK com timeout de 12 segundos, no máximo uma repetição, limite total de recuperação de 26 segundos. `store:false`. Nunca usar chave em `VITE_*`.

## Qualidade

### Fornecedor por IA e avaliação híbrida

O fornecedor usa OpenAI quando `.env` contém `BUYERLAB_PROVIDER=openai`, `OPENAI_API_KEY` e `OPENAI_MODEL` válidos, ou Gemini quando contém `BUYERLAB_PROVIDER=gemini`, `GEMINI_API_KEY` e `GEMINI_MODEL` válidos. Reinicie o servidor após configurar. Sem credenciais ou em caso de falha, a interface identifica o fornecedor mock; isso não comprova uma conexão com a IA. Os dois provedores usam exatamente as mesmas instruções de segurança e o mesmo contexto (`src/server/providers.server.ts`), diferindo só no SDK e no formato de saída estruturada.

A nota final soma **60 pontos objetivos calculados pelo motor** e **até 40 pontos qualitativos avaliados pela IA**, com trechos e IDs de mensagens validados no servidor. A IA não altera a parte objetiva. Se a avaliação de IA falhar, a parte qualitativa usa regras e o relatório fica marcado como provisório. A integração real precisa ser validada com uma execução completa após configurar as credenciais.

```sh
bun run lint
bun run typecheck
bun run test
bunx playwright install chromium
bun run build
bun run test:e2e
```

E2E inicia build em modo mock e usa `.data/e2e.sqlite`. Não testar contra servidor com dados reais. Windows com Chrome instalado: `$env:CHROME_PATH='C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'`.

## Demonstrar

A cobertura de perfis, seeds, eventos e contextos está descrita em [Validação das variações](docs/variation-validation.md). A matriz automatizada inclui 6.480 execuções e seus replays; não representa cobertura de toda linguagem natural possível.

Abra `/configurar?modo=treinamento&perfil=colaborativo&seed=DEMO2026`. Leia o dossiê, investigue custos/forecast, use dados e trocas condicionais. Estruture e confirme a proposta. Recarregar retoma a sessão. Mesma seed preserva condições; nova variação gera outra seed. Copiar link cria acesso ao relatório por sete dias. Imprimir/salvar usa o navegador.

[Roteiro de cinco minutos](docs/demo-script.md) · [Arquitetura](docs/architecture.md) · [Cenário](docs/scenario-authoring.md) · [Pontuação](docs/scoring.md) · [Segurança](docs/security.md) · [Descrição da solução](docs/solution-description.md).

## Limitações

Uma instância Node com disco persistente; não funciona como banco durável em Workers ou filesystem serverless efêmero. Frontend Lovable preservado; publicação no Cloudflare do Lovable exige adaptador compatível e não foi realizada. Classificação heurística pode errar intenção. Seed reproduz condições, não texto da IA. Fronteira comercial simplificada, custo direto sem monetizar capital de giro/estoque/risco de parada. Não certifica pessoas. Integração OpenAI real requer credenciais e validação na conta do usuário.

O BuyerLab é uma simulação educacional baseada em modelos simplificados de comportamento. Seus resultados não substituem análise profissional nem preveem integralmente o comportamento humano.
