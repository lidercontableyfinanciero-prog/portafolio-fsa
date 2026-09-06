"use client";

import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { TrendLines } from "@/components/charts/Charts";
import { ChartCard } from "@/components/charts/ChartCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";
import { api } from "@/lib/api";
import { FSA } from "@/lib/colors";
import { fmtCOP } from "@/lib/format";
import type { FxResult } from "@/lib/types";

interface Form {
  gross_sale_usd: number;
  sale_commission_usd: number;
  purchase_cost_usd: number;
  purchase_date: string;
  sale_date: string;
  trm_purchase: number;
  trm_sale: number;
  trm_close: number;
  sensitivity_from: number;
  sensitivity_to: number;
}

const DEFAULTS: Form = {
  gross_sale_usd: 198702,
  sale_commission_usd: 2185.72,
  purchase_cost_usd: 156178.28,
  purchase_date: "2025-11-25",
  sale_date: "2026-05-05",
  trm_purchase: 3950,
  trm_sale: 4150,
  trm_close: 4180,
  sensitivity_from: 3800,
  sensitivity_to: 4600,
};

const FIELDS: { key: keyof Form; label: string; type: "number" | "date" }[] = [
  { key: "gross_sale_usd", label: "Valor bruto de venta (USD)", type: "number" },
  { key: "sale_commission_usd", label: "Comisión de venta (USD)", type: "number" },
  { key: "purchase_cost_usd", label: "Costo histórico de compra (USD)", type: "number" },
  { key: "purchase_date", label: "Fecha de compra", type: "date" },
  { key: "sale_date", label: "Fecha de venta", type: "date" },
  { key: "trm_purchase", label: "TRM compra (COP/USD)", type: "number" },
  { key: "trm_sale", label: "TRM venta (COP/USD)", type: "number" },
  { key: "trm_close", label: "TRM cierre de mes (COP/USD)", type: "number" },
];

export default function SimuladorFxPage() {
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [res, setRes] = useState<FxResult | null>(null);
  const [curve, setCurve] = useState<{ label: string; utilidad: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function upd<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        purchase_date: form.purchase_date || null,
        sale_date: form.sale_date || null,
        sensitivity_steps: 20,
      };
      const data = await api.post<{
        result: FxResult;
        sensitivity: { trm_sale: number; net_sale_profit_cop: number }[] | null;
      }>("/fx-simulator", payload);
      setRes(data.result);
      setCurve(
        (data.sensitivity ?? []).map((p) => ({
          label: Math.round(p.trm_sale).toString(),
          utilidad: p.net_sale_profit_cop,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo simular");
    } finally {
      setBusy(false);
    }
  }

  const rows: [string, number][] = res
    ? [
        ["Valor bruto de venta (COP)", res.gross_sale_cop],
        ["Comisión de venta (COP)", res.sale_commission_cop],
        ["Valor neto recibido en banco (COP)", res.net_bank_value_cop],
        ["Costo histórico de adquisición (COP)", res.historical_cost_cop],
        ["Diferencia TRM (venta − compra)", res.trm_delta],
        ["Diferencia en cambio acumulada (COP)", res.accumulated_fx_difference],
        ["Utilidad de negociación (COP)", res.trading_profit_cop],
        ["Utilidad total bruta en venta (COP)", res.gross_total_profit_cop],
        ["Utilidad neta en venta (COP)", res.net_sale_profit_cop],
      ]
    : [];

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display text-lg font-600 text-fsa-navy">
          Simulador de impacto cambiario
        </h2>
        <p className="mt-0.5 text-xs text-fsa-muted">
          Moneda funcional COP. TRM paramétricas.{" "}
          <span className="font-600">
            Diferencia en cambio = Costo USD × (TRM venta − TRM compra)
          </span>
          .
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-[11px] font-600 uppercase tracking-wide text-fsa-muted">
                {f.label}
              </span>
              <input
                type={f.type}
                value={form[f.key] as string | number}
                onChange={(e) =>
                  upd(
                    f.key,
                    (f.type === "number"
                      ? Number(e.target.value)
                      : e.target.value) as Form[typeof f.key],
                  )
                }
                className="min-h-[40px] rounded border border-fsa-border px-2.5 text-sm focus:border-fsa-blue"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-600 uppercase tracking-wide text-fsa-muted">
              Sensibilidad TRM desde
            </span>
            <input
              type="number"
              value={form.sensitivity_from}
              onChange={(e) => upd("sensitivity_from", Number(e.target.value))}
              className="min-h-[40px] w-32 rounded border border-fsa-border px-2.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-600 uppercase tracking-wide text-fsa-muted">
              hasta
            </span>
            <input
              type="number"
              value={form.sensitivity_to}
              onChange={(e) => upd("sensitivity_to", Number(e.target.value))}
              className="min-h-[40px] w-32 rounded border border-fsa-border px-2.5 text-sm"
            />
          </label>
          <Button onClick={run} disabled={busy}>
            {busy ? "Simulando…" : "Simular"}
          </Button>
        </div>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      {res ? (
        <>
          <Card>
            <h3 className="mb-3 font-display text-[15px] font-600 text-fsa-navy">
              Memoria de cálculo (COP)
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {rows.map(([label, val]) => (
                  <tr key={label} className="border-b border-fsa-border/50 last:border-0">
                    <td className="py-1.5 pr-3 text-fsa-muted">{label}</td>
                    <td
                      className="tnum py-1.5 text-right font-600"
                      style={{
                        color:
                          label.startsWith("Utilidad") && val < 0 ? FSA.red : FSA.navy,
                      }}
                    >
                      {label.startsWith("Diferencia TRM")
                        ? val.toFixed(2)
                        : fmtCOP(val)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-600"
              style={{ color: Math.abs(res.control_check) < 0.5 ? FSA.green : FSA.red }}
            >
              {Math.abs(res.control_check) < 0.5 ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              ) : (
                <TriangleAlert className="h-4 w-4" aria-hidden />
              )}
              Control cruzado: {res.control_check.toFixed(2)} (debe ser 0)
            </p>
          </Card>

          {curve.length ? (
            <ChartCard
              title="Sensibilidad: utilidad neta vs TRM de venta"
              tableHead={["TRM venta", "Utilidad neta (COP)"]}
              tableRows={curve.map((c) => [c.label, fmtCOP(c.utilidad)])}
              height={280}
            >
              <TrendLines
                data={curve}
                series={[
                  { key: "utilidad", name: "Utilidad neta (COP)", color: FSA.blue },
                ]}
              />
            </ChartCard>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
