/** Maps authorized API data to the current Lovable presentation contracts. */
import type { RunSnapshot, EvaluationReport } from "@/domain/types";
import type {
  ScenarioInstance,
  SupplierCandidate,
  SupplierContract,
  SupplierSwitch,
} from "@/domain/lovable-ui";

export type LovableSnapshot = Omit<RunSnapshot, "relatorio"> & {
  scenario?: ScenarioInstance | undefined;
  activeSupplierId?: string | undefined;
  supplierSwitch?: SupplierSwitch | undefined;
  relatorio?: EvaluationReport & {
    scenario?: ScenarioInstance;
    initialSupplierId?: string;
    finalSupplierId?: string;
    supplierSwitch?: SupplierSwitch | undefined;
    supplierDecisionAssessment?: string | undefined;
    alternativesComparison?: string;
  };
};
export function toLovableSnapshot(snapshot: RunSnapshot): LovableSnapshot {
  const a = snapshot.aluminum;
  if (!a)
    return {
      ...snapshot,
      scenario: undefined,
      activeSupplierId: undefined,
      supplierSwitch: undefined,
    };
  const i = a.instance;
  const candidates: SupplierCandidate[] = a.suppliers.map((s) => ({
    id: s.id,
    name: s.displayName,
    kind:
      s.supplierType === "incumbente"
        ? "incumbente_nacional"
        : s.supplierType === "alternativo"
          ? "alternativo_nacional"
          : "importador",
    quoteUnitPrice: s.initialUnitPrice,
    // The API prices all packages in BRL; currency describes component exposure only.
    currency: "BRL",
    estimatedTotalCost: s.estimatedTotalCost,
    leadTimeDays: s.leadTimeDays,
    paymentDays: s.paymentDays,
    moqTons: s.minimumOrderQuantity,
    quality: `Rejeição ${s.rejectionRate.toLocaleString("pt-BR")}% · capacidade ${s.capacityAvailable} t`,
    reliability: s.deliveryReliability,
    certification: s.certificationStatus,
    logisticsRisk: s.logisticsRisk <= 0.1 ? "baixo" : s.logisticsRisk <= 0.2 ? "moderado" : "alto",
    switchingCost: s.switchingCost,
    qualificationDays: s.qualificationDays,
    esgImpact: s.esgAttributes.join("; "),
    negotiationStatus:
      s.id === a.activeSupplierId
        ? "ativo"
        : a.switches.some((x) => x.fromSupplierId === s.id)
          ? "substituido"
          : "disponivel",
    publicHistory: `${s.publicFacts.join(" ")} Exposição cambial: ${Math.round(s.fxRisk * 100)}%.`,
  }));
  const best = (value: (s: import("@/domain/aluminum").SupplierCandidate) => number) =>
    [...a.suppliers].sort((x, y) => value(x) - value(y))[0]!.id;
  const indicator = (code: string) => i.market.indicators.find((x) => x.code === code)!.value;
  const currentContract: SupplierContract = {
    supplierName: a.currentContract.supplierName,
    purchaseCategory: a.currentContract.purchaseCategory,
    totalValue: a.currentContract.totalValue,
    currency: a.currentContract.currency,
    startDate: a.currentContract.startDate,
    endDate: a.currentContract.endDate,
    indexClause: a.currentContract.indexClause,
    slaDeliveryDays: a.currentContract.slaDeliveryDays,
    slaDescription: a.currentContract.slaDescription,
    onTimeDeliveryScore: a.currentContract.performanceHistory.onTimeDeliveryScore,
    qualityScore: a.currentContract.performanceHistory.qualityScore,
    performancePeriod: a.currentContract.performanceHistory.period,
    terminationClause: a.currentContract.terminationClause,
    penaltyRate: a.currentContract.penaltyRate,
  };
  const scenario: ScenarioInstance = {
    scenarioId: i.id,
    scenarioSeed: i.seed,
    scenarioVersion: i.templateVersion,
    difficulty: i.difficulty,
    marketVertical: "Chapas de alumínio industriais",
    buyerName: a.blueprint.brief.compradora,
    title: a.blueprint.titulo,
    material: { code: i.materialId, name: i.material.name, description: i.material.description },
    materialSpecification: i.material.description,
    application: i.application,
    monthlyDemand: i.monthlyDemand,
    purchaseQuantity: i.purchaseQuantity,
    unit: "t",
    inventoryCoverageDays: i.inventoryCoverageDays,
    requiredDeliveryDate: i.requiredDeliveryDate,
    urgency: i.urgency,
    criticality: i.urgency === "alta" ? "alto" : "moderado",
    currentUnitPrice: i.currentUnitPrice,
    marketReferencePrice: i.marketReferencePrice,
    buyerTargetPrice: i.buyerTargetPrice,
    buyerMaximumPrice: i.buyerMaximumPrice,
    currency: "BRL",
    qualityRequirements: i.material.qualityRequirements,
    certificationRequired: i.material.certificationRequirements.join("; "),
    continuityRisk: `O estoque cobre ${i.inventoryCoverageDays} dias.`,
    delayConsequence: `Atrasos sem cobertura podem interromper a produção.`,
    nonConformityConsequence:
      "Não conformidades exigem contenção, reposição e validação da qualidade.",
    interruptionImpactPerDay: i.estimatedDowntimeCost,
    buyerObjective: a.blueprint.mandato.objetivo,
    marketSnapshot: {
      indicators: i.market.indicators,
      fallbackUsed: i.market.fallbackUsed,
      referenceDate: i.market.referenceDate,
      source: [...new Set(i.market.indicators.map((x) => x.source))].join("; "),
      ptax: indicator("USD_BRL"),
      aluminumBenchmarkUsdTon: indicator("ALUMINUM"),
      industrialIndex: indicator("IPP"),
      industrialIndexLabel: "Índice industrial simulado",
      explanation:
        "A referência combina preço-base, exposição cambial, commodity e índice industrial, mais conversão e frete. Os valores são congelados com a seed.",
      disclaimer:
        "Verifique a data e a fonte de cada indicador. Valores simulados são identificados individualmente. O índice industrial e os preços das chapas são didáticos; a referência do metal não é uma oferta de chapa acabada.",
    },
    supplierCandidates: candidates,
    activeSupplierId: a.activeSupplierId,
    comparison: {
      bestPriceSupplierId: best((s) => s.initialUnitPrice),
      lowestRiskSupplierId: best((s) => s.logisticsRisk),
      shortestLeadTimeSupplierId: best((s) => s.leadTimeDays),
      bestQualitySupplierId: best((s) => s.rejectionRate),
      bestTotalCostSupplierId: best((s) => s.estimatedTotalCost),
    },
    context: a.blueprint.brief.contexto,
    risks: [
      "Avalie MOQ e capacidade disponível.",
      "Homologação e custo de troca afetam a continuidade.",
      "Menor preço não garante menor custo total.",
    ],
    currentContract,
  };
  const change = a.switches[0];
  const supplierSwitch: SupplierSwitch | undefined = change
    ? {
        fromSupplierId: change.fromSupplierId,
        toSupplierId: change.toSupplierId,
        justification: change.reason,
        switchedAt: change.createdAt,
        turn: change.turnIndex,
        cost: change.financialImpact,
        daysConsumed: change.timePenaltyDays,
        riskImpact: "Considere prazo, capacidade e qualidade na decisão.",
      }
    : undefined;
  const report = snapshot.relatorio;
  return {
    ...snapshot,
    scenario,
    activeSupplierId: a.activeSupplierId,
    supplierSwitch,
    ...(report
      ? {
          relatorio: {
            ...report,
            scenario,
            initialSupplierId: a.initialSupplierId,
            finalSupplierId: a.finalSupplierId ?? a.activeSupplierId,
            supplierSwitch,
            supplierDecisionAssessment: report.sourcing?.switchAssessment,
            alternativesComparison: report.sourcing
              ? `TCO da proposta: ${report.sourcing.totalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Melhor TCO viável: ${report.sourcing.bestFeasibleTotalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. ${report.sourcing.costBasis}`
              : "",
          },
        }
      : {}),
  };
}
