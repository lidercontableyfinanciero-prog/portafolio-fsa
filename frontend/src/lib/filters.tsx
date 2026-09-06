"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/api";
import type { FilterOptions, Period } from "@/lib/types";

export interface FilterState {
  year: number | null;
  month: string | null;
  type: string;
  classification: string;
  sector: string;
  ratingGrade: string;
  ratingAgency: "moodys" | "sp";
}

interface FiltersCtx extends FilterState {
  set: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  reset: () => void;
  periods: Period[];
  options: FilterOptions | undefined;
  ready: boolean;
  /** query string para /portfolio/* y /positions */
  query: string;
}

const EMPTY: FilterState = {
  year: null,
  month: null,
  type: "",
  classification: "",
  sector: "",
  ratingGrade: "",
  ratingAgency: "moodys",
};

const Ctx = createContext<FiltersCtx | null>(null);

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const { data: periods } = useSWR<Period[]>("/portfolio/periods", fetcher);
  const { data: options } = useSWR<FilterOptions>("/portfolio/filters", fetcher);
  const [state, setState] = useState<FilterState>(EMPTY);

  // Inicializa con el período más reciente
  useEffect(() => {
    if (periods && periods.length && state.year == null) {
      const last = periods[periods.length - 1];
      setState((s) => ({ ...s, year: last.year, month: last.month }));
    }
  }, [periods, state.year]);

  const value = useMemo<FiltersCtx>(() => {
    const set: FiltersCtx["set"] = (key, val) =>
      setState((s) => ({ ...s, [key]: val }));
    const params = new URLSearchParams();
    if (state.year) params.set("year", String(state.year));
    if (state.month) params.set("month", state.month);
    if (state.type) params.set("type", state.type);
    if (state.classification) params.set("classification", state.classification);
    if (state.sector) params.set("sector", state.sector);
    if (state.ratingGrade) {
      params.set("rating_grade", state.ratingGrade);
      params.set("rating_agency", state.ratingAgency);
    }
    return {
      ...state,
      set,
      reset: () =>
        setState((s) => ({
          ...EMPTY,
          year: s.year,
          month: s.month,
        })),
      periods: periods ?? [],
      options,
      ready: state.year != null,
      query: params.toString(),
    };
  }, [state, periods, options]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilters() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFilters debe usarse dentro de <FiltersProvider>");
  return ctx;
}
