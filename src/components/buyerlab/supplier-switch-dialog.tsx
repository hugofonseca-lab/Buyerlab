import { useEffect, useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import type { SupplierCandidate } from "@/domain/lovable-ui";
import { brl, moeda, rotuloRisco } from "@/lib/format";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SupplierSwitchDialog({
  current,
  candidates,
  disabled,
  onConfirm,
}: {
  current: SupplierCandidate;
  candidates: SupplierCandidate[];
  disabled: boolean;
  onConfirm: (supplierId: string, justification: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(
    candidates.find((item) => item.id !== current.id)?.id ?? "",
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (selected === current.id || !candidates.some((item) => item.id === selected))
      setSelected(candidates.find((item) => item.id !== current.id)?.id ?? "");
  }, [current.id, candidates, selected]);
  const target = candidates.find((item) => item.id === selected);
  async function confirm(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!target || reason.trim().length < 12) {
      setError("Informe uma justificativa de pelo menos 12 caracteres.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(target.id, reason);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível trocar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}>
          <ArrowRightLeft />
          {disabled ? "Troca já utilizada" : "Avaliar outro fornecedor"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Avaliar troca de fornecedor</AlertDialogTitle>
          <AlertDialogDescription>
            A conversa atual será preservada. No MVP, esta decisão pode ser feita apenas uma vez.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {candidates
              .filter((item) => item.id !== current.id)
              .map((item) => (
                <label
                  key={item.id}
                  className={`cursor-pointer rounded-md border p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${selected === item.id ? "border-accent ring-1 ring-accent" : ""}`}
                >
                  <input
                    type="radio"
                    name="supplier"
                    value={item.id}
                    checked={selected === item.id}
                    onChange={() => setSelected(item.id)}
                    className="sr-only"
                  />
                  <span className="font-semibold">{item.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {moeda(item.quoteUnitPrice, item.currency)}/t · {item.leadTimeDays} dias · risco{" "}
                    {rotuloRisco[item.logisticsRisk]?.toLowerCase()}
                  </span>
                </label>
              ))}
          </div>
          {target && (
            <div className="rounded-md border border-warning/40 bg-warning/5 p-4 text-sm">
              <p className="font-semibold">Consequências da mudança</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>Custo estimado de homologação: {brl(target.switchingCost)}</li>
                <li>Prazo de qualificação: {target.qualificationDays} dias</li>
                <li>Risco logístico: {rotuloRisco[target.logisticsRisk]}</li>
                <li>{target.esgImpact}</li>
              </ul>
            </div>
          )}
          <div>
            <Label htmlFor="switch-reason">Justificativa estratégica</Label>
            <Textarea
              id="switch-reason"
              maxLength={500}
              className="mt-2"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explique por que custo total, prazo, qualidade ou risco justificam a troca."
              aria-describedby={error ? "switch-error" : undefined}
            />
            {error && (
              <p id="switch-error" role="alert" className="mt-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Continuar com {current.name}</AlertDialogCancel>
          <AlertDialogAction onClick={(event) => void confirm(event)} disabled={busy || !target}>
            {busy ? (
              <>
                <Loader2 className="animate-spin" />
                Confirmando…
              </>
            ) : (
              "Confirmar mudança"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
