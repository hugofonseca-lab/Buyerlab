import type {
  EvaluationReport,
  Outcome,
  RunConfig,
  RunSnapshot,
  SimulationRun,
  StructuredFinalOffer,
  TurnResult,
} from "@/domain/types";

export interface SimulationProvider {
  switchSupplier(runId: string, supplierId: string, reason: string): Promise<RunSnapshot>;
  getHistory(): Promise<import("@/domain/aluminum").HistoryResponse>;
  createRun(config: RunConfig): Promise<SimulationRun>;
  getRun(runId: string): Promise<RunSnapshot | null>;
  updateNotes(runId: string, notes: string): Promise<void>;
  sendBuyerMessage(runId: string, text: string): Promise<TurnResult>;
  submitFinalOffer(runId: string, offer: StructuredFinalOffer): Promise<Outcome>;
  getReport(runId: string): Promise<EvaluationReport | null>;
  restartRun(runId: string, sameSeed: boolean): Promise<SimulationRun>;
  simulateNextFailure(): void;
  shareReport(runId: string): Promise<string>;
}

export class ApiSimulationProvider implements SimulationProvider {
  switchSupplier(runId: string, supplierId: string, reason: string): Promise<RunSnapshot> {
    return this.command({
      action: "switch",
      runId,
      supplierId,
      reason,
      expectedTurn: this.turns.get(runId) ?? 0,
    });
  }
  async getHistory(): Promise<import("@/domain/aluminum").HistoryResponse> {
    const response = await fetch("/api/history", {
      credentials: "same-origin",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Não foi possível carregar o histórico.");
    return response.json();
  }
  private turns = new Map<string, number>();
  private pending = new Map<string, { raw: string; key: string }>();
  private forceMock = false;
  private sessionReady: Promise<void> | undefined;
  private async command<T>(body: object): Promise<T> {
    this.sessionReady ??= fetch("/api/session", {
      credentials: "same-origin",
      signal: AbortSignal.timeout(10000),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Não foi possível iniciar a sessão.");
      })
      .catch((error) => {
        this.sessionReady = undefined;
        throw error;
      });
    await this.sessionReady;
    const raw = JSON.stringify(body);
    const slot = raw;
    const pending = this.pending.get(slot) ?? { raw, key: crypto.randomUUID() };
    this.pending.set(slot, pending);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch("/api/simulations", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "Idempotency-Key": pending.key },
          body: raw,
          signal: AbortSignal.timeout(35000),
        });
        const value = await response.json();
        if (!response.ok) {
          this.pending.delete(slot);
          throw new Error(value.error?.message ?? "Falha na simulação.");
        }
        this.pending.delete(slot);
        return value as T;
      } catch (error) {
        if (attempt === 1 || !this.pending.has(slot)) throw error;
      }
    }
    throw new Error("Não foi possível concluir a solicitação.");
  }
  createRun(config: RunConfig): Promise<SimulationRun> {
    return this.command({ action: "start", config });
  }
  async getRun(runId: string): Promise<RunSnapshot | null> {
    const response = await fetch(`/api/simulations/${encodeURIComponent(runId)}`, {
      credentials: "same-origin",
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Não foi possível retomar a execução.");
    const snapshot = (await response.json()) as RunSnapshot;
    this.turns.set(runId, snapshot.estadoPublico.turno);
    return snapshot;
  }
  updateNotes(runId: string, notes: string): Promise<void> {
    return this.command({ action: "notes", runId, notes });
  }
  async sendBuyerMessage(runId: string, text: string): Promise<TurnResult> {
    const result = await this.command<TurnResult>({
      action: "message",
      runId,
      text,
      expectedTurn: this.turns.get(runId) ?? 0,
      forceMock: this.forceMock,
    });
    this.forceMock = false;
    this.turns.set(runId, result.snapshot.estadoPublico.turno);
    return result;
  }
  submitFinalOffer(runId: string, offer: StructuredFinalOffer): Promise<Outcome> {
    return this.command({ action: "finalize", runId, offer, accepted: true });
  }
  getReport(runId: string): Promise<EvaluationReport | null> {
    return this.command({ action: "evaluate", runId });
  }
  restartRun(runId: string, sameSeed: boolean): Promise<SimulationRun> {
    return this.command({ action: "retry", runId, sameSeed });
  }
  simulateNextFailure(): void {
    this.forceMock = true;
  }
  async shareReport(runId: string): Promise<string> {
    const result = await this.command<{ token: string }>({ action: "share", runId });
    return `${window.location.origin}/relatorio?token=${encodeURIComponent(result.token)}`;
  }
}
