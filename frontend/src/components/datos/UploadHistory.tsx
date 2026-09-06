"use client";

import useSWR from "swr";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { fetcher } from "@/lib/api";
import { FSA } from "@/lib/colors";
import type { IngestionHistory, IngestionStatus } from "@/lib/types";

const STATUS: Record<IngestionStatus, { label: string; color: string }> = {
  success: { label: "Éxito", color: FSA.green },
  partial: { label: "Parcial", color: FSA.amber },
  conflict: { label: "Rechazada (mes duplicado)", color: FSA.orange },
  error: { label: "Error", color: FSA.red },
  dry_run: { label: "Previsualización", color: FSA.muted },
};

export function UploadHistory() {
  const { data, error, isLoading } = useSWR<IngestionHistory>(
    "/etl/history?limit=50",
    fetcher,
    { keepPreviousData: true },
  );

  return (
    <Card className="overflow-hidden">
      <h3 className="mb-3 font-display text-[15px] font-600 text-fsa-navy">
        Histórico de cargas
        {data ? (
          <span className="ml-2 text-xs font-400 text-fsa-muted">{data.total} registros</span>
        ) : null}
      </h3>

      {error ? (
        <ErrorState message={error.message} />
      ) : isLoading && !data ? (
        <Spinner />
      ) : !data?.items.length ? (
        <EmptyState message="Aún no se han registrado cargas." />
      ) : (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fsa-border text-left text-[11px] uppercase tracking-wide text-fsa-muted">
                <th className="py-2 pr-3 font-600">Fecha de subida</th>
                <th className="py-2 px-3 font-600">Archivo</th>
                <th className="py-2 px-3 font-600">Usuario</th>
                <th className="py-2 px-3 font-600">Estado</th>
                <th className="py-2 px-3 text-right font-600">Filas</th>
                <th className="py-2 px-3 font-600">Períodos</th>
                <th className="py-2 pl-3 font-600">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => {
                const s = STATUS[row.status];
                return (
                  <tr
                    key={row.id}
                    className="border-b border-fsa-border/50 align-top last:border-0 hover:bg-fsa-surface-2"
                  >
                    <td className="tnum py-1.5 pr-3 whitespace-nowrap">
                      {new Date(row.uploaded_at).toLocaleString("es-CO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-1.5 px-3">
                      <span className="inline-flex items-center gap-1.5">
                        <FileIcon />
                        {row.filename}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-fsa-muted">{row.uploaded_by ?? "—"}</td>
                    <td className="py-1.5 px-3">
                      <Badge color={s.color}>{s.label}</Badge>
                    </td>
                    <td className="tnum py-1.5 px-3 text-right">
                      {row.valid_rows}/{row.total_rows}
                      {row.error_count ? (
                        <span className="text-fsa-red"> ({row.error_count} err)</span>
                      ) : null}
                    </td>
                    <td className="py-1.5 px-3 text-fsa-muted">
                      {row.periods.map((p) => p.replace("-", " ")).join(", ") || "—"}
                    </td>
                    <td className="py-1.5 pl-3 text-xs text-fsa-muted">
                      {row.message ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function FileIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0 text-fsa-muted"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
