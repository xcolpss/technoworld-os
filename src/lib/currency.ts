/**
 * All monetary amounts in TechnoWorld OS are stored and calculated
 * as integer paisa (1 PKR = 100 paisa) to prevent floating-point drift.
 */

export function rupeesToPaisa(rupees: number): number {
  if (!Number.isFinite(rupees)) {
    throw new Error("Invalid rupee amount provided.");
  }
  return Math.round(rupees * 100);
}

export function paisaToRupees(paisa: number): number {
  if (!Number.isInteger(paisa)) {
    throw new Error("Paisa amount must be an integer.");
  }
  return paisa / 100;
}

export function formatPkrFromPaisa(paisa: number): string {
  if (!Number.isInteger(paisa)) {
    throw new Error("Paisa amount must be an integer.");
  }
  const rupees = paisa / 100;
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}
