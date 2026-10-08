"use client";

import { ChevronRight, ShieldAlert, ShieldCheck } from "lucide-react";

import type { AlertRequest } from "@/components/dashboard/AlertDetailModal";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FSA, gradeColor, stopLossColor } from "@/lib/colors";
import { fmtNum, fmtPct, fmtUSD, fmtYears } from "@/lib/format";
import type { BreakdownRow, DashboardPayload } from "@/lib/types";

function okColor(label: string) {
  const l = label.toLowerCase();
  return l === "ok" ? FSA.green : l.includes("revis") ? FSA.orange : FSA.muted;
}

function creditColor(label: string) {
  return label.toLowerCase().startsWith("sin") ? FSA.muted : gradeColor(label);
}

function MiniPanel({
  title,
  panel,
  rows,
  colorFor,
  positive,
  onSelect,
  footnote,
}: {
  title: string;
  /** clave del panel en el registro de alertas del backend */
  panel: string;
  rows: BreakdownRow[];
  colorFor: (label: string) => string;
  positive: (label: string) => boolean;
  onSelect: (req: AlertRequest) => void;
  footnote?: string;
}) {
  return (
    <Card>
      <h3 className="mb-3 font-display text-[15px] font-600 text-fsa-navy">{title}</h3>
      <ul className="space-y-1">
        {rows
          .filter((r) => r.posiciones > 0)
          .map((r) => (
            <li key={r.label}>
              <button
                type="button"
                onClick={() => onSelect({ alert: panel, label: r.label })}
                title="Ver las posiciones de esta categoría"
                className="group -mx-1.5 flex w-[calc(100%+0.75rem)] items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-sm transition-colors hover:bg-fsa-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fsa-blue"
              >
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
                <span className="tnum flex shrink-0 items-center gap-1 text-right text-fsa-muted">
                  {r.posiciones} pos · {fmtUSD(r.valor_mercado)} · {fmtPct(r.pct_participacion)}
                  <ChevronRight
                    className="h-3.5 w-3.5 opacity-40 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </span>
              </button>
            </li>
          ))}
      </ul>
      {footnote ? <p className="mt-3 text-xs text-fsa-muted">{footnote}</p> : null}
    </Card>
  );
}

export function RiskPanels({
  d,
  onSelect,
}: {
  d: DashboardPayload;
  onSelect: (req: AlertRequest) => void;
}) {
  const ra = d.risk_alerts;
  const isInv = (l: string) => l.toLowerCase().includes("inversi");
  const isOk = (l: string) => l.toLowerCase() === "ok";
  const bonds = d.calidad_universo;
  const creditNote = `Solo bonos: ${fmtNum(bonds.posiciones)} posiciones · ${fmtUSD(
    bonds.valor_mercado,
  )}. % sobre el valor de los bonos.`;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MiniPanel
          title="Calidad crediticia (Moody's)"
          panel="calidad_moodys"
          rows={d.calidad_moodys}
          colorFor={creditColor}
          positive={isInv}
          onSelect={onSelect}
          footnote={creditNote}
        />
        <MiniPanel
          title="Calidad crediticia (S&P)"
          panel="calidad_sp"
          rows={d.calidad_sp}
          colorFor={creditColor}
          positive={isInv}
          onSelect={onSelect}
          footnote={creditNote}
        />
        <MiniPanel
          title="Indicador Stop-Loss"
          panel="stop_loss"
          rows={d.stop_loss}
          colorFor={stopLossColor}
          positive={(l) => l.toLowerCase().includes("estable")}
          onSelect={onSelect}
        />
        <MiniPanel
          title="Alerta Tiempo (plazo de tenencia > 15 años)"
          panel="alerta_tiempo"
          rows={d.alerta_tiempo}
          colorFor={okColor}
          positive={isOk}
          onSelect={onSelect}
        />
        <MiniPanel
          title="Alerta Emisor (concentración > 500k USD)"
          panel="alerta_emisor"
          rows={d.alerta_emisor}
          colorFor={okColor}
          positive={isOk}
          onSelect={onSelect}
        />
        <MiniPanel
          title="Límite de Caja (150k – 200k USD)"
          panel="limite_cash"
          rows={d.limite_cash}
          colorFor={okColor}
          positive={isOk}
          onSelect={onSelect}
        />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-[15px] font-600 text-fsa-navy">
            Alertas operativas
          </h3>
          <span className="text-xs text-fsa-muted">Haz clic en una alerta para ver su detalle</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Stat
            label="Vencimientos < 1 año"
            value={`${fmtNum(ra.vencimientos_1a_posiciones)} pos`}
            sub={fmtUSD(ra.vencimientos_1a_valor)}
            onClick={() => onSelect({ alert: "vencimientos_1a" })}
          />
          <Stat
            label="Plazo prom. venc. (bonos)"
            value={fmtYears(ra.plazo_prom_vencimiento_bonos)}
            onClick={() => onSelect({ alert: "plazo_prom_vencimiento" })}
          />
          <Stat
            label="Emisores sobre el límite"
            value={`${fmtNum(ra.emisores_sobre_limite)}`}
            sub={fmtUSD(ra.valor_emisores_sobre_limite)}
            danger={ra.emisores_sobre_limite > 0}
            onClick={() => onSelect({ alert: "emisores_sobre_limite" })}
          />
          <Stat
            label="Posiciones a evaluar/ejecutar venta"
            value={`${fmtNum(ra.posiciones_stop_loss_venta)}`}
            danger={ra.posiciones_stop_loss_venta > 0}
            onClick={() => onSelect({ alert: "stop_loss_venta" })}
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
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Ver las posiciones que generan esta alerta"
      className="group rounded border border-fsa-border p-3 text-left transition-colors hover:border-fsa-blue/50 hover:bg-fsa-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-fsa-blue"
    >
      <p className="flex items-center justify-between gap-1 text-xs font-500 text-fsa-muted">
        {label}
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </p>
      <p
        className="tnum mt-1 font-display text-base font-600"
        style={{ color: danger ? FSA.red : FSA.navy }}
      >
        {value}
      </p>
      {sub ? <p className="tnum text-xs text-fsa-muted">{sub}</p> : null}
    </button>
  );
}
