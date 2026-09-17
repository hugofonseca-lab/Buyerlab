import { Award, Clock3, Leaf, ShieldCheck } from "lucide-react";
import type { ScenarioInstance, SupplierCandidate } from "@/domain/lovable-ui";
import { brl, moeda, rotuloRisco } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SupplierComparison({
  scenario,
  compact = false,
}: {
  scenario: ScenarioInstance;
  compact?: boolean;
}) {
  return (
    <section aria-labelledby="suppliers-title">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">
          Alternativas reais
        </p>
        <h2 id="suppliers-title" className="mt-1 text-xl font-bold">
          Comparar fornecedores
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Preço é um critério entre vários. Compare custo total, prazo, qualidade e risco antes de
          decidir.
        </p>
      </div>
      <div className={cn("grid gap-4", !compact && "lg:grid-cols-3")}>
        {scenario.supplierCandidates.map((supplier) => (
          <SupplierCard
            key={supplier.id}
            supplier={supplier}
            active={supplier.id === scenario.activeSupplierId}
            compact={compact}
          />
        ))}
      </div>
      {!compact && (
        <div className="mt-5 rounded-md border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold">Resumo de trade-offs</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <Trade
              label="Melhor preço"
              name={nameFor(scenario, scenario.comparison.bestPriceSupplierId)}
            />
            <Trade
              label="Menor risco"
              name={nameFor(scenario, scenario.comparison.lowestRiskSupplierId)}
            />
            <Trade
              label="Menor prazo"
              name={nameFor(scenario, scenario.comparison.shortestLeadTimeSupplierId)}
            />
            <Trade
              label="Melhor qualidade"
              name={nameFor(scenario, scenario.comparison.bestQualitySupplierId)}
            />
            <Trade
              label="Melhor custo total"
              name={nameFor(scenario, scenario.comparison.bestTotalCostSupplierId)}
            />
          </dl>
        </div>
      )}
    </section>
  );
}
function nameFor(scenario: ScenarioInstance, id: string) {
  return scenario.supplierCandidates.find((item) => item.id === id)?.name ?? "—";
}
function kind(kind: SupplierCandidate["kind"]) {
  return {
    incumbente_nacional: "Incumbente nacional",
    importador: "Importador internacional",
    alternativo_nacional: "Alternativo nacional",
  }[kind];
}
function SupplierCard({
  supplier,
  active,
  compact,
}: {
  supplier: SupplierCandidate;
  active: boolean;
  compact: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-md border bg-card p-4",
        active && "border-accent ring-1 ring-accent/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{kind(supplier.kind)}</p>
          <h3 className="mt-1 font-semibold">{supplier.name}</h3>
        </div>
        {active && (
          <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
            Ativo
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-2xl font-bold">
        {moeda(supplier.quoteUnitPrice, supplier.currency)}
        <span className="text-xs font-normal text-muted-foreground"> / t</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Custo total estimado {brl(supplier.estimatedTotalCost)}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Item label="Lead time" value={`${supplier.leadTimeDays} dias`} />
        <Item label="Pagamento" value={`${supplier.paymentDays} dias`} />
        <Item label="MOQ" value={`${supplier.moqTons} t`} />
        <Item label="Confiabilidade" value={`${supplier.reliability}%`} />
        <Item
          label="Risco logístico"
          value={rotuloRisco[supplier.logisticsRisk] ?? supplier.logisticsRisk}
        />
        <Item label="Qualificação" value={`${supplier.qualificationDays} dias`} />
      </dl>
      {!compact && (
        <>
          <div className="mt-4 space-y-2 border-t pt-4 text-xs leading-5">
            <p className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <span>
                <strong>Qualidade:</strong> {supplier.quality}
              </span>
            </p>
            <p className="flex gap-2">
              <Award className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>
                <strong>Certificação:</strong> {supplier.certification}
              </span>
            </p>
            <p className="flex gap-2">
              <Leaf className="mt-0.5 size-4 shrink-0 text-success" />
              <span>
                <strong>ESG:</strong> {supplier.esgImpact}
              </span>
            </p>
            <p className="flex gap-2">
              <Clock3 className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>
                <strong>Custo de troca:</strong> {brl(supplier.switchingCost)} +{" "}
                {supplier.qualificationDays} dias
              </span>
            </p>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">{supplier.publicHistory}</p>
        </>
      )}
    </article>
  );
}
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
function Trade({ label, name }: { label: string; name: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{name}</dd>
    </div>
  );
}
