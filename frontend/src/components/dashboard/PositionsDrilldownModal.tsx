"use client";

import useSWR from "swr";

import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { fetcher } from "@/lib/api";
import { FSA } from "@/lib/colors";
import { fmtUSD } from "@/lib/format";
import type { PositionsResponse } from "@/lib/types";

export interface DrilldownRequest {
  year: number;
  month: string;
  label: string;
  metricLabel: string;
  types: string[];
  classifications: string[];
}

/** Modal de detalle: posiciones que componen una celda del análisis horizontal
 * (mismo período y mismos filtros de Tipo/Clasificación activos en Histórico). */
export function PositionsDrilldownModal({
  request,
  onClose,
}: {
  request: DrilldownRequest | null;
  onClose: () => void;
}) {
  const params = new URLSearchParams();
  if (request) {
    params.set("year", String(request.year));
    params.set("month", request.month);
    for (const t of request.types) params.append("type", t);
    for (const c of request.classifications) params.append("classification", c);
    params.set("sort_by", "market_value");
    params.set("sort_dir", "desc");
    params.set("page_size", "500");
  }
  const key = request ? `/positions?${params.toString()}` : null;
  const { data, error, isLoading } = useSWR<PositionsResponse>(key, fetcher);

  return (
    <Modal
      open={request != null}
      onClose={onClose}
      title={request ? `${request.metricLabel} · ${request.label}` : ""}
      subtitle={
        request
          ? `Posiciones que componen esta cifra${
              request.types.length || request.classifications.length
                ? " (con los filtros de tipo/clasificación activos)"
                : ""
            }`
          : undefined
      }
    >
      {error ? (
        <ErrorState message={error.message} />
      ) : isLoading || !data ? (
        <Spinner label="Cargando posiciones…" />
      ) : !data.items.length ? (
        <EmptyState message="No hay posiciones que coincidan con este corte." />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fsa-muted">
            <span>
              <span className="font-600 text-fsa-navy">{data.total}</span> posiciones
            </span>
            <span>
              V. Mercado total:{" "}
              <span className="font-600 text-fsa-navy">
                {fmtUSD(data.totals.valor_mercado)}
              </span>
            </span>
            <span>
              G/(P):{" "}
              <span
                className="font-600"
                style={{ color: data.totals.gp_no_realizada >= 0 ? FSA.green : FSA.red }}
              >
                {fmtUSD(data.totals.gp_no_realizada)}
              </span>
            </span>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fsa-border text-left text-xs font-500 text-fsa-muted">
                  <th className="py-1.5 pr-3 font-600">Descripción</th>
                  <th className="py-1.5 px-3 font-600">Tipo</th>
                  <th className="py-1.5 px-3 font-600">Clasificación</th>
                  <th className="py-1.5 px-3 text-right font-600">Costo</th>
                  <th className="py-1.5 pl-3 text-right font-600">V. Mercado</th>
                  <th className="py-1.5 pl-3 text-right font-600">G/(P)</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.identifier} className="border-b border-fsa-border/50 last:border-0">
                    <td className="max-w-[220px] truncate py-1.5 pr-3" title={p.description}>
                      {p.description}
                    </td>
                    <td className="py-1.5 px-3 text-fsa-muted">{p.type ?? "—"}</td>
                    <td className="py-1.5 px-3 text-fsa-muted">{p.classification ?? "—"}</td>
                    <td className="tnum py-1.5 px-3 text-right">{fmtUSD(p.cost_basis)}</td>
                    <td className="tnum py-1.5 pl-3 text-right font-600">
                      {fmtUSD(p.market_value)}
                    </td>
                    <td
                      className="tnum py-1.5 pl-3 text-right"
                      style={{ color: p.unrealized_gain_loss >= 0 ? FSA.green : FSA.red }}
                    >
                      {fmtUSD(p.unrealized_gain_loss)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
