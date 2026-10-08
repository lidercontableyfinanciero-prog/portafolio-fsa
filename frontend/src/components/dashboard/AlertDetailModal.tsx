"use client";

import useSWR from "swr";

import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { fetcher } from "@/lib/api";
import { FSA } from "@/lib/colors";
import { fmtDate, fmtNum, fmtPct, fmtUSD, fmtYears } from "@/lib/format";
import { isNumericKind, renderPositionCell, useReportColumns } from "@/lib/reportColumns";
import type { AlertDetail } from "@/lib/types";

/** Alerta seleccionada: clave del registro de alertas del backend y, para los
 * paneles de riesgo, la categoría (p. ej. "Revisar", "Grado Especulativo"). */
export interface AlertRequest {
  alert: string;
  label?: string;
}

/** Ventana de detalle ÚNICA para cualquier alerta del dashboard:
 * alerta → condición (backend) → posiciones filtradas → tabla dinámica. */
export function AlertDetailModal({
  request,
  query,
  onClose,
}: {
  request: AlertRequest | null;
  /** Filtros activos del dashboard (query string sin "?"). */
  query: string;
  onClose: () => void;
}) {
  const params = new URLSearchParams(query);
  if (request) {
    params.set("alert", request.alert);
    if (request.label) params.set("label", request.label);
  }
  const key = request ? `/portfolio/alerts/detail?${params.toString()}` : null;
  const { data, error, isLoading } = useSWR<AlertDetail>(key, fetcher);
  const { byKey } = useReportColumns();
  // Evita mostrar el detalle de la alerta anterior mientras carga la nueva.
  const current =
    data && request && data.alert === request.alert && (data.label ?? undefined) === request.label
      ? data
      : undefined;

  const cols = (current?.columns ?? []).flatMap((k) => {
    const c = byKey.get(k);
    return c ? [c] : [];
  });
  const s = current?.summary;

  return (
    <Modal
      open={request != null}
      onClose={onClose}
      size="xl"
      title={current?.title ?? "Detalle de la alerta"}
      subtitle={
        current
          ? `${current.description} · ${current.period.month} ${current.period.year} · tiempo al vencimiento calculado al ${fmtDate(current.as_of)}`
          : undefined
      }
    >
      {error ? (
        <ErrorState message={error.message} />
      ) : isLoading || !current || !s ? (
        <Spinner label="Cargando posiciones…" />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {s.plazo_promedio_anios != null &&
            (current.alert === "plazo_prom_vencimiento" || current.alert === "vencimientos_1a") ? (
              <SummaryTile
                highlight
                label="Plazo promedio de vencimiento"
                value={fmtYears(s.plazo_promedio_anios)}
                sub={`Promedio simple de ${s.con_vencimiento} posiciones`}
              />
            ) : null}
            <SummaryTile
              label="Posiciones"
              value={fmtNum(s.posiciones)}
              sub={`de ${fmtNum(s.universo_posiciones)} en el universo`}
            />
            <SummaryTile
              label="Valor de mercado"
              value={fmtUSD(s.valor_mercado)}
              sub={`${fmtPct(s.pct_universo)} del universo`}
            />
            <SummaryTile
              label="G/(P) no realizada"
              value={fmtUSD(s.gp_no_realizada)}
              color={s.gp_no_realizada >= 0 ? FSA.green : FSA.red}
              sub={`Costo ${fmtUSD(s.costo)}`}
            />
          </div>

          {!current.items.length ? (
            <EmptyState message="Ninguna posición cumple la condición de esta alerta." />
          ) : (
            <div className="overflow-x-auto scroll-thin rounded border border-fsa-border">
              <table className="w-full text-sm">
                <thead className="bg-fsa-surface">
                  <tr className="border-b border-fsa-border text-left text-xs text-fsa-muted">
                    {cols.map((c) => (
                      <th
                        key={c.key}
                        className={`whitespace-nowrap px-2.5 py-2 font-600 ${isNumericKind(c) ? "text-right" : ""}`}
                      >
                        {c.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {current.items.map((p, i) => (
                    <tr
                      key={`${p.identifier}-${p.acquired_date ?? i}`}
                      className="border-b border-fsa-border/50 last:border-0 hover:bg-fsa-surface-2"
                    >
                      {cols.map((c) => (
                        <td
                          key={c.key}
                          className={`px-2.5 py-1.5 ${
                            c.key === "description"
                              ? "min-w-[180px] max-w-[260px]"
                              : "whitespace-nowrap"
                          } ${isNumericKind(c) ? "tnum text-right" : ""}`}
                        >
                          {renderPositionCell(c, p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  color,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded border p-3 ${
        highlight ? "border-fsa-blue/40 bg-fsa-blue/5" : "border-fsa-border"
      }`}
    >
      <p className="text-xs font-500 text-fsa-muted">{label}</p>
      <p className="tnum mt-1 font-display text-base font-600" style={{ color: color ?? FSA.navy }}>
        {value}
      </p>
      {sub ? <p className="text-xs text-fsa-muted">{sub}</p> : null}
    </div>
  );
}
