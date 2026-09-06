"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { fetcher } from "@/lib/api";
import { gradeColor, stopLossColor } from "@/lib/colors";
import { fmtPct, fmtUSD } from "@/lib/format";
import { useFilters } from "@/lib/filters";
import type { PositionRow, PositionsResponse } from "@/lib/types";

const col = createColumnHelper<PositionRow>();

const SHORT_STOP_LOSS: Record<string, string> = {
  "Inversión Estable / Pérdida tolerable": "Estable",
  Monitoreo: "Monitoreo",
  "Evaluar Venta": "Evaluar venta",
  "Ejecutar Venta - Previa Revisión": "Ejecutar venta",
};

export function PositionsTable() {
  const { query } = useFilters();
  const [sortBy, setSortBy] = useState("market_value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pageSize = 25;

  const key =
    `/positions?${query}&sort_by=${sortBy}&sort_dir=${sortDir}` +
    `&page=${page}&page_size=${pageSize}` +
    (search ? `&search=${encodeURIComponent(search)}` : "");
  const { data, error, isLoading } = useSWR<PositionsResponse>(key, fetcher, {
    keepPreviousData: true,
  });

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
      col.accessor("cost_basis", {
        header: "Costo",
        cell: (c) => fmtUSD(c.getValue()),
        meta: { num: true },
      }),
      col.accessor("market_value", {
        header: "V. Mercado",
        cell: (c) => fmtUSD(c.getValue()),
        meta: { num: true },
      }),
      col.accessor("unrealized_gain_loss", {
        header: "G/(P) No Realizada",
        cell: (c) => (
          <span
            className="tnum font-600"
            style={{ color: c.getValue() >= 0 ? "#1E7B34" : "#C0392B" }}
          >
            {fmtUSD(c.getValue())}
          </span>
        ),
        meta: { num: true },
      }),
      col.accessor("return_on_cost", {
        header: "Rentab. s/ Costo",
        cell: (c) => fmtPct(c.getValue()),
        meta: { num: true },
      }),
      col.accessor("stop_loss", {
        header: "Stop-Loss",
        cell: (c) => {
          const v = c.getValue();
          return (
            <span title={v}>
              <Badge color={stopLossColor(v)} className="whitespace-nowrap">
                {SHORT_STOP_LOSS[v] ?? v}
              </Badge>
            </span>
          );
        },
      }),
      col.accessor("moodys_grade", {
        header: "Moody's",
        cell: (c) => <Badge color={gradeColor(c.getValue())}>{c.getValue()}</Badge>,
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  const SORTABLE = new Set([
    "description",
    "type",
    "sector",
    "cost_basis",
    "market_value",
    "unrealized_gain_loss",
    "return_on_cost",
    "stop_loss",
  ]);

  function toggleSort(id: string) {
    if (!SORTABLE.has(id)) return;
    if (sortBy === id) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(id);
      setSortDir("desc");
    }
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <Card className="overflow-hidden">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[15px] font-600 text-fsa-navy">
          Posiciones del período
          {data ? (
            <span className="ml-2 text-xs font-400 text-fsa-muted">
              {data.total} registros
            </span>
          ) : null}
        </h3>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar descripción o CUSIP…"
          className="min-h-[38px] w-64 rounded border border-fsa-border px-3 text-sm focus:border-fsa-blue"
        />
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
              <tr className="border-b border-fsa-border text-left text-[11px] uppercase tracking-wide text-fsa-muted">
                {table.getFlatHeaders().map((h) => {
                  const id = h.column.id;
                  const sortable = SORTABLE.has(id);
                  const num = (h.column.columnDef.meta as { num?: boolean })?.num;
                  return (
                    <th
                      key={h.id}
                      onClick={() => toggleSort(id)}
                      aria-sort={
                        sortBy === id
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className={`py-2 px-2 font-600 ${num ? "text-right" : ""} ${
                        sortable ? "cursor-pointer select-none hover:text-fsa-navy" : ""
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sortable &&
                          (sortBy === id ? (
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
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-fsa-border/50 last:border-0 hover:bg-fsa-surface-2"
                >
                  {row.getVisibleCells().map((cell) => {
                    const num = (cell.column.columnDef.meta as { num?: boolean })?.num;
                    return (
                      <td
                        key={cell.id}
                        className={`py-1.5 px-2 ${num ? "tnum text-right" : ""}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && totalPages > 1 ? (
        <div className="mt-3 flex items-center justify-between text-sm text-fsa-muted">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-fsa-border px-3 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-fsa-border px-3 py-1 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </Card>
  );
}
