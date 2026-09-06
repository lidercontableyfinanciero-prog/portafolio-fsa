import { cn } from "@/lib/cn";

type Variant = "primary" | "cta" | "outline" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-fsa-blue text-white hover:bg-fsa-blue-600",
  cta: "bg-fsa-orange text-white hover:bg-fsa-orange-600",
  outline: "border border-fsa-border bg-white text-fsa-navy hover:bg-fsa-surface",
  ghost: "text-fsa-navy hover:bg-fsa-surface",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-[40px] items-center justify-center gap-2 rounded px-4 text-sm font-600",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
