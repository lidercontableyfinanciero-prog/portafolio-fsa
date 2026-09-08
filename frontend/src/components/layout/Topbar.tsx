"use client";

import { LogOut } from "lucide-react";

import { useAuth } from "@/lib/auth";

export function Topbar() {
  const { user, logout, isAdmin } = useAuth();
  const name = user?.full_name ?? user?.email ?? "";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-20 flex h-header items-center justify-between border-b border-fsa-border bg-white/85 px-4 backdrop-blur-md lg:px-6">
      <div className="lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-fsa.png" alt="FSA" width={30} height={25} />
      </div>
      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-600 leading-tight text-fsa-navy">{name}</p>
          <p className="text-[11px] leading-tight text-fsa-muted">
            {isAdmin ? "Administrador" : "Lector"}
          </p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-fsa-surface-2 text-xs font-600 text-fsa-navy">
          {initials || "?"}
        </span>
        <button
          onClick={logout}
          className="grid h-9 w-9 place-items-center rounded-lg border border-fsa-border text-fsa-muted transition-colors hover:bg-fsa-surface hover:text-fsa-navy"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  );
}
