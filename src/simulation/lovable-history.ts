import { useMemo } from "react";
import { useSimulation as useApi } from "./context";
import type { HistoryEntry, HistoryFilters, HistorySummary } from "@/domain/lovable-ui";
import type { HistoryResponse } from "@/domain/aluminum";

export function historyView(data: HistoryResponse, filters: HistoryFilters = {}, now = Date.now()) {
  const all: HistoryEntry[] = data.entries
    .map((e): HistoryEntry => ({
      runId: e.runId,
      createdAt: e.completedAt,
      completedAt: e.completedAt,
      material: e.materialId ?? "legado",
      seed: e.seed,
      difficulty: e.difficulty as HistoryEntry["difficulty"],
      mode: e.mode ?? "treinamento",
      scenarioVersion: e.scenarioVersion ?? e.rubricVersion,
      initialSupplierId: e.initialSupplier ?? e.finalSupplier,
      initialSupplierName: e.initialSupplier ?? e.finalSupplier,
      finalSupplierId: e.finalSupplier,
      finalSupplierName: e.finalSupplier,
      supplierSwitched: e.supplierSwitched ?? false,
      outcome: e.outcome ?? "encerrado",
      score: e.score,
      competencies: e.competencies.map((c) => ({
        id: c.id,
        label: c.label,
        score: c.points,
        maximum: c.maximum,
      })),
      comparableKey: e.comparableGroupKey,
      legacy: !e.materialId,
    }))
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.runId.localeCompare(b.runId));
  const entries = all.filter((e) => {
    for (const key of [
      "material",
      "difficulty",
      "mode",
      "scenarioVersion",
      "finalSupplierId",
    ] as const)
      if (filters[key] && filters[key] !== "todos" && filters[key] !== e[key]) return false;
    const days =
      filters.period && filters.period !== "todos" ? Number.parseInt(filters.period) : null;
    return days === null || Date.parse(e.completedAt) >= now - days * 86400000;
  });
  const comparable = new Set(entries.map((e) => e.comparableKey)).size <= 1;
  const last = entries.at(-1),
    first = entries[0];
  const average = (items: HistoryEntry[]) =>
    Math.round((items.reduce((sum, e) => sum + e.score, 0) / items.length) * 100) / 100;
  const strongest = last
    ? [...last.competencies].sort((a, b) => b.score / b.maximum - a.score / a.maximum)[0]
    : null;
  const improved =
    last && first && entries.length > 1 && comparable
      ? [...last.competencies].sort(
          (a, b) =>
            (b.score - (first.competencies.find((c) => c.id === b.id)?.score ?? 0)) / b.maximum -
            (a.score - (first.competencies.find((c) => c.id === a.id)?.score ?? 0)) / a.maximum,
        )[0]
      : null;
  const summary: HistorySummary = {
    latestScore: last?.score ?? null,
    bestScore: entries.length ? Math.max(...entries.map((e) => e.score)) : null,
    lastThreeAverage: comparable && entries.length ? average(entries.slice(-3)) : null,
    completedCount: entries.length,
    comparableEvolution:
      comparable && last && first && entries.length > 1 ? last.score - first.score : null,
    strongestCompetency: strongest?.label ?? null,
    mostImprovedCompetency:
      improved &&
      improved.score > (first?.competencies.find((c) => c.id === improved.id)?.score ?? 0)
        ? improved.label
        : null,
    comparable,
    comparisonMessage:
      "Estas tentativas diferem em material, rubrica, dificuldade, modo ou avaliação IA/regras. Refine os filtros para comparar condições equivalentes.",
    learningCurve: comparable
      ? entries.map((e, index) => ({
          ...e,
          movingAverage: average(entries.slice(Math.max(0, index - 2), index + 1)),
        }))
      : [],
  };
  return {
    entries,
    summary,
    versions: [...new Set(all.map((e) => e.scenarioVersion))],
    suppliers: [...new Set(all.map((e) => e.finalSupplierName))],
  };
}

export function useSimulation() {
  const api = useApi();
  return useMemo(
    () => ({
      restartRun: (id: string, same: boolean) => api.restartRun(id, same),
      loadHistory: async (filters: HistoryFilters) => historyView(await api.getHistory(), filters),
    }),
    [api],
  );
}
