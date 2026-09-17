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
  private checkDate(date: string, today: string) {
    const stamp = Date.parse(date);
    if (!Number.isFinite(stamp) || date > today || Date.parse(today) - stamp > 7 * 86400000)
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
  private async aluminum(today: string): Promise<MarketIndicator> {
    const key = this.metalKey();
    let value: number, timestamp: string;
    if (key) {
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
      value = data.metals.aluminum;
      timestamp = data.timestamps.metal;
    } else {
      const data = z
        .object({
          base: z.literal("USD"),
          price: z.object({ metric_ton: z.number().finite().positive() }),
          timestamp: z.string().datetime(),
        })
        .parse(await this.json(PUBLIC_ALUMINUM));
      value = data.price.metric_ton;
      timestamp = data.timestamp;
    }
    const date = timestamp.slice(0, 10);
    this.checkDate(date, today);
    // Keep the existing versioned scenario's supported economic range.
    if (value < 1200 || value > 3600)
      throw new Error("Cotação fora da faixa suportada pelo cenário");
    return {
      code: "ALUMINUM",
      name: "Alumínio primário — referência externa",
      value,
      date,
      source: key ? "Metals.Dev — alumínio spot" : "Croncopia — agregador de alumínio",
      url: key ? "https://metals.dev/docs" : PUBLIC_ALUMINUM,
      unit: "USD/t",
      frequency: "Última publicação disponível; não é preço da chapa",
      status: "real",
    };
  }
  private async refresh(): Promise<MarketSnapshot> {
    const now = new Date(this.now()),
      today = day(now);
    const results = await Promise.allSettled([this.ptax(today), this.aluminum(today)]);
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
      status: indicators.some((i) => i.status === "real") ? "misto" : "simulado",
      fallbackUsed,
      indicators,
      hash,
      sourceUrls: indicators.flatMap((i) => (i.url ? [i.url] : [])),
    });
    // Failures retry after 5 minutes; healthy feeds refresh hourly and across local midnight.
    const ttl = fallbackUsed ? 300000 : 3600000;
    this.expires = this.now() + ttl;
    return this.cached;
  }
}
export const liveMarket = new LiveMarketDataProvider();
