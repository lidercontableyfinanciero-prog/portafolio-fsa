"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";
import { api } from "@/lib/api";

/** Cambio de contraseña propia — disponible para admin y lector por igual. */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/change-password", {
        current_password: current,
        new_password: next,
      });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-md">
      <h3 className="mb-1 font-display text-[15px] font-600 text-fsa-navy">
        Cambio de contraseña
      </h3>
      <p className="mb-4 text-xs text-fsa-muted">
        Se aplica de inmediato; tu próximo inicio de sesión usará la nueva contraseña.
      </p>

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-500 text-fsa-navy">Contraseña actual</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="h-11 w-full rounded-lg border border-fsa-border bg-white px-3.5 text-sm outline-none transition-shadow focus:border-fsa-blue focus:ring-4 focus:ring-fsa-blue/10"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-500 text-fsa-navy">Nueva contraseña</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="h-11 w-full rounded-lg border border-fsa-border bg-white px-3.5 text-sm outline-none transition-shadow focus:border-fsa-blue focus:ring-4 focus:ring-fsa-blue/10"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-500 text-fsa-navy">
            Confirmar nueva contraseña
          </span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-11 w-full rounded-lg border border-fsa-border bg-white px-3.5 text-sm outline-none transition-shadow focus:border-fsa-blue focus:ring-4 focus:ring-fsa-blue/10"
          />
        </label>

        {error ? <ErrorState message={error} /> : null}
        {done ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-600 text-fsa-green">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Contraseña actualizada correctamente.
          </p>
        ) : null}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Guardando…" : "Actualizar contraseña"}
        </Button>
      </form>
    </Card>
  );
}
