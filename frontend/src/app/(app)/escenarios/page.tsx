"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { CategoryBars } from "@/components/charts/Charts";
import { ChartCard } from "@/components/charts/ChartCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { api, fetcher } from "@/lib/api";
import { FSA } from "@/lib/colors";
import { fmtNum, fmtPct, fmtUSD } from "@/lib/format";
import { useFilters } from "@/lib/filters";
import type { ScenarioResponse } from "@/lib/types";

interface AssetOpt {
  identifier: string;
  description: string;
  type: string | null;
  sector: string | null;
}

type ScenarioRow = ScenarioResponse["scenarios"][number];
const MATRIX_ROWS: {
  label: string;
  fn: (s: ScenarioRow) => string;
  highlight?: "profit" | "roi" | "irr";
}[] = [
  { label: "Acciones a vender", fn: (s) => fmtNum(s.shares_sold) },
  { label: "Precio unitario mercado", fn: (s) => fmtUSD(s.unit_market_price, true) },
  { label: "Valor bruto de venta", fn: (s) => fmtUSD(s.gross_sale_value) },
  { label: "Comisión broker (1,1%)", fn: (s) => fmtUSD(s.broker_commission, true) },
  { label: "Fee transacción", fn: (s) => fmtUSD(s.transaction_fee, true) },
  { label: "Valor neto de venta", fn: (s) => fmtUSD(s.net_sale_value) },
  { label: "Utilidad", fn: (s) => fmtUSD(s.profit), highlight: "profit" },
  { label: "Utilidad por acción (EPS)", fn: (s) => fmtUSD(s.profit_per_share, true) },
  { label: "Tiempo de inversión (años)", fn: (s) => fmtNum(s.holding_years) },
  { label: "TIR (XIRR)", fn: (s) => (s.irr == null ? "—" : fmtPct(s.irr)), highlight: "irr" },
  { label: "ROI", fn: (s) => fmtPct(s.roi), highlight: "roi" },
];

export default function EscenariosPage() {
  const { periods } = useFilters();
  const latest = periods[periods.length - 1];
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const effYear = year ?? latest?.year ?? null;
  const effMonth = month ?? latest?.month ?? null;

  const assetsKey =
    effYear && effMonth ? `/scenarios/assets?year=${effYear}&month=${effMonth}` : null;
  const { data: assets } = useSWR<AssetOpt[]>(assetsKey, fetcher);

  const [identifier, setIdentifier] = useState("");
  const [pcts, setPcts] = useState<number[]>([50, 100, 70]);
  const [result, setResult] = useState<ScenarioResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (assets?.length && !identifier) setIdentifier(assets[0].identifier);
  }, [assets, identifier]);

  async function run() {
    if (!identifier || !effMonth) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<ScenarioResponse>("/scenarios", {
        identifier,
        month: effMonth,
        year: effYear,
        pct_sales: pcts.map((p) => p / 100),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo calcular");
    } finally {
      setBusy(false);
    }
  }

  const profitData = useMemo(
    () =>
      result?.scenarios.map((s, i) => ({
        name: `Esc. ${i + 1} (${(s.pct_sale * 100).toFixed(0)}%)`,
        value: s.profit,
      })) ?? [],
    [result],
  );

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display text-lg font-600 text-fsa-navy">
          Matriz de Análisis de Escenarios de Venta
        </h2>
        <p className="mt-0.5 text-xs text-fsa-muted">
          Selecciona un activo y proyecta 3 escenarios variando el porcentaje de venta.
          Comisión de broker 1,1 % · fee 3 USD · TIR por XIRR.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Select
            label="Año"
            value={effYear ? String(effYear) : ""}
            onChange={(v) => {
              setYear(Number(v));
              setResult(null);
            }}
            options={[...new Set(periods.map((p) => p.year))].map((y) => ({
              value: String(y),
              label: String(y),
            }))}
          />
          <Select
            label="Mes"
            value={effMonth ?? ""}
            onChange={(v) => {
              setMonth(v);
              setResult(null);
            }}
            options={periods.filter((p) => p.year === effYear).map((p) => p.month)}
          />
          <Select
            label="Activo"
            value={identifier}
            onChange={setIdentifier}
            options={
              assets?.map((a) => ({
                value: a.identifier,
                label: `${a.description} — ${a.identifier}`,
              })) ?? []
            }
            className="min-w-[280px]"
          />
          {pcts.map((p, i) => (
            <label key={i} className="flex flex-col gap-1">
              <span className="text-xs font-500 text-fsa-muted">
                Escenario {i + 1} · % venta
              </span>
              <input
                type="number"
                min={1}
                max={100}
                value={p}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPcts((arr) => arr.map((x, j) => (j === i ? v : x)));
                }}
                className="h-10 w-24 rounded-lg border border-fsa-border px-2.5 text-sm focus:border-fsa-blue"
              />
            </label>
          ))}
          <Button onClick={run} disabled={busy || !identifier}>
            {busy ? "Calculando…" : "Calcular escenarios"}
          </Button>
        </div>
      </Card>

      {error ? <ErrorState message={error} /> : null}
      {busy && !result ? <Spinner label="Proyectando escenarios…" /> : null}

      {result ? (
        <>
          <Card>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-[15px] font-600 text-fsa-navy">
                {result.asset.description}
              </h3>
              <p className="text-xs text-fsa-muted">
                Cantidad {fmtNum(result.asset.quantity)} · Costo{" "}
                {fmtUSD(result.asset.purchase_value)} · Valor de Mercado{" "}
                {fmtUSD(result.asset.market_value)} · {result.period.month}{" "}
                {result.period.year}
              </p>
            </div>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-fsa-border text-left text-xs font-500 text-fsa-muted">
                    <th className="py-2 pr-3 font-600">Concepto</th>
                    {result.scenarios.map((s, i) => (
                      <th key={i} className="py-2 px-3 text-right font-600">
                        Escenario {i + 1} · {(s.pct_sale * 100).toFixed(0)}%
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MATRIX_ROWS.map(({ label, fn, highlight }, r) => (
                    <tr
                      key={r}
                      className="border-b border-fsa-border/50 last:border-0"
                    >
                      <td className="py-1.5 pr-3 text-fsa-muted">{label}</td>
                      {result.scenarios.map((s, i) => {
                        const val = fn(s);
                        const negative =
                          (highlight === "profit" && s.profit < 0) ||
                          (highlight === "roi" && s.roi < 0) ||
                          (highlight === "irr" && (s.irr ?? 0) < 0);
                        return (
                          <td
                            key={i}
                            className="tnum py-1.5 px-3 text-right"
                            style={
                              highlight
                                ? { color: negative ? FSA.red : FSA.green, fontWeight: 600 }
                                : undefined
                            }
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <ChartCard
            title="Utilidad proyectada por escenario"
            tableHead={["Escenario", "Utilidad"]}
            tableRows={profitData.map((d) => [d.name, fmtUSD(d.value)])}
          >
            <CategoryBars data={profitData} />
          </ChartCard>
        </>
      ) : assetsKey && assets && !assets.length ? (
        <EmptyState message="No hay activos para analizar en el período seleccionado." />
      ) : null}
    </div>
  );
}
