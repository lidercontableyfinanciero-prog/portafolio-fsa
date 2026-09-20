"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LoginShowcase } from "@/components/login/LoginShowcase";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [username, setUsername] = useState("");
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
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  }

  const rise = reduce
    ? {}
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <LoginShowcase />

      {/* Formulario */}
      <div className="grid place-items-center bg-fsa-bg px-6 py-12">
        <motion.div
          {...rise}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-fsa-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-fsa.png" alt="FSA" width={30} height={25} />
            </span>
            <div>
              <h1 className="font-display text-lg font-600 text-fsa-navy">Portafolio FSA</h1>
              <p className="text-xs text-fsa-muted">Inversiones Internacionales</p>
            </div>
          </div>

          <h1 className="font-display text-xl font-600 text-fsa-navy">Ingresar</h1>
          <p className="mt-1 text-sm text-fsa-muted">
            Accede con tu cuenta institucional.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-500 text-fsa-navy">Usuario</span>
              <input
                type="text"
                required
                autoComplete="username"
                autoCapitalize="characters"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 w-full rounded-lg border border-fsa-border bg-white px-3.5 text-sm outline-none transition-shadow focus:border-fsa-blue focus:ring-4 focus:ring-fsa-blue/10"
                placeholder="ADMIN_FSA"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-500 text-fsa-navy">Contraseña</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-lg border border-fsa-border bg-white px-3.5 text-sm outline-none transition-shadow focus:border-fsa-blue focus:ring-4 focus:ring-fsa-blue/10"
              />
            </label>

            {error ? <ErrorState message={error} /> : null}

            <Button type="submit" disabled={busy} className="h-11 w-full">
              {busy ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
