"use client";

import {
  ArrowLeft,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, Spinner } from "@/components/ui/States";
import { fetchBlob, saveBlob } from "@/lib/api";
import { useReportColumns } from "@/lib/reportColumns";
import type { ReportColumn } from "@/lib/types";

function loadSaved(storageKey: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey);
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}

function save(storageKey: string, keys: string[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(keys));
  } catch {
    /* almacenamiento no disponible: la selección vive solo en esta sesión */
  }
}

/** "Configurar reporte": el usuario elige las columnas y exporta a Excel o PDF
 * (con vista previa del PDF real generado por el backend). Solo se exportan
 * las columnas seleccionadas. */
export function ReportConfigModal({
  open,
  onClose,
  query,
  columnsEndpoint = "/export/positions/columns",
  exportBase = "/export/positions",
  storageKey = "fsa_report_columns",
  title = "Configurar reporte de posiciones",
}: {
  open: boolean;
  onClose: () => void;
  /** Filtros activos (query string sin "?"), los mismos de la vista. */
  query: string;
  /** catálogo de columnas del portafolio (internacional por defecto) */
  columnsEndpoint?: string;
  /** ruta de exportación sin extensión */
  exportBase?: string;
  storageKey?: string;
  title?: string;
}) {
  const { columns, error: colsError, isLoading } = useReportColumns(columnsEndpoint);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [step, setStep] = useState<"config" | "preview">("config");
  const [busy, setBusy] = useState<"xlsx" | "pdf" | "preview" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob; name: string } | null>(
    null,
  );

  const defaults = useMemo(() => columns.filter((c) => c.default).map((c) => c.key), [columns]);

  // Selección inicial: la última usada (si existe) o las predeterminadas.
  useEffect(() => {
    if (!columns.length || selected) return;
    const known = new Set(columns.map((c) => c.key));
    const saved = loadSaved(storageKey)?.filter((k) => known.has(k as ReportColumn["key"]));
    setSelected(saved && saved.length ? saved : defaults);
  }, [columns, defaults, selected, storageKey]);

  // Libera la URL de la vista previa al reemplazarla o cerrar.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const chosen = new Set(selected ?? []);
  const groups = useMemo(() => {
    const m = new Map<string, ReportColumn[]>();
    for (const c of columns) m.set(c.group, [...(m.get(c.group) ?? []), c]);
    return [...m.entries()];
  }, [columns]);

  function update(keys: string[]) {
    setSelected(keys);
    save(storageKey, keys);
    setPreview(null);
  }

  function toggle(key: string) {
    update(chosen.has(key) ? [...chosen].filter((k) => k !== key) : [...chosen, key]);
  }

  function url(ext: "xlsx" | "pdf") {
    const p = new URLSearchParams(query);
    // en el orden del catálogo = orden de las columnas en el archivo
    for (const c of columns) if (chosen.has(c.key)) p.append("columns", c.key);
    return `${exportBase}.${ext}?${p.toString()}`;
  }

  async function run(kind: "xlsx" | "pdf" | "preview") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "pdf" && preview) {
        saveBlob(preview.blob, preview.name); // exporta exactamente lo previsualizado
        return;
      }
      const { blob, name } = await fetchBlob(url(kind === "xlsx" ? "xlsx" : "pdf"));
      if (kind === "preview") {
        setPreview({ url: URL.createObjectURL(blob), blob, name });
        setStep("preview");
      } else {
        saveBlob(blob, name);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el reporte");
    } finally {
      setBusy(null);
    }
  }

  function close() {
    setStep("config");
    setPreview(null);
    setError(null);
    onClose();
  }

  const none = chosen.size === 0;
  const spin = <Loader2 className="h-4 w-4 animate-spin" aria-hidden />;

  const footer =
    step === "config" ? (
      <>
        <Button variant="ghost" onClick={close}>
          Cancelar
        </Button>
        <Button variant="outline" onClick={() => run("xlsx")} disabled={none || !!busy}>
          {busy === "xlsx" ? spin : <FileSpreadsheet className="h-4 w-4 text-fsa-green" aria-hidden />}
          Exportar a Excel
        </Button>
        <Button variant="outline" onClick={() => run("preview")} disabled={none || !!busy}>
          {busy === "preview" ? spin : <Eye className="h-4 w-4" aria-hidden />}
          Vista previa PDF
        </Button>
        <Button onClick={() => run("pdf")} disabled={none || !!busy}>
          {busy === "pdf" ? spin : <FileText className="h-4 w-4" aria-hidden />}
          Exportar a PDF
        </Button>
      </>
    ) : (
      <>
        <Button variant="outline" onClick={() => setStep("config")} className="mr-auto">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a configuración
        </Button>
        <Button variant="ghost" onClick={close}>
          Cancelar
        </Button>
        <Button onClick={() => run("pdf")} disabled={!!busy}>
          {busy === "pdf" ? spin : <FileText className="h-4 w-4" aria-hidden />}
          Exportar PDF
        </Button>
      </>
    );

  return (
    <Modal
      open={open}
      onClose={close}
      size={step === "preview" ? "xl" : "lg"}
      title={step === "config" ? title : "Vista previa del PDF"}
      subtitle={
        step === "config"
          ? "Selecciona las columnas a incluir. Se aplican los filtros y el período activos."
          : `Así quedará el archivo: ${chosen.size} columnas · A4 horizontal · con totales y paginación.`
      }
      footer={footer}
    >
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}

      {step === "preview" && preview ? (
        <div className="space-y-2">
          <iframe
            src={`${preview.url}#view=FitH`}
            title="Vista previa del reporte PDF"
            className="h-[62vh] w-full rounded border border-fsa-border bg-fsa-surface"
          />
          <a
            href={preview.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-fsa-blue hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Abrir la vista previa en una pestaña nueva
          </a>
        </div>
      ) : colsError ? (
        <ErrorState message={`No se pudo cargar el catálogo de columnas: ${colsError.message}`} />
      ) : isLoading || !selected ? (
        <Spinner label="Cargando columnas…" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="mr-auto text-fsa-muted">
              <span className="font-600 text-fsa-navy">{chosen.size}</span> de {columns.length}{" "}
              columnas seleccionadas
            </span>
            <button
              className="rounded border border-fsa-border px-2 py-1 text-fsa-navy hover:bg-fsa-surface"
              onClick={() => update(columns.map((c) => c.key))}
            >
              Seleccionar todo
            </button>
            <button
              className="rounded border border-fsa-border px-2 py-1 text-fsa-navy hover:bg-fsa-surface"
              onClick={() => update([])}
            >
              Ninguna
            </button>
            <button
              className="inline-flex items-center gap-1 rounded border border-fsa-border px-2 py-1 text-fsa-navy hover:bg-fsa-surface"
              onClick={() => update(defaults)}
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Predeterminadas
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map(([group, cols]) => (
              <fieldset key={group} className="rounded border border-fsa-border p-3">
                <legend className="px-1 font-display text-xs font-600 uppercase tracking-wide text-fsa-muted">
                  {group}
                </legend>
                <div className="space-y-1">
                  {cols.map((c) => (
                    <label
                      key={c.key}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-fsa-surface"
                    >
                      <input
                        type="checkbox"
                        checked={chosen.has(c.key)}
                        onChange={() => toggle(c.key)}
                        className="h-4 w-4 accent-fsa-blue"
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {none ? (
            <p className="text-xs text-fsa-red">Selecciona al menos una columna para exportar.</p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
