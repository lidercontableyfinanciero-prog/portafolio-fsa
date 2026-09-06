"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CATEGORICAL, FSA, gainLoss } from "@/lib/colors";
import { fmtCompact, fmtPct, fmtUSD } from "@/lib/format";

const axis = { fontSize: 11, fill: FSA.muted };
const gridStroke = "#EEF1F4";
const tooltipStyle = {
  borderRadius: 8,
  border: `1px solid ${FSA.border}`,
  fontSize: 12,
};

type WithHeight = { height?: number };

/* --------------------------------- Donut ---------------------------------- */
export function DonutChart({
  data,
  height = 240,
}: { data: { name: string; value: number }[] } & WithHeight) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const withPct = data.map((d, i) => ({
    ...d,
    color: CATEGORICAL[i % CATEGORICAL.length],
    pct: (d.value / total) * 100,
  }));

  return (
    <div className="flex h-full items-center gap-3" style={{ minHeight: height }}>
      <div style={{ width: "55%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={withPct}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="88%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={1.5}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {withPct.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => [
                `${fmtUSD(v)} (${((v / total) * 100).toFixed(1)}%)`,
                "",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-1.5 text-xs">
        {withPct.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: d.color }}
              />
              {d.name}
            </span>
            <span className="tnum font-600 text-fsa-navy">{d.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------- Barras categorías --------------------------- */
export function CategoryBars({
  data,
  layout = "vertical",
  height = 240,
}: {
  data: { name: string; value: number }[];
  layout?: "vertical" | "horizontal";
} & WithHeight) {
  const horizontal = layout === "horizontal";
  const shortName = (s: string) => (s.length > 16 ? `${s.slice(0, 15)}…` : s);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{
          top: 6,
          right: 24,
          bottom: horizontal ? 6 : 70,
          left: horizontal ? 8 : 4,
        }}
        barCategoryGap={horizontal ? "18%" : "22%"}
      >
        <CartesianGrid stroke={gridStroke} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis
              type="number"
              tick={axis}
              tickFormatter={fmtCompact}
              domain={[0, "dataMax"]}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ ...axis, fontSize: 10 }}
              tickFormatter={shortName}
              width={150}
              interval={0}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="name"
              tick={{ ...axis, fontSize: 10 }}
              tickFormatter={shortName}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={70}
            />
            <YAxis tick={axis} tickFormatter={fmtCompact} width={44} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtUSD(v)} cursor={{ fill: "#0000000a" }} />
        <Bar dataKey="value" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={horizontal ? 22 : 56}>
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* --------------------- Barras +/- (Ganancia/Pérdida) --------------------- */
export function DivergingBars({
  data,
  height = 240,
}: { data: { name: string; value: number }[] } & WithHeight) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 12, bottom: 6, left: 4 }}>
        <CartesianGrid stroke={gridStroke} />
        <XAxis dataKey="name" tick={{ ...axis, fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={48} />
        <YAxis tick={axis} tickFormatter={fmtCompact} width={44} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtUSD(v)} cursor={{ fill: "#0000000a" }} />
        <ReferenceLine y={0} stroke={FSA.muted} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={48}>
          {data.map((d, i) => (
            <Cell key={i} fill={gainLoss(d.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------- Línea evolución --------------------------- */
export function TrendLines({
  data,
  series,
  height = 240,
  yDomain,
  yPercent = false,
}: {
  data: Record<string, number | string>[];
  series: { key: string; name: string; color: string; dashed?: boolean }[];
  yDomain?: [number | string, number | string];
  yPercent?: boolean;
} & WithHeight) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 18, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={gridStroke} />
        <XAxis dataKey="label" tick={axis} />
        <YAxis
          tick={axis}
          width={48}
          domain={yDomain ?? [0, "auto"]}
          tickFormatter={(v) => (yPercent ? `${Number(v).toFixed(1)}%` : fmtCompact(Number(v)))}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => (yPercent ? `${Number(v).toFixed(2)}%` : fmtUSD(v))}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? "5 4" : undefined}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
