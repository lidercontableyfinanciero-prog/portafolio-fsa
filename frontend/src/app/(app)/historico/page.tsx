"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, RotateCcw } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import useSWR from "swr";

import { PositionsDrilldownModal, type DrilldownRequest } from "@/components/dashboard/PositionsDrilldownModal";
import { Card } from "@/components/ui/Card";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { fetcher } from "@/lib/api";
import { FSA } from "@/lib/colors";
import { useFilters } from "@/lib/filters";
import { fmtDeltaPct, fmtDeltaUSD, fmtPct, fmtUSD } from "@/lib/format";
import type { HistoricalMatrix, HistoricalPositionsBreakdown } from "@/lib/types";

const DELTA_KEYS = new Set(["variacion_abs", "variacion_pct"]);
// Filas que son series ya precalculadas a nivel portafolio (Dietz/TWR): no
// se pueden recomponer por Tipo/Clasificación sin reasignar flujos de caja.
const PORTFOLIO_WIDE_KEYS = new Set(["dietz", "twr_acumulado"]);
// Filas cuyo valor sí es una suma directa de posiciones -> se pueden
// desglosar por posición, mes a mes (ver /portfolio/historical/positions).
const DRILLDOWN_KEYS = new Set([
  "valor_mercado", "costo", "valor_informe", "gp_no_realizada", "rentab_sobre_costo",
]);

export default function HistoricoPage() {
  const { options } = useFilters();
  const [years, setYears] = useState<string[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [classifications, setClassifications] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownRequest | null>(null);

  const composeQuery = new URLSearchParams();
  for (const t of types) composeQuery.append("type", t);
  for (const c of classifications) composeQuery.append("classification", c);
  const composeQueryStr = composeQuery.toString();

  const { data, error, isLoading } = useSWR<HistoricalMatrix>(
    `/portfolio/historical${composeQueryStr ? `?${composeQueryStr}` : ""}`,
    fetcher,
    { keepPreviousData: true },
  );

  const breakdownKey = expanded
    ? `/portfolio/historical/positions?metric=${expanded}${composeQueryStr ? `&${composeQueryStr}` : ""}`
    : null;
  const { data: breakdown, isLoading: breakdownLoading } = useSWR<HistoricalPositionsBreakdown>(
    breakdownKey,
    fetcher,
  );

  const yearOpts = useMemo(
    () => [...new Set(data?.periods.map((p) => p.year) ?? [])].map(String),
    [data],
  );
  const monthOpts = useMemo(
    () => [...new Set(data?.periods.map((p) => p.month) ?? [])],
    [data],
  );
  const hasCompositionFilter = types.length > 0 || classifications.length > 0;

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

  const activeCount =
    (years.length ? 1 : 0) +
    (months.length ? 1 : 0) +
    (types.length ? 1 : 0) +
    (classifications.length ? 1 : 0);

  function toggle(key: string) {
    setExpanded((cur) => (cur === key ? null : key));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-600 text-fsa-navy">Histórico</h1>
          <p className="text-sm text-fsa-muted">
            Análisis horizontal: los indicadores clave en las filas y todos los meses,
            de forma consecutiva, en las columnas. Clic en un indicador para desplegar
            el detalle por posición, comparando todos los meses a la vez.
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
        <MultiSelect
          label="Tipo de Activo"
          values={types}
          onChange={setTypes}
          options={options?.types ?? []}
        />
        <MultiSelect
          label="Clasificación"
          values={classifications}
          onChange={setClassifications}
          options={options?.classifications ?? []}
        />
        {activeCount > 0 ? (
          <button
            onClick={() => {
              setYears([]);
              setMonths([]);
              setTypes([]);
              setClassifications([]);
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
                  const clickable = DRILLDOWN_KEYS.has(row.key);
                  const portfolioWide = hasCompositionFilter && PORTFOLIO_WIDE_KEYS.has(row.key);
                  const isOpen = expanded === row.key;
                  return (
                    <Fragment key={row.key}>
                      <tr
                        onClick={clickable ? () => toggle(row.key) : undefined}
                        className={`border-t border-fsa-border/60 ${
                          clickable ? "cursor-pointer hover:bg-fsa-surface-2/60" : ""
                        } ${isOpen ? "bg-fsa-surface-2/60" : ""}`}
                      >
                        <td className="sticky left-0 z-10 bg-white py-2 pr-4 font-500 text-fsa-navy">
                          <span className="inline-flex items-center gap-1.5">
                            {clickable ? (
                              <ChevronDown
                                className={`h-3.5 w-3.5 shrink-0 text-fsa-muted transition-transform ${
                                  isOpen ? "rotate-180" : ""
                                }`}
                                aria-hidden
                              />
                            ) : null}
                            {row.label}
                          </span>
                          {portfolioWide ? (
                            <span className="ml-1.5 text-[11px] font-400 text-fsa-muted">
                              (cartera completa, no aplica el filtro)
                            </span>
                          ) : null}
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

                      <AnimatePresence initial={false}>
                        {isOpen ? (
                          <tr>
                            <td colSpan={visibleIdx.length + 1} className="p-0">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                className="overflow-hidden bg-fsa-surface"
                              >
                                <div className="p-3">
                                  {breakdownLoading || !breakdown || breakdown.metric !== row.key ? (
                                    <Spinner label="Cargando posiciones…" />
                                  ) : !breakdown.rows.length ? (
                                    <EmptyState message="No hay posiciones para este corte." />
                                  ) : (
                                    <div className="overflow-x-auto scroll-thin rounded-lg border border-fsa-border bg-white">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b border-fsa-border text-left font-500 text-fsa-muted">
                                            <th className="py-1.5 pl-3 pr-3 font-600">Posición</th>
                                            {visibleIdx.map((i) => {
                                              const period = breakdown.periods[i] ?? data.periods[i];
                                              return (
                                                <th
                                                  key={i}
                                                  className="whitespace-nowrap py-1.5 px-2 text-right font-600 capitalize"
                                                >
                                                  <span className="inline-flex items-center gap-1">
                                                    {period.label}
                                                    <button
                                                      title={`Ver detalle de posiciones — ${period.label}`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDrilldown({
                                                          year: period.year,
                                                          month: period.month,
                                                          label: period.label,
                                                          metricLabel: row.label,
                                                          types,
                                                          classifications,
                                                        });
                                                      }}
                                                      className="text-fsa-muted hover:text-fsa-blue"
                                                    >
                                                      <ExternalLink className="h-3 w-3" aria-hidden />
                                                    </button>
                                                  </span>
                                                </th>
                                              );
                                            })}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {breakdown.rows.map((pr) => (
                                            <tr
                                              key={pr.identifier}
                                              className="border-b border-fsa-border/50 last:border-0"
                                            >
                                              <td
                                                className="max-w-[240px] truncate py-1.5 pl-3 pr-3 text-fsa-navy"
                                                title={pr.description}
                                              >
                                                {pr.description}
                                              </td>
                                              {visibleIdx.map((i) => {
                                                const v = pr.values[i];
                                                return (
                                                  <td key={i} className="tnum py-1.5 px-2 text-right">
                                                    {v == null
                                                      ? "—"
                                                      : row.kind === "pct"
                                                        ? fmtPct(v)
                                                        : fmtUSD(v)}
                                                  </td>
                                                );
                                              })}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        ) : null}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <PositionsDrilldownModal request={drilldown} onClose={() => setDrilldown(null)} />
    </div>
  );
}
