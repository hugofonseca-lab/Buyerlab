import { LegacyNegotiationPage } from "@/components/buyerlab/legacy/negociacao";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { MarketContextCard } from "@/components/buyerlab/market-context-card";
import { NotesPanel } from "@/components/buyerlab/notes-panel";
import { PageShell } from "@/components/buyerlab/site-shell";
import { RunError, RunLoading } from "@/components/buyerlab/run-states";
import { SupplierComparison } from "@/components/buyerlab/supplier-comparison";
import { SupplierSwitchDialog } from "@/components/buyerlab/supplier-switch-dialog";
import type { NegotiationMessage } from "@/domain/types";
import type { ScenarioInstance } from "@/domain/lovable-ui";
import { moeda, rotuloModo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRun } from "@/simulation/use-lovable-run";

export const Route = createFileRoute("/negociacao/$runId")({
  head: () => ({
    meta: [
      { title: "Sala de negociação — BuyerLab" },
      {
        name: "description",
        content: "Negocie chapas de alumínio com fornecedores industriais simulados.",
      },
      { property: "og:title", content: "Sala de negociação — BuyerLab" },
      {
        property: "og:description",
        content: "Negociação industrial paramétrica com fornecedores alternativos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NegotiationPage,
});
function NegotiationPage() {
  const { runId } = Route.useParams();
  const { snapshot, setSnapshot, loading, error, refresh, simulation } = useRun(runId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [dossier, setDossier] = useState(false);
  const [comparison, setComparison] = useState(false);
  const [market, setMarket] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
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
  const scenario = snapshot.scenario;
  if (!scenario) return <LegacyNegotiationPage runId={runId} />;
  const active = scenario.supplierCandidates.find((item) => item.id === snapshot.activeSupplierId);
  if (!active)
    return (
      <PageShell>
        <RunError message="Fornecedor ativo indisponível." />
      </PageShell>
    );
  const state = snapshot.estadoPublico;
  async function send(value = text) {
    const clean = value.trim();
    if (!clean || sending || snapshot?.estadoPublico.encerrada) return;
    setSending(true);
    setSendError(null);
    setFailed(null);
    setText("");
    try {
      const result = await simulation.sendBuyerMessage(runId, clean);
      setSnapshot(result.snapshot);
    } catch (cause) {
      setText(clean);
      setFailed(clean);
      setSendError(cause instanceof Error ? cause.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }
  async function switchSupplier(id: string, reason: string) {
    const next = await simulation.switchSupplier(runId, id, reason);
    setSnapshot(next);
  }
  return (
    <PageShell>
      <div className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary-foreground/10">
              <BriefcaseBusiness />
            </span>
            <div>
              <h1 className="font-display text-lg font-semibold">{active.name}</h1>
              <p className="text-xs text-primary-foreground/65">
                {scenario.material.name}
                {" · "}
                {scenario.purchaseQuantity}
                {" t · "}
                {rotuloModo[snapshot.run.modo]}
                {" · Seed "}
                {snapshot.run.seed}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {snapshot.supplierSwitch && (
              <span className="rounded-full border border-warning/50 px-3 py-1.5 text-warning">
                Troca realizada
              </span>
            )}
            <span className="rounded-full border border-primary-foreground/15 px-3 py-1.5">
              Turno {state.turno} de {state.turnosMaximos}
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
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_350px] lg:px-8">
        <div className="panel flex min-h-[650px] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Conversa com {active.name}</h2>
              <p className="text-xs text-muted-foreground">
                As conversas permanecem separadas por fornecedor.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setDossier((open) => !open)}
            >
              <FileText />
              Resumo <ChevronDown className={cn("transition-transform", dossier && "rotate-180")} />
            </Button>
          </div>
          {dossier && (
            <div className="border-b bg-muted/40 p-4 lg:hidden">
              <QuickDossier scenario={scenario} />
            </div>
          )}
          <div
            className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6"
            aria-live="polite"
            aria-label={`Mensagens com ${active.name}`}
          >
            {snapshot.mensagens
              .filter((item) => item.supplierId === active.id)
              .map((item) => (
                <Message key={item.id} message={item} supplier={active.name} />
              ))}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex size-8 items-center justify-center rounded-full bg-secondary">
                  <FlaskConical className="size-4" />
                </span>
                <span>{active.name} está analisando…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t bg-muted/20 p-4">
            {sendError && (
              <div
                role="alert"
                className="mb-3 flex gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
              >
                <AlertCircle className="size-4 shrink-0 text-destructive" />
                <div>
                  <p>{sendError}</p>
                  {failed && (
                    <Button
                      variant="link"
                      className="h-auto p-0 text-destructive"
                      onClick={() => void send(failed)}
                    >
                      <RotateCcw />
                      Tentar novamente
                    </Button>
                  )}
                </div>
              </div>
            )}
            <label htmlFor="message" className="sr-only">
              Sua mensagem para {active.name}
            </label>
            <div className="flex items-end gap-2">
              <Textarea
                id="message"
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={`Escreva para ${active.name}…`}
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
          </div>
        </div>
        <aside className="space-y-5">
          <div className="panel overflow-hidden">
            <div className="border-b px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Proposta pública atual
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-primary">
                {moeda(state.ofertaPublica.precoUnitario, active.currency)}
              </p>
              <p className="text-xs text-muted-foreground">por tonelada · {active.currency}</p>
            </div>
            <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
              <Mini label="Quantidade" value={`${scenario.purchaseQuantity} t`} />
              <Mini label="Prazo crítico" value={`${scenario.inventoryCoverageDays} dias`} />
              <Mini label="Lead time" value={`${state.ofertaPublica.leadTimeDias} dias`} />
              <Mini label="Pagamento" value={`${state.ofertaPublica.pagamentoDias} dias`} />
            </dl>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => setComparison((v) => !v)}>
              Comparar fornecedores
            </Button>
            <Button variant="outline" onClick={() => setMarket((v) => !v)}>
              Contexto econômico
            </Button>
            <SupplierSwitchDialog
              current={active}
              candidates={scenario.supplierCandidates}
              disabled={Boolean(snapshot.supplierSwitch) || sending || state.encerrada}
              onConfirm={switchSupplier}
            />
          </div>
          {comparison && (
            <SupplierComparison scenario={{ ...scenario, activeSupplierId: active.id }} compact />
          )}
          {market && <MarketContextCard market={scenario.marketSnapshot} compact />}
          {state.eventos.map((event) => (
            <div
              key={`${event.id}-${event.turno}`}
              className="rounded-md border border-warning/40 bg-warning/5 p-4"
            >
              <p className="text-xs font-bold uppercase text-warning">
                Evento no turno {event.turno}
              </p>
              <h3 className="mt-2 text-sm font-semibold">{event.titulo}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{event.descricao}</p>
            </div>
          ))}
          <div className="hidden lg:block">
            <QuickDossier scenario={scenario} />
          </div>
          <NotesPanel
            compact
            initial={snapshot.anotacoes}
            onSave={(value) => simulation.updateNotes(runId, value)}
          />
        </aside>
      </section>
    </PageShell>
  );
}
function Message({ message, supplier }: { message: NegotiationMessage; supplier: string }) {
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
          {buyer ? "Você · Comprador" : supplier} · Turno {message.turno}
        </p>
        <div
          className={cn(
            "inline-block rounded-md px-4 py-3 text-left text-sm leading-6",
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
function QuickDossier({ scenario }: { scenario: ScenarioInstance }) {
  return (
    <div className="rounded-md border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Mandato rápido
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt>Material</dt>
          <dd className="font-semibold">{scenario.material.code}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Meta</dt>
          <dd className="font-semibold">{moeda(scenario.buyerTargetPrice, scenario.currency)}/t</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Limite</dt>
          <dd className="font-semibold">
            {moeda(scenario.buyerMaximumPrice, scenario.currency)}/t
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Estoque</dt>
          <dd className="font-semibold">{scenario.inventoryCoverageDays} dias</dd>
        </div>
      </dl>
    </div>
  );
}
