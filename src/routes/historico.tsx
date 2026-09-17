import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, BarChart3, History, RotateCcw, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LearningCurve } from "@/components/buyerlab/learning-curve";
import { PageHeader, Stat } from "@/components/buyerlab/page-header";
import { PageShell } from "@/components/buyerlab/site-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  HistoryEntry,
  HistoryFilters,
  HistorySummary,
  MaterialCode,
} from "@/domain/lovable-ui";
import { rotuloDificuldade, rotuloModo, rotuloResultado } from "@/lib/format";
import { useSimulation } from "@/simulation/lovable-history";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de aprendizado — BuyerLab" },
      {
        name: "description",
        content: "Acompanhe pontuações, competências e tentativas deste dispositivo.",
      },
      { property: "og:title", content: "Histórico de aprendizado — BuyerLab" },
      {
        property: "og:description",
        content: "Curva de aprendizado e relatórios das negociações BuyerLab.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});
const emptySummary: HistorySummary = {
  latestScore: null,
  bestScore: null,
  lastThreeAverage: null,
  completedCount: 0,
  comparableEvolution: null,
  strongestCompetency: null,
  mostImprovedCompetency: null,
  comparable: true,
  comparisonMessage: "",
  learningCurve: [],
};
function HistoryPage() {
  const simulation = useSimulation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<HistoryFilters>({ period: "todos" });
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [versions, setVersions] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const request = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const result = await simulation.loadHistory(filters);
      if (request !== requestVersion.current) return;
      setEntries(result.entries);
      setSummary(result.summary);
      setVersions(result.versions);
      setSuppliers(result.suppliers);
    } catch (cause) {
      if (request === requestVersion.current)
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar o histórico.");
    } finally {
      if (request === requestVersion.current) setLoading(false);
    }
  }, [simulation, filters]);
  const invalidateRequest = useCallback(() => {
    requestVersion.current++;
  }, []);
  useEffect(() => {
    setOffline(!navigator.onLine);
    void load();
    return invalidateRequest;
  }, [load, invalidateRequest]);
  function update<K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) {
    setFilters((old) => ({ ...old, [key]: value }));
  }
  async function repeat(runId: string) {
    try {
      const run = await simulation.restartRun(runId, true);
      await navigate({ to: "/preparacao/$runId", params: { runId: run.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível repetir.");
    }
  }
  return (
    <PageShell>
      <PageHeader
        eyebrow="Histórico deste dispositivo"
        title="Sua curva de aprendizado"
        description="Resultados ficam salvos no servidor e vinculados à sessão deste navegador. Use filtros para comparar tentativas equivalentes."
      />
      <section className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {offline && (
          <div className="flex gap-3 rounded-md border border-warning/40 bg-warning/5 p-4 text-sm">
            <WifiOff className="size-5 text-warning" />
            Sem conexão. Reconecte para consultar o histórico salvo.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Filter
            label="Material"
            value={filters.material ?? "todos"}
            onChange={(v) => update("material", v as MaterialCode | "todos")}
            options={[
              ["todos", "Todos"],
              ["6061-T6", "6061-T6"],
              ["5052-H32", "5052-H32"],
              ["7075-T6", "7075-T6"],
            ]}
          />
          <Filter
            label="Dificuldade"
            value={filters.difficulty ?? "todos"}
            onChange={(v) => update("difficulty", v as HistoryFilters["difficulty"])}
            options={[
              ["todos", "Todas"],
              ["iniciante", "Iniciante"],
              ["intermediario", "Intermediário"],
              ["avancado", "Avançado"],
            ]}
          />
          <Filter
            label="Modo"
            value={filters.mode ?? "todos"}
            onChange={(v) => update("mode", v as HistoryFilters["mode"])}
            options={[
              ["todos", "Todos"],
              ["treinamento", "Treinamento"],
              ["avaliacao", "Avaliação"],
            ]}
          />
          <Filter
            label="Versão"
            value={filters.scenarioVersion ?? "todos"}
            onChange={(v) => update("scenarioVersion", v)}
            options={[["todos", "Todas"], ...versions.map((v): [string, string] => [v, v])]}
          />
          <Filter
            label="Fornecedor final"
            value={filters.finalSupplierId ?? "todos"}
            onChange={(v) => update("finalSupplierId", v)}
            options={[["todos", "Todos"], ...suppliers.map((v): [string, string] => [v, v])]}
          />
          <Filter
            label="Período"
            value={filters.period ?? "todos"}
            onChange={(v) => update("period", v as HistoryFilters["period"])}
            options={[
              ["todos", "Todo o período"],
              ["7d", "7 dias"],
              ["30d", "30 dias"],
              ["90d", "90 dias"],
            ]}
          />
        </div>
        {loading ? (
          <div className="panel p-10 text-center text-sm text-muted-foreground">
            Carregando histórico…
          </div>
        ) : error ? (
          <div role="alert" className="panel p-8 text-center">
            <AlertTriangle className="mx-auto text-destructive" />
            <p className="mt-3">{error}</p>
            <Button className="mt-4" onClick={() => void load()}>
              <RotateCcw />
              Tentar novamente
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="panel p-10 text-center">
            <History className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-bold">Nenhuma tentativa encontrada</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ajuste os filtros ou conclua uma nova simulação.
            </p>
            <Button asChild className="mt-5">
              <Link to="/configurar">
                Iniciar simulação <ArrowRight />
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Última pontuação"
                value={`${summary.latestScore ?? "—"}/100`}
                tone="accent"
              />
              <Stat label="Melhor pontuação" value={`${summary.bestScore ?? "—"}/100`} />
              <Stat
                label="Média das últimas 3"
                value={summary.lastThreeAverage === null ? "—" : `${summary.lastThreeAverage}/100`}
              />
              <Stat label="Concluídas" value={String(summary.completedCount)} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Highlight
                label="Evolução comparável"
                value={
                  summary.comparableEvolution === null
                    ? "Sem tendência"
                    : `${summary.comparableEvolution >= 0 ? "+" : ""}${summary.comparableEvolution} pontos`
                }
              />
              <Highlight
                label="Competência mais forte"
                value={summary.strongestCompetency ?? "Ainda não disponível"}
              />
              <Highlight
                label="Competência que mais evoluiu"
                value={summary.mostImprovedCompetency ?? "Ainda não disponível"}
              />
            </div>
            <section className="panel p-5 sm:p-7">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-accent" />
                <h2 className="text-xl font-bold">Curva de aprendizado</h2>
              </div>
              {!summary.comparable && (
                <p
                  role="status"
                  className="mt-4 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm"
                >
                  {summary.comparisonMessage}
                </p>
              )}
              {entries.length === 1 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Uma tentativa ainda não indica tendência.
                </p>
              )}
              <div className="mt-5">
                <LearningCurve points={summary.learningCurve} />
              </div>
            </section>
            <section>
              <h2 className="text-xl font-bold">Tentativas</h2>
              <div className="mt-4 space-y-4">
                {[...entries].reverse().map((entry) => (
                  <Attempt key={entry.runId} entry={entry} onRepeat={repeat} />
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </PageShell>
  );
}
function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="text-xs font-semibold">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-2 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
function Highlight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
function Attempt({
  entry,
  onRepeat,
}: {
  entry: HistoryEntry;
  onRepeat: (runId: string) => Promise<void>;
}) {
  return (
    <article className="rounded-md border bg-card p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <p className="text-xs text-muted-foreground">
            {new Date(entry.completedAt).toLocaleString("pt-BR")} · Seed {entry.seed}
          </p>
          <h3 className="mt-1 font-semibold">
            {entry.legacy ? "Cenário legado" : `Alumínio ${entry.material}`} ·{" "}
            {entry.finalSupplierName}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {entry.initialSupplierName} → {entry.finalSupplierName} ·{" "}
            {entry.supplierSwitched ? "Com troca" : "Sem troca"} ·{" "}
            {rotuloDificuldade[entry.difficulty]} · {rotuloModo[entry.mode]} ·{" "}
            {rotuloResultado[entry.outcome]}
          </p>
        </div>
        <p className="font-display text-3xl font-bold text-primary">
          {entry.score}
          <span className="text-sm text-muted-foreground">/100</span>
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {entry.competencies.map((score) => (
          <span key={score.id} className="rounded-full bg-muted px-2.5 py-1 text-xs">
            {score.label}: {score.score}/{score.maximum}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {entry.runId.startsWith("demo-history-") ? (
          <span className="text-xs text-muted-foreground">Relatório demonstrativo</span>
        ) : (
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/diagnostico/$runId" params={{ runId: entry.runId }}>
                Ver relatório
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void onRepeat(entry.runId)}
            >
              <RotateCcw />
              Repetir cenário
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
