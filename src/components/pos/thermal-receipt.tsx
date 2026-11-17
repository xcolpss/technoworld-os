"use client";

import * as React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPkr } from "@/lib/format/currency";

export type ThermalPaperWidth = "80mm" | "58mm";

export interface ThermalReceiptLine {
  name: string;
  quantity: number;
  unitPricePaisa: number;
  lineTotalPaisa: number;
}

export interface ThermalReceiptData {
  invoiceRef: string;
  dateLabel: string;
  customerName: string;
  items: ThermalReceiptLine[];
  subtotalPaisa: number;
  discountPaisa: number;
  grandTotalPaisa: number;
  paymentMethod: string;
}

export const PRINTER_WIDTH_STORAGE_KEY = "tw_printer_width";
const PRINT_IFRAME_ID = "tw-thermal-print-iframe";

export function formatPaymentMethodLabel(method: string): string {
  const upper = String(method || "CASH").trim().toUpperCase();
  if (upper === "BANK" || upper === "BANK_TRANSFER") return "BANK TRANSFER";
  return upper.replace(/_/g, " ");
}

function escapeHtml(raw: string): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Fallback mathematical height estimator matched to 80mm / 58mm roll rendering.
 */
export function estimateReceiptHeightMm(
  items: ThermalReceiptLine[],
  hasDiscount: boolean,
  paperWidth: ThermalPaperWidth = "80mm"
): number {
  const is58 = paperWidth === "58mm";
  const headerAndMetaMm = is58 ? 31 : 29;
  const charsPerLine = is58 ? 22 : 34;

  let itemsMm = 0;
  for (const item of items) {
    const nameLines = Math.max(1, Math.ceil(item.name.length / charsPerLine));
    itemsMm += 4.3 + nameLines * 3.8;
  }

  const totalsAndFooterMm = (hasDiscount ? 32 : 28) + 3;
  // Ensure height > paperWidth so Windows thermal drivers (Xprinter XP-80) never auto-rotate 1-item slips into landscape
  const minPortraitMm = is58 ? 59 : 81;
  return Math.max(minPortraitMm, Math.ceil(headerAndMetaMm + itemsMm + totalsAndFooterMm));
}

export function buildThermalReceiptHtmlDocument(
  data: ThermalReceiptData,
  paperWidth: ThermalPaperWidth,
  pageHeightMm: number
): string {
  const is58 = paperWidth === "58mm";
  const paperMm = is58 ? 58 : 80;
  // XP-80 thermal heads have ~72mm printable dot width on 80mm paper (~48mm on 58mm)
  const contentMm = is58 ? 48 : 72;
  const paymentLabel = formatPaymentMethodLabel(data.paymentMethod);

  const itemsHtml = data.items
    .map(
      (item) => `
      <div class="item-row">
        <div class="item-top">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="item-total">${escapeHtml(formatPkr(item.lineTotalPaisa))}</span>
        </div>
        <div class="item-sub">Qty: ${item.quantity} &times; ${escapeHtml(
        formatPkr(item.unitPricePaisa)
      )}</div>
      </div>`
    )
    .join("");

  const discountHtml =
    data.discountPaisa > 0
      ? `<div class="total-row">
          <span>Discount</span>
          <span class="mono">-${escapeHtml(formatPkr(data.discountPaisa))}</span>
        </div>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(data.invoiceRef)}</title>
  <style id="tw-receipt-page-style">
    @page {
      size: ${paperMm}mm ${pageHeightMm}mm;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html,
    body {
      width: ${paperMm}mm;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
    }
    .receipt {
      width: ${contentMm}mm;
      margin: 0 auto;
      padding: 1.5mm 0 1.5mm 0;
      background: #ffffff;
      color: #000000;
    }
    .header {
      text-align: center;
      border-bottom: 1.5px solid #000000;
      padding-bottom: 1.5mm;
    }
    .logo-wrap {
      display: flex;
      justify-content: center;
      margin-bottom: 0.8mm;
    }
    .tagline {
      font-size: ${is58 ? "8.5px" : "9.5px"};
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin: 0;
      line-height: 1.25;
    }
    .subtagline {
      font-size: ${is58 ? "8px" : "8.5px"};
      font-weight: 600;
      margin: 0.4mm 0 0 0;
      line-height: 1.25;
    }
    .meta {
      padding: 1.2mm 0;
      border-bottom: 1.5px solid #000000;
      font-size: ${is58 ? "9px" : "10px"};
      line-height: 1.3;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 4px;
      margin-bottom: 0.4mm;
    }
    .meta-row:last-child {
      margin-bottom: 0;
    }
    .meta-label {
      font-weight: 700;
      white-space: nowrap;
    }
    .meta-val {
      font-weight: 800;
      text-align: right;
      word-break: break-word;
    }
    .mono {
      font-family: "Consolas", "Courier New", monospace;
    }
    .cols-head {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #000000;
      padding: 1mm 0;
      font-size: ${is58 ? "9px" : "10px"};
      font-weight: 900;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .items {
      border-bottom: 1.5px solid #000000;
    }
    .item-row {
      padding: 1mm 0;
      border-bottom: 1px dashed #000000;
      line-height: 1.2;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .item-row:last-child {
      border-bottom: none;
    }
    .item-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 4px;
      font-size: ${is58 ? "10px" : "11px"};
    }
    .item-name {
      font-weight: 800;
      flex: 1;
      word-break: break-word;
    }
    .item-total {
      font-family: "Consolas", "Courier New", monospace;
      font-weight: 900;
      white-space: nowrap;
    }
    .item-sub {
      font-family: "Consolas", "Courier New", monospace;
      font-size: ${is58 ? "9px" : "10px"};
      font-weight: 600;
      margin-top: 0.3mm;
    }
    .totals {
      padding: 1.2mm 0;
      font-size: ${is58 ? "10px" : "11px"};
      line-height: 1.3;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      margin-bottom: 0.5mm;
    }
    .grand-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1.5px solid #000000;
      border-bottom: 1.5px solid #000000;
      padding: 1mm 0;
      margin: 0.8mm 0;
      font-size: ${is58 ? "11.5px" : "13px"};
      font-weight: 900;
    }
    .grand-amount {
      font-family: "Consolas", "Courier New", monospace;
      font-size: ${is58 ? "13px" : "15px"};
    }
    .payment-row {
      display: flex;
      justify-content: space-between;
      font-size: ${is58 ? "9px" : "10px"};
      font-weight: 800;
      text-transform: uppercase;
    }
    .footer {
      border-top: 1.5px solid #000000;
      padding-top: 1mm;
      text-align: center;
      line-height: 1.25;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .thanks {
      font-size: ${is58 ? "9px" : "10px"};
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.25px;
      margin: 0;
    }
    .policy {
      font-size: ${is58 ? "8px" : "8.5px"};
      font-weight: 600;
      margin: 0.4mm 0 0 0;
    }
  </style>
</head>
<body>
  <div id="tw-receipt-sheet" class="receipt">
    <div class="header">
      <div class="logo-wrap">
        <svg width="${is58 ? "126" : "144"}" height="${
    is58 ? "28" : "32"
  }" viewBox="0 0 156 38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="36" height="36" rx="7" fill="#000000"/>
          <path d="M8 12H20V15.5H15.8V27H12.2V15.5H8V12ZM20.5 12H24L25.6 21.2L27.6 12H30.4L32.4 21.2L34 12H37.5L34.2 27H30.9L29 18.2L27.1 27H23.8L20.5 12Z" fill="#FFFFFF"/>
          <text x="44" y="17" fill="#000000" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="14" letter-spacing="0.5">TECHNO</text>
          <text x="44" y="32" fill="#000000" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="14" letter-spacing="1.2">WORLD</text>
        </svg>
      </div>
      <p class="tagline">Computers &bull; Printing &bull; Accessories</p>
      <p class="subtagline">Rawalpindi &bull; Sales &amp; Digital Services</p>
    </div>

    <div class="meta">
      <div class="meta-row">
        <span class="meta-label">INVOICE:</span>
        <span class="meta-val mono">${escapeHtml(data.invoiceRef)}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">DATE:</span>
        <span class="meta-val mono">${escapeHtml(data.dateLabel)}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">CUSTOMER:</span>
        <span class="meta-val">${escapeHtml(data.customerName.toUpperCase())}</span>
      </div>
    </div>

    <div class="cols-head">
      <span>Description</span>
      <span>Total</span>
    </div>

    <div class="items">${itemsHtml}</div>

    <div class="totals">
      <div class="total-row">
        <span>Subtotal</span>
        <span class="mono">${escapeHtml(formatPkr(data.subtotalPaisa))}</span>
      </div>
      ${discountHtml}
      <div class="grand-total">
        <span>GRAND TOTAL</span>
        <span class="grand-amount">${escapeHtml(formatPkr(data.grandTotalPaisa))}</span>
      </div>
      <div class="payment-row">
        <span>PAYMENT METHOD</span>
        <span class="mono">${escapeHtml(paymentLabel)}</span>
      </div>
    </div>

    <div class="footer">
      <p class="thanks">THANK YOU FOR VISITING TECHNO WORLD!</p>
      <p class="policy">Goods once sold are exchangeable within 3 days with receipt</p>
    </div>
  </div>
</body>
</html>`;
}

export function useThermalReceiptPrint(
  data: ThermalReceiptData | null,
  paperWidth: ThermalPaperWidth
) {
  const removeExistingIframe = React.useCallback(() => {
    if (typeof document === "undefined") return;
    const prev = document.getElementById(PRINT_IFRAME_ID);
    if (prev) prev.remove();
  }, []);

  React.useEffect(() => {
    return () => {
      removeExistingIframe();
    };
  }, [removeExistingIframe]);

  const triggerPrint = React.useCallback(() => {
    if (!data || typeof document === "undefined") return;

    removeExistingIframe();

    const paperMm = paperWidth === "58mm" ? 58 : 80;
    const fallbackHeightMm = estimateReceiptHeightMm(
      data.items,
      data.discountPaisa > 0,
      paperWidth
    );

    const iframe = document.createElement("iframe");
    iframe.id = PRINT_IFRAME_ID;
    iframe.setAttribute("aria-hidden", "true");
    // Give the hidden iframe real roll width so measurements and pagination match the printer
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = `${paperMm}mm`;
    iframe.style.height = "1px";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    const iframeWin = iframe.contentWindow;
    if (!iframeDoc || !iframeWin) {
      iframe.remove();
      window.print();
      return;
    }

    iframeDoc.open();
    iframeDoc.write(
      buildThermalReceiptHtmlDocument(data, paperWidth, fallbackHeightMm)
    );
    iframeDoc.close();

    const executeMeasuredPrint = () => {
      const sheet = iframeDoc.getElementById("tw-receipt-sheet");
      const pageStyle = iframeDoc.getElementById("tw-receipt-page-style");
      let measuredMm = fallbackHeightMm;

      if (sheet) {
        const px = Math.max(
          sheet.scrollHeight,
          sheet.getBoundingClientRect().height
        );
        if (Number.isFinite(px) && px > 0) {
          measuredMm = Math.max(paperMm + 1, Math.ceil((px * 25.4) / 96) + 4);
        }
      }

      if (pageStyle) {
        pageStyle.textContent = pageStyle.textContent?.replace(
          /size:\s*\d+mm\s+\d+mm;/,
          `size: ${paperMm}mm ${measuredMm}mm;`
        ) ?? "";
      }

      const cleanupAfterPrint = () => {
        iframeWin.removeEventListener("afterprint", cleanupAfterPrint);
        window.setTimeout(() => {
          if (iframe.parentNode) iframe.remove();
        }, 250);
      };
      iframeWin.addEventListener("afterprint", cleanupAfterPrint);

      iframeWin.focus();
      iframeWin.print();
    };

    // Ensure layout & SVG/text rendering inside the iframe are completely painted before printing
    const waitAndPrint = () => {
      const fontsReady =
        "fonts" in iframeDoc && iframeDoc.fonts?.ready
          ? iframeDoc.fonts.ready
          : Promise.resolve();
      void fontsReady.finally(() => {
        iframeWin.requestAnimationFrame(() => {
          iframeWin.requestAnimationFrame(executeMeasuredPrint);
        });
      });
    };

    if (iframeDoc.readyState === "complete") {
      waitAndPrint();
    } else {
      iframe.onload = waitAndPrint;
    }
  }, [data, paperWidth, removeExistingIframe]);

  return { triggerPrint };
}

export function ThermalReceiptSheet({
  data,
  paperWidth,
}: {
  data: ThermalReceiptData;
  paperWidth: ThermalPaperWidth;
}) {
  const is58 = paperWidth === "58mm";
  const paymentLabel = formatPaymentMethodLabel(data.paymentMethod);

  return (
    <div
      className={`bg-white text-black font-sans select-text mx-auto rounded-xl border border-[var(--border)] shadow-sm ${
        is58 ? "w-[216px] p-2.5" : "w-full max-w-[302px] p-3"
      }`}
    >
      <div className="text-center border-b-2 border-black pb-1.5">
        <div className="mx-auto mb-1 flex items-center justify-center">
          <svg
            width={is58 ? "128" : "144"}
            height={is58 ? "28" : "32"}
            viewBox="0 0 156 38"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto"
          >
            <rect x="1" y="1" width="36" height="36" rx="7" fill="#000000" />
            <path
              d="M8 12H20V15.5H15.8V27H12.2V15.5H8V12ZM20.5 12H24L25.6 21.2L27.6 12H30.4L32.4 21.2L34 12H37.5L34.2 27H30.9L29 18.2L27.1 27H23.8L20.5 12Z"
              fill="#FFFFFF"
            />
            <text
              x="44"
              y="17"
              fill="#000000"
              fontFamily="Arial, Helvetica, sans-serif"
              fontWeight="900"
              fontSize="14"
              letterSpacing="0.5"
            >
              TECHNO
            </text>
            <text
              x="44"
              y="32"
              fill="#000000"
              fontFamily="Arial, Helvetica, sans-serif"
              fontWeight="900"
              fontSize="14"
              letterSpacing="1.2"
            >
              WORLD
            </text>
          </svg>
        </div>
        <p className="text-[10px] font-extrabold uppercase tracking-wide leading-tight text-black">
          Computers • Printing • Accessories
        </p>
        <p className="text-[9px] font-semibold leading-tight text-black">
          Rawalpindi • Sales &amp; Digital Services
        </p>
      </div>

      <div className="py-1.5 border-b-2 border-black text-[10px] space-y-0.5 leading-tight">
        <div className="flex justify-between gap-2">
          <span className="font-bold">INVOICE:</span>
          <span className="font-mono font-extrabold">{data.invoiceRef}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="font-bold">DATE:</span>
          <span className="font-mono font-semibold text-right">
            {data.dateLabel}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="font-bold">CUSTOMER:</span>
          <span className="font-extrabold uppercase text-right break-words">
            {data.customerName}
          </span>
        </div>
      </div>

      <div className="flex justify-between border-b border-black py-1 text-[10px] font-black uppercase leading-none">
        <span>Description</span>
        <span>Total</span>
      </div>

      <div className="divide-y divide-dashed divide-black border-b-2 border-black max-h-60 overflow-y-auto">
        {data.items.map((item, idx) => (
          <div key={`${item.name}-${idx}`} className="py-1 leading-tight">
            <div className="flex justify-between items-start gap-2 text-[11px]">
              <span className="font-extrabold flex-1 break-words">
                {item.name}
              </span>
              <span className="font-mono font-black whitespace-nowrap">
                {formatPkr(item.lineTotalPaisa)}
              </span>
            </div>
            <div className="text-[10px] font-mono font-semibold text-black/85">
              Qty: {item.quantity} × {formatPkr(item.unitPricePaisa)}
            </div>
          </div>
        ))}
      </div>

      <div className="py-1.5 space-y-0.5 text-[11px] leading-tight">
        <div className="flex justify-between font-semibold">
          <span>Subtotal</span>
          <span className="font-mono font-bold">
            {formatPkr(data.subtotalPaisa)}
          </span>
        </div>
        {data.discountPaisa > 0 && (
          <div className="flex justify-between font-semibold">
            <span>Discount</span>
            <span className="font-mono font-bold">
              -{formatPkr(data.discountPaisa)}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center border-y-2 border-black py-1 my-1 text-[12px] font-black">
          <span>GRAND TOTAL</span>
          <span className="font-mono text-[14px]">
            {formatPkr(data.grandTotalPaisa)}
          </span>
        </div>
        <div className="flex justify-between text-[10px] font-bold">
          <span>PAYMENT METHOD</span>
          <span className="font-mono uppercase">{paymentLabel}</span>
        </div>
      </div>

      <div className="border-t-2 border-black pt-1 text-center leading-tight">
        <p className="text-[10px] font-black uppercase tracking-wide">
          Thank You For Visiting Techno World!
        </p>
        <p className="text-[9px] font-semibold">
          Goods once sold are exchangeable within 3 days with receipt
        </p>
      </div>
    </div>
  );
}

export function useThermalPaperWidth(): [
  ThermalPaperWidth,
  React.Dispatch<React.SetStateAction<ThermalPaperWidth>>
] {
  const [paperWidth, setPaperWidth] =
    React.useState<ThermalPaperWidth>("80mm");

  React.useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active || typeof window === "undefined") return;
      const saved = window.localStorage.getItem(PRINTER_WIDTH_STORAGE_KEY);
      if (saved === "58mm" || saved === "80mm") {
        setPaperWidth(saved);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return [paperWidth, setPaperWidth];
}

export function ThermalWidthSelector({
  value,
  onChange,
  itemCount,
  hasDiscount,
}: {
  value: ThermalPaperWidth;
  onChange: (w: ThermalPaperWidth) => void;
  itemCount: number;
  hasDiscount: boolean;
}) {
  const estHeightMm = React.useMemo(
    () =>
      estimateReceiptHeightMm(
        Array.from({ length: itemCount }, () => ({
          name: "Item",
          quantity: 1,
          unitPricePaisa: 0,
          lineTotalPaisa: 0,
        })),
        hasDiscount,
        value
      ),
    [hasDiscount, itemCount, value]
  );

  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--warm)] p-0.5">
        {(["80mm", "58mm"] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => {
              onChange(w);
              if (typeof window !== "undefined") {
                window.localStorage.setItem(PRINTER_WIDTH_STORAGE_KEY, w);
              }
            }}
            className={`px-2.5 py-1 rounded-md font-mono font-bold transition cursor-pointer ${
              value === w
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            {w}
          </button>
        ))}
      </div>
      <span className="font-mono text-[var(--muted)]">
        Auto Height (~{estHeightMm}mm • {itemCount} item{itemCount === 1 ? "" : "s"})
      </span>
    </div>
  );
}

export function CompactPrintButton({
  onClick,
  label = "Print Receipt",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button type="button" className="flex-1 min-w-[130px]" onClick={onClick}>
      <Printer className="h-4 w-4 mr-1.5" />
      {label}
    </Button>
  );
}
