import type { BuyerActionTag, PrivateNegotiationState, SupplierProfile } from "../domain/types";
export const ENGINE_VERSION = "2.1.0";
export const rules = {
  floor: 105,
  target: 112,
  capacity: 85,
  maxMessage: 2000,
  maxNotes: 8000,
  turns: { iniciante: 12, intermediario: 10, avancado: 8 },
  difficultyTrust: { iniciante: 5, intermediario: 0, avancado: -5 },
  initialOffer: {
    precoUnitario: 118,
    volumeMinimo: "A definir",
    duracaoMeses: 0,
    leadTimeDias: 14,
    pagamentoDias: 45,
    otif: 91,
    contrapartidas: [] as string[],
  },
  packages: [
    { price: 118, months: 6, volume: 7000, forecast: 0, payment: 45 },
    { price: 114, months: 6, volume: 7000, forecast: 0, payment: 45 },
    { price: 112, months: 12, volume: 9000, forecast: 15, payment: 45 },
    { price: 109, months: 12, volume: 9000, forecast: 30, payment: 45 },
    { price: 107, months: 12, volume: 10000, forecast: 30, payment: 30 },
    { price: 105, months: 18, volume: 10000, forecast: 60, payment: 15 },
  ],
  operational: { minLead: 10, maxOtif: 98, minDefects: 0.5, maxWarranty: 24 },
  /**
   * Ritmo máximo de concessão contínua por turno (profundidade 0..1), por dificuldade — sem isso,
   * um roteiro bem argumentado chegava ao piso em ~4 mensagens em qualquer dificuldade, tornando
   * o limite de turnos (a única outra diferença) quase irrelevante na prática. Em avançado, um
   * turno ótimo a cada mensagem só alcança o piso bem no último turno permitido; qualquer mensagem
   * neutra no meio do caminho já impede chegar lá. baseStep replica o antigo avanço de "um degrau
   * inteiro" (1/5 = 0.2) em iniciante; os bônus permitem turnos muito bem argumentados/recíprocos
   * avançarem mais rápido, sempre limitados pelo teto de confiança/reciprocidade já conquistado
   * (nunca abrem exceção a ele).
   */
  concessionPacing: {
    iniciante: { baseStep: 0.2, argumentBonus: 0.05, reciprocityBonus: 0.05, maxStep: 0.3 },
    intermediario: { baseStep: 0.12, argumentBonus: 0.04, reciprocityBonus: 0.04, maxStep: 0.2 },
    avancado: { baseStep: 0.07, argumentBonus: 0.03, reciprocityBonus: 0.03, maxStep: 0.13 },
  },
  score: {
    lead: [5, 2],
    stock: 4,
    priority: 3,
    contingency: 3,
    otif: [4, 1],
    defects: [4, 1],
    credits: 3,
    warranty: [2, 1],
    reviews: 2,
    duration: [3, 1],
    forecast: 2,
    volume: 2,
    acceptance: 3,
  },
  eventWindowEnd: 8,
  eventPolicies: {
    restricao_capacidade: {
      priority: 5,
      incompatible: [] as string[],
      modifier: 0,
      pressureThreshold: 70,
      delta: 10,
    },
    cliente_concorrente: {
      priority: 4,
      incompatible: ["janela_diretoria"],
      modifier: 0.05,
      pressureThreshold: 70,
      delta: 12,
    },
    atraso_logistico: {
      priority: 3,
      incompatible: [] as string[],
      modifier: 0.05,
      pressureThreshold: 70,
      delta: 12,
    },
    janela_diretoria: {
      priority: 2,
      incompatible: ["cliente_concorrente"],
      modifier: 0,
      pressureThreshold: 70,
      delta: 15,
    },
    atualizacao_alternativo: {
      priority: 1,
      incompatible: [] as string[],
      modifier: 0,
      pressureThreshold: 70,
      delta: -8,
    },
  },
  disclosures: {
    forecast:
      "Mudanças tardias de forecast elevam retrabalho e custos. Previsibilidade tem valor para a Nexa.",
    interests:
      "Contrato longo, volume mínimo e pagamento mais curto permitem discutir um pacote melhor.",
    operations:
      "Podemos discutir prioridade, estoque de segurança, SLA, garantia e créditos com compromissos recíprocos.",
  },
};
type Emotion = Exclude<
  keyof PrivateNegotiationState,
  | "perfil"
  | "concessionDepth"
  | "contrapartidas"
  | "turnosSemAvanco"
  | "eventosOcorridos"
  | "tentativasIndevidas"
>;
export const emotions: Emotion[] = [
  "confianca",
  "frustracao",
  "abertura",
  "pressao",
  "percepcaoDePoder",
  "aversaoRisco",
  "orientacaoRelacionamento",
];
export const deltas: Partial<Record<BuyerActionTag, Partial<Record<Emotion, number>>>> = {
  pergunta_aberta: { confianca: 3, abertura: 4 },
  diagnostico: { confianca: 4, abertura: 7 },
  uso_de_dados: { confianca: 5, abertura: 8, aversaoRisco: -3 },
  ancoragem: { pressao: 2 },
  demanda: { frustracao: 4 },
  proposta: { abertura: 2 },
  concessao_unilateral: { percepcaoDePoder: 10 },
  troca_condicional: { confianca: 8, abertura: 7 },
  ameaca: { confianca: -15, frustracao: 16, abertura: -15, aversaoRisco: 8 },
  empatia: { confianca: 8, frustracao: -8, orientacaoRelacionamento: 7 },
  reformulacao: { confianca: 8, frustracao: -3 },
  resumo: { abertura: 3 },
  fechamento: { pressao: 2 },
  antietico: { confianca: -20, frustracao: 20 },
  extracao_de_sistema: { abertura: -10 },
};
export const profileWeights: Record<SupplierProfile, Partial<Record<BuyerActionTag, number>>> = {
  colaborativo: { empatia: 1.6, troca_condicional: 1.3 },
  analitico: { uso_de_dados: 1.7, demanda: 1.5 },
  dominante: { uso_de_dados: 1.3, ancoragem: 1.2, demanda: 1.2 },
  defensivo: { ameaca: 1.6, empatia: 0.65, reformulacao: 0.7 },
};
