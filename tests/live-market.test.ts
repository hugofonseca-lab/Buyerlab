import { describe, expect, it, vi } from "vitest";
import { LiveMarketDataProvider } from "../src/server/live-market.server";
import { createRun } from "../src/server/engine.server";
import { toLovableSnapshot } from "../src/simulation/lovable-view";
import { publicSnapshot } from "../src/server/engine.server";

const now = Date.parse("2026-09-16T18:00:00Z");
const ptax = { value: [{ cotacaoVenda: 5.15, dataHoraCotacao: "2026-09-16 13:00:00.000" }] };
const metal = { base: "USD", price: { metric_ton: 3200 }, timestamp: "2026-09-16T12:00:00Z" };
const alphaVantage = (value = 3300, date = "2026-07-01") => ({
  name: "Global Price of Aluminum",
  interval: "monthly",
  unit: "dollar per metric ton",
  data: [{ date, value: String(value) }],
});
const sidra = (value = 108, period = "202607") => [
  { resultados: [{ series: [{ serie: { [period]: String(value) } }] }] },
];
const response = (data: unknown) => new Response(JSON.stringify(data));
function fixture(aluminum: unknown = metal, dollar: unknown = ptax, industrial: unknown = sidra()) {
  return vi.fn(async (url: string | URL | Request) => {
    const href = String(url);
    if (href.includes("bcb.gov.br")) return response(dollar);
    if (href.includes("servicodados.ibge.gov.br")) return response(industrial);
    return response(aluminum);
  });
}
describe("mercado real", () => {
  it("consulta PTAX, alumínio e metalurgia, guarda datas, cache e cópias isoladas", async () => {
    const fetcher = fixture();
    const source = new LiveMarketDataProvider(
      fetcher,
      () => now,
      () => undefined,
      () => undefined,
    );
    const [first, second] = await Promise.all([source.getSnapshot(), source.getSnapshot()]);
    expect(first.status).toBe("real");
    expect(first.fallbackUsed).toBe(false);
    expect(first.indicators.map((i) => i.value)).toEqual([5.15, 3200, 108]);
    expect(first.indicators[2]!.status).toBe("real");
    expect(first.indicators[2]!.name).toContain("Metalurgia");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(String(fetcher.mock.calls[0]![0])).toContain("CotacaoDolarPeriodo");
    expect(String(fetcher.mock.calls[2]![0])).toContain("servicodados.ibge.gov.br");
    first.indicators[0]!.value = 1;
    expect(second.indicators[0]!.value).toBe(5.15);
    expect((await source.getSnapshot()).indicators[0]!.value).toBe(5.15);
  });
  it.each([
    { ...metal, timestamp: "2026-07-18T12:00:00Z" },
    { ...metal, timestamp: "2026-09-17T12:00:00Z" },
    { ...metal, price: { metric_ton: -1 } },
    { ...metal, price: { metric_ton: 5000 } },
    { ...metal, base: "EUR" },
  ])("rejeita data, moeda ou valor inválido sem perder PTAX", async (invalid) => {
    const result = await new LiveMarketDataProvider(
      fixture(invalid),
      () => now,
      () => undefined,
      () => undefined,
    ).getSnapshot();
    expect(result.fallbackUsed).toBe(true);
    expect(result.indicators[0]!.status).toBe("real");
    expect(result.indicators[1]!.status).toBe("simulado");
    expect(result.indicators[1]!.value).toBe(2500);
    expect(result.status).toBe("misto");
  });
  it("mantém cotação anterior após erro de rede e não reescreve data", async () => {
    let time = now;
    const fetcher = fixture();
    const source = new LiveMarketDataProvider(
      fetcher,
      () => time,
      () => undefined,
      () => undefined,
    );
    await source.getSnapshot();
    time += 86400000;
    fetcher.mockRejectedValue(new Error("offline"));
    const result = await source.getSnapshot();
    expect(result.fallbackUsed).toBe(true);
    expect(result.indicators[0]!.date).toBe("2026-09-16");
    expect(result.referenceDate).toBe("2026-09-17");
  });
  it("conector com chave valida unidade e não expõe credencial", async () => {
    const fetcher = fixture({
      status: "success",
      currency: "USD",
      unit: "mt",
      metals: { aluminum: 3100 },
      timestamps: { metal: metal.timestamp },
    });
    const result = await new LiveMarketDataProvider(
      fetcher,
      () => now,
      () => "test-secret",
      () => undefined,
    ).getSnapshot();
    expect(result.indicators[1]!.value).toBe(3100);
    expect(JSON.stringify(result)).not.toContain("test-secret");
    expect(JSON.stringify(result)).not.toContain("api_key");
  });
  it("Alpha Vantage tem prioridade sobre Metals.Dev e aceita defasagem mensal maior", async () => {
    const fetcher = fixture(alphaVantage(3300, "2026-07-01"));
    const result = await new LiveMarketDataProvider(
      fetcher,
      () => now,
      () => "metals-dev-secret",
      () => "alpha-vantage-secret",
    ).getSnapshot();
    expect(result.indicators[1]!.value).toBe(3300);
    expect(result.indicators[1]!.source).toContain("Alpha Vantage");
    expect(String(fetcher.mock.calls[1]![0])).toContain("alphavantage.co");
    expect(JSON.stringify(result)).not.toContain("alpha-vantage-secret");
  });
  it("Alpha Vantage muito antigo (>100 dias) ainda é rejeitado", async () => {
    const result = await new LiveMarketDataProvider(
      fixture(alphaVantage(3300, "2026-01-01")),
      () => now,
      () => undefined,
      () => "alpha-vantage-secret",
    ).getSnapshot();
    expect(result.indicators[1]!.status).toBe("simulado");
    expect(result.fallbackUsed).toBe(true);
  });
  it("índice de metalurgia: valor e data inválidos preservam PTAX e alumínio", async () => {
    const result = await new LiveMarketDataProvider(
      fixture(undefined, undefined, sidra(9999, "202607")),
      () => now,
      () => undefined,
      () => undefined,
    ).getSnapshot();
    expect(result.fallbackUsed).toBe(true);
    expect(result.indicators[2]!.status).toBe("simulado");
    expect(result.indicators[0]!.status).toBe("real");
    expect(result.indicators[1]!.status).toBe("real");
  });
  it("seed + snapshot reproduzem cenário; interface conserva origem e data", async () => {
    const market = await new LiveMarketDataProvider(
      fixture(),
      () => now,
      () => undefined,
      () => undefined,
    ).getSnapshot();
    const config = {
      seed: "MARKET",
      modo: "treinamento",
      dificuldade: "iniciante",
      urgencia: "baixa",
      perfil: "colaborativo",
      scenarioType: "aluminum",
    } as const;
    const a = createRun(config, market),
      b = createRun(config, market);
    expect(a.aluminum).toEqual(b.aluminum);
    expect(a.sourcingPrivate).toEqual(b.sourcingPrivate);
    const nextDay = createRun(config, { ...market, referenceDate: "2026-09-17" });
    expect(nextDay.aluminum!.instance.id).not.toBe(a.aluminum!.instance.id);
    const ui = toLovableSnapshot(publicSnapshot(a));
    expect(ui.scenario!.marketSnapshot.indicators).toEqual(market.indicators);
    expect(ui.scenario!.marketSnapshot.ptax).toBe(5.15);
    expect(ui.scenario!.marketSnapshot.industrialIndexLabel).toBe("PIM-PF — Metalurgia (Brasil)");
  });
});
