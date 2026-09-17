import { describe, expect, it, vi } from "vitest";
import { MarketIndicatorsProvider, linearProjection } from "../src/server/market-indicators.server";

const now = Date.parse("2026-09-17T15:00:00Z"); // segunda-feira; hoje ainda sem PTAX publicada
const ptaxDay = (compra: number, venda: number, date: string) => ({
  value: [{ cotacaoCompra: compra, cotacaoVenda: venda, dataHoraCotacao: `${date} 13:05:00.000` }],
});
const emptyPtaxDay = { value: [] };
function ptaxPeriod(months: number) {
  const value = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(2026, 8 - i, 16));
    value.push({
      cotacaoVenda: 5 + i * 0.01,
      dataHoraCotacao: `${d.toISOString().slice(0, 10)} 13:00:00.000`,
    });
  }
  return { value };
}
function alphaVantage(months: number) {
  const data = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(2026, 6 - i, 1));
    data.push({ date: d.toISOString().slice(0, 10), value: String(3000 + i * 10) });
  }
  return {
    name: "Global Price of Aluminum",
    interval: "monthly",
    unit: "dollar per metric ton",
    data,
  };
}
function sidra(months: number) {
  const serie: Record<string, string> = {};
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(2026, 6 - i, 1));
    const key = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    serie[key] = String(100 + i);
  }
  return [{ resultados: [{ series: [{ serie }] }] }];
}
function comexStat(monthsCountries: Record<string, string[]>) {
  const list = [];
  for (const [month, countries] of Object.entries(monthsCountries)) {
    const [year, monthNumber] = [month.slice(0, 4), month.slice(4, 6)];
    for (const country of countries) list.push({ year, monthNumber, country });
  }
  return { data: { list }, success: true };
}
const response = (data: unknown) => new Response(JSON.stringify(data));
function fixture(
  overrides: {
    ptaxDayByDate?: Record<string, unknown>;
    ptaxPeriodResponse?: unknown;
    alphaVantageResponse?: unknown;
    sidraResponse?: unknown;
    comexResponse?: unknown;
  } = {},
) {
  return vi.fn(async (url: string | URL | Request) => {
    const href = String(url);
    if (href.includes("CotacaoDolarDia")) {
      const match = /@dataCotacao='([\d-]+)'/.exec(href);
      const date = match![1]!;
      const found = overrides.ptaxDayByDate?.[date];
      return response(found ?? emptyPtaxDay);
    }
    if (href.includes("CotacaoDolarPeriodo"))
      return response(overrides.ptaxPeriodResponse ?? ptaxPeriod(12));
    if (href.includes("alphavantage.co"))
      return response(overrides.alphaVantageResponse ?? alphaVantage(12));
    if (href.includes("servicodados.ibge.gov.br"))
      return response(overrides.sidraResponse ?? sidra(13));
    if (href.includes("api-comexstat.mdic.gov.br"))
      return response(
        overrides.comexResponse ??
          comexStat({ "202607": ["China", "Alemanha"], "202608": ["China", "Itália", "Índia"] }),
      );
    throw new Error(`URL inesperada: ${href}`);
  });
}
describe("indicadores de mercado", () => {
  it("PTAX cai para o último dia útil publicado quando hoje está vazio", async () => {
    const fetcher = fixture({
      ptaxDayByDate: { "09-16-2026": ptaxDay(5.152, 5.1527, "2026-09-16") },
    });
    const provider = new MarketIndicatorsProvider({
      fetcher,
      now: () => now,
      alphaVantageKey: () => "chave-teste",
    });
    const snapshot = await provider.getSnapshot();
    expect(snapshot.ptax.date).toBe("2026-09-16");
    expect(snapshot.ptax.sell).toBe(5.1527);
    expect(snapshot.ptax.buy).toBe(5.152);
    expect(snapshot.ptax.status).toBe("real");
    expect(snapshot.fallbackUsed).toBe(false);
  });
  it("alumínio via Alpha Vantage: parseia série mensal e usa o valor mais recente", async () => {
    const fetcher = fixture({ ptaxDayByDate: { "09-17-2026": ptaxDay(5.15, 5.16, "2026-09-17") } });
    const provider = new MarketIndicatorsProvider({
      fetcher,
      now: () => now,
      alphaVantageKey: () => "chave-teste",
    });
    const snapshot = await provider.getSnapshot();
    expect(snapshot.aluminum.value).toBe(3000);
    expect(snapshot.aluminum.unit).toBe("USD/t");
    expect(snapshot.aluminum.status).toBe("real");
    const history = snapshot.history.find((h) => h.code === "ALUMINUM")!;
    expect(history.points).toHaveLength(12);
    expect(history.points.at(-1)!.value).toBe(3000);
  });
  it("sem ALPHA_VANTAGE_API_KEY, alumínio cai para simulado sem quebrar a tela", async () => {
    const fetcher = fixture({ ptaxDayByDate: { "09-17-2026": ptaxDay(5.15, 5.16, "2026-09-17") } });
    const provider = new MarketIndicatorsProvider({
      fetcher,
      now: () => now,
      alphaVantageKey: () => undefined,
    });
    const snapshot = await provider.getSnapshot();
    expect(snapshot.aluminum.status).toBe("simulado");
    expect(snapshot.fallbackUsed).toBe(true);
    expect(snapshot.warnings.some((w) => w.includes("Alumínio"))).toBe(true);
  });
  it("Alpha Vantage em limite de requisições cai para simulado com aviso legível", async () => {
    const fetcher = fixture({
      ptaxDayByDate: { "09-17-2026": ptaxDay(5.15, 5.16, "2026-09-17") },
      alphaVantageResponse: {
        Information:
          "We have detected your API key as TESTE123 and our standard API rate limit is 25 requests per day.",
      },
    });
    const provider = new MarketIndicatorsProvider({
      fetcher,
      now: () => now,
      alphaVantageKey: () => "chave-teste",
    });
    const snapshot = await provider.getSnapshot();
    expect(snapshot.aluminum.status).toBe("simulado");
    expect(snapshot.fallbackUsed).toBe(true);
    expect(snapshot.warnings.some((w) => w.includes("Alumínio") && w.includes("rate limit"))).toBe(
      true,
    );
  });
  it("IBGE SIDRA: parseia série PIM-PF e ordena por competência", async () => {
    const fetcher = fixture({ ptaxDayByDate: { "09-17-2026": ptaxDay(5.15, 5.16, "2026-09-17") } });
    const provider = new MarketIndicatorsProvider({
      fetcher,
      now: () => now,
      alphaVantageKey: () => "chave-teste",
    });
    const snapshot = await provider.getSnapshot();
    expect(snapshot.industrial.value).toBe(100);
    const history = snapshot.history.find((h) => h.code === "PIM_PF")!;
    expect(history.points.length).toBeGreaterThan(1);
    const dates = history.points.map((p) => p.date);
    expect([...dates].sort()).toEqual(dates);
  });
  it("Comex Stat: conta países distintos por mês e usa o mês mais recente", async () => {
    const fetcher = fixture({ ptaxDayByDate: { "09-17-2026": ptaxDay(5.15, 5.16, "2026-09-17") } });
    const provider = new MarketIndicatorsProvider({
      fetcher,
      now: () => now,
      alphaVantageKey: () => "chave-teste",
    });
    const snapshot = await provider.getSnapshot();
    expect(snapshot.suppliers.value).toBe(3);
    expect(snapshot.suppliers.countries.sort()).toEqual(["China", "Itália", "Índia"].sort());
    expect(snapshot.suppliers.status).toBe("real");
    const history = snapshot.history.find((h) => h.code === "SUPPLIERS")!;
    expect(history.points.map((p) => p.value)).toEqual([2, 3]);
  });
  it("Comex Stat sem dados não derruba os outros três indicadores", async () => {
    const fetcher = fixture({
      ptaxDayByDate: { "09-17-2026": ptaxDay(5.15, 5.16, "2026-09-17") },
      comexResponse: comexStat({}),
    });
    const provider = new MarketIndicatorsProvider({
      fetcher,
      now: () => now,
      alphaVantageKey: () => "chave-teste",
    });
    const snapshot = await provider.getSnapshot();
    expect(snapshot.suppliers.status).toBe("simulado");
    expect(snapshot.ptax.status).toBe("real");
    expect(snapshot.aluminum.status).toBe("real");
    expect(snapshot.industrial.status).toBe("real");
    expect(snapshot.fallbackUsed).toBe(true);
    expect(snapshot.warnings.some((w) => w.includes("Países fornecedores"))).toBe(true);
  });
  it("fonte fora do ar preserva o último valor em cache e sinaliza como desatualizado", async () => {
    let time = now;
    const fetcher = fixture({ ptaxDayByDate: { "09-17-2026": ptaxDay(5.15, 5.16, "2026-09-17") } });
    const provider = new MarketIndicatorsProvider({
      fetcher,
      now: () => time,
      alphaVantageKey: () => "chave-teste",
    });
    const first = await provider.getSnapshot();
    expect(first.aluminum.stale).toBe(false);
    time += 86400001;
    fetcher.mockImplementation(async (url: string | URL | Request) => {
      if (String(url).includes("alphavantage.co")) throw new Error("offline");
      return fixture({ ptaxDayByDate: { "09-18-2026": ptaxDay(5.15, 5.16, "2026-09-18") } })(url);
    });
    const second = await provider.getSnapshot();
    expect(second.aluminum.stale).toBe(true);
    expect(second.aluminum.value).toBe(first.aluminum.value);
    expect(second.fallbackUsed).toBe(true);
    expect(second.warnings.length).toBeGreaterThan(0);
  });
  it("nunca lança exceção mesmo com todas as fontes falhando e sem cache anterior", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("rede indisponível");
    });
    const provider = new MarketIndicatorsProvider({
      fetcher,
      now: () => now,
      alphaVantageKey: () => "chave",
    });
    const snapshot = await provider.getSnapshot();
    expect(snapshot.fallbackUsed).toBe(true);
    expect(snapshot.ptax.status).toBe("simulado");
    expect(snapshot.aluminum.status).toBe("simulado");
    expect(snapshot.industrial.status).toBe("simulado");
    expect(snapshot.suppliers.status).toBe("simulado");
    expect(snapshot.suppliers.countries).toEqual([]);
  });
  it("regressão linear projeta tendência para os próximos meses", () => {
    const points = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-0${i + 1}-01`,
      value: 100 + i * 10,
    }));
    const projection = linearProjection(points, 3);
    expect(projection).toHaveLength(3);
    expect(projection[0]!.value).toBeCloseTo(160, 0);
    expect(projection[2]!.value).toBeCloseTo(180, 0);
    expect(linearProjection([], 3)).toEqual([]);
    expect(linearProjection([points[0]!], 3)).toEqual([]);
  });
});
