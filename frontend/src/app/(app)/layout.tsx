import { SlicerBar } from "@/components/filters/SlicerBar";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { FiltersProvider } from "@/lib/filters";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <FiltersProvider>
        <div className="min-h-screen bg-fsa-surface">
          <Sidebar />
          <div className="lg:pl-sidebar">
            <Topbar />
            <SlicerBar />
            <main id="contenido" className="px-4 py-5 lg:px-6">
              <div className="mx-auto max-w-[1400px]">{children}</div>
            </main>
          </div>
        </div>
      </FiltersProvider>
    </RequireAuth>
  );
}
