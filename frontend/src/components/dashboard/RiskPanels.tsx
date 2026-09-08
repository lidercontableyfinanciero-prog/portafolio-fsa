"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FSA, gradeColor, stopLossColor } from "@/lib/colors";
import { fmtNum, fmtPct, fmtUSD } from "@/lib/format";
import type { BreakdownRow, DashboardPayload } from "@/lib/types";

function okColor(label: string) {
  const l = label.toLowerCase();
  return l === "ok" ? FSA.green : l.includes("revis") ? FSA.orange : FSA.muted;
}

function MiniPanel({
  title,
  rows,
  colorFor,
  positive,
}: {
  title: string;
  rows: BreakdownRow[];
  colorFor: (label: string) => string;
  positive: (label: string) => boolean;
}) {
  return (
    <Card>
      <h3 className="mb-3 font-display text-[15px] font-600 text-fsa-navy">{title}</h3>
      <ul className="space-y-2">
        {rows
          .filter((r) => r.posiciones > 0)
          .map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-2 text-sm">
              <Badge
                color={colorFor(r.label)}
                icon={
                  positive(r.label) ? (
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
  const ra = d.risk_alerts;
  const isInv = (l: string) => l.toLowerCase().includes("inversi");
  const isOk = (l: string) => l.toLowerCase() === "ok";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MiniPanel
          title="Calidad crediticia (Moody's)"
          rows={d.calidad_moodys}
          colorFor={gradeColor}
          positive={isInv}
        />
        <MiniPanel
          title="Calidad crediticia (S&P)"
          rows={d.calidad_sp}
          colorFor={gradeColor}
          positive={isInv}
        />
        <MiniPanel
          title="Indicador Stop-Loss"
          rows={d.stop_loss}
          colorFor={stopLossColor}
          positive={(l) => l.toLowerCase().includes("estable")}
        />
        <MiniPanel
          title="Alerta Tiempo (plazo de tenencia > 15 años)"
          rows={d.alerta_tiempo}
          colorFor={okColor}
          positive={isOk}
        />
        <MiniPanel
          title="Alerta Emisor (concentración > 500k USD)"
          rows={d.alerta_emisor}
          colorFor={okColor}
          positive={isOk}
        />
        <MiniPanel
          title="Límite de Caja (150k – 200k USD)"
          rows={d.limite_cash}
          colorFor={okColor}
          positive={isOk}
        />
      </div>

      <Card>
        <h3 className="mb-3 font-display text-[15px] font-600 text-fsa-navy">
          Alertas operativas
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Stat
            label="Vencimientos < 1 año"
            value={`${fmtNum(ra.vencimientos_1a_posiciones)} pos`}
            sub={fmtUSD(ra.vencimientos_1a_valor)}
          />
          <Stat
            label="Plazo prom. venc. (bonos)"
            value={`${ra.plazo_prom_vencimiento_bonos.toFixed(2)} años`}
          />
          <Stat
            label="Emisores sobre el límite"
            value={`${fmtNum(ra.emisores_sobre_limite)}`}
            sub={fmtUSD(ra.valor_emisores_sobre_limite)}
            danger={ra.emisores_sobre_limite > 0}
          />
          <Stat
            label="Posiciones a evaluar/ejecutar venta"
            value={`${fmtNum(ra.posiciones_stop_loss_venta)}`}
            danger={ra.posiciones_stop_loss_venta > 0}
          />
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded border border-fsa-border p-3">
      <p className="text-xs font-500 text-fsa-muted">{label}</p>
      <p
        className="tnum mt-1 font-display text-base font-600"
        style={{ color: danger ? FSA.red : FSA.navy }}
      >
        {value}
      </p>
      {sub ? <p className="tnum text-xs text-fsa-muted">{sub}</p> : null}
    </div>
  );
}
