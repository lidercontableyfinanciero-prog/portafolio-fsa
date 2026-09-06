"use client";

import { Download, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { downloadFile } from "@/lib/api";
import { cn } from "@/lib/cn";

interface Props {
  /** ruta base sin extensión, p. ej. "/export/dashboard" */
  base: string;
  /** query string ya construida (sin "?") con los filtros actuales */
  query?: string;
  /** mostrar la opción "Imprimir / PDF de la vista" */
  allowPrint?: boolean;
  label?: string;
}

export function ExportMenu({ base, query = "", allowPrint = false, label = "Exportar" }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function run(ext: "xlsx" | "pdf") {
    setBusy(ext);
    setError(null);
    try {
      await downloadFile(`${base}.${ext}${query ? `?${query}` : ""}`);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setBusy(null);
    }
  }

  const item =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-fsa-surface-2";

  return (
    <div ref={ref} className="relative print:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-[38px] items-center gap-1.5 rounded border border-fsa-border bg-white px-3 text-sm font-600 text-fsa-navy hover:bg-fsa-surface"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        {label}
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-30 mt-1 w-60 overflow-hidden rounded-lg border border-fsa-border bg-white shadow-card",
          )}
        >
          <button className={item} onClick={() => run("xlsx")} disabled={!!busy}>
            {busy === "xlsx" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-fsa-green" aria-hidden />
            )}
            Excel (.xlsx)
          </button>
          <button className={item} onClick={() => run("pdf")} disabled={!!busy}>
            {busy === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="h-4 w-4 text-fsa-red" aria-hidden />
            )}
            PDF (informe)
          </button>
          {allowPrint ? (
            <button
              className={cn(item, "border-t border-fsa-border")}
              onClick={() => {
                setOpen(false);
                setTimeout(() => window.print(), 100);
              }}
            >
              <Printer className="h-4 w-4 text-fsa-muted" aria-hidden />
              Imprimir / PDF de la vista
            </button>
          ) : null}
          {error ? (
            <p className="border-t border-fsa-border px-3 py-2 text-xs text-fsa-red">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
