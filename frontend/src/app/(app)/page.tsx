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
import { ConcentracionPanel } from "@/components/dashboard/ConcentracionPanel";
import { HeroBand } from "@/components/dashboard/HeroBand";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { PorTipoTable } from "@/components/dashboard/PorTipoTable";
import { RiskPanels } from "@/components/dashboard/RiskPanels";
import { SlicerBar } from "@/components/filters/SlicerBar";
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
  const { data: evolution } = useSWR<EvolutionPoint[]>("/portfolio/evolution", fetcher);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <h1 className="font-display text-lg font-600 text-fsa-navy">Dashboard</h1>
        <ExportMenu base="/export/dashboard" query={query} allowPrint />
      </div>

      <SlicerBar />

      {error ? (
        <ErrorState message={`No se pudo cargar el dashboard: ${error.message}`} />
      ) : isLoading && !data ? (
        <DashboardSkeleton />
      ) : !data ? (
        <EmptyState message="Sin datos para el período seleccionado." />
      ) : (
        <DashboardContent data={data} evolution={evolution ?? []} />
      )}
    </div>
  );
}

function DashboardContent({
  data,
  evolution,
}: {
  data: DashboardPayload;
  evolution: EvolutionPoint[];
}) {
  const periodLabel = `${data.period.month} ${data.period.year}`;
  const clsData = data.por_clasificacion.map((r) => ({
    name: r.label,
    value: r.valor_mercado,
  }));
  const tipoData = data.por_tipo.map((r) => ({ name: r.label, value: r.valor_mercado }));
  const sectorData = data.por_sector
    .filter((r) => r.valor_mercado > 0)
    .map((r) => ({ name: r.label, value: r.valor_mercado }));
  const evoData = evolution.map((p) => ({
    label: p.label,
    total: p.valor_informe,
    valor_mercado: p.valor_mercado,
    costo: p.costo,
    gp: p.gp_no_realizada,
  }));

  return (
    <div className="space-y-4">
      <HeroBand
        variation={data.variacion_portafolio}
        evolution={evolution}
        periodLabel={periodLabel}
      />

      <KpiRow k={data.kpis} />

      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard
          title="Composición por clasificación"
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
          title="Valor de mercado por tipo"
          tableHead={["Tipo", "V. Mercado"]}
          tableRows={tipoData.map((d) => [d.name, fmtUSD(d.value)])}
        >
          <CategoryBars data={tipoData} />
        </ChartCard>

        <ChartCard
          title="G/(P) no realizada por mes"
          subtitle="Verde ▲ ganancia · Rojo ▼ pérdida"
          tableHead={["Mes", "G/(P)"]}
          tableRows={evoData.map((d) => [d.label, fmtUSD(d.gp)])}
        >
          <DivergingBars data={evoData.map((d) => ({ name: d.label, value: d.gp }))} />
        </ChartCard>
      </section>

      <ChartCard
        title="Evolución: total del portafolio, valor de mercado y costo"
        subtitle="Todos los meses disponibles · USD"
        tableHead={["Mes", "Total (V. Informe)", "V. Mercado", "Costo"]}
        tableRows={evoData.map((d) => [
          d.label,
          fmtUSD(d.total),
          fmtUSD(d.valor_mercado),
          fmtUSD(d.costo),
        ])}
        height={320}
      >
        <TrendLines
          data={evoData}
          yDomain={["auto", "auto"]}
          series={[
            { key: "total", name: "Total del portafolio", color: FSA.navy },
            { key: "valor_mercado", name: "Valor de mercado", color: FSA.blue },
            { key: "costo", name: "Costo", color: FSA.cost, dashed: true },
          ]}
        />
      </ChartCard>

      <section className="grid gap-3 lg:grid-cols-2">
        <PorTipoTable
          rows={data.por_tipo}
          mesAnterior={data.variacion_portafolio?.mes_anterior ?? ""}
        />
        <ConcentracionPanel items={data.limites_concentracion} />
      </section>

      <ChartCard
        title="Exposición por sector"
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

      <RiskPanels d={data} />

      <section className="grid gap-3 lg:grid-cols-2">
        <BreakdownTable title="Distribución por clasificación" rows={data.por_clasificacion} />
        <BreakdownTable title="Distribución por tipo de instrumento" rows={data.por_tipo} />
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
