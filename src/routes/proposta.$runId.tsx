import { offerDefaults as defaults } from "@/domain/offer-defaults";
import { LegacyFinalOfferPage } from "@/components/buyerlab/legacy/proposta";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ClipboardCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/buyerlab/page-header";
import { PageShell } from "@/components/buyerlab/site-shell";
import { RunError, RunLoading } from "@/components/buyerlab/run-states";
import type { StructuredFinalOffer } from "@/domain/types";
import { moeda } from "@/lib/format";
import { useRun } from "@/simulation/use-lovable-run";

export const Route = createFileRoute("/proposta/$runId")({
  head: () => ({
    meta: [
      { title: "Proposta final — BuyerLab" },
      {
        name: "description",
        content:
          "Estruture preço, continuidade, qualidade e contrapartidas para concluir sua negociação BuyerLab.",
      },
      { property: "og:title", content: "Proposta final — BuyerLab" },
      {
        property: "og:description",
        content: "Consolide um acordo executável no simulador de negociação BuyerLab.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinalOfferPage,
});

function FinalOfferPage() {
  const { runId } = Route.useParams();
  const navigate = useNavigate();
  const { snapshot, loading, error, refresh, simulation } = useRun(runId);
  const [offer, setOffer] = useState(defaults);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const initialized = useRef(false);
  useEffect(() => {
    const scenario = snapshot?.scenario;
    const supplier = scenario?.supplierCandidates.find(
      (item) => item.id === snapshot?.activeSupplierId,
    );
    if (!scenario || !supplier || initialized.current) return;
    initialized.current = true;
    setOffer(snapshot.suggestedOffer ?? defaults);
  }, [snapshot]);
  const monthly = useMemo(
    () => offer.precoUnitario * offer.volumeMinimoMensal,
    [offer.precoUnitario, offer.volumeMinimoMensal],
  );
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
  const supplier = scenario?.supplierCandidates.find(
    (item) => item.id === snapshot.activeSupplierId,
  );
  if (!scenario || !supplier) return <LegacyFinalOfferPage runId={runId} />;

  const number =
    (key: keyof StructuredFinalOffer) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setOffer((old) => ({ ...old, [key]: Number(event.target.value) }));
  const toggle = (key: keyof StructuredFinalOffer) => (checked: boolean | "indeterminate") =>
    setOffer((old) => ({ ...old, [key]: checked === true }));
  async function submit() {
    setBusy(true);
    setSubmitError(null);
    try {
      await simulation.submitFinalOffer(runId, offer);
      await navigate({ to: "/diagnostico/$runId", params: { runId } });
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={`${scenario.material.name} · ${supplier.name} · Seed ${snapshot.run.seed}`}
        title="Estruture a proposta final"
        description="Transforme a conversa em compromissos mensuráveis. O fornecedor só aceitará condições compatíveis com o que foi construído na mesa."
      />
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {!review ? (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              <OfferGroup title="Comercial" description="Preço e compromissos básicos.">
                <NumberField
                  label={`Preço por tonelada (${supplier.currency})`}
                  value={offer.precoUnitario}
                  onChange={number("precoUnitario")}
                  step="0.5"
                  min="0"
                />
                <NumberField
                  label="Volume mínimo mensal (t)"
                  value={offer.volumeMinimoMensal}
                  onChange={number("volumeMinimoMensal")}
                  step="1"
                  min="0"
                />
                <NumberField
                  label="Duração (meses)"
                  value={offer.duracaoMeses}
                  onChange={number("duracaoMeses")}
                  min="1"
                />
                <NumberField
                  label="Pagamento (dias)"
                  value={offer.pagamentoDias}
                  onChange={number("pagamentoDias")}
                  min="0"
                />
                <NumberField
                  label="Forecast congelado (dias)"
                  value={offer.forecastCongeladoDias}
                  onChange={number("forecastCongeladoDias")}
                  min="0"
                />
              </OfferGroup>
              <OfferGroup
                title="Operação e qualidade"
                description="Metas executáveis e proteção da linha."
              >
                <NumberField
                  label="Lead time (dias)"
                  value={offer.leadTimeDias}
                  onChange={number("leadTimeDias")}
                  min="1"
                />
                <NumberField
                  label="Meta OTIF (%)"
                  value={offer.otifMeta}
                  onChange={number("otifMeta")}
                  min="0"
                  max="100"
                />
                <NumberField
                  label="Limite de defeitos (%)"
                  value={offer.limiteDefeitos}
                  onChange={number("limiteDefeitos")}
                  step="0.1"
                  min="0"
                />
                <NumberField
                  label="Garantia (meses)"
                  value={offer.garantiaMeses}
                  onChange={number("garantiaMeses")}
                  min="0"
                />
                <CheckField
                  label="Créditos por descumprimento de SLA"
                  checked={offer.creditosSla}
                  onChange={toggle("creditosSla")}
                />
                <CheckField
                  label="Revisões periódicas"
                  checked={offer.revisoesPeriodicas}
                  onChange={toggle("revisoesPeriodicas")}
                />
              </OfferGroup>
              <OfferGroup title="Continuidade" description="Proteções e contingência.">
                <CheckField
                  label="Estoque de segurança"
                  checked={offer.estoqueSeguranca}
                  onChange={toggle("estoqueSeguranca")}
                />
                <CheckField
                  label="Prioridade de produção"
                  checked={offer.prioridadeProducao}
                  onChange={toggle("prioridadeProducao")}
                />
                <CheckField
                  label="Plano de contingência"
                  checked={offer.planoContingencia}
                  onChange={toggle("planoContingencia")}
                />
                <CheckField
                  label="Qualificação gradual de segunda fonte"
                  checked={offer.segundaFonteGradual}
                  onChange={toggle("segundaFonteGradual")}
                />
                <div>
                  <Label htmlFor="contrapartidas">Contrapartidas da Orion</Label>
                  <Textarea
                    id="contrapartidas"
                    className="mt-2 min-h-24"
                    value={offer.contrapartidas}
                    onChange={(event) =>
                      setOffer((old) => ({ ...old, contrapartidas: event.target.value }))
                    }
                  />
                </div>
              </OfferGroup>
            </div>
            <div className="panel mt-6 p-5">
              <Label htmlFor="observacoes">Observações finais</Label>
              <Textarea
                id="observacoes"
                className="mt-2"
                value={offer.observacoes}
                onChange={(event) =>
                  setOffer((old) => ({ ...old, observacoes: event.target.value }))
                }
                placeholder="Governança, datas ou responsabilidades adicionais…"
              />
            </div>
            <div className="mt-6 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Custo mensal proposto</p>
                <p className="font-display text-2xl font-bold">
                  {moeda(monthly, supplier.currency)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => history.back()}>
                  <ArrowLeft />
                  Voltar à conversa
                </Button>
                <Button type="button" size="lg" onClick={() => setReview(true)}>
                  <ClipboardCheck />
                  Revisar proposta
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Review
            offer={offer}
            monthly={monthly}
            publicPrice={snapshot.estadoPublico.ofertaPublica.precoUnitario}
            currency={supplier.currency}
            supplierName={supplier.name}
            busy={busy}
            error={submitError}
            onBack={() => setReview(false)}
            onSubmit={() => void submit()}
          />
        )}
      </section>
    </PageShell>
  );
}

function OfferGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="panel p-5">
      <legend className="sr-only">{title}</legend>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </fieldset>
  );
}
function NumberField({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: number;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  min?: string;
  max?: string;
  step?: string;
}) {
  const id = label.replaceAll(" ", "-");
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        className="mt-2 h-11"
        value={value}
        onChange={onChange}
        {...props}
      />
    </div>
  );
}
function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean | "indeterminate") => void;
}) {
  const id = label.replaceAll(" ", "-");
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-md border p-3">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="cursor-pointer text-sm leading-5">
        {label}
      </Label>
    </div>
  );
}
function Review({
  offer,
  monthly,
  publicPrice,
  currency,
  supplierName,
  busy,
  error,
  onBack,
  onSubmit,
}: {
  offer: StructuredFinalOffer;
  monthly: number;
  publicPrice: number;
  currency: "BRL" | "USD";
  supplierName: string;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const items = [
    ["Preço por tonelada", moeda(offer.precoUnitario, currency)],
    ["Custo mensal", moeda(monthly, currency)],
    [`Posição pública — ${supplierName}`, moeda(publicPrice, currency)],
    ["Volume mínimo", `${offer.volumeMinimoMensal.toLocaleString("pt-BR")} t`],
    ["Duração", `${offer.duracaoMeses} meses`],
    ["Lead time", `${offer.leadTimeDias} dias`],
    ["Pagamento", `${offer.pagamentoDias} dias`],
    ["OTIF / defeitos", `${offer.otifMeta}% / ${offer.limiteDefeitos}%`],
    ["Garantia", `${offer.garantiaMeses} meses`],
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <div className="panel overflow-hidden">
        <div className="border-b bg-primary p-6 text-primary-foreground">
          <CheckCircle2 className="size-8 text-accent" />
          <h2 className="mt-4 text-2xl font-bold">Confirme o pacote</h2>
          <p className="mt-2 text-sm text-primary-foreground/70">
            Depois da confirmação, a negociação será avaliada e não poderá ser alterada.
          </p>
        </div>
        <dl className="grid gap-px bg-border sm:grid-cols-2">
          {items.map(([label, value]) => (
            <div key={label} className="bg-card p-4">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Contrapartidas
          </p>
          <p className="mt-2 text-sm leading-6">
            {offer.contrapartidas || "Nenhuma contrapartida registrada."}
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>
          Editar
        </Button>
        <Button size="lg" disabled={busy} onClick={onSubmit}>
          {busy ? "Avaliando…" : "Confirmar proposta"}
        </Button>
      </div>
    </div>
  );
}
