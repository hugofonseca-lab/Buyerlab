import type {
  BuyerActionTag,
  NegotiationMessage,
  PrivateNegotiationState,
  RunConfig,
  RunSnapshot,
  SupplierProfile,
} from "../domain/types";
import { createRng, pick } from "../lib/prng";
import { classifyBuyerMessage, extractRelevantCounterparts } from "../simulation/classifier";
import { blueprint } from "./scenario.server";
import { deltas, emotions, ENGINE_VERSION, profileWeights, rules } from "./rules.server";
import type { StoredRun } from "./model";
import { activeSupplier, contextFor, generateAluminum, publicBlueprint } from "./aluminum.server";
import { sourcingCost } from "./sourcing-score.server";

export const clamp = (n: number) => Math.max(0, Math.min(100, n));
const profiles: SupplierProfile[] = ["colaborativo", "analitico", "dominante", "defensivo"];
export function publicSnapshot(stored: StoredRun): RunSnapshot {
  const result: RunSnapshot = {
    provedor: stored.providerMode,
    run: stored.run,
    estadoPublico: stored.estadoPublico,
    mensagens: stored.mensagens.map(({ acoes: _actions, ...message }) => message),
    anotacoes: stored.anotacoes,
  };
  if (stored.propostaFinal) result.propostaFinal = stored.propostaFinal;
  if (stored.relatorio) result.relatorio = stored.relatorio;
  if (stored.aluminum) {
    result.aluminum = {
      ...stored.aluminum,
      activeEstimate: sourcingCost(
        stored,
        activeSupplier(stored)!,
        stored.estadoPublico.ofertaPublica.precoUnitario,
        true,
      ),
    };
    const pack = contextFor(stored).rules.packages[stored.privateState.degrau]!;
    result.suggestedOffer = {
      ...stored.aluminum.blueprint.ofertaInicialComprador,
      precoUnitario: pack.price,
      volumeMinimoMensal: pack.volume,
      duracaoMeses: Math.max(12, pack.months),
      forecastCongeladoDias: Math.max(30, pack.forecast),
      pagamentoDias: pack.payment,
      contrapartidas: stored.estadoPublico.ofertaPublica.contrapartidas.join("; "),
    };
  }
  return structuredClone(result);
}
export function makeMessage(
  stored: StoredRun,
  autor: NegotiationMessage["autor"],
  texto: string,
  acoes?: BuyerActionTag[],
): NegotiationMessage {
  return {
    ...(stored.aluminum
      ? {
          supplierId: stored.aluminum.activeSupplierId,
          supplierName: activeSupplier(stored)!.displayName,
        }
      : {}),
    id: `${stored.run.id}:${stored.estadoPublico.turno}:${autor}`,
    turno: stored.estadoPublico.turno,
    autor,
    texto,
    criadoEm: new Date().toISOString(),
    ...(acoes ? { acoes } : {}),
  };
}
export function createRun(
  input: RunConfig,
  market?: import("../domain/aluminum").MarketSnapshot,
): StoredRun {
  const config = { ...input };
  // A seed de avaliação define também as condições, independentemente dos seletores.
  if (config.modo === "avaliacao")
    Object.assign(config, { dificuldade: "intermediario", urgencia: "media", perfil: "aleatorio" });
  const rng = createRng(config.seed, "initial-v2");
  const profile = config.perfil === "aleatorio" ? pick(rng, profiles) : config.perfil;
  const state: PrivateNegotiationState = {
    perfil: profile,
    confianca: Math.round(45 + rng() * 12) + rules.difficultyTrust[config.dificuldade],
    frustracao: Math.round(25 + rng() * 15),
    abertura: Math.round(40 + rng() * 15),
    pressao: config.urgencia === "alta" ? 76 : config.urgencia === "media" ? 58 : 40,
    percepcaoDePoder: Math.round(58 + rng() * 18),
    aversaoRisco: Math.round(42 + rng() * 30),
    orientacaoRelacionamento: Math.round(45 + rng() * 30),
    degrau: 0,
    contrapartidas: [],
    turnosSemAvanco: 0,
    eventosOcorridos: [],
    tentativasIndevidas: 0,
  };
  const stored: StoredRun = {
    run: {
      id: crypto.randomUUID(),
      cenarioId: blueprint.id,
      cenarioVersao: blueprint.versao,
      engineVersao: ENGINE_VERSION,
      seed: config.seed,
      modo: config.modo,
      dificuldade: config.dificuldade,
      urgencia: config.urgencia,
      perfilSolicitado: config.perfil,
      criadoEm: new Date().toISOString(),
      status: "preparacao",
    },
    estadoPublico: {
      turno: 0,
      turnosMaximos: rules.turns[config.dificuldade],
      ofertaPublica: structuredClone(rules.initialOffer),
      eventos: [],
      encerrada: false,
    },
    mensagens: [],
    anotacoes: "",
    privateState: state,
    config,
    audit: [],
    disclosures: [],
    providerMode: "mock",
  };
  if (config.scenarioType === "aluminum") {
    Object.assign(stored, generateAluminum(config, state, market));
    stored.run.cenarioId = stored.aluminum!.instance.templateId;
    stored.run.cenarioVersao = stored.aluminum!.instance.templateVersion;
    stored.run.engineVersao = "aluminum-1.0.0";
    stored.privateState = structuredClone(
      stored.sourcingPrivate!.states[stored.aluminum!.activeSupplierId]!,
    );
    stored.estadoPublico.ofertaPublica = structuredClone(contextFor(stored).rules.initialOffer);
  }
  stored.mensagens.push(
    makeMessage(
      stored,
      "fornecedor",
      stored.aluminum
        ? `Bom dia. Represento ${activeSupplier(stored)!.displayName}. Vamos negociar ${stored.aluminum.instance.material.name}, em BRL por tonelada. Consulte nossa proposta e as condições no painel. Quais são as prioridades da Orion?`
        : `Bom dia. Sou Marina Costa, da Nexa Componentes. Nossa proposta para o Módulo K-17 é R$ ${rules.initialOffer.precoUnitario},00 por unidade. Precisamos tratar também das mudanças tardias de forecast. Quais são as prioridades da Orion?`,
    ),
  );
  return stored;
}
export function evolve(stored: StoredRun, tags: BuyerActionTag[], counterparts: string[]): void {
  const state = stored.privateState;
  for (const tag of tags) {
    for (const emotion of emotions) {
      const delta = deltas[tag]?.[emotion] ?? 0;
      const weight = profileWeights[state.perfil][tag] ?? 1;
      state[emotion] = clamp(state[emotion] + delta * weight);
    }
  }
  if (stored.run.modo === "treinamento") {
    const noise = createRng(stored.run.seed, `noise-${stored.estadoPublico.turno}`);
    for (const emotion of emotions)
      state[emotion] = clamp(state[emotion] + Math.round(noise() * 2 - 1));
  }
  if (tags.includes("antietico")) state.tentativasIndevidas++;
  if (!tags.includes("antietico") && tags.includes("troca_condicional")) {
    state.contrapartidas = [...new Set([...state.contrapartidas, ...counterparts])];
  }
}
export function canAdvance(stored: StoredRun, tags: BuyerActionTag[]): boolean {
  const { blueprint } = contextFor(stored);
  const s = stored.privateState;
  const next = blueprint.escada[s.degrau + 1];
  if (!next || tags.some((t) => ["ameaca", "antietico", "concessao_unilateral"].includes(t)))
    return false;
  if (
    !tags.some((t) => ["diagnostico", "uso_de_dados", "troca_condicional", "proposta"].includes(t))
  )
    return false;
  const all = new Set([
    ...stored.mensagens
      .filter((m) => !stored.aluminum || m.supplierId === stored.aluminum.activeSupplierId)
      .flatMap((m) => m.acoes ?? []),
    ...tags,
  ]);
  return (
    (!next.exigeArgumentoCrivel || all.has("diagnostico") || all.has("uso_de_dados")) &&
    (!next.exigeReciprocidade || all.has("troca_condicional")) &&
    s.confianca >= next.confiancaMinima &&
    s.frustracao < 80 &&
    s.abertura >= 25 &&
    s.contrapartidas.length >= next.contrapartidasMinimas
  );
}
export function maybeEvent(stored: StoredRun): void {
  const { blueprint, rules } = contextFor(stored);
  const s = stored.privateState,
    turn = stored.estadoPublico.turno;
  const evaluation = stored.run.modo === "avaliacao";
  if (stored.estadoPublico.eventos.length >= (evaluation ? 1 : 2)) return;
  for (const event of [...blueprint.eventos].sort(
    (a, b) =>
      rules.eventPolicies[b.id as keyof typeof rules.eventPolicies].priority -
      rules.eventPolicies[a.id as keyof typeof rules.eventPolicies].priority,
  )) {
    if (
      turn < event.turnoMinimo ||
      turn > rules.eventWindowEnd ||
      stored.estadoPublico.eventos.some((e) => e.id === event.id)
    )
      continue;
    if (evaluation && (turn !== 3 || event.id !== "atraso_logistico")) continue;
    if (event.prerequisito === "sem_avanco" && s.turnosSemAvanco < 2) continue;
    if (event.prerequisito === "proximo_do_acordo" && s.degrau < 3) continue;
    if (event.prerequisito === "demora" && turn < 5 && s.turnosSemAvanco < 2) continue;
    const policy = rules.eventPolicies[event.id as keyof typeof rules.eventPolicies];
    if (
      policy.incompatible.some(
        (id) =>
          s.eventosOcorridos.includes(id) || stored.estadoPublico.eventos.some((e) => e.id === id),
      )
    )
      continue;
    const probability = evaluation
      ? 1
      : Math.min(
          0.75,
          event.probabilidade + (s.pressao > policy.pressureThreshold ? policy.modifier : 0),
        );
    const draw = createRng(stored.run.seed, `event-${turn}-${event.id}`)();
    stored.audit.push({
      id: event.id,
      turno: turn,
      probabilidade: probability,
      sorteio: draw,
      ocorreu: draw < probability,
    });
    if (draw >= probability) continue;
    s.eventosOcorridos.push(event.id);
    if (event.efeito === "pressao") s.pressao = clamp(s.pressao + policy.delta);
    if (event.efeito === "poder_fornecedor")
      s.percepcaoDePoder = clamp(s.percepcaoDePoder + policy.delta);
    if (event.efeito === "abertura") s.abertura = clamp(s.abertura + policy.delta);
    if (event.efeito === "informacao")
      s.percepcaoDePoder = clamp(s.percepcaoDePoder + policy.delta);
    stored.estadoPublico.eventos.push({
      id: event.id,
      ...(stored.aluminum ? { supplierId: stored.aluminum.activeSupplierId } : {}),
      turno: turn,
      titulo: event.titulo,
      descricao: event.descricao,
    });
    stored.mensagens.push(makeMessage(stored, "sistema", `${event.titulo}: ${event.descricao}`));
    break;
  }
}
/**
 * Avança o estado a partir de tags já decididas (regex ou, quando configurado, um classificador
 * de IA restrito ao mesmo vocabulário fechado de BuyerActionTag — ver classify() em
 * providers.server.ts). O motor continua sendo o único a decidir estado a partir das tags; só a
 * origem da classificação pode variar.
 */
export function advanceWithTags(
  stored: StoredRun,
  text: string,
  tags: BuyerActionTag[],
): BuyerActionTag[] {
  const { rules } = contextFor(stored);
  if (
    stored.estadoPublico.encerrada ||
    stored.estadoPublico.turno >= stored.estadoPublico.turnosMaximos
  )
    throw new Error("Negociação encerrada. Estruture a proposta final.");
  stored.estadoPublico.turno++;
  stored.run.status = "negociacao";
  evolve(stored, tags, extractRelevantCounterparts(text));
  const previous = stored.privateState.degrau;
  if (canAdvance(stored, tags)) stored.privateState.degrau++;
  stored.privateState.turnosSemAvanco =
    previous === stored.privateState.degrau ? stored.privateState.turnosSemAvanco + 1 : 0;
  const offer = rules.packages[stored.privateState.degrau]!;
  Object.assign(stored.estadoPublico.ofertaPublica, {
    precoUnitario: offer.price,
    duracaoMeses: offer.months,
    volumeMinimo: `${offer.volume} ${stored.aluminum ? "t/mês" : "unidades/mês"}`,
    pagamentoDias: offer.payment,
    contrapartidas: [
      `Contrato de pelo menos ${offer.months} meses`,
      `Volume mínimo de ${offer.volume} ${stored.aluminum ? "t/mês" : "unidades/mês"}`,
      `Forecast congelado por ${offer.forecast} dias`,
      `Pagamento em até ${offer.payment} dias`,
    ],
  });
  if (tags.includes("diagnostico") || tags.includes("pergunta_aberta"))
    stored.disclosures = Object.keys(rules.disclosures);
  stored.mensagens.push(makeMessage(stored, "comprador", text, tags));
  maybeEvent(stored);
  if (
    stored.privateState.frustracao >= 95 ||
    stored.privateState.abertura <= 5 ||
    stored.estadoPublico.turno >= stored.estadoPublico.turnosMaximos
  )
    stored.estadoPublico.encerrada = true;
  if (stored.aluminum && stored.sourcingPrivate)
    stored.sourcingPrivate.states[stored.aluminum.activeSupplierId] = structuredClone(
      stored.privateState,
    );
  return tags;
}
/** Classifica por regex e avança — comportamento inalterado para todo chamador existente. */
export function advance(stored: StoredRun, text: string): BuyerActionTag[] {
  return advanceWithTags(stored, text, classifyBuyerMessage(text));
}

export function switchSupplier(stored: StoredRun, supplierId: string, reason: string) {
  const a = stored.aluminum,
    privateData = stored.sourcingPrivate;
  if (!a || !privateData) throw new Error("Troca indisponível no cenário legado.");
  if (stored.estadoPublico.encerrada || stored.relatorio) throw new Error("Execução encerrada.");
  if (a.switchCount >= 1) throw new Error("A execução permite uma única troca.");
  const target = a.suppliers.find((s) => s.id === supplierId);
  if (!target || target.id === a.activeSupplierId)
    throw new Error("Fornecedor de destino inválido.");
  const from = a.activeSupplierId;
  privateData.states[from] = structuredClone(stored.privateState);
  a.activeSupplierId = target.id;
  a.switchCount++;
  a.switches.push({
    id: crypto.randomUUID(),
    runId: stored.run.id,
    fromSupplierId: from,
    toSupplierId: target.id,
    turnIndex: stored.estadoPublico.turno,
    reason,
    timePenaltyDays: target.qualificationDays,
    financialImpact: target.switchingCost,
    riskImpact: target.logisticsRisk + target.fxRisk,
    createdAt: new Date().toISOString(),
  });
  a.blueprint = publicBlueprint(a.instance, target);
  stored.privateState = structuredClone(privateData.supplierConfigs[target.id]!.initialState);
  stored.disclosures = [];
  stored.estadoPublico.ofertaPublica = structuredClone(contextFor(stored).rules.initialOffer);
  const message = makeMessage(
    stored,
    "sistema",
    `Troca para ${target.displayName}. Homologação: ${target.qualificationDays} dias; custo: BRL ${target.switchingCost}. Justificativa: ${reason}`,
  );
  message.id += ":switch";
  stored.mensagens.push(message);
  const evidence = makeMessage(stored, "comprador", reason, classifyBuyerMessage(reason));
  evidence.id += ":switch-reason";
  stored.mensagens.push(evidence);
}
