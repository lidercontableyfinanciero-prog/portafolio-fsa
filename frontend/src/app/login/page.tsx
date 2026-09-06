"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-fsa-navy px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-7 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded bg-fsa-teal font-display text-base font-700 text-fsa-navy">
            FSA
          </div>
          <div>
            <h1 className="font-display text-lg font-600 text-fsa-navy">
              Portafolio FSA
            </h1>
            <p className="text-xs text-fsa-muted">Inversiones Internacionales</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-600 text-fsa-navy">Correo</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-[42px] w-full rounded border border-fsa-border px-3 text-sm focus:border-fsa-blue"
              placeholder="usuario@fundacionsanantonio.org"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-600 text-fsa-navy">Contraseña</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-[42px] w-full rounded border border-fsa-border px-3 text-sm focus:border-fsa-blue"
            />
          </label>

          {error ? <ErrorState message={error} /> : null}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>

        <p className="mt-5 text-center text-[11px] text-fsa-muted">
          Fundación San Antonio · Una obra de la Arquidiócesis de Bogotá
        </p>
      </div>
    </div>
  );
}
