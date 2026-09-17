import { CalendarDays, CircleDollarSign, Factory, Info } from "lucide-react";
import type { MarketSnapshot } from "@/domain/lovable-ui";
import { dataCurta, moeda, numero } from "@/lib/format";

export function MarketContextCard({
  market,
  compact = false,
}: {
  market: MarketSnapshot;
  compact?: boolean;
}) {
  return (
    <section className="rounded-md border bg-card p-5" aria-labelledby="market-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Snapshot econômico
          </p>
          <h2 id="market-title" className="mt-1 text-xl font-bold">
            Contexto de mercado
          </h2>
        </div>
        <CalendarDays className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-2 text-xs font-semibold text-warning">
        Dados de referência congelados para esta simulação.
      </p>
      <dl className={`mt-5 grid gap-3 ${compact ? "grid-cols-2" : "sm:grid-cols-3"}`}>
        <Metric
          icon={<CircleDollarSign />}
          label={
            market.indicators?.find((i) => i.code === "USD_BRL")?.status === "real"
              ? "PTAX venda"
              : "Dólar simulado"
          }
          value={moeda(market.ptax, "BRL")}
        />
        <Metric
          icon={<CircleDollarSign />}
          label="Benchmark alumínio"
          value={`${moeda(market.aluminumBenchmarkUsdTon, "USD")}/t`}
        />
        <Metric
          icon={<Factory />}
          label={market.industrialIndexLabel}
          value={numero(market.industrialIndex)}
        />
      </dl>
      <div className="mt-3 space-y-2 text-xs text-muted-foreground" aria-live="polite">
        {market.indicators?.map((i) => (
          <p key={i.code}>
            {i.code === "USD_BRL"
              ? "Dólar"
              : i.code === "ALUMINUM"
                ? "Alumínio"
                : "Índice industrial"}
            : {i.status === "real" ? "Dado real publicado" : "SIMULADO"} · {dataCurta(i.date)} ·{" "}
            {i.url ? (
              <a className="underline" href={i.url} target="_blank" rel="noreferrer">
                {i.source}
              </a>
            ) : (
              i.source
            )}
          </p>
        ))}
        {market.fallbackUsed && (
          <p role="status">
            Uma fonte falhou, está desatualizada ou fora da faixa suportada. Foi preservada a última
            referência disponível ou um valor identificado como simulado.
          </p>
        )}
      </div>
      {!compact && (
        <>
          <p className="mt-5 text-sm leading-6">{market.explanation}</p>
          <div className="mt-4 flex gap-2 border-t pt-4 text-xs leading-5 text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>{market.disclaimer}</p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Referência: {dataCurta(market.referenceDate)} · Fonte: {market.source}
          </p>
        </>
      )}
    </section>
  );
}
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="[&>svg]:size-3.5">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 font-display text-lg font-bold">{value}</dd>
    </div>
  );
}
