import { LegacyDiagnosticPage } from "@/components/buyerlab/legacy/diagnostico";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Dices,
  Lightbulb,
  Printer,
  Repeat2,
  Target,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/buyerlab/site-shell";
import { RunError, RunLoading } from "@/components/buyerlab/run-states";
import { AVISO_EDUCACIONAL } from "@/domain/scenario";
import type { CompetencyScore, EvaluationReport } from "@/domain/types";
import { brl, dataCurta, moeda, rotuloResultado } from "@/lib/format";
import { useRun } from "@/simulation/use-lovable-run";

export const Route = createFileRoute("/diagnostico/$runId")({
  head: () => ({
    meta: [
      { title: "Diagnóstico de desempenho — BuyerLab" },
      {
        name: "description",
        content:
          "Veja nota, evidências, momentos decisivos e recomendações da sua negociação BuyerLab.",
      },
      { property: "og:title", content: "Diagnóstico de desempenho — BuyerLab" },
      {
        property: "og:description",
        content: "Feedback objetivo e fundamentado em evidências da negociação simulada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiagnosticPage,
});

function DiagnosticPage() {
  const { runId } = Route.useParams();
  const navigate = useNavigate();
  const { snapshot, loading, error, refresh, simulation } = useRun(runId);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  if (loading)
    return (
      <PageShell>
        <RunLoading />
      </PageShell>
    );
  if (error || !snapshot)
    return (
      <PageShell>
        <RunError message={error ?? "Execução não encontrada."} retry={() => void refresh()} />
      </PageShell>
    );
  if (!snapshot.aluminum) return <LegacyDiagnosticPage runId={runId} />;
  const report = snapshot.relatorio;
  if (!report)
    return (
      <PageShell>
        <RunError message="Esta simulação ainda não possui um diagnóstico. Finalize uma proposta para gerar o relatório." />
      </PageShell>
    );
  const scenario = report.scenario ?? snapshot.scenario;
  const initialSupplier = scenario?.supplierCandidates.find(
    (item) => item.id === report.initialSupplierId,
  );
  const finalSupplier = scenario?.supplierCandidates.find(
    (item) => item.id === report.finalSupplierId,
  );

  async function restart(same: boolean) {
    setBusy(true);
    setActionError(null);
    try {
      const run = await simulation.restartRun(runId, same);
      await navigate({ to: "/preparacao/$runId", params: { runId: run.id } });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Não foi possível repetir.");
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    setActionError(null);
    try {
      const url = await simulation.shareReport(runId);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setActionError("Não foi possível compartilhar. Tente novamente.");
    }
  }

  return (
    <PageShell>
      <article className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="grid gap-7 border-b pb-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Score score={report.notaTotal} />
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              Diagnóstico · Seed {report.seed}
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              {rotuloResultado[report.resultado] ?? "Resultado da simulação"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {report.avaliacaoProvisoria
                ? "Avaliação provisória por regras. "
                : "Avaliação híbrida com IA. "}
              Este resultado mede esta execução e não define permanentemente sua capacidade
              profissional.
            </p>
            <div className="no-print mt-6 flex flex-wrap gap-2">
              <Button onClick={() => void restart(true)} disabled={busy}>
                <Repeat2 />
                Mesma seed
              </Button>
              <Button variant="outline" onClick={() => void restart(false)} disabled={busy}>
                <Dices />
                Nova variação
              </Button>
              <Button variant="outline" onClick={() => void copy()}>
                <Copy />
                {copied ? "Link copiado" : "Copiar link"}
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer />
                Imprimir / salvar
              </Button>
            </div>
          </div>
        </header>
        {actionError && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {actionError}
          </p>
        )}
        <section
          className="grid gap-px overflow-hidden rounded-md border bg-border my-8 md:grid-cols-4"
          aria-label="Resultado econômico"
        >
          <Metric label="Resultado" value={rotuloResultado[report.resultado] ?? "Resultado"} />
          <Metric
            label="Preço alcançado"
            value={
              report.precoFechado === null
                ? "Sem acordo"
                : moeda(report.precoFechado, finalSupplier?.currency ?? "BRL")
            }
          />
          <Metric
            label="Melhor resultado viável"
            value={moeda(report.melhorResultadoViavel.preco, finalSupplier?.currency ?? "BRL")}
          />
          <Metric
            label="Diferença de TCO / compra"
            value={brl(report.perdaDeOportunidadeMensal)}
            tone="warning"
          />
        </section>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
          <div className="space-y-8">
            {scenario && (
              <Section
                title="Decisão de fornecimento"
                description="Avaliação da permanência ou troca com base em custo total, continuidade, qualidade e risco."
              >
                <dl className="mt-5 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2">
                  <Metric label="Material negociado" value={scenario.material.name} />
                  <Metric
                    label="Fornecedor inicial"
                    value={initialSupplier?.name ?? "Não informado"}
                  />
                  <Metric label="Fornecedor final" value={finalSupplier?.name ?? "Não informado"} />
                  <Metric
                    label="Contexto congelado"
                    value={`${dataCurta(scenario.marketSnapshot.referenceDate)} · PTAX ${scenario.marketSnapshot.ptax.toLocaleString("pt-BR")}`}
                  />
                </dl>
                {report.supplierSwitch && (
                  <div className="mt-5 rounded-md border border-warning/40 bg-warning/5 p-4 text-sm">
                    <p>
                      <strong>Motivo informado:</strong> {report.supplierSwitch.justification}
                    </p>
                    <p className="mt-2">
                      <strong>Impacto da troca:</strong> {brl(report.supplierSwitch.cost)},{" "}
                      {report.supplierSwitch.daysConsumed} dias. {report.supplierSwitch.riskImpact}
                    </p>
                  </div>
                )}
                <p className="mt-5 text-sm leading-6">
                  <strong>Avaliação:</strong> {report.supplierDecisionAssessment}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {report.alternativesComparison}
                </p>
              </Section>
            )}
            <Section
              title="Pontuação por competência"
              description="Os 60 pontos objetivos vêm do pacote final. Os 40 pontos comportamentais exigem evidência na conversa."
            >
              <div className="mt-5 space-y-5">
                {[...report.determinantes, ...report.qualitativas].map((score) => (
                  <Competency key={score.id} score={score} />
                ))}
              </div>
            </Section>
            <Section
              title="Evidências da conversa"
              description="Cada avaliação qualitativa cita uma ação observável. Sem evidência, não há pontuação."
            >
              <div className="mt-5 space-y-4">
                {report.qualitativas.flatMap((item) =>
                  item.evidencias.map((evidence) => (
                    <blockquote
                      key={`${item.id}-${evidence.turno}`}
                      className="border-l-2 border-accent pl-4"
                    >
                      <p className="text-xs font-semibold text-accent">
                        Turno {evidence.turno} · {item.rotulo}
                      </p>
                      <p className="mt-1 text-sm italic">“{evidence.trecho}”</p>
                      <footer className="mt-1 text-xs text-muted-foreground">
                        {evidence.interpretacao}
                      </footer>
                    </blockquote>
                  )),
                )}
                {report.qualitativas.every((item) => item.evidencias.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma ação qualificável foi detectada.
                  </p>
                )}
              </div>
            </Section>
            <Section
              title="Linha do tempo decisiva"
              description="Os movimentos que mais influenciaram o resultado."
            >
              <ol className="mt-5 space-y-4">
                {report.linhaDoTempo.map((item) => (
                  <li
                    key={`${item.turno}-${item.titulo}`}
                    className="grid grid-cols-[40px_1fr] gap-3"
                  >
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
                      {item.turno}
                    </span>
                    <div>
                      <p className="text-sm font-semibold capitalize">{item.titulo}</p>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detalhe}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          </div>
          <aside className="space-y-5">
            <Insight
              icon={<CheckCircle2 />}
              title="3 pontos fortes"
              items={report.fortes}
              tone="success"
            />
            <Insight
              icon={<TrendingUp />}
              title="3 oportunidades"
              items={report.oportunidades}
              tone="accent"
            />
            {report.errosCriticos.length > 0 && (
              <Insight
                icon={<AlertTriangle />}
                title="Erros críticos"
                items={report.errosCriticos}
                tone="warning"
              />
            )}
            <div className="rounded-md bg-primary p-6 text-primary-foreground" data-print-block>
              <Lightbulb className="size-6 text-warning" />
              <h2 className="mt-4 text-lg font-semibold">Próxima tentativa</h2>
              <p className="mt-2 text-sm leading-6 text-primary-foreground/75">
                {report.recomendacao}
              </p>
            </div>
          </aside>
        </div>
        <div className="mt-10 border-t pt-8">
          <p className="max-w-4xl text-xs leading-5 text-muted-foreground">{AVISO_EDUCACIONAL}</p>
          <div className="no-print mt-6 flex flex-wrap gap-2">
            <Button onClick={() => void restart(true)}>
              <Repeat2 />
              Tentar novamente com a mesma seed
            </Button>
            <Button asChild variant="outline">
              <Link to="/configurar">
                Configurar outra simulação <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/historico">Ver histórico</Link>
            </Button>
          </div>
        </div>
      </article>
    </PageShell>
  );
}

function Score({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-5">
      <div className="relative size-40 shrink-0">
        <svg
          className="size-full -rotate-90"
          viewBox="0 0 100 100"
          role="img"
          aria-label={`Nota ${score} de 100`}
        >
          <circle cx="50" cy="50" r="43" fill="none" stroke="var(--color-muted)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="43"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="8"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${score} 100`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-5xl font-bold text-primary">{score}</span>
          <span className="text-xs text-muted-foreground">de 100</span>
        </div>
      </div>
      <div className="sm:hidden">
        <p className="text-sm font-semibold">Sua nota</p>
        <p className="mt-1 text-xs text-muted-foreground">Objetiva e qualitativa</p>
      </div>
    </div>
  );
}
function Metric({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div className="bg-card p-5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          tone === "warning"
            ? "mt-2 font-display text-lg font-bold text-warning"
            : "mt-2 font-display text-lg font-bold"
        }
      >
        {value}
      </dd>
    </div>
  );
}
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-5 sm:p-7" data-print-block>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}
function Competency({ score }: { score: CompetencyScore }) {
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{score.rotulo}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{score.comentario}</p>
        </div>
        <p className="shrink-0 font-mono text-sm font-bold">
          {score.pontos}/{score.maximo}
        </p>
      </div>
      <progress
        className="h-2 w-full overflow-hidden rounded-full accent-accent"
        value={score.pontos}
        max={score.maximo}
      >
        {score.pontos} de {score.maximo}
      </progress>
    </div>
  );
}
function Insight({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: "success" | "accent" | "warning";
}) {
  const toneClasses = {
    success: "border-success/40 bg-success/5 text-success",
    accent: "border-accent/40 bg-accent/5 text-accent",
    warning: "border-warning/40 bg-warning/5 text-warning",
  };
  return (
    <section className={`rounded-md border p-5 ${toneClasses[tone]}`} data-print-block>
      <h2 className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-5 text-foreground">
            <Target className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
