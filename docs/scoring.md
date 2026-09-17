# Avaliação

No alumínio, [TCO, sourcing e benchmark](aluminum.md) substituem as fórmulas comerciais do K-17, preservando a divisão 60/40. Histórico separa materiais, rubricas, modos, dificuldades e avaliação IA/regras. As fórmulas de preço unitário abaixo referem-se ao cenário legado.

Somente após confirmação explícita da proposta. Acordo exige oferta autorizada, contrapartidas estruturadas, limites operacionais e mandato das partes. Degradação emocional pode bloquear aceitação. A razão objetiva fica no relatório.

## Determinística: 60

Sem acordo válido, zero nas quatro dimensões. Com acordo:

- Valor (20): arredondar `20 × (118 − preço) / (118 − 105)`, limitado a 0–20. `preço` é o valor efetivamente negociado turno a turno (contínuo, proposto pela IA/mock e validado/clampado pelo motor a cada rodada — ver `concession.server.ts`), não mais um dos seis valores de uma tabela fixa.
- Continuidade (15): lead time dentro do estoque 5, senão 2; estoque de segurança 4; prioridade 3; contingência 3.
- Qualidade (15): OTIF ≥95% dá 4, senão 1; defeitos ≤1% dá 4, senão 1; créditos 3; garantia ≥18 meses dá 2, senão 1; revisões 2.
- Condições (10): duração ≥12 meses dá 3, senão 1; forecast ≥30 dias dá 2; volume ≥9.000 dá 2; confirmação do pacote válido dá 3.

Coeficientes em `rules.server.ts`, máximos em `scenario.ts`.

## Melhor resultado viável

Forma fechada: preço no piso com as contrapartidas mais frouxas exigidas nesse preço (duração, forecast e pagamento, interpoladas continuamente a partir da mesma tabela de referência) e proteção operacional padrão — o piso sempre domina o custo/pontuação de valor, então não há mais necessidade de enumerar combinações. Filtra pela mesma função de viabilidade usada no acordo. Benchmark: até **60 pontos objetivos**, sem presumir 40 qualitativos.

É a fronteira comercial condicionada a contrapartidas excepcionais, não desconto automaticamente disponível. Perda mensal = `(preço alcançado − melhor preço) × demanda`. Sem acordo, usa proposta inicial como referência declarada. Capital de giro, estoque, créditos futuros e risco de parada não são monetizados: preço efetivo significa preço unitário contratual no MVP.

## Qualitativa: 40

Diagnóstico 10; estratégia 10; reciprocidade 8; comunicação 6; ética/processo 6. OpenAI recebe critérios e mensagens e retorna IDs, trechos literais, impacto e recomendação. Validador rejeita evidência inexistente, critérios duplicados, notas fora do máximo e justificativas curtas demais. Sem evidência, zero. A IA não altera os pontos objetivos.

Fallback por tags gera referências reais aos turnos e é marcado **provisório**. Validação garante integridade estrutural/literal, mas não comprova qualidade pedagógica de toda interpretação. Revisão humana segue apropriada.

Coach apresenta três forças (declara insuficiência de evidência quando necessário), três prioridades, erros, riscos e próxima ação. Total é a soma das nove competências.
