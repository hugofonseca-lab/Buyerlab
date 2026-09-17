# Validação das variações do cenário Orion × Nexa

## Escopo

Um cenário profundo, com variações internas. Não são cenários comerciais diferentes. A suíte cobre todas as combinações dos seletores, uma amostra determinística de seeds e roteiros definidos de conversa; não prova todas as frases possíveis de linguagem natural.

| Dimensão          | Cobertura                                                                               |
| ----------------- | --------------------------------------------------------------------------------------- |
| Modo              | Treinamento e avaliação                                                                 |
| Perfil solicitado | Aleatório, colaborativo, analítico, dominante, defensivo                                |
| Dificuldade       | Iniciante, intermediário, avançado                                                      |
| Urgência          | Baixa, média, alta                                                                      |
| Seeds na matriz   | `MATRIX-0` até `MATRIX-11`                                                              |
| Contextos         | Eficaz, fraco, concessão unilateral, hostilidade, manipulação e recuperação após ameaça |

São **90 configurações × 12 seeds × 6 contextos = 6.480 execuções**, cada uma com replay independente e até seis turnos. Em avaliação, as combinações de seletores são deliberadamente normalizadas pelo servidor; as condições são comparáveis, não livremente configuráveis.

## Propriedades verificadas

- Mesma configuração/seed/mensagens gera os mesmos estados, ofertas, eventos e sorteios; o mock também repete o texto.
- Estados emocionais entre 0 e 100, preços em degraus válidos e nunca abaixo do piso.
- Comprador eficaz consegue acordo com pacote excepcional válido e supera fraco/manipulador em todas as células da matriz.
- Demanda sem contrapartida, concessão unilateral, ameaça e manipulação não geram desconto nos respectivos roteiros.
- Evidências do diagnóstico pertencem às mensagens citadas, e pontos respeitam os máximos.
- Dados privados não aparecem no snapshot público.
- Limite de turnos respeitado nas três dificuldades; mensagens após encerramento são recusadas sem mutação.
- Acordo robusto, acordo frágil, proposta sem negociação e 13 violações de limites comerciais/operacionais.

## Eventos

Outras **600 execuções** (300 seeds × dois roteiros) exercitam oito turnos: os cinco eventos são alcançáveis e há execuções com zero, um e dois eventos. Todos os quatro perfis aparecem na seleção aleatória.

Testes adicionais conferem, para cada evento, probabilidade calculada, consequência emocional, janela e incompatibilidades. A matriz confere pré-condições em cada sorteio e a correspondência entre sorteio e resultado. Não se espera frequência observada igual à probabilidade-base: elegibilidade, prioridade, modificadores e o máximo de eventos afetam a frequência final.

## Integração e interface

Jornadas pela API cobrem os dois modos e quatro perfis, acordo, finalização idempotente, replay e isolamento de escrita entre sessões. Permanecem os testes de persistência em outro Store, rate limiting, origem, limites de entrada, compartilhamento autorizado e fallback.

Os roteiros de navegador cobrem desktop/celular, os quatro perfis, as três dificuldades/urgências em amostras selecionadas, retomada, relatório, impressão, compartilhamento, nova seed, mesma seed, falha de transporte e manipulação. A matriz completa roda no motor, não em milhares de instâncias de navegador.

## Falhas encontradas e corrigidas

O classificador não reconhecia algumas palavras no plural, um percentual isolado (`1,8%`) e uma proposta monetária como `R$ 107`. Foram corrigidas as expressões de reconhecimento, com testes de regressão. A engine passou de `2.0.0` para **`2.0.1`**; cenário, parâmetros comerciais e fórmulas não mudaram.

Compare replay dentro da mesma versão da engine. Execuções históricas não têm implementação antiga isolada: repetir após uma atualização usa a engine instalada. As correções de classificação podem mudar o resultado de mensagens anteriormente classificadas incorretamente.

## Como repetir

Resultado final da execução: **134 testes em cinco arquivos aprovados**, **14 E2E aprovados** (desktop/celular), build e typecheck aprovados. Lint sem erros, com os sete avisos preexistentes de Fast Refresh. A suíte unitária/integrada levou cerca de 90 segundos e a de navegador, 3,8 minutos neste ambiente.

```sh
bun run test
bun run lint
bun run typecheck
bun run build
bun run test:e2e
```

Somente a matriz e seus testes complementares: `bun run test tests/variations.test.ts`.

O provedor usado foi **mock**. Falhas/saídas inválidas/timeout são simulados pelos testes existentes; chamadas reais à OpenAI não foram executadas por ausência de credenciais no processo. O classificador permanece heurístico e não valida semanticamente toda afirmação do comprador. Os eventos alteram condições descritas e estado emocional, sem simular fisicamente uma fábrica ou recalcular cronogramas completos.
