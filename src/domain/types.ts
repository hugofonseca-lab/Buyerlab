/**
 * Contratos de domínio do BuyerLab.
 * Estes tipos são o contrato que o backend futuro deverá honrar.
 */

export type SupplierProfile = "colaborativo" | "analitico" | "dominante" | "defensivo";
export type SimulationMode = "treinamento" | "avaliacao";
export type Difficulty = "iniciante" | "intermediario" | "avancado";
export type Urgency = "baixa" | "media" | "alta";
export type RunStatus = "preparacao" | "negociacao" | "proposta" | "concluida";
export type Outcome = "acordo" | "acordo_fragil" | "impasse" | "encerrado";

export type BuyerActionTag =
  | "pergunta_aberta"
  | "diagnostico"
  | "uso_de_dados"
  | "ancoragem"
  | "demanda"
  | "proposta"
  | "concessao_unilateral"
  | "troca_condicional"
  | "ameaca"
  | "empatia"
  | "reformulacao"
  | "resumo"
  | "fechamento"
  | "antietico"
  | "extracao_de_sistema"
  | "neutro";

export interface PublicBrief {
  compradora: string;
  fornecedor: string;
  componente: string;
  contexto: string[];
  contrato: { rotulo: string; valor: string }[];
  mercado: { rotulo: string; valor: string }[];
  historico: string[];
  desempenho: { rotulo: string; valor: string; meta: string; status: "abaixo" | "ok" }[];
  riscos: string[];
}

export interface BuyerMandate {
  objetivo: string;
  precoAtual: number;
  precoProposto: number;
  limitePrecoEfetivo: number;
  demandaMensal: number;
  diasEstoque: number;
  impactoParadaDia: number;
  diasQualificacaoAlternativo: number;
  coberturaAlternativoInicial: number;
  prioridades: string[];
}

export interface ConcessionStep {
  preco: number;
  requisito: string;
  /** Pré-requisitos internos avaliados pelo motor. */
  exigeArgumentoCrivel: boolean;
  exigeReciprocidade: boolean;
  contrapartidasMinimas: number;
  confiancaMinima: number;
}

export type ConcessionLadder = ConcessionStep[];

export interface ConditionalEvent {
  id: string;
  titulo: string;
  descricao: string;
  probabilidade: number;
  turnoMinimo: number;
  prerequisito: "sempre" | "sem_avanco" | "proximo_do_acordo" | "demora";
  efeito: "pressao" | "poder_fornecedor" | "alivio" | "abertura" | "informacao";
}

export interface NegotiableVariable {
  id: string;
  rotulo: string;
  descricao: string;
}

export interface ScoringWeights {
  valorComercial: number;
  continuidade: number;
  qualidadeRisco: number;
  condicoesFechamento: number;
  diagnostico: number;
  estrategia: number;
  concessoes: number;
  comunicacao: number;
  eticaProcesso: number;
}

export interface ScenarioBlueprint {
  ofertaInicialComprador: StructuredFinalOffer;
  id: string;
  versao: string;
  titulo: string;
  brief: PublicBrief;
  mandato: BuyerMandate;
  variaveis: NegotiableVariable[];
  escada: ConcessionLadder;
  eventos: ConditionalEvent[];
  pesos: ScoringWeights;
}

export type PublicScenarioBlueprint = Omit<ScenarioBlueprint, "escada" | "eventos">;

export interface SupplierPrivateConfig {
  precoAlvo: number;
  precoPiso: number;
  ocupacaoCapacidade: number;
  clienteConcorrente: boolean;
  interesses: string[];
  moedasDeTroca: string[];
  sensibilidades: string[];
}

export interface RunConfig {
  scenarioType?: "aluminum" | "legacy" | undefined;
  materialId?: import("./aluminum").MaterialId | undefined;
  modo: SimulationMode;
  dificuldade: Difficulty;
  perfil: SupplierProfile | "aleatorio";
  urgencia: Urgency;
  seed: string;
}

export interface SimulationRun {
  cenarioVersao: string;
  engineVersao: string;
  id: string;
  cenarioId: string;
  seed: string;
  modo: SimulationMode;
  dificuldade: Difficulty;
  urgencia: Urgency;
  /** Perfil efetivamente sorteado (não é revelado ao comprador na negociação). */
  perfilSolicitado: SupplierProfile | "aleatorio";
  criadoEm: string;
  status: RunStatus;
}

export interface VisibleEvent {
  id: string;
  supplierId?: string;
  turno: number;
  titulo: string;
  descricao: string;
}

export interface PublicOffer {
  precoUnitario: number;
  volumeMinimo: string;
  duracaoMeses: number;
  leadTimeDias: number;
  pagamentoDias: number;
  otif: number;
  contrapartidas: string[];
}

export interface PublicNegotiationState {
  turno: number;
  turnosMaximos: number;
  ofertaPublica: PublicOffer;
  eventos: VisibleEvent[];
  encerrada: boolean;
}

export interface NegotiationMessage {
  supplierId?: string;
  supplierName?: string;
  id: string;
  turno: number;
  autor: "comprador" | "fornecedor" | "sistema";
  texto: string;
  criadoEm: string;
  acoes?: BuyerActionTag[];
}

/** Estado interno do fornecedor — NUNCA renderizado durante a negociação. */
export interface PrivateNegotiationState {
  perfil: SupplierProfile;
  confianca: number;
  frustracao: number;
  abertura: number;
  pressao: number;
  percepcaoDePoder: number;
  aversaoRisco: number;
  orientacaoRelacionamento: number;
  /** Profundidade contínua de concessão: 0 = oferta inicial, 1 = piso. */
  concessionDepth: number;
  contrapartidas: string[];
  turnosSemAvanco: number;
  eventosOcorridos: string[];
  tentativasIndevidas: number;
}

/**
 * Limites de concessão calculados pelo motor para o turno atual; a IA só pode propor um novo
 * preço dentro deles (nunca subir, nunca ultrapassar `min`). Prazo/volume/forecast/pagamento
 * continuam sempre derivados pelo motor a partir do preço final, nunca propostos pela IA.
 */
export interface ConcessionEnvelope {
  currentDepth: number;
  maxDepthThisTurn: number;
  blocked: boolean;
  price: { current: number; min: number; max: number; floor: number; initial: number };
}

export interface StructuredFinalOffer {
  precoUnitario: number;
  volumeMinimoMensal: number;
  duracaoMeses: number;
  leadTimeDias: number;
  pagamentoDias: number;
  otifMeta: number;
  limiteDefeitos: number;
  creditosSla: boolean;
  garantiaMeses: number;
  planoContingencia: boolean;
  segundaFonteGradual: boolean;
  estoqueSeguranca: boolean;
  prioridadeProducao: boolean;
  forecastCongeladoDias: number;
  revisoesPeriodicas: boolean;
  contrapartidas: string;
  observacoes: string;
}

export interface EvidenceReference {
  messageId?: string;
  turno: number;
  autor: NegotiationMessage["autor"];
  trecho: string;
  interpretacao: string;
}

export interface CompetencyScore {
  id: string;
  rotulo: string;
  pontos: number;
  maximo: number;
  comentario: string;
  evidencias: EvidenceReference[];
}

export interface EvaluationReport {
  sourcing?: import("./aluminum").SourcingResult;
  scenarioTemplateVersion?: string;
  difficulty?: Difficulty;
  rubricVersion?: string;
  comparableGroupKey?: string;
  progressEligible?: boolean;
  avaliacaoProvisoria: boolean;
  razaoResultado: string;
  cenarioVersao: string;
  engineVersao: string;
  runId: string;
  seed: string;
  gerandoEm: string;
  notaTotal: number;
  resultado: Outcome;
  precoFechado: number | null;
  custoMensalAlcancado: number | null;
  melhorResultadoViavel: { preco: number; custoMensal: number; nota: number };
  perdaDeOportunidadeMensal: number;
  determinantes: CompetencyScore[];
  qualitativas: CompetencyScore[];
  fortes: string[];
  oportunidades: string[];
  errosCriticos: string[];
  recomendacao: string;
  linhaDoTempo: { turno: number; titulo: string; detalhe: string }[];
}

export interface RunSnapshot {
  suggestedOffer?: StructuredFinalOffer;
  aluminum?: import("./aluminum").AluminumPublic;
  provedor?: "mock" | "openai";
  run: SimulationRun;
  estadoPublico: PublicNegotiationState;
  mensagens: NegotiationMessage[];
  anotacoes: string;
  propostaFinal?: StructuredFinalOffer;
  relatorio?: EvaluationReport;
}

export interface TurnResult {
  snapshot: RunSnapshot;
  novosEventos: VisibleEvent[];
}
