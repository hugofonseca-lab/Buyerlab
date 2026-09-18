# Validação final — 15/09/2026

> Nota (17/09/2026): este relatório é um retrato daquela execução específica; o número de testes, o preset do Nitro e o banco de dados mudaram desde então (ver [Arquitetura](architecture.md)). Em particular, a limitação de SQLite/instância única descrita no item 2 abaixo foi resolvida com a migração para Postgres (Supabase).

## Resultado

MVP local demonstrável validado em modo mock, com persistência no servidor. Nenhum commit, envio externo, publicação ou submissão foi realizado.

| Verificação               | Resultado                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `bun run lint`            | Código 0; nenhum erro; sete avisos de Fast Refresh em componentes existentes                                |
| `bun run typecheck`       | Código 0; inclui aplicação, testes e configurações                                                          |
| `bun run test`            | 18 testes aprovados em três arquivos                                                                        |
| `bun run build`           | Código 0; saída Node em `.output/`                                                                          |
| `bun run test:e2e`        | Oito testes aprovados, desktop e celular, incluindo XSS                                                     |
| `bun run dev --port 8081` | Inicializado; home HTTP 200 e `/api/session` respondeu `ready:true`                                         |
| Bundle público            | Busca sem ocorrências de `privateState`, `precoPiso`, `confiancaMinima`, `eventPolicies` e `OPENAI_API_KEY` |

Logs locais estão em `.tools/final-*.log`; códigos de saída em `.tools/final-results.json`. `.tools/` é ignorado no versionamento. O Node 22.16 emite aviso de que `node:sqlite` é experimental; isso não impediu testes nem execução. O PowerShell registra stderr informativo do Bun como `NativeCommandError` nos logs; o resultado da verificação foi determinado pelo código real de saída do processo.

## Cobertura executada

- PRNG, condições da mesma seed, nova seed, avaliação controlada, deltas por perfil e estados limitados.
- Escada completa, contraprestações, rejeição de preço abaixo do piso, acordo válido e benchmark enumerado.
- Pré-condições, janela e máximo de eventos; registro de sorteio e probabilidade.
- Pontuação e soma do relatório; comprador eficaz supera comprador fraco.
- Sessão anônima, isolamento entre proprietários, retomada por outra conexão SQLite, persistência e idempotência concorrente.
- Finalização única, aceite explícito, avaliação somente ao final e compartilhamento autorizado.
- JSON inválido, oferta alterada pela IA, evidência fabricada, pontuação excessiva, timeout e fallback.
- Prompt injection, CSRF, limite de mensagem, rate limit e XSS renderizado como texto.
- Fluxo de negociação ao relatório em desktop e celular, recarga, notas, falha de transporte/retry, mesma seed e nova variação.
- Botões de copiar relatório e imprimir, mídia de impressão, controles do instrutor e foco por teclado.

O roteiro eficaz de quatro mensagens em treinamento colaborativo obteve **86/100 e acordo a R$107**. O roteiro fraco terminou em impasse por preço abaixo da oferta autorizada. O roteiro de manipulação preservou as regras. Capturas desktop/móvel do relatório estão em `test-results/` (artefatos locais ignorados).

## Linha de base e preservação

Foram lidas as instruções, o plano arquivado Lovable e a especificação. A pasta recebida não continha `.git`, e inicialmente não havia Git/Node/npm/Bun no PATH. As primeiras tentativas de lint/build não puderam executar; os runtimes portáteis e as dependências foram instalados para viabilizar a validação. A primeira medição executável ocorreu durante a implementação, não constitui uma baseline limpa do código original. A formatação foi ajustada às regras de lint existentes; stack e identidade visual foram preservadas.

## Limitações que permanecem

1. OpenAI está implementada e validada estruturalmente, mas não foi chamada com chave/modelo reais. Configurar `OPENAI_API_KEY`, `OPENAI_MODEL` e `BUYERLAB_PROVIDER=openai` para validar na conta de destino.
2. SQLite exige um processo Node e volume persistente. Publicação no ambiente Cloudflare do Lovable requer adaptador de persistência compatível; não foi realizada.
3. Classificação heurística e avaliação qualitativa são modelos simplificados, não certificação de competência. Fallback aparece como provisório.
4. Benchmark usa custo direto unitário; não monetiza capital de giro, estoque ou todos os riscos.
5. Testes de acessibilidade cobrem comportamento básico; não equivalem a auditoria/certificação WCAG completa. O comando de impressão e sua mídia foram testados, sem homologação de todos os drivers de impressora.
6. Retenção automatizada, revogação antecipada de links e coordenação distribuída não fazem parte desta entrega local.

## P1 não realizado

Refinamento adicional do instrutor, impressão avançada, animações e polimento visual adicional. O foco permaneceu no fluxo P0. O roteiro de até cinco minutos está em `demo-script.md`; a duração depende do ritmo de apresentação e do provedor escolhido.
