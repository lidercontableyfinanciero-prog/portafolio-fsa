"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState, Spinner } from "@/components/ui/States";
import { ApiError, api, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Summary {
  filename: string;
  sheet: string | null;
  total_rows: number;
  valid_rows: number;
  errors: { row: number | null; name?: string; error: string }[];
  error_count: number;
  missing_columns: string[];
  warnings: string[];
  ignored_columns: string[];
  periods: string[];
  existing_periods: { label: string; rows: number }[];
  new_assets: string[];
  ok: boolean;
  status?: string;
  inserted?: number;
  deleted?: number;
}

interface History {
  items: { id: number; uploaded_at: string; filename: string; uploaded_by: string | null;
    status: string; total_rows: number; error_count: number; periods: string[]; message: string | null }[];
}

export default function NationalImportPage() {
  const { canUpload, isAdmin } = useAuth();
  const { mutate } = useSWRConfig();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Summary | null>(null);
  const [result, setResult] = useState<Summary | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: history, mutate: refreshHistory } = useSWR<History>(isAdmin ? "/national/history" : null, fetcher);

  if (!canUpload) {
    return (
      <ErrorState message="No tienes permiso para cargar archivos. Solicítalo a un administrador en Seguridad." />
    );
  }

  async function send(dry: boolean) {
    if (!file) return;
    setBusy(dry ? "preview" : "import");
    setError(null);
    if (!dry) setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await api.upload<Summary>(`/national/upload?dry_run=${dry}&replace=${replace}`, form);
      if (dry) setPreview(r);
      else {
        setResult(r);
        setPreview(null);
        setFile(null);
        // El dashboard, posiciones, gráficos y KPIs se recalculan desde la nueva base.
        mutate((key) => typeof key === "string" && key.startsWith("/national"));
      }
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError(e instanceof Error ? e.message : "No fue posible importar la base de datos.");
      if (!dry) mutate((key) => typeof key === "string" && key.startsWith("/national/history"));
    } finally {
      setBusy(null);
      refreshHistory();
    }
  }

  const p = preview;
  const conflict = !!p && p.existing_periods.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-lg font-600 text-fsa-navy">Importar información · Portafolio Nacional</h1>
        <p className="text-sm text-fsa-muted">
          Carga la «Base de Datos Portafolio Inversiones Nacionales» (hoja <code>Data_Nal</code>).
          Primero se valida y previsualiza; nada se escribe hasta confirmar.
        </p>
      </div>

      <Card>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) { setFile(f); setPreview(null); setResult(null); }
          }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-fsa-border px-6 py-10 text-center transition-colors hover:border-fsa-blue/50 hover:bg-fsa-surface"
        >
          <UploadCloud className="h-8 w-8 text-fsa-blue" aria-hidden />
          <p className="mt-2 text-sm font-600 text-fsa-navy">
            {file ? file.name : "Arrastra el archivo aquí o haz clic para seleccionarlo"}
          </p>
          <p className="mt-1 text-xs text-fsa-muted">Excel (.xlsx) o CSV · máx. 25 MB</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls,.csv" className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setResult(null); }} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => send(true)} disabled={!file || !!busy}>
            {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="h-4 w-4" aria-hidden />}
            Validar y previsualizar
          </Button>
          {error ? <div className="w-full"><ErrorState message={error} /></div> : null}
        </div>
      </Card>

      {p ? (
        <Card className="space-y-4">
          <div className="flex items-start gap-3">
            {p.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-fsa-green" aria-hidden /> : <XCircle className="mt-0.5 h-5 w-5 text-fsa-red" aria-hidden />}
            <div>
              <h3 className="font-display text-[15px] font-600 text-fsa-navy">
                {p.ok ? "El archivo es válido" : "No fue posible importar la base de datos"}
              </h3>
              <p className="text-xs text-fsa-muted">
                {p.filename}{p.sheet ? ` · hoja «${p.sheet}»` : ""} · {p.total_rows} registros · {p.valid_rows} válidos
                {p.periods.length ? ` · meses: ${p.periods.join(", ")}` : ""}
              </p>
            </div>
          </div>

          {!p.ok ? (
            <div className="rounded-lg border border-fsa-red/30 bg-fsa-red/5 p-3 text-sm text-fsa-red">
              <p className="font-600">Se encontraron las siguientes inconsistencias:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {p.missing_columns.map((c) => <li key={c}>Falta la columna: {c}</li>)}
                {p.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>{e.row ? `Fila ${e.row}${e.name ? ` (${e.name})` : ""}: ` : ""}{e.error}</li>
                ))}
                {p.error_count > 50 ? <li>… y {p.error_count - 50} más</li> : null}
              </ul>
            </div>
          ) : null}

          {p.warnings.length ? (
            <div className="rounded-lg border border-fsa-amber/40 bg-fsa-amber/10 p-3 text-sm text-fsa-navy">
              <p className="flex items-center gap-1.5 font-600"><AlertTriangle className="h-4 w-4 text-fsa-amber" aria-hidden /> Advertencias</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">{p.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          ) : null}

          {p.new_assets.length ? (
            <p className="text-xs text-fsa-navy">
              Inversiones nuevas (se crearán con atributos deducidos y quedarán para revisión en
              Parámetros): <span className="font-600">{p.new_assets.join(", ")}</span>
            </p>
          ) : null}
          {p.ignored_columns.length ? (
            <p className="text-xs text-fsa-muted">
              Columnas calculadas que el sistema recalcula (se ignoran): {p.ignored_columns.join(", ")}
            </p>
          ) : null}

          {p.ok ? (
            <div className="flex flex-wrap items-center gap-4 border-t border-fsa-border pt-4">
              {conflict ? (
                <label className="flex items-center gap-2 text-sm text-fsa-navy">
                  <input type="checkbox" className="h-4 w-4 accent-fsa-blue" checked={replace}
                    onChange={(e) => setReplace(e.target.checked)} />
                  Reemplazar los meses ya cargados ({p.existing_periods.map((x) => x.label).join(", ")})
                </label>
              ) : null}
              <Button onClick={() => send(false)} disabled={!!busy || (conflict && !replace)} className="ml-auto">
                {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UploadCloud className="h-4 w-4" aria-hidden />}
                Importar
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {result ? (
        <div className="flex items-start gap-2 rounded-lg border border-fsa-green/30 bg-fsa-green/5 px-4 py-3 text-sm text-fsa-green" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Importación completada: {result.inserted} movimientos de {result.periods.length} meses
            {result.deleted ? ` (${result.deleted} reemplazados)` : ""}. Dashboard, posiciones,
            rentabilidad y alertas ya reflejan la nueva información.
          </span>
        </div>
      ) : null}

      {isAdmin ? (
        <Card>
          <h3 className="mb-3 font-display text-[15px] font-600 text-fsa-navy">Histórico de cargas</h3>
          {!history ? <Spinner /> : !history.items.length ? (
            <p className="text-sm text-fsa-muted">Sin cargas registradas.</p>
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-fsa-border text-left text-xs text-fsa-muted">
                    {["Fecha", "Archivo", "Usuario", "Estado", "Meses", "Detalle"].map((h) => <th key={h} className="px-2 py-2 font-600">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {history.items.map((h) => (
                    <tr key={h.id} className="border-b border-fsa-border/50 last:border-0">
                      <td className="whitespace-nowrap px-2 py-1.5">{new Date(h.uploaded_at).toLocaleString("es-CO")}</td>
                      <td className="px-2 py-1.5">{h.filename}</td>
                      <td className="px-2 py-1.5">{h.uploaded_by ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        <Badge color={h.status === "success" ? "#1E7B34" : h.status === "conflict" ? "#E0A100" : "#C0392B"}>
                          {h.status === "success" ? "Cargado" : h.status === "conflict" ? "Rechazado (mes existente)" : "Error"}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 text-xs">{h.periods.join(", ")}</td>
                      <td className="px-2 py-1.5 text-xs text-fsa-muted">{h.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
