"use client";

import { ChartCard } from "@/components/charts/ChartCard";
import { TrendLines } from "@/components/charts/Charts";
import { isNum, renderNationalCell } from "@/components/national/cells";
import { NationalSlicerBar } from "@/components/national/NationalSlicerBar";
import { NationalState } from "@/components/national/NationalState";
import { Card } from "@/components/ui/Card";
import { FSA } from "@/lib/colors";
import { fmtCOP, fmtDate, fmtPct, fmtPP } from "@/lib/format";
import { type NationalReport, type ReturnsRow, useNationalReport } from "@/lib/national";
import { useReportColumns } from "@/lib/reportColumns";
import type { ReportColumn } from "@/lib/types";

const DETAIL_COLS = [
  "name", "asset_type", "group", "value_base", "value_cut", "avg_balance", "period_return",
  "rent_period", "rent_ea", "benchmark_rule", "benchmark_ea", "diff_vs_benchmark",
  "coupons_total", "paid_income",
];

export default function NationalReturnsPage() {
  const { data, error, isLoading } = useNationalReport();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-lg font-600 text-fsa-navy">Rendimiento y benchmark</h1>
        <p className="text-sm text-fsa-muted">
          Retorno del periodo = rendimientos de FIC + valorización de FCP + (variación de valor
          de mercado + cupones) de renta fija, desde el cierre base hasta el mes de corte.
        </p>
      </div>
      <NationalSlicerBar />
      {error || (isLoading && !data) ? <NationalState error={error} loading /> : data ? <Content d={data} /> : null}
    </div>
  );
}

function pctOrNd(v: number | null) {
  return v == null ? "n/d" : fmtPct(v);
}

function Content({ d }: { d: NationalReport }) {
  const b = d.benchmark;
  const { byKey } = useReportColumns("/national/export/columns");
  const cols = DETAIL_COLS.flatMap((k) => (byKey.get(k) ? [byKey.get(k) as ReportColumn] : []));
  const trend = d.trend.map((t) => ({
    label: t.period,
    portafolio: t.cum_return * 100,
    benchmark: t.cum_benchmark == null ? null : t.cum_benchmark * 100,
  }));

  return (
    <div className="space-y-4">
      <section className="grid gap-3 lg:grid-cols-3">
        <Card>
          <h3 className="font-display text-[15px] font-600 text-fsa-navy">Benchmark de mercado</h3>
          <p className="mb-3 text-xs text-fsa-muted">Anexo 6 del Reglamento: IPC (12 meses) + 2 pp; inversiones líquidas (&lt; 1 año): IPC</p>
          <dl className="space-y-1.5 text-sm">
            {[
              ["Periodo", `${fmtDate(d.base.date)} → ${fmtDate(d.cut.date)} (${d.months_elapsed} meses)`],
              ["IPC año corrido al corte (DANE)", pctOrNd(b.ipc_ytd)],
              ["IPC anual 12 meses al corte (DANE)", pctOrNd(b.ipc_12m)],
              ["Spread sobre IPC", fmtPP(b.spread).replace("+", "")],
              ["Benchmark del periodo · portafolio total", pctOrNd(b.period)],
              ["Benchmark E.A. · portafolio total", pctOrNd(b.ea)],
              ["Benchmark E.A. · inversiones líquidas (solo IPC)", pctOrNd(b.liquid_ea)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b border-fsa-border/60 pb-1.5 last:border-0">
                <dt className="text-fsa-muted">{k}</dt>
                <dd className="tnum font-600 text-fsa-navy">{v}</dd>
              </div>
            ))}
          </dl>
          {b.ipc_ytd == null ? (
            <p className="mt-3 rounded border border-fsa-amber/40 bg-fsa-amber/10 px-2.5 py-1.5 text-xs text-fsa-navy">
              Falta el IPC del DANE para {d.cut.label}: complétalo en Parámetros. El benchmark
              se muestra como «n/d» (no se estima).
            </p>
          ) : null}
        </Card>

        <div className="lg:col-span-2">
          <ChartCard
            title="Tendencia comparativa · rentabilidad acumulada"
            subtitle="Retorno acumulado ÷ saldo promedio vs (1 + IPC año corrido) × (1 + spread)^(meses/12) − 1"
            tableHead={["Mes", "Retorno del mes", "Valor", "Portafolio", "Benchmark", "Dif.", "Resultado"]}
            tableRows={d.trend.map((t) => [
              t.period, fmtCOP(t.month_return), fmtCOP(t.portfolio_value), fmtPct(t.cum_return),
              t.cum_benchmark == null ? "n/d" : fmtPct(t.cum_benchmark), fmtPP(t.diff), t.result ?? "",
            ])}
            height={300}
          >
            <TrendLines data={trend} yPercent yDomain={["auto", "auto"]}
              series={[
                { key: "portafolio", name: "Portafolio", color: FSA.blue },
                { key: "benchmark", name: "Benchmark IPC + 2 pp", color: FSA.orange, dashed: true },
              ]} />
          </ChartCard>
        </div>
      </section>

      <Card>
        <h3 className="mb-3 font-display text-[15px] font-600 text-fsa-navy">Rentabilidad por grupo</h3>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fsa-border text-left text-xs text-fsa-muted">
                {["Grupo", "Valor base", "Valor al corte", "Saldo promedio", "Retorno ($)", "Rent. periodo", "Rent. E.A.", "Bench. periodo", "Bench. E.A.", "Dif. (pp E.A.)", "Resultado"].map((h, i) => (
                  <th key={h} className={`whitespace-nowrap px-2 py-2 font-600 ${i ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...d.returns_by_group, d.returns_total].map((g: ReturnsRow, i, arr) => (
                <tr key={g.label} className={`border-b border-fsa-border/50 ${i === arr.length - 1 ? "bg-fsa-surface-2 font-600" : ""}`}>
                  <td className="px-2 py-1.5 text-fsa-navy">{g.label}</td>
                  {[fmtCOP(g.value_base), fmtCOP(g.value_cut), fmtCOP(g.avg_balance), fmtCOP(g.return),
                    fmtPct(g.rent_period), pctOrNd(g.rent_ea), pctOrNd(g.benchmark_period), pctOrNd(g.benchmark_ea)].map((v, j) => (
                    <td key={j} className="tnum whitespace-nowrap px-2 py-1.5 text-right">{v}</td>
                  ))}
                  <td className="tnum px-2 py-1.5 text-right font-600" style={{ color: (g.diff_vs_benchmark ?? 0) >= 0 ? FSA.green : FSA.red }}>
                    {fmtPP(g.diff_vs_benchmark)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">{g.result ?? "n/d"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-[15px] font-600 text-fsa-navy">Detalle por activo</h3>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fsa-border text-left text-xs text-fsa-muted">
                {cols.map((c) => (
                  <th key={c.key} title={c.label} className={`whitespace-nowrap px-2 py-2 font-600 ${isNum(c) ? "text-right" : ""}`}>{c.short}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.assets.map((a) => (
                <tr key={a.name} className="border-b border-fsa-border/50 last:border-0 hover:bg-fsa-surface-2">
                  {cols.map((c) => (
                    <td key={c.key} className={`px-2 py-1.5 ${c.key === "name" ? "min-w-[200px]" : "whitespace-nowrap"} ${isNum(c) ? "tnum text-right" : ""}`}>
                      {renderNationalCell(c, a)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="mb-2 font-display text-[15px] font-600 text-fsa-navy">Notas metodológicas</h3>
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-fsa-muted">
          <li>Rentabilidad del periodo = Retorno ($) ÷ saldo promedio de los cierres mensuales con valor. Rentabilidad E.A. = periodo anualizado con los meses transcurridos.</li>
          <li>FIC: saldo de cierre (saldo anterior + depósitos + rendimientos − retiros − GMF). FCP: saldo + valorización. CDT y bono: valor de mercado.</li>
          <li>Renta fija: retorno = variación del valor de mercado entre cierres + cupones pagados. En el mes de venta o vencimiento solo se cuentan los cupones (la base no tiene cuenta de caja).</li>
          <li>Benchmark de grupo = promedio ponderado por valor‑meses de la meta de cada activo (IPC para fondos líquidos, IPC + 2 pp para el resto). El del portafolio total es el oficial del Anexo 6.</li>
          <li>Rentabilidad bruta: la base no informa comisiones ni impuestos (el Reglamento pide medirla neta).</li>
        </ul>
      </Card>
    </div>
  );
}
