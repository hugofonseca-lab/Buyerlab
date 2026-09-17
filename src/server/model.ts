import type { RunConfig, RunSnapshot, PrivateNegotiationState } from "../domain/types";

export interface EventAudit {
  id: string;
  turno: number;
  probabilidade: number;
  sorteio: number;
  ocorreu: boolean;
}

export interface StoredRun extends RunSnapshot {
  sourcingPrivate?: import("./aluminum.server").SourcingPrivate;
  privateState: PrivateNegotiationState;
  config: RunConfig;
  audit: EventAudit[];
  disclosures: string[];
  providerMode: "mock" | "openai";
}
