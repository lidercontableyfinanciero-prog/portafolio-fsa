import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { NationalFiltersProvider } from "@/lib/national";

export default function NationalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGuard module="national">
      <NationalFiltersProvider>{children}</NationalFiltersProvider>
    </ModuleGuard>
  );
}
