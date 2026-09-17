import { useCallback, useEffect, useState } from "react";
import type { RunSnapshot } from "@/domain/types";
import { useSimulation } from "./context";

export function useRun(runId: string) {
  const simulation = useSimulation();
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await simulation.getRun(runId);
      setSnapshot(next);
      if (!next) setError("Esta execução não foi encontrada neste navegador.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar a execução.");
    } finally {
      setLoading(false);
    }
  }, [runId, simulation]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { snapshot, setSnapshot, loading, error, refresh, simulation };
}
