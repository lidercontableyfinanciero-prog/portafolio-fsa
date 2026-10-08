"use client";

import { useState } from "react";

import {
  NationalAssetsModal,
  type AssetsRequest,
} from "@/components/national/NationalAssetsModal";
import { NationalSlicerBar } from "@/components/national/NationalSlicerBar";
import { NationalState } from "@/components/national/NationalState";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { fmtCOP, fmtPct, fmtPP, fmtYears } from "@/lib/format";
import {
  CLASS_COLOR,
  limitColor,
  type NationalReport,
  STATUS_COLOR,
  useNationalReport,
} from "@/lib/national";

const DETAIL = ["name", "asset_type", "issuer", "value_cut", "weight", "coupon_rate",
  "maturity_date", "years_remaining", "days_to_maturity", "rent_period", "rent_ea",
  "benchmark_ea", "diff_vs_benchmark", "classification", "observation"];

export default function NationalAlertsPage() {
  const { data, error, isLoading } = useNationalReport();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-lg font-600 text-fsa-navy">Alertas y límites del Reglamento</h1>
        <p className="text-sm text-fsa-muted">
          Políticas de Inversión Financiera (JD, 24/08/2025): límite por emisor 20 % (Anexo 5),
          baja liquidez 20 % (literal b), plazo de deuda privada 3 años (Anexo 4).
        </p>
      </div>
      <NationalSlicerBar />
      {error || (isLoading && !data) ? <NationalState error={error} loading /> : data ? <Content d={data} /> : null}
    </div>
  );
}

function Content({ d }: { d: NationalReport }) {
  const [modal, setModal] = useState<AssetsRequest | null>(null);
  const total = d.kpis.total_value;
  const fmtVal = (unit: string, v: number) => (unit === "pct" ? fmtPct(v) : fmtYears(v));
  const signals: [keyof (typeof d.assets)[number], string][] = [
    ["st_issuer", "Concentración emisor"],
    ["st_liquidity", "Baja liquidez"],
    ["st_term", "Plazo"],
    ["st_maturity", "Venc. próximo"],
    ["st_rate", "Tasa vs IPC"],
    ["st_return", "Rent. vs benchmark"],
  ];

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-3 font-display text-[15px] font-600 text-fsa-navy">1. Límites del Reglamento · portafolio total</h3>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fsa-border text-left text-xs text-fsa-muted">
                {["Regla", "Referencia", "Medición actual", "Límite", "Uso del límite", "Estado"].map((h, i) => (
                  <th key={h} className={`px-2 py-2 font-600 ${i >= 2 && i <= 4 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.limits.map((l) => (
                <tr key={l.key} className="border-b border-fsa-border/50 last:border-0">
                  <td className="px-2 py-2 text-fsa-navy">{l.rule}</td>
                  <td className="px-2 py-2 text-fsa-muted">{l.reference}</td>
                  <td className="tnum px-2 py-2 text-right font-600">{fmtVal(l.unit, l.value)}</td>
                  <td className="tnum px-2 py-2 text-right">{fmtVal(l.unit, l.limit)}</td>
                  <td className="tnum px-2 py-2 text-right">{fmtPct(l.use)}</td>
                  <td className="px-2 py-2"><Badge color={limitColor(l.status)}>{l.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-[15px] font-600 text-fsa-navy">2. Concentración por emisor</h3>
        <p className="mb-3 text-xs text-fsa-muted">
          En CDT y bonos el emisor es el banco; cada fondo (FIC / FCP) es su propio emisor
          (patrimonio autónomo). Haz clic en un emisor para ver sus posiciones.
        </p>
        <div className="space-y-2">
          {d.issuers.map((i) => {
            const color = i.status === "Sin posición" ? "#9CA3AF" : limitColor(i.status);
            return (
              <button
                key={i.issuer}
                onClick={() => setModal({
                  title: `Emisor · ${i.issuer}`,
                  subtitle: `Peso ${fmtPct(i.share)} · límite ${fmtPct(i.limit)} · ${i.status}`,
                  assets: d.assets.filter((a) => a.issuer === i.issuer),
                  columns: DETAIL, total,
                })}
                className="grid w-full grid-cols-[minmax(140px,1.2fr)_2fr_auto] items-center gap-3 rounded px-1.5 py-1 text-left text-sm hover:bg-fsa-surface"
              >
                <span className="truncate text-fsa-navy" title={i.issuer}>{i.issuer}</span>
                <span className="relative h-2.5 overflow-hidden rounded-full bg-fsa-surface-2">
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(1, i.use) * 100}%`, background: color }} />
                </span>
                <span className="tnum w-40 text-right text-xs">
                  <span className="font-600" style={{ color }}>{fmtPct(i.share)}</span>
                  <span className="text-fsa-muted"> · {fmtCOP(i.value)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-[15px] font-600 text-fsa-navy">3. Alertas por activo (semáforo)</h3>
        <p className="mb-3 text-xs text-fsa-muted">
          Crítico = excede un límite o regla; Atención = cerca del límite (≥ 90 %) o bajo el
          benchmark; Sobresaliente = supera el benchmark por ≥ 1 pp. En riesgo = al menos una
          alerta crítica o dos de atención.
        </p>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fsa-border text-left text-xs text-fsa-muted">
                <th className="px-2 py-2 font-600">Activo</th>
                <th className="px-2 py-2 text-right font-600">Peso</th>
                <th className="px-2 py-2 text-right font-600">Dif. vs bench.</th>
                {signals.map(([, l]) => (
                  <th key={l} className="whitespace-nowrap px-2 py-2 text-center font-600">{l}</th>
                ))}
                <th className="px-2 py-2 font-600">Clasificación</th>
                <th className="px-2 py-2 font-600">Observación</th>
              </tr>
            </thead>
            <tbody>
              {d.assets.map((a) => (
                <tr
                  key={a.name}
                  onClick={() => setModal({ title: a.name, assets: [a], columns: DETAIL, total })}
                  className="cursor-pointer border-b border-fsa-border/50 last:border-0 hover:bg-fsa-surface-2"
                >
                  <td className="min-w-[200px] px-2 py-1.5 font-500 text-fsa-navy">{a.name}</td>
                  <td className="tnum px-2 py-1.5 text-right">{fmtPct(a.weight)}</td>
                  <td className="tnum px-2 py-1.5 text-right">{fmtPP(a.diff_vs_benchmark)}</td>
                  {signals.map(([k]) => {
                    const s = a[k] as string;
                    return (
                      <td key={k as string} className="px-2 py-1.5 text-center">
                        <span
                          className="inline-flex min-w-[64px] justify-center rounded-full px-2 py-0.5 text-[11px] font-600"
                          style={{ color: STATUS_COLOR[s], background: `${STATUS_COLOR[s]}18` }}
                        >
                          {s}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5"><Badge color={CLASS_COLOR[a.classification]}>{a.classification}</Badge></td>
                  <td className="min-w-[220px] px-2 py-1.5 text-xs text-fsa-muted">{a.observation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-fsa-muted">
          La base no trae calificación crediticia: el requisito AAA del Reglamento para CDT y
          bonos no se valida automáticamente y requiere revisión manual.
        </p>
      </Card>

      <NationalAssetsModal request={modal} onClose={() => setModal(null)} />
    </div>
  );
}
