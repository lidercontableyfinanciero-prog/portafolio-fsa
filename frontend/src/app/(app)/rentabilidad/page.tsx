"use client";

import { RefreshCw } from "lucide-react";
import useSWR from "swr";

import { TrendLines } from "@/components/charts/Charts";
import { ChartCard } from "@/components/charts/ChartCard";
import { RoleGate } from "@/components/layout/RoleGate";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { api, fetcher } from "@/lib/api";
import { FSA } from "@/lib/colors";
import { fmtPct } from "@/lib/format";
import type { TwrRow } from "@/lib/types";

interface TwrResponse {
  rows: TwrRow[];
  cumulative_twr: number;
  cumulative_benchmark: number;
}

export default function RentabilidadPage() {
  const { data, error, isLoading, mutate } = useSWR<TwrResponse>(
    "/returns/twr",
    fetcher,
  );

  if (error) return <ErrorState message={error.message} />;
  if (isLoading && !data) return <Spinner label="Calculando rentabilidades…" />;
  if (!data || !data.rows.length)
    return <EmptyState message="Aún no hay rentabilidades mensuales calculadas." />;

  const withData = data.rows.filter((r) => r.portfolio_return != null);
  const lastMonth = withData[withData.length - 1];
  const chart = data.rows
    .filter((r) => r.cumulative_twr != null)
    .map((r) => ({
      label: `${r.month_name.slice(0, 3)} ${r.year}`,
      twr: (r.cumulative_twr ?? 0) * 100,
      benchmark: (r.cumulative_benchmark ?? 0) * 100,
    }));

  const cards = [
    { label: "Rentabilidad del mes (Dietz)", value: fmtPct(lastMonth?.portfolio_return ?? 0), tone: lastMonth?.portfolio_return ?? 0 },
    { label: "Acumulada del año (TWR)", value: fmtPct(data.cumulative_twr), tone: data.cumulative_twr },
    { label: "Benchmark acumulado", value: fmtPct(data.cumulative_benchmark), tone: data.cumulative_benchmark },
    {
      label: "Alfa acumulado",
      value: fmtPct(data.cumulative_twr - data.cumulative_benchmark),
      tone: data.cumulative_twr - data.cumulative_benchmark,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-600 text-fsa-navy">
            Rentabilidad del Portafolio
          </h2>
          <p className="text-xs text-fsa-muted">
            Rentabilidad mensual por <span className="font-600">Dietz Modificado</span>,
            acumulada por <span className="font-600">TWR</span> (encadenamiento geométrico).
          </p>
        </div>
        <RoleGate>
          <button
            onClick={async () => {
              await api.post("/returns/twr/recompute");
              mutate();
            }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded border border-fsa-border bg-white px-3 text-sm text-fsa-muted hover:text-fsa-navy"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Recalcular
          </button>
        </RoleGate>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <p className="text-xs font-500 text-fsa-muted">
              {c.label}
            </p>
            <p
              className="tnum mt-1.5 font-display text-xl font-600"
              style={{ color: c.tone >= 0 ? FSA.green : FSA.red }}
            >
              {c.value}
            </p>
          </Card>
        ))}
      </div>

      <ChartCard
        title="Rentabilidad acumulada (TWR) vs Benchmark"
        subtitle="% acumulado en el año"
        tableHead={["Mes", "TWR %", "Benchmark %"]}
        tableRows={chart.map((c) => [c.label, c.twr.toFixed(2), c.benchmark.toFixed(2)])}
        height={300}
      >
        <TrendLines
          data={chart}
          yPercent
          yDomain={["auto", "auto"]}
          series={[
            { key: "twr", name: "TWR acumulado", color: FSA.blue },
            { key: "benchmark", name: "Benchmark", color: FSA.muted, dashed: true },
          ]}
        />
      </ChartCard>

      <Card className="overflow-x-auto scroll-thin">
        <h3 className="mb-3 font-display text-[15px] font-600 text-fsa-navy">
          Rentabilidades mensuales
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fsa-border text-left text-xs font-500 text-fsa-muted">
              <th className="py-2 pr-3 font-600">Mes</th>
              <th className="py-2 px-3 text-right font-600">R mes (Dietz)</th>
              <th className="py-2 px-3 text-right font-600">Benchmark mes</th>
              <th className="py-2 px-3 text-right font-600">Factor (1+R)</th>
              <th className="py-2 pl-3 text-right font-600">TWR acumulado</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr
                key={`${r.year}-${r.month}`}
                className="border-b border-fsa-border/50 last:border-0"
              >
                <td className="py-1.5 pr-3">
                  {r.month_name} {r.year}
                </td>
                <td className="tnum py-1.5 px-3 text-right">
                  {r.portfolio_return == null ? "—" : fmtPct(r.portfolio_return)}
                </td>
                <td className="tnum py-1.5 px-3 text-right text-fsa-muted">
                  {r.benchmark_return == null ? "—" : fmtPct(r.benchmark_return)}
                </td>
                <td className="tnum py-1.5 px-3 text-right">
                  {r.factor == null ? "—" : r.factor.toFixed(5)}
                </td>
                <td className="tnum py-1.5 pl-3 text-right font-600">
                  {r.cumulative_twr == null ? "—" : fmtPct(r.cumulative_twr)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
