import { z } from "zod";
export const configSchema = z
  .object({
    scenarioType: z.enum(["aluminum", "legacy"]).optional(),
    materialId: z.enum(["5052-H32", "6061-T6", "7075-T6"]).optional(),
    modo: z.enum(["treinamento", "avaliacao"]),
    dificuldade: z.enum(["iniciante", "intermediario", "avancado"]),
    perfil: z.enum(["aleatorio", "colaborativo", "analitico", "dominante", "defensivo"]),
    urgencia: z.enum(["baixa", "media", "alta"]),
    seed: z
      .string()
      .trim()
      .min(1)
      .max(24)
      .regex(/^[A-Za-z0-9_-]+$/),
    buyerName: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[\p{L}\s'-]+$/u)
      .optional(),
  })
  .strict();
const integer = (min: number, max: number) => z.number().int().min(min).max(max);
export const offerSchema = z
  .object({
    precoUnitario: z.number().finite().min(1).max(100000),
    volumeMinimoMensal: integer(1, 100000),
    duracaoMeses: integer(1, 24),
    leadTimeDias: integer(1, 60),
    pagamentoDias: integer(1, 90),
    otifMeta: z.number().min(0).max(100),
    limiteDefeitos: z.number().min(0).max(100),
    creditosSla: z.boolean(),
    garantiaMeses: integer(0, 60),
    planoContingencia: z.boolean(),
    segundaFonteGradual: z.boolean(),
    estoqueSeguranca: z.boolean(),
    prioridadeProducao: z.boolean(),
    forecastCongeladoDias: integer(0, 90),
    revisoesPeriodicas: z.boolean(),
    contrapartidas: z.string().max(2000),
    observacoes: z.string().max(2000),
  })
  .strict();
export const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("switch"),
      runId: z.string().uuid(),
      supplierId: z.string().min(1).max(100),
      reason: z.string().trim().min(12).max(500),
      expectedTurn: integer(0, 12),
    })
    .strict(),
  z.object({ action: z.literal("start"), config: configSchema }).strict(),
  z
    .object({
      action: z.literal("message"),
      runId: z.string().uuid(),
      text: z.string().trim().min(1).max(2000),
      expectedTurn: integer(0, 12),
      forceMock: z.boolean().optional(),
    })
    .strict(),
  z
    .object({ action: z.literal("notes"), runId: z.string().uuid(), notes: z.string().max(8000) })
    .strict(),
  z
    .object({
      action: z.literal("finalize"),
      runId: z.string().uuid(),
      offer: offerSchema,
      accepted: z.literal(true),
    })
    .strict(),
  z
    .object({ action: z.literal("retry"), runId: z.string().uuid(), sameSeed: z.boolean() })
    .strict(),
  z.object({ action: z.literal("share"), runId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("evaluate"), runId: z.string().uuid() }).strict(),
]);
