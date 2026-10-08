"use client";

import { UploadHistory } from "@/components/datos/UploadHistory";
import { UploadPanel } from "@/components/datos/UploadPanel";
import { EmptyState } from "@/components/ui/States";
import { useAuth } from "@/lib/auth";

export default function ImportarPage() {
  const { canUpload } = useAuth();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-lg font-600 text-fsa-navy">Importar</h1>
        <p className="text-sm text-fsa-muted">
          Carga del extracto mensual en CSV o Excel. Un mes ya cargado se rechaza salvo
          que elijas reemplazarlo.
        </p>
      </div>

      {canUpload ? (
        <>
          <UploadPanel />
          <UploadHistory />
        </>
      ) : (
        <EmptyState message="No tienes permiso de carga. Solicítalo a un administrador desde Seguridad / Privacidad." />
      )}
    </div>
  );
}
