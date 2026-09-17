import type {
  BuyerActionTag,
  ConcessionEnvelope,
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
import { offerDefaults } from "../domain/offer-defaults";
import {
  computeEnvelope,
  depthFromPrice,
  priceAt,
  termsAt,
  type PackageRow,
} from "./concession.server";
import { mockProposedPrice } from "./supplier-dialogue.server";

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
  }
  // Traduz a posição pública negociada (contínua) para o formato de proposta estruturada — usada
  // tanto para pré-preencher "Estruturar proposta" quanto para o aceite direto no chat (ver
  // isExplicitAcceptance em api.server.ts). Proteções não rastreadas na oferta pública (SLA,
  // garantia, contingência etc.) vêm da base do comprador, nunca da negociação em si.
  const rows = contextFor(stored).rules.packages as PackageRow[];
  const depth = stored.privateState.concessionDepth;
  const terms = termsAt(rows, depth);
  const baseline = stored.aluminum
    ? stored.aluminum.blueprint.ofertaInicialComprador
    : offerDefaults;
  result.suggestedOffer = {
    ...baseline,
    precoUnitario: priceAt(rows, depth),
    volumeMinimoMensal: Math.round(terms.volumeMinimoMensal),
    duracaoMeses: Math.max(12, Math.round(terms.duracaoMeses)),
    forecastCongeladoDias: Math.max(30, Math.round(terms.forecastCongeladoDias)),
    pagamentoDias: Math.round(terms.pagamentoDias),
    contrapartidas: stored.estadoPublico.ofertaPublica.contrapartidas.join("; "),
  };
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
    concessionDepth: 0,
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
    if (
      event.prerequisito === "proximo_do_acordo" &&
      s.concessionDepth < 3 / (blueprint.escada.length - 1)
    )
      continue;
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
 * Avança o estado emocional/eventos a partir de tags já decididas (regex ou, quando configurado,
 * um classificador de IA restrito ao mesmo vocabulário fechado de BuyerActionTag — ver classify()
 * em providers.server.ts). Não grava a nova oferta pública: apenas calcula e devolve o
 * `ConcessionEnvelope` (limites de preço deste turno), que o chamador deve repassar ao provedor
 * (IA ou mock) e, com o preço proposto por ele, chamar `commitOffer` para gravar a posição
 * pública validada. O motor continua sendo o único a decidir estado a partir das tags e o único a
 * validar/clampar qualquer valor comercial; só a origem da classificação e do preço proposto pode
 * variar.
 */
export function advanceState(
  stored: StoredRun,
  text: string,
  tags: BuyerActionTag[],
): ConcessionEnvelope {
  const { rules } = contextFor(stored);
  if (
    stored.estadoPublico.encerrada ||
    stored.estadoPublico.turno >= stored.estadoPublico.turnosMaximos
  )
    throw new Error("Negociação encerrada. Estruture a proposta final.");
  stored.estadoPublico.turno++;
  stored.run.status = "negociacao";
  evolve(stored, tags, extractRelevantCounterparts(text));
  const envelope = computeEnvelope(stored, tags);
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
  return envelope;
}
/**
 * Grava a posição pública do turno a partir do preço proposto (pela IA ou pelo mock),
 * validado/clampado contra o `envelope` calculado por `advanceState` — nunca confia no valor
 * recebido sem reclampar. Prazo, volume, forecast e pagamento são sempre derivados pelo motor a
 * partir do preço final, nunca propostos por quem chamou.
 */
export function commitOffer(
  stored: StoredRun,
  proposedPrice: number | null,
  envelope: ConcessionEnvelope,
): void {
  const { rules } = contextFor(stored);
  const rows = rules.packages as PackageRow[];
  const target = Math.min(
    envelope.price.max,
    Math.max(envelope.price.min, proposedPrice ?? envelope.price.max),
  );
  const depth = Math.min(
    envelope.maxDepthThisTurn,
    Math.max(envelope.currentDepth, depthFromPrice(rows, target)),
  );
  const price = Math.round(priceAt(rows, depth) * 100) / 100;
  const terms = termsAt(rows, depth);
  const previous = stored.privateState.concessionDepth;
  stored.privateState.concessionDepth = depth;
  stored.privateState.turnosSemAvanco =
    depth > previous + 1e-9 ? 0 : stored.privateState.turnosSemAvanco + 1;
  const months = Math.round(terms.duracaoMeses),
    volume = Math.round(terms.volumeMinimoMensal),
    forecast = Math.round(terms.forecastCongeladoDias),
    payment = Math.round(terms.pagamentoDias);
  Object.assign(stored.estadoPublico.ofertaPublica, {
    precoUnitario: price,
    duracaoMeses: months,
    volumeMinimo: `${volume} ${stored.aluminum ? "t/mês" : "unidades/mês"}`,
    pagamentoDias: payment,
    contrapartidas: [
      `Contrato de pelo menos ${months} meses`,
      `Volume mínimo de ${volume} ${stored.aluminum ? "t/mês" : "unidades/mês"}`,
      `Forecast congelado por ${forecast} dias`,
      `Pagamento em até ${payment} dias`,
    ],
  });
  if (stored.aluminum && stored.sourcingPrivate)
    stored.sourcingPrivate.states[stored.aluminum.activeSupplierId] = structuredClone(
      stored.privateState,
    );
}
/**
 * Avança e grava a oferta num único passo síncrono, usando o mesmo algoritmo determinístico do
 * mock para decidir o preço proposto (ver mockProposedPrice em supplier-dialogue.server.ts).
 * Usado por `advance` e por todo chamador que não precisa consultar um provedor de IA real turno
 * a turno (ex.: testes). O fluxo real de mensagens (api.server.ts) usa `advanceState` +
 * `provider.reply` + `commitOffer` diretamente, para permitir que a IA proponha o preço.
 */
export function advanceWithTags(
  stored: StoredRun,
  text: string,
  tags: BuyerActionTag[],
): BuyerActionTag[] {
  const envelope = advanceState(stored, text, tags);
  commitOffer(stored, mockProposedPrice(stored, envelope), envelope);
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
