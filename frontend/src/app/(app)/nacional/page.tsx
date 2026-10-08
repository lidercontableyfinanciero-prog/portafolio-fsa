"use client";

import { ChevronRight, FileCog, Info } from "lucide-react";
import { useState } from "react";

import { ChartCard } from "@/components/charts/ChartCard";
import { CategoryBars, DonutChart, TrendLines } from "@/components/charts/Charts";
import {
  NationalAssetsModal,
  type AssetsRequest,
} from "@/components/national/NationalAssetsModal";
import { NationalSlicerBar } from "@/components/national/NationalSlicerBar";
import { NationalState } from "@/components/national/NationalState";
import { ReportConfigModal } from "@/components/reports/ReportConfigModal";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FSA } from "@/lib/colors";
import { fmtCOP, fmtCOPCompact, fmtDate, fmtPct, fmtPP, fmtYears } from "@/lib/format";
import {
  CLASS_COLOR,
  limitColor,
  type NationalAsset,
  type NationalReport,
  useNationalFilters,
  useNationalReport,
} from "@/lib/national";

const ALERT_COLS = [
  "name", "asset_type", "issuer", "value_cut", "weight", "rent_ea", "benchmark_ea",
  "diff_vs_benchmark", "classification", "observation",
];

export default function NationalDashboardPage() {
  const { query } = useNationalFilters();
  const { data, error, isLoading } = useNationalReport();
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-lg font-600 text-fsa-navy">Dashboard · Portafolio Nacional</h1>
          {data ? (
            <p className="text-sm text-fsa-muted">
              Cifras en COP · corte al {fmtDate(data.cut.date)} · periodo desde el cierre de{" "}
              {data.base.label}
            </p>
          ) : null}
        </div>
        <button
          onClick={() => setReportOpen(true)}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded border border-fsa-border bg-white px-3 text-sm font-600 text-fsa-navy hover:bg-fsa-surface"
        >
          <FileCog className="h-3.5 w-3.5" aria-hidden />
          Configurar reporte / Exportar
        </button>
      </div>
      <ReportConfigModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        query={query}
        columnsEndpoint="/national/export/columns"
        exportBase="/national/export/positions"
        storageKey="fsa_report_columns_nal"
        title="Configurar reporte · Portafolio Nacional"
      />

      <NationalSlicerBar />

      {error || (isLoading && !data) ? (
        <NationalState error={error} loading />
      ) : data ? (
        <Content d={data} />
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? "border-transparent bg-fsa-navy text-white" : "border-fsa-border bg-white shadow-card"
      }`}
    >
      <p className={`text-[11px] font-600 uppercase tracking-wide ${highlight ? "text-white/60" : "text-fsa-muted"}`}>
        {label}
      </p>
      <p
        className="tnum mt-2 font-display text-[22px] font-600 leading-tight"
        style={{ color: highlight ? "#fff" : tone ?? FSA.navy }}
      >
        {value}
      </p>
      {sub ? (
        <p className={`mt-1 text-xs ${highlight ? "text-white/60" : "text-fsa-muted"}`}>{sub}</p>
      ) : null}
    </div>
  );
}

function Content({ d }: { d: NationalReport }) {
  const [modal, setModal] = useState<AssetsRequest | null>(null);
  const k = d.kpis;
  const total = k.total_value;
  const open = (title: string, assets: NationalAsset[], subtitle?: string, columns = ALERT_COLS) =>
    setModal({ title, subtitle, assets, columns, total });

  const evo = d.series.periods.map((p, i) => {
    const row: Record<string, number | string> = { label: p, total: d.series.total[i] };
    Object.entries(d.series.by_group).forEach(([g, vals]) => (row[g] = vals[i]));
    return row;
  });
  const trend = d.trend.map((t) => ({
    label: t.period,
    portafolio: t.cum_return * 100,
    benchmark: t.cum_benchmark == null ? null : t.cum_benchmark * 100,
  }));
  const groupColors = [FSA.blue, FSA.orange, FSA.teal];
  const risk = d.assets.filter((a) => a.classification === "En riesgo");
  const top = d.assets.filter((a) => a.classification === "Sobresaliente");
  const byClass = (c: string) => d.assets.filter((a) => a.classification === c);

  return (
    <div className="space-y-4">
      {d.filtered ? (
        <p className="flex items-center gap-2 rounded-lg border border-fsa-blue/25 bg-fsa-blue/5 px-3 py-2 text-xs text-fsa-blue">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Filtros activos: KPIs, distribución, rentabilidad y gráficos corresponden a la
          selección; el benchmark es el ponderado de sus activos. Los límites del Reglamento
          se evalúan siempre sobre el portafolio total.
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi highlight label="Valor total del portafolio" value={fmtCOPCompact(total)}
          sub={`${fmtCOP(total)} · ${k.positions_open} posiciones vigentes`} />
        <Kpi label="Rendimientos e intereses pagados" value={fmtCOPCompact(k.paid_income)}
          sub={`Acumulado ${d.base.label} → corte · cupones + rendimientos FIC`} />
        <Kpi label="Crecimiento mensual (MoM)"
          value={k.mom_pct == null ? "n/a" : fmtPct(k.mom_pct)}
          tone={k.mom_pct == null ? undefined : k.mom_pct >= 0 ? FSA.green : FSA.red}
          sub={k.mom_abs == null ? "Primer mes del periodo" : `${k.mom_abs >= 0 ? "+" : ""}${fmtCOPCompact(k.mom_abs)} · incluye ventas y vencimientos`} />
        <Kpi label="Rentabilidad general (E.A.)" value={k.rent_ea == null ? "n/d" : fmtPct(k.rent_ea)}
          sub={`Periodo: ${fmtPct(k.rent_period)} (${d.months_elapsed} meses)`} />
        <Kpi label={d.filtered ? "Benchmark ponderado (E.A.)" : "Benchmark · IPC + 2 pp (E.A.)"}
          value={k.benchmark_ea == null ? "n/d" : fmtPct(k.benchmark_ea)}
          tone={k.diff_vs_benchmark == null ? undefined : k.diff_vs_benchmark >= 0 ? FSA.green : FSA.red}
          sub={k.diff_vs_benchmark == null ? "Falta el IPC del mes de corte" : `Diferencia: ${fmtPP(k.diff_vs_benchmark)}`} />
      </section>

      <section className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ChartCard
            title="Distribución y asignación del portafolio"
            subtitle="Valor al corte por tipo de inversión"
            tableHead={["Tipo", "Valor", "Asignación"]}
            tableRows={d.allocation.map((a) => [a.label, fmtCOP(a.value), fmtPct(a.share)])}
          >
            <DonutChart data={d.allocation.map((a) => ({ name: a.label, value: a.value }))} money={fmtCOP} />
          </ChartCard>
        </div>
        <div className="lg:col-span-3">
          <ChartCard
            title="Comportamiento histórico – valor del portafolio"
            subtitle="Cierre mensual por grupo de activos · COP"
            tableHead={["Mes", "Total", ...Object.keys(d.series.by_group)]}
            tableRows={evo.map((r) => [
              r.label as string, fmtCOP(r.total as number),
              ...Object.keys(d.series.by_group).map((g) => fmtCOP(r[g] as number)),
            ])}
            height={280}
          >
            <TrendLines
              data={evo}
              yDomain={["auto", "auto"]}
              money={fmtCOP}
              compact={fmtCOPCompact}
              series={[
                { key: "total", name: "Total del portafolio", color: FSA.navy },
                ...Object.keys(d.series.by_group).map((g, i) => ({
                  key: g, name: g, color: groupColors[i % groupColors.length], dashed: true,
                })),
              ]}
            />
          </ChartCard>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Rentabilidad acumulada vs benchmark"
          subtitle={`Desde el cierre de ${d.base.label} · benchmark = (1 + IPC año corrido) × (1 + spread)^(meses/12) − 1`}
          tableHead={["Mes", "Portafolio", "Benchmark", "Diferencia"]}
          tableRows={d.trend.map((t) => [t.period, fmtPct(t.cum_return), t.cum_benchmark == null ? "n/d" : fmtPct(t.cum_benchmark), fmtPP(t.diff)])}
          height={260}
        >
          <TrendLines
            data={trend}
            yPercent
            yDomain={["auto", "auto"]}
            series={[
              { key: "portafolio", name: "Portafolio", color: FSA.blue },
              { key: "benchmark", name: "Benchmark IPC + 2 pp", color: FSA.orange, dashed: true },
            ]}
          />
        </ChartCard>

        <Card>
          <h3 className="font-display text-[15px] font-600 text-fsa-navy">Rentabilidad por grupo</h3>
          <p className="mb-3 text-xs text-fsa-muted">E.A. del periodo vs benchmark aplicable</p>
          <div className="space-y-3">
            {[...d.returns_by_group, d.returns_total].map((g, i, arr) => {
              const isTotal = i === arr.length - 1;
              const max = Math.max(...arr.map((x) => Math.max(x.rent_ea ?? 0, x.benchmark_ea ?? 0)), 0.0001);
              return (
                <div key={g.label} className={isTotal ? "border-t border-fsa-border pt-3" : ""}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={isTotal ? "font-600 text-fsa-navy" : "text-fsa-navy"}>{g.label}</span>
                    <span className="tnum text-xs font-600" style={{ color: (g.diff_vs_benchmark ?? 0) >= 0 ? FSA.green : FSA.red }}>
                      {fmtPP(g.diff_vs_benchmark)}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {[
                      { lbl: "Rentab.", v: g.rent_ea, c: FSA.blue },
                      { lbl: "Bench.", v: g.benchmark_ea, c: FSA.orange },
                    ].map((b) => (
                      <div key={b.lbl} className="flex items-center gap-2 text-[11px] text-fsa-muted">
                        <span className="w-12 shrink-0">{b.lbl}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-fsa-surface-2">
                          <div className="h-full rounded-full" style={{ width: `${((b.v ?? 0) / max) * 100}%`, background: b.c }} />
                        </div>
                        <span className="tnum w-14 shrink-0 text-right font-600 text-fsa-navy">
                          {b.v == null ? "n/d" : fmtPct(b.v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h3 className="font-display text-[15px] font-600 text-fsa-navy">Semáforo de límites (Reglamento)</h3>
          <p className="mb-3 text-xs text-fsa-muted">Portafolio total · haz clic para ver las posiciones</p>
          <div className="space-y-2">
            {d.limits.map((l) => {
              const color = limitColor(l.status);
              const assets =
                l.key === "baja_liquidez"
                  ? d.assets.filter((a) => a.low_liquidity && a.value_cut > 0)
                  : l.key === "emisor"
                    ? d.assets.filter((a) => l.detail.includes(a.issuer) && a.value_cut > 0)
                    : d.assets
                        .filter((a) => a.years_remaining != null && a.value_cut > 0)
                        .sort((a, b) => (b.years_remaining ?? 0) - (a.years_remaining ?? 0));
              return (
                <button
                  key={l.key}
                  onClick={() =>
                    open(l.rule, assets, `${l.reference} · límite ${l.unit === "pct" ? fmtPct(l.limit) : fmtYears(l.limit)} · medición ${l.unit === "pct" ? fmtPct(l.value) : fmtYears(l.value)}`,
                      l.key === "plazo"
                        ? ["name", "asset_type", "issuer", "maturity_date", "years_remaining", "value_cut", "weight", "classification"]
                        : ["name", "asset_type", "issuer", "entity", "value_cut", "weight", "low_liquidity", "classification"])
                  }
                  className="group w-full rounded-lg border border-fsa-border p-3 text-left transition-colors hover:border-fsa-blue/40 hover:bg-fsa-surface"
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-500 text-fsa-navy">{l.rule}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-fsa-muted opacity-50 group-hover:opacity-100" aria-hidden />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-fsa-surface-2">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(1, l.use) * 100}%`, background: color }} />
                    </div>
                    <span className="tnum text-xs font-600" style={{ color }}>
                      {l.unit === "pct" ? fmtPct(l.value) : fmtYears(l.value)} / {l.unit === "pct" ? fmtPct(l.limit) : fmtYears(l.limit)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color }}>
                    {l.status}
                    {l.detail.length ? <span className="text-fsa-muted"> · {l.detail.join(", ")}</span> : null}
                  </p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <h3 className="font-display text-[15px] font-600 text-fsa-navy">Alertas de riesgo y desempeño</h3>
          <div className="mb-3 mt-2 flex flex-wrap gap-2">
            {(["En riesgo", "En seguimiento", "Sobresaliente", "Normal", "Cerrado"] as const).map((c) => (
              <button
                key={c}
                onClick={() => open(`Posiciones · ${c}`, byClass(c))}
                className="rounded-full transition-transform hover:-translate-y-0.5"
              >
                <Badge color={CLASS_COLOR[c]}>
                  {c}: {k.classification_counts[c] ?? 0}
                </Badge>
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-600 uppercase tracking-wide text-fsa-red">En riesgo</p>
              {risk.length ? (
                <ul className="space-y-1">
                  {risk.map((a) => (
                    <li key={a.name}>
                      <button onClick={() => open(a.name, [a])} className="w-full rounded px-1.5 py-1 text-left hover:bg-fsa-surface">
                        <span className="block text-sm font-500 text-fsa-navy">{a.name}</span>
                        <span className="block text-xs text-fsa-muted">{a.observation}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-fsa-muted">Ninguna</p>}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-600 uppercase tracking-wide text-fsa-green">Sobresalientes</p>
              {top.length ? (
                <ul className="space-y-1">
                  {top.map((a) => (
                    <li key={a.name}>
                      <button onClick={() => open(a.name, [a])} className="w-full rounded px-1.5 py-1 text-left hover:bg-fsa-surface">
                        <span className="block text-sm font-500 text-fsa-navy">{a.name}</span>
                        <span className="block text-xs text-fsa-muted">{a.observation}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-fsa-muted">Ninguna</p>}
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <ChartCard title="Por entidad / administrador" subtitle="Valor al corte"
          tableHead={["Entidad", "Valor", "%"]}
          tableRows={d.by_entity.map((r) => [r.label, fmtCOP(r.value), fmtPct(r.share)])}>
          <CategoryBars data={d.by_entity.map((r) => ({ name: r.label, value: r.value }))}
            layout="horizontal" money={fmtCOP} compact={fmtCOPCompact} />
        </ChartCard>
        <ChartCard title="Por emisor" subtitle="Límite Anexo 5: 20 % por emisor"
          tableHead={["Emisor", "Valor", "%"]}
          tableRows={d.by_issuer.map((r) => [r.label, fmtCOP(r.value), fmtPct(r.share)])}
          height={Math.max(250, d.by_issuer.length * 26)}>
          <CategoryBars data={d.by_issuer.map((r) => ({ name: r.label, value: r.value }))}
            layout="horizontal" money={fmtCOP} compact={fmtCOPCompact} />
        </ChartCard>
        <ChartCard title="Por plazo remanente" subtitle="Anexo 4: deuda privada hasta 3 años"
          tableHead={["Plazo", "Valor", "%"]}
          tableRows={d.by_term.map((r) => [r.label, fmtCOP(r.value), fmtPct(r.share)])}>
          <DonutChart data={d.by_term.map((r) => ({ name: r.label, value: r.value }))} money={fmtCOP} />
        </ChartCard>
      </section>

      {d.needs_review.length ? (
        <p className="rounded-lg border border-fsa-amber/40 bg-fsa-amber/10 px-3 py-2 text-xs text-fsa-navy">
          Inversiones con atributos deducidos automáticamente (emisor, liquidez o benchmark)
          pendientes de revisión en Parámetros: {d.needs_review.join(", ")}.
        </p>
      ) : null}

      <p className="text-[11px] text-fsa-muted">
        Fuente: base de datos del portafolio nacional · Reglamento de Inversiones FSA (JD
        24/08/2025) · IPC DANE · Rentabilidad bruta (la base no informa comisiones ni
        impuestos) · la calificación AAA exigida a CDT y bonos no viene en la base y requiere
        revisión manual.
      </p>

      <NationalAssetsModal request={modal} onClose={() => setModal(null)} />
    </div>
  );
}
