import { z } from "zod";
import type {
  IndicatorCode,
  IndicatorHistory,
  IndicatorPoint,
  IndicatorValue,
  MarketIndicatorsSnapshot,
  PtaxValue,
  SuppliersValue,
} from "../domain/market-indicators";

/**
 * Painel de indicadores de mercado no topo do dossiê do cenário. Independente do motor de
 * negociação (ver live-market.server.ts / market.server.ts para o benchmark de preço do exercício).
 *
 * Fontes:
 * - PTAX venda/compra: Banco Central (Olinda), CotacaoDolarDia — público, sem chave.
 * - Alumínio: Alpha Vantage `function=ALUMINUM` (mensal, FMI) — exige ALPHA_VANTAGE_API_KEY,
 *   tier gratuito com limite de 25 requisições/dia e 5/min. Uma chamada devolve o valor atual e
 *   o histórico mensal, por isso o cache diário evita estourar o limite.
 * - Índice de produção industrial: IBGE SIDRA, tabela 8888 (PIM-PF, Produção Física Industrial,
 *   base 2022=100), variável 12606 ("Número-índice"), classificação 544/129314 ("1 Indústria
 *   geral"), território N1[1] (Brasil). O IBGE reformulou a PIM-PF em 2021 (base 2022=100); se a
 *   tabela for descontinuada novamente, atualize os IDs aqui e em docs/market-data.md.
 * - Países fornecedores: MDIC Comex Stat (comércio exterior brasileiro), importação por país da
 *   NCM 7606.12.90 (chapas de ligas de alumínio, espessura > 0,2mm) — número de países distintos
 *   que exportaram esse material para o Brasil no mês mais recente. Público, sem chave.
 */

const BCB = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/";
const SIDRA_TABLE = 8888;
const SIDRA_VARIABLE = 12606;
const SIDRA_CLASSIFICATION = "544[129314]";
const SIDRA_LOCALITY = "N1[1]";
const COMEX_STAT_URL = "https://api-comexstat.mdic.gov.br/general";
const COMEX_NCM = "76061290";

const brazilDay = (date: Date) =>
  date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const shiftDate = (isoDate: string, days: number) =>
  new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const ptaxDate = (isoDate: string) =>
  `${isoDate.slice(5, 7)}-${isoDate.slice(8, 10)}-${isoDate.slice(0, 4)}`;
const monthKey = (isoDate: string) => isoDate.slice(0, 7);
const addMonths = (isoDate: string, months: number) => {
  const d = new Date(`${isoDate.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Regressão linear simples sobre uma série mensal; extrapola para os próximos meses. */
export function linearProjection(points: IndicatorPoint[], monthsAhead: number): IndicatorPoint[] {
  const n = points.length;
  if (n < 2 || monthsAhead <= 0) return [];
  const xMean = (n - 1) / 2;
  const yMean = points.reduce((sum, p) => sum + p.value, 0) / n;
  let num = 0,
    den = 0;
  points.forEach((p, x) => {
    num += (x - xMean) * (p.value - yMean);
    den += (x - xMean) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  const lastDate = points[n - 1]!.date;
  const out: IndicatorPoint[] = [];
  for (let step = 1; step <= monthsAhead; step++)
    out.push({
      date: addMonths(lastDate, step),
      value: round2(intercept + slope * (n - 1 + step)),
    });
  return out;
}

const ptaxDaySchema = z.object({
  value: z.array(
    z.object({
      cotacaoCompra: z.number().finite().min(2.5).max(7.5),
      cotacaoVenda: z.number().finite().min(2.5).max(7.5),
      dataHoraCotacao: z.string(),
    }),
  ),
});
const ptaxPeriodSchema = z.object({
  value: z.array(
    z.object({
      cotacaoVenda: z.number().finite().min(2.5).max(7.5),
      dataHoraCotacao: z.string(),
    }),
  ),
});
const alphaVantageSchema = z.object({
  data: z.array(z.object({ date: z.string(), value: z.string() })).min(1),
});
const sidraSchema = z
  .array(
    z.object({
      resultados: z.array(
        z.object({
          series: z.array(z.object({ serie: z.record(z.string(), z.string()) })).min(1),
        }),
      ),
    }),
  )
  .min(1);
const comexSchema = z.object({
  data: z.object({
    list: z.array(z.object({ year: z.string(), monthNumber: z.string(), country: z.string() })),
  }),
});

const STATIC_FALLBACK = {
  ptax: { buy: 5.19, sell: 5.2 },
  aluminum: 2500,
  industrial: 100,
  suppliers: 8,
};

export interface MarketIndicatorsFetchers {
  fetcher?: typeof fetch;
  now?: () => number;
  alphaVantageKey?: () => string | undefined;
}

export class MarketIndicatorsProvider {
  private cached?: MarketIndicatorsSnapshot;
  private expires = 0;
  private pending: Promise<MarketIndicatorsSnapshot> | undefined;
  private fetcher: typeof fetch;
  private now: () => number;
  private alphaVantageKey: () => string | undefined;
  constructor(opts: MarketIndicatorsFetchers = {}) {
    this.fetcher = opts.fetcher ?? fetch;
    this.now = opts.now ?? Date.now;
    this.alphaVantageKey = opts.alphaVantageKey ?? (() => process.env["ALPHA_VANTAGE_API_KEY"]);
  }
  async getSnapshot(): Promise<MarketIndicatorsSnapshot> {
    if (this.cached && this.now() < this.expires) return structuredClone(this.cached);
    this.pending ??= this.refresh().finally(() => {
      this.pending = undefined;
    });
    return structuredClone(await this.pending);
  }
  private async json(url: string, init?: RequestInit): Promise<unknown> {
    const response = await this.fetcher(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      ...init,
    });
    if (!response.ok) throw new Error(`Fonte indisponível (HTTP ${response.status}).`);
    return response.json();
  }
  private async fetchPtax(today: string): Promise<{ value: PtaxValue; history: IndicatorPoint[] }> {
    let found: { compra: number; venda: number; date: string } | undefined;
    for (let offset = 0; offset <= 10 && !found; offset++) {
      const date = shiftDate(today, -offset);
      const url = `${BCB}CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${ptaxDate(date)}'&$format=json`;
      const parsed = ptaxDaySchema.safeParse(await this.json(url));
      const quote = parsed.success ? parsed.data.value[0] : undefined;
      if (quote) found = { compra: quote.cotacaoCompra, venda: quote.cotacaoVenda, date };
    }
    if (!found) throw new Error("PTAX sem publicação nos últimos dias.");
    const start = shiftDate(today, -380);
    const periodUrl = new URL(
      `${BCB}CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)`,
    );
    periodUrl.search = new URLSearchParams({
      "@dataInicial": `'${ptaxDate(start)}'`,
      "@dataFinalCotacao": `'${ptaxDate(today)}'`,
      $format: "json",
      $orderby: "dataHoraCotacao asc",
    })
      .toString()
      .replaceAll("+", "%20");
    const period = ptaxPeriodSchema.parse(await this.json(periodUrl.toString()));
    const byMonth = new Map<string, number>();
    for (const quote of period.value) {
      const date = quote.dataHoraCotacao.slice(0, 10);
      byMonth.set(monthKey(date), quote.cotacaoVenda);
    }
    const history = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ date: `${month}-01`, value }));
    return {
      value: {
        code: "USD_BRL",
        name: "PTAX USD/BRL",
        value: found.venda,
        buy: found.compra,
        sell: found.venda,
        unit: "BRL/USD",
        date: found.date,
        source: "Banco Central do Brasil — PTAX",
        url: "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/aplicacao",
        status: "real",
        stale: false,
      },
      history,
    };
  }
  private async fetchAluminum(): Promise<{ value: IndicatorValue; history: IndicatorPoint[] }> {
    const key = this.alphaVantageKey();
    if (!key)
      throw new Error(
        "ALPHA_VANTAGE_API_KEY não configurada; gere uma chave gratuita em alphavantage.co.",
      );
    const url = `https://www.alphavantage.co/query?function=ALUMINUM&interval=monthly&apikey=${encodeURIComponent(key)}`;
    const raw = await this.json(url);
    // Alpha Vantage devolve 200 OK mesmo em limite/erro, só que sem "data" — nesses casos o corpo
    // costuma trazer uma dessas chaves com uma mensagem legível, que é bem mais útil no aviso do
    // que o erro genérico de schema.
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const info =
        (raw as Record<string, unknown>)["Information"] ??
        (raw as Record<string, unknown>)["Note"] ??
        (raw as Record<string, unknown>)["Error Message"];
      if (typeof info === "string") throw new Error(`Alpha Vantage: ${info}`);
    }
    const data = alphaVantageSchema.parse(raw);
    const points = data.data
      .map((entry) => ({ date: entry.date, value: Number(entry.value) }))
      .filter((p) => Number.isFinite(p.value) && p.value > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = points.at(-1);
    if (!latest) throw new Error("Alpha Vantage sem dados válidos de alumínio.");
    return {
      value: {
        code: "ALUMINUM",
        name: "Alumínio primário (FMI)",
        value: round2(latest.value),
        unit: "USD/t",
        date: latest.date,
        source: "Alpha Vantage — Global Price of Aluminum",
        url: "https://www.alphavantage.co/documentation/#aluminum",
        status: "real",
        stale: false,
      },
      history: points.slice(-12),
    };
  }
  private async fetchIndustrial(): Promise<{ value: IndicatorValue; history: IndicatorPoint[] }> {
    const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${SIDRA_TABLE}/periodos/-13/variaveis/${SIDRA_VARIABLE}?localidades=${SIDRA_LOCALITY}&classificacao=${SIDRA_CLASSIFICATION}`;
    const data = sidraSchema.parse(await this.json(url));
    const serie = data[0]!.resultados[0]!.series[0]!.serie;
    const points = Object.entries(serie)
      .map(([period, raw]) => ({
        date: `${period.slice(0, 4)}-${period.slice(4, 6)}-01`,
        value: Number(raw),
      }))
      .filter((p) => Number.isFinite(p.value) && p.value > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = points.at(-1);
    if (!latest) throw new Error("SIDRA sem dados válidos de produção industrial.");
    return {
      value: {
        code: "PIM_PF",
        name: "PIM-PF — Indústria geral (Brasil)",
        value: round2(latest.value),
        unit: "índice, base 2022=100",
        date: latest.date,
        source: "IBGE — Pesquisa Industrial Mensal (PIM-PF), tabela 8888",
        url: "https://sidra.ibge.gov.br/tabela/8888",
        status: "real",
        stale: false,
      },
      history: points.slice(-12),
    };
  }
  private async fetchSuppliers(
    today: string,
  ): Promise<{ value: SuppliersValue; history: IndicatorPoint[] }> {
    const from = addMonths(`${monthKey(today)}-01`, -13).slice(0, 7);
    const to = monthKey(today);
    const data = comexSchema.parse(
      await this.json(COMEX_STAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow: "import",
          monthDetail: true,
          period: { from, to },
          filters: [{ filter: "ncm", values: [COMEX_NCM] }],
          details: ["country"],
          metrics: ["metricKG"],
        }),
      }),
    );
    const byMonth = new Map<string, Set<string>>();
    for (const row of data.data.list) {
      const month = `${row.year}-${row.monthNumber}`;
      if (!byMonth.has(month)) byMonth.set(month, new Set());
      byMonth.get(month)!.add(row.country);
    }
    const points = [...byMonth.entries()]
      .map(([month, countries]) => ({ date: `${month}-01`, value: countries.size }))
      .filter((p) => p.value > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = points.at(-1);
    if (!latest) throw new Error("Comex Stat sem dados válidos de importação.");
    const countries = [...(byMonth.get(latest.date.slice(0, 7)) ?? [])].sort();
    return {
      value: {
        code: "SUPPLIERS",
        name: "Países fornecedores de alumínio (importação)",
        value: latest.value,
        countries,
        unit: "países",
        date: latest.date,
        source: "MDIC — Comex Stat (importação, NCM 7606.12.90)",
        url: "https://comexstat.mdic.gov.br/pt/geral",
        status: "real",
        stale: false,
      },
      history: points.slice(-12),
    };
  }
  private fallbackValue(
    code: IndicatorCode,
    name: string,
    unit: string,
    today: string,
    previous: IndicatorHistory | undefined,
    staticValue: number,
  ): { value: IndicatorValue; history: IndicatorPoint[] } {
    if (previous && previous.points.length > 0) {
      const last = previous.points.at(-1)!;
      return {
        value: {
          code,
          name,
          value: last.value,
          unit,
          date: last.date,
          source: "Última referência conhecida (fonte indisponível agora)",
          url: null,
          status: "real",
          stale: true,
        },
        history: previous.points,
      };
    }
    return {
      value: {
        code,
        name,
        value: staticValue,
        unit,
        date: today,
        source: "BuyerLab — valor simulado (fonte indisponível e sem histórico em cache)",
        url: null,
        status: "simulado",
        stale: true,
      },
      history: [],
    };
  }
  private async refresh(): Promise<MarketIndicatorsSnapshot> {
    const now = new Date(this.now());
    const today = brazilDay(now);
    const previousHistory = (code: IndicatorCode) =>
      this.cached?.history.find((h) => h.code === code);
    const warnings: string[] = [];
    let fallbackUsed = false;
    const reasonOf = (error: unknown) =>
      error instanceof Error ? error.message : "Falha ao consultar a fonte.";

    const [ptaxResult, aluminumResult, industrialResult, suppliersResult] =
      await Promise.allSettled([
        this.fetchPtax(today),
        this.fetchAluminum(),
        this.fetchIndustrial(),
        this.fetchSuppliers(today),
      ]);

    let ptaxResolved: { value: PtaxValue; history: IndicatorPoint[] };
    if (ptaxResult.status === "fulfilled") ptaxResolved = ptaxResult.value;
    else {
      fallbackUsed = true;
      warnings.push(`PTAX USD/BRL: ${reasonOf(ptaxResult.reason)}`);
      const fallback = this.fallbackValue(
        "USD_BRL",
        "PTAX USD/BRL",
        "BRL/USD",
        today,
        previousHistory("USD_BRL"),
        STATIC_FALLBACK.ptax.sell,
      );
      ptaxResolved = {
        value: { ...fallback.value, buy: STATIC_FALLBACK.ptax.buy, sell: fallback.value.value },
        history: fallback.history,
      };
    }

    let aluminumResolved: { value: IndicatorValue; history: IndicatorPoint[] };
    if (aluminumResult.status === "fulfilled") aluminumResolved = aluminumResult.value;
    else {
      fallbackUsed = true;
      warnings.push(`Alumínio: ${reasonOf(aluminumResult.reason)}`);
      aluminumResolved = this.fallbackValue(
        "ALUMINUM",
        "Alumínio primário (FMI)",
        "USD/t",
        today,
        previousHistory("ALUMINUM"),
        STATIC_FALLBACK.aluminum,
      );
    }

    let industrialResolved: { value: IndicatorValue; history: IndicatorPoint[] };
    if (industrialResult.status === "fulfilled") industrialResolved = industrialResult.value;
    else {
      fallbackUsed = true;
      warnings.push(`Produção industrial (PIM-PF): ${reasonOf(industrialResult.reason)}`);
      industrialResolved = this.fallbackValue(
        "PIM_PF",
        "PIM-PF — Indústria geral (Brasil)",
        "índice, base 2022=100",
        today,
        previousHistory("PIM_PF"),
        STATIC_FALLBACK.industrial,
      );
    }

    let suppliersResolved: { value: SuppliersValue; history: IndicatorPoint[] };
    if (suppliersResult.status === "fulfilled") suppliersResolved = suppliersResult.value;
    else {
      fallbackUsed = true;
      warnings.push(`Países fornecedores: ${reasonOf(suppliersResult.reason)}`);
      const fallback = this.fallbackValue(
        "SUPPLIERS",
        "Países fornecedores de alumínio (importação)",
        "países",
        today,
        previousHistory("SUPPLIERS"),
        STATIC_FALLBACK.suppliers,
      );
      suppliersResolved = {
        value: { ...fallback.value, countries: [] },
        history: fallback.history,
      };
    }

    const toHistory = (
      code: IndicatorCode,
      name: string,
      unit: string,
      resolved: { history: IndicatorPoint[] },
    ): IndicatorHistory => ({
      code,
      name,
      unit,
      points: resolved.history,
      projection: linearProjection(resolved.history, 3),
    });

    this.cached = {
      fetchedAt: now.toISOString(),
      ptax: ptaxResolved.value,
      aluminum: aluminumResolved.value,
      industrial: industrialResolved.value,
      suppliers: suppliersResolved.value,
      history: [
        toHistory("USD_BRL", "PTAX USD/BRL", "BRL/USD", ptaxResolved),
        toHistory("ALUMINUM", "Alumínio primário (FMI)", "USD/t", aluminumResolved),
        toHistory(
          "PIM_PF",
          "PIM-PF — Indústria geral (Brasil)",
          "índice, base 2022=100",
          industrialResolved,
        ),
        toHistory(
          "SUPPLIERS",
          "Países fornecedores de alumínio (importação)",
          "países",
          suppliersResolved,
        ),
      ],
      fallbackUsed,
      warnings,
    };
    // Failures retry after 5 minutes; healthy feeds refresh once/day and across local midnight.
    this.expires = this.now() + (fallbackUsed ? 300000 : 86400000);
    return this.cached;
  }
}

export const marketIndicators = new MarketIndicatorsProvider();
