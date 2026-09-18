import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Copy, Dices, Play, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Difficulty,
  RunConfig,
  SimulationMode,
  SupplierProfile,
  Urgency,
} from "@/domain/types";
import { randomSeed } from "@/lib/prng";
import { useSimulation } from "@/simulation/context";

interface Props {
  instructor?: boolean;
  defaults?: Partial<RunConfig>;
}

export function ConfigForm({ instructor = false, defaults }: Props) {
  const simulation = useSimulation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<SimulationMode>(defaults?.modo ?? "treinamento");
  const [difficulty, setDifficulty] = useState<Difficulty>(
    defaults?.dificuldade ?? "intermediario",
  );
  const [profile, setProfile] = useState<SupplierProfile | "aleatorio">(
    defaults?.perfil ?? "aleatorio",
  );
  const [urgency, setUrgency] = useState<Urgency>(defaults?.urgencia ?? "media");
  const scenarioType = defaults?.scenarioType ?? "aluminum";
  const [material] = useState(defaults?.materialId ?? "aleatorio");
  const [seed, setSeed] = useState(defaults?.seed ?? "");
  const [buyerName, setBuyerName] = useState(defaults?.buyerName ?? "");
  useEffect(() => {
    if (!defaults?.seed) setSeed(randomSeed());
  }, [defaults?.seed]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = () => {
    const params = new URLSearchParams({
      modo: mode,
      dif: difficulty,
      perfil: profile,
      urgencia: urgency,
      seed,
      cenario: scenarioType,
      ...(material !== "aleatorio" ? { material } : {}),
    });
    return `${window.location.origin}/configurar?${params.toString()}`;
  };

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const run = await simulation.createRun({
        modo: mode,
        dificuldade: difficulty,
        perfil: profile,
        urgencia: urgency,
        seed: seed.trim() || randomSeed(),
        scenarioType,
        ...(material !== "aleatorio"
          ? { materialId: material as import("@/domain/aluminum").MaterialId }
          : {}),
        ...(buyerName.trim() ? { buyerName: buyerName.trim() } : {}),
      });
      await navigate({ to: "/preparacao/$runId", params: { runId: run.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar o link. Verifique a permissão do navegador.");
    }
  }

  return (
    <div className="panel mx-auto max-w-3xl p-5 sm:p-8">
      {error && (
        <p role="alert" className="mb-4 text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Modo"
          hint={
            mode === "treinamento"
              ? "Dicas e feedback pedagógico completo."
              : "Sem dicas; condições controladas e comparáveis."
          }
        >
          <Select value={mode} onValueChange={(value) => setMode(value as SimulationMode)}>
            <SelectTrigger id="modo" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="treinamento">Treinamento</SelectItem>
              <SelectItem value="avaliacao">Avaliação</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Dificuldade" hint="Define o número de turnos e a tolerância do fornecedor.">
          <Select
            disabled={mode === "avaliacao"}
            value={mode === "avaliacao" ? "intermediario" : difficulty}
            onValueChange={(value) => setDifficulty(value as Difficulty)}
          >
            <SelectTrigger id="dificuldade" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="iniciante">Iniciante · 12 turnos</SelectItem>
              <SelectItem value="intermediario">Intermediário · 10 turnos</SelectItem>
              <SelectItem value="avancado">Avançado · 8 turnos</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Perfil do fornecedor"
          hint={
            instructor
              ? "Fixe um estilo para comparar participantes."
              : "Aleatório mantém cada sessão desafiadora."
          }
        >
          <Select
            disabled={mode === "avaliacao"}
            value={mode === "avaliacao" ? "aleatorio" : profile}
            onValueChange={(value) => setProfile(value as SupplierProfile | "aleatorio")}
          >
            <SelectTrigger id="perfil" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aleatorio">Aleatório</SelectItem>
              <SelectItem value="colaborativo">Colaborativo</SelectItem>
              <SelectItem value="analitico">Analítico</SelectItem>
              <SelectItem value="dominante">Dominante</SelectItem>
              <SelectItem value="defensivo">Defensivo</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Urgência"
          hint="Altera pressão e disposição inicial e a cobertura do estoque."
        >
          <Select
            disabled={mode === "avaliacao"}
            value={mode === "avaliacao" ? "media" : urgency}
            onValueChange={(value) => setUrgency(value as Urgency)}
          >
            <SelectTrigger id="urgencia" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Seu nome (opcional)"
          hint="O fornecedor vai se dirigir a você pelo nome durante a negociação."
        >
          <Input
            id="buyerName"
            value={buyerName}
            onChange={(event) => setBuyerName(event.target.value)}
            maxLength={40}
            placeholder="Ex.: Hugo"
            className="h-11"
          />
        </Field>
        <div className="sm:col-span-2">
          <div className="flex items-end gap-2">
            <Field
              label="Seed da simulação"
              hint="A mesma seed repete as mesmas condições."
              className="min-w-0 flex-1"
            >
              <Input
                id="seed"
                value={seed}
                onChange={(event) => setSeed(event.target.value.toUpperCase())}
                maxLength={24}
                className="h-11 font-mono uppercase"
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="mb-6 size-11 shrink-0"
              title="Gerar nova seed"
              aria-label="Gerar nova seed"
              onClick={() => setSeed(randomSeed())}
            >
              <Dices />
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-7 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Settings2 className="size-4" />
          <span>
            {scenarioType === "aluminum"
              ? "Chapas de alumínio · cenário paramétrico reproduzível"
              : "Cenário legado · Orion × Nexa"}
          </span>
        </div>
        <div className="flex gap-2">
          {instructor && (
            <Button type="button" variant="outline" onClick={copyLink}>
              <Copy />
              {copied ? "Link copiado" : "Copiar link"}
            </Button>
          )}
          <Button type="button" size="lg" onClick={start} disabled={busy}>
            <Play />
            {busy ? "Preparando…" : "Iniciar simulação"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label
        htmlFor={
          {
            Modo: "modo",
            Dificuldade: "dificuldade",
            "Perfil do fornecedor": "perfil",
            Urgência: "urgencia",
            "Seu nome (opcional)": "buyerName",
            "Seed da simulação": "seed",
          }[label]
        }
        className="mb-2 block text-sm font-semibold"
      >
        {label}
      </Label>
      {children}
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{hint}</p>
    </div>
  );
}
