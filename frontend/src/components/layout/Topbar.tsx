"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NavContent } from "@/components/layout/Sidebar";
import { useAuth } from "@/lib/auth";

export function UserBadge({ dark = false }: { dark?: boolean }) {
  const { user, logout, isAdmin } = useAuth();
  const name = user?.full_name ?? user?.username ?? "";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className={`text-sm font-600 leading-tight ${dark ? "text-white" : "text-fsa-navy"}`}>
          {name}
        </p>
        <p className={`text-[11px] leading-tight ${dark ? "text-white/60" : "text-fsa-muted"}`}>
          {isAdmin ? "Administrador" : "Lector"}
        </p>
      </div>
      <span
        className={`grid h-9 w-9 place-items-center rounded-full text-xs font-600 ${
          dark ? "bg-white/15 text-white" : "bg-fsa-surface-2 text-fsa-navy"
        }`}
      >
        {initials || "?"}
      </span>
      <button
        onClick={logout}
        className={`grid h-9 w-9 place-items-center rounded-lg border transition-colors ${
          dark
            ? "border-white/20 text-white/70 hover:bg-white/10 hover:text-white"
            : "border-fsa-border text-fsa-muted hover:bg-fsa-surface hover:text-fsa-navy"
        }`}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export function Topbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-header items-center justify-between border-b border-fsa-border bg-white/85 px-4 backdrop-blur-md lg:px-6">
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-fsa-border text-fsa-navy"
            aria-label="Abrir menú"
          >
            <Menu className="h-4 w-4" aria-hidden />
          </button>
          <Link href="/" aria-label="Inicio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-fsa.png" alt="FSA" width={30} height={25} />
          </Link>
        </div>
        <div className="hidden lg:block" />
        <UserBadge />
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-fsa-navy/50" onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-fsa-navy text-white"
            >
              <div className="flex h-header items-center justify-between px-4">
                <span className="font-display text-[13px] font-600">Portafolio FSA</span>
                <button
                  onClick={() => setOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-white/10"
                  aria-label="Cerrar menú"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <NavContent onNavigate={() => setOpen(false)} layoutId="nav-active-mobile" />
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
