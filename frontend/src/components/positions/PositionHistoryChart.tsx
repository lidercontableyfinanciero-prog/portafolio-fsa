"use client";

import useSWR from "swr";
import {
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ErrorState, Spinner } from "@/components/ui/States";
import { fetcher } from "@/lib/api";
import { FSA } from "@/lib/colors";
import { fmtCompact, fmtPct, fmtUSD } from "@/lib/format";
import type { PositionHistory } from "@/lib/types";

export function PositionHistoryChart({ identifier }: { identifier: string }) {
  const { data, error, isLoading } = useSWR<PositionHistory>(
    `/positions/${encodeURIComponent(identifier)}/history`,
    fetcher,
  );

  if (error) return <ErrorState message={`No se pudo cargar el histórico: ${error.message}`} />;
  if (isLoading || !data) return <Spinner label="Cargando histórico…" />;

  if (data.points.length < 2) {
    return (
      <div className="rounded-lg border border-fsa-border bg-fsa-surface/60 p-4 text-sm text-fsa-muted">
        <span className="font-600 text-fsa-navy">{data.description}</span> es una posición
        nueva: solo aparece en el extracto de{" "}
        {data.points[0]?.label ?? "—"}, por lo que todavía no hay serie para graficar.
      </div>
    );
  }

  const rows = data.points.map((p) => ({
    label: p.label,
    valor: p.market_value,
    yield: p.current_yield != null ? p.current_yield * 100 : null,
  }));

  return (
    <div className="rounded-lg border border-fsa-border bg-fsa-surface/60 p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-sm font-600 text-fsa-navy">
          {data.description}
          <span className="ml-2 font-400 text-fsa-muted">
            {data.type} · {data.sector ?? "—"}
          </span>
        </p>
        <p className="text-xs text-fsa-muted">
          Moody&apos;s {data.moodys_rating ?? "—"} · S&amp;P {data.sp_rating ?? "—"}
        </p>
      </div>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 20, left: 4 }}>
            <CartesianGrid stroke="#EEF1F4" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: FSA.muted }}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={44}
            />
            <YAxis
              yAxisId="v"
              tick={{ fontSize: 10, fill: FSA.muted }}
              width={46}
              tickFormatter={(v) => fmtCompact(Number(v))}
            />
            <YAxis
              yAxisId="y"
              orientation="right"
              tick={{ fontSize: 10, fill: FSA.muted }}
              width={40}
              tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: `1px solid ${FSA.border}`, fontSize: 12 }}
              formatter={(v: number, name) =>
                name === "Yield" ? fmtPct(v / 100) : fmtUSD(v)
              }
            />
            <Line
              yAxisId="v"
              type="monotone"
              dataKey="valor"
              name="Valor de mercado"
              stroke={FSA.blue}
              strokeWidth={2}
              dot={{ r: 2 }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="y"
              type="monotone"
              dataKey="yield"
              name="Yield"
              stroke={FSA.orange}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-fsa-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: FSA.blue }} /> Valor de mercado
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4"
            style={{ background: FSA.orange, borderTop: `2px dashed ${FSA.orange}` }}
          />{" "}
          Yield actual (eje derecho)
        </span>
      </div>
    </div>
  );
}
