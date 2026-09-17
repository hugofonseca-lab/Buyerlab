import { useState } from "react";
import type { AluminumPublic } from "@/domain/aluminum";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/lib/format";
export function ScenarioDetails({
  data,
  onSwitch,
  closed = false,
}: {
  data: AluminumPublic;
  onSwitch?: (id: string, reason: string) => Promise<void>;
  closed?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const i = data.instance;
  async function change(id: string) {
    if (!onSwitch) return;
    setBusy(true);
    setError("");
    try {
      await onSwitch(id, reason.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Troca não concluída.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8"
      aria-label="Material, mercado e fornecedores"
    >
      <div className="panel p-5">
        <h2 className="text-xl font-bold">{i.material.name}</h2>
        <p className="mt-2 text-sm">
          {i.purchaseQuantity} t para {i.application} · consumo {i.monthlyDemand} t/mês · estoque{" "}
          {i.inventoryCoverageDays} dias · data necessária {i.requiredDeliveryDate}
        </p>
        <p className="mt-2 text-sm">
          Benchmark didático: {brl(i.marketReferencePrice)}/t · meta {brl(i.buyerTargetPrice)}/t ·
          limite {brl(i.buyerMaximumPrice)}/t
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Exigências do exercício: {i.material.certificationRequirements.join("; ")}.
        </p>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold">
            Mercado congelado · {i.market.referenceDate} · dados fictícios
          </summary>
          <ul className="mt-2 space-y-2">
            {i.market.indicators.map((indicator) => (
              <li key={indicator.code}>
                {indicator.name}: {indicator.value} {indicator.unit}. {indicator.source}. Data:{" "}
                {indicator.date}.
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Fórmula: preço-base × (1 + exposição cambial × variação cambial + exposição à commodity
            × variação da commodity + exposição ao índice × variação do índice) + conversão + frete.
            Referência didática, não previsão de preço.
          </p>
        </details>
      </div>
      {data.activeEstimate && (
        <p className="panel p-4 text-sm" role="status">
          Estimativa do fornecedor ativo com estoque de segurança:{" "}
          {brl(data.activeEstimate.totalCost)}. Chegada estimada em {data.activeEstimate.arrival}{" "}
          dias; exposição à parada de {data.activeEstimate.delayDays} dias. Inclui material, troca,
          provisão cambial, estoque e eventual parada. A proposta final será validada pelo servidor.
        </p>
      )}
      <h2 className="text-xl font-bold">Compare os fornecedores</h2>
      <p className="text-sm text-muted-foreground">
        Preços em BRL/t, inclusive o candidato com componente USD. TCO estimado inclui material,
        custo de troca e provisão cambial; o relatório acrescenta estoque e eventual parada. Uma
        troca por execução.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {data.suppliers.map((s) => (
          <article className="panel min-w-0 p-5" key={s.id}>
            <h3 className="font-semibold">{s.displayName}</h3>
            <p className="text-xs text-muted-foreground">
              {s.supplierType} · {s.country} · componente {s.currency}
            </p>
            <p className="mt-3 text-xl font-bold">{brl(s.initialUnitPrice)}/t</p>
            <dl className="mt-3 space-y-1 text-sm">
              <div>
                <dt className="inline font-semibold">TCO inicial: </dt>
                <dd className="inline">{brl(s.estimatedTotalCost)}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Entrega / pagamento: </dt>
                <dd className="inline">
                  {s.leadTimeDays} / {s.paymentDays} dias
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">MOQ / capacidade: </dt>
                <dd className="inline">
                  {s.minimumOrderQuantity} / {s.capacityAvailable} t
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">Certificação: </dt>
                <dd className="inline">
                  {s.certificationStatus}; homologação {s.qualificationDays} dias
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">OTIF / rejeição: </dt>
                <dd className="inline">
                  {s.deliveryReliability}% / {s.rejectionRate}%
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">Troca: </dt>
                <dd className="inline">
                  {brl(s.switchingCost)} · exposição cambial {Math.round(s.fxRisk * 100)}%
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{s.esgAttributes.join("; ")}</p>
            {s.id === data.activeSupplierId ? (
              <p className="mt-3 font-semibold text-accent">Fornecedor ativo</p>
            ) : (
              onSwitch && (
                <Button
                  className="mt-3 w-full"
                  variant="outline"
                  disabled={busy || closed || data.switchCount >= 1 || reason.trim().length < 12}
                  onClick={() => void change(s.id)}
                >
                  Trocar para {s.displayName}
                </Button>
              )
            )}
          </article>
        ))}
      </div>
      {onSwitch && data.switchCount === 0 && !closed && (
        <div className="panel p-5">
          <Label htmlFor="switch-reason">Justificativa da troca (mínimo 12 caracteres)</Label>
          <Textarea
            id="switch-reason"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Ao confirmar no cartão, serão aplicados o custo e o prazo de homologação indicados. O
            fornecedor terá uma nova relação de confiança. Estoque de segurança negociado cobre até
            três dias adicionais e custa 1% do material.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {data.switches.map((s) => (
        <p key={s.id} className="panel p-4 text-sm">
          Troca registrada no turno {s.turnIndex}: {s.reason}. Custo {brl(s.financialImpact)};
          homologação {s.timePenaltyDays} dias.
        </p>
      ))}
    </section>
  );
}
