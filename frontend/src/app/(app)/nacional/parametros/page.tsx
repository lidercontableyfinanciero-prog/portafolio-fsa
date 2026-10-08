"use client";

import { Check, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorState, Spinner } from "@/components/ui/States";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtPct } from "@/lib/format";

interface CatalogAsset {
  name: string;
  asset_type: string;
  group: string;
  issuer: string;
  entity: string | null;
  low_liquidity: boolean;
  benchmark: string;
  needs_review: boolean;
}
interface Catalog {
  assets: CatalogAsset[];
  options: { types: string[]; groups: string[]; benchmarks: string[] };
}
interface IpcRow { year: number; month: number; label: string; ipc_ytd: number | null; ipc_12m: number | null; source: string | null }
interface Param { key: string; value_numeric: number | null; value_text: string | null; description: string | null }

const cell = "h-8 rounded border border-fsa-border bg-white px-2 text-sm outline-none focus:border-fsa-blue";
const PCT_PARAMS = new Set(["nal_spread_benchmark", "nal_limite_emisor", "nal_limite_tes",
  "nal_limite_baja_liquidez", "nal_alerta_amarilla", "nal_stop_loss", "nal_margen_sobresaliente"]);

/** Datos de referencia que la base de movimientos NO trae: atributos de cada
 * inversión, IPC del DANE y umbrales del Reglamento. Lectura para todos;
 * edición solo admin (también validado en la API). */
export default function NationalParamsPage() {
  const { isAdmin } = useAuth();
  const { mutate } = useSWRConfig();
  const refreshReport = () => mutate((k) => typeof k === "string" && k.startsWith("/national/"));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-lg font-600 text-fsa-navy">Parámetros · Portafolio Nacional</h1>
        <p className="text-sm text-fsa-muted">
          Atributos de cada inversión, IPC del DANE (benchmark del Anexo 6) y umbrales del
          Reglamento. {isAdmin ? "Los cambios recalculan de inmediato todos los indicadores." : "Solo el administrador puede editarlos."}
        </p>
      </div>
      <CatalogCard isAdmin={isAdmin} onChange={refreshReport} />
      <div className="grid gap-4 xl:grid-cols-2">
        <IpcCard isAdmin={isAdmin} onChange={refreshReport} />
        <ParamsCard isAdmin={isAdmin} onChange={refreshReport} />
      </div>
    </div>
  );
}

function CatalogCard({ isAdmin, onChange }: { isAdmin: boolean; onChange: () => void }) {
  const { data, error, mutate } = useSWR<Catalog>("/national/catalog", fetcher);
  const [edit, setEdit] = useState<CatalogAsset | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!edit) return;
    setErr(null);
    try {
      await api.put(`/national/catalog/${encodeURIComponent(edit.name)}`, edit);
      setEdit(null);
      mutate();
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }

  return (
    <Card>
      <h3 className="font-display text-[15px] font-600 text-fsa-navy">Catálogo de inversiones</h3>
      <p className="mb-3 text-xs text-fsa-muted">
        Emisor (para el límite del Anexo 5), baja liquidez (literal b) y benchmark aplicable
        (Anexo 6). Las inversiones nuevas importadas se marcan «por revisar».
      </p>
      {error ? <ErrorState message={error.message} /> : !data ? <Spinner /> : (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fsa-border text-left text-xs text-fsa-muted">
                {["Inversión", "Tipo", "Grupo", "Emisor", "Entidad", "Baja liquidez", "Benchmark", ""].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-2 font-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.assets.map((a) => {
                const e = edit?.name === a.name ? edit : null;
                return (
                  <tr key={a.name} className="border-b border-fsa-border/50 last:border-0">
                    <td className="min-w-[200px] px-2 py-1.5 font-500 text-fsa-navy">
                      {a.name}
                      {a.needs_review ? <Badge color="#E0A100" className="ml-2">Por revisar</Badge> : null}
                    </td>
                    {e ? (
                      <>
                        <td className="px-2 py-1.5">
                          <select className={cell} value={e.asset_type} onChange={(x) => setEdit({ ...e, asset_type: x.target.value })}>
                            {data.options.types.map((t) => <option key={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select className={cell} value={e.group} onChange={(x) => setEdit({ ...e, group: x.target.value })}>
                            {data.options.groups.map((t) => <option key={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5"><input className={cell} value={e.issuer} onChange={(x) => setEdit({ ...e, issuer: x.target.value })} /></td>
                        <td className="px-2 py-1.5"><input className={cell} value={e.entity ?? ""} onChange={(x) => setEdit({ ...e, entity: x.target.value })} /></td>
                        <td className="px-2 py-1.5 text-center">
                          <input type="checkbox" className="h-4 w-4 accent-fsa-blue" checked={e.low_liquidity}
                            onChange={(x) => setEdit({ ...e, low_liquidity: x.target.checked })} aria-label="Baja liquidez" />
                        </td>
                        <td className="px-2 py-1.5">
                          <select className={cell} value={e.benchmark} onChange={(x) => setEdit({ ...e, benchmark: x.target.value })}>
                            {data.options.benchmarks.map((t) => <option key={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right">
                          <button onClick={save} aria-label="Guardar" className="mr-1 inline-grid h-7 w-7 place-items-center rounded text-fsa-green hover:bg-fsa-green/10"><Check className="h-4 w-4" aria-hidden /></button>
                          <button onClick={() => setEdit(null)} aria-label="Cancelar" className="inline-grid h-7 w-7 place-items-center rounded text-fsa-muted hover:bg-fsa-surface-2"><X className="h-4 w-4" aria-hidden /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-1.5">{a.asset_type}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-fsa-muted">{a.group}</td>
                        <td className="px-2 py-1.5">{a.issuer}</td>
                        <td className="px-2 py-1.5 text-fsa-muted">{a.entity ?? "—"}</td>
                        <td className="px-2 py-1.5 text-center">{a.low_liquidity ? "Sí" : "No"}</td>
                        <td className="px-2 py-1.5">{a.benchmark}</td>
                        <td className="px-2 py-1.5 text-right">
                          {isAdmin ? (
                            <button onClick={() => setEdit({ ...a })} aria-label={`Editar ${a.name}`} className="inline-grid h-7 w-7 place-items-center rounded text-fsa-muted hover:bg-fsa-surface-2 hover:text-fsa-navy">
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          ) : null}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {err ? <div className="mt-3"><ErrorState message={err} /></div> : null}
    </Card>
  );
}

function IpcCard({ isAdmin, onChange }: { isAdmin: boolean; onChange: () => void }) {
  const { data, error, mutate } = useSWR<IpcRow[]>("/national/ipc", fetcher);
  const [draft, setDraft] = useState<{ year: string; month: string; ytd: string; m12: string; source: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toNum = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")) / 100);

  async function save() {
    if (!draft) return;
    setErr(null);
    const ytd = toNum(draft.ytd), m12 = toNum(draft.m12);
    if ((ytd != null && Number.isNaN(ytd)) || (m12 != null && Number.isNaN(m12))) {
      setErr("Los valores del IPC deben ser numéricos (en %).");
      return;
    }
    try {
      await api.put("/national/ipc", {
        year: Number(draft.year), month: Number(draft.month), ipc_ytd: ytd, ipc_12m: m12,
        source: draft.source || null,
      });
      setDraft(null);
      mutate();
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }
  const pct = (v: number | null) => (v == null ? "" : String(+(v * 100).toFixed(4)));

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-[15px] font-600 text-fsa-navy">IPC Colombia (DANE)</h3>
          <p className="text-xs text-fsa-muted">Insumo del benchmark. Sin IPC del mes de corte el benchmark queda «n/d».</p>
        </div>
        {isAdmin ? (
          <button onClick={() => setDraft({ year: String(new Date().getFullYear()), month: "1", ytd: "", m12: "", source: "DANE" })}
            className="inline-flex items-center gap-1 rounded border border-fsa-border px-2.5 py-1 text-xs font-600 text-fsa-navy hover:bg-fsa-surface">
            <Plus className="h-3.5 w-3.5" aria-hidden /> Mes
          </button>
        ) : null}
      </div>
      {error ? <ErrorState message={error.message} /> : !data ? <Spinner /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fsa-border text-left text-xs text-fsa-muted">
              <th className="px-2 py-2 font-600">Mes</th>
              <th className="px-2 py-2 text-right font-600">IPC año corrido</th>
              <th className="px-2 py-2 text-right font-600">IPC 12 meses</th>
              <th className="px-2 py-2 font-600">Fuente</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={`${r.year}-${r.month}`} className="border-b border-fsa-border/50 last:border-0">
                <td className="px-2 py-1.5">{r.label}</td>
                <td className="tnum px-2 py-1.5 text-right">{r.ipc_ytd == null ? "—" : fmtPct(r.ipc_ytd)}</td>
                <td className="tnum px-2 py-1.5 text-right">{r.ipc_12m == null ? "—" : fmtPct(r.ipc_12m)}</td>
                <td className="px-2 py-1.5 text-xs text-fsa-muted">{r.source}</td>
                <td className="px-2 py-1.5 text-right">
                  {isAdmin ? (
                    <button aria-label={`Editar IPC ${r.label}`} onClick={() => setDraft({ year: String(r.year), month: String(r.month), ytd: pct(r.ipc_ytd), m12: pct(r.ipc_12m), source: r.source ?? "" })}
                      className="inline-grid h-7 w-7 place-items-center rounded text-fsa-muted hover:bg-fsa-surface-2 hover:text-fsa-navy">
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {draft ? (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-fsa-border bg-fsa-surface p-3 sm:grid-cols-6">
          <input className={cell} aria-label="Año" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} />
          <select className={cell} aria-label="Mes" value={draft.month} onChange={(e) => setDraft({ ...draft, month: e.target.value })}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
          <input className={cell} placeholder="Año corrido %" value={draft.ytd} onChange={(e) => setDraft({ ...draft, ytd: e.target.value })} />
          <input className={cell} placeholder="12 meses %" value={draft.m12} onChange={(e) => setDraft({ ...draft, m12: e.target.value })} />
          <input className={cell} placeholder="Fuente" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
          <div className="flex gap-1">
            <button onClick={save} className="h-8 flex-1 rounded bg-fsa-blue px-2 text-xs font-600 text-white">Guardar</button>
            <button onClick={() => setDraft(null)} className="h-8 rounded border border-fsa-border px-2 text-xs">✕</button>
          </div>
        </div>
      ) : null}
      {err ? <div className="mt-3"><ErrorState message={err} /></div> : null}
    </Card>
  );
}

function ParamsCard({ isAdmin, onChange }: { isAdmin: boolean; onChange: () => void }) {
  const { data, error, mutate } = useSWR<Param[]>("/national/parameters", fetcher);
  const [edit, setEdit] = useState<{ key: string; value: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const show = (p: Param) =>
    p.value_text != null ? p.value_text
      : p.value_numeric == null ? "—"
        : PCT_PARAMS.has(p.key) ? fmtPct(p.value_numeric) : String(p.value_numeric);

  async function save(p: Param) {
    if (!edit) return;
    setErr(null);
    const body = p.value_text != null
      ? { value_text: edit.value }
      : { value_numeric: PCT_PARAMS.has(p.key) ? Number(edit.value.replace(",", ".")) / 100 : Number(edit.value.replace(",", ".")) };
    if ("value_numeric" in body && Number.isNaN(body.value_numeric)) {
      setErr("Valor numérico inválido.");
      return;
    }
    try {
      await api.put(`/national/parameters/${p.key}`, body);
      setEdit(null);
      mutate();
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }

  return (
    <Card>
      <h3 className="font-display text-[15px] font-600 text-fsa-navy">Límites, umbrales y supuestos</h3>
      <p className="mb-3 text-xs text-fsa-muted">Valores del Reglamento y criterios de gestión del informe (los % se editan en porcentaje).</p>
      {error ? <ErrorState message={error.message} /> : !data ? <Spinner /> : (
        <ul className="divide-y divide-fsa-border/60">
          {data.map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-fsa-navy">{p.description}</span>
              {edit?.key === p.key ? (
                <span className="flex shrink-0 items-center gap-1">
                  <input autoFocus className={`${cell} w-28`} value={edit.value}
                    onChange={(e) => setEdit({ key: p.key, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") save(p); if (e.key === "Escape") setEdit(null); }} />
                  <button onClick={() => save(p)} aria-label="Guardar" className="grid h-7 w-7 place-items-center rounded text-fsa-green hover:bg-fsa-green/10"><Check className="h-4 w-4" aria-hidden /></button>
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1">
                  <span className="tnum font-600 text-fsa-navy">{show(p)}</span>
                  {isAdmin ? (
                    <button aria-label={`Editar ${p.description}`}
                      onClick={() => setEdit({ key: p.key, value: p.value_text ?? (p.value_numeric == null ? "" : String(PCT_PARAMS.has(p.key) ? +(p.value_numeric * 100).toFixed(4) : p.value_numeric)) })}
                      className="grid h-7 w-7 place-items-center rounded text-fsa-muted hover:bg-fsa-surface-2 hover:text-fsa-navy">
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {err ? <div className="mt-3"><ErrorState message={err} /></div> : null}
    </Card>
  );
}
