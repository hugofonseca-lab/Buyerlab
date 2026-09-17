import { useMemo } from "react";
import { useRun as usePersistedRun } from "./use-run";
import { toLovableSnapshot } from "./lovable-view";

export function useRun(runId: string) {
  const result = usePersistedRun(runId);
  const snapshot = useMemo(
    () => (result.snapshot ? toLovableSnapshot(result.snapshot) : null),
    [result.snapshot],
  );
  return { ...result, snapshot };
}
