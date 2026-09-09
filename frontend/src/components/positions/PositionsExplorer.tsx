"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronsUpDown, RotateCcw } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import useSWR from "swr";

import { PositionHistoryChart } from "@/components/positions/PositionHistoryChart";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { fetcher } from "@/lib/api";
import { FSA, gradeColor, stopLossColor } from "@/lib/colors";
import { fmtPct, fmtUSD } from "@/lib/format";
import { useFilters } from "@/lib/filters";
import type { PositionRow, PositionsResponse } from "@/lib/types";

const col = createColumnHelper<PositionRow>();
const GRADES = ["Grado de Inversión", "Grado Especulativo"];
const STOP_LOSS_VALUES = [
  "Inversión Estable / Pérdida tolerable",
  "Monitoreo",
  "Evaluar Venta",
  "Ejecutar Venta - Previa Revisión",
];
const ALERT_VALUES = ["OK", "Revisar"];
const PAGE_SIZE = 20;

const SHORT_STOP_LOSS: Record<string, string> = {
  "Inversión Estable / Pérdida tolerable": "Estable",
  Monitoreo: "Monitoreo",
  "Evaluar Venta": "Evaluar venta",
  "Ejecutar Venta - Previa Revisión": "Ejecutar venta",
};

type MultiKey =
  | "types"
  | "classifications"
  | "sectors"
  | "moodysGrades"
  | "spGrades"
  | "stopLosses"
  | "timeAlerts"
  | "issuerAlerts";

const EMPTY_MULTI: Record<MultiKey, string[]> = {
  types: [],
  classifications: [],
  sectors: [],
  moodysGrades: [],
  spGrades: [],
  stopLosses: [],
  timeAlerts: [],
  issuerAlerts: [],
};

const money = { meta: { num: true } } as const;

const alertColor = (v: string) => (v === "OK" ? FSA.green : FSA.orange);

export function PositionsExplorer() {
  const { periods, options } = useFilters();
  const latest = periods[periods.length - 1];

  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [multi, setMulti] = useState<Record<MultiKey, string[]>>(EMPTY_MULTI);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("market_value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const effYear = year ?? latest?.year ?? null;
  const effMonth = month ?? latest?.month ?? null;

  function setM(k: MultiKey, v: string[]) {
    setMulti((s) => ({ ...s, [k]: v }));
    setPage(1);
    setExpanded(null);
  }

  const params = new URLSearchParams();
  if (effYear) params.set("year", String(effYear));
  if (effMonth) params.set("month", effMonth);
  const P: [MultiKey, string][] = [
    ["types", "type"],
    ["classifications", "classification"],
    ["sectors", "sector"],
    ["moodysGrades", "moodys_grade"],
    ["spGrades", "sp_grade"],
    ["stopLosses", "stop_loss"],
    ["timeAlerts", "time_alert"],
    ["issuerAlerts", "issuer_alert"],
  ];
  for (const [k, qp] of P) for (const v of multi[k]) params.append(qp, v);
  const exportQuery = params.toString();

  const key =
    effYear && effMonth
      ? `/positions?${exportQuery}&sort_by=${sortBy}&sort_dir=${sortDir}` +
        `&page=${page}&page_size=${PAGE_SIZE}` +
        (search ? `&search=${encodeURIComponent(search)}` : "")
      : null;

  const { data, error, isLoading } = useSWR<PositionsResponse>(key, fetcher, {
    keepPreviousData: true,
  });

  const activeCount =
    P.reduce((n, [k]) => n + (multi[k].length ? 1 : 0), 0) + (search ? 1 : 0);

  const columns = useMemo(
    () => [
      col.accessor("description", { header: "Descripción" }),
      col.accessor("identifier", {
        header: "CUSIP/CINS",
        cell: (c) =>
          c.getValue() === c.row.original.description ? (
            <span className="text-fsa-muted">—</span>
          ) : (
            c.getValue()
          ),
      }),
      col.accessor("type", { header: "Tipo" }),
      col.accessor("sector", { header: "Sector" }),
      col.accessor("cost_basis", { header: "Costo", cell: (c) => fmtUSD(c.getValue()), ...money }),
      col.accessor("market_value", {
        header: "V. Mercado",
        cell: (c) => fmtUSD(c.getValue()),
        ...money,
      }),
      col.accessor("unrealized_gain_loss", {
        header: "G/(P) No Realizada",
        cell: (c) => (
          <span
            className="tnum font-600"
            style={{ color: c.getValue() >= 0 ? FSA.green : FSA.red }}
          >
            {fmtUSD(c.getValue())}
          </span>
        ),
        ...money,
      }),
      col.accessor("return_on_cost", {
        header: "Rentab. s/ Costo",
        cell: (c) => fmtPct(c.getValue()),
        ...money,
      }),
      col.accessor("current_yield", {
        header: "Yield actual",
        cell: (c) => fmtPct(c.getValue()),
        ...money,
      }),
      col.accessor("dividends_paid", {
        header: "Int./Div. pagados",
        cell: (c) => fmtUSD(c.getValue()),
        ...money,
      }),
      col.accessor("tax", { header: "Impuesto", cell: (c) => fmtUSD(c.getValue()), ...money }),
      col.accessor("tax_rate", {
        header: "Tasa impositiva",
        cell: (c) => fmtPct(c.getValue()),
        ...money,
      }),
      col.accessor("equity_return_on_cost", {
        header: "Rentab. Costo (RV)",
        cell: (c) =>
          c.row.original.classification === "Renta Variable" ? fmtPct(c.getValue()) : "—",
        ...money,
      }),
      col.accessor("equity_market_value_return", {
        header: "Rentab. V. Mercado (RV)",
        cell: (c) =>
          c.row.original.classification === "Renta Variable" ? fmtPct(c.getValue()) : "—",
        ...money,
      }),
      col.accessor("moodys_rating", {
        header: "Moody's",
        cell: (c) => <span className="tnum">{c.getValue() ?? "—"}</span>,
      }),
      col.accessor("moodys_grade", {
        header: "KPI Riesgo Moody's",
        cell: (c) => <Badge color={gradeColor(c.getValue())}>{c.getValue()}</Badge>,
      }),
      col.accessor("sp_rating", {
        header: "S&P",
        cell: (c) => <span className="tnum">{c.getValue() ?? "—"}</span>,
      }),
      col.accessor("sp_grade", {
        header: "KPI Riesgo S&P",
        cell: (c) => <Badge color={gradeColor(c.getValue())}>{c.getValue()}</Badge>,
      }),
      col.accessor("stop_loss", {
        header: "Stop-Loss",
        cell: (c) => (
          <span title={c.getValue()}>
            <Badge color={stopLossColor(c.getValue())} className="whitespace-nowrap">
              {SHORT_STOP_LOSS[c.getValue()] ?? c.getValue()}
            </Badge>
          </span>
        ),
      }),
      col.accessor("time_alert", {
        header: "Alerta Tiempo",
        cell: (c) => <Badge color={alertColor(c.getValue())}>{c.getValue()}</Badge>,
      }),
      col.accessor("issuer_alert", {
        header: "Alerta Emisor",
        cell: (c) => <Badge color={alertColor(c.getValue())}>{c.getValue()}</Badge>,
      }),
    ],
    [],
  );

  const SORTABLE = new Set([
    "description", "identifier", "type", "sector", "cost_basis", "market_value",
    "unrealized_gain_loss", "return_on_cost", "current_yield", "dividends_paid",
    "tax", "tax_rate", "equity_return_on_cost", "equity_market_value_return",
    "moodys_grade", "sp_grade", "stop_loss", "time_alert", "issuer_alert",
  ]);
  const SORT_KEY: Record<string, string> = {
    moodys_rating: "moodys_grade",
    sp_rating: "sp_grade",
  };

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  function toggleSort(id: string) {
    const k = SORT_KEY[id] ?? id;
    if (!SORTABLE.has(k)) return;
    if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(k);
      setSortDir("desc");
    }
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const colCount = table.getVisibleFlatColumns().length;

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Año"
            value={effYear ? String(effYear) : ""}
            onChange={(v) => {
              setYear(Number(v));
              setPage(1);
              setExpanded(null);
            }}
            options={[...new Set(periods.map((p) => p.year))].map((y) => ({
              value: String(y),
              label: String(y),
            }))}
          />
          <Select
            label="Mes"
            value={effMonth ?? ""}
            onChange={(v) => {
              setMonth(v);
              setPage(1);
              setExpanded(null);
            }}
            options={periods.filter((p) => p.year === effYear).map((p) => p.month)}
          />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-500 text-fsa-muted">Buscar</span>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Descripción o CUSIP…"
              className="h-10 w-56 rounded-lg border border-fsa-border px-3 text-sm outline-none focus:border-fsa-blue"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <MultiSelect
            label="Tipo de activo"
            values={multi.types}
            onChange={(v) => setM("types", v)}
            options={options?.types ?? []}
          />
          <MultiSelect
            label="Clasificación"
            values={multi.classifications}
            onChange={(v) => setM("classifications", v)}
            options={options?.classifications ?? []}
          />
          <MultiSelect
            label="Sector"
            values={multi.sectors}
            onChange={(v) => setM("sectors", v)}
            options={options?.sectors ?? []}
          />
          <MultiSelect
            label="KPI Riesgo Moody's"
            values={multi.moodysGrades}
            onChange={(v) => setM("moodysGrades", v)}
            options={GRADES}
          />
          <MultiSelect
            label="KPI Riesgo S&P"
            values={multi.spGrades}
            onChange={(v) => setM("spGrades", v)}
            options={GRADES}
          />
          <MultiSelect
            label="Stop-Loss"
            values={multi.stopLosses}
            onChange={(v) => setM("stopLosses", v)}
            options={STOP_LOSS_VALUES.map((s) => ({
              value: s,
              label: SHORT_STOP_LOSS[s] ?? s,
            }))}
          />
          <MultiSelect
            label="Alerta Tiempo"
            values={multi.timeAlerts}
            onChange={(v) => setM("timeAlerts", v)}
            options={ALERT_VALUES}
          />
          <MultiSelect
            label="Alerta Emisor"
            values={multi.issuerAlerts}
            onChange={(v) => setM("issuerAlerts", v)}
            options={ALERT_VALUES}
          />
          <div className="ml-auto flex items-end gap-2">
            {activeCount > 0 ? (
              <button
                onClick={() => {
                  setMulti(EMPTY_MULTI);
                  setSearch("");
                  setPage(1);
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-fsa-border bg-white px-3 text-sm text-fsa-muted hover:text-fsa-navy"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Limpiar {activeCount}
              </button>
            ) : null}
            <ExportMenu base="/export/positions" query={exportQuery} />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-[15px] font-600 text-fsa-navy">
            Posiciones del período
            {data ? (
              <span className="ml-2 text-xs font-400 text-fsa-muted">
                {data.total} registros · {data.period.month} {data.period.year}
              </span>
            ) : null}
          </h3>
          <span className="text-xs text-fsa-muted">
            Haz clic en una fila para ver su evolución histórica
          </span>
        </div>

        {error ? (
          <ErrorState message={error.message} />
        ) : isLoading && !data ? (
          <Spinner />
        ) : !data?.items.length ? (
          <EmptyState message="No hay posiciones que coincidan con los filtros." />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fsa-border text-left text-xs font-500 text-fsa-muted">
                  {table.getFlatHeaders().map((h) => {
                    const id = h.column.id;
                    const activeKey = SORT_KEY[id] ?? id;
                    const sortable = SORTABLE.has(activeKey);
                    const num = (h.column.columnDef.meta as { num?: boolean })?.num;
                    return (
                      <th
                        key={h.id}
                        onClick={() => toggleSort(id)}
                        aria-sort={
                          sortBy === activeKey
                            ? sortDir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        className={`whitespace-nowrap py-2 px-2 font-500 ${num ? "text-right" : ""} ${
                          sortable ? "cursor-pointer select-none hover:text-fsa-navy" : ""
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sortable &&
                            (sortBy === activeKey ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="h-3 w-3" aria-hidden />
                              ) : (
                                <ArrowDown className="h-3 w-3" aria-hidden />
                              )
                            ) : (
                              <ChevronsUpDown className="h-3 w-3 opacity-40" aria-hidden />
                            ))}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => {
                  const id = row.original.identifier;
                  const isOpen = expanded === id;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : id)}
                        className={`cursor-pointer border-b border-fsa-border/50 transition-colors ${
                          isOpen ? "bg-fsa-surface-2" : "hover:bg-fsa-surface-2"
                        }`}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const num = (cell.column.columnDef.meta as { num?: boolean })?.num;
                          return (
                            <td
                              key={cell.id}
                              className={`whitespace-nowrap py-1.5 px-2 ${num ? "tnum text-right" : ""}`}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                      </tr>
                      <AnimatePresence initial={false}>
                        {isOpen ? (
                          <tr>
                            <td colSpan={colCount} className="p-0">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                className="overflow-hidden"
                              >
                                <div className="p-3">
                                  <PositionHistoryChart identifier={id} />
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
        )}

        {data && totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-between text-sm text-fsa-muted">
            <button
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                setExpanded(null);
              }}
              className="rounded-lg border border-fsa-border px-3 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => {
                setPage((p) => p + 1);
                setExpanded(null);
              }}
              className="rounded-lg border border-fsa-border px-3 py-1 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
