import type { CompetencyScore, EvaluationReport, Outcome } from "../domain/types";
import type { StoredRun } from "./model";
import { bestFeasible, deterministicScores } from "./evaluator.server";
import { blueprint } from "./scenario.server";
import { sourcingScores } from "./sourcing-score.server";
import { ALUMINUM_TEMPLATE } from "./aluminum.server";

const nextSteps: Record<string, string> = {
  valor:
    "Compare a posição pública com o mandato e condicione uma revisão de preço a compromissos que a Orion consiga cumprir.",
  continuidade:
    "Compare o prazo de entrega com os dias de estoque e formalize estoque de segurança, prioridade e contingência.",
  qualidade:
    "Registre metas de OTIF e defeitos, créditos por SLA, garantia e uma rotina de revisão com responsáveis.",
  condicoes:
    "Confirme duração, volume, janela de forecast e pagamento no mesmo pacote antes de aceitar.",
  diagnostico:
    "Pergunte qual restrição mais pesa no fornecimento e reformule a resposta antes de apresentar sua oferta.",
  estrategia:
    "Use um indicador do dossiê para justificar sua proposta e resuma como ela atende ao mandato.",
  concessoes:
    "Vincule cada concessão a uma contrapartida mensurável: se a Orion assumir um compromisso, o que receberá em troca?",
  comunicacao:
    "Reconheça a responsabilidade da Orion nas mudanças de forecast e confirme o entendimento sem ameaças.",
  etica:
    "Resuma os termos negociados, peça confirmação explícita e mantenha a conversa nos dados comerciais autorizados.",
};

export function coach(
  stored: StoredRun,
  outcome: Outcome,
  reason: string,
  qualitative: CompetencyScore[],
  provisional: boolean,
): EvaluationReport {
  const offer = stored.propostaFinal!;
  const sourcing = stored.aluminum ? sourcingScores(stored, outcome) : null;
  const deterministic = sourcing?.scores ?? deterministicScores(offer, outcome);
  // Sem acordo, os pontos objetivos já são zero; a qualitativa também é bastante reduzida (25%),
  // para a nota final refletir principalmente o resultado real da negociação, não só a
  // qualidade do processo isolada do desfecho.
  const IMPASSE_QUALITATIVE_FACTOR = 0.25;
  const qualitativeAdjusted =
    outcome === "impasse"
      ? qualitative.map((s) => ({
          ...s,
          pontos: Math.round(s.pontos * IMPASSE_QUALITATIVE_FACTOR),
        }))
      : qualitative;
  const scores = [...deterministic, ...qualitativeAdjusted];
  const best = sourcing?.best ?? bestFeasible();
  const price = outcome === "impasse" || outcome === "encerrado" ? null : offer.precoUnitario;
  const strong = scores
    .filter((s) => s.pontos >= s.maximo * 0.7)
    .slice(0, 3)
    .map((s) => `${s.rotulo}: ${s.comentario}`);
  while (strong.length < 3)
    strong.push(
      `Competência adicional ${strong.length + 1}: evidência insuficiente para apontar outro ponto forte nesta execução.`,
    );
  const priorities = [...scores]
    .sort((a, b) => a.pontos / a.maximo - b.pontos / b.maximo)
    .slice(0, 3)
    .map((s) => `${s.rotulo}: ${s.pontos}/${s.maximo}. ${nextSteps[s.id] ?? s.comentario}`);
  return {
    ...(sourcing
      ? {
          sourcing: sourcing.sourcing,
          scenarioTemplateVersion: stored.aluminum!.instance.templateVersion,
          difficulty: stored.run.dificuldade,
          rubricVersion: ALUMINUM_TEMPLATE.rubricVersion,
          comparableGroupKey: `${ALUMINUM_TEMPLATE.rubricVersion}|${stored.run.dificuldade}|${stored.run.modo}|${stored.aluminum!.instance.materialId}|${provisional ? "rules" : "ai"}|100${stored.aluminum!.instance.market.provider === "BuyerLab live v1" ? `|${stored.aluminum!.instance.market.hash}` : ""}`,
          progressEligible: true,
        }
      : {}),
    runId: stored.run.id,
    seed: stored.run.seed,
    gerandoEm: new Date().toISOString(),
    notaTotal: scores.reduce((sum, s) => sum + s.pontos, 0),
    resultado: outcome,
    razaoResultado: reason,
    avaliacaoProvisoria: provisional,
    cenarioVersao: stored.run.cenarioVersao,
    engineVersao: stored.run.engineVersao,
    precoFechado: price,
    custoMensalAlcancado:
      price === null
        ? null
        : (sourcing?.sourcing.totalCost ?? price * blueprint.mandato.demandaMensal),
    melhorResultadoViavel: best,
    perdaDeOportunidadeMensal: sourcing
      ? Math.max(0, sourcing.sourcing.totalCost - sourcing.sourcing.bestFeasibleTotalCost)
      : Math.max(
          0,
          ((price ?? blueprint.mandato.precoProposto) - best.preco) *
            blueprint.mandato.demandaMensal,
        ),
    determinantes: deterministic,
    qualitativas: qualitativeAdjusted,
    fortes: strong,
    oportunidades: priorities,
    errosCriticos: [
      ...(outcome === "impasse" ? [reason] : []),
      ...(stored.privateState.tentativasIndevidas
        ? ["Tentativa de manipular regras ou obter informações confidenciais."]
        : []),
      ...(!offer.planoContingencia
        ? ["Ausência de plano de contingência para o risco de parada."]
        : []),
    ],
    recomendacao: stored.privateState.tentativasIndevidas
      ? nextSteps["etica"]!
      : outcome === "impasse"
        ? `Comece pela causa do impasse: ${reason} Depois, ${priorities[0] ?? nextSteps["diagnostico"]}`
        : `Na próxima tentativa, priorize: ${priorities[0] ?? nextSteps["condicoes"]}`,
    linhaDoTempo: stored.mensagens
      .filter((m) => m.autor === "comprador" && m.acoes?.some((t) => t !== "neutro"))
      .slice(0, 5)
      .map((m) => ({
        turno: m.turno,
        titulo: m.acoes?.[0]?.replaceAll("_", " ") ?? "Movimento",
        detalhe: m.texto.slice(0, 160),
      })),
  };
}
