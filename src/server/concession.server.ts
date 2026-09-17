import type { BuyerActionTag, ConcessionEnvelope } from "../domain/types";
import type { StoredRun } from "./model";
import { contextFor } from "./aluminum.server";

/** Uma linha da escada de pacotes (preço + contrapartidas), a mesma forma de `rules.packages`. */
export interface PackageRow {
  price: number;
  months: number;
  volume: number;
  forecast: number;
  payment: number;
}

const CONSTRUCTIVE_TAGS: BuyerActionTag[] = [
  "diagnostico",
  "uso_de_dados",
  "troca_condicional",
  "proposta",
];
const UNSAFE_TAGS: BuyerActionTag[] = ["ameaca", "antietico", "concessao_unilateral"];

const clampUnit = (n: number) => Math.max(0, Math.min(1, n));

function segment(rows: readonly PackageRow[], depth: number) {
  const steps = rows.length - 1;
  const scaled = clampUnit(depth) * steps;
  const i = Math.min(steps - 1, Math.floor(scaled));
  return { i, t: scaled - i };
}

function interpolate(rows: readonly PackageRow[], depth: number, key: keyof PackageRow): number {
  const { i, t } = segment(rows, depth);
  const a = rows[i]![key],
    b = rows[i + 1]![key];
  return a + (b - a) * t;
}

/** Interpola o preço da escada de pacotes numa profundidade contínua 0 (inicial) .. 1 (piso). */
export function priceAt(rows: readonly PackageRow[], depth: number): number {
  return interpolate(rows, depth, "price");
}

/** Interpola os termos (prazo/volume/forecast/pagamento) na mesma profundidade contínua. */
export function termsAt(rows: readonly PackageRow[], depth: number) {
  return {
    duracaoMeses: interpolate(rows, depth, "months"),
    volumeMinimoMensal: interpolate(rows, depth, "volume"),
    forecastCongeladoDias: interpolate(rows, depth, "forecast"),
    pagamentoDias: interpolate(rows, depth, "payment"),
  };
}

/** Inverso de priceAt: dado um preço, encontra a profundidade equivalente (clampada a 0..1). */
export function depthFromPrice(rows: readonly PackageRow[], price: number): number {
  const steps = rows.length - 1;
  if (price >= rows[0]!.price) return 0;
  if (price <= rows.at(-1)!.price) return 1;
  for (let i = 0; i < steps; i++) {
    const hi = rows[i]!.price,
      lo = rows[i + 1]!.price;
    if (price <= hi && price >= lo) {
      const t = hi === lo ? 0 : (hi - price) / (hi - lo);
      return clampUnit((i + t) / steps);
    }
  }
  return 1;
}

/**
 * Transforma limiares por degrau (ex.: confiancaMinima, contrapartidasMinimas) numa rampa
 * contínua 0..1: quanto de profundidade de concessão o valor atual já libera.
 */
export function ceilingFromThreshold(thresholds: readonly number[], value: number): number {
  const steps = thresholds.length - 1;
  const points: { x: number; y: number }[] = [];
  thresholds.forEach((x, i) => {
    const y = i / steps;
    const existing = points.find((p) => p.x === x);
    if (existing) existing.y = Math.max(existing.y, y);
    else points.push({ x, y });
  });
  points.sort((a, b) => a.x - b.x);
  if (value <= points[0]!.x) return points[0]!.y;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!,
      b = points[i + 1]!;
    if (value >= a.x && value <= b.x) {
      const t = b.x === a.x ? 1 : (value - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return points.at(-1)!.y;
}

/**
 * Calcula, para o turno atual, os limites dentro dos quais a IA (ou o mock) pode propor um novo
 * preço. Equivalente contínuo do antigo `canAdvance` por degrau: mesmos portões de confiança,
 * reciprocidade e argumento crível, mais um passo máximo por turno para evitar que a confiança já
 * acumulada libere o piso de uma vez.
 */
export function computeEnvelope(stored: StoredRun, tags: BuyerActionTag[]): ConcessionEnvelope {
  const { rules, blueprint } = contextFor(stored);
  const rows = rules.packages as PackageRow[];
  const s = stored.privateState;
  const currentDepth = s.concessionDepth;
  const steps = blueprint.escada.length - 1;

  const all = new Set([
    ...stored.mensagens
      .filter((m) => !stored.aluminum || m.supplierId === stored.aluminum.activeSupplierId)
      .flatMap((m) => m.acoes ?? []),
    ...tags,
  ]);
  const hasArgument = all.has("diagnostico") || all.has("uso_de_dados");
  const hasReciprocity = all.has("troca_condicional");

  const lastIndexWhere = (predicate: (step: (typeof blueprint.escada)[number]) => boolean) => {
    for (let i = blueprint.escada.length - 1; i >= 0; i--)
      if (predicate(blueprint.escada[i]!)) return i;
    return -1;
  };
  const argumentGateDepth = hasArgument
    ? 1
    : lastIndexWhere((step) => !step.exigeArgumentoCrivel) / steps;
  const reciprocityGateDepth = hasReciprocity
    ? 1
    : lastIndexWhere((step) => !step.exigeReciprocidade) / steps;
  const trustCeiling = ceilingFromThreshold(
    blueprint.escada.map((a) => a.confiancaMinima),
    s.confianca,
  );
  const reciprocityCeiling = ceilingFromThreshold(
    blueprint.escada.map((a) => a.contrapartidasMinimas),
    s.contrapartidas.length,
  );

  const unsafe = tags.some((t) => UNSAFE_TAGS.includes(t)) || s.frustracao >= 80 || s.abertura < 25;
  const depthCeiling = unsafe
    ? currentDepth
    : Math.min(trustCeiling, reciprocityCeiling, argumentGateDepth, reciprocityGateDepth);

  const pacing = rules.concessionPacing[stored.run.dificuldade];
  const constructive = tags.some((t) => CONSTRUCTIVE_TAGS.includes(t));
  let step = 0;
  if (constructive && !unsafe) {
    step = pacing.baseStep;
    if (hasArgument) step += pacing.argumentBonus;
    if (hasReciprocity) step += pacing.reciprocityBonus;
    step = Math.min(pacing.maxStep, step);
  }
  const maxDepthThisTurn = Math.max(currentDepth, Math.min(depthCeiling, currentDepth + step));

  const priceNow = priceAt(rows, currentDepth);
  const priceFloorThisTurn = priceAt(rows, maxDepthThisTurn);

  return {
    currentDepth,
    maxDepthThisTurn,
    blocked: unsafe,
    price: {
      current: priceNow,
      min: priceFloorThisTurn,
      max: priceNow,
      floor: rules.floor,
      initial: rules.initialOffer.precoUnitario,
    },
  };
}
