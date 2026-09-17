import { FileText, ShieldAlert } from "lucide-react";
import type { SupplierContract } from "@/domain/lovable-ui";
import { dataCurta, moeda } from "@/lib/format";

export function ContractCard({ contract }: { contract: SupplierContract }) {
  return (
    <section className="panel p-5 sm:p-8" aria-labelledby="contract-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Dado fictício para o exercício
          </p>
          <h2 id="contract-title" className="mt-1 text-2xl font-bold">
            Contrato atual com o fornecedor
          </h2>
        </div>
        <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        Condições hipotéticas já vigentes com {contract.supplierName}, para referência ao avaliar
        continuidade ou troca. Não representa uma integração real com o fornecedor.
      </p>
      <dl className="mt-6 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2">
        <Field label="Fornecedor" value={contract.supplierName} />
        <Field label="Categoria de compra" value={contract.purchaseCategory} />
        <Field
          label="Valor total do contrato"
          value={moeda(contract.totalValue, contract.currency)}
        />
        <Field
          label="Vigência"
          value={`${dataCurta(contract.startDate)} a ${dataCurta(contract.endDate)}`}
        />
        <Field label="Condição de reajuste" value={contract.indexClause} />
        <Field label="SLA de entrega" value={contract.slaDescription} />
      </dl>
      <h3 className="mt-7 font-semibold">Histórico de desempenho ({contract.performancePeriod})</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-muted/50 p-3">
          <dt className="text-xs text-muted-foreground">Pontualidade (OTIF)</dt>
          <dd className="mt-1 font-display text-lg font-bold">{contract.onTimeDeliveryScore}%</dd>
        </div>
        <div className="rounded-md bg-muted/50 p-3">
          <dt className="text-xs text-muted-foreground">Qualidade</dt>
          <dd className="mt-1 font-display text-lg font-bold">{contract.qualityScore}%</dd>
        </div>
      </dl>
      <div className="mt-5 flex gap-2 border-t pt-4 text-xs leading-5 text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          <strong>Rescisão/multa:</strong> {contract.terminationClause}
        </p>
      </div>
    </section>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
