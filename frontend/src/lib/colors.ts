export const FSA = {
  navy: "#0E2841",
  blue: "#156082",
  teal: "#3FB5AA",
  orange: "#E97132",
  magenta: "#C0287E",
  green: "#1E7B34",
  red: "#C0392B",
  amber: "#E0A100",
  muted: "#6B7280",
  border: "#E2E5EA",
  surface: "#F6F7F9",
  cost: "#8DA2B5",
} as const;

/** Serie categórica (dona / barras) — 8 tonos con contraste AA sobre blanco. */
export const CATEGORICAL = [
  FSA.blue,
  FSA.orange,
  FSA.teal,
  FSA.magenta,
  FSA.green,
  FSA.amber,
  "#0F9ED5",
  FSA.cost,
];

export const gainLoss = (v: number) => (v >= 0 ? FSA.green : FSA.red);

export const gradeColor = (grade: string) =>
  grade.toLowerCase().includes("inversión") || grade.toLowerCase().includes("inversion")
    ? FSA.green
    : FSA.amber;

export const stopLossColor = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes("ejecutar")) return FSA.red;
  if (l.includes("evaluar")) return FSA.orange;
  if (l.includes("monitoreo")) return FSA.amber;
  return FSA.green;
};
