"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { gradeColor, stopLossColor } from "@/lib/colors";
import { fmtPct, fmtUSD } from "@/lib/format";
import type { BreakdownRow, DashboardPayload } from "@/lib/types";

function MiniPanel({
  title,
  rows,
  colorFor,
}: {
  title: string;
  rows: BreakdownRow[];
  colorFor: (label: string) => string;
}) {
  return (
    <Card>
      <h3 className="mb-3 font-display text-[15px] font-600 text-fsa-navy">{title}</h3>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-2 text-sm">
            <Badge
              color={colorFor(r.label)}
              icon={
                colorFor(r.label).includes("1E7B34") ? (
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                ) : (
                  <ShieldAlert className="h-3 w-3" aria-hidden />
                )
              }
            >
              {r.label}
            </Badge>
            <span className="tnum shrink-0 text-right text-fsa-muted">
              {r.posiciones} pos · {fmtUSD(r.valor_mercado)} · {fmtPct(r.pct_participacion)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function RiskPanels({ d }: { d: DashboardPayload }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <MiniPanel
        title="Calidad crediticia (Moody's)"
        rows={d.calidad_moodys}
        colorFor={gradeColor}
      />
      <MiniPanel
        title="Calidad crediticia (S&P)"
        rows={d.calidad_sp}
        colorFor={gradeColor}
      />
      <MiniPanel
        title="Indicador Stop-Loss"
        rows={d.stop_loss}
        colorFor={stopLossColor}
      />
    </div>
  );
}
