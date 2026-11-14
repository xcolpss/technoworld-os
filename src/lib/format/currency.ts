export function pkrToPaisa(input: string | number): number {
  const cleaned =
    typeof input === "number"
      ? String(input)
      : input.replace(/[^0-9.-]/g, "").trim();

  if (!cleaned) return 0;

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;

  return Math.round(parsed * 100);
}

export function paisaToPkr(paisa: number): number {
  if (!Number.isFinite(paisa)) return 0;
  return paisa / 100;
}

export function formatPkr(paisa: number, showDecimals = false): string {
  const safePaisa = Number.isFinite(paisa) ? paisa : 0;
  const amount = safePaisa / 100;
  const hasFractionalPaisa = safePaisa % 100 !== 0;

  const formatted = new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: showDecimals || hasFractionalPaisa ? 2 : 0,
    maximumFractionDigits: showDecimals || hasFractionalPaisa ? 2 : 0,
  }).format(amount);

  return `Rs. ${formatted}`;
}