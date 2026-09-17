import { useCallback, useEffect, useState } from "react";
import type { MarketIndicatorsSnapshot } from "@/domain/market-indicators";

export function useMarketIndicators() {
  const [data, setData] = useState<MarketIndicatorsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/market-indicators", {
        credentials: "same-origin",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Não foi possível carregar os indicadores de mercado.");
      setData((await response.json()) as MarketIndicatorsSnapshot);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os indicadores de mercado.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, loading, error, refresh };
}
