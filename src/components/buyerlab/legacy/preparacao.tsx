import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ClipboardList,
  FileText,
  History,
  ShieldAlert,
  Target,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader, Stat } from "@/components/buyerlab/page-header";
import { PageShell } from "@/components/buyerlab/site-shell";
import { NotesPanel } from "@/components/buyerlab/notes-panel";
import { RunError, RunLoading } from "@/components/buyerlab/run-states";
import { ScenarioDetails } from "@/components/buyerlab/scenario-details";
import { orionNexa as legacyScenario } from "@/domain/scenario";
import { brl, numero, rotuloDificuldade, rotuloModo } from "@/lib/format";
import { useRun } from "@/simulation/use-run";
import { cn } from "@/lib/utils";

type Tab = "contexto" | "mandato" | "contrato" | "desempenho" | "riscos" | "notas";
const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "contexto", label: "Contexto", icon: <Building2 /> },
  { id: "mandato", label: "Seu mandato", icon: <Target /> },
  { id: "contrato", label: "Contrato e mercado", icon: <FileText /> },
  { id: "desempenho", label: "Histórico e desempenho", icon: <Truck /> },
  { id: "riscos", label: "Riscos e alternativas", icon: <ShieldAlert /> },
  { id: "notas", label: "Anotações", icon: <ClipboardList /> },
];

export function LegacyPreparationPage({ runId }: { runId: string }) {
  const { snapshot, loading, error, refresh, simulation } = useRun(runId);
  const [tab, setTab] = useState<Tab>("contexto");
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
  const run = snapshot.run;
  const orionNexa = snapshot.aluminum?.blueprint ?? legacyScenario;
  const mandate = orionNexa.mandato;
  return (
    <PageShell>
      {snapshot.aluminum && <ScenarioDetails data={snapshot.aluminum} />}
      <PageHeader
        eyebrow={`${rotuloModo[run.modo]} · ${rotuloDificuldade[run.dificuldade]} · Seed ${run.seed}`}
        title="Prepare sua estratégia"
        description={`Você representa a Orion Equipamentos. Leia o dossiê antes de conversar com ${orionNexa.brief.fornecedor}.`}
        actions={
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/negociacao/$runId" params={{ runId }}>
              Entrar na sala <ArrowRight />
            </Link>
          </Button>
        }
      />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-4 border-b pb-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Limite autorizado" value={brl(mandate.limitePrecoEfetivo)} tone="accent" />
          <Stat label="Estoque disponível" value={`${mandate.diasEstoque} dias`} tone="warning" />
          <Stat
            label="Impacto da parada"
            value={`${brl(mandate.impactoParadaDia)}/dia`}
            tone="warning"
          />
          <Stat
            label="Demanda mensal"
            value={`${numero(mandate.demandaMensal)} ${snapshot.aluminum ? "t" : "un."}`}
          />
        </div>
        <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
          <nav
            className="flex gap-2 overflow-x-auto pb-2 lg:flex-col"
            aria-label="Seções do dossiê"
          >
            {tabs.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={tab === item.id ? "secondary" : "ghost"}
                className="h-11 shrink-0 justify-start"
                onClick={() => setTab(item.id)}
              >
                {item.icon}
                {item.label}
              </Button>
            ))}
          </nav>
          <div>
            {tab === "contexto" && (
              <Brief
                title="Contexto da empresa"
                intro="A renovação envolve custo, continuidade e a recuperação de uma relação desgastada."
              >
                <TextList items={orionNexa.brief.contexto} />
                <h3 className="mt-8 flex items-center gap-2 font-semibold">
                  <History className="size-4 text-accent" />
                  Histórico do relacionamento
                </h3>
                <TextList items={orionNexa.brief.historico} />
              </Brief>
            )}
            {tab === "mandato" && (
              <Brief title="Seu mandato" intro={mandate.objetivo}>
                <div className="mt-6 rounded-md border-l-4 border-accent bg-accent/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                    Não ultrapasse
                  </p>
                  <p className="mt-1 font-display text-3xl font-bold">
                    {brl(mandate.limitePrecoEfetivo)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {snapshot.aluminum ? "por tonelada" : "por unidade"}
                    </span>
                  </p>
                </div>
                <h3 className="mt-8 font-semibold">Prioridades autorizadas</h3>
                <TextList items={mandate.prioridades} />
              </Brief>
            )}
            {tab === "contrato" && (
              <Brief
                title="Contrato e dados de mercado"
                intro="Use estes fatos para formular perguntas, referências e propostas."
              >
                <DataGrid items={[...orionNexa.brief.contrato, ...orionNexa.brief.mercado]} />
              </Brief>
            )}
            {tab === "desempenho" && (
              <Brief
                title="Entrega e qualidade"
                intro="Há problemas reais de desempenho, mas também falhas de planejamento da compradora."
              >
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {orionNexa.brief.desempenho.map((item) => (
                    <div
                      key={item.rotulo}
                      className={cn(
                        "rounded-md border p-4",
                        item.status === "abaixo" && "border-warning/50 bg-warning/5",
                      )}
                    >
                      <p className="text-xs text-muted-foreground">{item.rotulo}</p>
                      <p className="mt-1 font-display text-2xl font-bold">{item.valor}</p>
                      <p className="mt-1 text-xs">
                        Meta: {item.meta}
                        {item.status === "abaixo" && (
                          <span className="ml-2 font-semibold text-warning-text">Abaixo</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
                <h3 className="mt-8 font-semibold">Responsabilidade compartilhada</h3>
                <TextList items={orionNexa.brief.historico.slice(1)} />
              </Brief>
            )}
            {tab === "riscos" && (
              <Brief
                title="Riscos e alternativas"
                intro="Sua melhor alternativa ainda não protege totalmente a operação."
              >
                <div className="mt-6 flex gap-3 rounded-md border border-warning/40 bg-warning/5 p-4">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-text" />
                  <p className="text-sm leading-6">
                    Ameaçar uma troca imediata de fornecedor não é crível: a qualificação leva 45
                    dias e a cobertura inicial seria de apenas 30%.
                  </p>
                </div>
                <TextList items={orionNexa.brief.riscos} />
              </Brief>
            )}
            {tab === "notas" && (
              <NotesPanel
                initial={snapshot.anotacoes}
                onSave={(value) => simulation.updateNotes(runId, value)}
              />
            )}
          </div>
        </div>
        <div className="mt-10 flex justify-end border-t pt-6">
          <Button asChild size="lg">
            <Link to="/negociacao/$runId" params={{ runId }}>
              Entrar na sala de negociação <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}

function Brief({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <article className="panel p-5 sm:p-8">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{intro}</p>
      {children}
    </article>
  );
}
function TextList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 grid gap-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
          {item}
        </li>
      ))}
    </ul>
  );
}
function DataGrid({ items }: { items: { rotulo: string; valor: string }[] }) {
  return (
    <dl className="mt-6 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.rotulo} className="bg-card p-4">
          <dt className="text-xs text-muted-foreground">{item.rotulo}</dt>
          <dd className="mt-1 font-semibold">{item.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
