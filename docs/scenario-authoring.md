# Autoria do cenário

Nicho atual: chapas de alumínio industriais. Template `industrial-aluminum` v1.0.0 em `aluminum.server.ts`, mercado estático em `market.server.ts`. Consulte [faixas, fórmulas e regras](aluminum.md). Preserve instâncias salvas e versione qualquer mudança estrutural. Todos os dados são fictícios.

As instruções abaixo documentam o cenário legado Orion × Nexa, K-17, v2.0.0, mantido para execuções e links antigos.

1. Fatos públicos: `domain/scenario.ts`. Proposta padrão do comprador: `offer-defaults.ts`, incluída no blueprint público.
2. Escada/eventos: `server/scenario.server.ts`.
3. Pacotes, matriz, perfil, políticas de eventos e coeficientes: `rules.server.ts`.
4. Incremente versão do cenário ao mudar condições/fórmulas; versão da engine ao mudar semântica de transição.
5. Atualize testes e roteiro. Nunca importe regras privadas na UI.

| Preço     | Duração mínima | Volume mínimo | Forecast mínimo | Pagamento máximo |
| --------- | -------------- | ------------- | --------------- | ---------------- |
| 118 / 114 | 6 meses        | 7.000         | 0 dias          | 45 dias          |
| 112       | 12 meses       | 9.000         | 15 dias         | 45 dias          |
| 109       | 12 meses       | 9.000         | 30 dias         | 45 dias          |
| 107       | 12 meses       | 10.000        | 30 dias         | 30 dias          |
| 105       | 18 meses       | 10.000        | 60 dias         | 15 dias          |

Concessão exige confiança, descoberta e reciprocidade da escada. No máximo um degrau por turno. Uma contrapartida mencionada precisa ser formalizada no pacote; não há desconto adicional na finalização. Preço acima do mandato do comprador resulta em impasse.

Sete emoções limitadas a 0–100. Ação aplica delta × peso do perfil; treinamento adiciona ruído inteiro de −1 a 1 por seed/turno. Avaliação fixa dificuldade intermediária, urgência média e perfil sorteado, sem ruído.

Eventos base: capacidade 18%, concorrente 20%, logística 15%, diretoria 20%, alternativa 15%. Definição contém início e pré-condição; `eventPolicies` contém prioridade, incompatibilidades, modificador por pressão e consequência. Fim da janela: turno 8; uma ocorrência por evento, máximo de duas por treinamento. Ordem das definições corresponde à prioridade. Avaliação controla atraso logístico no turno 3.

Mesma seed exige mesma versão, configuração e sequência de ações para reproduzir condições estruturais; não garante texto idêntico da IA. Eventos alteram estado e informação, nunca substituem viabilidade.
