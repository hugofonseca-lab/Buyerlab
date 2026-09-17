import { AlertTriangle, Banknote, Factory, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { IndicatorHistory } from "@/domain/market-indicators";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useMarketIndicators } from "@/simulation/use-market-indicators";

const mesAno = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

const chartConfig: ChartConfig = {
  historico: { label: "Histórico", color: "var(--color-accent)" },
  projecao: { label: "Projeção", color: "var(--color-warning)" },
};

function chartData(history: IndicatorHistory) {
  const points = history.points.slice(-12);
  return [
    ...points.map((p, index) => ({
      label: mesAno(p.date),
      historico: p.value,
      // The last historical point is repeated as the projection's starting value, so the
      // dashed line visually connects to where the solid line ends.
      projecao: index === points.length - 1 ? p.value : null,
    })),
    ...history.projection.map((p) => ({
      label: mesAno(p.date),
      historico: null,
      projecao: p.value,
    })),
  ];
}

function IndicatorChart({ history }: { history: IndicatorHistory }) {
  if (history.points.length < 2)
    return (
      <p className="text-xs text-muted-foreground">
        Histórico insuficiente para projetar tendência.
      </p>
    );
  const data = chartData(history);
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[140px] w-full">
      <LineChart data={data} margin={{ left: 4, right: 4, top: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} minTickGap={20} />
        <YAxis hide domain={["auto", "auto"]} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Line
          dataKey="historico"
          type="monotone"
          stroke="var(--color-historico)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Line
          dataKey="projecao"
          type="monotone"
          stroke="var(--color-projecao)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}

export function MarketIndicatorsPanel() {
  const { data, loading, error } = useMarketIndicators();
  return (
    <section className="rounded-md border bg-card p-5" aria-labelledby="indicators-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Indicadores de mercado
          </p>
          <h2 id="indicators-title" className="mt-1 text-xl font-bold">
            Mercado ao vivo
          </h2>
        </div>
        <TrendingUp className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      {loading && !data && (
        <p className="mt-4 text-sm text-muted-foreground">Carregando indicadores…</p>
      )}
      {error && !data && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric
              icon={<Banknote />}
              label="Câmbio USD/BRL (PTAX)"
              value={`Compra ${data.ptax.buy.toLocaleString("pt-BR", { minimumFractionDigits: 4 })} · Venda ${data.ptax.sell.toLocaleString("pt-BR", { minimumFractionDigits: 4 })}`}
              indicator={data.ptax}
            />
            <Metric
              icon={<Banknote />}
              label="Alumínio primário (FMI)"
              value={`US$ ${data.aluminum.value.toLocaleString("pt-BR")}/t`}
              indicator={data.aluminum}
            />
            <Metric
              icon={<Factory />}
              label="Produção industrial (PIM-PF Brasil)"
              value={data.industrial.value.toLocaleString("pt-BR")}
              indicator={data.industrial}
            />
          </dl>
          {data.warnings.length > 0 && (
            <div
              className="mt-3 flex gap-2 rounded-md border-l-4 border-warning bg-warning/5 p-3 text-xs text-muted-foreground"
              role="status"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="font-semibold text-foreground">
                  Um ou mais indicadores estão com dado desatualizado.
                </p>
                <ul className="mt-1 list-disc pl-4">
                  {data.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <h3 className="mt-6 text-sm font-semibold">Projeção para o próximo trimestre</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Estimativa baseada em tendência histórica (regressão linear sobre os últimos 12 meses),
            não é uma previsão oficial de mercado.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {data.history.map((h) => (
              <div key={h.code}>
                <p className="text-xs font-medium text-muted-foreground">{h.name}</p>
                <IndicatorChart history={h} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
function Metric({
  icon,
  label,
  value,
  indicator,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  indicator: {
    status: "real" | "simulado";
    stale: boolean;
    date: string;
    source: string;
    url: string | null;
  };
}) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="[&>svg]:size-3.5">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 font-display text-lg font-bold">{value}</dd>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {indicator.stale
          ? "Dado desatualizado"
          : indicator.status === "real"
            ? "Dado real"
            : "Simulado"}
        {" · "}
        {new Date(`${indicator.date}T12:00:00`).toLocaleDateString("pt-BR")}
        {" · "}
        {indicator.url ? (
          <a className="underline" href={indicator.url} target="_blank" rel="noreferrer">
            {indicator.source}
          </a>
        ) : (
          indicator.source
        )}
      </p>
    </div>
  );
}
