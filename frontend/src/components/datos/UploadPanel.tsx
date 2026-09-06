"use client";

import { CheckCircle2, FileSpreadsheet, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useSWRConfig } from "swr";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";
import { api } from "@/lib/api";

interface UploadSummary {
  filename: string;
  total_rows: number;
  valid_rows: number;
  error_count: number;
  errors: { row: number | null; error: string; identifier?: string }[];
  detected_columns: Record<string, string>;
  ignored_columns: string[];
  dry_run: boolean;
  instruments?: number;
  snapshots_inserted?: number;
  snapshots_updated?: number;
}

export function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate } = useSWRConfig();
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);

  async function send(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.upload<UploadSummary>(
        `/etl/upload?dry_run=${dryRun}`,
        form,
      );
      setSummary(res);
      if (!dryRun) {
        setCommitted(true);
        // Revalida todas las vistas dependientes
        mutate((k) => typeof k === "string" && k.startsWith("/portfolio"));
        mutate((k) => typeof k === "string" && k.startsWith("/positions"));
        mutate((k) => typeof k === "string" && k.startsWith("/returns"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir el archivo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-1 font-display text-[15px] font-600 text-fsa-navy">
        Cargar extracto (CSV / Excel)
      </h3>
      <p className="mb-4 text-xs text-fsa-muted">
        El ETL ignora columnas vacías y <code>Unnamed:*</code>, normaliza fechas y
        montos, y hace <em>upsert</em> por (Año, Mes, Identificador).
      </p>

      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-fsa-border bg-fsa-surface px-4 py-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) {
            setFile(f);
            setSummary(null);
            setCommitted(false);
          }
        }}
      >
        <UploadCloud className="h-7 w-7 text-fsa-muted" aria-hidden />
        <p className="text-sm text-fsa-muted">
          Arrastra el archivo aquí o
          <button
            className="ml-1 font-600 text-fsa-blue underline"
            onClick={() => inputRef.current?.click()}
          >
            selecciónalo
          </button>
        </p>
        {file ? (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-fsa-navy">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            {file.name}
          </p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xlsm,.xls"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setSummary(null);
            setCommitted(false);
          }}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="outline" disabled={!file || busy} onClick={() => send(true)}>
          {busy ? "Analizando…" : "Previsualizar"}
        </Button>
        <Button
          variant="cta"
          disabled={!file || busy || !summary || committed}
          onClick={() => send(false)}
        >
          Confirmar carga
        </Button>
      </div>

      {error ? <div className="mt-3"><ErrorState message={error} /></div> : null}

      {summary ? (
        <div className="mt-4 space-y-3 rounded border border-fsa-border bg-white p-3 text-sm">
          {committed ? (
            <p className="inline-flex items-center gap-1.5 font-600 text-fsa-green">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Carga aplicada: {summary.snapshots_inserted} nuevos ·{" "}
              {summary.snapshots_updated} actualizados · {summary.instruments} instrumentos
            </p>
          ) : (
            <p className="font-600 text-fsa-navy">
              Previsualización — {summary.valid_rows} filas válidas de {summary.total_rows}
              {summary.error_count ? ` · ${summary.error_count} con error` : ""}
            </p>
          )}

          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] font-600 uppercase text-fsa-muted">
                Columnas detectadas ({Object.keys(summary.detected_columns).length})
              </p>
              <ul className="max-h-40 space-y-0.5 overflow-auto scroll-thin text-xs text-fsa-muted">
                {Object.entries(summary.detected_columns).map(([k, v]) => (
                  <li key={k}>
                    <span className="text-fsa-navy">{v}</span> ← {k.replace(/\s+/g, " ")}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-600 uppercase text-fsa-muted">
                Columnas ignoradas ({summary.ignored_columns.length})
              </p>
              <p className="text-xs text-fsa-muted">
                {summary.ignored_columns.join(", ") || "—"}
              </p>
            </div>
          </div>

          {summary.errors.length ? (
            <div>
              <p className="mb-1 text-[11px] font-600 uppercase text-fsa-red">
                Errores (primeros {summary.errors.length})
              </p>
              <ul className="max-h-40 space-y-0.5 overflow-auto scroll-thin text-xs text-fsa-red">
                {summary.errors.map((e, i) => (
                  <li key={i}>
                    Fila {e.row ?? "?"}: {e.error} {e.identifier ? `(${e.identifier})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
