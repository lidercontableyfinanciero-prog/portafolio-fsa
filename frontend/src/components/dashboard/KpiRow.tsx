"use client";

import { motion, useReducedMotion } from "framer-motion";

import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { FSA } from "@/lib/colors";
import { fmtNum, fmtPct, fmtUSD } from "@/lib/format";
import type { Kpis } from "@/lib/types";

interface Card {
  label: string;
  raw: number;
  format: (n: number) => string;
  tone?: "pos" | "neg";
}

function KpiCard({ card, index }: { card: Card; index: number }) {
  const reduce = useReducedMotion();
  const color =
    card.tone === "pos" ? FSA.green : card.tone === "neg" ? FSA.red : FSA.navy;
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-fsa-border bg-white p-3.5 transition-shadow hover:shadow-card"
    >
      <p className="text-xs font-500 text-fsa-muted">{card.label}</p>
      <span
        className="tnum mt-1.5 block font-display text-lg font-600"
        style={{ color }}
      >
        <AnimatedNumber value={card.raw} format={card.format} />
      </span>
    </motion.div>
  );
}

export function KpiRow({ k }: { k: Kpis }) {
  const cards: Card[] = [
    { label: "Costo total", raw: k.costo_total, format: (n) => fmtUSD(n) },
    { label: "Valor de mercado", raw: k.valor_mercado, format: (n) => fmtUSD(n) },
    {
      label: "G/(P) no realizada",
      raw: k.gp_no_realizada,
      format: (n) => fmtUSD(n),
      tone: k.gp_no_realizada >= 0 ? "pos" : "neg",
    },
    {
      label: "Rentab. sobre costo",
      raw: k.rentab_sobre_costo,
      format: (n) => fmtPct(n),
      tone: k.rentab_sobre_costo >= 0 ? "pos" : "neg",
    },
    { label: "Ingreso anual est.", raw: k.ingreso_anual_est, format: (n) => fmtUSD(n) },
    { label: "Interés acumulado", raw: k.interes_acumulado, format: (n) => fmtUSD(n) },
    { label: "Yield prom. pond.", raw: k.yield_prom_ponderado, format: (n) => fmtPct(n) },
    { label: "N.º de posiciones", raw: k.n_posiciones, format: (n) => fmtNum(Math.round(n)) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {cards.map((c, i) => (
        <KpiCard key={c.label} card={c} index={i} />
      ))}
    </div>
  );
}
