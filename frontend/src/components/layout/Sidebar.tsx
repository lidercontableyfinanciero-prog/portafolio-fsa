"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Home, Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { MODULES, moduleFromPath, type NavItem } from "@/lib/modules";
import type { ModuleKey } from "@/lib/types";

/** Selector "Portafolio actual ▼": Nacional ↔ Internacional ↔ Inicio. */
export function ModuleSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { canView } = useAuth();
  const current = moduleFromPath(pathname);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const Icon = current ? MODULES[current].icon : Home;
  const item =
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-left transition-colors hover:bg-white/[0.1]"
      >
        <Icon className="h-4 w-4 shrink-0 text-fsa-teal" aria-hidden />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[10px] uppercase tracking-wider text-white/45">
            Portafolio actual
          </span>
          <span className="block truncate text-[13px] font-600 text-white">
            {current ? MODULES[current].short : "Inicio"}
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-white/60 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-x-0 z-40 mt-1.5 rounded-lg border border-fsa-border bg-white p-1 text-fsa-navy shadow-card-hover"
          >
            {(Object.keys(MODULES) as ModuleKey[]).map((k) => {
              const m = MODULES[k];
              const allowed = canView(k);
              const MIcon = m.icon;
              return allowed ? (
                <Link
                  key={k}
                  href={m.base}
                  role="menuitem"
                  onClick={onNavigate}
                  className={cn(item, "hover:bg-fsa-surface", current === k && "font-600")}
                >
                  <MIcon className="h-4 w-4 text-fsa-blue" aria-hidden />
                  <span className="flex-1">{m.label}</span>
                  {current === k ? <Check className="h-4 w-4 text-fsa-green" aria-hidden /> : null}
                </Link>
              ) : (
                <span
                  key={k}
                  className={cn(item, "cursor-not-allowed text-fsa-muted")}
                  title="Sin permiso para este módulo"
                >
                  <Lock className="h-4 w-4" aria-hidden />
                  <span className="flex-1">{m.label}</span>
                </span>
              );
            })}
            <div className="my-1 border-t border-fsa-border" />
            <Link
              href="/"
              role="menuitem"
              onClick={onNavigate}
              className={cn(item, "hover:bg-fsa-surface")}
            >
              <Home className="h-4 w-4 text-fsa-muted" aria-hidden />
              Inicio
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
  layoutId,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  layoutId: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-500 transition-colors",
        active ? "text-white" : "text-white/65 hover:text-white",
      )}
    >
      {active ? (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-lg bg-white/[0.13]"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      ) : null}
      <Icon
        className={cn(
          "relative h-[18px] w-[18px] transition-colors",
          active ? "text-fsa-teal" : "text-white/55 group-hover:text-white/80",
        )}
        aria-hidden
      />
      <span className="relative">{item.label}</span>
    </Link>
  );
}

/** Contenido de navegación (sidebar de escritorio y menú móvil). */
export function NavContent({
  onNavigate,
  layoutId = "nav-active",
}: {
  onNavigate?: () => void;
  layoutId?: string;
}) {
  const pathname = usePathname();
  const { isAdmin, canUpload } = useAuth();
  const current = moduleFromPath(pathname);
  const items = current
    ? MODULES[current].nav.filter((n) => !n.requiresUpload || canUpload || isAdmin)
    : [];
  const isActive = (href: string) =>
    href === MODULES.international.base || href === MODULES.national.base
      ? pathname === href
      : pathname.startsWith(href);

  return (
    <>
      <div className="px-3 pt-3">
        <ModuleSwitcher onNavigate={onNavigate} />
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="Navegación del módulo">
        {items.map((n) => (
          <NavLink
            key={n.href}
            item={n}
            active={isActive(n.href)}
            onNavigate={onNavigate}
            layoutId={layoutId}
          />
        ))}
        {current ? <div className="my-3 border-t border-white/10" /> : null}
        <NavLink
          item={{ href: "/", label: "Inicio", icon: Home }}
          active={pathname === "/"}
          onNavigate={onNavigate}
          layoutId={layoutId}
        />
      </nav>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const current = moduleFromPath(pathname);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-white/10 bg-fsa-navy text-white lg:flex">
      <Link href="/" className="flex h-header items-center gap-3 px-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-fsa.png" alt="Fundación San Antonio" width={34} height={28} />
        </span>
        <span className="leading-tight">
          <span className="block font-display text-[13px] font-600">Portafolio FSA</span>
          <span className="block text-[11px] text-white/55">
            {current ? `Inversiones ${current === "national" ? "Nacionales" : "Internacionales"}` : "Gestión de inversiones"}
          </span>
        </span>
      </Link>

      <NavContent />

      <div className="px-5 py-4 text-[11px] leading-relaxed text-white/40">
        Fundación San Antonio
        <br />
        Una obra de la Arquidiócesis de Bogotá
      </div>
    </aside>
  );
}
