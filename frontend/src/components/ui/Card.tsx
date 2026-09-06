import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-fsa-border bg-white p-4 shadow-card",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="font-display text-[15px] font-600 text-fsa-navy">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-fsa-muted">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
