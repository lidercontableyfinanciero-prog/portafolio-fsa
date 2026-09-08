"use client";

import { CheckCircle2, TriangleAlert } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { FSA } from "@/lib/colors";
import { fmtPct } from "@/lib/format";
import type { ConcentrationLimit } from "@/lib/types";

/** Límites de concentración por política (ANEXO 2 de la hoja Parámetros/Resumen). */
export function ConcentracionPanel({ items }: { items: ConcentrationLimit[] }) {
  return (
    <Card>
      <h3 className="mb-1 font-display text-[15px] font-600 text-fsa-navy">
        Límites de concentración por política
      </h3>
      <p className="mb-4 text-xs text-fsa-muted">
        Renta Fija ≤ 70 % · Renta Variable ≤ 30 % del portafolio.
      </p>
      <div className="space-y-4">
        {items.map((it) => {
          const pct = Math.min(1, it.participacion / Math.max(it.limite, 1e-9));
          const color = it.cumple ? FSA.green : FSA.red;
          return (
            <div key={it.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-500 text-fsa-navy">{it.label}</span>
                <span className="tnum flex items-center gap-1.5" style={{ color }}>
                  {it.cumple ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {fmtPct(it.participacion)} / {fmtPct(it.limite)}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-fsa-surface-2">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${pct * 100}%`, background: color }}
                />
              </div>
              {!it.cumple ? (
                <p className="mt-1 text-xs text-fsa-red">
                  Excede el límite en {fmtPct(it.excedente)}.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
