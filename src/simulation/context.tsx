import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SimulationProvider } from "./provider";
import { ApiSimulationProvider } from "./provider";

const SimulationContext = createContext<SimulationProvider | null>(null);

export function SimulationProviderRoot({ children }: { children: ReactNode }) {
  const provider = useMemo(() => new ApiSimulationProvider(), []);
  return <SimulationContext.Provider value={provider}>{children}</SimulationContext.Provider>;
}

export function useSimulation(): SimulationProvider {
  const provider = useContext(SimulationContext);
  if (!provider) throw new Error("SimulationProviderRoot não encontrado.");
  return provider;
}
