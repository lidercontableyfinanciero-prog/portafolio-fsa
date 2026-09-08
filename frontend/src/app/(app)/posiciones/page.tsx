"use client";

import { PositionsExplorer } from "@/components/positions/PositionsExplorer";

export default function PosicionesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-lg font-600 text-fsa-navy">
          Posiciones del período
        </h1>
        <p className="text-sm text-fsa-muted">
          Filtra por tipo, sector y calificación (Moody&apos;s y S&amp;P de forma
          independiente), ordena cualquier columna y exporta el resultado. Haz clic en
          una posición para ver su evolución histórica.
        </p>
      </div>
      <PositionsExplorer />
    </div>
  );
}
