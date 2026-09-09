"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  CalendarRange,
  LayoutDashboard,
  LineChart,
  TableProperties,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/historico", label: "Histórico", icon: CalendarRange },
  { href: "/rentabilidad", label: "Rentabilidad", icon: TrendingUp },
  { href: "/escenarios", label: "Escenarios", icon: BarChart3 },
  { href: "/simulador-fx", label: "Simulador FX", icon: LineChart },
  { href: "/posiciones", label: "Posiciones", icon: TableProperties },
  { href: "/importar", label: "Importar", icon: UploadCloud, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-white/10 bg-fsa-navy text-white lg:flex">
      <div className="flex h-header items-center gap-3 px-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-fsa.png" alt="Fundación San Antonio" width={34} height={28} />
        </span>
        <span className="leading-tight">
          <span className="block font-display text-[13px] font-600">Portafolio FSA</span>
          <span className="block text-[11px] text-white/55">Inversiones Internacionales</span>
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV.filter((n) => !n.adminOnly || isAdmin).map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-500 transition-colors",
                active ? "text-white" : "text-white/65 hover:text-white",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="nav-active"
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
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-[11px] leading-relaxed text-white/40">
        Fundación San Antonio
        <br />
        Una obra de la Arquidiócesis de Bogotá
      </div>
    </aside>
  );
}
