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
  moodysGrade: string;
  spGrade: string;
}

interface FiltersCtx extends FilterState {
  set: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  reset: () => void;
  periods: Period[];
  options: FilterOptions | undefined;
  ready: boolean;
  query: string;
  activeCount: number;
}

const EMPTY: FilterState = {
  year: null,
  month: null,
  type: "",
  classification: "",
  sector: "",
  moodysGrade: "",
  spGrade: "",
};

const Ctx = createContext<FiltersCtx | null>(null);

export function buildQuery(s: FilterState): string {
  const p = new URLSearchParams();
  if (s.year) p.set("year", String(s.year));
  if (s.month) p.set("month", s.month);
  if (s.type) p.set("type", s.type);
  if (s.classification) p.set("classification", s.classification);
  if (s.sector) p.set("sector", s.sector);
  if (s.moodysGrade) p.set("moodys_grade", s.moodysGrade);
  if (s.spGrade) p.set("sp_grade", s.spGrade);
  return p.toString();
}

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const { data: periods } = useSWR<Period[]>("/portfolio/periods", fetcher);
  const { data: options } = useSWR<FilterOptions>("/portfolio/filters", fetcher);
  const [state, setState] = useState<FilterState>(EMPTY);

  useEffect(() => {
    if (periods && periods.length && state.year == null) {
      const last = periods[periods.length - 1];
      setState((s) => ({ ...s, year: last.year, month: last.month }));
    }
  }, [periods, state.year]);

  const value = useMemo<FiltersCtx>(() => {
    const set: FiltersCtx["set"] = (key, val) =>
      setState((s) => ({ ...s, [key]: val }));
    const activeCount = [
      state.type,
      state.classification,
      state.sector,
      state.moodysGrade,
      state.spGrade,
    ].filter(Boolean).length;
    return {
      ...state,
      set,
      reset: () =>
        setState((s) => ({ ...EMPTY, year: s.year, month: s.month })),
      periods: periods ?? [],
      options,
      ready: state.year != null,
      query: buildQuery(state),
      activeCount,
    };
  }, [state, periods, options]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilters() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFilters debe usarse dentro de <FiltersProvider>");
  return ctx;
}
