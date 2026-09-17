import { expect, it } from "vitest";
import { createRun, advance } from "../src/server/engine.server";
import { computeEnvelope } from "../src/server/concession.server";
import { validateActor, validateQualitative } from "../src/server/providers.server";
import { scoreQualitative } from "../src/server/qualitative.server";

const run = () =>
  createRun({
    modo: "treinamento",
    dificuldade: "iniciante",
    perfil: "colaborativo",
    urgencia: "media",
    seed: "VALIDATION",
  });
it("ator rejeita preço acima do permitido, revelação fora da lista e frase de aceite; clampa abaixo do mínimo do turno", () => {
  const r = run();
  const envelope = computeEnvelope(r, []);
  const valid = {
    supplierMessage: "Vamos discutir os interesses da Orion.",
    tone: "cordial",
    detectedBuyerActions: [],
    proposedPrice: envelope.price.current,
    disclosedInformationIds: [],
    dealStatus: "negociando",
    eventAcknowledgement: null,
    safetyFlags: [],
  };
  expect(validateActor(valid, r, envelope).supplierMessage).toBe(valid.supplierMessage);
  expect(() =>
    validateActor({ ...valid, proposedPrice: envelope.price.current + 1 }, r, envelope),
  ).toThrow();
  expect(
    validateActor({ ...valid, proposedPrice: envelope.price.min - 1 }, r, envelope).proposedPrice,
  ).toBe(envelope.price.min);
  expect(() =>
    validateActor({ ...valid, disclosedInformationIds: ["floor"] }, r, envelope),
  ).toThrow();
  expect(() => validateActor({ ...valid, supplierMessage: "Aceito R$90" }, r, envelope)).toThrow();
});
it("qualitativa exige mensagens existentes, trechos literais, limites e justificativa específica", () => {
  const r = run();
  advance(r, "Como a capacidade afeta os custos?");
  const m = r.mensagens.at(-1)!;
  const criteria = scoreQualitative(r).map((c) => ({
    id: c.id,
    points: 1,
    evidence: [{ messageId: m.id, excerpt: m.texto }],
    impact: "A pergunta sobre capacidade abriu investigação dos custos da Nexa.",
    recommendation: "Investigue quais compromissos de forecast reduzem esses custos.",
  }));
  expect(validateQualitative({ criteria }, r).reduce((n, c) => n + c.pontos, 0)).toBe(5);
  expect(
    validateQualitative({ criteria: criteria.map((c) => ({ ...c, evidence: [] })) }, r).every(
      (c) => c.pontos === 0,
    ),
  ).toBe(true);
  expect(() =>
    validateQualitative({ criteria: criteria.map((c) => ({ ...c, points: 100 })) }, r),
  ).toThrow();
  expect(() =>
    validateQualitative(
      {
        criteria: criteria.map((c) => ({
          ...c,
          evidence: [{ messageId: "inexistente", excerpt: m.texto }],
        })),
      },
      r,
    ),
  ).toThrow();
  expect(() =>
    validateQualitative(
      {
        criteria: criteria.map((c) => ({
          ...c,
          evidence: [{ messageId: m.id, excerpt: "trecho fabricado" }],
        })),
      },
      r,
    ),
  ).toThrow();
  expect(() =>
    validateQualitative(
      {
        criteria: criteria.map((c) => ({
          ...c,
          impact: "Bom desempenho em toda a negociação; parabéns.",
        })),
      },
      r,
    ),
  ).toThrow();
});
