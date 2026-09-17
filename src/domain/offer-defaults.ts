import type { StructuredFinalOffer } from "./types";
/** Proposta inicial editável do comprador, sem limites privados. */
export const offerDefaults: StructuredFinalOffer = {
  precoUnitario: 107,
  volumeMinimoMensal: 10000,
  duracaoMeses: 12,
  leadTimeDias: 12,
  pagamentoDias: 30,
  otifMeta: 95,
  limiteDefeitos: 1,
  creditosSla: true,
  garantiaMeses: 18,
  planoContingencia: true,
  segundaFonteGradual: true,
  estoqueSeguranca: true,
  prioridadeProducao: true,
  forecastCongeladoDias: 30,
  revisoesPeriodicas: true,
  contrapartidas: "Volume mínimo mensal e forecast congelado por 30 dias.",
  observacoes: "",
};
