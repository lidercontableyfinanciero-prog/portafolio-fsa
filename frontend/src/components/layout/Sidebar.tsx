"use client";

import {
  BarChart3,
  Database,
  LayoutDashboard,
  LineChart,
  Sliders,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/rentabilidad", label: "Rentabilidad", icon: TrendingUp },
  { href: "/escenarios", label: "Escenarios", icon: BarChart3 },
  { href: "/simulador-fx", label: "Simulador FX", icon: LineChart },
  { href: "/datos", label: "Datos", icon: Database, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-fsa-border bg-fsa-navy text-white lg:flex">
      <div className="flex h-header items-center gap-2 px-5">
        <div className="grid h-8 w-8 place-items-center rounded bg-fsa-teal font-display text-sm font-700 text-fsa-navy">
          FSA
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm font-600">Portafolio</p>
          <p className="text-[11px] text-white/60">Inversiones Int.</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.filter((n) => !n.adminOnly || isAdmin).map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded px-3 py-2 text-sm font-500 transition-colors",
                active
                  ? "bg-white/12 text-white"
                  : "text-white/70 hover:bg-white/8 hover:text-white",
              )}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-[11px] text-white/50">
        Fundación San Antonio
        <br />
        Una obra de la Arquidiócesis de Bogotá
      </div>
    </aside>
  );
}
