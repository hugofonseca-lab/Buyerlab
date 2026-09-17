import { createHash } from "node:crypto";
import type {
  Material,
  MaterialId,
  ScenarioInstance,
  SupplierCandidate,
  AluminumPublic,
  MarketSnapshot,
  SupplierContract,
} from "../domain/aluminum";
import type { RunConfig, PrivateNegotiationState, PublicScenarioBlueprint } from "../domain/types";
import type { StoredRun } from "./model";
import { createRng, pick } from "../lib/prng";
import { STATIC_MARKET, validateMarket } from "./market.server";
import { blueprint as legacyBlueprint } from "./scenario.server";
import { rules as legacyRules } from "./rules.server";
import { offerDefaults } from "../domain/offer-defaults";

export const ALUMINUM_TEMPLATE = {
  id: "industrial-aluminum",
  version: "1.0.0",
  rubricVersion: "aluminum-hybrid-1",
  marketVertical: "Chapas de alumínio industriais",
  generationRanges: {
    quantity: [8, 35],
    monthlyDemand: [6, 30],
    inventory: [7, 30],
    domesticLead: [7, 30],
    importedLead: [40, 90],
    payment: [21, 60],
    qualification: [0, 45],
    rejection: [0.3, 2.5],
    switchRate: [0.005, 0.04],
    fxExposure: [0, 0.9],
  },
  publicRules: {
    maxSwitches: 1,
    currency: "BRL",
    unit: "t",
    dayPerTurn: 0.5,
    fxStress: 0.1,
    safetyBufferDays: 3,
    safetyStockRate: 0.01,
  },
  privateRules: {
    ladderRatios: [1, 0.97, 0.94, 0.92, 0.9, 0.86],
    basePrices: { "5052-H32": 18000, "6061-T6": 21000, "7075-T6": 28000 },
    conversionPremium: 2000,
    freight: 650,
  },
  active: true,
};
export const MATERIALS: Material[] = (["5052-H32", "6061-T6", "7075-T6"] as MaterialId[]).map(
  (id, index) => ({
    id,
    code: id,
    name: `Chapa de alumínio ${id}`,
    alloy: id.split("-")[0]!,
    temper: id.split("-")[1]!,
    unit: "t",
    description:
      "Material de um exercício fictício; especificações de engenharia devem ser validadas fora da simulação.",
    typicalApplications: [
      "Carenagens de equipamentos industriais",
      "Componentes usinados",
      "Suportes industriais",
    ][index]!.split("|"),
    qualityRequirements: [
      `Composição e têmpera ${id} conforme desenho fictício Orion`,
      "Inspeção dimensional e rastreabilidade de lote",
    ],
    certificationRequirements: [
      `Laudo de composição e têmpera ${id}`,
      "Liberação de lote pela qualidade Orion",
    ],
    criticalityRange: [index + 1, index + 3],
    commodityExposure: 0.45,
    fxExposure: 0.35,
    producerIndexExposure: 0.2,
    active: true,
  }),
);
export interface SupplierPrivate {
  floor: number;
  concessionLadder: number[];
  persona: string;
  priorities: string[];
  batna: string;
  disclosures: Record<string, string>;
  initialState: PrivateNegotiationState;
}
export interface SourcingPrivate {
  supplierConfigs: Record<string, SupplierPrivate>;
  states: Record<string, PrivateNegotiationState>;
  generationMetadata: {
    templateVersion: string;
    benchmarkComponents: ReturnType<typeof calculateBenchmark>;
    attempts: number;
  };
}
const round = (n: number) => Math.round(n * 100) / 100;
export function calculateBenchmark(input: {
  basePrice: number;
  fxExposure: number;
  commodityExposure: number;
  producerIndexExposure: number;
  fxVariation: number;
  commodityVariation: number;
  producerIndexVariation: number;
  conversionPremium: number;
  freight: number;
}) {
  if (
    Object.values(input).some((n) => !Number.isFinite(n)) ||
    input.basePrice <= 0 ||
    input.conversionPremium < 0 ||
    input.freight < 0
  )
    throw new Error("Benchmark inválido.");
  for (const weight of [input.fxExposure, input.commodityExposure, input.producerIndexExposure])
    if (weight < 0 || weight > 1) throw new Error("Exposição fora de faixa.");
  for (const variation of [
    input.fxVariation,
    input.commodityVariation,
    input.producerIndexVariation,
  ])
    if (Math.abs(variation) > 0.5) throw new Error("Variação econômica fora de faixa.");
  const adjustment =
    input.fxExposure * input.fxVariation +
    input.commodityExposure * input.commodityVariation +
    input.producerIndexExposure * input.producerIndexVariation;
  return {
    ...input,
    adjustment,
    value: round(
      Math.max(
        input.basePrice * 0.5,
        Math.min(
          input.basePrice * 2,
          input.basePrice * (1 + adjustment) + input.conversionPremium + input.freight,
        ),
      ),
    ),
  };
}
const INDEX_CLAUSES = [
  "Reajuste anual pelo IPCA acumulado dos últimos 12 meses.",
  "Reajuste trimestral por variação cambial USD/BRL (PTAX) sobre 40% do valor do contrato.",
  "Reajuste semestral atrelado à variação do índice de alumínio primário (LME) sobre o componente metálico.",
];
/** Contrato hipotético/mockado do fornecedor incumbente; não representa uma integração real. */
function generateSupplierContract(
  rng: () => number,
  scenarioInstanceId: string,
  material: Material,
  incumbent: SupplierCandidate,
  instance: Pick<ScenarioInstance, "monthlyDemand" | "currentUnitPrice" | "requiredDeliveryDate">,
): SupplierContract {
  const termMonths = pick(rng, [12, 18, 24]);
  const elapsedMonths = 1 + Math.floor(rng() * (termMonths - 2));
  const start = new Date(Date.parse(instance.requiredDeliveryDate));
  start.setUTCMonth(start.getUTCMonth() - elapsedMonths);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + termMonths);
  const penaltyRate = round(0.08 + rng() * 0.12);
  const onTimeDeliveryScore = Math.max(
    70,
    Math.min(100, Math.round(incumbent.deliveryReliability - rng() * 3)),
  );
  const qualityScore = Math.max(
    70,
    Math.min(100, Math.round(100 - incumbent.rejectionRate * (3 + rng() * 2))),
  );
  return {
    id: `${scenarioInstanceId}-contrato`,
    scenarioInstanceId,
    supplierId: incumbent.id,
    supplierName: incumbent.displayName,
    purchaseCategory: `Matéria-prima industrial — ${material.name}`,
    totalValue: round(instance.currentUnitPrice * instance.monthlyDemand * termMonths),
    currency: "BRL",
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    indexClause: pick(rng, INDEX_CLAUSES),
    slaDeliveryDays: incumbent.leadTimeDays,
    slaDescription: `Entrega em até ${incumbent.leadTimeDays} dias após confirmação do pedido; OTIF mínimo contratual de 95%; inspeção de recebimento em até 48 horas.`,
    performanceHistory: {
      period: "Últimos 12 meses",
      onTimeDeliveryScore,
      qualityScore,
    },
    terminationClause: `Rescisão por conveniência com aviso prévio de 60 dias; multa de ${Math.round(penaltyRate * 100)}% sobre o saldo remanescente do contrato em caso de rescisão sem justa causa.`,
    penaltyRate,
  };
}
export function generateAluminum(
  config: RunConfig,
  baseState: PrivateNegotiationState,
  marketInput: MarketSnapshot = STATIC_MARKET,
): { aluminum: AluminumPublic; sourcingPrivate: SourcingPrivate } {
  const rng = createRng(
    config.seed,
    `aluminum-${ALUMINUM_TEMPLATE.version}-${config.dificuldade}-${config.urgencia}-${config.materialId ?? "random"}`,
  );
  const integer = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const material = structuredClone(
    config.materialId ? MATERIALS.find((m) => m.id === config.materialId)! : pick(rng, MATERIALS),
  );
  if (!material) throw new Error("Material inexistente.");
  const market = validateMarket(structuredClone(marketInput));
  const reference = calculateBenchmark({
    basePrice: ALUMINUM_TEMPLATE.privateRules.basePrices[material.id],
    fxExposure: material.fxExposure,
    commodityExposure: material.commodityExposure,
    producerIndexExposure: material.producerIndexExposure,
    fxVariation: market.indicators[0]!.value / 5 - 1,
    commodityVariation: market.indicators[1]!.value / 2400 - 1,
    producerIndexVariation: market.indicators[2]!.value / 100 - 1,
    conversionPremium: ALUMINUM_TEMPLATE.privateRules.conversionPremium,
    freight: ALUMINUM_TEMPLATE.privateRules.freight,
  });
  const inventory =
    config.urgencia === "alta"
      ? integer(7, 12)
      : config.urgencia === "media"
        ? integer(13, 21)
        : integer(22, 30);
  const monthlyDemand = integer(6, 30),
    purchaseQuantity = integer(8, 35);
  const id = createHash("sha256")
    .update(
      JSON.stringify({
        config,
        version: ALUMINUM_TEMPLATE.version,
        market: market.hash,
        ...(market.provider === "BuyerLab live v1" ? { marketDate: market.referenceDate } : {}),
      }),
    )
    .digest("hex")
    .slice(0, 32);
  const instance: ScenarioInstance = {
    id,
    templateId: ALUMINUM_TEMPLATE.id,
    templateVersion: ALUMINUM_TEMPLATE.version,
    seed: config.seed,
    difficulty: config.dificuldade,
    materialId: material.id,
    material,
    application: material.typicalApplications[0]!,
    monthlyDemand,
    purchaseQuantity,
    inventoryCoverageDays: inventory,
    inventoryTonnes: round((monthlyDemand * inventory) / 30),
    requiredDeliveryDate: new Date(Date.parse(market.referenceDate) + inventory * 86400000)
      .toISOString()
      .slice(0, 10),
    currentUnitPrice: round(reference.value * (0.94 + rng() * 0.04)),
    marketReferencePrice: reference.value,
    buyerTargetPrice: round(reference.value),
    buyerMaximumPrice: round(reference.value * 1.08),
    estimatedDowntimeCost: integer(80, 300) * 1000,
    urgency: config.urgencia,
    marketSnapshotId: market.id,
    market,
    fxExposure: round(rng() * 0.9),
  };
  const suppliers: SupplierCandidate[] = ["incumbente", "importador", "alternativo"].map(
    (kind, index) => {
      const type = kind as SupplierCandidate["supplierType"];
      const price = round(reference.value * ([1.15, 0.9, 1.05][index]! + rng() * 0.02));
      const lead =
        index === 0
          ? integer(7, Math.max(7, inventory - 3))
          : index === 1
            ? integer(40, 90)
            : integer(7, 25);
      const qualification = index === 0 ? 0 : index === 1 ? integer(10, 45) : integer(3, 12);
      const candidate: SupplierCandidate = {
        id: `${id}-${type}`,
        scenarioInstanceId: id,
        supplierProfileId:
          index === 0 ? baseState.perfil : index === 1 ? "analitico" : "colaborativo",
        displayName: [
          "Nexa Alumínio Nacional",
          "Atlas Metais Internacionais",
          "Circular Chapas Industriais",
        ][index]!,
        supplierType: type,
        country: index === 1 ? "Exterior (fictício)" : "Brasil",
        currency: index === 1 ? "USD" : "BRL",
        initialUnitPrice: price,
        estimatedTotalCost: 0,
        leadTimeDays: lead,
        paymentDays: integer(21, 60),
        minimumOrderQuantity:
          index === 1
            ? integer(Math.max(8, purchaseQuantity - 3), 35)
            : integer(3, Math.min(8, purchaseQuantity)),
        capacityAvailable:
          index === 0
            ? Math.max(purchaseQuantity, monthlyDemand) + 5
            : index === 1
              ? 40
              : integer(8, 28),
        qualityRating: [96, 90, 82][index]!,
        rejectionRate: round(
          index === 0 ? 0.3 + rng() * 0.4 : index === 1 ? 0.8 + rng() * 0.5 : 1.3 + rng() * 1.2,
        ),
        deliveryReliability: [97, 90, 88][index]!,
        certificationStatus: index === 2 ? "pendente" : "validada",
        qualificationDays: qualification,
        switchingCost:
          index === 0
            ? 0
            : round(
                price *
                  purchaseQuantity *
                  (index === 1 ? 0.025 + rng() * 0.015 : 0.005 + rng() * 0.015),
              ),
        logisticsRisk: [0.05, 0.3, 0.15][index]!,
        fxRisk: index === 1 ? round(0.5 + rng() * 0.4) : 0,
        esgAttributes:
          index === 2
            ? ["Conteúdo reciclado declarado, sujeito à homologação"]
            : ["Rastreabilidade de lote exigida"],
        publicFacts: [
          index === 0
            ? "Histórico conhecido e atendimento local"
            : index === 1
              ? "Preço normalizado em BRL/t; componente USD e custos de importação"
              : "Homologação pendente e capacidade limitada",
          ...material.certificationRequirements,
        ],
      };
      candidate.estimatedTotalCost = round(
        price * purchaseQuantity +
          candidate.switchingCost +
          price * purchaseQuantity * candidate.fxRisk * ALUMINUM_TEMPLATE.publicRules.fxStress,
      );
      return candidate;
    },
  );
  const supplierConfigs: Record<string, SupplierPrivate> = {},
    states: Record<string, PrivateNegotiationState> = {};
  suppliers.forEach((supplier, index) => {
    const state = {
      ...structuredClone(baseState),
      perfil: supplier.supplierProfileId,
      confianca: index === 0 ? baseState.confianca : 45,
      frustracao: 25,
      abertura: 50,
      concessionDepth: 0,
      contrapartidas: [],
      eventosOcorridos: [],
      tentativasIndevidas: 0,
      turnosSemAvanco: 0,
    };
    const ladder = ALUMINUM_TEMPLATE.privateRules.ladderRatios.map((ratio) =>
      round(supplier.initialUnitPrice * ratio),
    );
    supplierConfigs[supplier.id] = {
      floor: ladder.at(-1)!,
      concessionLadder: ladder,
      persona: supplier.displayName,
      priorities:
        index === 1
          ? ["Consolidação de carga", "Pagamento e proteção cambial"]
          : ["Previsibilidade", "Volume mínimo", "Contrato estável"],
      batna:
        index === 0
          ? "Outros clientes nacionais"
          : index === 1
            ? "Consolidar lote de exportação"
            : "Ocupar capacidade em parceria futura",
      disclosures: {
        forecast: "Programação estável reduz reprocessamento e desperdício de chapas.",
        interests: "Contrato, quantidade garantida e pagamento compatível permitem rever o pacote.",
        operations:
          "Podemos negociar SLA, inspeção, garantia e plano de entrega; homologação e capacidade precisam ser respeitadas.",
      },
      initialState: structuredClone(state),
    };
    states[supplier.id] = state;
  });
  const aluminum: AluminumPublic = {
    instance,
    suppliers,
    initialSupplierId: suppliers[0]!.id,
    activeSupplierId: suppliers[0]!.id,
    switchCount: 0,
    switches: [],
    blueprint: publicBlueprint(instance, suppliers[0]!),
    currentContract: generateSupplierContract(rng, id, material, suppliers[0]!, instance),
  };
  validateGenerated(aluminum);
  return {
    aluminum,
    sourcingPrivate: {
      supplierConfigs,
      states,
      generationMetadata: {
        templateVersion: ALUMINUM_TEMPLATE.version,
        benchmarkComponents: reference,
        attempts: 1,
      },
    },
  };
}
export function validateGenerated(value: AluminumPublic) {
  const i = value.instance;
  if (
    i.purchaseQuantity < 8 ||
    i.purchaseQuantity > 35 ||
    i.monthlyDemand < 6 ||
    i.monthlyDemand > 30 ||
    i.inventoryCoverageDays < 7 ||
    i.inventoryCoverageDays > 30 ||
    !Number.isFinite(i.marketReferencePrice) ||
    i.buyerMaximumPrice <= 0
  )
    throw new Error("Instância fora das faixas.");
  if (
    !value.suppliers.some(
      (s) =>
        s.certificationStatus === "validada" &&
        s.leadTimeDays + s.qualificationDays <= i.inventoryCoverageDays &&
        s.capacityAvailable >= i.purchaseQuantity &&
        s.minimumOrderQuantity <= i.purchaseQuantity &&
        s.initialUnitPrice * 0.86 <= i.buyerMaximumPrice,
    )
  )
    throw new Error("Instância sem estratégia viável.");
  for (const s of value.suppliers)
    if (
      !Number.isFinite(s.initialUnitPrice) ||
      s.initialUnitPrice <= 0 ||
      s.paymentDays < 21 ||
      s.paymentDays > 60 ||
      s.qualificationDays < 0 ||
      s.qualificationDays > 45 ||
      s.rejectionRate < 0.3 ||
      s.rejectionRate > 2.5 ||
      s.fxRisk < 0 ||
      s.fxRisk > 0.9 ||
      s.leadTimeDays < (s.supplierType === "importador" ? 40 : 7) ||
      s.leadTimeDays > (s.supplierType === "importador" ? 90 : 30) ||
      (s.supplierType === "importador" && s.fxRisk === 0)
    )
      throw new Error("Fornecedor incoerente.");
  const c = value.currentContract;
  if (
    !c ||
    c.totalValue <= 0 ||
    Date.parse(c.endDate) <= Date.parse(c.startDate) ||
    c.penaltyRate < 0 ||
    c.penaltyRate > 1 ||
    c.slaDeliveryDays <= 0 ||
    c.performanceHistory.onTimeDeliveryScore < 0 ||
    c.performanceHistory.qualityScore < 0
  )
    throw new Error("Contrato do fornecedor incoerente.");
}
export function publicBlueprint(
  i: ScenarioInstance,
  s: SupplierCandidate,
): PublicScenarioBlueprint {
  const { escada: _ladder, eventos: _events, ...publicLegacy } = legacyBlueprint;
  const defaults = {
    ...offerDefaults,
    precoUnitario: i.buyerTargetPrice,
    volumeMinimoMensal: i.monthlyDemand,
    leadTimeDias: s.leadTimeDays,
    pagamentoDias: s.paymentDays,
    otifMeta: s.deliveryReliability,
    limiteDefeitos: s.rejectionRate,
    forecastCongeladoDias: 30,
  };
  return {
    ...publicLegacy,
    id: i.templateId,
    versao: i.templateVersion,
    titulo: `Compra de chapas ${i.materialId}`,
    ofertaInicialComprador: defaults,
    brief: {
      compradora: "Orion Equipamentos",
      fornecedor: s.displayName,
      componente: i.material.name,
      contexto: [
        `Compra de ${i.purchaseQuantity} t de ${i.material.name} para ${i.application}.`,
        `Consumo mensal de ${i.monthlyDemand} t; cobertura de ${i.inventoryCoverageDays} dias (${i.inventoryTonnes} t).`,
        "Todos os fornecedores, dados técnicos e indicadores deste exercício são fictícios.",
      ],
      contrato: [
        { rotulo: "Preço atual (BRL/t)", valor: String(i.currentUnitPrice) },
        { rotulo: "Pagamento candidato", valor: `${s.paymentDays} dias` },
        { rotulo: "Lead time", valor: `${s.leadTimeDays} dias` },
      ],
      mercado: [
        { rotulo: "Benchmark didático (BRL/t)", valor: String(i.marketReferencePrice) },
        { rotulo: "Data necessária", valor: i.requiredDeliveryDate },
        { rotulo: "Quantidade", valor: `${i.purchaseQuantity} t` },
      ],
      historico: [...s.publicFacts, ...i.material.qualityRequirements],
      desempenho: [
        {
          rotulo: "OTIF histórico",
          valor: `${s.deliveryReliability}%`,
          meta: "95%",
          status: s.deliveryReliability >= 95 ? "ok" : "abaixo",
        },
        {
          rotulo: "Rejeição histórica",
          valor: `${s.rejectionRate}%`,
          meta: "1%",
          status: s.rejectionRate <= 1 ? "ok" : "abaixo",
        },
      ],
      riscos: [
        `Homologação: ${s.qualificationDays} dias. Certificação: ${s.certificationStatus}.`,
        `Capacidade: ${s.capacityAvailable} t; MOQ: ${s.minimumOrderQuantity} t.`,
        "Uma troca consome tempo e orçamento; preço menor não garante continuidade.",
        `Parada estimada: BRL ${i.estimatedDowntimeCost}/dia.`,
      ],
    },
    mandato: {
      ...legacyBlueprint.mandato,
      objetivo: `Comprar ${i.purchaseQuantity} t, até BRL ${i.buyerMaximumPrice}/t, protegendo continuidade e homologação.`,
      precoAtual: i.currentUnitPrice,
      precoProposto: s.initialUnitPrice,
      limitePrecoEfetivo: i.buyerMaximumPrice,
      demandaMensal: i.monthlyDemand,
      diasEstoque: i.inventoryCoverageDays,
      impactoParadaDia: i.estimatedDowntimeCost,
      diasQualificacaoAlternativo: s.qualificationDays,
      coberturaAlternativoInicial: Math.min(1, s.capacityAvailable / i.purchaseQuantity),
      prioridades: [
        "Comparar custo total, prazo, qualidade e risco cambial.",
        "Justificar permanência ou troca com dados do dossiê.",
        ...i.material.certificationRequirements,
      ],
    },
    variaveis: legacyBlueprint.variaveis.map((v) => ({
      ...v,
      descricao:
        v.id === "preco"
          ? "Preço em BRL por tonelada; quantidade congelada na instância."
          : v.descricao,
    })),
  };
}
export function activeSupplier(stored: StoredRun) {
  return stored.aluminum?.suppliers.find((s) => s.id === stored.aluminum!.activeSupplierId);
}
export function contextFor(stored: StoredRun) {
  const a = stored.aluminum,
    s = activeSupplier(stored);
  if (!a || !s || !stored.sourcingPrivate)
    return { blueprint: legacyBlueprint, rules: legacyRules };
  const privateConfig = stored.sourcingPrivate.supplierConfigs[s.id]!;
  return {
    blueprint: {
      ...a.blueprint,
      escada: legacyBlueprint.escada.map((step, index) => ({
        ...step,
        preco: privateConfig.concessionLadder[index]!,
      })),
      eventos: legacyBlueprint.eventos
        .filter((e) => s.supplierType === "importador" || e.id !== "atualizacao_alternativo")
        .map((e) => ({ ...e, descricao: e.descricao.replaceAll("Nexa", s.displayName) })),
    },
    rules: {
      ...legacyRules,
      floor: privateConfig.floor,
      initialOffer: {
        ...legacyRules.initialOffer,
        precoUnitario: s.initialUnitPrice,
        leadTimeDias: s.leadTimeDays,
        pagamentoDias: s.paymentDays,
        otif: s.deliveryReliability,
      },
      disclosures: privateConfig.disclosures as typeof legacyRules.disclosures,
      packages: privateConfig.concessionLadder.map((price, index) => ({
        price,
        months: index >= 5 ? 18 : index >= 2 ? 12 : 6,
        volume: a.instance.monthlyDemand,
        forecast: index >= 5 ? 60 : index >= 3 ? 30 : 15,
        payment: Math.max(21, s.paymentDays - (index >= 4 ? 7 : 0)),
      })),
    },
  };
}
