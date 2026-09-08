"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { FSA } from "@/lib/colors";
import { fmtDeltaPct, fmtDeltaUSD, fmtUSD } from "@/lib/format";
import type { EvolutionPoint, PortfolioVariation } from "@/lib/types";

export function HeroBand({
  variation,
  evolution,
  periodLabel,
}: {
  variation: PortfolioVariation | null;
  evolution: EvolutionPoint[];
  periodLabel: string;
}) {
  const reduce = useReducedMotion();
  const total = variation?.valor_actual ?? evolution.at(-1)?.valor_informe ?? 0;
  const up = (variation?.variacion_abs ?? 0) >= 0;
  const spark = evolution.map((p) => ({ label: p.label, v: p.valor_informe }));

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="grid gap-4 rounded-2xl border border-fsa-border bg-white p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:p-6"
    >
      <div className="flex flex-col justify-center">
        <p className="text-sm text-fsa-muted">
          Total del portafolio (Valor Informe) · {periodLabel}
        </p>
        <span className="tnum mt-1 font-display text-[34px] font-700 leading-none text-fsa-navy md:text-[40px]">
          <AnimatedNumber value={total} format={(n) => fmtUSD(n)} />
        </span>

        {variation ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-600"
              style={{
                color: up ? FSA.green : FSA.red,
                background: `${up ? FSA.green : FSA.red}14`,
              }}
            >
              {up ? (
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
              )}
              {fmtDeltaPct(variation.variacion_pct)}
            </span>
            <span className="tnum text-fsa-muted">
              {fmtDeltaUSD(variation.variacion_abs)} vs {variation.mes_anterior}
            </span>
          </div>
        ) : null}
      </div>

      <div className="min-h-[128px]">
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={spark} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={FSA.blue} stopOpacity={0.22} />
                <stop offset="100%" stopColor={FSA.blue} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: `1px solid ${FSA.border}`, fontSize: 12 }}
              formatter={(v: number) => [fmtUSD(v), "Valor Informe"]}
              labelStyle={{ color: FSA.muted }}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={FSA.blue}
              strokeWidth={2}
              fill="url(#heroFill)"
              isAnimationActive={!reduce}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  );
}
