const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
const pct2 = new Intl.NumberFormat("es-CO", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const fmtUSD = (v: number | null | undefined, decimals = false) =>
  v == null || Number.isNaN(v) ? "—" : (decimals ? usd2 : usd).format(v);

export const fmtCOP = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? "—" : cop.format(v);

export const fmtNum = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? "—" : num.format(v);

export const fmtPct = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? "—" : pct2.format(v);

/** Compacto para ejes: 1.2M, 850k */
export const fmtCompact = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${v}`;
};

export const monthShort = (m: string) => m.slice(0, 3);

/** Delta con signo explícito: +$1,234 / -$1,234 */
export const fmtDeltaUSD = (v: number | null | undefined) => {
  if (v == null || Number.isNaN(v)) return "—";
  const s = fmtUSD(Math.abs(v));
  return v >= 0 ? `+${s}` : `-${s}`;
};

export const fmtDeltaPct = (v: number | null | undefined) => {
  if (v == null || Number.isNaN(v)) return "—";
  return (v >= 0 ? "+" : "") + pct2.format(v);
};

const years2 = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Años con 2 decimales: "0,45 años". Negativo => ya venció. */
export const fmtYears = (v: number | null | undefined, unit = true) => {
  if (v == null || Number.isNaN(v)) return "—";
  if (v < 0) return "Vencido";
  return unit ? `${years2.format(v)} años` : years2.format(v);
};

/** Fecha ISO (YYYY-MM-DD) -> dd/mm/aaaa, sin desfase de zona horaria. */
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};
