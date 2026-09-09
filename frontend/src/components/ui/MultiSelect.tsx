"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";

interface Opt {
  value: string;
  label: string;
}

export function MultiSelect({
  label,
  values,
  onChange,
  options,
  placeholder = "Todos",
  className,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: (Opt | string)[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const opts: Opt[] = useMemo(
    () => options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)),
    [options],
  );
  const filtered = q
    ? opts.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : opts;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function toggle(v: string) {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  }

  const summary =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? (opts.find((o) => o.value === values[0])?.label ?? values[0])
        : `${values.length} seleccionados`;

  return (
    <div ref={ref} className={cn("relative flex flex-col gap-1", className)}>
      <span className="text-xs font-500 text-fsa-muted">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-10 min-w-[168px] items-center justify-between gap-2 rounded-lg border px-3 text-sm transition-colors",
          values.length
            ? "border-fsa-blue/40 bg-fsa-blue/[0.04] text-fsa-navy"
            : "border-fsa-border bg-white text-fsa-muted",
        )}
      >
        <span className="truncate">{summary}</span>
        <span className="flex shrink-0 items-center gap-1">
          {values.length ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpiar"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  onChange([]);
                }
              }}
              className="grid h-4 w-4 place-items-center rounded-full text-fsa-muted hover:bg-fsa-surface-2 hover:text-fsa-navy"
            >
              <X className="h-3 w-3" />
            </span>
          ) : null}
          <ChevronDown className="h-4 w-4 text-fsa-muted" aria-hidden />
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            className="absolute top-full z-40 mt-1 max-h-72 w-[240px] overflow-hidden rounded-lg border border-fsa-border bg-white shadow-card"
          >
            {opts.length > 8 ? (
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar…"
                className="w-full border-b border-fsa-border px-3 py-2 text-sm outline-none"
              />
            ) : null}
            <ul className="max-h-56 overflow-auto scroll-thin py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-xs text-fsa-muted">Sin opciones</li>
              ) : (
                filtered.map((o) => {
                  const on = values.includes(o.value);
                  return (
                    <li key={o.value}>
                      <button
                        type="button"
                        onClick={() => toggle(o.value)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-fsa-surface-2"
                      >
                        <span
                          className={cn(
                            "grid h-4 w-4 shrink-0 place-items-center rounded border",
                            on
                              ? "border-fsa-blue bg-fsa-blue text-white"
                              : "border-fsa-border",
                          )}
                        >
                          {on ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className="truncate">{o.label}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
