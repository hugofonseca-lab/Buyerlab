import { createHash } from "node:crypto";
import { z } from "zod";
import type { MarketSnapshot } from "../domain/aluminum";
const indicatorSchema = z.object({
  code: z.string(),
  name: z.string(),
  value: z.number().finite().positive(),
  unit: z.string(),
  date: z.string(),
  source: z.string(),
  url: z.string().nullable(),
  frequency: z.string(),
  status: z.enum(["simulado", "real"]),
});
const snapshotSchema = z.object({
  id: z.string(),
  referenceDate: z.string(),
  fetchedAt: z.string(),
  provider: z.string(),
  status: z.enum(["simulado", "misto", "real"]),
  fallbackUsed: z.boolean(),
  indicators: z.array(indicatorSchema).length(3),
  sourceUrls: z.array(z.string()),
  hash: z.string(),
  createdAt: z.string(),
});
const referenceDate = "2026-09-16";
const indicators: MarketSnapshot["indicators"] = [
  { code: "USD_BRL", name: "Câmbio USD/BRL — referência didática", value: 5.2, unit: "BRL/USD" },
  { code: "ALUMINUM", name: "Alumínio — referência didática", value: 2500, unit: "USD/t" },
  {
    code: "IPP",
    name: "Índice de produção — referência didática",
    value: 105,
    unit: "índice, base 100",
  },
].map((i) => ({
  ...i,
  date: referenceDate,
  source: "BuyerLab: dataset fictício, não é cotação PTAX/LME/IBGE",
  url: null,
  frequency: "snapshot estático v1",
  status: "simulado",
}));
export const STATIC_MARKET: MarketSnapshot = {
  id: "aluminum-market-demo-v1",
  referenceDate,
  fetchedAt: `${referenceDate}T00:00:00Z`,
  provider: "BuyerLab StaticMarketDataProvider v1",
  status: "simulado",
  fallbackUsed: false,
  indicators,
  sourceUrls: [],
  hash: createHash("sha256").update(JSON.stringify(indicators)).digest("hex"),
  createdAt: `${referenceDate}T00:00:00Z`,
};
export function validateMarket(value: unknown): MarketSnapshot {
  const parsed = snapshotSchema.parse(value);
  if ([...new Set(parsed.indicators.map((i) => i.code))].sort().join() !== "ALUMINUM,IPP,USD_BRL")
    throw new Error("Indicadores incompletos.");
  const hash = createHash("sha256").update(JSON.stringify(parsed.indicators)).digest("hex");
  if (hash !== parsed.hash) throw new Error("Hash de mercado inválido.");
  return parsed;
}
export function marketIndicatorsHash(indicators: MarketSnapshot["indicators"]) {
  return createHash("sha256")
    .update(JSON.stringify(z.array(indicatorSchema).parse(indicators)))
    .digest("hex");
}
export interface MarketDataProvider {
  getSnapshot(): Promise<MarketSnapshot>;
}
export class StaticMarketDataProvider implements MarketDataProvider {
  async getSnapshot() {
    return validateMarket(structuredClone(STATIC_MARKET));
  }
}
export class CachedMarketDataProvider implements MarketDataProvider {
  private cached: MarketSnapshot | undefined;
  private expires = 0;
  constructor(
    private source: MarketDataProvider,
    private now = Date.now,
    private timeoutMs = 1000,
  ) {}
  async getSnapshot(): Promise<MarketSnapshot> {
    if (this.cached && this.now() < this.expires) return structuredClone(this.cached);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const candidate = await Promise.race([
        this.source.getSnapshot(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Timeout mercado")), this.timeoutMs);
        }),
      ]);
      this.cached = validateMarket(candidate);
    } catch {
      this.cached = {
        ...(this.cached ?? (await new StaticMarketDataProvider().getSnapshot())),
        fallbackUsed: true,
      };
    } finally {
      clearTimeout(timer);
    }
    this.expires = this.now() + 24 * 60 * 60 * 1000;
    return structuredClone(this.cached);
  }
}
