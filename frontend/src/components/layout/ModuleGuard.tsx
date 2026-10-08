"use client";

import { Lock } from "lucide-react";
import Link from "next/link";

import { useAuth } from "@/lib/auth";
import { MODULES } from "@/lib/modules";
import type { ModuleKey } from "@/lib/types";

/** Bloquea el acceso a un módulo sin permiso (la API también responde 403). */
export function ModuleGuard({
  module,
  children,
}: {
  module: ModuleKey;
  children: React.ReactNode;
}) {
  const { canView } = useAuth();
  if (canView(module)) return <>{children}</>;
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-fsa-border bg-white p-8 text-center shadow-card">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-fsa-surface-2">
        <Lock className="h-5 w-5 text-fsa-muted" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-lg font-600 text-fsa-navy">Sin acceso</h1>
      <p className="mt-2 text-sm text-fsa-muted">
        Tu perfil no tiene permiso para consultar el {MODULES[module].label}. Solicítalo a un
        administrador.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex min-h-[40px] items-center rounded bg-fsa-blue px-4 text-sm font-600 text-white hover:bg-fsa-blue-600"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
