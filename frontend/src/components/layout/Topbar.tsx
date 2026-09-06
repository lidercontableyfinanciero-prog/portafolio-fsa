"use client";

import { LogOut } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { useFilters } from "@/lib/filters";

export function Topbar() {
  const { user, logout, isAdmin } = useAuth();
  const { year, month } = useFilters();

  return (
    <header className="sticky top-0 z-20 flex h-header items-center justify-between border-b border-fsa-border bg-white/90 px-4 backdrop-blur lg:px-6">
      <div>
        <h1 className="font-display text-base font-600 text-fsa-navy">
          Portafolio de Inversiones Internacionales
        </h1>
        <p className="text-xs text-fsa-muted">
          {month && year ? `Período: ${month} ${year}` : "Cargando período…"} · Cifras
          en USD
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-600 text-fsa-navy">{user?.full_name ?? user?.email}</p>
          <p className="text-[11px] uppercase tracking-wide text-fsa-muted">
            {isAdmin ? "Administrador" : "Lector"}
          </p>
        </div>
        <button
          onClick={logout}
          className="grid h-9 w-9 place-items-center rounded border border-fsa-border text-fsa-muted hover:bg-fsa-surface hover:text-fsa-navy"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  );
}
