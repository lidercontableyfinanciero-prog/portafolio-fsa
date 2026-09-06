"use client";

import { UploadPanel } from "@/components/datos/UploadPanel";
import { RoleGate } from "@/components/layout/RoleGate";
import { PositionsTable } from "@/components/positions/PositionsTable";
import { EmptyState } from "@/components/ui/States";

export default function DatosPage() {
  return (
    <div className="space-y-4">
      <RoleGate
        fallback={
          <EmptyState message="La carga de datos está disponible solo para administradores." />
        }
      >
        <UploadPanel />
      </RoleGate>

      <PositionsTable />
    </div>
  );
}
