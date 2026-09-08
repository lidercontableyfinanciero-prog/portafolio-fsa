import { cn } from "@/lib/cn";

/** Logotipo oficial de la Fundación San Antonio (Referencias/). */
export function Logo({
  size = 40,
  withWordmark = false,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-fsa.png"
        alt="Fundación San Antonio"
        width={size}
        height={Math.round(size * (410 / 500))}
        style={{ width: size, height: "auto" }}
      />
      {withWordmark ? (
        <span className="leading-tight">
          <span className="block font-display text-sm font-600 text-fsa-navy">
            Portafolio de Inversiones
          </span>
          <span className="block text-[11px] text-fsa-muted">Fundación San Antonio</span>
        </span>
      ) : null}
    </span>
  );
}
