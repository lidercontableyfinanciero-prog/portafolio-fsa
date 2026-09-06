import { cn } from "@/lib/cn";

export function Badge({
  color = "#6B7280",
  icon,
  children,
  className,
}: {
  color?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-600",
        className,
      )}
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}12` }}
    >
      {icon}
      {children}
    </span>
  );
}
