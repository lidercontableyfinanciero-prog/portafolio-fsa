"use client";

import { createContext, useContext, useMemo, useState } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/api";

/* ------------------------------------------------------------------ tipos */
export type AlertStatus = "Crítico" | "Atención" | "OK" | "N/A" | "N/D" | "Sobresaliente";
export type Classification =
  | "En riesgo"
  | "En seguimiento"
  | "Sobresaliente"
  | "Normal"
  | "Cerrado";

export interface NationalAsset {
  name: string;
  asset_type: "CDT" | "Bono" | "FIC" | "FCP";
  group: string;
  issuer: string;
  entity: string | null;
  low_liquidity: boolean;
  benchmark_rule: string;
  needs_review: boolean;
  values: Record<string, number>;
  returns: Record<string, number>;
  coupons: Record<string, number>;
  value_base: number;
  value_cut: number;
  sum_value_months: number;
  avg_balance: number;
  months_with_value: number;
  period_return: number;
  rent_period: number;
  rent_ea: number | null;
  benchmark_ea: number | null;
  diff_vs_benchmark: number | null;
  coupons_total: number;
  paid_income: number;
  weight: number;
  nemo: string | null;
  ref: string | null;
  per: string | null;
  nominal_value: number | null;
  purchase_value: number | null;
  sale_value: number | null;
  pnl: number | null;
  holding_irr: number | null;
  sale_rate: number | null;
  coupon_rate: number | null;
  rate_em: number | null;
  issue_date: string | null;
  purchase_date: string | null;
  maturity_date: string | null;
  sale_purchase_diff: number | null;
  income_tax_20: number | null;
  discount: number | null;
  years_remaining: number | null;
  days_to_maturity: number | null;
  cal: number | null;
  status: string;
  prev_balance: number;
  deposits: number;
  withdrawals: number;
  month_returns: number;
  st_issuer: AlertStatus;
  st_liquidity: AlertStatus;
  st_term: AlertStatus;
  st_maturity: AlertStatus;
  st_rate: AlertStatus;
  st_return: AlertStatus;
  classification: Classification;
  observation: string;
}

export interface ReturnsRow {
  label: string;
  value_base: number;
  value_cut: number;
  avg_balance: number;
  return: number;
  rent_period: number;
  rent_ea: number | null;
  benchmark_period: number | null;
  benchmark_ea: number | null;
  diff_vs_benchmark: number | null;
  result: string | null;
}

export interface LimitRow {
  key: "baja_liquidez" | "emisor" | "plazo";
  rule: string;
  reference: string;
  value: number;
  limit: number;
  use: number;
  unit: "pct" | "years";
  status: string;
  detail: string[];
}

export interface NationalReport {
  cut: { year: number; month: number; month_name: string; label: string; date: string };
  base: { year: number; month: number; label: string; date: string };
  months_elapsed: number;
  periods: { year: number; month: number; label: string; month_name: string }[];
  filtered: boolean;
  benchmark: {
    ipc_ytd: number | null;
    ipc_12m: number | null;
    spread: number;
    period: number | null;
    ea: number | null;
    liquid_period: number | null;
    liquid_ea: number | null;
  };
  kpis: {
    paid_income: number;
    total_value: number;
    mom_pct: number | null;
    mom_abs: number | null;
    rent_period: number;
    rent_ea: number | null;
    benchmark_ea: number | null;
    benchmark_period: number | null;
    diff_vs_benchmark: number | null;
    positions_open: number;
    positions_total: number;
    classification_counts: Partial<Record<Classification, number>>;
  };
  allocation: { type: string; label: string; value: number; share: number }[];
  by_entity: { label: string; value: number; share: number }[];
  by_issuer: { label: string; value: number; share: number }[];
  by_term: { label: string; value: number; share: number }[];
  returns_by_group: ReturnsRow[];
  returns_total: ReturnsRow;
  trend: {
    period: string;
    close_date: string;
    month_return: number;
    portfolio_value: number;
    cum_return: number;
    cum_benchmark: number | null;
    diff: number | null;
    result: string | null;
  }[];
  series: {
    periods: string[];
    total: number[];
    mom: (number | null)[];
    by_group: Record<string, number[]>;
    by_type: Record<string, number[]>;
  };
  limits: LimitRow[];
  issuers: { issuer: string; value: number; share: number; limit: number; use: number; status: string }[];
  assets: NationalAsset[];
  needs_review: string[];
}

export interface NationalFilterOptions {
  types: string[];
  groups: string[];
  entities: string[];
  issuers: string[];
  statuses: string[];
}

/* ----------------------------------------------------------- filtros */
export interface NationalFilterState {
  cut: string; // "2026-8" o "" (último)
  types: string[];
  entities: string[];
  groups: string[];
  issuers: string[];
  statuses: string[];
}

const EMPTY: NationalFilterState = {
  cut: "", types: [], entities: [], groups: [], issuers: [], statuses: [],
};

interface Ctx {
  state: NationalFilterState;
  set: <K extends keyof NationalFilterState>(k: K, v: NationalFilterState[K]) => void;
  reset: () => void;
  query: string;
  activeCount: number;
  options: NationalFilterOptions | undefined;
}

const NationalCtx = createContext<Ctx | null>(null);

export function buildNationalQuery(s: NationalFilterState): string {
  const p = new URLSearchParams();
  if (s.cut) {
    const [y, m] = s.cut.split("-");
    p.set("year", y);
    p.set("month", m);
  }
  for (const v of s.types) p.append("type", v);
  for (const v of s.entities) p.append("entity", v);
  for (const v of s.groups) p.append("group", v);
  for (const v of s.issuers) p.append("issuer", v);
  for (const v of s.statuses) p.append("status", v);
  return p.toString();
}

/** Filtros compartidos por todas las pantallas del módulo nacional: al cambiar
 * uno se recalculan KPIs, gráficos, tablas y posiciones (mismo endpoint). */
export function NationalFiltersProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NationalFilterState>(EMPTY);
  const { data: options } = useSWR<NationalFilterOptions>("/national/filters", fetcher);
  const value = useMemo<Ctx>(
    () => ({
      state,
      set: (k, v) => setState((s) => ({ ...s, [k]: v })),
      reset: () => setState((s) => ({ ...EMPTY, cut: s.cut })),
      query: buildNationalQuery(state),
      activeCount: [state.types, state.entities, state.groups, state.issuers, state.statuses]
        .filter((x) => x.length).length,
      options,
    }),
    [state, options],
  );
  return <NationalCtx.Provider value={value}>{children}</NationalCtx.Provider>;
}

export function useNationalFilters() {
  const ctx = useContext(NationalCtx);
  if (!ctx) throw new Error("useNationalFilters debe usarse dentro de <NationalFiltersProvider>");
  return ctx;
}

/** Modelo único del portafolio nacional para el corte y filtros activos. */
export function useNationalReport() {
  const { query } = useNationalFilters();
  return useSWR<NationalReport>(`/national/report${query ? `?${query}` : ""}`, fetcher, {
    keepPreviousData: true,
  });
}

/* ----------------------------------------------------------- colores */
export const CLASS_COLOR: Record<string, string> = {
  "En riesgo": "#C0392B",
  "En seguimiento": "#E0A100",
  Sobresaliente: "#1E7B34",
  Normal: "#156082",
  Cerrado: "#6B7280",
};
export const STATUS_COLOR: Record<string, string> = {
  "Crítico": "#C0392B",
  "Atención": "#E0A100",
  OK: "#1E7B34",
  Sobresaliente: "#1E7B34",
  "N/A": "#9CA3AF",
  "N/D": "#9CA3AF",
};
export const limitColor = (status: string) =>
  status.startsWith("Excede") ? "#C0392B" : status.startsWith("Cerca") ? "#E0A100" : "#1E7B34";
