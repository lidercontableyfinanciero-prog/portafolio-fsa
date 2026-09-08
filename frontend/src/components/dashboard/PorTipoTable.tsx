"use client";

import { Card } from "@/components/ui/Card";
import { FSA } from "@/lib/colors";
import { fmtDeltaPct, fmtDeltaUSD, fmtNum, fmtPct, fmtUSD } from "@/lib/format";
import type { BreakdownRow } from "@/lib/types";

/** Total del portafolio agrupado por tipo de activo, con variación mes a mes. */
export function PorTipoTable({
  rows,
  mesAnterior,
}: {
  rows: BreakdownRow[];
  mesAnterior: string;
}) {
  const totalVI = rows.reduce((s, r) => s + r.valor_informe, 0);
  const totalPrev = rows.reduce((s, r) => s + (r.valor_informe_anterior ?? 0), 0);
  const totalDeltaAbs = totalVI - totalPrev;
  const totalDeltaPct = totalPrev ? totalDeltaAbs / totalPrev : null;

  return (
    <Card className="overflow-hidden">
      <h3 className="mb-3 font-display text-[15px] font-600 text-fsa-navy">
        Total del portafolio por tipo de activo
      </h3>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fsa-border text-left text-xs text-fsa-muted">
              <th className="py-2 pr-3 font-500">Tipo de activo</th>
              <th className="py-2 px-3 text-right font-500">Valor Informe</th>
              <th className="py-2 px-3 text-right font-500">% del total</th>
              <th className="py-2 px-3 text-right font-500">
                {mesAnterior ? `Δ vs ${mesAnterior}` : "Δ mes anterior"}
              </th>
              <th className="py-2 px-3 text-right font-500">Δ %</th>
              <th className="py-2 pl-3 text-right font-500">Pos.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.label}
                className="border-b border-fsa-border/50 last:border-0 hover:bg-fsa-surface-2"
              >
                <td className="py-1.5 pr-3">{r.label}</td>
                <td className="tnum py-1.5 px-3 text-right">{fmtUSD(r.valor_informe)}</td>
                <td className="tnum py-1.5 px-3 text-right text-fsa-muted">
                  {fmtPct(totalVI ? r.valor_informe / totalVI : 0)}
                </td>
                <td
                  className="tnum py-1.5 px-3 text-right"
                  style={{
                    color:
                      r.variacion_abs == null
                        ? undefined
                        : r.variacion_abs >= 0
                          ? FSA.green
                          : FSA.red,
                  }}
                >
                  {r.variacion_abs == null ? "—" : fmtDeltaUSD(r.variacion_abs)}
                </td>
                <td
                  className="tnum py-1.5 px-3 text-right"
                  style={{
                    color:
                      r.variacion_pct == null
                        ? undefined
                        : r.variacion_pct >= 0
                          ? FSA.green
                          : FSA.red,
                  }}
                >
                  {r.variacion_pct == null ? "—" : fmtDeltaPct(r.variacion_pct)}
                </td>
                <td className="tnum py-1.5 pl-3 text-right">{fmtNum(r.posiciones)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-fsa-border font-600">
              <td className="py-2 pr-3">Total</td>
              <td className="tnum py-2 px-3 text-right">{fmtUSD(totalVI)}</td>
              <td className="tnum py-2 px-3 text-right">100,00 %</td>
              <td
                className="tnum py-2 px-3 text-right"
                style={{ color: totalDeltaAbs >= 0 ? FSA.green : FSA.red }}
              >
                {totalPrev ? fmtDeltaUSD(totalDeltaAbs) : "—"}
              </td>
              <td
                className="tnum py-2 px-3 text-right"
                style={{ color: (totalDeltaPct ?? 0) >= 0 ? FSA.green : FSA.red }}
              >
                {totalDeltaPct == null ? "—" : fmtDeltaPct(totalDeltaPct)}
              </td>
              <td className="tnum py-2 pl-3 text-right">
                {fmtNum(rows.reduce((s, r) => s + r.posiciones, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
