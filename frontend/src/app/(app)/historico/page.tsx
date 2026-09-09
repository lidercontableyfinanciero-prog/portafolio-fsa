"use client";

import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { Card } from "@/components/ui/Card";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { fetcher } from "@/lib/api";
import { FSA } from "@/lib/colors";
import { fmtDeltaPct, fmtDeltaUSD, fmtPct, fmtUSD } from "@/lib/format";
import type { HistoricalMatrix } from "@/lib/types";

const DELTA_KEYS = new Set(["variacion_abs", "variacion_pct"]);

export default function HistoricoPage() {
  const { data, error, isLoading } = useSWR<HistoricalMatrix>(
    "/portfolio/historical",
    fetcher,
  );
  const [years, setYears] = useState<string[]>([]);
  const [months, setMonths] = useState<string[]>([]);

  const yearOpts = useMemo(
    () => [...new Set(data?.periods.map((p) => p.year) ?? [])].map(String),
    [data],
  );
  const monthOpts = useMemo(
    () => [...new Set(data?.periods.map((p) => p.month) ?? [])],
    [data],
  );

  const visibleIdx = useMemo(() => {
    if (!data) return [];
    return data.periods
      .map((p, i) => ({ p, i }))
      .filter(
        ({ p }) =>
          (years.length === 0 || years.includes(String(p.year))) &&
          (months.length === 0 || months.includes(p.month)),
      )
      .map(({ i }) => i);
  }, [data, years, months]);

  const activeCount = (years.length ? 1 : 0) + (months.length ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-600 text-fsa-navy">Histórico</h1>
          <p className="text-sm text-fsa-muted">
            Análisis horizontal: los indicadores clave en las filas y todos los meses,
            de forma consecutiva, en las columnas.
          </p>
        </div>
        <ExportMenu base="/export/dashboard" allowPrint />
      </div>

      {/* Panel de filtros temporales */}
      <Card className="flex flex-wrap items-end gap-3">
        <MultiSelect
          label="Año"
          values={years}
          onChange={setYears}
          options={yearOpts}
        />
        <MultiSelect
          label="Mes"
          values={months}
          onChange={setMonths}
          options={monthOpts}
        />
        {activeCount > 0 ? (
          <button
            onClick={() => {
              setYears([]);
              setMonths([]);
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-fsa-border bg-white px-3 text-sm text-fsa-muted hover:text-fsa-navy"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Limpiar {activeCount}
          </button>
        ) : null}
      </Card>

      {error ? (
        <ErrorState message={`No se pudo cargar el histórico: ${error.message}`} />
      ) : isLoading || !data ? (
        <Spinner label="Cargando histórico…" />
      ) : visibleIdx.length === 0 ? (
        <EmptyState message="Ningún período coincide con los filtros seleccionados." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs font-500 text-fsa-muted">
                  <th className="sticky left-0 z-10 bg-white py-2 pr-4 font-600">
                    Indicador
                  </th>
                  {visibleIdx.map((i) => (
                    <th
                      key={data.periods[i].label}
                      className="whitespace-nowrap py-2 px-3 text-right font-600 capitalize"
                    >
                      {data.periods[i].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const delta = DELTA_KEYS.has(row.key);
                  return (
                    <tr
                      key={row.key}
                      className="border-t border-fsa-border/60 hover:bg-fsa-surface-2/60"
                    >
                      <td className="sticky left-0 z-10 bg-white py-2 pr-4 font-500 text-fsa-navy">
                        {row.label}
                      </td>
                      {visibleIdx.map((i) => {
                        const v = row.values[i];
                        const fmt =
                          v == null
                            ? "—"
                            : delta
                              ? row.kind === "pct"
                                ? fmtDeltaPct(v)
                                : fmtDeltaUSD(v)
                              : row.kind === "pct"
                                ? fmtPct(v)
                                : fmtUSD(v);
                        const color =
                          v != null && (delta || row.key === "gp_no_realizada")
                            ? v >= 0
                              ? FSA.green
                              : FSA.red
                            : undefined;
                        return (
                          <td
                            key={i}
                            className="tnum whitespace-nowrap py-2 px-3 text-right"
                            style={color ? { color, fontWeight: 600 } : undefined}
                          >
                            {fmt}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
