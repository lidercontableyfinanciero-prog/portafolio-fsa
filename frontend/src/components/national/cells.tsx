"use client";

import { Badge } from "@/components/ui/Badge";
import { FSA } from "@/lib/colors";
import { fmtCOP, fmtDate, fmtNum, fmtPct, fmtPP, fmtYears } from "@/lib/format";
import { CLASS_COLOR, type NationalAsset } from "@/lib/national";
import type { ReportColumn } from "@/lib/types";

export const isNum = (c: ReportColumn) => c.kind !== "text";

/** Formato de una celda de posición nacional según el catálogo de columnas
 * (`/national/export/columns`): el mismo que usan Excel y PDF. */
export function renderNationalCell(c: ReportColumn, a: NationalAsset): React.ReactNode {
  const v = (a as unknown as Record<string, unknown>)[c.key];
  const dash = <span className="text-fsa-muted">—</span>;
  if (c.key === "classification") {
    return <Badge color={CLASS_COLOR[a.classification] ?? FSA.muted}>{a.classification}</Badge>;
  }
  if (c.key === "status") {
    return <Badge color={a.status === "Vigente" ? FSA.green : FSA.muted}>{a.status}</Badge>;
  }
  if (c.key === "low_liquidity") return a.low_liquidity ? "Sí" : "No";
  if (c.key === "diff_vs_benchmark") {
    const n = v as number | null;
    return n == null ? dash : (
      <span className="font-600" style={{ color: n >= 0 ? FSA.green : FSA.red }}>{fmtPP(n)}</span>
    );
  }
  if (c.key === "years_remaining") {
    const n = v as number | null;
    return n == null ? dash : (
      <span style={n > 3 ? { color: FSA.red, fontWeight: 600 } : undefined}>{fmtYears(n)}</span>
    );
  }
  if (v == null || v === "") return dash;
  switch (c.kind) {
    case "money":
    case "price":
      return fmtCOP(v as number);
    case "pct":
      return fmtPct(v as number);
    case "date":
      return fmtDate(v as string);
    case "years":
      return fmtYears(v as number);
    case "number":
      return fmtNum(v as number);
    default:
      return String(v);
  }
}
