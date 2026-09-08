"use client";

import { RotateCcw } from "lucide-react";

import { Select } from "@/components/ui/Select";
import { useFilters } from "@/lib/filters";

const GRADES = ["Grado de Inversión", "Grado Especulativo"];

/** Segmentadores del Dashboard. Moody's y S&P se filtran de forma independiente. */
export function SlicerBar() {
  const f = useFilters();
  const months = f.periods
    .filter((p) => (f.year ? p.year === f.year : true))
    .map((p) => p.month);
  const years = [...new Set(f.periods.map((p) => p.year))];

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-fsa-border bg-white/70 px-4 py-3">
      <Select
        label="Año"
        value={f.year ? String(f.year) : ""}
        onChange={(v) => f.set("year", Number(v))}
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
      />
      <Select
        label="Mes"
        value={f.month ?? ""}
        onChange={(v) => f.set("month", v)}
        options={months}
      />
      <Select
        label="Tipo de activo"
        value={f.type}
        onChange={(v) => f.set("type", v)}
        options={f.options?.types ?? []}
        allowEmpty
      />
      <Select
        label="Clasificación"
        value={f.classification}
        onChange={(v) => f.set("classification", v)}
        options={f.options?.classifications ?? []}
        allowEmpty
      />
      <Select
        label="Sector"
        value={f.sector}
        onChange={(v) => f.set("sector", v)}
        options={f.options?.sectors ?? []}
        allowEmpty
      />
      <Select
        label="Calificación Moody's"
        value={f.moodysGrade}
        onChange={(v) => f.set("moodysGrade", v)}
        options={GRADES}
        allowEmpty
      />
      <Select
        label="Calificación S&P"
        value={f.spGrade}
        onChange={(v) => f.set("spGrade", v)}
        options={GRADES}
        allowEmpty
      />
      {f.activeCount > 0 ? (
        <button
          onClick={f.reset}
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg border border-fsa-border bg-white px-3 text-sm text-fsa-muted transition-colors hover:text-fsa-navy"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Limpiar {f.activeCount}
        </button>
      ) : null}
    </div>
  );
}
