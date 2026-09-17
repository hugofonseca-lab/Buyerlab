import { afterEach, describe, expect, it, vi } from "vitest";
import { createRun, advance } from "../src/server/engine.server";
import { computeEnvelope } from "../src/server/concession.server";
import { scoreQualitative } from "../src/server/qualitative.server";
import {
  GeminiSimulationProvider,
  MockSimulationProvider,
  configuredProvider,
} from "../src/server/providers.server";
import type { RunConfig } from "../src/domain/types";

const config: RunConfig = {
  scenarioType: "aluminum",
  materialId: "6061-T6",
  modo: "treinamento",
  dificuldade: "iniciante",
  perfil: "colaborativo",
  urgencia: "baixa",
  seed: "GEMINI-TESTE",
};
function internalClientOf(provider: GeminiSimulationProvider) {
  return provider as unknown as {
    client: {
      models: {
        generateContent: (input: {
          model: string;
          contents: string;
          config: {
            systemInstruction: string;
            responseMimeType: string;
            responseJsonSchema: unknown;
          };
        }) => Promise<{ text: string }>;
      };
    };
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("provedor Gemini", () => {
  it("reply: monta contexto compartilhado, exige schema JSON e valida a saída", async () => {
    const run = createRun(config);
    const provider = new GeminiSimulationProvider("modelo-teste", "chave-ficticia");
    const internal = internalClientOf(provider);
    const generateContent = vi.spyOn(internal.client.models, "generateContent").mockResolvedValue({
      text: JSON.stringify({
        activeSupplierId: run.aluminum!.activeSupplierId,
        supplierMessage: "Vamos avaliar prioridades e prazos com transparência.",
        tone: "cordial",
        detectedBuyerActions: [],
        proposedPrice: run.estadoPublico.ofertaPublica.precoUnitario,
        disclosedInformationIds: [],
        dealStatus: "negociando",
        eventAcknowledgement: null,
        safetyFlags: [],
      }),
    });
    const message = await provider.reply(run, [], computeEnvelope(run, []));
    expect(message.supplierMessage).toContain("prioridades");
    expect(generateContent).toHaveBeenCalledTimes(1);
    const call = generateContent.mock.calls[0]![0];
    expect(call.model).toBe("modelo-teste");
    expect(call.config.responseMimeType).toBe("application/json");
    expect(call.config.responseJsonSchema).toMatchObject({
      type: "object",
      required: expect.arrayContaining(["supplierMessage", "activeSupplierId"]),
    });
    const payload = JSON.parse(call.contents);
    expect(payload.activeSupplierId).toBe(run.aluminum!.activeSupplierId);
  });
  it("evaluate: retorna critérios validados a partir do JSON do Gemini", async () => {
    const run = createRun(config);
    advance(run, "Quais custos e prazos justificam essa proposta? Aguardo dados concretos.");
    const provider = new GeminiSimulationProvider("modelo-teste", "chave-ficticia");
    const internal = internalClientOf(provider);
    const reference = scoreQualitative(run);
    vi.spyOn(internal.client.models, "generateContent").mockResolvedValue({
      text: JSON.stringify({
        criteria: reference.map((c) => ({
          id: c.id,
          points: 0,
          evidence: [],
          impact: "Nenhuma evidência citável foi encontrada nas mensagens do comprador.",
          recommendation: "Cite trechos concretos das próprias mensagens na próxima tentativa.",
        })),
      }),
    });
    // Sem evidência válida, cada critério deve zerar em vez de lançar.
    const result = await provider.evaluate(run);
    expect(result.length).toBe(reference.length);
    expect(result.every((c) => c.pontos === 0)).toBe(true);
  });
  it("classify: usa o mesmo vocabulário fechado de tags do regex", async () => {
    const run = createRun(config);
    const provider = new GeminiSimulationProvider("modelo-teste", "chave-ficticia");
    const internal = internalClientOf(provider);
    vi.spyOn(internal.client.models, "generateContent").mockResolvedValue({
      text: JSON.stringify({ tags: ["ancoragem", "troca_condicional"] }),
    });
    const tags = await provider.classify(
      run,
      "Partimos de um valor referência, condicionado a volume.",
    );
    expect(tags).toEqual(["ancoragem", "troca_condicional"]);
  });
  it("classify: tag fora do vocabulário fechado é rejeitada (esquema fecha o conjunto)", async () => {
    const run = createRun(config);
    const provider = new GeminiSimulationProvider("modelo-teste", "chave-ficticia");
    const internal = internalClientOf(provider);
    vi.spyOn(internal.client.models, "generateContent").mockResolvedValue({
      text: JSON.stringify({ tags: ["inventada_pela_ia"] }),
    });
    await expect(provider.classify(run, "qualquer coisa")).rejects.toThrow();
  });
  it("resposta vazia ou fora do schema não quebra o processo (erro tratado por withFallback no chamador)", async () => {
    const run = createRun(config);
    const provider = new GeminiSimulationProvider("modelo-teste", "chave-ficticia");
    const internal = internalClientOf(provider);
    vi.spyOn(internal.client.models, "generateContent").mockResolvedValue({ text: "" });
    await expect(provider.reply(run, [], computeEnvelope(run, []))).rejects.toThrow();
  });
  it("configuredProvider: BUYERLAB_PROVIDER=gemini seleciona Gemini só com as duas variáveis", () => {
    vi.stubEnv("BUYERLAB_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GEMINI_MODEL", "");
    expect(configuredProvider()).toBeInstanceOf(MockSimulationProvider);
    vi.stubEnv("GEMINI_API_KEY", "chave-ficticia");
    vi.stubEnv("GEMINI_MODEL", "modelo-teste");
    expect(configuredProvider()).toBeInstanceOf(GeminiSimulationProvider);
  });
  it("configuredProvider: BUYERLAB_PROVIDER=mock nunca escolhe Gemini mesmo com chaves presentes", () => {
    vi.stubEnv("BUYERLAB_PROVIDER", "mock");
    vi.stubEnv("GEMINI_API_KEY", "chave-ficticia");
    vi.stubEnv("GEMINI_MODEL", "modelo-teste");
    expect(configuredProvider()).toBeInstanceOf(MockSimulationProvider);
  });
});
