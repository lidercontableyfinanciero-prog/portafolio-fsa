"use client";

import { Card } from "@/components/ui/Card";
import { FSA } from "@/lib/colors";
import { fmtNum, fmtPct, fmtUSD } from "@/lib/format";
import type { BreakdownRow } from "@/lib/types";

export function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: BreakdownRow[];
}) {
  return (
    <Card className="overflow-hidden">
      <h3 className="mb-3 font-display text-[15px] font-600 text-fsa-navy">{title}</h3>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fsa-border text-left text-[11px] uppercase tracking-wide text-fsa-muted">
              <th className="py-2 pr-3 font-600">Categoría</th>
              <th className="py-2 px-3 text-right font-600">Costo</th>
              <th className="py-2 px-3 text-right font-600">V. Mercado</th>
              <th className="py-2 px-3 text-right font-600">G/(P)</th>
              <th className="py-2 px-3 text-right font-600">%</th>
              <th className="py-2 pl-3 text-right font-600">Pos.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.label}
                className="border-b border-fsa-border/50 last:border-0 hover:bg-fsa-surface-2"
              >
                <td className="py-1.5 pr-3">{r.label}</td>
                <td className="tnum py-1.5 px-3 text-right">{fmtUSD(r.costo)}</td>
                <td className="tnum py-1.5 px-3 text-right">{fmtUSD(r.valor_mercado)}</td>
                <td
                  className="tnum py-1.5 px-3 text-right font-600"
                  style={{ color: r.gp_no_realizada >= 0 ? FSA.green : FSA.red }}
                >
                  {fmtUSD(r.gp_no_realizada)}
                </td>
                <td className="tnum py-1.5 px-3 text-right">{fmtPct(r.pct_participacion)}</td>
                <td className="tnum py-1.5 pl-3 text-right">{fmtNum(r.posiciones)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
