import { AlertCircle, Loader2 } from "lucide-react";

export function Spinner({ label = "Cargando…" }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-10 text-sm text-fsa-muted"
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded border border-fsa-red/30 bg-fsa-red/5 px-4 py-3 text-sm text-fsa-red"
      role="alert"
    >
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded border border-dashed border-fsa-border px-4 py-10 text-center text-sm text-fsa-muted">
      {message}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-fsa-surface-2 ${className}`} />;
}
