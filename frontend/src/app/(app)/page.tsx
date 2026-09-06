"use client";

import useSWR from "swr";

import { ChartCard } from "@/components/charts/ChartCard";
import {
  CategoryBars,
  DivergingBars,
  DonutChart,
  TrendLines,
} from "@/components/charts/Charts";
import { BreakdownTable } from "@/components/dashboard/BreakdownTable";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { RiskPanels } from "@/components/dashboard/RiskPanels";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { fetcher } from "@/lib/api";
import { FSA } from "@/lib/colors";
import { fmtPct, fmtUSD } from "@/lib/format";
import { useFilters } from "@/lib/filters";
import type { DashboardPayload, EvolutionPoint } from "@/lib/types";

export default function DashboardPage() {
  const { query, ready } = useFilters();
  const { data, error, isLoading } = useSWR<DashboardPayload>(
    ready ? `/portfolio/dashboard?${query}` : null,
    fetcher,
    { keepPreviousData: true },
  );
  const { data: evolution } = useSWR<EvolutionPoint[]>(
    "/portfolio/evolution",
    fetcher,
  );

  if (error) return <ErrorState message={`No se pudo cargar el dashboard: ${error.message}`} />;
  if (isLoading && !data)
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  if (!data) return <EmptyState message="Sin datos para el período seleccionado." />;

  const clsData = data.por_clasificacion.map((r) => ({
    name: r.label,
    value: r.valor_mercado,
  }));
  const tipoData = data.por_tipo.map((r) => ({ name: r.label, value: r.valor_mercado }));
  const sectorData = data.por_sector
    .filter((r) => r.valor_mercado > 0)
    .map((r) => ({ name: r.label, value: r.valor_mercado }));
  const evoData =
    evolution?.map((p) => ({
      label: p.label,
      costo: p.costo,
      valor_mercado: p.valor_mercado,
      gp: p.gp_no_realizada,
    })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-fsa-muted">
          {data.period.month} {data.period.year}
          {["type", "classification", "sector", "rating_grade"].some(
            (k) => data.applied_filters[k],
          )
            ? " · vista filtrada"
            : ""}
        </p>
        <ExportMenu base="/export/dashboard" query={query} allowPrint />
      </div>

      <KpiRow k={data.kpis} />

      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard
          title="Composición por Clasificación"
          subtitle="Participación sobre valor de mercado"
          tableHead={["Clasificación", "V. Mercado", "%"]}
          tableRows={data.por_clasificacion.map((r) => [
            r.label,
            fmtUSD(r.valor_mercado),
            fmtPct(r.pct_participacion),
          ])}
        >
          <DonutChart data={clsData} />
        </ChartCard>

        <ChartCard
          title="Valor de Mercado por Tipo"
          tableHead={["Tipo", "V. Mercado"]}
          tableRows={tipoData.map((d) => [d.name, fmtUSD(d.value)])}
        >
          <CategoryBars data={tipoData} />
        </ChartCard>

        <ChartCard
          title="G/(P) No Realizada por Mes"
          subtitle="Verde ▲ ganancia · Rojo ▼ pérdida"
          tableHead={["Mes", "G/(P)"]}
          tableRows={evoData.map((d) => [d.label, fmtUSD(d.gp)])}
        >
          <DivergingBars data={evoData.map((d) => ({ name: d.label, value: d.gp }))} />
        </ChartCard>

        <ChartCard
          title="Evolución: Valor de Mercado vs Costo"
          tableHead={["Mes", "Costo", "V. Mercado"]}
          tableRows={evoData.map((d) => [d.label, fmtUSD(d.costo), fmtUSD(d.valor_mercado)])}
          height={280}
        >
          <TrendLines
            data={evoData}
            yDomain={["auto", "auto"]}
            series={[
              { key: "valor_mercado", name: "Valor de Mercado", color: FSA.blue },
              { key: "costo", name: "Costo", color: FSA.cost, dashed: true },
            ]}
          />
        </ChartCard>

        <div className="lg:col-span-2 xl:col-span-3">
          <ChartCard
            title="Exposición por Sector"
            subtitle="Valor de mercado"
            tableHead={["Sector", "V. Mercado", "%"]}
            tableRows={data.por_sector.map((r) => [
              r.label,
              fmtUSD(r.valor_mercado),
              fmtPct(r.pct_participacion),
            ])}
            height={Math.max(320, sectorData.length * 28)}
          >
            <CategoryBars data={sectorData} layout="horizontal" />
          </ChartCard>
        </div>
      </section>

      <RiskPanels d={data} />

      <section className="grid gap-3 lg:grid-cols-2">
        <BreakdownTable title="Distribución por Clasificación" rows={data.por_clasificacion} />
        <BreakdownTable title="Distribución por Tipo de Instrumento" rows={data.por_tipo} />
      </section>
    </div>
  );
}
