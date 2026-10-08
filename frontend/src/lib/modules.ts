import {
  BarChart3,
  Bell,
  CalendarRange,
  Globe2,
  Landmark,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  Settings2,
  TableProperties,
  TrendingUp,
  UploadCloud,
} from "lucide-react";

import type { ModuleKey } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** solo visible para quien puede cargar archivos */
  requiresUpload?: boolean;
}

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  short: string;
  base: string;
  icon: LucideIcon;
  description: string;
  nav: NavItem[];
}

export const MODULES: Record<ModuleKey, ModuleDef> = {
  international: {
    key: "international",
    label: "Portafolio Internacional",
    short: "Internacional",
    base: "/internacional",
    icon: Globe2,
    description:
      "Inversiones en moneda extranjera (USD): bonos, acciones y fondos administrados por el custodio en el exterior.",
    nav: [
      { href: "/internacional", label: "Dashboard", icon: LayoutDashboard },
      { href: "/internacional/historico", label: "Histórico", icon: CalendarRange },
      { href: "/internacional/rentabilidad", label: "Rentabilidad", icon: TrendingUp },
      { href: "/internacional/escenarios", label: "Escenarios", icon: BarChart3 },
      { href: "/internacional/simulador-fx", label: "Simulador FX", icon: LineChart },
      { href: "/internacional/posiciones", label: "Posiciones", icon: TableProperties },
      { href: "/internacional/importar", label: "Importar", icon: UploadCloud, requiresUpload: true },
    ],
  },
  national: {
    key: "national",
    label: "Portafolio Nacional",
    short: "Nacional",
    base: "/nacional",
    icon: Landmark,
    description:
      "Inversiones en moneda legal (COP): CDT, bonos, fondos de inversión colectiva y fondos de capital privado.",
    nav: [
      { href: "/nacional", label: "Dashboard", icon: LayoutDashboard },
      { href: "/nacional/posiciones", label: "Posiciones", icon: TableProperties },
      { href: "/nacional/rentabilidad", label: "Rendimiento y benchmark", icon: TrendingUp },
      { href: "/nacional/alertas", label: "Alertas y límites", icon: Bell },
      { href: "/nacional/parametros", label: "Parámetros", icon: Settings2 },
      { href: "/nacional/importar", label: "Importar", icon: UploadCloud, requiresUpload: true },
    ],
  },
};

export function moduleFromPath(pathname: string): ModuleKey | null {
  if (pathname.startsWith("/nacional")) return "national";
  if (pathname.startsWith("/internacional")) return "international";
  return null;
}
