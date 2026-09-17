import type { SupplierCandidate, SourcingResult } from "../domain/aluminum";
import type { CompetencyScore, Outcome, StructuredFinalOffer } from "../domain/types";
import type { StoredRun } from "./model";
import { activeSupplier, ALUMINUM_TEMPLATE, type SupplierPrivate } from "./aluminum.server";
import { offerDefaults } from "../domain/offer-defaults";
import { depthFromPrice, termsAt, type PackageRow } from "./concession.server";
const round = (n: number) => Math.round(n * 100) / 100;
/** Mesma fórmula de contrapartidas por degrau usada em contextFor, para um fornecedor qualquer. */
function packageRowsFor(
  s: SupplierCandidate,
  privateConfig: SupplierPrivate,
  monthlyDemand: number,
): PackageRow[] {
  return privateConfig.concessionLadder.map((price, index) => ({
    price,
    months: index >= 5 ? 18 : index >= 2 ? 12 : 6,
    volume: monthlyDemand,
    forecast: index >= 5 ? 60 : index >= 3 ? 30 : 15,
    payment: Math.max(21, s.paymentDays - (index >= 4 ? 7 : 0)),
  }));
}
export function sourcingCost(
  stored: StoredRun,
  s: SupplierCandidate,
  price: number,
  stock: boolean,
  turn = stored.estadoPublico.turno,
) {
  const i = stored.aluminum!.instance,
    rules = ALUMINUM_TEMPLATE.publicRules;
  const goods = price * i.purchaseQuantity;
  const isSwitch = s.id !== stored.aluminum!.initialSupplierId;
  const switchingCost = isSwitch ? s.switchingCost : 0;
  const elapsed = isSwitch
    ? (turn === 0
        ? 0
        : (stored.aluminum!.switches.find((x) => x.toSupplierId === s.id)?.turnIndex ?? turn)) *
      rules.dayPerTurn
    : 0;
  const arrival = s.leadTimeDays + s.qualificationDays + elapsed;
  const available = i.inventoryCoverageDays + (stock ? rules.safetyBufferDays : 0);
  const delayDays = Math.max(0, arrival - available);
  const fxProvision = goods * s.fxRisk * rules.fxStress;
  const stockCost = stock ? goods * rules.safetyStockRate : 0;
  return {
    goods: round(goods),
    switchingCost,
    fxProvision: round(fxProvision),
    stockCost: round(stockCost),
    arrival,
    delayDays,
    totalCost: round(
      goods + switchingCost + fxProvision + stockCost + delayDays * i.estimatedDowntimeCost,
    ),
  };
}
function constraints(
  stored: StoredRun,
  s: SupplierCandidate,
  offer: StructuredFinalOffer,
  turn: number,
): string[] {
  const i = stored.aluminum!.instance,
    privateConfig = stored.sourcingPrivate!.supplierConfigs[s.id]!;
  const rows = packageRowsFor(s, privateConfig, i.monthlyDemand);
  const reasons: string[] = [];
  if (offer.precoUnitario < privateConfig.floor || offer.precoUnitario > rows[0]!.price)
    reasons.push("Preço fora da escada autorizada do fornecedor.");
  if (offer.precoUnitario > i.buyerMaximumPrice) reasons.push("Preço acima do mandato da compra.");
  if (i.purchaseQuantity < s.minimumOrderQuantity || i.purchaseQuantity > s.capacityAvailable)
    reasons.push("Quantidade incompatível com MOQ ou capacidade disponível.");
  if (offer.volumeMinimoMensal > i.monthlyDemand || offer.volumeMinimoMensal < i.monthlyDemand)
    reasons.push("O volume mensal deve corresponder à demanda da instância.");
  const depth = depthFromPrice(rows, offer.precoUnitario);
  const terms = termsAt(rows, depth);
  if (
    offer.duracaoMeses < terms.duracaoMeses - 1e-6 ||
    offer.forecastCongeladoDias < terms.forecastCongeladoDias - 1e-6 ||
    offer.pagamentoDias > terms.pagamentoDias + 1e-6
  )
    reasons.push("Contrapartidas insuficientes para o preço proposto.");
  if (offer.leadTimeDias !== s.leadTimeDays)
    reasons.push("Lead time diferente da capacidade publicada do fornecedor.");
  if (
    offer.otifMeta > 98 ||
    offer.limiteDefeitos < Math.max(0.3, s.rejectionRate - 0.3) ||
    offer.garantiaMeses > 24
  )
    reasons.push("Metas de qualidade ou garantia inexequíveis para o fornecedor.");
  const cost = sourcingCost(stored, s, offer.precoUnitario, offer.estoqueSeguranca, turn);
  if (cost.delayDays > 0)
    reasons.push(
      `Entrega e homologação excedem cobertura em ${cost.delayDays} dias; custo estimado de parada incluído no TCO.`,
    );
  if (
    s.certificationStatus === "pendente" &&
    (!offer.planoContingencia || s.qualificationDays === 0)
  )
    reasons.push("Certificação pendente exige homologação e contingência explícitas.");
  return reasons;
}
export function sourcingDecision(
  stored: StoredRun,
  offer: StructuredFinalOffer,
): { outcome: Outcome; reason: string } {
  const s = activeSupplier(stored)!;
  const reasons = constraints(stored, s, offer, stored.estadoPublico.turno);
  if (offer.precoUnitario < stored.estadoPublico.ofertaPublica.precoUnitario)
    reasons.push("Preço inferior à oferta autorizada construída na conversa.");
  if (
    !stored.mensagens.some(
      (m) => m.autor === "comprador" && m.supplierId === s.id && !m.id.endsWith(":switch-reason"),
    )
  )
    reasons.push("Não houve negociação com o fornecedor final.");
  if (stored.privateState.frustracao >= 95 || stored.privateState.abertura <= 5)
    reasons.push("Impasse por degradação emocional.");
  if (reasons.length) return { outcome: "impasse", reason: reasons.join(" ") };
  const fragile =
    !offer.creditosSla ||
    !offer.estoqueSeguranca ||
    !offer.planoContingencia ||
    offer.otifMeta < 95 ||
    offer.limiteDefeitos > 1 ||
    s.certificationStatus === "pendente";
  return {
    outcome: fragile ? "acordo_fragil" : "acordo",
    reason: `Pacote validado com ${s.displayName}; ${fragile ? "há riscos residuais de qualidade ou proteção operacional" : "preço, capacidade, prazo e homologação são compatíveis"}.`,
  };
}
/**
 * Fronteira de custo por fornecedor: o preço mínimo (piso) sempre domina o custo total quando
 * viável, já que o TCO cresce com o preço e o pacote de contrapartidas mais frouxo (usado aqui)
 * já é o exigido pelo piso. Forma fechada equivalente à antiga enumeração de toda a escada.
 */
export function sourcingBenchmark(stored: StoredRun) {
  const a = stored.aluminum!;
  const candidates: { supplier: SupplierCandidate; price: number; cost: number }[] = [];
  for (const supplier of a.suppliers) {
    const price = stored.sourcingPrivate!.supplierConfigs[supplier.id]!.floor;
    const offer = {
      ...offerDefaults,
      precoUnitario: price,
      volumeMinimoMensal: a.instance.monthlyDemand,
      duracaoMeses: 18,
      forecastCongeladoDias: 60,
      pagamentoDias: 21,
      leadTimeDias: supplier.leadTimeDays,
      limiteDefeitos: supplier.rejectionRate,
    };
    if (!constraints(stored, supplier, offer, 0).length)
      candidates.push({
        supplier,
        price,
        cost: sourcingCost(stored, supplier, price, true, 0).totalCost,
      });
  }
  const best = candidates.sort((x, y) => x.cost - y.cost)[0];
  if (!best) throw new Error("Instância sem benchmark viável.");
  return best;
}
export function sourcingScores(
  stored: StoredRun,
  outcome: Outcome,
): {
  scores: CompetencyScore[];
  sourcing: SourcingResult;
  best: { preco: number; custoMensal: number; nota: number };
} {
  const a = stored.aluminum!,
    s = activeSupplier(stored)!,
    offer = stored.propostaFinal!;
  const best = sourcingBenchmark(stored),
    cost = sourcingCost(stored, s, offer.precoUnitario, offer.estoqueSeguranca);
  const baseline = sourcingCost(
    stored,
    a.suppliers[0]!,
    a.suppliers[0]!.initialUnitPrice,
    true,
    0,
  ).totalCost;
  const valid = outcome === "acordo" || outcome === "acordo_fragil";
  const data = [
    {
      id: "valor",
      rotulo: "Valor comercial e TCO",
      maximo: 20,
      pontos: Math.round(
        20 *
          Math.max(0, Math.min(1, (baseline - cost.totalCost) / Math.max(1, baseline - best.cost))),
      ),
      comentario: `TCO estimado BRL ${cost.totalCost}: material ${cost.goods}, troca ${cost.switchingCost}, câmbio ${cost.fxProvision}, estoque ${cost.stockCost} e parada ${round(cost.delayDays * a.instance.estimatedDowntimeCost)}.`,
    },
    {
      id: "continuidade",
      rotulo: "Continuidade e homologação",
      maximo: 15,
      pontos:
        (cost.delayDays === 0 ? 8 : 0) +
        (offer.estoqueSeguranca ? 4 : 0) +
        (offer.planoContingencia ? 3 : 0),
      comentario: `Chegada e homologação em ${cost.arrival} dias; cobertura ${a.instance.inventoryCoverageDays} dias + ${offer.estoqueSeguranca ? ALUMINUM_TEMPLATE.publicRules.safetyBufferDays : 0} dias de estoque negociado.`,
    },
    {
      id: "qualidade",
      rotulo: "Qualidade, certificação e câmbio",
      maximo: 15,
      pontos:
        (offer.otifMeta >= 95 ? 4 : 1) +
        (offer.limiteDefeitos <= 1 ? 4 : 1) +
        (offer.creditosSla ? 3 : 0) +
        (s.certificationStatus === "validada" ? 2 : 0) +
        (s.fxRisk === 0 ? 2 : 0),
      comentario: `Certificação ${s.certificationStatus}; rejeição ${offer.limiteDefeitos}%; exposição cambial ${Math.round(s.fxRisk * 100)}%.`,
    },
    {
      id: "condicoes",
      rotulo: "Condições e decisão de sourcing",
      maximo: 10,
      pontos:
        4 +
        (offer.forecastCongeladoDias >= 30 ? 2 : 0) +
        (offer.duracaoMeses >= 12 ? 2 : 0) +
        (a.switchCount === 0 || (a.switches[0]!.turnIndex <= 3 && cost.totalCost <= baseline)
          ? 2
          : 0),
      comentario: a.switchCount
        ? `Troca no turno ${a.switches[0]!.turnIndex}: ${a.switches[0]!.reason}. Custo e risco foram considerados; trocar não gera bônus automático.`
        : "Permanência avaliada pelo pacote, custo total e continuidade; não há bônus por trocar.",
    },
  ];
  const scores = data.map((item) => ({ ...item, pontos: valid ? item.pontos : 0, evidencias: [] }));
  return {
    scores,
    best: {
      preco: best.price,
      custoMensal: best.cost,
      nota:
        45 +
        (offerDefaults.otifMeta >= 95 ? 4 : 1) +
        (best.supplier.rejectionRate <= 1 ? 4 : 1) +
        3 +
        (best.supplier.certificationStatus === "validada" ? 2 : 0) +
        (best.supplier.fxRisk === 0 ? 2 : 0),
    },
    sourcing: {
      supplierDecisionScore: scores.reduce((n, item) => n + item.pontos, 0),
      switchAssessment: `${data[3]!.comentario} ${valid ? "Pacote viável com riscos descritos nas competências." : "Decisão não sustentou acordo viável."}`,
      totalCost: cost.totalCost,
      bestFeasibleTotalCost: best.cost,
      delayDays: cost.delayDays,
      switchingCost: cost.switchingCost,
      fxExposure: s.fxRisk,
      finalSupplier: s.displayName,
      costBasis:
        "Compra em toneladas; BRL; provisão cambial de 10% sobre exposição, estoque adicional de 3 dias custa 1% do material. Não é previsão financeira.",
    },
  };
}
