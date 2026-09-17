import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  ChevronDown,
  FileText,
  FlaskConical,
  RotateCcw,
  Send,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NotesPanel } from "@/components/buyerlab/notes-panel";
import { PageShell } from "@/components/buyerlab/site-shell";
import { RunError, RunLoading } from "@/components/buyerlab/run-states";
import { ScenarioDetails } from "@/components/buyerlab/scenario-details";
import { orionNexa as legacyScenario } from "@/domain/scenario";
import type { NegotiationMessage } from "@/domain/types";
import { brl, rotuloModo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRun } from "@/simulation/use-run";

export function LegacyNegotiationPage({ runId }: { runId: string }) {
  const { snapshot, setSnapshot, loading, error, refresh, simulation } = useRun(runId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "nearest",
    });
  }, [snapshot?.mensagens.length]);
  if (loading)
    return (
      <PageShell>
        <RunLoading />
      </PageShell>
    );
  if (error || !snapshot)
    return (
      <PageShell>
        <RunError message={error ?? "Execução não encontrada."} retry={() => void refresh()} />
      </PageShell>
    );

  async function send(value = text) {
    const clean = value.trim();
    if (!clean || sending) return;
    setSending(true);
    setSendError(null);
    setLastFailedText(null);
    setText("");
    try {
      const result = await simulation.sendBuyerMessage(runId, clean);
      setSnapshot(result.snapshot);
    } catch (cause) {
      setText(clean);
      setLastFailedText(clean);
      setSendError(cause instanceof Error ? cause.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  const state = snapshot.estadoPublico;
  const scenario = snapshot.aluminum?.blueprint ?? legacyScenario;
  return (
    <PageShell>
      <div className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary-foreground/10">
              <BriefcaseBusiness />
            </span>
            <div>
              <h1 className="font-display text-lg font-semibold">{scenario.brief.fornecedor}</h1>
              <p className="text-xs text-primary-foreground/65">
                {scenario.titulo} · {rotuloModo[snapshot.run.modo]} · Seed {snapshot.run.seed}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full border border-primary-foreground/15 px-3 py-1.5">
              Turno {state.turno} de {state.turnosMaximos}
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-success" />
              {snapshot.provedor === "openai" ? "Fornecedor IA" : "Fornecedor mock"}
            </span>
            <Button
              asChild
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Link to="/proposta/$runId" params={{ runId }}>
                Estruturar proposta <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
      {snapshot.aluminum && (
        <ScenarioDetails
          data={snapshot.aluminum}
          closed={state.encerrada}
          onSwitch={async (id, reason) => {
            setSnapshot(await simulation.switchSupplier(runId, id, reason));
          }}
        />
      )}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:px-8">
        <div className="panel flex min-h-[650px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Conversa da negociação</h2>
              <p className="text-xs text-muted-foreground">
                Mensagens classificadas de forma privada para o diagnóstico
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="lg:hidden"
              aria-expanded={dossierOpen}
              onClick={() => setDossierOpen((open) => !open)}
            >
              <FileText />
              Dossiê{" "}
              <ChevronDown className={cn("transition-transform", dossierOpen && "rotate-180")} />
            </Button>
          </div>
          {dossierOpen && (
            <div className="border-b bg-muted/40 p-4 lg:hidden">
              <QuickDossier scenario={scenario} />
            </div>
          )}
          <div
            className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6"
            aria-live="polite"
            aria-label="Mensagens da negociação"
          >
            {snapshot.mensagens.map((item) => (
              <Message key={item.id} message={item} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex size-8 items-center justify-center rounded-full bg-secondary">
                  <FlaskConical className="size-4" />
                </span>
                <span>O fornecedor está analisando sua proposta…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t bg-muted/20 p-4">
            {sendError && (
              <div
                role="alert"
                className="mb-3 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex-1">
                  <p>{sendError}</p>
                  {lastFailedText && (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-destructive"
                      onClick={() => void send(lastFailedText)}
                    >
                      <RotateCcw />
                      Tentar novamente
                    </Button>
                  )}
                </div>
              </div>
            )}
            <label htmlFor="message" className="sr-only">
              {snapshot.aluminum ? "Sua mensagem para o fornecedor" : "Sua mensagem para a Nexa"}
            </label>
            <div className="flex items-end gap-2">
              <Textarea
                maxLength={2000}
                id="message"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder="Escreva sua mensagem para o fornecedor…"
                className="min-h-20 resize-none"
                disabled={sending || state.encerrada}
              />
              <Button
                type="button"
                size="icon"
                className="size-11 shrink-0"
                aria-label="Enviar mensagem"
                onClick={() => void send()}
                disabled={!text.trim() || sending || state.encerrada}
              >
                <Send />
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Enter envia · Shift + Enter quebra a linha</span>
              {snapshot.run.modo === "treinamento" && state.turno < 2 && (
                <span className="hidden text-accent sm:inline">
                  Dica: investigue antes de propor.
                </span>
              )}
            </div>
          </div>
        </div>
        <aside className="space-y-5">
          <div className="panel overflow-hidden">
            <div className="border-b px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Proposta pública atual
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-primary">
                {brl(state.ofertaPublica.precoUnitario)}
              </p>
              <p className="text-xs text-muted-foreground">
                {snapshot.aluminum ? "por tonelada" : "por unidade"}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
              <Mini label="Lead time" value={`${state.ofertaPublica.leadTimeDias} dias`} />
              <Mini label="Pagamento" value={`${state.ofertaPublica.pagamentoDias} dias`} />
              <Mini label="OTIF recente" value={`${state.ofertaPublica.otif}%`} />
              <Mini label="Contrapartidas" value={`${state.ofertaPublica.contrapartidas.length}`} />
              <Mini label="Duração" value={`${state.ofertaPublica.duracaoMeses} meses`} />
              <Mini label="Volume mínimo" value={state.ofertaPublica.volumeMinimo} />
            </dl>
            {state.ofertaPublica.contrapartidas.length > 0 && (
              <div className="border-t px-5 py-4">
                <h3 className="text-xs font-semibold">Condições deste preço</h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground">
                  {state.ofertaPublica.contrapartidas.map((term) => (
                    <li key={term}>{term}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Sujeito à confirmação do pacote completo.
                </p>
              </div>
            )}
          </div>
          {state.eventos.length > 0 && (
            <div className="space-y-3">
              {state.eventos.map((event) => (
                <div
                  key={`${event.id}-${event.turno}`}
                  className="rounded-md border border-warning/40 bg-warning/5 p-4"
                >
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-warning-text">
                    <AlertCircle className="size-4" />
                    Evento no turno {event.turno}
                  </p>
                  <h3 className="mt-2 text-sm font-semibold">{event.titulo}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{event.descricao}</p>
                </div>
              ))}
            </div>
          )}
          <div className="hidden lg:block">
            <QuickDossier scenario={scenario} />
          </div>
          <NotesPanel
            compact
            initial={snapshot.anotacoes}
            onSave={(value) => simulation.updateNotes(runId, value)}
          />
          <Button asChild variant="outline" className="w-full">
            <Link to="/preparacao/$runId" params={{ runId }}>
              <FileText />
              Abrir dossiê completo
            </Link>
          </Button>
        </aside>
      </section>
    </PageShell>
  );
}

function Message({ message }: { message: NegotiationMessage }) {
  if (message.autor === "sistema")
    return (
      <div className="mx-auto max-w-xl rounded-md border border-warning/40 bg-warning/5 px-4 py-3 text-center text-xs leading-5">
        <strong>Atualização:</strong> {message.texto}
      </div>
    );
  const buyer = message.autor === "comprador";
  return (
    <div className={cn("flex gap-3", buyer && "flex-row-reverse")}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          buyer ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {buyer ? <UserRound className="size-4" /> : <FlaskConical className="size-4" />}
      </span>
      <div className={cn("max-w-[82%]", buyer && "text-right")}>
        <p className="mb-1 text-xs font-semibold text-muted-foreground">
          {buyer ? "Você · Comprador" : (message.supplierName ?? "Marina Costa · Nexa")}{" "}
          <span className="font-normal">· Turno {message.turno}</span>
        </p>
        <div
          className={cn(
            "inline-block whitespace-pre-wrap break-words rounded-md px-4 py-3 text-left text-sm leading-6",
            buyer ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground",
          )}
        >
          {message.texto}
        </div>
      </div>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
function QuickDossier({
  scenario: orionNexa,
}: {
  scenario: import("@/domain/types").PublicScenarioBlueprint;
}) {
  return (
    <div className="rounded-md border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Mandato rápido
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt>Limite autorizado</dt>
          <dd className="font-semibold">{brl(orionNexa.mandato.limitePrecoEfetivo)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Estoque</dt>
          <dd className="font-semibold">{orionNexa.mandato.diasEstoque} dias</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Alternativa</dt>
          <dd className="font-semibold">
            {orionNexa.mandato.diasQualificacaoAlternativo} dias /{" "}
            {orionNexa.mandato.coberturaAlternativoInicial * 100}%
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Meta OTIF</dt>
          <dd className="font-semibold">{orionNexa.ofertaInicialComprador.otifMeta}%</dd>
        </div>
      </dl>
    </div>
  );
}
