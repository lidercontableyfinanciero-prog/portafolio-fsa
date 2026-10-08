"use client";

import useSWR from "swr";

import { Badge } from "@/components/ui/Badge";
import { fetcher } from "@/lib/api";
import { FSA, gradeColor, stopLossColor } from "@/lib/colors";
import { fmtDate, fmtNum, fmtPct, fmtUSD, fmtYears } from "@/lib/format";
import type { PositionRow, ReportColumn } from "@/lib/types";

/** Catálogo único de columnas (backend `report_columns.py`): lo usan
 * "Configurar reporte", las exportaciones y las ventanas de alertas. */
export function useReportColumns() {
  const { data, error, isLoading } = useSWR<ReportColumn[]>(
    "/export/positions/columns",
    fetcher,
    { revalidateOnFocus: false },
  );
  const byKey = new Map((data ?? []).map((c) => [c.key, c]));
  return { columns: data ?? [], byKey, error, isLoading };
}

export const isNumericKind = (c: ReportColumn) =>
  c.kind !== "text";

const alertColor = (v: string) => (v === "OK" ? FSA.green : FSA.orange);

/** Valor de una celda de posición formateado según el tipo de la columna. */
export function renderPositionCell(c: ReportColumn, row: PositionRow): React.ReactNode {
  const v = row[c.key] as unknown;
  if (c.key === "identifier" && v === row.description) {
    return <span className="text-fsa-muted">—</span>; // identificador sintético
  }
  if (c.key === "unrealized_gain_loss") {
    const n = v as number;
    return (
      <span className="font-600" style={{ color: n >= 0 ? FSA.green : FSA.red }}>
        {fmtUSD(n)}
      </span>
    );
  }
  if (c.key === "moodys_grade" || c.key === "sp_grade") {
    const g = v as string;
    return g === "N/A" ? (
      <span className="text-fsa-muted">—</span>
    ) : (
      <Badge color={gradeColor(g)}>{g}</Badge>
    );
  }
  if (c.key === "stop_loss") return <Badge color={stopLossColor(v as string)}>{v as string}</Badge>;
  if (c.key === "time_alert" || c.key === "issuer_alert" || c.key === "cash_limit_alert") {
    return <Badge color={alertColor(v as string)}>{v as string}</Badge>;
  }
  if (c.key === "time_to_maturity_years") {
    const n = v as number | null;
    return (
      <span style={n != null && n < 1 ? { color: FSA.orange, fontWeight: 600 } : undefined}>
        {fmtYears(n)}
      </span>
    );
  }
  switch (c.kind) {
    case "money":
      return fmtUSD(v as number | null);
    case "price":
      return fmtUSD(v as number | null, true);
    case "pct":
      return fmtPct(v as number | null);
    case "date":
      return fmtDate(v as string | null);
    case "years":
      return fmtYears(v as number | null);
    case "number":
      return fmtNum(v as number | null);
    default:
      return v == null || v === "" ? <span className="text-fsa-muted">—</span> : String(v);
  }
}
