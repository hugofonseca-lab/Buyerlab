import { useEffect, useState } from "react";
import { Check, NotebookPen } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NotesPanel({
  initial,
  onSave,
  compact = false,
}: {
  initial: string;
  onSave: (value: string) => Promise<void>;
  compact?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    setValue(initial);
  }, [initial]);
  useEffect(() => {
    if (value === initial) return;
    setSaved(false);
    const id = window.setTimeout(() => {
      setError(false);
      void onSave(value)
        .then(() => setSaved(true))
        .catch(() => setError(true));
    }, 500);
    return () => window.clearTimeout(id);
  }, [value, initial, onSave]);
  return (
    <div className={compact ? "" : "panel p-5 sm:p-6"}>
      <div className="mb-3 flex items-center justify-between">
        <Label htmlFor="private-notes" className="flex items-center gap-2 font-semibold">
          <NotebookPen className="size-4 text-accent" />
          Anotações privadas
        </Label>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {saved && <Check className="size-3" />}
          {error ? "Falha ao salvar: edite para tentar novamente" : saved ? "Salvo" : "Salvando…"}
        </span>
      </div>
      <Textarea
        maxLength={8000}
        id="private-notes"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Registre hipóteses, interesses e próximos movimentos…"
        className={compact ? "min-h-28" : "min-h-44"}
      />
      <p
        className={
          compact
            ? "mt-2 text-xs text-muted-foreground lg:min-h-8"
            : "mt-2 text-xs text-muted-foreground"
        }
      >
        Somente sua sessão vê estas notas. Elas são salvas no servidor.
      </p>
    </div>
  );
}
