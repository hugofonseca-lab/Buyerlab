/** Painel informativo de mercado no topo do dossiê do cenário. Não alimenta o motor de negociação. */
export type IndicatorCode = "USD_BRL" | "ALUMINUM" | "PIM_PF" | "SUPPLIERS";
export interface IndicatorPoint {
  date: string;
  value: number;
}
export interface IndicatorHistory {
  code: IndicatorCode;
  name: string;
  unit: string;
  points: IndicatorPoint[];
  projection: IndicatorPoint[];
}
export interface IndicatorValue {
  code: IndicatorCode;
  name: string;
  value: number;
  unit: string;
  date: string;
  source: string;
  url: string | null;
  status: "real" | "simulado";
  stale: boolean;
}
export interface PtaxValue extends IndicatorValue {
  buy: number;
  sell: number;
}
export interface SuppliersValue extends IndicatorValue {
  countries: string[];
}
export interface MarketIndicatorsSnapshot {
  fetchedAt: string;
  ptax: PtaxValue;
  aluminum: IndicatorValue;
  industrial: IndicatorValue;
  suppliers: SuppliersValue;
  history: IndicatorHistory[];
  fallbackUsed: boolean;
  warnings: string[];
}
