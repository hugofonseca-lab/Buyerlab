import { Link } from "@tanstack/react-router";
import { AlertTriangle, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RunLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <LoaderCircle className="mx-auto size-7 animate-spin text-accent" />
        <p className="mt-3 text-sm text-muted-foreground">Carregando sua simulação…</p>
      </div>
    </div>
  );
}

export function RunError({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4">
      <div className="panel w-full p-8 text-center">
        <AlertTriangle className="mx-auto size-9 text-warning" />
        <h1 className="mt-4 text-xl font-semibold">Não foi possível abrir a simulação</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex justify-center gap-2">
          {retry && (
            <Button onClick={retry}>
              <RotateCcw />
              Tentar novamente
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/configurar">Criar nova</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
