"use client";

import * as React from "react";
import {
  Calculator,
  CheckCircle2,
  CreditCard,
  Edit,
  Film,
  FileText,
  FolderCog,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { formatPkr, pkrToPaisa } from "@/lib/format/currency";

export interface PosCategoryRecord {
  id: string;
  name: string;
}

export interface PosProductItem {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  retailPricePaisa: number;
  costPricePaisa: number;
  stockQuantity: number;
  unit: string;
}

export interface PrintPaperRecord {
  id: string;
  name: string;
  bwPricePaisa: number;
  colorPricePaisa: number;
}

export interface MediaCatRecord {
  id: string;
  type: string;
  name: string;
  defaultPricePaisa: number;
}

export interface ComposingServiceRecord {
  id: string;
  name: string;
  defaultPricePaisa: number;
}

export interface CartItem {
  id: string;
  name: string;
  category: string;
  retailPricePaisa: number;
  costPricePaisa: number;
  quantity: number;
  productId?: string;
  maxStock?: number;
}

interface PosCounterProps {
  categories: PosCategoryRecord[];
  products: PosProductItem[];
  printPapers: PrintPaperRecord[];
  mediaCategories: MediaCatRecord[];
  composingServices: ComposingServiceRecord[];
  onCreatePaper: (payload: { name: string; bwPricePaisa: number; colorPricePaisa: number }) => Promise<void>;
  onUpdatePaper: (id: string, payload: { name: string; bwPricePaisa: number; colorPricePaisa: number }) => Promise<void>;
  onDeletePaper: (id: string) => Promise<void>;
  onCreateMediaCat: (payload: { type: string; name: string; defaultPricePaisa: number }) => Promise<void>;
  onUpdateMediaCat: (id: string, payload: { type: string; name: string; defaultPricePaisa: number }) => Promise<void>;
  onDeleteMediaCat: (id: string) => Promise<void>;
  onCreateComposing: (payload: { name: string; defaultPricePaisa: number }) => Promise<void>;
  onUpdateComposing: (id: string, payload: { name: string; defaultPricePaisa: number }) => Promise<void>;
  onDeleteComposing: (id: string) => Promise<void>;
  onCompleteSale: (payload: {
    customerName: string;
    discountPaisa: number;
    paymentMethod: string;
    items: Array<{ productId?: string; name: string; category: string; quantity: number; retailPricePaisa: number; costPricePaisa: number }>;
  }) => Promise<any>;
}

export function PosCounter({
  categories,
  products,
  printPapers,
  mediaCategories,
  composingServices,
  onCreatePaper,
  onUpdatePaper,
  onDeletePaper,
  onCreateMediaCat,
  onUpdateMediaCat,
  onDeleteMediaCat,
  onCreateComposing,
  onUpdateComposing,
  onDeleteComposing,
  onCompleteSale,
}: PosCounterProps) {
  const [activeTab, setActiveTab] = React.useState<"MOVIES" | "PRINTS" | "PRODUCTS" | "COMPOSING">("MOVIES");
  const [selectedCat, setSelectedCat] = React.useState("ALL");
  const [search, setSearch] = React.useState("");
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [customerName, setCustomerName] = React.useState("");
  const [discountPkr, setDiscountPkr] = React.useState("0");
  const [paymentMethod, setPaymentMethod] = React.useState("CASH");

  // Receipt Modal State after successful sale
  const [completedSale, setCompletedSale] = React.useState<{
    saleNumber: number;
    invoiceRef: string;
    customerName: string;
    items: CartItem[];
    subtotalPaisa: number;
    discountPaisa: number;
    grandTotalPaisa: number;
    paymentMethod: string;
    date: string;
  } | null>(null);

  // Print Calculator States
  const [showPaperModal, setShowPaperModal] = React.useState(false);
  const [selectedPaperId, setSelectedPaperId] = React.useState(printPapers[0]?.id || "");
  const [printMode, setPrintMode] = React.useState<"BW" | "COLOR">("BW");
  const [printSideMode, setPrintSideMode] = React.useState<"SINGLE" | "DOUBLE">("SINGLE");
  const [printCountMode, setPrintCountMode] = React.useState<"SINGLE" | "MULTIPLE">("MULTIPLE");
  const [printQty, setPrintQty] = React.useState("10");
  const [customPricePerPrintPkr, setCustomPricePerPrintPkr] = React.useState("");

  // Paper Form States
  const [paperName, setPaperName] = React.useState("");
  const [paperBwPkr, setPaperBwPkr] = React.useState("10");
  const [paperColorPkr, setPaperColorPkr] = React.useState("30");
  const [editingPaper, setEditingPaper] = React.useState<PrintPaperRecord | null>(null);

  // Movies & Media States
  const [showMediaModal, setShowMediaModal] = React.useState(false);
  const [selectedMediaId, setSelectedMediaId] = React.useState(mediaCategories[0]?.id || "");
  const [mediaQty, setMediaQty] = React.useState("1");

  // Media Category Form States
  const [mediaTypeName, setMediaTypeN] = React.useState("MOVIE");
  const [mediaCatName, setMediaCatName] = React.useState("");
  const [mediaDefaultPkr, setMediaDefaultPkr] = React.useState("20");
  const [editingMediaCat, setEditingMediaCat] = React.useState<MediaCatRecord | null>(null);

  // Composing States
  const [showComposingModal, setShowComposingModal] = React.useState(false);
  const [selectedComposingId, setSelectedComposingId] = React.useState(composingServices[0]?.id || "");
  const [composingQty, setComposingQty] = React.useState("1");
  const [composingCustomPricePkr, setComposingCustomPricePkr] = React.useState("");

  // Composing Form States
  const [composingServiceName, setComposingServiceName] = React.useState("");
  const [composingServicePricePkr, setComposingServicePricePkr] = React.useState("500");
  const [editingComposing, setEditingComposing] = React.useState<ComposingServiceRecord | null>(null);

  const [feedback, setFeedback] = React.useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const filterCats = ["ALL", ...Array.from(new Set(categories.map((c) => c.name)))];
  const currentPaper = printPapers.find((p) => p.id === selectedPaperId) || printPapers[0];
  const currentMediaCat = mediaCategories.find((m) => m.id === selectedMediaId) || mediaCategories[0];
  const currentComposing = composingServices.find((s) => s.id === selectedComposingId) || composingServices[0];

  // LIVE CALCULATOR DERIVED VALUES (Prints)
  const baseRatePaisa = printMode === "BW" ? (currentPaper?.bwPricePaisa || 1000) : (currentPaper?.colorPricePaisa || 3000);
  const sideMultiplier = printSideMode === "DOUBLE" ? 1.5 : 1.0;
  const unitRatePaisa = customPricePerPrintPkr.trim() !== "" ? pkrToPaisa(customPricePerPrintPkr) : Math.round(baseRatePaisa * sideMultiplier);
  const actualPrintQty = printCountMode === "SINGLE" ? 1 : Math.max(1, parseInt(printQty, 10) || 1);
  const liveTotalPrintPaisa = unitRatePaisa * actualPrintQty;

  // LIVE CALCULATOR DERIVED VALUES (Media)
  const mediaUnitPaisa = currentMediaCat?.defaultPricePaisa || 2000;
  const mediaActualQty = Math.max(1, parseInt(mediaQty, 10) || 1);
  const liveTotalMediaPaisa = mediaUnitPaisa * mediaActualQty;

  // LIVE CALCULATOR DERIVED VALUES (Composing)
  const composingUnitPaisa = composingCustomPricePkr.trim() !== "" ? pkrToPaisa(composingCustomPricePkr) : (currentComposing?.defaultPricePaisa || 50000);
  const composingActualQty = Math.max(1, parseInt(composingQty, 10) || 1);
  const liveTotalComposingPaisa = composingUnitPaisa * composingActualQty;

  const filteredProducts = products.filter((p) => {
    if (selectedCat !== "ALL" && p.category !== selectedCat) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.sku ?? "").toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  function addProductToCart(product: PosProductItem) {
    if (product.stockQuantity <= 0) {
      setFeedback({ type: "err", text: `Product "${product.name}" is out of stock!` });
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          setFeedback({ type: "err", text: `Cannot exceed available stock (${product.stockQuantity}).` });
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: `prod-${product.id}`,
          productId: product.id,
          name: product.name,
          category: product.category,
          retailPricePaisa: product.retailPricePaisa,
          costPricePaisa: product.costPricePaisa,
          quantity: 1,
          maxStock: product.stockQuantity,
        },
      ];
    });
  }

  function addPrintJob() {
    const name = `Print: ${currentPaper?.name || "Standard"} (${printMode === "BW" ? "B&W" : "Color"}, ${printSideMode === "SINGLE" ? "Single" : "Double"}, ${actualPrintQty} copies)`;
    setCart((prev) => [
      ...prev,
      {
        id: `print-${Date.now()}`,
        name,
        category: "Printing Services",
        retailPricePaisa: liveTotalPrintPaisa,
        costPricePaisa: Math.round(liveTotalPrintPaisa * 0.3),
        quantity: 1,
      },
    ]);
    setCustomPricePerPrintPkr("");
    setFeedback({ type: "ok", text: "Print job added to bill!" });
  }

  function addMediaJob() {
    const name = `Media Copy: ${currentMediaCat?.name || "Movie"} (x${mediaActualQty})`;
    setCart((prev) => [
      ...prev,
      {
        id: `media-${Date.now()}`,
        name,
        category: "Movies & Media",
        retailPricePaisa: liveTotalMediaPaisa,
        costPricePaisa: Math.round(liveTotalMediaPaisa * 0.2),
        quantity: 1,
      },
    ]);
    setMediaQty("1");
    setFeedback({ type: "ok", text: "Media copy added to bill!" });
  }

  function addComposingJob() {
    const name = `Composing: ${currentComposing?.name || "Service"} (x${composingActualQty})`;
    setCart((prev) => [
      ...prev,
      {
        id: `comp-${Date.now()}`,
        name,
        category: "Composing Services",
        retailPricePaisa: liveTotalComposingPaisa,
        costPricePaisa: Math.round(liveTotalComposingPaisa * 0.1),
        quantity: 1,
      },
    ]);
    setComposingCustomPricePkr("");
    setComposingQty("1");
    setFeedback({ type: "ok", text: "Composing service added to bill!" });
  }

  function handlePaperSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const payload = {
          name: paperName,
          bwPricePaisa: pkrToPaisa(paperBwPkr),
          colorPricePaisa: pkrToPaisa(paperColorPkr),
        };
        if (editingPaper) {
          await onUpdatePaper(editingPaper.id, payload);
          setEditingPaper(null);
        } else {
          await onCreatePaper(payload);
        }
        setPaperName("");
        setPaperBwPkr("10");
        setPaperColorPkr("30");
        setFeedback({ type: "ok", text: "Paper type saved successfully!" });
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to save paper type." });
      }
    });
  }

  function handleDeletePaper(id: string) {
    if (!confirm("Delete this paper type?")) return;
    startTransition(async () => {
      try {
        await onDeletePaper(id);
        setFeedback({ type: "ok", text: "Paper type deleted." });
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to delete paper type." });
      }
    });
  }

  function handleMediaCatSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const payload = {
          type: mediaTypeName,
          name: mediaCatName,
          defaultPricePaisa: pkrToPaisa(mediaDefaultPkr),
        };
        if (editingMediaCat) {
          await onUpdateMediaCat(editingMediaCat.id, payload);
          setEditingMediaCat(null);
        } else {
          await onCreateMediaCat(payload);
        }
        setMediaCatName("");
        setMediaDefaultPkr("20");
        setFeedback({ type: "ok", text: "Media category saved successfully!" });
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to save media category." });
      }
    });
  }

  function handleDeleteMediaCat(id: string) {
    if (!confirm("Delete this media category?")) return;
    startTransition(async () => {
      try {
        await onDeleteMediaCat(id);
        setFeedback({ type: "ok", text: "Media category deleted." });
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to delete media category." });
      }
    });
  }

  function handleComposingSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const payload = {
          name: composingServiceName,
          defaultPricePaisa: pkrToPaisa(composingServicePricePkr),
        };
        if (editingComposing) {
          await onUpdateComposing(editingComposing.id, payload);
          setEditingComposing(null);
        } else {
          await onCreateComposing(payload);
        }
        setComposingServiceName("");
        setComposingServicePricePkr("500");
        setFeedback({ type: "ok", text: "Composing service saved successfully!" });
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to save composing service." });
      }
    });
  }

  function handleDeleteComposing(id: string) {
    if (!confirm("Delete this composing service?")) return;
    startTransition(async () => {
      try {
        await onDeleteComposing(id);
        setFeedback({ type: "ok", text: "Composing service deleted." });
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to delete composing service." });
      }
    });
  }

  function updateQuantity(cartId: string, delta: number) {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id === cartId) {
            const newQty = item.quantity + delta;
            if (item.maxStock !== undefined && newQty > item.maxStock) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  }

  const subtotalPaisa = cart.reduce((acc, item) => acc + item.retailPricePaisa * item.quantity, 0);
  const discountAmountPaisa = Math.max(0, pkrToPaisa(discountPkr));
  const grandTotalPaisa = Math.max(0, subtotalPaisa - discountAmountPaisa);

  function handleCheckout() {
    if (cart.length === 0) {
      setFeedback({ type: "err", text: "Cart is empty. Add products or services to checkout." });
      return;
    }

    const currentCartSnapshot = [...cart];
    const currentCustomerName = customerName.trim() || "WALK-IN CUSTOMER";
    const currentSubtotal = subtotalPaisa;
    const currentDiscount = discountAmountPaisa;
    const currentGrandTotal = grandTotalPaisa;
    const currentPaymentMethod = paymentMethod;

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await onCompleteSale({
          customerName: currentCustomerName,
          discountPaisa: currentDiscount,
          paymentMethod: currentPaymentMethod,
          items: currentCartSnapshot.map((i) => ({
            productId: i.productId,
            name: i.name,
            category: i.category,
            quantity: i.quantity,
            retailPricePaisa: i.retailPricePaisa,
            costPricePaisa: i.costPricePaisa,
          })),
        });

        const saleNum = res?.saleNumber || Math.floor(1000 + Math.random() * 9000);
        const invoiceRef = `#TW-${7000000 + saleNum}`;

        // Open Receipt Modal matching the exact attached thermal receipt style
        setCompletedSale({
          saleNumber: saleNum,
          invoiceRef,
          customerName: currentCustomerName,
          items: currentCartSnapshot,
          subtotalPaisa: currentSubtotal,
          discountPaisa: currentDiscount,
          grandTotalPaisa: currentGrandTotal,
          paymentMethod: currentPaymentMethod,
          date: new Date().toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          }).toLowerCase(),
        });

        setCart([]);
        setCustomerName("");
        setDiscountPkr("0");
        setFeedback({ type: "ok", text: "Sale completed successfully! Ready for printing." });
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Checkout failed." });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT 2 COLS: Clean Distinct Tabs */}
      <div className="lg:col-span-2 space-y-4">
        {/* POS Module Tabs */}
        <div className="flex rounded-2xl border border-border bg-surface p-1.5 shadow-xs">
          {(
            [
              { id: "MOVIES", label: "Movies & Media", icon: Film },
              { id: "PRINTS", label: "Prints & Papers", icon: Printer },
              { id: "PRODUCTS", label: "Inventory Products", icon: ShoppingCart },
              { id: "COMPOSING", label: "Composing", icon: FileText },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition ${activeTab === t.id ? "bg-brand text-white shadow-xs" : "text-muted hover:text-ink"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className={`rounded-2xl px-4 py-3 text-xs font-semibold ${feedback.type === "ok" ? "bg-success-soft text-success border border-success/30" : "bg-danger-soft text-danger border border-danger/30"}`}>
            {feedback.text}
          </div>
        )}

        {/* TAB 1: MOVIES & MEDIA */}
        {activeTab === "MOVIES" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-sm font-extrabold text-ink">Movies, TV Shows &amp; Media Copies</h3>
                <Button type="button" size="sm" variant="secondary" onClick={() => setShowMediaModal(true)}>
                  <FolderCog className="h-4 w-4 mr-1" /> Manage Categories ({mediaCategories.length})
                </Button>
              </div>

              <div>
                <Label className="text-xs font-bold text-ink">Select Media Category</Label>
                <select
                  value={selectedMediaId}
                  onChange={(e) => setSelectedMediaId(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-warm px-3 text-xs font-semibold"
                >
                  {mediaCategories.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.type}) — {formatPkr(m.defaultPricePaisa)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-ink">Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={mediaQty}
                  onChange={(e) => setMediaQty(e.target.value)}
                  className="mt-1.5 h-9 font-mono text-xs"
                />
              </div>

              <div className="rounded-2xl border border-brand/40 bg-brand-soft/10 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-brand-dark">
                  <span>Live Calculator Breakdown:</span>
                  <span className="font-mono">{currentMediaCat?.name || "Media"}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1 border-t border-brand/20">
                  <div>
                    <p className="text-[10px] text-muted">Price per Item</p>
                    <p className="font-bold text-ink">{formatPkr(mediaUnitPaisa)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">Quantity</p>
                    <p className="font-bold text-ink">{mediaActualQty} units</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">Live Total</p>
                    <p className="font-extrabold text-success">{formatPkr(liveTotalMediaPaisa)}</p>
                  </div>
                </div>
              </div>

              <Button type="button" className="w-full" onClick={addMediaJob}>
                Add Media to Bill • {formatPkr(liveTotalMediaPaisa)}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* TAB 2: PRINTS & PAPERS */}
        {activeTab === "PRINTS" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-sm font-extrabold text-ink">Prints &amp; Papers Calculator</h3>
                <Button type="button" size="sm" variant="secondary" onClick={() => setShowPaperModal(true)}>
                  <FolderCog className="h-4 w-4 mr-1" /> Manage Paper Types ({printPapers.length})
                </Button>
              </div>

              <div>
                <Label className="text-xs font-bold text-ink">1. Select Paper Type</Label>
                <select
                  value={selectedPaperId}
                  onChange={(e) => setSelectedPaperId(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-warm px-3 text-xs font-semibold"
                >
                  {printPapers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (B&amp;W: {formatPkr(p.bwPricePaisa)} | Color: {formatPkr(p.colorPricePaisa)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-ink">2. Print Mode</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPrintMode("BW")}
                    className={`rounded-xl py-2.5 text-xs font-extrabold transition ${printMode === "BW" ? "bg-brand text-white shadow-xs" : "border border-border bg-warm text-muted hover:text-ink"}`}
                  >
                    Black &amp; White ({formatPkr(currentPaper?.bwPricePaisa || 1000)}/pg)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode("COLOR")}
                    className={`rounded-xl py-2.5 text-xs font-extrabold transition ${printMode === "COLOR" ? "bg-brand text-white shadow-xs" : "border border-border bg-warm text-muted hover:text-ink"}`}
                  >
                    Colored ({formatPkr(currentPaper?.colorPricePaisa || 3000)}/pg)
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-ink">3. Side Configuration</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPrintSideMode("SINGLE")}
                    className={`rounded-xl py-2.5 text-xs font-extrabold transition ${printSideMode === "SINGLE" ? "bg-brand text-white shadow-xs" : "border border-border bg-warm text-muted hover:text-ink"}`}
                  >
                    Single Sided (1x)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintSideMode("DOUBLE")}
                    className={`rounded-xl py-2.5 text-xs font-extrabold transition ${printSideMode === "DOUBLE" ? "bg-brand text-white shadow-xs" : "border border-border bg-warm text-muted hover:text-ink"}`}
                  >
                    Double Sided (1.5x)
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-ink">4. Quantity Type</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPrintCountMode("SINGLE")}
                    className={`rounded-xl py-2.5 text-xs font-extrabold transition ${printCountMode === "SINGLE" ? "bg-brand text-white shadow-xs" : "border border-border bg-warm text-muted hover:text-ink"}`}
                  >
                    Single Print (1 Page)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintCountMode("MULTIPLE")}
                    className={`rounded-xl py-2.5 text-xs font-extrabold transition ${printCountMode === "MULTIPLE" ? "bg-brand text-white shadow-xs" : "border border-border bg-warm text-muted hover:text-ink"}`}
                  >
                    Multiple Prints / Copies
                  </button>
                </div>
              </div>

              {printCountMode === "MULTIPLE" && (
                <div>
                  <Label className="text-xs">Number of Prints / Pages</Label>
                  <Input
                    type="number"
                    min="1"
                    value={printQty}
                    onChange={(e) => setPrintQty(e.target.value)}
                    className="mt-1 h-9 font-mono text-xs"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs">Custom Price Override per Print (Rs.) — Optional</Label>
                <Input
                  type="number"
                  min="0"
                  value={customPricePerPrintPkr}
                  onChange={(e) => setCustomPricePerPrintPkr(e.target.value)}
                  placeholder="Leave blank for calculated standard rate"
                  className="mt-1 h-9 font-mono text-xs"
                />
              </div>

              <div className="rounded-2xl border border-brand/40 bg-brand-soft/10 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-brand-dark">
                  <span>Live Calculator Breakdown:</span>
                  <span className="font-mono">{currentPaper?.name || "Paper"} • {printMode} • {printSideMode}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1 border-t border-brand/20">
                  <div>
                    <p className="text-[10px] text-muted">Unit Rate</p>
                    <p className="font-bold text-ink">{formatPkr(unitRatePaisa)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">Quantity</p>
                    <p className="font-bold text-ink">{actualPrintQty} prints</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">Live Total</p>
                    <p className="font-extrabold text-success">{formatPkr(liveTotalPrintPaisa)}</p>
                  </div>
                </div>
              </div>

              <Button type="button" className="w-full" onClick={addPrintJob}>
                Add Print Job to Bill • {formatPkr(liveTotalPrintPaisa)}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* TAB 3: INVENTORY PRODUCTS */}
        {activeTab === "PRODUCTS" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search inventory items by name or SKU..."
                  className="h-9 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {filterCats.map((cat, idx) => (
                <button
                  key={`${cat}-${idx}`}
                  type="button"
                  onClick={() => setSelectedCat(cat)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${selectedCat === cat ? "bg-brand text-white shadow-xs" : "border border-border bg-surface text-muted hover:text-ink"}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-12 text-center text-xs text-muted bg-surface rounded-2xl border border-border">
                  No products found in inventory. Add physical items in the Inventory tab to see them here.
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const isOut = p.stockQuantity <= 0;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProductToCart(p)}
                      disabled={isOut}
                      className={`flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 text-left transition hover:border-brand/50 hover:shadow-sm ${isOut ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className="space-y-1">
                        <span className="font-mono text-[10px] text-muted">{p.category}</span>
                        <h4 className="font-display text-xs font-extrabold text-ink line-clamp-2">{p.name}</h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border flex items-center justify-between">
                        <span className="font-mono font-extrabold text-brand-dark text-xs">{formatPkr(p.retailPricePaisa)}</span>
                        <Badge variant={isOut ? "danger" : "success"} className="text-[10px]">
                          {p.stockQuantity} {p.unit}
                        </Badge>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: COMPOSING SERVICES */}
        {activeTab === "COMPOSING" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-sm font-extrabold text-ink">Document Composing &amp; Online Services</h3>
                <Button type="button" size="sm" variant="secondary" onClick={() => setShowComposingModal(true)}>
                  <FolderCog className="h-4 w-4 mr-1" /> Manage Services ({composingServices.length})
                </Button>
              </div>

              <div>
                <Label className="text-xs font-bold text-ink">Service Type</Label>
                <select
                  value={selectedComposingId}
                  onChange={(e) => setSelectedComposingId(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-warm px-3 text-xs font-semibold"
                >
                  {composingServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {formatPkr(s.defaultPricePaisa)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-ink">Quantity / Count</Label>
                <Input
                  type="number"
                  min="1"
                  value={composingQty}
                  onChange={(e) => setComposingQty(e.target.value)}
                  className="mt-1.5 h-9 font-mono text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-ink">Custom Price Override (Rs.) — Optional</Label>
                <Input
                  type="number"
                  min="0"
                  value={composingCustomPricePkr}
                  onChange={(e) => setComposingCustomPricePkr(e.target.value)}
                  placeholder="Enter custom price if needed..."
                  className="mt-1.5 h-9 font-mono text-xs"
                />
              </div>

              <div className="rounded-2xl border border-brand/40 bg-brand-soft/10 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-brand-dark">
                  <span>Live Calculator Breakdown:</span>
                  <span className="font-mono">{currentComposing?.name || "Service"}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1 border-t border-brand/20">
                  <div>
                    <p className="text-[10px] text-muted">Unit Price</p>
                    <p className="font-bold text-ink">{formatPkr(composingUnitPaisa)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">Quantity</p>
                    <p className="font-bold text-ink">{composingActualQty} units</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">Live Total</p>
                    <p className="font-extrabold text-success">{formatPkr(liveTotalComposingPaisa)}</p>
                  </div>
                </div>
              </div>

              <Button type="button" className="w-full" onClick={addComposingJob}>
                Add Composing Job to Bill • {formatPkr(liveTotalComposingPaisa)}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* RIGHT COL: Cart / Bill & Checkout */}
      <div className="space-y-4">
        <Card className="sticky top-6">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-brand" />
                <h3 className="font-display text-sm font-extrabold text-ink">Current Bill ({cart.length})</h3>
              </div>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-danger" onClick={() => setCart([])} disabled={cart.length === 0}>
                Clear
              </Button>
            </div>

            <div>
              <Label className="text-xs">Customer Name (Optional)</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in Customer"
                className="mt-1 h-8 text-xs"
              />
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted">Select a tab on the left and add items to bill.</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-warm p-2.5 text-xs">
                    <div className="flex-1 pr-2">
                      <p className="font-bold text-ink line-clamp-1">{item.name}</p>
                      <p className="font-mono text-[10px] text-muted">{formatPkr(item.retailPricePaisa)} each</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button type="button" size="sm" variant="secondary" className="h-6 w-6 p-0 text-xs" onClick={() => updateQuantity(item.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="font-mono font-bold text-ink w-5 text-center">{item.quantity}</span>
                      <Button type="button" size="sm" variant="secondary" className="h-6 w-6 p-0 text-xs" onClick={() => updateQuantity(item.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Billing Totals */}
            <div className="space-y-2 pt-3 border-t border-border text-xs">
              <div className="flex justify-between text-muted">
                <span>Subtotal:</span>
                <span className="font-mono font-bold text-ink">{formatPkr(subtotalPaisa)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted">Discount (Rs.):</span>
                <Input
                  type="number"
                  min="0"
                  value={discountPkr}
                  onChange={(e) => setDiscountPkr(e.target.value)}
                  className="h-7 w-24 text-right font-mono text-xs"
                />
              </div>

              <div className="flex justify-between border-t border-border pt-2 text-sm">
                <span className="font-bold text-ink">Grand Total:</span>
                <span className="font-mono font-extrabold text-brand-dark">{formatPkr(grandTotalPaisa)}</span>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="space-y-1.5 pt-2">
              <Label className="text-xs">Payment Method</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {["CASH", "JAZZCASH", "EASYPAISA", "BANK"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`rounded-xl py-2 text-xs font-extrabold transition ${paymentMethod === m ? "bg-brand text-white shadow-xs" : "border border-border bg-warm text-muted hover:text-ink"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              className="w-full mt-2"
              onClick={handleCheckout}
              disabled={isPending || cart.length === 0}
            >
              {isPending ? "Processing Sale..." : `Complete Sale • ${formatPkr(grandTotalPaisa)}`}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* MODAL: THERMAL RECEIPT PREVIEW (Matches attached TechnoWorld receipt image) */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:bg-white print:p-0 print:absolute print:inset-0">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl space-y-3 font-mono text-xs print:shadow-none print:border-none print:w-full print:max-w-none print:p-1 print:text-black">
            
            {/* Header */}
            <div className="text-center space-y-0.5 border-b border-dashed border-border pb-3">
              <div className="inline-block bg-black text-white font-black px-2.5 py-1 text-xs tracking-widest rounded mb-1">
                TW
              </div>
              <h2 className="font-display text-sm font-extrabold tracking-wider uppercase text-ink print:text-black">TECHNO WORLD</h2>
              <p className="text-[10px] uppercase font-semibold text-muted print:text-gray-700">COMPUTERS • PRINTING • ACCESSORIES</p>
              <p className="text-[9px] text-muted print:text-gray-600">Rawalpindi • Sales &amp; Digital Services</p>
            </div>

            {/* Meta Info */}
            <div className="space-y-1 border-b border-dashed border-border pb-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted print:text-gray-600">INVOICE:</span>
                <span className="font-bold text-ink print:text-black">{completedSale.invoiceRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted print:text-gray-600">DATE:</span>
                <span className="text-ink print:text-black">{completedSale.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted print:text-gray-600">CUSTOMER:</span>
                <span className="font-bold uppercase text-ink print:text-black">{completedSale.customerName}</span>
              </div>
            </div>

            {/* Description Header */}
            <div className="flex justify-between font-bold border-b border-border pb-1 text-[11px] uppercase">
              <span>Description</span>
              <span>Total</span>
            </div>

            {/* Receipt Items */}
            <div className="space-y-2 max-h-52 overflow-y-auto text-[11px] border-b border-dashed border-border pb-3">
              {completedSale.items.map((item, idx) => {
                const lineTotal = item.retailPricePaisa * item.quantity;
                return (
                  <div key={idx} className="space-y-0.5 border-b border-dotted border-border/60 pb-1.5 last:border-none">
                    <p className="font-bold text-ink print:text-black">{item.name}</p>
                    <div className="flex justify-between text-[10px] text-muted print:text-gray-600">
                      <span>Qty: {item.quantity} • {formatPkr(item.retailPricePaisa)}</span>
                      <span className="font-bold font-mono text-ink print:text-black">{formatPkr(lineTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="space-y-1 text-xs border-b border-dashed border-border pb-3">
              <div className="flex justify-between text-muted print:text-gray-600">
                <span>Subtotal</span>
                <span className="font-mono text-ink print:text-black">{formatPkr(completedSale.subtotalPaisa)}</span>
              </div>
              {completedSale.discountPaisa > 0 && (
                <div className="flex justify-between text-danger">
                  <span>Discount</span>
                  <span className="font-mono">-{formatPkr(completedSale.discountPaisa)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-ink print:text-black pt-1">
                <span>GRAND TOTAL</span>
                <span className="font-mono text-brand-dark print:text-black">{formatPkr(completedSale.grandTotalPaisa)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted print:text-gray-600 pt-1">
                <span>PAYMENT METHOD</span>
                <span className="font-bold font-mono uppercase text-ink print:text-black">{completedSale.paymentMethod}_TRANSFER</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center space-y-1 pt-1 text-[10px] text-muted print:text-gray-600">
              <p className="font-bold uppercase tracking-wide text-ink print:text-black">THANK YOU FOR VISITING TECHNO WORLD!</p>
              <p className="text-[9px]">Goods once sold are exchangeable within 3 days with receipt</p>
            </div>

            {/* Actions (Hidden when printing via browser print) */}
            <div className="flex items-center gap-2 pt-2 print:hidden">
              <Button
                type="button"
                className="flex-1"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4 mr-1.5" /> Print Receipt
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCompletedSale(null)}
              >
                Close / New Sale
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Manage Paper Types */}
      {showPaperModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-base font-extrabold text-ink">Manage Paper Types &amp; Rates</h3>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowPaperModal(false)}>✕</Button>
            </div>

            <form onSubmit={handlePaperSave} className="space-y-3">
              <div>
                <Label className="text-xs">Paper Type Name</Label>
                <Input
                  value={paperName}
                  onChange={(e) => setPaperName(e.target.value)}
                  placeholder="e.g. Glossy Photo, A4 Standard..."
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">B&amp;W Price (Rs.)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={paperBwPkr}
                    onChange={(e) => setPaperBwPkr(e.target.value)}
                    className="h-9 font-mono text-xs"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Color Price (Rs.)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={paperColorPkr}
                    onChange={(e) => setPaperColorPkr(e.target.value)}
                    className="h-9 font-mono text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editingPaper && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingPaper(null); setPaperName(""); }}>Cancel</Button>
                )}
                <Button type="submit" size="sm">
                  {editingPaper ? "Update Paper" : "Add Paper Type"}
                </Button>
              </div>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto pt-2 border-t border-border">
              {printPapers.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-warm px-3 py-2 text-xs">
                  <div>
                    <p className="font-bold text-ink">{p.name}</p>
                    <p className="font-mono text-[10px] text-muted">B&amp;W: {formatPkr(p.bwPricePaisa)} | Color: {formatPkr(p.colorPricePaisa)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingPaper(p); setPaperName(p.name); setPaperBwPkr(Math.round(p.bwPricePaisa / 100).toString()); setPaperColorPkr(Math.round(p.colorPricePaisa / 100).toString()); }}>
                      <Edit className="h-3.5 w-3.5 text-muted" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-danger hover:bg-danger-soft" onClick={() => handleDeletePaper(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" size="sm" onClick={() => setShowPaperModal(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Manage Media Categories */}
      {showMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-base font-extrabold text-ink">Manage Media Categories &amp; Prices</h3>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowMediaModal(false)}>✕</Button>
            </div>

            <form onSubmit={handleMediaCatSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <select
                    value={mediaTypeName}
                    onChange={(e) => setMediaTypeN(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold"
                  >
                    <option value="MOVIE">Movie</option>
                    <option value="TV">TV Show</option>
                    <option value="CARTOON">Cartoon</option>
                    <option value="DRAMA">Drama</option>
                    <option value="SONG">Song Bundle</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Default Price (Rs.)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={mediaDefaultPkr}
                    onChange={(e) => setMediaDefaultPkr(e.target.value)}
                    className="mt-1 h-9 font-mono text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Category Name</Label>
                <Input
                  value={mediaCatName}
                  onChange={(e) => setMediaCatName(e.target.value)}
                  placeholder="e.g. Hollywood Movies, 4K Cartoons..."
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editingMediaCat && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingMediaCat(null); setMediaCatName(""); }}>Cancel</Button>
                )}
                <Button type="submit" size="sm">
                  {editingMediaCat ? "Update Category" : "Add Media Category"}
                </Button>
              </div>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto pt-2 border-t border-border">
              {mediaCategories.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-warm px-3 py-2 text-xs">
                  <div>
                    <p className="font-bold text-ink">{m.name} <span className="font-mono text-[10px] text-muted">({m.type})</span></p>
                    <p className="font-mono text-[10px] text-brand-dark font-bold">Price: {formatPkr(m.defaultPricePaisa)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingMediaCat(m); setMediaTypeN(m.type); setMediaCatName(m.name); setMediaDefaultPkr(Math.round(m.defaultPricePaisa / 100).toString()); }}>
                      <Edit className="h-3.5 w-3.5 text-muted" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-danger hover:bg-danger-soft" onClick={() => handleDeleteMediaCat(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" size="sm" onClick={() => setShowMediaModal(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Manage Composing Services */}
      {showComposingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-base font-extrabold text-ink">Manage Composing Services &amp; Prices</h3>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowComposingModal(false)}>✕</Button>
            </div>

            <form onSubmit={handleComposingSave} className="space-y-3">
              <div>
                <Label className="text-xs">Service Name</Label>
                <Input
                  value={composingServiceName}
                  onChange={(e) => setComposingServiceName(e.target.value)}
                  placeholder="e.g. Online Form Filling, Driving License..."
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs">Default Price (Rs.)</Label>
                <Input
                  type="number"
                  min="0"
                  value={composingServicePricePkr}
                  onChange={(e) => setComposingServicePricePkr(e.target.value)}
                  className="h-9 font-mono text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editingComposing && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingComposing(null); setComposingServiceName(""); }}>Cancel</Button>
                )}
                <Button type="submit" size="sm">
                  {editingComposing ? "Update Service" : "Add Service"}
                </Button>
              </div>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto pt-2 border-t border-border">
              {composingServices.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-warm px-3 py-2 text-xs">
                  <div>
                    <p className="font-bold text-ink">{s.name}</p>
                    <p className="font-mono text-[10px] text-brand-dark font-bold">Price: {formatPkr(s.defaultPricePaisa)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingComposing(s); setComposingServiceName(s.name); setComposingServicePricePkr(Math.round(s.defaultPricePaisa / 100).toString()); }}>
                      <Edit className="h-3.5 w-3.5 text-muted" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-danger hover:bg-danger-soft" onClick={() => handleDeleteComposing(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" size="sm" onClick={() => setShowComposingModal(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}