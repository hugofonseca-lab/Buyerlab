import type { CompetencyScore, Outcome, StructuredFinalOffer } from "../domain/types";
import { offerDefaults } from "../domain/offer-defaults";
import { blueprint } from "./scenario.server";
import { rules } from "./rules.server";
import type { StoredRun } from "./model";
import { sourcingDecision } from "./sourcing-score.server";
import { depthFromPrice, termsAt, type PackageRow } from "./concession.server";

export function feasible(offer: StructuredFinalOffer): string[] {
  const reasons: string[] = [];
  const rows = rules.packages as PackageRow[];
  if (offer.precoUnitario < rules.floor || offer.precoUnitario > rules.initialOffer.precoUnitario)
    return ["O preço não pertence às condições comerciais permitidas."];
  const terms = termsAt(rows, depthFromPrice(rows, offer.precoUnitario));
  if (offer.precoUnitario > blueprint.mandato.limitePrecoEfetivo)
    reasons.push("Preço acima do mandato autorizado da Orion.");
  if (
    offer.duracaoMeses < terms.duracaoMeses - 1e-6 ||
    offer.volumeMinimoMensal < terms.volumeMinimoMensal - 1e-6 ||
    offer.forecastCongeladoDias < terms.forecastCongeladoDias - 1e-6 ||
    offer.pagamentoDias > terms.pagamentoDias + 1e-6
  )
    reasons.push("As contrapartidas estruturadas não sustentam esse preço.");
  if (offer.volumeMinimoMensal > blueprint.mandato.demandaMensal)
    reasons.push("Volume comprometido excede a demanda da Orion.");
  if (
    offer.leadTimeDias < rules.operational.minLead ||
    offer.otifMeta > rules.operational.maxOtif ||
    offer.limiteDefeitos < rules.operational.minDefects ||
    offer.garantiaMeses > rules.operational.maxWarranty
  )
    reasons.push("As metas operacionais excedem a capacidade do pacote.");
  if (
    offer.leadTimeDias < rules.initialOffer.leadTimeDias &&
    (!offer.prioridadeProducao || offer.forecastCongeladoDias < 30)
  )
    reasons.push("Reduzir lead time exige prioridade e forecast estável.");
  return reasons;
}
export function validateDeal(
  stored: StoredRun,
  offer: StructuredFinalOffer,
): { outcome: Outcome; reason: string } {
  if (stored.aluminum) return sourcingDecision(stored, offer);
  const reasons = feasible(offer);
  if (offer.precoUnitario < stored.estadoPublico.ofertaPublica.precoUnitario)
    reasons.push("Preço inferior à oferta autorizada construída na conversa.");
  if (!stored.mensagens.some((m) => m.autor === "comprador"))
    reasons.push("Não houve negociação antes da proposta.");
  if (stored.privateState.frustracao >= 95 || stored.privateState.abertura <= 5)
    reasons.push("Impasse por degradação da confiança e da abertura.");
  if (reasons.length) return { outcome: "impasse", reason: reasons.join(" ") };
  const protects =
    offer.otifMeta >= 95 &&
    offer.limiteDefeitos <= 1 &&
    offer.planoContingencia &&
    offer.estoqueSeguranca &&
    offer.creditosSla;
  return {
    outcome: protects ? "acordo" : "acordo_fragil",
    reason: protects
      ? "A Orion confirmou explicitamente o pacote; a Nexa aceita as condições validadas pelo motor."
      : "Pacote aceito pelas partes, com lacunas de continuidade, SLA ou qualidade.",
  };
}
export function deterministicScores(
  offer: StructuredFinalOffer,
  outcome: Outcome,
): CompetencyScore[] {
  const ok = outcome === "acordo" || outcome === "acordo_fragil",
    s = rules.score,
    w = blueprint.pesos;
  const values = [
    [
      "valor",
      "Valor comercial",
      Math.round(
        ((rules.initialOffer.precoUnitario - offer.precoUnitario) /
          (rules.initialOffer.precoUnitario - rules.floor)) *
          w.valorComercial,
      ),
      w.valorComercial,
    ],
    [
      "continuidade",
      "Continuidade e lead time",
      (offer.leadTimeDias <= blueprint.mandato.diasEstoque ? s.lead[0]! : s.lead[1]!) +
        (offer.estoqueSeguranca ? s.stock : 0) +
        (offer.prioridadeProducao ? s.priority : 0) +
        (offer.planoContingencia ? s.contingency : 0),
      w.continuidade,
    ],
    [
      "qualidade",
      "Qualidade e risco",
      (offer.otifMeta >= 95 ? s.otif[0]! : s.otif[1]!) +
        (offer.limiteDefeitos <= 1 ? s.defects[0]! : s.defects[1]!) +
        (offer.creditosSla ? s.credits : 0) +
        (offer.garantiaMeses >= 18 ? s.warranty[0]! : s.warranty[1]!) +
        (offer.revisoesPeriodicas ? s.reviews : 0),
      w.qualidadeRisco,
    ],
    [
      "condicoes",
      "Condições e fechamento",
      (offer.duracaoMeses >= 12 ? s.duration[0]! : s.duration[1]!) +
        (offer.forecastCongeladoDias >= 30 ? s.forecast : 0) +
        (offer.volumeMinimoMensal >= 9000 ? s.volume : 0) +
        s.acceptance,
      w.condicoesFechamento,
    ],
  ] as const;
  const money = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const comments: Record<string, string> = {
    valor: `Preço confirmado de ${money(offer.precoUnitario)}; custo mensal de ${money(offer.precoUnitario * blueprint.mandato.demandaMensal)}. Redução de ${money(rules.initialOffer.precoUnitario - offer.precoUnitario)} por unidade frente à proposta inicial.`,
    continuidade: `Lead time de ${offer.leadTimeDias} dias frente a ${blueprint.mandato.diasEstoque} dias de estoque. Estoque de segurança: ${offer.estoqueSeguranca ? "sim" : "não"}; prioridade: ${offer.prioridadeProducao ? "sim" : "não"}; contingência: ${offer.planoContingencia ? "sim" : "não"}.`,
    qualidade: `OTIF de ${offer.otifMeta}%, defeitos até ${offer.limiteDefeitos}% e garantia de ${offer.garantiaMeses} meses. Créditos por SLA: ${offer.creditosSla ? "sim" : "não"}; revisões periódicas: ${offer.revisoesPeriodicas ? "sim" : "não"}.`,
    condicoes: `Contrato de ${offer.duracaoMeses} meses, volume mínimo de ${offer.volumeMinimoMensal.toLocaleString("pt-BR")} unidades/mês, forecast congelado por ${offer.forecastCongeladoDias} dias e pagamento em ${offer.pagamentoDias} dias. Pacote confirmado explicitamente.`,
  };
  return values.map(([id, rotulo, points, maximo]) => ({
    id,
    rotulo,
    pontos: ok ? Math.max(0, Math.min(maximo, points)) : 0,
    maximo,
    comentario: ok ? comments[id]! : "Sem acordo válido: nenhum ponto de resultado comercial.",
    evidencias: [],
  }));
}
/**
 * Fronteira comercial do cenário: o piso sempre domina (menor preço, pontuação de valor máxima) e
 * as contrapartidas mais frouxas no piso já são as exigidas para esse preço; nenhuma combinação
 * mais restritiva pontuaria mais alto. Forma fechada equivalente à antiga enumeração das 6
 * linhas da escada × combinações de prazo/forecast/pagamento/lead.
 */
export function bestFeasible() {
  const rows = rules.packages as PackageRow[];
  const terms = termsAt(rows, 1);
  const offer: StructuredFinalOffer = {
    ...offerDefaults,
    precoUnitario: rules.floor,
    duracaoMeses: Math.max(18, Math.round(terms.duracaoMeses)),
    forecastCongeladoDias: Math.max(60, Math.round(terms.forecastCongeladoDias)),
    pagamentoDias: Math.min(15, Math.round(terms.pagamentoDias)),
    leadTimeDias: rules.operational.minLead,
  };
  if (feasible(offer).length) throw new Error("Blueprint sem pacote viável.");
  const points = deterministicScores(offer, "acordo").reduce((n, x) => n + x.pontos, 0);
  return {
    preco: offer.precoUnitario,
    custoMensal: offer.precoUnitario * blueprint.mandato.demandaMensal,
    nota: points,
  };
}
