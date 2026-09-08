"use client";

import { UploadHistory } from "@/components/datos/UploadHistory";
import { UploadPanel } from "@/components/datos/UploadPanel";
import { RoleGate } from "@/components/layout/RoleGate";
import { EmptyState } from "@/components/ui/States";

export default function ImportarPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-lg font-600 text-fsa-navy">Importar</h1>
        <p className="text-sm text-fsa-muted">
          Carga del extracto mensual en CSV o Excel. Un mes ya cargado se rechaza salvo
          que elijas reemplazarlo.
        </p>
      </div>

      <RoleGate
        fallback={
          <EmptyState message="La importación de datos está disponible solo para administradores." />
        }
      >
        <UploadPanel />
        <UploadHistory />
      </RoleGate>
    </div>
  );
}
