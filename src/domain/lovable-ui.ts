/* Public presentation contracts from Lovable commit 383fb1d. No simulation rules. */
import type { Difficulty, Urgency, SimulationMode, Outcome } from "./types";
export type MaterialCode = "5052-H32" | "6061-T6" | "7075-T6";
export type SupplierKind = "incumbente_nacional" | "importador" | "alternativo_nacional";
export type CurrencyCode = "BRL" | "USD";
export type RiskLevel = "baixo" | "moderado" | "alto";
export interface MaterialDefinition {
  code: MaterialCode;
  name: string;
  description: string;
}
export interface MarketSnapshot {
  indicators?: import("./aluminum").MarketIndicator[];
  fallbackUsed?: boolean;
  referenceDate: string;
  source: string;
  ptax: number;
  aluminumBenchmarkUsdTon: number;
  industrialIndex: number;
  industrialIndexLabel: string;
  explanation: string;
  disclaimer: string;
}
export interface SupplierCandidate {
  id: string;
  name: string;
  kind: SupplierKind;
  quoteUnitPrice: number;
  currency: CurrencyCode;
  estimatedTotalCost: number;
  leadTimeDays: number;
  paymentDays: number;
  moqTons: number;
  quality: string;
  reliability: number;
  certification: string;
  logisticsRisk: RiskLevel;
  switchingCost: number;
  qualificationDays: number;
  esgImpact: string;
  negotiationStatus: "disponivel" | "ativo" | "substituido";
  publicHistory: string;
}
export interface SupplierContract {
  supplierName: string;
  purchaseCategory: string;
  totalValue: number;
  currency: CurrencyCode;
  startDate: string;
  endDate: string;
  indexClause: string;
  slaDeliveryDays: number;
  slaDescription: string;
  onTimeDeliveryScore: number;
  qualityScore: number;
  performancePeriod: string;
  terminationClause: string;
  penaltyRate: number;
}
export interface SupplierComparisonSummary {
  bestPriceSupplierId: string;
  lowestRiskSupplierId: string;
  shortestLeadTimeSupplierId: string;
  bestQualitySupplierId: string;
  bestTotalCostSupplierId: string;
}
export interface ScenarioInstance {
  scenarioId: string;
  scenarioSeed: string;
  scenarioVersion: string;
  difficulty: Difficulty;
  marketVertical: string;
  buyerName: string;
  title: string;
  material: MaterialDefinition;
  materialSpecification: string;
  application: string;
  monthlyDemand: number;
  purchaseQuantity: number;
  unit: "t";
  inventoryCoverageDays: number;
  requiredDeliveryDate: string;
  urgency: Urgency;
  criticality: RiskLevel;
  currentUnitPrice: number;
  marketReferencePrice: number;
  buyerTargetPrice: number;
  buyerMaximumPrice: number;
  currency: CurrencyCode;
  qualityRequirements: string[];
  certificationRequired: string | null;
  continuityRisk: string;
  delayConsequence: string;
  nonConformityConsequence: string;
  interruptionImpactPerDay: number;
  buyerObjective: string;
  marketSnapshot: MarketSnapshot;
  supplierCandidates: SupplierCandidate[];
  comparison: SupplierComparisonSummary;
  activeSupplierId: string;
  context: string[];
  risks: string[];
  currentContract: SupplierContract;
}
export interface SupplierSwitch {
  fromSupplierId: string;
  toSupplierId: string;
  justification: string;
  switchedAt: string;
  turn: number;
  cost: number;
  daysConsumed: number;
  riskImpact: string;
}
export interface HistoryEntry {
  runId: string;
  createdAt: string;
  completedAt: string;
  material: MaterialCode | "legado";
  seed: string;
  difficulty: Difficulty;
  mode: SimulationMode;
  scenarioVersion: string;
  initialSupplierId: string;
  initialSupplierName: string;
  finalSupplierId: string;
  finalSupplierName: string;
  supplierSwitched: boolean;
  outcome: Outcome;
  score: number;
  competencies: { id: string; label: string; score: number; maximum: number }[];
  comparableKey: string;
  legacy?: boolean;
}
export interface HistoryFilters {
  material?: MaterialCode | "todos";
  difficulty?: Difficulty | "todos";
  mode?: SimulationMode | "todos";
  scenarioVersion?: string | "todos";
  finalSupplierId?: string | "todos";
  period?: "todos" | "7d" | "30d" | "90d";
}
export interface LearningPoint extends HistoryEntry {
  movingAverage: number;
}
export interface HistorySummary {
  latestScore: number | null;
  bestScore: number | null;
  lastThreeAverage: number | null;
  completedCount: number;
  comparableEvolution: number | null;
  strongestCompetency: string | null;
  mostImprovedCompetency: string | null;
  comparable: boolean;
  comparisonMessage: string;
  learningCurve: LearningPoint[];
}
