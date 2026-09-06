"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { FSA } from "@/lib/colors";
import { fmtNum, fmtPct, fmtUSD } from "@/lib/format";
import type { Kpis } from "@/lib/types";

function KpiCard({
  label,
  value,
  hint,
  tone,
  trend,
  index,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "pos" | "neg" | "neutral";
  trend?: number;
  index: number;
}) {
  const color =
    tone === "pos" ? FSA.green : tone === "neg" ? FSA.red : FSA.navy;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-lg border border-fsa-border bg-white p-4 shadow-card"
    >
      <p className="text-[11px] font-600 uppercase tracking-wide text-fsa-muted">
        {label}
      </p>
      <p className="tnum mt-1.5 font-display text-xl font-600" style={{ color }}>
        {value}
      </p>
      {hint ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-fsa-muted">
          {trend != null &&
            (trend >= 0 ? (
              <ArrowUpRight className="h-3 w-3 text-fsa-green" aria-hidden />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-fsa-red" aria-hidden />
            ))}
          {hint}
        </p>
      ) : null}
    </motion.div>
  );
}

export function KpiRow({ k }: { k: Kpis }) {
  const cards = [
    { label: "Costo Total", value: fmtUSD(k.costo_total) },
    { label: "Valor de Mercado", value: fmtUSD(k.valor_mercado) },
    {
      label: "G/(P) No Realizada",
      value: fmtUSD(k.gp_no_realizada),
      tone: (k.gp_no_realizada >= 0 ? "pos" : "neg") as "pos" | "neg",
      hint: fmtPct(k.rentab_sobre_costo) + " sobre costo",
      trend: k.gp_no_realizada,
    },
    {
      label: "Rentab. s/ Costo",
      value: fmtPct(k.rentab_sobre_costo),
      tone: (k.rentab_sobre_costo >= 0 ? "pos" : "neg") as "pos" | "neg",
    },
    { label: "Ingreso Anual Est.", value: fmtUSD(k.ingreso_anual_est) },
    { label: "Interés Acumulado", value: fmtUSD(k.interes_acumulado) },
    { label: "Yield Prom. Pond.", value: fmtPct(k.yield_prom_ponderado) },
    { label: "N° Posiciones", value: fmtNum(k.n_posiciones) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {cards.map((c, i) => (
        <KpiCard key={c.label} index={i} {...c} />
      ))}
    </div>
  );
}
