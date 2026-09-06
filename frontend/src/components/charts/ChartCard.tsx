"use client";

import { Table2 } from "lucide-react";
import { cloneElement, isValidElement, useState } from "react";

import { Card } from "@/components/ui/Card";

interface Props {
  title: string;
  subtitle?: string;
  /** filas para la tabla accesible de respaldo */
  tableHead: string[];
  tableRows: (string | number)[][];
  children: React.ReactElement;
  height?: number;
}

export function ChartCard({
  title,
  subtitle,
  tableHead,
  tableRows,
  children,
  height = 250,
}: Props) {
  const [showTable, setShowTable] = useState(false);
  const chart = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ height?: number }>, { height })
    : children;

  return (
    <Card className="flex flex-col">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[15px] font-600 text-fsa-navy">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-fsa-muted">{subtitle}</p> : null}
        </div>
        <button
          onClick={() => setShowTable((s) => !s)}
          aria-pressed={showTable}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-fsa-border px-2 py-1 text-[11px] text-fsa-muted hover:text-fsa-navy"
        >
          <Table2 className="h-3.5 w-3.5" aria-hidden />
          {showTable ? "Ver gráfico" : "Ver datos"}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-auto scroll-thin" style={{ maxHeight: height }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-fsa-surface-2 text-left text-xs text-fsa-muted">
              <tr>
                {tableHead.map((h) => (
                  <th key={h} className="px-2 py-1.5 font-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => (
                <tr key={i} className="border-b border-fsa-border/60 last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className="tnum px-2 py-1.5">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        chart
      )}
    </Card>
  );
}
