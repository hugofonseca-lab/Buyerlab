import { describe, expect, it } from "vitest";
import { createRun, publicSnapshot, switchSupplier } from "../src/server/engine.server";
import { toLovableSnapshot } from "../src/simulation/lovable-view";
import { historyView } from "../src/simulation/lovable-history";
import type { HistoryResponse } from "../src/domain/aluminum";

describe("integração da interface Lovable", () => {
  it("preserva dados autorizados, moeda e identidade durante a troca", () => {
    const run = createRun({
      scenarioType: "aluminum",
      materialId: "6061-T6",
      seed: "UI",
      modo: "treinamento",
      dificuldade: "iniciante",
      perfil: "colaborativo",
      urgencia: "baixa",
    });
    const raw = publicSnapshot(run);
    const before = JSON.stringify(raw);
    const view = toLovableSnapshot(raw);
    expect(view.scenario!.supplierCandidates).toHaveLength(3);
    expect(view.scenario!.supplierCandidates.every((s) => s.currency === "BRL")).toBe(true);
    expect(
      view.scenario!.supplierCandidates.find((s) => s.kind === "importador")!.logisticsRisk,
    ).toBe("alto");
    expect(view.scenario!.marketSnapshot.disclaimer).toContain("Valores simulados");
    expect(view.scenario!.marketSnapshot.indicators!.every((i) => i.status === "simulado")).toBe(
      true,
    );
    expect(view.scenario!.material.code).toBe("6061-T6");
    expect(JSON.stringify(view)).not.toMatch(
      /supplierConfigs|concessionLadder|precoPiso|privateState/,
    );
    expect(JSON.stringify(raw)).toBe(before);
    const target = run.aluminum!.suppliers[2]!;
    switchSupplier(run, target.id, "Análise de capacidade e homologação da alternativa.");
    const changed = toLovableSnapshot(publicSnapshot(run));
    expect(changed.activeSupplierId).toBe(target.id);
    expect(changed.supplierSwitch!.cost).toBe(target.switchingCost);
    expect(
      changed.scenario!.supplierCandidates.find((s) => s.id === target.id)!.negotiationStatus,
    ).toBe("ativo");
  });
  it("filtra histórico sem misturar curvas de rubricas incompatíveis", () => {
    const entry: HistoryResponse["entries"][number] = {
      runId: "a",
      label: "6061",
      materialId: "6061-T6",
      mode: "treinamento",
      outcome: "acordo",
      seed: "A",
      score: 60,
      completedAt: "2026-09-16T00:00:00Z",
      difficulty: "iniciante",
      rubricVersion: "r1",
      comparableGroupKey: "r1|rules",
      progressEligible: true,
      finalSupplier: "Nexa",
      initialSupplier: "Nexa",
      scenarioVersion: "1",
      competencies: [],
    };
    const data: HistoryResponse = {
      entries: [
        entry,
        { ...entry, runId: "b", score: 80, completedAt: "2026-09-16T01:00:00Z" },
        { ...entry, runId: "c", materialId: "7075-T6", comparableGroupKey: "r2|ai", score: 100 },
      ],
      groups: [],
      totalCompleted: 3,
    };
    expect(historyView(data).summary.learningCurve).toEqual([]);
    expect(historyView(data).summary.lastThreeAverage).toBeNull();
    const filtered = historyView(data, { material: "6061-T6" });
    expect(filtered.entries).toHaveLength(2);
    expect(filtered.summary.lastThreeAverage).toBe(70);
    expect(filtered.summary.comparableEvolution).toBe(20);
    expect(filtered.summary.learningCurve[1]!.movingAverage).toBe(70);
    expect(historyView(data, { finalSupplierId: "outro" }).entries).toEqual([]);
    expect(historyView(data, { period: "7d" }, Date.parse("2026-10-01")).entries).toEqual([]);
  });
});
