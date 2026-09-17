import type { SourcingResult } from "@/domain/aluminum";
import { brl } from "@/lib/format";
export function SourcingReport({ result }: { result: SourcingResult }) {
  return (
    <section className="panel my-6 space-y-2 p-5" data-print-block>
      <h2 className="text-xl font-bold">Decisão de sourcing</h2>
      <p className="text-sm">Fornecedor final: {result.finalSupplier}</p>
      <p className="text-sm">
        TCO da proposta: {brl(result.totalCost)} · melhor TCO viável:{" "}
        {brl(result.bestFeasibleTotalCost)} · troca: {brl(result.switchingCost)}
      </p>
      <p className="text-sm">
        Atraso sem cobertura: {result.delayDays} dias · exposição cambial:{" "}
        {Math.round(result.fxExposure * 100)}%
      </p>
      <p className="text-sm">{result.switchAssessment}</p>
      <p className="text-xs text-muted-foreground">
        Componente objetivo: {result.supplierDecisionScore}/60, já incluído na nota total.{" "}
        {result.costBasis}
      </p>
    </section>
  );
}
