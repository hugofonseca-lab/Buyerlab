import { afterEach, describe, expect, it, vi } from "vitest";
import { liveMarket } from "../src/server/live-market.server";
import { marketIndicators } from "../src/server/market-indicators.server";
import { STATIC_MARKET } from "../src/server/market.server";
import { Store } from "../src/server/store.server";
import { createApi } from "../src/server/api.server";
import { MockSimulationProvider, type SupplierProvider } from "../src/server/providers.server";
import { offerDefaults } from "../src/domain/offer-defaults";
import type { BuyerActionTag, CompetencyScore } from "../src/domain/types";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const paths: string[] = [];
const stores: Store[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const store of stores.splice(0)) store.db.close();
  for (const p of paths.splice(0)) rmSync(p, { recursive: true, force: true });
});
function setup(path = ":memory:", provider = new MockSimulationProvider()) {
  const store = new Store(path);
  stores.push(store);
  const api = createApi(store, provider);
  let cookie = "";
  async function call(
    body: object | null,
    path = "/api/simulations",
    key = crypto.randomUUID(),
    otherCookie?: string,
  ) {
    const response = await api(
      new Request(`http://localhost${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          origin: "http://localhost",
          "content-type": "application/json",
          "idempotency-key": key,
          cookie: otherCookie ?? cookie,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
    cookie = response.headers.get("set-cookie")?.split(";")[0] ?? otherCookie ?? cookie;
    return { status: response.status, body: await response.json(), cookie };
  }
  return { store, api, call };
}
const config = {
  modo: "treinamento",
  dificuldade: "iniciante",
  perfil: "colaborativo",
  urgencia: "media",
  seed: "TESTE",
};
describe("API persistente e autorizada", () => {
  it("mercado externo persiste; retry preserva, nova seed consulta e avaliação é estática", async () => {
    vi.stubEnv("BUYERLAB_MARKET_PROVIDER", "live");
    const snapshot = {
      ...structuredClone(STATIC_MARKET),
      id: "external-test",
      provider: "BuyerLab live v1",
    };
    const market = vi.spyOn(liveMarket, "getSnapshot").mockResolvedValue(snapshot);
    const { call } = setup();
    const started = await call({
      action: "start",
      config: { ...config, scenarioType: "aluminum" },
    });
    expect(started.status).toBe(200);
    const id = started.body.id;
    const loaded = await call(null, `/api/simulations/${id}`);
    expect(loaded.body.aluminum.instance.market).toEqual(snapshot);
    const retry = await call({ action: "retry", runId: id, sameSeed: true });
    const reloaded = await call(null, `/api/simulations/${retry.body.id}`);
    expect(reloaded.body.aluminum.instance).toEqual(loaded.body.aluminum.instance);
    expect(market).toHaveBeenCalledTimes(1);
    await call({ action: "retry", runId: id, sameSeed: false });
    expect(market).toHaveBeenCalledTimes(2);
    await call({
      action: "start",
      config: { ...config, scenarioType: "aluminum", modo: "avaliacao" },
    });
    expect(market).toHaveBeenCalledTimes(2);
  });
  it("GET /api/market-indicators expõe PTAX, alumínio, índice industrial e projeção", async () => {
    const snapshot = {
      fetchedAt: "2026-09-17T12:00:00.000Z",
      ptax: {
        code: "USD_BRL",
        name: "PTAX USD/BRL",
        value: 5.15,
        buy: 5.14,
        sell: 5.15,
        unit: "BRL/USD",
        date: "2026-09-16",
        source: "Banco Central do Brasil — PTAX",
        url: "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/aplicacao",
        status: "real",
        stale: false,
      },
      aluminum: {
        code: "ALUMINUM",
        name: "Alumínio primário (FMI)",
        value: 3100,
        unit: "USD/t",
        date: "2026-08-01",
        source: "Alpha Vantage — Global Price of Aluminum",
        url: "https://www.alphavantage.co/documentation/#aluminum",
        status: "real",
        stale: false,
      },
      industrial: {
        code: "PIM_PF",
        name: "PIM-PF — Indústria geral (Brasil)",
        value: 105,
        unit: "índice, base 2022=100",
        date: "2026-07-01",
        source: "IBGE — Pesquisa Industrial Mensal (PIM-PF), tabela 8888",
        url: "https://sidra.ibge.gov.br/tabela/8888",
        status: "real",
        stale: false,
      },
      history: [],
      fallbackUsed: false,
      warnings: [],
    };
    const spy = vi.spyOn(marketIndicators, "getSnapshot").mockResolvedValue(snapshot as never);
    const { call } = setup();
    const result = await call(null, "/api/market-indicators");
    expect(result.status).toBe(200);
    expect(result.body).toEqual(snapshot);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("alumínio: troca idempotente, retomada, histórico privado e replay", async () => {
    const { call, store } = setup();
    const started = await call({
      action: "start",
      config: { ...config, scenarioType: "aluminum", materialId: "6061-T6" },
    });
    const id = started.body.id;
    const initial = await call(null, `/api/simulations/${id}`);
    const instance = initial.body.aluminum.instance;
    const suppliers = await call(null, `/api/simulations/${id}/suppliers`);
    expect(suppliers.body).toHaveLength(3);
    expect(JSON.stringify(suppliers.body)).not.toMatch(
      /concessionLadder|privateState|supplierConfigs|"floor"/,
    );
    const contrato = await call(null, `/api/simulations/${id}/contrato`);
    expect(contrato.status).toBe(200);
    expect(contrato.body.scenarioInstanceId).toBe(instance.id);
    expect(contrato.body.supplierName).toBe(suppliers.body[0].displayName);
    expect(contrato.body.totalValue).toBeGreaterThan(0);
    const key = crypto.randomUUID();
    const command = {
      action: "switch",
      runId: id,
      supplierId: suppliers.body[2].id,
      reason: "Comparar capacidade, homologação e custo total da alternativa nacional.",
      expectedTurn: 0,
    };
    const changed = await call(command, undefined, key);
    expect(changed.status).toBe(200);
    expect((await call(command, undefined, key)).body).toEqual(changed.body);
    expect((await call(command)).status).toBe(409);
    const resumed = await call(null, `/api/simulations/${id}`);
    expect(resumed.body.aluminum.instance).toEqual(instance);
    expect(resumed.body.aluminum.switchCount).toBe(1);
    expect(store.db.prepare("SELECT COUNT(*) AS n FROM supplier_switches").get()).toEqual({ n: 1 });
    await call({
      action: "finalize",
      runId: id,
      offer: resumed.body.suggestedOffer,
      accepted: true,
    });
    const history = await call(null, "/api/history");
    expect(history.body.entries).toHaveLength(1);
    expect(history.body.groups[0].count).toBe(1);
    expect((await call(null, `/api/history/${id}`)).body.sourcing.finalSupplier).toBe(
      suppliers.body[2].displayName,
    );
    const same = await call({ action: "retry", runId: id, sameSeed: true });
    expect((await call(null, `/api/simulations/${same.body.id}`)).body.aluminum.instance).toEqual(
      instance,
    );
    const different = await call({ action: "retry", runId: id, sameSeed: false });
    expect(different.body.seed).not.toBe(instance.seed);
    expect((await call(null, "/api/history", undefined, "")).body.entries).toEqual([]);
    expect((await call(null, `/api/history/${id}`)).status).toBe(404);
  });
  for (const modo of ["treinamento", "avaliacao"])
    for (const perfil of ["colaborativo", "analitico", "dominante", "defensivo"])
      it(`jornada API ${modo}/${perfil}: acordo, replay e isolamento de escrita`, async () => {
        const { call } = setup();
        const started = await call({ action: "start", config: { ...config, modo, perfil } });
        const id = started.body.id;
        const messages = [
          "Entendo que mudamos o forecast. Como a capacidade afeta os custos? Temos dados de OTIF de 91%.",
          "Proponho contrato de 18 meses em troca de preço melhor; volume mínimo de 10.000, forecast congelado e pagamento em 15 dias.",
          "Se entendi, em troca de forecast e volume mínimo, proponho revisar o preço usando os dados de OTIF.",
          "Em troca de contrato de 18 meses e pagamento em 15 dias, proponho fechar o pacote com os dados de qualidade.",
          "Resumindo, em troca de volume mínimo e forecast, proponho formalizar o acordo com OTIF 95%.",
        ];
        const states = [];
        for (const [expectedTurn, text] of messages.entries()) {
          const response = await call({ action: "message", runId: id, text, expectedTurn });
          expect(response.status).toBe(200);
          states.push(response.body.snapshot.estadoPublico);
        }
        const denied = await call(
          { action: "notes", runId: id, notes: "intruso" },
          undefined,
          undefined,
          "",
        );
        expect(denied.status).toBe(404);
        // Retorna explicitamente à sessão proprietária após testar outro navegador.
        await call(null, `/api/simulations/${id}`, undefined, started.cookie);
        const offer = {
          ...offerDefaults,
          precoUnitario: 105,
          duracaoMeses: 18,
          forecastCongeladoDias: 60,
          pagamentoDias: 15,
        };
        const key = crypto.randomUUID();
        const command = { action: "finalize", runId: id, offer, accepted: true };
        const final = await call(command, undefined, key);
        expect(final.body).toBe("acordo");
        expect((await call(command, undefined, key)).body).toBe("acordo");
        expect(
          (await call({ action: "message", runId: id, text: "Olá", expectedTurn: 5 })).status,
        ).toBe(409);
        const replay = await call({ action: "retry", runId: id, sameSeed: true });
        expect(replay.body.seed).toBe(config.seed);
        for (const [expectedTurn, text] of messages.entries()) {
          const result = await call({
            action: "message",
            runId: replay.body.id,
            text,
            expectedTurn,
          });
          expect(result.status).toBe(200);
          expect(result.body.snapshot.estadoPublico).toEqual(states[expectedTurn]);
        }
      });
  it("cria, retoma em outro store, idempotência e isolamento", async () => {
    const dir = mkdtempSync(join(tmpdir(), "buyerlab-"));
    paths.push(dir);
    const path = join(dir, "db.sqlite");
    const { call } = setup(path);
    const start = await call({ action: "start", config });
    expect(start.status).toBe(200);
    const id = start.body.id;
    const key = crypto.randomUUID();
    const body = {
      action: "message",
      runId: id,
      text: "Como a capacidade afeta seus custos?",
      expectedTurn: 0,
    };
    const [a, b] = await Promise.all([call(body, undefined, key), call(body, undefined, key)]);
    expect(a.status).toBe(200);
    expect(a.body).toEqual(b.body);
    expect(a.body.snapshot.estadoPublico.turno).toBe(1);
    expect((await call(body)).status).toBe(409);
    const second = setup(path);
    const resumed = await second.call(null, `/api/simulations/${id}`, undefined, start.cookie);
    expect(resumed.body.estadoPublico.turno).toBe(1);
    expect((await second.call(null, `/api/simulations/${id}`, undefined, "")).status).toBe(404);
    expect(JSON.stringify(resumed.body)).not.toMatch(/privateState|confianca|probabilidade|escada/);
  });
  it("aceite explícito no chat encerra o treinamento e já gera o relatório", async () => {
    const { call } = setup();
    const start = await call({ action: "start", config });
    const id = start.body.id;
    await call({ action: "message", runId: id, text: "Olá", expectedTurn: 0 });
    const accept = await call({
      action: "message",
      runId: id,
      text: "Perfeito, aceito a proposta de vocês.",
      expectedTurn: 1,
    });
    expect(accept.status).toBe(200);
    expect(accept.body.snapshot.estadoPublico.encerrada).toBe(true);
    expect(accept.body.snapshot.relatorio).toBeTruthy();
    expect(accept.body.snapshot.propostaFinal).toBeTruthy();
    expect(await call({ action: "evaluate", runId: id })).toMatchObject({ status: 200 });
    expect(
      await call({ action: "message", runId: id, text: "Mais uma mensagem", expectedTurn: 2 }),
    ).toMatchObject({ status: 409 });
    expect(
      (await call({ action: "finalize", runId: id, offer: offerDefaults, accepted: true })).status,
    ).toBe(409);
  });
  it("finaliza uma vez, avalia, compartilha só relatório e repete seeds", async () => {
    const { call } = setup();
    const start = await call({ action: "start", config });
    const id = start.body.id;
    expect((await call({ action: "evaluate", runId: id })).status).toBe(409);
    expect((await call({ action: "share", runId: id })).status).toBe(409);
    await call({ action: "message", runId: id, text: "Olá", expectedTurn: 0 });
    expect(
      (await call({ action: "finalize", runId: id, offer: offerDefaults, accepted: true })).body,
    ).toBe("impasse");
    expect(
      (await call({ action: "finalize", runId: id, offer: offerDefaults, accepted: true })).status,
    ).toBe(409);
    const report = await call({ action: "evaluate", runId: id });
    expect(report.body.avaliacaoProvisoria).toBe(true);
    const share = await call({ action: "share", runId: id });
    const publicReport = await call(null, `/api/reports/${share.body.token}`, undefined, "");
    expect(publicReport.status).toBe(200);
    expect(publicReport.body.anotacoes).toBeUndefined();
    expect((await call(null, "/api/reports/invalid")).status).toBe(404);
    await call(null, `/api/simulations/${id}`, undefined, start.cookie);
    const same = await call({ action: "retry", runId: id, sameSeed: true });
    expect(same.body.seed).toBe("TESTE");
    expect(same.body.id).not.toBe(id);
    const next = await call({ action: "retry", runId: id, sameSeed: false });
    expect(next.body.seed).not.toBe("TESTE");
  });
  it("valida entrada, aceite explícito, CSRF e limite de requisições", async () => {
    const { call, api } = setup();
    const start = await call({ action: "start", config });
    const id = start.body.id;
    expect(
      (await call({ action: "message", runId: id, text: "x".repeat(2001), expectedTurn: 0 }))
        .status,
    ).toBe(400);
    expect(
      (await call({ action: "finalize", runId: id, offer: offerDefaults, accepted: false })).status,
    ).toBe(400);
    expect(
      (
        await api(
          new Request("http://localhost/api/simulations", {
            method: "POST",
            headers: { origin: "https://evil.example", "content-type": "application/json" },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(403);
    let last = 0;
    for (let i = 0; i < 61; i++) last = (await call(null, `/api/simulations/${id}`)).status;
    expect(last).toBe(429);
  });
  it("atrás de proxy reverso, valida origem por X-Forwarded-Proto sem afrouxar o CSRF", async () => {
    // O host publico chega correto via cabecalho Host padrao (refletido na propria URL da
    // requisicao); e o proxy (Cloudflare Tunnel, Railway...) so acrescenta X-Forwarded-Proto,
    // pois a conexao ate o Node e HTTP simples mesmo quando o publico acessa por https.
    const { api } = setup();
    const proxied = (host: string, origin: string, forwardedProto?: string) =>
      api(
        new Request(`http://${host}/api/simulations`, {
          method: "POST",
          headers: {
            origin,
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
            ...(forwardedProto ? { "x-forwarded-proto": forwardedProto } : {}),
          },
          body: JSON.stringify({ action: "start", config }),
        }),
      );
    const host = "meu-tunel.trycloudflare.com";
    expect((await proxied(host, `https://${host}`, "https")).status).toBe(200);
    expect((await proxied(host, `http://${host}`, "https")).status).toBe(403);
    expect((await proxied(host, "https://evil.example", "https")).status).toBe(403);
    expect((await proxied(host, `https://${host}`)).status).toBe(403);
  });
  it("falha do provedor preserva turno e gera relatório provisório", async () => {
    class Broken extends MockSimulationProvider {
      override async reply(): Promise<never> {
        throw Error("API indisponível");
      }
      override async evaluate(): Promise<never> {
        throw Error("JSON inválido");
      }
    }
    const { call } = setup(":memory:", new Broken());
    const start = await call({ action: "start", config });
    const id = start.body.id;
    const result = await call({
      action: "message",
      runId: id,
      text: "Como a capacidade afeta os custos?",
      expectedTurn: 0,
    });
    expect(result.status).toBe(200);
    expect(result.body.snapshot.mensagens.length).toBe(3);
    await call({ action: "finalize", runId: id, offer: offerDefaults, accepted: true });
    const report = await call({ action: "evaluate", runId: id });
    expect(report.body.avaliacaoProvisoria).toBe(true);
  });
  it("mensagem neutra aciona classify() do provedor de IA; texto com tag do regex não aciona", async () => {
    let classifyCalls = 0;
    class FakeAIProvider implements SupplierProvider {
      async reply(): Promise<{ supplierMessage: string; proposedPrice: null }> {
        return {
          supplierMessage: "Vamos avançar com transparência sobre os termos.",
          proposedPrice: null,
        };
      }
      async evaluate(): Promise<CompetencyScore[]> {
        return [];
      }
      async classify(): Promise<BuyerActionTag[]> {
        classifyCalls++;
        return ["diagnostico", "pergunta_aberta"];
      }
    }
    const { call } = setup(":memory:", new FakeAIProvider());
    const start = await call({ action: "start", config });
    const id = start.body.id;
    // Texto sem nenhuma palavra-chave do regex: classifyBuyerMessage retorna só "neutro".
    const neutral = await call({
      action: "message",
      runId: id,
      text: "Bom dia. Vamos conversar sobre isso.",
      expectedTurn: 0,
    });
    expect(neutral.status).toBe(200);
    expect(classifyCalls).toBe(1);
    // "Proponho" já é reconhecido pelo regex (tag "proposta"): não precisa enriquecer com IA.
    const withTag = await call({
      action: "message",
      runId: id,
      text: "Proponho um novo prazo de entrega para o pedido.",
      expectedTurn: 1,
    });
    expect(withTag.status).toBe(200);
    expect(classifyCalls).toBe(1);
  });
});
