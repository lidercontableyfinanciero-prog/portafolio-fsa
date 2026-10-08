"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronsUpDown, FileCog, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import useSWR from "swr";

import { ChartCard } from "@/components/charts/ChartCard";
import { TrendLines } from "@/components/charts/Charts";
import { isNum, renderNationalCell } from "@/components/national/cells";
import { NationalSlicerBar } from "@/components/national/NationalSlicerBar";
import { NationalState } from "@/components/national/NationalState";
import { ReportConfigModal } from "@/components/reports/ReportConfigModal";
import { Card } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/States";
import { fetcher } from "@/lib/api";
import { FSA } from "@/lib/colors";
import { fmtCOP, fmtCOPCompact, fmtPct } from "@/lib/format";
import {
  type NationalAsset,
  type NationalReport,
  useNationalFilters,
  useNationalReport,
} from "@/lib/national";
import { useReportColumns } from "@/lib/reportColumns";
import type { ReportColumn } from "@/lib/types";

/** Vistas de la tabla, derivadas de las tablas del informe Excel:
 * todas las posiciones · "RENTA FIJA – CDTs" (tblCDT) · "CARTERA COLECTIVA – FICs" (tblFIC). */
const VIEWS: { key: string; label: string; filter: (a: NationalAsset) => boolean; cols: string[] }[] = [
  {
    key: "all",
    label: "Todas las posiciones",
    filter: () => true,
    cols: ["name", "asset_type", "entity", "issuer", "value_cut", "weight", "coupon_rate",
      "maturity_date", "years_remaining", "rent_ea", "benchmark_ea", "diff_vs_benchmark",
      "classification", "status"],
  },
  {
    key: "rf",
    label: "Renta fija · CDT y Bonos",
    filter: (a) => a.asset_type === "CDT" || a.asset_type === "Bono",
    cols: ["name", "nemo", "ref", "per", "nominal_value", "issue_date", "purchase_date",
      "maturity_date", "coupon_rate", "purchase_value", "sale_value", "pnl", "holding_irr",
      "sale_purchase_diff", "sale_rate", "income_tax_20", "discount", "years_remaining", "cal",
      "value_cut", "status"],
  },
  {
    key: "funds",
    label: "Fondos · FIC y FCP",
    filter: (a) => a.asset_type === "FIC" || a.asset_type === "FCP",
    cols: ["name", "entity", "prev_balance", "deposits", "withdrawals", "month_returns",
      "value_cut", "weight", "period_return", "rent_period", "rent_ea", "benchmark_ea",
      "diff_vs_benchmark"],
  },
];

export default function NationalPositionsPage() {
  const { query } = useNationalFilters();
  const { data, error, isLoading } = useNationalReport();
  const [reportOpen, setReportOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-600 text-fsa-navy">Posiciones · Portafolio Nacional</h1>
          <p className="text-sm text-fsa-muted">
            Filtra, ordena y busca; haz clic en una posición para ver su evolución, sus
            movimientos del mes y sus alertas.
          </p>
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
        query={query + (search ? `${query ? "&" : ""}search=${encodeURIComponent(search)}` : "")}
        columnsEndpoint="/national/export/columns"
        exportBase="/national/export/positions"
        storageKey="fsa_report_columns_nal"
        title="Configurar reporte · Portafolio Nacional"
      />
      <NationalSlicerBar />
      {error || (isLoading && !data) ? (
        <NationalState error={error} loading />
      ) : data ? (
        <PositionsTable d={data} search={search} setSearch={setSearch} />
      ) : null}
    </div>
  );
}

function PositionsTable({
  d,
  search,
  setSearch,
}: {
  d: NationalReport;
  search: string;
  setSearch: (s: string) => void;
}) {
  const { byKey, isLoading } = useReportColumns("/national/export/columns");
  const [view, setView] = useState(VIEWS[0].key);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "value_cut", dir: "desc" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const v = VIEWS.find((x) => x.key === view) ?? VIEWS[0];
  const cols = v.cols.flatMap((k) => (byKey.get(k) ? [byKey.get(k) as ReportColumn] : []));

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = d.assets.filter(
      (a) => v.filter(a) && (!s || a.name.toLowerCase().includes(s) || a.issuer.toLowerCase().includes(s)),
    );
    const get = (a: NationalAsset) => (a as unknown as Record<string, unknown>)[sort.key];
    return [...list].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es");
      return sort.dir === "asc" ? r : -r;
    });
  }, [d.assets, v, search, sort]);

  const totals = (c: ReportColumn) => {
    if (c.key === "weight") return fmtPct(rows.reduce((s, a) => s + a.weight, 0));
    if (!c.total) return null;
    return fmtCOP(rows.reduce((s, a) => s + (((a as unknown as Record<string, number | null>)[c.key]) ?? 0), 0));
  };

  return (
    <Card className="overflow-hidden">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-fsa-border bg-fsa-surface p-0.5" role="tablist">
          {VIEWS.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={view === x.key}
              onClick={() => setView(x.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                view === x.key ? "bg-white font-600 text-fsa-navy shadow-sm" : "text-fsa-muted hover:text-fsa-navy"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <label className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fsa-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar inversión o emisor…"
            aria-label="Buscar"
            className="h-9 w-64 rounded-lg border border-fsa-border pl-8 pr-3 text-sm outline-none focus:border-fsa-blue"
          />
        </label>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !rows.length ? (
        <EmptyState message="No hay posiciones que coincidan con los filtros." />
      ) : (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fsa-border text-left text-xs text-fsa-muted">
                {cols.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === "desc" ? "asc" : "desc" }))}
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={`cursor-pointer select-none whitespace-nowrap px-2 py-2 font-500 hover:text-fsa-navy ${isNum(c) ? "text-right" : ""}`}
                      title={c.label}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.short}
                        {active ? (
                          sort.dir === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" aria-hidden />
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const isOpen = expanded === a.name;
                return (
                  <Fragment key={a.name}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : a.name)}
                      className={`cursor-pointer border-b border-fsa-border/50 transition-colors ${isOpen ? "bg-fsa-surface-2" : "hover:bg-fsa-surface-2"}`}
                    >
                      {cols.map((c) => (
                        <td key={c.key} className={`px-2 py-1.5 ${c.key === "name" ? "min-w-[200px] font-500 text-fsa-navy" : "whitespace-nowrap"} ${isNum(c) ? "tnum text-right" : ""}`}>
                          {renderNationalCell(c, a)}
                        </td>
                      ))}
                    </tr>
                    <AnimatePresence initial={false}>
                      {isOpen ? (
                        <tr>
                          <td colSpan={cols.length} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <AssetDetail a={a} d={d} />
                            </motion.div>
                          </td>
                        </tr>
                      ) : null}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-fsa-navy/20 bg-fsa-surface-2 font-600 text-fsa-navy">
                {cols.map((c, i) => (
                  <td key={c.key} className={`whitespace-nowrap px-2 py-2 ${isNum(c) ? "tnum text-right" : ""}`}>
                    {i === 0 ? `Totales · ${rows.length} posiciones` : totals(c)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

interface MovementRow {
  period: string;
  concept: string;
  movement_type: string | null;
  value: number | null;
}

function AssetDetail({ a, d }: { a: NationalAsset; d: NationalReport }) {
  const { data: movs } = useSWR<MovementRow[]>(
    `/national/movements?name=${encodeURIComponent(a.name)}&year=${d.cut.year}&month=${d.cut.month}`,
    fetcher,
  );
  const series = Object.keys(a.values).map((p) => ({ label: p, valor: a.values[p], retorno: a.returns[p] }));
  const alerts: [string, string][] = [
    ["Concentración emisor", a.st_issuer],
    ["Baja liquidez", a.st_liquidity],
    ["Plazo", a.st_term],
    ["Vencimiento próximo", a.st_maturity],
    ["Tasa vs IPC", a.st_rate],
    ["Rentabilidad vs benchmark", a.st_return],
  ];
  const color = (s: string) =>
    s === "Crítico" ? FSA.red : s === "Atención" ? FSA.amber : s === "OK" || s === "Sobresaliente" ? FSA.green : FSA.muted;

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <ChartCard
          title={`${a.name} · valor de cierre mensual`}
          subtitle={`${a.asset_type} · ${a.group} · emisor ${a.issuer}`}
          tableHead={["Mes", "Valor", "Retorno del mes"]}
          tableRows={series.map((s) => [s.label, fmtCOP(s.valor), fmtCOP(s.retorno)])}
          height={220}
        >
          <TrendLines data={series} yDomain={["auto", "auto"]} money={fmtCOP} compact={fmtCOPCompact}
            series={[{ key: "valor", name: "Valor de cierre", color: FSA.blue }]} />
        </ChartCard>
      </div>
      <div className="space-y-3 lg:col-span-2">
        <Card>
          <h4 className="mb-2 text-xs font-600 uppercase tracking-wide text-fsa-muted">Semáforo de la posición</h4>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {alerts.map(([k, s]) => (
              <li key={k} className="flex items-center justify-between gap-2">
                <span className="text-fsa-muted">{k}</span>
                <span className="font-600" style={{ color: color(s) }}>{s}</span>
              </li>
            ))}
          </ul>
          {a.observation ? <p className="mt-2 text-xs text-fsa-navy">{a.observation}</p> : null}
        </Card>
        <Card>
          <h4 className="mb-2 text-xs font-600 uppercase tracking-wide text-fsa-muted">
            Movimientos de {d.cut.label} (base de datos)
          </h4>
          {!movs ? (
            <Spinner />
          ) : !movs.length ? (
            <p className="text-xs text-fsa-muted">Sin movimientos en el mes de corte.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {movs.map((m, i) => (
                  <tr key={i} className="border-b border-fsa-border/50 last:border-0">
                    <td className="py-1 pr-2">{m.concept}</td>
                    <td className="py-1 pr-2 text-fsa-muted">{m.movement_type ?? ""}</td>
                    <td className="tnum py-1 text-right">{m.value == null ? "—" : fmtCOP(m.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
