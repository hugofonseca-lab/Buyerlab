import { createFileRoute } from "@tanstack/react-router";
import { SourcingReport } from "@/components/buyerlab/sourcing-report";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/buyerlab/site-shell";
import { RunError, RunLoading } from "@/components/buyerlab/run-states";
import { Button } from "@/components/ui/button";
import type { EvaluationReport } from "@/domain/types";
import { AVISO_EDUCACIONAL } from "@/domain/scenario";
import { brl, rotuloResultado } from "@/lib/format";

export const Route = createFileRoute("/relatorio")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Relatório compartilhado — BuyerLab" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: SharedReport,
});
function SharedReport() {
  const { token } = Route.useSearch();
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/reports/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Link inválido ou expirado.");
        setReport((await r.json()) as EvaluationReport);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Falha ao carregar relatório.");
      });
    return () => controller.abort();
  }, [token]);
  if (error)
    return (
      <PageShell>
        <RunError message={error} />
      </PageShell>
    );
  if (!report)
    return (
      <PageShell>
        <RunLoading />
      </PageShell>
    );
  return (
    <PageShell>
      <article className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <header>
          <p className="text-sm text-muted-foreground">
            Relatório compartilhado · Seed {report.seed}
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {rotuloResultado[report.resultado]} · {report.notaTotal}/100
          </h1>
          <p className="mt-3">{report.razaoResultado}</p>
          <p className="mt-2 text-sm">
            {report.avaliacaoProvisoria
              ? "Avaliação qualitativa provisória (mock/fallback)."
              : "Avaliação qualitativa por IA validada."}
          </p>
          <Button className="no-print mt-4" onClick={() => window.print()}>
            Imprimir / salvar
          </Button>
        </header>
        {report.sourcing && <SourcingReport result={report.sourcing} />}
        <section className="panel p-5">
          <h2 className="text-xl font-bold">Resultado econômico</h2>
          <p>
            Alcançado: {report.precoFechado === null ? "Sem acordo" : brl(report.precoFechado)} ·
            Melhor resultado viável: {brl(report.melhorResultadoViavel.preco)} ·{" "}
            {report.sourcing ? "Diferença de TCO / compra" : "Perda mensal"}:{" "}
            {brl(report.perdaDeOportunidadeMensal)}
          </p>
          <p className="mt-2 text-xs">
            Fronteira comercial condicionada a contrapartidas excepcionais.{" "}
            {report.sourcing
              ? "O TCO considera o pacote proposto e seus riscos, mesmo quando não há acordo válido."
              : "Sem acordo, a referência é a proposta inicial."}
          </p>
        </section>
        <section className="panel space-y-5 p-5">
          <h2 className="text-xl font-bold">Competências e evidências</h2>
          {[...report.determinantes, ...report.qualitativas].map((c) => (
            <div key={c.id}>
              <h3 className="font-semibold">
                {c.rotulo}: {c.pontos}/{c.maximo}
              </h3>
              <p className="text-sm">{c.comentario}</p>
              {c.evidencias.map((e) => (
                <blockquote key={`${e.turno}-${e.trecho}`} className="mt-2 border-l-2 pl-3 text-sm">
                  Turno {e.turno}: “{e.trecho}”<p>{e.interpretacao}</p>
                </blockquote>
              ))}
            </div>
          ))}
        </section>
        {[
          ["Forças", report.fortes],
          ["Prioridades", report.oportunidades],
          ["Erros críticos", report.errosCriticos],
        ].map(([title, items]) => (
          <section className="panel p-5" key={title as string}>
            <h2 className="text-xl font-bold">{title}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {(items as string[]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        <section className="panel p-5">
          <h2 className="text-xl font-bold">Próxima ação</h2>
          <p>{report.recomendacao}</p>
        </section>
        <footer className="text-xs text-muted-foreground">
          Cenário {report.cenarioVersao} · Engine {report.engineVersao}. {AVISO_EDUCACIONAL}
        </footer>
      </article>
    </PageShell>
  );
}
