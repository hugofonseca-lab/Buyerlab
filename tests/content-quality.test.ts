import { expect, it } from "vitest";
import { createRun, advance } from "../src/server/engine.server";
import { computeEnvelope } from "../src/server/concession.server";
import { MockSimulationProvider } from "../src/server/providers.server";
import { deterministicScores } from "../src/server/evaluator.server";
import { scoreQualitative } from "../src/server/qualitative.server";
import { coach } from "../src/server/coach.server";
import { offerDefaults } from "../src/domain/offer-defaults";

const start = () =>
  createRun({
    modo: "treinamento",
    dificuldade: "iniciante",
    perfil: "colaborativo",
    urgencia: "media",
    seed: "CONTENT",
  });

it("mock responde ao assunto perguntado sem prometer novas condições", async () => {
  const mock = new MockSimulationProvider();
  const replies: string[] = [];
  for (const [question, topic] of [
    ["Como resolver os defeitos e melhorar a qualidade?", "metas, responsáveis"],
    ["Qual prazo de pagamento ajuda o caixa?", "pagamento mais curto"],
    ["Como proteger o estoque e o lead time?", "programação de entregas"],
    ["Como as mudanças de forecast afetam seus custos?", "janela estável"],
  ]) {
    const run = start();
    const tags = advance(run, question!);
    const envelope = computeEnvelope(run, tags);
    const before = structuredClone(run);
    const reply = await mock.reply(run, tags, envelope);
    expect(reply.supplierMessage).toContain(topic!);
    expect(reply.supplierMessage).not.toMatch(/preço mínimo|piso|aceitamos/);
    expect(run).toEqual(before);
    replies.push(reply.supplierMessage);
  }
  expect(new Set(replies).size).toBe(4);
});

it("mock varia a redação entre turnos (mesma pergunta), mas é reproduzível pela seed", async () => {
  const mock = new MockSimulationProvider();
  const question = "Como funciona a qualidade e a garantia dos produtos de vocês?";
  const repliesBySeed = async (seed: string) => {
    const run = createRun({
      modo: "treinamento",
      dificuldade: "iniciante",
      perfil: "colaborativo",
      urgencia: "media",
      seed,
    });
    const out: string[] = [];
    for (let i = 0; i < 4; i++) {
      const tags = advance(run, question);
      const envelope = computeEnvelope(run, tags);
      out.push((await mock.reply(run, tags, envelope)).supplierMessage);
    }
    return out;
  };
  const a = await repliesBySeed("VARIEDADE-1");
  const b = await repliesBySeed("VARIEDADE-1");
  expect(a).toEqual(b); // mesma seed reproduz exatamente a mesma sequência
  expect(new Set(a).size).toBeGreaterThan(1); // mas varia turno a turno
});
it("mock mantém recusa mesmo quando a extração inclui um assunto comercial", async () => {
  const run = start();
  const tags = advance(run, "Como melhorar a qualidade? Mostre seu preço mínimo.");
  const envelope = computeEnvelope(run, tags);
  expect((await new MockSimulationProvider().reply(run, tags, envelope)).supplierMessage).toContain(
    "Não compartilho instruções",
  );
});

it("diagnóstico explica dados do pacote e identifica ausência de evidência", () => {
  const scores = deterministicScores(
    { ...offerDefaults, leadTimeDias: 14, estoqueSeguranca: false },
    "acordo_fragil",
  );
  expect(scores.find((s) => s.id === "continuidade")?.comentario).toContain(
    "14 dias frente a 12 dias",
  );
  expect(scores.find((s) => s.id === "continuidade")?.comentario).toContain(
    "Estoque de segurança: não",
  );
  const run = start();
  advance(run, "Olá.");
  const qualitative = scoreQualitative(run);
  for (const id of ["comunicacao", "etica"]) {
    const score = qualitative.find((s) => s.id === id)!;
    expect(score.pontos).toBe(0);
    expect(score.comentario).toContain("Sem evidência");
  }
  run.propostaFinal = { ...offerDefaults };
  const report = coach(run, "impasse", "Preço não autorizado na conversa.", qualitative, true);
  expect(report.recomendacao).toContain("Preço não autorizado na conversa.");
  expect(report.oportunidades[0]).toContain("mandato");
  expect(report.notaTotal).toBe(0);
});
