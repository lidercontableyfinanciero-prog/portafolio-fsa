"use client";

import { Modal } from "@/components/ui/Modal";
import { EmptyState, Spinner } from "@/components/ui/States";
import { isNum, renderNationalCell } from "@/components/national/cells";
import { fmtCOP, fmtPct } from "@/lib/format";
import type { NationalAsset } from "@/lib/national";
import { useReportColumns } from "@/lib/reportColumns";

export interface AssetsRequest {
  title: string;
  subtitle?: string;
  /** posiciones que cumplen la condición seleccionada */
  assets: NationalAsset[];
  /** claves del catálogo de columnas a mostrar */
  columns: string[];
  total?: number;
}

/** Ventana de detalle dinámica del portafolio nacional: la condición la define
 * quien la abre (límite, clasificación, emisor…); las columnas salen del
 * catálogo único de reportes. */
export function NationalAssetsModal({
  request,
  onClose,
}: {
  request: AssetsRequest | null;
  onClose: () => void;
}) {
  const { byKey, isLoading } = useReportColumns("/national/export/columns");
  const cols = (request?.columns ?? []).flatMap((k) => {
    const c = byKey.get(k);
    return c ? [c] : [];
  });
  const sum = request?.assets.reduce((s, a) => s + a.value_cut, 0) ?? 0;

  return (
    <Modal open={request != null} onClose={onClose} size="xl" title={request?.title ?? ""}
      subtitle={request?.subtitle}>
      {!request ? null : isLoading ? (
        <Spinner />
      ) : !request.assets.length ? (
        <EmptyState message="Ninguna posición cumple esta condición." />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-fsa-muted">
            <span><span className="font-600 text-fsa-navy">{request.assets.length}</span> posiciones</span>
            <span>Valor al corte: <span className="font-600 text-fsa-navy">{fmtCOP(sum)}</span></span>
            {request.total ? (
              <span>Peso: <span className="font-600 text-fsa-navy">{fmtPct(sum / request.total)}</span> del portafolio</span>
            ) : null}
          </div>
          <div className="overflow-x-auto scroll-thin rounded border border-fsa-border">
            <table className="w-full text-sm">
              <thead className="bg-fsa-surface">
                <tr className="border-b border-fsa-border text-left text-xs text-fsa-muted">
                  {cols.map((c) => (
                    <th key={c.key} className={`whitespace-nowrap px-2.5 py-2 font-600 ${isNum(c) ? "text-right" : ""}`}>
                      {c.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {request.assets.map((a) => (
                  <tr key={a.name} className="border-b border-fsa-border/50 last:border-0 hover:bg-fsa-surface-2">
                    {cols.map((c) => (
                      <td key={c.key} className={`px-2.5 py-1.5 ${
                        c.key === "name" || c.key === "observation" ? "min-w-[200px]" : "whitespace-nowrap"
                      } ${isNum(c) ? "tnum text-right" : ""}`}>
                        {renderNationalCell(c, a)}
                      </td>
                    ))}
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
