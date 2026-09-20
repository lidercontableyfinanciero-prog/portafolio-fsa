"use client";

import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorState, Spinner } from "@/components/ui/States";
import { api, fetcher } from "@/lib/api";
import type { User } from "@/lib/types";

/** Panel de administración de usuarios (solo admin): nombre visible por
 * usuario y permiso de carga de archivos. */
export function UserManagementPanel() {
  const { data, error, isLoading, mutate } = useSWR<User[]>("/users", fetcher);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function startEdit(u: User) {
    setEditingId(u.id);
    setDraftName(u.full_name ?? "");
    setActionError(null);
  }

  async function saveName(u: User) {
    const name = draftName.trim();
    if (!name) {
      setActionError("El nombre visible no puede quedar vacío.");
      return;
    }
    setBusyId(u.id);
    try {
      await api.patch<User>(`/users/${u.id}`, { full_name: name });
      setEditingId(null);
      mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo guardar el nombre.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleUpload(u: User) {
    setBusyId(u.id);
    setActionError(null);
    try {
      await api.patch<User>(`/users/${u.id}`, { can_upload: !u.can_upload });
      mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo actualizar el permiso.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <h3 className="mb-1 font-display text-[15px] font-600 text-fsa-navy">
        Usuarios del sistema
      </h3>
      <p className="mb-4 text-xs text-fsa-muted">
        Asigna el nombre visible de cada usuario (se muestra en el encabezado superior
        derecho) y habilita o deshabilita el permiso de carga de archivos.
      </p>

      {error ? (
        <ErrorState message={error.message} />
      ) : isLoading || !data ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fsa-border text-left text-xs font-500 text-fsa-muted">
                <th className="py-2 pr-3 font-600">Usuario</th>
                <th className="py-2 px-3 font-600">Nombre visible</th>
                <th className="py-2 px-3 font-600">Rol</th>
                <th className="py-2 pl-3 text-right font-600">Permiso de carga</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="border-b border-fsa-border/50 last:border-0">
                  <td className="py-2 pr-3 font-500 text-fsa-navy">{u.username}</td>
                  <td className="py-2 px-3">
                    {editingId === u.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveName(u);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-8 w-48 rounded border border-fsa-border px-2 text-sm outline-none focus:border-fsa-blue"
                        />
                        <button
                          onClick={() => saveName(u)}
                          disabled={busyId === u.id}
                          aria-label="Guardar"
                          className="grid h-7 w-7 place-items-center rounded text-fsa-green hover:bg-fsa-green/10"
                        >
                          <Check className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          aria-label="Cancelar"
                          className="grid h-7 w-7 place-items-center rounded text-fsa-muted hover:bg-fsa-surface-2"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(u)}
                        className="inline-flex items-center gap-1.5 text-fsa-navy hover:text-fsa-blue"
                      >
                        {u.full_name || <span className="text-fsa-muted">Sin nombre asignado</span>}
                        <Pencil className="h-3 w-3 text-fsa-muted" aria-hidden />
                      </button>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <Badge color={u.role === "admin" ? "#0E2841" : "#6B7280"}>
                      {u.role === "admin" ? "Administrador" : "Lector"}
                    </Badge>
                  </td>
                  <td className="py-2 pl-3 text-right">
                    {u.role === "admin" ? (
                      <span className="text-xs text-fsa-muted">Siempre habilitado</span>
                    ) : (
                      <button
                        role="switch"
                        aria-checked={u.can_upload}
                        disabled={busyId === u.id}
                        onClick={() => toggleUpload(u)}
                        className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                          u.can_upload ? "bg-fsa-green" : "bg-fsa-border"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            u.can_upload ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actionError ? (
        <div className="mt-3">
          <ErrorState message={actionError} />
        </div>
      ) : null}
    </Card>
  );
}
