import type { LearningPoint } from "@/domain/lovable-ui";
import { rotuloDificuldade, rotuloResultado } from "@/lib/format";

export function LearningCurve({ points }: { points: LearningPoint[] }) {
  if (!points.length)
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Conclua uma simulação para iniciar sua curva.
      </div>
    );
  const width = 720,
    height = 250,
    pad = 34;
  const x = (index: number) =>
    points.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (points.length - 1);
  const y = (value: number) => height - pad - (value * (height - pad * 2)) / 100;
  const scorePath = points
    .map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.score)}`)
    .join(" ");
  const averagePath = points
    .map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.movingAverage)}`)
    .join(" ");
  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[620px]"
          role="img"
          aria-labelledby="curve-title curve-desc"
        >
          <title id="curve-title">Curva cronológica de aprendizado</title>
          <desc id="curve-desc">Pontuação total e média móvel das últimas três tentativas.</desc>
          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={pad}
                y1={y(tick)}
                x2={width - pad}
                y2={y(tick)}
                stroke="var(--color-border)"
              />
              <text x="2" y={y(tick) + 4} fontSize="10" fill="var(--color-muted-foreground)">
                {tick}
              </text>
            </g>
          ))}
          <path
            d={averagePath}
            fill="none"
            stroke="var(--color-warning)"
            strokeWidth="3"
            strokeDasharray="7 5"
          />
          <path d={scorePath} fill="none" stroke="var(--color-accent)" strokeWidth="4" />
          {points.map((point, index) => (
            <g key={point.runId}>
              <circle cx={x(index)} cy={y(point.score)} r="6" fill="var(--color-accent)">
                <title>{`${new Date(point.completedAt).toLocaleDateString("pt-BR")} · ${point.material} · ${point.finalSupplierName} · ${rotuloDificuldade[point.difficulty]} · ${rotuloResultado[point.outcome]} · ${point.score} pontos`}</title>
              </circle>
              <text
                x={x(index)}
                y={height - 8}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-muted-foreground)"
              >
                {new Date(point.completedAt).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-5 text-xs">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-accent" />
          Pontuação total
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0 w-5 border-t-2 border-dashed border-warning" />
          Média móvel (3)
        </span>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Alternativa textual do gráfico
        </summary>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          {points.map((point) => (
            <li key={point.runId}>
              {new Date(point.completedAt).toLocaleString("pt-BR")}: {point.score} pontos; média
              móvel {point.movingAverage}; {point.material}; {point.finalSupplierName};{" "}
              {rotuloResultado[point.outcome]}.
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
