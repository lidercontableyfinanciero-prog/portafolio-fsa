"use client";

import { UploadCloud } from "lucide-react";
import Link from "next/link";

import { ErrorState, Skeleton } from "@/components/ui/States";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Estados de carga / sin datos / error comunes a las pantallas nacionales. */
export function NationalState({ error, loading }: { error?: unknown; loading?: boolean }) {
  const { canUpload } = useAuth();
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="rounded-2xl border border-dashed border-fsa-border bg-white px-6 py-12 text-center">
        <h2 className="font-display text-base font-600 text-fsa-navy">
          Aún no hay información del Portafolio Nacional
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-fsa-muted">
          Importa la «Base de Datos Portafolio Inversiones Nacionales» para construir el
          dashboard, las posiciones, la rentabilidad y las alertas.
        </p>
        {canUpload ? (
          <Link
            href="/nacional/importar"
            className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded bg-fsa-blue px-4 text-sm font-600 text-white hover:bg-fsa-blue-600"
          >
            <UploadCloud className="h-4 w-4" aria-hidden />
            Importar información
          </Link>
        ) : (
          <p className="mt-4 text-xs text-fsa-muted">Solicita la carga a un administrador.</p>
        )}
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        message={`No se pudo cargar el portafolio nacional: ${
          error instanceof Error ? error.message : String(error)
        }`}
      />
    );
  }
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }
  return null;
}
