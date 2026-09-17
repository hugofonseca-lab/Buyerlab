import type { HistoryEntry, HistoryResponse } from "../domain/aluminum";
import type { StoredRun } from "./model";
export function summarizeHistory(runs: StoredRun[]): HistoryResponse {
  const entries: HistoryEntry[] = runs
    .filter((r) => r.relatorio && r.run.status === "concluida")
    .map((stored) => {
      const report = stored.relatorio!;
      return {
        runId: stored.run.id,
        ...(stored.aluminum ? { materialId: stored.aluminum.instance.materialId } : {}),
        mode: stored.run.modo,
        outcome: report.resultado,
        scenarioVersion: stored.run.cenarioVersao,
        initialSupplier:
          stored.aluminum?.suppliers.find((s) => s.id === stored.aluminum?.initialSupplierId)
            ?.displayName ?? "Nexa Componentes",
        supplierSwitched: Boolean(stored.aluminum?.switchCount),
        label: stored.aluminum?.instance.material.name ?? "Cenário legado",
        seed: stored.run.seed,
        score: report.notaTotal,
        completedAt: report.gerandoEm,
        difficulty: stored.run.dificuldade,
        rubricVersion: report.rubricVersion ?? `legacy-${report.engineVersao}`,
        comparableGroupKey:
          report.comparableGroupKey ??
          `legacy-${report.engineVersao}|${stored.run.dificuldade}|${stored.run.modo}|${report.avaliacaoProvisoria ? "rules" : "ai"}|100`,
        progressEligible: report.progressEligible ?? true,
        finalSupplier: report.sourcing?.finalSupplier ?? "Nexa Componentes",
        competencies: [...report.determinantes, ...report.qualitativas].map((c) => ({
          id: c.id,
          label: c.rotulo,
          points: c.pontos,
          maximum: c.maximo,
        })),
      };
    })
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt) || b.runId.localeCompare(a.runId));
  const keys = [
    ...new Set(entries.filter((e) => e.progressEligible).map((e) => e.comparableGroupKey)),
  ];
  const groups = keys.map((key) => {
    const group = entries.filter((e) => e.comparableGroupKey === key && e.progressEligible),
      last = group[0]!,
      first = group.at(-1)!;
    const mostImproved = [...last.competencies].sort(
      (a, b) =>
        (b.points - (first.competencies.find((c) => c.id === b.id)?.points ?? 0)) / b.maximum -
        (a.points - (first.competencies.find((c) => c.id === a.id)?.points ?? 0)) / a.maximum,
    )[0];
    return {
      key,
      count: group.length,
      latestScore: last.score,
      bestScore: Math.max(...group.map((e) => e.score)),
      lastThreeAverage:
        Math.round(
          (group.slice(0, 3).reduce((sum, e) => sum + e.score, 0) / Math.min(3, group.length)) *
            100,
        ) / 100,
      firstToLastDifference: group.length < 2 ? null : last.score - first.score,
      strongestCompetency:
        [...last.competencies].sort((a, b) => b.points / b.maximum - a.points / a.maximum)[0]
          ?.label ?? null,
      mostImprovedCompetency:
        group.length < 2 ||
        !mostImproved ||
        mostImproved.points <=
          (first.competencies.find((c) => c.id === mostImproved.id)?.points ?? 0)
          ? null
          : mostImproved.label,
    };
  });
  return { entries, groups, totalCompleted: entries.length };
}
