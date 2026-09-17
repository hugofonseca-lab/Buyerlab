import type { Difficulty, PublicScenarioBlueprint, SupplierProfile, Urgency } from "./types";
export type MaterialId = "5052-H32" | "6061-T6" | "7075-T6";
export interface Material {
  id: MaterialId;
  code: string;
  name: string;
  alloy: string;
  temper: string;
  unit: "t";
  description: string;
  typicalApplications: string[];
  qualityRequirements: string[];
  certificationRequirements: string[];
  criticalityRange: [number, number];
  commodityExposure: number;
  fxExposure: number;
  producerIndexExposure: number;
  active: boolean;
}
export interface MarketIndicator {
  code: string;
  name: string;
  value: number;
  unit: string;
  date: string;
  source: string;
  url: string | null;
  frequency: string;
  status: "simulado" | "real";
}
export interface MarketSnapshot {
  id: string;
  referenceDate: string;
  fetchedAt: string;
  provider: string;
  status: "simulado" | "misto" | "real";
  fallbackUsed: boolean;
  indicators: MarketIndicator[];
  sourceUrls: string[];
  hash: string;
  createdAt: string;
}
export interface SupplierCandidate {
  id: string;
  scenarioInstanceId: string;
  supplierProfileId: SupplierProfile;
  displayName: string;
  supplierType: "incumbente" | "importador" | "alternativo";
  country: string;
  currency: "BRL" | "USD";
  initialUnitPrice: number;
  estimatedTotalCost: number;
  leadTimeDays: number;
  paymentDays: number;
  minimumOrderQuantity: number;
  capacityAvailable: number;
  qualityRating: number;
  rejectionRate: number;
  deliveryReliability: number;
  certificationStatus: "validada" | "pendente";
  qualificationDays: number;
  switchingCost: number;
  logisticsRisk: number;
  fxRisk: number;
  esgAttributes: string[];
  publicFacts: string[];
}
export interface ScenarioInstance {
  id: string;
  templateId: string;
  templateVersion: string;
  seed: string;
  difficulty: Difficulty;
  materialId: MaterialId;
  material: Material;
  application: string;
  monthlyDemand: number;
  purchaseQuantity: number;
  inventoryCoverageDays: number;
  inventoryTonnes: number;
  requiredDeliveryDate: string;
  currentUnitPrice: number;
  marketReferencePrice: number;
  buyerTargetPrice: number;
  buyerMaximumPrice: number;
  estimatedDowntimeCost: number;
  urgency: Urgency;
  marketSnapshotId: string;
  market: MarketSnapshot;
  fxExposure: number;
}
export interface SupplierSwitch {
  id: string;
  runId: string;
  fromSupplierId: string;
  toSupplierId: string;
  turnIndex: number;
  reason: string;
  timePenaltyDays: number;
  financialImpact: number;
  riskImpact: number;
  createdAt: string;
}
export interface SourcingResult {
  supplierDecisionScore: number;
  switchAssessment: string;
  totalCost: number;
  bestFeasibleTotalCost: number;
  delayDays: number;
  switchingCost: number;
  fxExposure: number;
  finalSupplier: string;
  costBasis: string;
}
export interface SupplierContract {
  id: string;
  scenarioInstanceId: string;
  supplierId: string;
  supplierName: string;
  purchaseCategory: string;
  totalValue: number;
  currency: "BRL" | "USD";
  startDate: string;
  endDate: string;
  indexClause: string;
  slaDeliveryDays: number;
  slaDescription: string;
  performanceHistory: {
    period: string;
    onTimeDeliveryScore: number;
    qualityScore: number;
  };
  terminationClause: string;
  penaltyRate: number;
}
export interface AluminumPublic {
  activeEstimate?: {
    totalCost: number;
    delayDays: number;
    switchingCost: number;
    fxProvision: number;
    arrival: number;
  };
  instance: ScenarioInstance;
  suppliers: SupplierCandidate[];
  initialSupplierId: string;
  activeSupplierId: string;
  finalSupplierId?: string;
  switchCount: number;
  switches: SupplierSwitch[];
  blueprint: PublicScenarioBlueprint;
  currentContract: SupplierContract;
}
export interface HistoryEntry {
  materialId?: MaterialId;
  mode?: import("./types").SimulationMode;
  outcome?: import("./types").Outcome;
  scenarioVersion?: string;
  initialSupplier?: string;
  supplierSwitched?: boolean;
  runId: string;
  label: string;
  seed: string;
  score: number;
  completedAt: string;
  difficulty: string;
  rubricVersion: string;
  comparableGroupKey: string;
  progressEligible: boolean;
  finalSupplier: string;
  competencies: { id: string; label: string; points: number; maximum: number }[];
}
export interface ProgressGroup {
  key: string;
  count: number;
  latestScore: number;
  bestScore: number;
  lastThreeAverage: number;
  firstToLastDifference: number | null;
  strongestCompetency: string | null;
  mostImprovedCompetency: string | null;
}
export interface HistoryResponse {
  entries: HistoryEntry[];
  groups: ProgressGroup[];
  totalCompleted: number;
}
