"use client";

import { RotateCcw } from "lucide-react";

import { Select } from "@/components/ui/Select";
import { useFilters } from "@/lib/filters";

/**
 * Segmentadores (Slicers) — pegajosos bajo el header. Al cambiar cualquiera,
 * el contexto de filtros se actualiza y SWR revalida todas las vistas.
 */
export function SlicerBar() {
  const f = useFilters();
  const months =
    f.periods
      .filter((p) => (f.year ? p.year === f.year : true))
      .map((p) => p.month) ?? [];
  const years = [...new Set(f.periods.map((p) => p.year))];

  return (
    <div className="sticky top-header z-10 flex flex-wrap items-end gap-3 border-b border-fsa-border bg-fsa-surface/95 px-4 py-3 backdrop-blur lg:px-6">
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
      <div className="flex items-end gap-2">
        <Select
          label="Calificación"
          value={f.ratingGrade}
          onChange={(v) => f.set("ratingGrade", v)}
          options={["Grado de Inversión", "Grado Especulativo"]}
          allowEmpty
        />
        <Select
          label="Agencia"
          value={f.ratingAgency}
          onChange={(v) => f.set("ratingAgency", v as "moodys" | "sp")}
          options={[
            { value: "moodys", label: "Moody's" },
            { value: "sp", label: "S&P" },
          ]}
        />
      </div>
      <button
        onClick={f.reset}
        className="ml-auto inline-flex min-h-[40px] items-center gap-1.5 rounded border border-fsa-border bg-white px-3 text-sm text-fsa-muted hover:text-fsa-navy"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        Limpiar
      </button>
    </div>
  );
}
