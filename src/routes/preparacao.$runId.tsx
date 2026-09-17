import { LegacyPreparationPage } from "@/components/buyerlab/legacy/preparacao";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ClipboardList,
  FileText,
  Scale,
  Target,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ContractCard } from "@/components/buyerlab/contract-card";
import { MarketContextCard } from "@/components/buyerlab/market-context-card";
import { MarketIndicatorsPanel } from "@/components/buyerlab/market-indicators-panel";
import { NotesPanel } from "@/components/buyerlab/notes-panel";
import { PageHeader, Stat } from "@/components/buyerlab/page-header";
import { PageShell } from "@/components/buyerlab/site-shell";
import { SupplierComparison } from "@/components/buyerlab/supplier-comparison";
import { RunError, RunLoading } from "@/components/buyerlab/run-states";
import {
  brl,
  dataCurta,
  moeda,
  numero,
  rotuloDificuldade,
  rotuloModo,
  rotuloUrgencia,
} from "@/lib/format";
import { useRun } from "@/simulation/use-lovable-run";

export const Route = createFileRoute("/preparacao/$runId")({
  head: () => ({
    meta: [
      { title: "Preparação da negociação — BuyerLab" },
      {
        name: "description",
        content: "Estude a missão, o mercado e os fornecedores de chapas de alumínio.",
      },
      { property: "og:title", content: "Preparação industrial — BuyerLab" },
      {
        property: "og:description",
        content: "Prepare uma negociação paramétrica de chapas de alumínio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PreparationPage,
});
type Tab = "missao" | "mercado" | "fornecedores" | "contrato" | "riscos" | "notas";
const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "missao", label: "Resumo da missão", icon: <Target /> },
  { id: "mercado", label: "Contexto de mercado", icon: <Scale /> },
  { id: "fornecedores", label: "Fornecedores", icon: <Building2 /> },
  { id: "contrato", label: "Contrato atual", icon: <FileText /> },
  { id: "riscos", label: "Qualidade e riscos", icon: <AlertTriangle /> },
  { id: "notas", label: "Anotações", icon: <ClipboardList /> },
];
function PreparationPage() {
  const { runId } = Route.useParams();
  const { snapshot, loading, error, refresh, simulation } = useRun(runId);
  const [tab, setTab] = useState<Tab>("missao");
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
  const scenario = snapshot.scenario;
  if (!scenario) return <LegacyPreparationPage runId={runId} />;
  return (
    <PageShell>
      <PageHeader
        eyebrow={`${rotuloModo[snapshot.run.modo]} · ${rotuloDificuldade[snapshot.run.dificuldade]} · Seed ${snapshot.run.seed}`}
        title="Prepare sua estratégia"
        description={`Você representa ${scenario.buyerName} na aquisição industrial de ${scenario.material.name}. Use apenas os dados públicos deste dossiê.`}
        actions={
          <Button asChild>
            <Link to="/negociacao/$runId" params={{ runId }}>
              Entrar na sala <ArrowRight />
            </Link>
          </Button>
        }
      />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <MarketIndicatorsPanel />
        </div>
        <div className="mb-8 grid gap-4 border-b pb-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Material" value={scenario.material.code} tone="accent" />
          <Stat label="Quantidade" value={`${numero(scenario.purchaseQuantity)} t`} />
          <Stat
            label="Estoque disponível"
            value={`${scenario.inventoryCoverageDays} dias`}
            tone="warning"
          />
          <Stat
            label="Impacto da interrupção"
            value={`${brl(scenario.interruptionImpactPerDay)}/dia`}
            tone="warning"
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
            {tab === "missao" && (
              <Brief title="Resumo da missão" intro={scenario.buyerObjective}>
                <DataGrid
                  items={[
                    ["Material", `${scenario.material.name} · ${scenario.materialSpecification}`],
                    ["Aplicação final", scenario.application],
                    ["Quantidade", `${numero(scenario.purchaseQuantity)} ${scenario.unit}`],
                    ["Consumo mensal", `${numero(scenario.monthlyDemand)} ${scenario.unit}`],
                    ["Prazo necessário", dataCurta(scenario.requiredDeliveryDate)],
                    ["Urgência", rotuloUrgencia[scenario.urgency] ?? scenario.urgency],
                    [
                      "Orçamento máximo",
                      `${moeda(scenario.buyerMaximumPrice, scenario.currency)}/t`,
                    ],
                    [
                      "Referência de mercado",
                      `${moeda(scenario.marketReferencePrice, scenario.currency)}/t`,
                    ],
                  ]}
                />
                <h3 className="mt-7 font-semibold">Impacto de uma interrupção</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {scenario.continuityRisk} {scenario.delayConsequence}
                </p>
              </Brief>
            )}
            {tab === "mercado" && <MarketContextCard market={scenario.marketSnapshot} />}{" "}
            {tab === "fornecedores" && <SupplierComparison scenario={scenario} />}{" "}
            {tab === "contrato" && <ContractCard contract={scenario.currentContract} />}{" "}
            {tab === "riscos" && (
              <Brief
                title="Qualidade, certificação e risco"
                intro="Critérios técnicos essenciais, apresentados sem expor informações internas dos fornecedores."
              >
                <h3 className="mt-6 font-semibold">Exigências de qualidade</h3>
                <TextList items={scenario.qualityRequirements} />
                {scenario.certificationRequired && (
                  <p className="mt-4 rounded-md border-l-4 border-accent bg-accent/5 p-4 text-sm">
                    <strong>Certificação:</strong> {scenario.certificationRequired}
                  </p>
                )}
                <h3 className="mt-7 font-semibold">Consequências</h3>
                <TextList
                  items={[
                    scenario.delayConsequence,
                    scenario.nonConformityConsequence,
                    ...scenario.risks,
                  ]}
                />
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
    <ul className="mt-4 grid gap-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
          {item}
        </li>
      ))}
    </ul>
  );
}
function DataGrid({ items }: { items: [string, string][] }) {
  return (
    <dl className="mt-6 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="bg-card p-4">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
