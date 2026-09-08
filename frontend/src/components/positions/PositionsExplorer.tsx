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
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { fetcher } from "@/lib/api";
import { FSA, gradeColor, stopLossColor } from "@/lib/colors";
import { fmtPct, fmtUSD } from "@/lib/format";
import { useFilters } from "@/lib/filters";
import type { PositionRow, PositionsResponse } from "@/lib/types";

const col = createColumnHelper<PositionRow>();
const GRADES = ["Grado de Inversión", "Grado Especulativo"];
const PAGE_SIZE = 20;

const SHORT_STOP_LOSS: Record<string, string> = {
  "Inversión Estable / Pérdida tolerable": "Estable",
  Monitoreo: "Monitoreo",
  "Evaluar Venta": "Evaluar venta",
  "Ejecutar Venta - Previa Revisión": "Ejecutar venta",
};

interface LocalFilters {
  year: number | null;
  month: string | null;
  type: string;
  classification: string;
  sector: string;
  moodysGrade: string;
  spGrade: string;
  search: string;
}

const money = { meta: { num: true } } as const;

export function PositionsExplorer() {
  const { periods, options } = useFilters();
  const latest = periods[periods.length - 1];

  const [f, setF] = useState<LocalFilters>({
    year: null,
    month: null,
    type: "",
    classification: "",
    sector: "",
    moodysGrade: "",
    spGrade: "",
    search: "",
  });
  const [sortBy, setSortBy] = useState("market_value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const year = f.year ?? latest?.year ?? null;
  const month = f.month ?? latest?.month ?? null;

  function set<K extends keyof LocalFilters>(k: K, v: LocalFilters[K]) {
    setF((s) => ({ ...s, [k]: v }));
    setPage(1);
    setExpanded(null);
  }

  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", month);
  if (f.type) params.set("type", f.type);
  if (f.classification) params.set("classification", f.classification);
  if (f.sector) params.set("sector", f.sector);
  if (f.moodysGrade) params.set("moodys_grade", f.moodysGrade);
  if (f.spGrade) params.set("sp_grade", f.spGrade);
  const exportQuery = params.toString();

  const key =
    year && month
      ? `/positions?${exportQuery}&sort_by=${sortBy}&sort_dir=${sortDir}` +
        `&page=${page}&page_size=${PAGE_SIZE}` +
        (f.search ? `&search=${encodeURIComponent(f.search)}` : "")
      : null;

  const { data, error, isLoading } = useSWR<PositionsResponse>(key, fetcher, {
    keepPreviousData: true,
  });

  const activeCount = [
    f.type,
    f.classification,
    f.sector,
    f.moodysGrade,
    f.spGrade,
    f.search,
  ].filter(Boolean).length;

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
        cell: (c) => (c.row.original.classification === "Renta Variable" ? fmtPct(c.getValue()) : "—"),
        ...money,
      }),
      col.accessor("equity_market_value_return", {
        header: "Rentab. V. Mercado (RV)",
        cell: (c) => (c.row.original.classification === "Renta Variable" ? fmtPct(c.getValue()) : "—"),
        ...money,
      }),
      col.accessor("moodys_rating", {
        header: "Moody's",
        cell: (c) => (
          <span className="flex items-center gap-1.5">
            <span className="tnum">{c.getValue() ?? "—"}</span>
            <Badge color={gradeColor(c.row.original.moodys_grade)}>
              {c.row.original.moodys_grade.includes("Inversión") ? "IG" : "Esp."}
            </Badge>
          </span>
        ),
      }),
      col.accessor("sp_rating", {
        header: "S&P",
        cell: (c) => (
          <span className="flex items-center gap-1.5">
            <span className="tnum">{c.getValue() ?? "—"}</span>
            <Badge color={gradeColor(c.row.original.sp_grade)}>
              {c.row.original.sp_grade.includes("Inversión") ? "IG" : "Esp."}
            </Badge>
          </span>
        ),
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
    ],
    [],
  );

  const SORTABLE = new Set([
    "description", "identifier", "type", "sector", "cost_basis", "market_value",
    "unrealized_gain_loss", "return_on_cost", "current_yield", "dividends_paid",
    "tax", "tax_rate", "equity_return_on_cost", "equity_market_value_return",
    "moodys_grade", "sp_grade", "stop_loss",
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
      {/* Filtros inteligentes */}
      <Card className="flex flex-wrap items-end gap-3">
        <Select
          label="Año"
          value={year ? String(year) : ""}
          onChange={(v) => set("year", Number(v))}
          options={[...new Set(periods.map((p) => p.year))].map((y) => ({
            value: String(y),
            label: String(y),
          }))}
        />
        <Select
          label="Mes"
          value={month ?? ""}
          onChange={(v) => set("month", v)}
          options={periods.filter((p) => p.year === year).map((p) => p.month)}
        />
        <Select
          label="Tipo de activo"
          value={f.type}
          onChange={(v) => set("type", v)}
          options={options?.types ?? []}
          allowEmpty
        />
        <Select
          label="Clasificación"
          value={f.classification}
          onChange={(v) => set("classification", v)}
          options={options?.classifications ?? []}
          allowEmpty
        />
        <Select
          label="Sector"
          value={f.sector}
          onChange={(v) => set("sector", v)}
          options={options?.sectors ?? []}
          allowEmpty
        />
        <Select
          label="Calificación Moody's"
          value={f.moodysGrade}
          onChange={(v) => set("moodysGrade", v)}
          options={GRADES}
          allowEmpty
        />
        <Select
          label="Calificación S&P"
          value={f.spGrade}
          onChange={(v) => set("spGrade", v)}
          options={GRADES}
          allowEmpty
        />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-500 text-fsa-muted">Buscar</span>
          <input
            value={f.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Descripción o CUSIP…"
            className="h-10 w-56 rounded-lg border border-fsa-border px-3 text-sm outline-none focus:border-fsa-blue"
          />
        </label>
        <div className="ml-auto flex items-end gap-2">
          {activeCount > 0 ? (
            <button
              onClick={() =>
                setF({
                  year: f.year, month: f.month, type: "", classification: "",
                  sector: "", moodysGrade: "", spGrade: "", search: "",
                })
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-fsa-border bg-white px-3 text-sm text-fsa-muted hover:text-fsa-navy"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Limpiar {activeCount}
            </button>
          ) : null}
          <ExportMenu base="/export/positions" query={exportQuery} />
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
                <tr className="border-b border-fsa-border text-left text-xs text-fsa-muted">
                  {table.getFlatHeaders().map((h) => {
                    const id = h.column.id;
                    const sortable = SORTABLE.has(SORT_KEY[id] ?? id);
                    const num = (h.column.columnDef.meta as { num?: boolean })?.num;
                    const activeKey = SORT_KEY[id] ?? id;
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
