import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { FiltersProvider } from "@/lib/filters";

export default function InternationalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGuard module="international">
      <FiltersProvider>{children}</FiltersProvider>
    </ModuleGuard>
  );
}
