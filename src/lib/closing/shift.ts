export type ClosingShiftLabel = "FULL_DAY" | "MORNING" | "EVENING" | "NIGHT";

/** Normalizes any raw shift string to a valid ClosingShiftLabel. */
export function normalizeClosingShiftLabel(raw: unknown): ClosingShiftLabel {
  const s = String(raw ?? "FULL_DAY").trim().toUpperCase();
  if (s === "MORNING" || s === "EVENING" || s === "NIGHT") return s;
  return "FULL_DAY";
}
