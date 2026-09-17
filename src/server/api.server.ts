import { z } from "zod";
import { Store, digest } from "./store.server";
import { commandSchema } from "./validation.server";
import {
  advanceState,
  commitOffer,
  createRun,
  makeMessage,
  publicSnapshot,
  switchSupplier,
} from "./engine.server";
import { classifyBuyerMessage, isExplicitAcceptance } from "../simulation/classifier";
import {
  configuredProvider,
  MockSimulationProvider,
  withFallback,
  type SupplierProvider,
} from "./providers.server";
import { validateDeal } from "./evaluator.server";
import { coach } from "./coach.server";
import { randomSeed } from "../lib/prng";
import type { StoredRun } from "./model";
import { liveMarket } from "./live-market.server";
import { marketIndicators } from "./market-indicators.server";
import type { Outcome, RunConfig, StructuredFinalOffer } from "../domain/types";

async function marketFor(config: RunConfig) {
  if (
    config.scenarioType !== "aluminum" ||
    config.modo === "avaliacao" ||
    process.env["BUYERLAB_MARKET_PROVIDER"] === "static"
  )
    return undefined;
  return liveMarket.getSnapshot();
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function createApi(store: Store, provider: SupplierProvider = configuredProvider()) {
  const queues = new Map<string, Promise<unknown>>();
  /** Encerra e avalia a execução a partir de uma proposta final, seja a estruturada explicitamente
   * pelo comprador (action "finalize") ou a construída a partir da posição pública negociada
   * quando o comprador aceita diretamente no chat (ver isExplicitAcceptance). */
  async function finalizeRun(stored: StoredRun, offer: StructuredFinalOffer): Promise<Outcome> {
    const decision = validateDeal(stored, offer);
    stored.propostaFinal = offer;
    stored.estadoPublico.encerrada = true;
    stored.run.status = "concluida";
    if (stored.aluminum) stored.aluminum.finalSupplierId = stored.aluminum.activeSupplierId;
    const mock = new MockSimulationProvider();
    const evaluation = await withFallback(
      () => provider.evaluate(stored),
      () => mock.evaluate(stored),
    );
    stored.relatorio = coach(
      stored,
      decision.outcome,
      decision.reason,
      evaluation.value,
      evaluation.fallback || provider instanceof MockSimulationProvider,
    );
    return decision.outcome;
  }
  async function serialized<T>(owner: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(owner) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    queues.set(owner, next);
    try {
      return await next;
    } finally {
      if (queues.get(owner) === next) queues.delete(owner);
    }
  }
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value ?? null), { status, headers });
    try {
      if (!store.rate("global", 300))
        throw new ApiError(429, "RATE_LIMIT", "Muitas solicitações. Aguarde um minuto.");
      if (request.method === "GET" && url.pathname.startsWith("/api/reports/")) {
        const report = store.report(url.pathname.slice("/api/reports/".length));
        if (!report)
          throw new ApiError(404, "NOT_FOUND", "Relatório inexistente ou link expirado.");
        return json(report);
      }
      if (request.method !== "POST" && request.method !== "GET")
        throw new ApiError(405, "METHOD", "Método não permitido.");
      if (request.method === "POST") {
        // Atrás de um proxy reverso (Cloudflare Tunnel, Railway, Render...), a conexão até o
        // Node é HTTP simples; o host já chega correto em url.host, mas o protocolo público
        // real (https) só aparece em X-Forwarded-Proto.
        const forwardedProto = request.headers.get("x-forwarded-proto");
        const expectedOrigin = forwardedProto ? `${forwardedProto}://${url.host}` : url.origin;
        if (
          request.headers.get("origin") !== expectedOrigin ||
          !request.headers.get("content-type")?.startsWith("application/json")
        )
          throw new ApiError(403, "ORIGIN", "Origem da solicitação não autorizada.");
      }
      const cookie = request.headers
        .get("cookie")
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("buyerlab_session="))
        ?.slice("buyerlab_session=".length);
      const session = store.session(cookie);
      if (session.token)
        headers.append(
          "Set-Cookie",
          `buyerlab_session=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${url.protocol === "https:" ? "; Secure" : ""}`,
        );
      if (!store.rate(session.hash, 60))
        throw new ApiError(
          429,
          "RATE_LIMIT",
          "Limite de solicitações por sessão. Aguarde um minuto.",
        );
      if (request.method === "GET") {
        if (url.pathname === "/api/session") return json({ ready: true });
        if (url.pathname === "/api/market-indicators")
          return json(await marketIndicators.getSnapshot());
        if (url.pathname === "/api/history") return json(store.history(session.hash));
        if (url.pathname === "/api/history/summary")
          return json(store.history(session.hash).groups);
        if (url.pathname.startsWith("/api/history/")) {
          const historical = store.load(url.pathname.slice("/api/history/".length), session.hash);
          if (!historical?.relatorio)
            throw new ApiError(404, "NOT_FOUND", "Relatório não encontrado nesta sessão.");
          return json(historical.relatorio);
        }
        const extra = url.pathname.match(
          /^\/api\/simulations\/([^/]+)\/(suppliers|supplier-conversations|contrato)$/,
        );
        if (extra) {
          const run = store.load(extra[1]!, session.hash);
          if (!run) throw new ApiError(404, "NOT_FOUND", "Execução não encontrada.");
          return json(
            extra[2] === "suppliers"
              ? (run.aluminum?.suppliers ?? [])
              : extra[2] === "contrato"
                ? (run.aluminum?.currentContract ?? null)
                : publicSnapshot(run).mensagens,
          );
        }
        const id = url.pathname.slice("/api/simulations/".length);
        const stored = store.load(id, session.hash);
        if (!stored)
          throw new ApiError(
            404,
            "NOT_FOUND",
            "Execução não encontrada ou não autorizada neste navegador.",
          );
        return json(publicSnapshot(stored));
      }
      const length = Number(request.headers.get("content-length") ?? 0);
      if (length > 16384) throw new ApiError(413, "SIZE", "Solicitação muito grande.");
      const reader = request.body?.getReader();
      if (!reader) throw new ApiError(400, "INPUT", "Solicitação vazia.");
      let size = 0,
        raw = "";
      const decoder = new TextDecoder();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > 16384) {
          await reader.cancel();
          throw new ApiError(413, "SIZE", "Solicitação muito grande.");
        }
        raw += decoder.decode(chunk.value, { stream: true });
      }
      raw += decoder.decode();
      const command = commandSchema.parse(JSON.parse(raw));
      const key = z.string().uuid().parse(request.headers.get("idempotency-key"));
      const fingerprint = digest(raw);
      const result = await serialized(session.hash, async () => {
        const cached = store.cached(session.hash, key, fingerprint);
        if (cached.found) return cached.value;
        let stored: StoredRun | null = null;
        let value: unknown;
        if (command.action === "start") {
          stored = createRun(command.config, await marketFor(command.config));
          value = stored.run;
        } else {
          stored = store.load(command.runId, session.hash);
          if (!stored)
            throw new ApiError(404, "NOT_FOUND", "Execução não encontrada ou não autorizada.");
          if (command.action === "message") {
            if (stored.estadoPublico.turno !== command.expectedTurn)
              throw new ApiError(
                409,
                "TURN_CONFLICT",
                "O turno já mudou. Recarregue a execução antes de enviar.",
              );
            const previousOffer = JSON.stringify(stored.estadoPublico.ofertaPublica);
            const mock = new MockSimulationProvider();
            const baseTags = classifyBuyerMessage(command.text);
            const useMock = command.forceMock || baseTags.includes("antietico");
            let tags = baseTags;
            // O regex não reconheceu nada de acionável: se houver um provedor de IA real
            // configurado, deixa ele classificar a mesma mensagem no mesmo vocabulário fechado
            // de tags, em vez de travar a negociação exigindo uma frase "mágica" específica. A
            // checagem de segurança acima (antietico) já rodou e nunca depende dessa etapa.
            if (
              !useMock &&
              baseTags.length === 1 &&
              baseTags[0] === "neutro" &&
              !(provider instanceof MockSimulationProvider)
            ) {
              const enriched = await withFallback(
                () => provider.classify(stored!, command.text),
                () => Promise.resolve<typeof baseTags>([]),
                15000,
              );
              if (enriched.value.length > 0) tags = enriched.value;
            }
            const envelope = advanceState(stored, command.text, tags);
            const output = await withFallback(
              () =>
                useMock
                  ? mock.reply(stored!, tags, envelope)
                  : provider.reply(stored!, tags, envelope),
              () => mock.reply(stored!, tags, envelope),
            );
            stored.providerMode =
              useMock || output.fallback || provider instanceof MockSimulationProvider
                ? "mock"
                : "openai";
            commitOffer(stored, output.value.proposedPrice, envelope);
            const offer = stored.estadoPublico.ofertaPublica;
            const offerChanged = previousOffer !== JSON.stringify(offer);
            const text =
              offerChanged ||
              tags.some((tag) => ["proposta", "ancoragem", "fechamento"].includes(tag))
                ? `${output.value.supplierMessage}\n\nPosição pública: R$ ${offer.precoUnitario.toFixed(2).replace(".", ",")} por ${stored.aluminum ? "tonelada" : "unidade"}. ${offer.contrapartidas.join("; ")}. A aceitação depende da confirmação do pacote completo.`
                : output.value.supplierMessage;
            stored.mensagens.push(makeMessage(stored, "fornecedor", text));
            // Aceite explícito do comprador no chat ("aceito a proposta"...) encerra o
            // treinamento e gera o relatório a partir da posição pública negociada até aqui —
            // nunca a partir de uma alegação do fornecedor/IA (validateActor continua banindo
            // esse tipo de frase na fala dele).
            if (!stored.relatorio && isExplicitAcceptance(command.text))
              await finalizeRun(stored, publicSnapshot(stored).suggestedOffer!);
            value = {
              snapshot: publicSnapshot(stored),
              novosEventos: stored.estadoPublico.eventos.filter(
                (e) => e.turno === stored!.estadoPublico.turno,
              ),
            };
          } else if (command.action === "switch") {
            if (stored.estadoPublico.turno !== command.expectedTurn)
              throw new ApiError(
                409,
                "TURN_CONFLICT",
                "O turno mudou. Recarregue antes de trocar.",
              );
            try {
              switchSupplier(stored, command.supplierId, command.reason);
            } catch (error) {
              throw new ApiError(
                409,
                "SWITCH_REJECTED",
                error instanceof Error ? error.message : "Troca recusada.",
              );
            }
            value = publicSnapshot(stored);
          } else if (command.action === "notes") {
            stored.anotacoes = command.notes;
            value = null;
          } else if (command.action === "retry") {
            const market = command.sameSeed
              ? stored.aluminum?.instance.market
              : await marketFor(stored.config);
            stored = createRun(
              {
                ...stored.config,
                seed: command.sameSeed ? stored.run.seed : randomSeed(),
              },
              market,
            );
            value = stored.run;
          } else if (command.action === "finalize") {
            if (stored.relatorio)
              throw new ApiError(409, "FINALIZED", "Esta execução já foi finalizada.");
            value = await finalizeRun(stored, command.offer);
          } else if (command.action === "evaluate") {
            if (!stored.relatorio)
              throw new ApiError(409, "NOT_FINALIZED", "Finalize a execução antes da avaliação.");
            value = stored.relatorio;
          } else {
            if (!stored.relatorio)
              throw new ApiError(
                409,
                "NOT_FINALIZED",
                "Somente relatórios finalizados podem ser compartilhados.",
              );
          }
        }
        store.transaction(() => {
          store.save(stored!, session.hash);
          if (command.action === "share") value = { token: store.share(stored!.run.id) };
          store.remember(session.hash, key, fingerprint, value);
        });
        return value;
      });
      return json(result);
    } catch (error) {
      if (error instanceof ApiError)
        return json({ error: { code: error.code, message: error.message } }, error.status);
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return json(
          {
            error: {
              code: "INVALID_INPUT",
              message: "Confira os campos e os limites da solicitação.",
            },
          },
          400,
        );
      // Não expor SQL, prompts, stack traces ou payloads privados.
      return json(
        {
          error: {
            code: "RECOVERY",
            message: "Não foi possível concluir. Recarregue a execução e tente novamente.",
          },
        },
        409,
      );
    }
  };
}
let handler: ReturnType<typeof createApi> | undefined;
export function handleApi(request: Request): Promise<Response> {
  handler ??= createApi(new Store());
  return handler(request);
}
