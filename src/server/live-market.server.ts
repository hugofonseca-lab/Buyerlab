import { z } from "zod";
import type { MarketIndicator, MarketSnapshot } from "../domain/aluminum";
import {
  STATIC_MARKET,
  validateMarket,
  marketIndicatorsHash,
  type MarketDataProvider,
} from "./market.server";

const BCB = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/";
const PUBLIC_ALUMINUM = "https://croncopia.com/api/metals/aluminum.json";
// IBGE SIDRA, tabela 8888 (PIM-PF, base 2022=100), variável 12606, categoria 129333
// ("3.24 Metalurgia") — mede a atividade do setor que produz o próprio material negociado,
// não a indústria geral. Ver docs/market-data.md se o IBGE reformular a tabela de novo.
const SIDRA_METALURGIA =
  "https://servicodados.ibge.gov.br/api/v3/agregados/8888/periodos/-6/variaveis/12606?localidades=N1[1]&classificacao=544[129333]";
const day = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const ptaxDate = (date: string) => `${date.slice(5, 7)}-${date.slice(8, 10)}-${date.slice(0, 4)}`;

/** Server-only, fixed hosts. No user URL or provider credentials enter the snapshot. */
export class LiveMarketDataProvider implements MarketDataProvider {
  private cached?: MarketSnapshot;
  private expires = 0;
  private pending: Promise<MarketSnapshot> | undefined;
  constructor(
    private fetcher: typeof fetch = fetch,
    private now: () => number = Date.now,
    private metalKey: () => string | undefined = () => process.env["METALS_DEV_API_KEY"],
    // Mesma chave e fonte do painel "Indicadores de mercado" (market-indicators.server.ts),
    // para o benchmark de negociação e o painel nunca mostrarem cotações de alumínio diferentes.
    private alphaVantageKey: () => string | undefined = () => process.env["ALPHA_VANTAGE_API_KEY"],
  ) {}
  async getSnapshot(): Promise<MarketSnapshot> {
    if (
      this.cached &&
      this.now() < this.expires &&
      this.cached.referenceDate === day(new Date(this.now()))
    )
      return structuredClone(this.cached);
    this.pending ??= this.refresh().finally(() => {
      this.pending = undefined;
    });
    return structuredClone(await this.pending);
  }
  private async json(url: string): Promise<unknown> {
    const response = await this.fetcher(url, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("Fonte de mercado indisponível");
    return response.json();
  }
  private checkDate(date: string, today: string, maxAgeDays = 7) {
    const stamp = Date.parse(date);
    if (
      !Number.isFinite(stamp) ||
      date > today ||
      Date.parse(today) - stamp > maxAgeDays * 86400000
    )
      throw new Error("Cotação sem data válida ou desatualizada");
  }
  private async ptax(today: string): Promise<MarketIndicator> {
    const start = new Date(Date.parse(today) - 7 * 86400000).toISOString().slice(0, 10);
    const url = new URL(
      `${BCB}CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)`,
    );
    url.search = new URLSearchParams({
      "@dataInicial": `'${ptaxDate(start)}'`,
      "@dataFinalCotacao": `'${ptaxDate(today)}'`,
      $format: "json",
      $orderby: "dataHoraCotacao desc",
      $top: "1",
    })
      .toString()
      .replaceAll("+", "%20");
    const result = z
      .object({
        value: z
          .array(
            z.object({
              cotacaoVenda: z.number().finite().min(2.5).max(7.5),
              dataHoraCotacao: z.string(),
            }),
          )
          .min(1),
      })
      .parse(await this.json(url.toString())).value[0]!;
    const date = result.dataHoraCotacao.slice(0, 10);
    this.checkDate(date, today);
    return {
      code: "USD_BRL",
      name: "PTAX venda USD/BRL",
      value: result.cotacaoVenda,
      date,
      source: "Banco Central do Brasil — PTAX venda",
      url: url.toString(),
      unit: "BRL/USD",
      frequency: "Diária; última publicação disponível",
      status: "real",
    };
  }
  private async aluminumFromAlphaVantage(key: string): Promise<{ value: number; date: string }> {
    const url = `https://www.alphavantage.co/query?function=ALUMINUM&interval=monthly&apikey=${encodeURIComponent(key)}`;
    const data = z
      .object({ data: z.array(z.object({ date: z.string(), value: z.string() })).min(1) })
      .parse(await this.json(url));
    const points = data.data
      .map((entry) => ({ date: entry.date, value: Number(entry.value) }))
      .filter((p) => Number.isFinite(p.value) && p.value > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = points.at(-1);
    if (!latest) throw new Error("Alpha Vantage sem dados válidos de alumínio.");
    return latest;
  }
  private async aluminumFromMetalsDev(key: string): Promise<{ value: number; date: string }> {
    const url = new URL("https://api.metals.dev/v1/latest");
    url.search = new URLSearchParams({ api_key: key, currency: "USD", unit: "mt" }).toString();
    const data = z
      .object({
        status: z.literal("success"),
        currency: z.literal("USD"),
        unit: z.literal("mt"),
        metals: z.object({ aluminum: z.number().finite().positive() }),
        timestamps: z.object({ metal: z.string().datetime() }),
      })
      .parse(await this.json(url.toString()));
    return { value: data.metals.aluminum, date: data.timestamps.metal.slice(0, 10) };
  }
  private async aluminumFromCroncopia(): Promise<{ value: number; date: string }> {
    const data = z
      .object({
        base: z.literal("USD"),
        price: z.object({ metric_ton: z.number().finite().positive() }),
        timestamp: z.string().datetime(),
      })
      .parse(await this.json(PUBLIC_ALUMINUM));
    return { value: data.price.metric_ton, date: data.timestamp.slice(0, 10) };
  }
  private async aluminum(today: string): Promise<MarketIndicator> {
    // Prioriza a mesma fonte do painel de indicadores (Alpha Vantage) para as duas telas nunca
    // mostrarem cotações de alumínio diferentes; Metals.Dev e Croncopia seguem como alternativas.
    const alphaKey = this.alphaVantageKey();
    const metalsKey = this.metalKey();
    let value: number, date: string, source: string, url: string, maxAgeDays: number;
    if (alphaKey) {
      ({ value, date } = await this.aluminumFromAlphaVantage(alphaKey));
      source = "Alpha Vantage — Global Price of Aluminum";
      url = "https://www.alphavantage.co/documentation/#aluminum";
      // Serie mensal (FMI); publicacao tem defasagem normal de semanas, nao de dias.
      maxAgeDays = 100;
    } else if (metalsKey) {
      ({ value, date } = await this.aluminumFromMetalsDev(metalsKey));
      source = "Metals.Dev — alumínio spot";
      url = "https://metals.dev/docs";
      maxAgeDays = 7;
    } else {
      ({ value, date } = await this.aluminumFromCroncopia());
      source = "Croncopia — agregador de alumínio";
      url = PUBLIC_ALUMINUM;
      maxAgeDays = 7;
    }
    this.checkDate(date, today, maxAgeDays);
    // Keep the existing versioned scenario's supported economic range.
    if (value < 1200 || value > 3600)
      throw new Error("Cotação fora da faixa suportada pelo cenário");
    return {
      code: "ALUMINUM",
      name: "Alumínio primário — referência externa",
      value,
      date,
      source,
      url,
      unit: "USD/t",
      frequency: "Última publicação disponível; não é preço da chapa",
      status: "real",
    };
  }
  private async industrial(today: string): Promise<MarketIndicator> {
    const data = z
      .object({
        resultados: z.array(
          z.object({
            series: z.array(z.object({ serie: z.record(z.string(), z.string()) })).min(1),
          }),
        ),
      })
      .array()
      .min(1)
      .parse(await this.json(SIDRA_METALURGIA));
    const serie = data[0]!.resultados[0]!.series[0]!.serie;
    const points = Object.entries(serie)
      .map(([period, raw]) => ({
        date: `${period.slice(0, 4)}-${period.slice(4, 6)}-01`,
        value: Number(raw),
      }))
      .filter((p) => Number.isFinite(p.value) && p.value > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = points.at(-1);
    if (!latest) throw new Error("SIDRA sem dados válidos de metalurgia.");
    // Série mensal do IBGE; mesma folga de defasagem usada para o alumínio do Alpha Vantage.
    this.checkDate(latest.date, today, 100);
    if (latest.value < 50 || latest.value > 200)
      throw new Error("Índice fora da faixa suportada pelo cenário.");
    return {
      code: "IPP",
      name: "PIM-PF — Metalurgia (Brasil)",
      value: latest.value,
      date: latest.date,
      source: "IBGE — Pesquisa Industrial Mensal (PIM-PF), tabela 8888, Metalurgia",
      url: "https://sidra.ibge.gov.br/tabela/8888",
      unit: "índice, base 2022=100",
      frequency: "Mensal; defasagem normal de semanas",
      status: "real",
    };
  }
  private async refresh(): Promise<MarketSnapshot> {
    const now = new Date(this.now()),
      today = day(now);
    const results = await Promise.allSettled([
      this.ptax(today),
      this.aluminum(today),
      this.industrial(today),
    ]);
    const indicators = structuredClone(STATIC_MARKET.indicators);
    let fallbackUsed = false;
    results.forEach((result, index) => {
      if (result.status === "fulfilled") indicators[index] = result.value;
      else {
        fallbackUsed = true;
        const previous = this.cached?.indicators[index];
        if (previous?.status === "real") indicators[index] = structuredClone(previous);
      }
    });
    const hash = marketIndicatorsHash(indicators);
    this.cached = validateMarket({
      id: `market-${hash.slice(0, 24)}`,
      referenceDate: today,
      fetchedAt: now.toISOString(),
      createdAt: now.toISOString(),
      provider: "BuyerLab live v1",
      status: indicators.every((i) => i.status === "real")
        ? "real"
        : indicators.some((i) => i.status === "real")
          ? "misto"
          : "simulado",
      fallbackUsed,
      indicators,
      hash,
      sourceUrls: indicators.flatMap((i) => (i.url ? [i.url] : [])),
    });
    // Failures retry after 5 minutes; healthy feeds refresh once/day (and across local
    // midnight). PTAX is fixed once published and Alpha Vantage's alumínio is mensal, então
    // um cache mais curto só gastaria a cota diária de 25 requisições da chave gratuita.
    const ttl = fallbackUsed ? 300000 : 86400000;
    this.expires = this.now() + ttl;
    return this.cached;
  }
}
export const liveMarket = new LiveMarketDataProvider();
