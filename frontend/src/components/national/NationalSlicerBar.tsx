"use client";

import { RotateCcw } from "lucide-react";
import useSWR from "swr";

import { MultiSelect } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Select";
import { fetcher } from "@/lib/api";
import { useNationalFilters } from "@/lib/national";

interface Status {
  periods: { year: number; month: number; label: string }[];
}

const TYPE_LABEL: Record<string, string> = {
  CDT: "CDT",
  Bono: "Bonos",
  FIC: "FIC (Cartera Colectiva)",
  FCP: "FCP / Futuros",
};

/** Segmentadores del Portafolio Nacional: mes de corte + tipo, entidad,
 * grupo, emisor y estado. Afectan a todas las pantallas del módulo. */
export function NationalSlicerBar({ showCut = true }: { showCut?: boolean }) {
  const { state, set, reset, activeCount, options } = useNationalFilters();
  const { data: status } = useSWR<Status>("/national/status", fetcher);
  const periods = status?.periods ?? [];
  const last = periods[periods.length - 1];

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-fsa-border bg-white/70 px-4 py-3 print:hidden">
      {showCut ? (
        <Select
          label="Mes de corte"
          value={state.cut || (last ? `${last.year}-${last.month}` : "")}
          onChange={(v) => set("cut", v)}
          options={[...periods].reverse().map((p) => ({
            value: `${p.year}-${p.month}`,
            label: p.label,
          }))}
        />
      ) : null}
      <MultiSelect
        label="Tipo de inversión"
        values={state.types}
        onChange={(v) => set("types", v)}
        options={(options?.types ?? []).map((t) => ({ value: t, label: TYPE_LABEL[t] ?? t }))}
      />
      <MultiSelect
        label="Entidad / Administrador"
        values={state.entities}
        onChange={(v) => set("entities", v)}
        options={options?.entities ?? []}
      />
      <MultiSelect
        label="Emisor"
        values={state.issuers}
        onChange={(v) => set("issuers", v)}
        options={options?.issuers ?? []}
      />
      <MultiSelect
        label="Grupo"
        values={state.groups}
        onChange={(v) => set("groups", v)}
        options={options?.groups ?? []}
      />
      <MultiSelect
        label="Estado"
        values={state.statuses}
        onChange={(v) => set("statuses", v)}
        options={options?.statuses ?? []}
      />
      {activeCount > 0 ? (
        <button
          onClick={reset}
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg border border-fsa-border bg-white px-3 text-sm text-fsa-muted transition-colors hover:text-fsa-navy"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Limpiar {activeCount}
        </button>
      ) : null}
    </div>
  );
}
