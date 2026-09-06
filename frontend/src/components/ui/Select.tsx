import { cn } from "@/lib/cn";

interface Opt {
  value: string;
  label: string;
}

export function Select({
  label,
  value,
  onChange,
  options,
  allowEmpty,
  emptyLabel = "Todos",
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (Opt | string)[];
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  const opts: Opt[] = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-600 uppercase tracking-wide text-fsa-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[40px] rounded border border-fsa-border bg-white px-2.5 text-sm text-fsa-navy focus:border-fsa-blue"
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
