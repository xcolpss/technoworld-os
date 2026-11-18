/**
 * Shared classifier determining whether a POS/sale line belongs to the
 * Accessories business vs excluded media/printing/composing service categories.
 */

const EXCLUDED_CATEGORY_KEYWORDS = [
  "movie",
  "media",
  "print",
  "photocopy",
  "compos",
];

const EXCLUDED_DESC_PREFIXES = [
  "print:",
  "media copy:",
  "composing:",
];

export function isAccessoryCategoryName(categoryName: string | null | undefined): boolean {
  const cat = String(categoryName ?? "").trim().toLowerCase();
  if (!cat) return false;
  if (cat === "services" || cat === "service") return false;
  return !EXCLUDED_CATEGORY_KEYWORDS.some((kw) => cat.includes(kw));
}

export function isAccessorySaleLine(line: {
  item_kind?: unknown;
  product_id?: unknown;
  service_id?: unknown;
  category_name?: unknown;
  description?: unknown;
  item_name?: unknown;
  resolvedCategory?: unknown;
}): boolean {
  const kind = String(line.item_kind ?? "").toUpperCase();
  const cat = String(line.resolvedCategory ?? line.category_name ?? "").trim().toLowerCase();
  const desc = String(line.description ?? line.item_name ?? "").trim().toLowerCase();

  if (EXCLUDED_DESC_PREFIXES.some((prefix) => desc.startsWith(prefix))) {
    return false;
  }

  if (cat && EXCLUDED_CATEGORY_KEYWORDS.some((kw) => cat.includes(kw))) {
    return false;
  }

  if (cat === "services" || cat === "service") {
    return Boolean(line.product_id);
  }

  if (kind === "PRODUCT" || Boolean(line.product_id)) {
    return true;
  }

  // Legacy historical rows stored accessory items with item_kind='SERVICE' and category_name='Accessories'
  if (cat.includes("accessor") || cat.includes("headset") || cat.includes("audio") || cat.includes("cable") || cat.includes("hardware") || cat.includes("device") || cat.includes("usb") || cat.includes("power") || cat.includes("keyboard") || cat.includes("mouse")) {
    return true;
  }

  return false;
}

/**
 * Reusable PostgreSQL WHERE predicate on sale_items alias `si` matching only
 * line items tied via database relationship to a valid physical inventory product.
 */
export const SQL_IS_ACCESSORY_LINE = `
  (
    si.service_id IS NULL
    AND UPPER(COALESCE(si.item_kind, '')) = 'PRODUCT'
    AND si.product_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.inventory_items ii
        WHERE ii.business_id = si.business_id AND ii.id = si.product_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.products p
        JOIN public.inventory_items ii
          ON ii.business_id = p.business_id
         AND (
           (NULLIF(TRIM(ii.sku), '') IS NOT NULL AND UPPER(TRIM(p.sku)) = UPPER(TRIM(ii.sku)))
           OR UPPER(TRIM(p.sku)) = 'INV-' || UPPER(SUBSTRING(ii.id::text FROM 1 FOR 8))
           OR UPPER(TRIM(p.sku)) = 'INV-' || UPPER(SUBSTRING(ii.id::text FROM 1 FOR 12))
         )
        WHERE p.id = si.product_id AND p.business_id = si.business_id
      )
    )
  )
`;
