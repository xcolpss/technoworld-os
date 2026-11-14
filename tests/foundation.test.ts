import { describe, expect, it } from "vitest";
import {
  formatPkrFromPaisa,
  paisaToRupees,
  rupeesToPaisa,
} from "../src/lib/currency";
import { APP_NAVIGATION } from "../src/config/navigation";

describe("Phase 1 Foundation — Currency & Role Navigation", () => {
  it("converts PKR rupees to exact integer paisa without floating-point drift", () => {
    expect(rupeesToPaisa(19.99)).toBe(1999);
    expect(rupeesToPaisa(0)).toBe(0);
    expect(rupeesToPaisa(1500.5)).toBe(150050);
    expect(paisaToRupees(1999)).toBe(19.99);
  });

  it("rejects non-integer paisa values", () => {
    expect(() => paisaToRupees(10.5)).toThrow();
    expect(() => formatPkrFromPaisa(10.5)).toThrow();
  });

  it("formats integer paisa cleanly in PKR", () => {
    const formatted = formatPkrFromPaisa(250000);
    expect(formatted).toContain("2,500");
  });

  it("restricts Finance, Audit, and Settings routes from EMPLOYEE role", () => {
    const employeeRoutes = APP_NAVIGATION.filter((item) =>
      item.allowedRoles.includes("EMPLOYEE")
    ).map((item) => item.href);

    expect(employeeRoutes).toContain("/pos");
    expect(employeeRoutes).toContain("/shifts");
    expect(employeeRoutes).not.toContain("/finance");
    expect(employeeRoutes).not.toContain("/audit");
    expect(employeeRoutes).not.toContain("/settings");
  });
});
