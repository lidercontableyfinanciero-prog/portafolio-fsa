"use client";

import { Check, KeyRound, Pencil, UserPlus, X } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, Spinner } from "@/components/ui/States";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Role, User } from "@/lib/types";

type Flag = "can_upload" | "can_view_international" | "can_view_national" | "is_active";

function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-fsa-green" : "bg-fsa-border"
      }`}
    >
      <span
        className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const input =
  "h-10 w-full rounded-lg border border-fsa-border px-3 text-sm outline-none focus:border-fsa-blue";

/** Administración de usuarios (solo admin; el backend lo valida): crear,
 * nombre visible, rol, estado, permiso de carga, módulos y contraseña. */
export function UserManagementPanel() {
  const { user: me } = useAuth();
  const { data, error, isLoading, mutate } = useSWR<User[]>("/users", fetcher);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState<User | null>(null);

  async function patch(u: User, body: Partial<User>) {
    setBusyId(u.id);
    setActionError(null);
    setNotice(null);
    try {
      await api.patch<User>(`/users/${u.id}`, body);
      mutate();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo actualizar el usuario.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function saveName(u: User) {
    const name = draftName.trim();
    if (!name) {
      setActionError("El nombre visible no puede quedar vacío.");
      return;
    }
    if (await patch(u, { full_name: name })) setEditingId(null);
  }

  const toggle = (u: User, f: Flag) => patch(u, { [f]: !u[f] } as Partial<User>);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[15px] font-600 text-fsa-navy">Usuarios y permisos</h3>
          <p className="mt-0.5 max-w-2xl text-xs text-fsa-muted">
            Crea usuarios, asigna rol y nombre visible, define a qué módulos puede acceder cada
            uno (perfil de acceso), habilita la carga de archivos y restablece contraseñas. Los
            permisos se validan también en el servidor.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <UserPlus className="h-4 w-4" aria-hidden />
          Nuevo usuario
        </Button>
      </div>

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
                <th className="px-3 py-2 font-600">Nombre visible</th>
                <th className="px-3 py-2 font-600">Rol</th>
                <th className="px-3 py-2 text-center font-600">Internacional</th>
                <th className="px-3 py-2 text-center font-600">Nacional</th>
                <th className="px-3 py-2 text-center font-600">Carga de archivos</th>
                <th className="px-3 py-2 text-center font-600">Activo</th>
                <th className="py-2 pl-3 text-right font-600">Contraseña</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => {
                const admin = u.role === "admin";
                const self = u.id === me?.id;
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className={`border-b border-fsa-border/50 last:border-0 ${u.is_active ? "" : "opacity-60"}`}>
                    <td className="whitespace-nowrap py-2 pr-3 font-500 text-fsa-navy">
                      {u.username}
                      {self ? <span className="ml-1.5 text-xs text-fsa-muted">(tú)</span> : null}
                    </td>
                    <td className="px-3 py-2">
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
                            className="h-8 w-44 rounded border border-fsa-border px-2 text-sm outline-none focus:border-fsa-blue"
                          />
                          <button onClick={() => saveName(u)} disabled={busy} aria-label="Guardar"
                            className="grid h-7 w-7 place-items-center rounded text-fsa-green hover:bg-fsa-green/10">
                            <Check className="h-4 w-4" aria-hidden />
                          </button>
                          <button onClick={() => setEditingId(null)} aria-label="Cancelar"
                            className="grid h-7 w-7 place-items-center rounded text-fsa-muted hover:bg-fsa-surface-2">
                            <X className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(u.id);
                            setDraftName(u.full_name ?? "");
                          }}
                          className="inline-flex items-center gap-1.5 text-fsa-navy hover:text-fsa-blue"
                        >
                          {u.full_name || <span className="text-fsa-muted">Sin nombre</span>}
                          <Pencil className="h-3 w-3 text-fsa-muted" aria-hidden />
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {self ? (
                        <Badge color="#0E2841">Administrador</Badge>
                      ) : (
                        <select
                          value={u.role}
                          disabled={busy}
                          onChange={(e) => patch(u, { role: e.target.value as Role })}
                          aria-label={`Rol de ${u.username}`}
                          className="h-8 rounded border border-fsa-border bg-white px-2 text-sm"
                        >
                          <option value="lector">Lector</option>
                          <option value="admin">Administrador</option>
                        </select>
                      )}
                    </td>
                    {(["can_view_international", "can_view_national", "can_upload"] as Flag[]).map((f) => (
                      <td key={f} className="px-3 py-2 text-center">
                        {admin ? (
                          <span className="text-xs text-fsa-muted">Siempre</span>
                        ) : (
                          <div className="flex justify-center">
                            <Switch checked={u[f]} disabled={busy} onChange={() => toggle(u, f)}
                              label={`${f} de ${u.username}`} />
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <div className="flex justify-center">
                        <Switch checked={u.is_active} disabled={busy || self}
                          onChange={() => toggle(u, "is_active")} label={`Activo ${u.username}`} />
                      </div>
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <button
                        onClick={() => setResetFor(u)}
                        className="inline-flex items-center gap-1.5 rounded border border-fsa-border px-2.5 py-1 text-xs font-600 text-fsa-navy hover:bg-fsa-surface"
                      >
                        <KeyRound className="h-3.5 w-3.5" aria-hidden />
                        Restablecer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {actionError ? <div className="mt-3"><ErrorState message={actionError} /></div> : null}
      {notice ? (
        <p className="mt-3 rounded border border-fsa-green/30 bg-fsa-green/5 px-4 py-2 text-sm text-fsa-green" role="status">
          {notice}
        </p>
      ) : null}

      <CreateUserModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(u) => {
          setCreating(false);
          setNotice(`Usuario ${u.username} creado.`);
          mutate();
        }}
      />
      <ResetPasswordModal
        user={resetFor}
        onClose={() => setResetFor(null)}
        onDone={(msg) => {
          setResetFor(null);
          setNotice(msg);
        }}
      />
    </Card>
  );
}

function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (u: User) => void;
}) {
  const empty = {
    username: "", full_name: "", password: "", role: "lector" as Role, can_upload: false,
    can_view_international: true, can_view_national: true,
  };
  const [f, setF] = useState(empty);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (f.password.length < 6) return setErr("La contraseña debe tener al menos 6 caracteres.");
    setBusy(true);
    try {
      const u = await api.post<User>("/users", f);
      setF(empty);
      onCreated(u);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "No se pudo crear el usuario.");
    } finally {
      setBusy(false);
    }
  }

  const check = (k: "can_upload" | "can_view_international" | "can_view_national", label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="h-4 w-4 accent-fsa-blue" checked={f[k]}
        disabled={f.role === "admin"} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />
      {label}
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} title="Nuevo usuario"
      subtitle="El usuario ingresará con este nombre de usuario y la contraseña inicial.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-500 text-fsa-muted">Usuario</span>
            <input required className={input} value={f.username} placeholder="LECTOR3_FSA"
              onChange={(e) => setF({ ...f, username: e.target.value.toUpperCase() })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-500 text-fsa-muted">Nombre visible</span>
            <input required className={input} value={f.full_name}
              onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-500 text-fsa-muted">Contraseña inicial</span>
            <input required type="password" minLength={6} autoComplete="new-password" className={input}
              value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-500 text-fsa-muted">Rol</span>
            <select className={input} value={f.role}
              onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              <option value="lector">Lector</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
        </div>
        <fieldset className="rounded-lg border border-fsa-border p-3">
          <legend className="px-1 text-xs font-600 text-fsa-muted">Perfil de acceso</legend>
          {f.role === "admin" ? (
            <p className="text-xs text-fsa-muted">El administrador accede a todos los módulos.</p>
          ) : (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {check("can_view_international", "Portafolio Internacional")}
              {check("can_view_national", "Portafolio Nacional")}
              {check("can_upload", "Puede cargar archivos")}
            </div>
          )}
        </fieldset>
        {err ? <ErrorState message={err} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy}>{busy ? "Creando…" : "Crear usuario"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onDone,
}: {
  user: User | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setErr(null);
    if (pwd.length < 6) return setErr("La contraseña debe tener al menos 6 caracteres.");
    if (pwd !== pwd2) return setErr("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      const r = await api.post<{ message: string }>(`/users/${user.id}/reset-password`, {
        new_password: pwd,
      });
      setPwd("");
      setPwd2("");
      onDone(r.message);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "No se pudo restablecer la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={user != null} onClose={onClose}
      title={`Restablecer contraseña · ${user?.username ?? ""}`}
      subtitle="Comunica la nueva contraseña al usuario por un canal seguro.">
      <form onSubmit={submit} className="space-y-3">
        <input type="password" required minLength={6} autoComplete="new-password" className={input}
          placeholder="Nueva contraseña" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        <input type="password" required minLength={6} autoComplete="new-password" className={input}
          placeholder="Confirmar contraseña" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
        {err ? <ErrorState message={err} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Restablecer"}</Button>
        </div>
      </form>
    </Modal>
  );
}
