"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  CreditCard,
  FileEdit,
  FileText,
  Film,
  Minus,
  Monitor,
  Pencil,
  Play,
  Plus,
  Printer,
  Receipt,
  Search,
  Settings2,
  ShoppingBag,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { formatPkr, pkrToPaisa } from "@/lib/format/currency";
import {
  completePosSaleAction,
  quickOpenShiftAndDrawerAction,
  type CheckoutCartLine,
} from "@/app/(workspace)/pos/actions";

export interface PosCashSession {
  id: string;
  terminal_code: string;
  terminal_name: string;
  expected_closing_paisa: number;
}

export interface PosCatalogItem {
  id: string;
  kind: "PRODUCT" | "SERVICE";
  code: string;
  name: string;
  price_paisa: number;
  cost_paisa: number;
  category_name: string | null;
  stock_qty: number | null;
}

interface PosTerminalProps {
  openSessions: PosCashSession[];
  items: PosCatalogItem[];
  categories: string[];
}

interface CompletedReceipt {
  saleNumber: string;
  customerName: string;
  subtotalPaisa: number;
  discountPaisa: number;
  totalPaisa: number;
  tenderedPaisa: number;
  changePaisa: number;
  paymentMethod: string;
  createdAt: string;
  lines: CheckoutCartLine[];
}

export interface PaperTypeOption {
  id: string;
  name: string;
  isPassport?: boolean;
  defaultRatePkr?: number;
}

export interface MediaCategoryOption {
  id: string;
  name: string;
  hint: string;
  defaultRatePkr: number;
}

export interface ComposingCategoryOption {
  id: string;
  name: string;
  hint: string;
  defaultRatePkr: number;
}

const DEFAULT_PAPER_TYPES: PaperTypeOption[] = [
  { id: "normal-a4", name: "Normal A4 Paper" },
  { id: "glossy", name: "Glossy Paper", defaultRatePkr: 100 },
  { id: "id-card", name: "ID Card", defaultRatePkr: 50 },
  { id: "pvc", name: "PVC Card", defaultRatePkr: 250 },
  { id: "legal", name: "Legal Paper", defaultRatePkr: 30 },
  { id: "passport", name: "Passport Size", isPassport: true, defaultRatePkr: 200 },
];

const DEFAULT_MEDIA_TYPES: MediaCategoryOption[] = [
  { id: "movie", name: "Movie", hint: "Rs. 20 each", defaultRatePkr: 20 },
  { id: "season", name: "Season / Drama", hint: "Rs. 100 â€“ 200+ (Variable)", defaultRatePkr: 150 },
  { id: "games", name: "Games", hint: "PC / Console Games", defaultRatePkr: 100 },
  { id: "cartoon", name: "Cartoons / Anime", hint: "Custom price each", defaultRatePkr: 100 },
  { id: "songs", name: "Songs / Audio", hint: "Custom pack rate", defaultRatePkr: 50 },
];

const DEFAULT_COMPOSING_TYPES: ComposingCategoryOption[] = [
  { id: "form-filling", name: "Form Filling", hint: "Online / Job / Visa Forms", defaultRatePkr: 100 },
  { id: "cv-resume", name: "CV / Resume", hint: "New CV or Update", defaultRatePkr: 200 },
  { id: "typing", name: "Typing (Eng / Urdu)", hint: "Per page / Application", defaultRatePkr: 50 },
  { id: "poster-design", name: "Poster / Graphic Design", hint: "Flyer / Banner / Social Post", defaultRatePkr: 300 },
  { id: "scan-edit", name: "Scanning / PDF / Edit", hint: "Scan, Merge or ID Edit", defaultRatePkr: 50 },
  { id: "other-composing", name: "Other Composing", hint: "Custom Computer Work", defaultRatePkr: 100 },
];

const STORAGE_KEY_PAPERS = "technoworld_print_paper_types_v1";
const STORAGE_KEY_MEDIA = "technoworld_media_categories_v1";
const STORAGE_KEY_COMPOSING = "technoworld_composing_categories_v1";

export function PosTerminal({
  openSessions,
  items,
  categories,
}: PosTerminalProps) {
  const [selectedSessionId, setSelectedSessionId] = React.useState(
    openSessions[0]?.id ?? ""
  );
  const [activeTab, setActiveTab] = React.useState<"CATALOG" | "PRINTS" | "MEDIA" | "COMPOSING">(
    "CATALOG"
  );
  const [search, setSearch] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("ALL");
  const [cart, setCart] = React.useState<CheckoutCartLine[]>([]);
  const [customerName, setCustomerName] = React.useState("");
  const [discountPkr, setDiscountPkr] = React.useState("0");
  const [paymentMethod, setPaymentMethod] = React.useState<
    "CASH" | "JAZZCASH" | "EASYPAISA" | "BANK_TRANSFER"
  >("CASH");
  const [tenderedPkr, setTenderedPkr] = React.useState("");
  const [receipt, setReceipt] = React.useState<CompletedReceipt | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!selectedSessionId && openSessions.length > 0) {
      setSelectedSessionId(openSessions[0].id);
    }
  }, [openSessions, selectedSessionId]);

  // --- Paper Types State ---
  const [paperTypes, setPaperTypes] =
    React.useState<PaperTypeOption[]>(DEFAULT_PAPER_TYPES);
  const [selectedPaperId, setSelectedPaperId] = React.useState("normal-a4");
  const [managingPapers, setManagingPapers] = React.useState(false);
  const [newPaperName, setNewPaperName] = React.useState("");
  const [newPaperRate, setNewPaperRate] = React.useState("");
  const [newPaperIsPassport, setNewPaperIsPassport] = React.useState(false);
  const [editingPaperId, setEditingPaperId] = React.useState<string | null>(null);
  const [editPaperName, setEditPaperName] = React.useState("");
  const [editPaperRate, setEditPaperRate] = React.useState("");

  // --- Media Categories State (Movies, Seasons, Games, Cartoons, Songs + Add/Edit/Remove) ---
  const [mediaCategories, setMediaCategories] =
    React.useState<MediaCategoryOption[]>(DEFAULT_MEDIA_TYPES);
  const [selectedMediaId, setSelectedMediaId] = React.useState("movie");
  const [managingMedia, setManagingMedia] = React.useState(false);
  const [newMediaName, setNewMediaName] = React.useState("");
  const [newMediaRate, setNewMediaRate] = React.useState("50");
  const [editingMediaId, setEditingMediaId] = React.useState<string | null>(null);
  const [editMediaName, setEditMediaName] = React.useState("");
  const [editMediaRate, setEditMediaRate] = React.useState("");

  // --- Composing Categories State (Form Filling, CVs, Typing, Poster Design + Add/Edit/Remove) ---
  const [composingCategories, setComposingCategories] =
    React.useState<ComposingCategoryOption[]>(DEFAULT_COMPOSING_TYPES);
  const [selectedComposingId, setSelectedComposingId] = React.useState("form-filling");
  const [managingComposing, setManagingComposing] = React.useState(false);
  const [newComposingName, setNewComposingName] = React.useState("");
  const [newComposingRate, setNewComposingRate] = React.useState("100");
  const [editingComposingId, setEditingComposingId] = React.useState<string | null>(null);
  const [editComposingName, setEditComposingName] = React.useState("");
  const [editComposingRate, setEditComposingRate] = React.useState("");

  React.useEffect(() => {
    try {
      const savedPapers = window.localStorage.getItem(STORAGE_KEY_PAPERS);
      if (savedPapers) {
        const parsed = JSON.parse(savedPapers) as PaperTypeOption[];
        if (Array.isArray(parsed) && parsed.length > 0) setPaperTypes(parsed);
      }
      const savedMedia = window.localStorage.getItem(STORAGE_KEY_MEDIA);
      if (savedMedia) {
        const parsed = JSON.parse(savedMedia) as MediaCategoryOption[];
        if (Array.isArray(parsed) && parsed.length > 0) setMediaCategories(parsed);
      }
      const savedComposing = window.localStorage.getItem(STORAGE_KEY_COMPOSING);
      if (savedComposing) {
        const parsed = JSON.parse(savedComposing) as ComposingCategoryOption[];
        if (Array.isArray(parsed) && parsed.length > 0) setComposingCategories(parsed);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  function persistPaperTypes(next: PaperTypeOption[]) {
    setPaperTypes(next);
    try {
      window.localStorage.setItem(STORAGE_KEY_PAPERS, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  function persistMediaCategories(next: MediaCategoryOption[]) {
    setMediaCategories(next);
    try {
      window.localStorage.setItem(STORAGE_KEY_MEDIA, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  function persistComposingCategories(next: ComposingCategoryOption[]) {
    setComposingCategories(next);
    try {
      window.localStorage.setItem(STORAGE_KEY_COMPOSING, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  function handleAddPaperType(e: React.FormEvent) {
    e.preventDefault();
    const clean = newPaperName.trim();
    if (!clean) return;
    const id = `${clean.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()
      .toString()
      .slice(-4)}`;
    const rate = Number(newPaperRate) > 0 ? Number(newPaperRate) : undefined;
    const next = [
      ...paperTypes,
      {
        id,
        name: clean,
        isPassport: newPaperIsPassport,
        defaultRatePkr: rate,
      },
    ];
    persistPaperTypes(next);
    setSelectedPaperId(id);
    setNewPaperName("");
    setNewPaperRate("");
    setNewPaperIsPassport(false);
  }

  function handleSaveEditPaper(id: string) {
    const clean = editPaperName.trim();
    if (!clean) return;
    const rate = Number(editPaperRate) > 0 ? Number(editPaperRate) : undefined;
    const next = paperTypes.map((p) =>
      p.id === id ? { ...p, name: clean, defaultRatePkr: rate } : p
    );
    persistPaperTypes(next);
    setEditingPaperId(null);
  }

  function handleRemovePaper(id: string) {
    if (paperTypes.length <= 1) return;
    const next = paperTypes.filter((p) => p.id !== id);
    persistPaperTypes(next);
    if (selectedPaperId === id) {
      setSelectedPaperId(next[0].id);
    }
  }

  function handleAddMediaCategory(e: React.FormEvent) {
    e.preventDefault();
    const clean = newMediaName.trim();
    if (!clean) return;
    const id = `${clean.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()
      .toString()
      .slice(-4)}`;
    const rate = Math.max(0, Number(newMediaRate) || 50);
    const next = [
      ...mediaCategories,
      {
        id,
        name: clean,
        hint: `Default Rs. ${rate}`,
        defaultRatePkr: rate,
      },
    ];
    persistMediaCategories(next);
    setSelectedMediaId(id);
    setMediaRatePkr(rate);
    setNewMediaName("");
    setNewMediaRate("50");
  }

  function handleSaveEditMedia(id: string) {
    const clean = editMediaName.trim();
    if (!clean) return;
    const rate = Math.max(0, Number(editMediaRate) || 0);
    const next = mediaCategories.map((m) =>
      m.id === id
        ? { ...m, name: clean, hint: `Default Rs. ${rate}`, defaultRatePkr: rate }
        : m
    );
    persistMediaCategories(next);
    if (selectedMediaId === id) {
      setMediaRatePkr(rate);
    }
    setEditingMediaId(null);
  }

  function handleRemoveMedia(id: string) {
    if (mediaCategories.length <= 1) return;
    const next = mediaCategories.filter((m) => m.id !== id);
    persistMediaCategories(next);
    if (selectedMediaId === id) {
      setSelectedMediaId(next[0].id);
      setMediaRatePkr(next[0].defaultRatePkr);
    }
  }

  function handleAddComposingCategory(e: React.FormEvent) {
    e.preventDefault();
    const clean = newComposingName.trim();
    if (!clean) return;
    const id = `${clean.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()
      .toString()
      .slice(-4)}`;
    const rate = Math.max(0, Number(newComposingRate) || 100);
    const next = [
      ...composingCategories,
      {
        id,
        name: clean,
        hint: `Default Rs. ${rate}`,
        defaultRatePkr: rate,
      },
    ];
    persistComposingCategories(next);
    setSelectedComposingId(id);
    setComposingRatePkr(rate);
    setNewComposingName("");
    setNewComposingRate("100");
  }

  function handleSaveEditComposing(id: string) {
    const clean = editComposingName.trim();
    if (!clean) return;
    const rate = Math.max(0, Number(editComposingRate) || 0);
    const next = composingCategories.map((c) =>
      c.id === id
        ? { ...c, name: clean, hint: `Default Rs. ${rate}`, defaultRatePkr: rate }
        : c
    );
    persistComposingCategories(next);
    if (selectedComposingId === id) {
      setComposingRatePkr(rate);
    }
    setEditingComposingId(null);
  }

  function handleRemoveComposing(id: string) {
    if (composingCategories.length <= 1) return;
    const next = composingCategories.filter((c) => c.id !== id);
    persistComposingCategories(next);
    if (selectedComposingId === id) {
      setSelectedComposingId(next[0].id);
      setComposingRatePkr(next[0].defaultRatePkr);
    }
  }

  // --- Dedicated Composing, Form Filling, CVs, Typing & Poster Design State ---
  const [composingNotes, setComposingNotes] = React.useState("");
  const [composingQty, setComposingQty] = React.useState(1);
  const [composingRatePkr, setComposingRatePkr] = React.useState(100);

  const selectedComposing =
    composingCategories.find((c) => c.id === selectedComposingId) ??
    composingCategories[0];

  function selectComposingCategory(cat: ComposingCategoryOption) {
    setSelectedComposingId(cat.id);
    setComposingRatePkr(cat.defaultRatePkr);
  }

  const composingLineTotalPkr =
    Math.max(1, composingQty) * Math.max(0, composingRatePkr);

  function addComposingJobToBill() {
    const qty = Math.max(1, Math.floor(Number(composingQty) || 1));
    const ratePaisa = pkrToPaisa(composingRatePkr);
    const typeName = selectedComposing?.name ?? "Composing";
    const cleanNotes = composingNotes.trim();

    const label = cleanNotes
      ? `${typeName}: ${cleanNotes}`
      : `${typeName} (${qty === 1 ? "1 Job" : `${qty} Jobs`})`;

    setCart((prev) => [
      ...prev,
      {
        kind: "SERVICE",
        refId: null,
        code: `CMP-${(selectedComposing?.id ?? "JOB").toUpperCase().slice(0, 6)}`,
        name: label,
        qty,
        unitPricePaisa: ratePaisa,
        costPricePaisa: 0,
      },
    ]);

    setComposingNotes("");
    setComposingQty(1);
  }
  // --- Dedicated Print & Photocopy Calculator State ---
  const [printColor, setPrintColor] = React.useState<"BW" | "COLOR">("BW");
  const [printSides, setPrintSides] = React.useState<"SINGLE" | "DOUBLE">("SINGLE");
  const [printVolume, setPrintVolume] = React.useState<"ONE" | "MULTIPLE">("ONE");
  const [printQty, setPrintQty] = React.useState(1);
  const [printRatePkr, setPrintRatePkr] = React.useState(20);
  const [passportPhotosCount, setPassportPhotosCount] = React.useState(8);

  const selectedPaper =
    paperTypes.find((p) => p.id === selectedPaperId) ?? paperTypes[0];
  const isPassportSelected = Boolean(
    selectedPaper?.isPassport ||
      selectedPaper?.name.toLowerCase().includes("passport")
  );

  React.useEffect(() => {
    if (isPassportSelected) {
      setPrintColor("COLOR");
      setPrintSides("SINGLE");
      setPrintQty(1);
      setPrintRatePkr(selectedPaper?.defaultRatePkr ?? 200);
      return;
    }

    if (printVolume === "ONE") {
      setPrintQty(1);
    } else if (printQty < 2) {
      setPrintQty(5);
    }

    if (selectedPaper?.defaultRatePkr && selectedPaper.id !== "normal-a4") {
      setPrintRatePkr(selectedPaper.defaultRatePkr);
      return;
    }

    if (printColor === "BW" && printSides === "SINGLE") {
      setPrintRatePkr(printVolume === "ONE" ? 20 : 15);
    } else if (printColor === "BW" && printSides === "DOUBLE") {
      setPrintRatePkr(printVolume === "ONE" ? 25 : 20);
    } else if (printColor === "COLOR" && printSides === "SINGLE") {
      setPrintRatePkr(50);
    } else {
      setPrintRatePkr(100);
    }
  }, [printColor, printSides, printVolume, selectedPaperId]);

  const printLineTotalPkr = Math.max(0, printQty) * Math.max(0, printRatePkr);

  function addPrintJobToBill() {
    const qty = Math.max(1, Math.floor(Number(printQty) || 1));
    const ratePaisa = pkrToPaisa(printRatePkr);
    const paperName = selectedPaper?.name ?? "Normal A4 Paper";

    const label = isPassportSelected
      ? `Passport Size Photos (${passportPhotosCount} Photos) â€¢ ${paperName}`
      : `${printColor === "BW" ? "B&W" : "Color"} Print â€¢ ${paperName} â€¢ ${
          printSides === "SINGLE" ? "1-Sided" : "2-Sided"
        } (${qty === 1 ? "1 Page" : `${qty} Pages`})`;

    setCart((prev) => [
      ...prev,
      {
        kind: "PRINT",
        refId: null,
        code: isPassportSelected
          ? "PRT-PASS"
          : printColor === "BW"
          ? "PRT-BW"
          : "PRT-CLR",
        name: label,
        qty,
        unitPricePaisa: ratePaisa,
        costPricePaisa: 0,
      },
    ]);
  }

  // --- Dedicated Movies, Seasons, Games, Cartoons & Songs State ---
  const [mediaTitle, setMediaTitle] = React.useState("");
  const [mediaQty, setMediaQty] = React.useState(1);
  const [mediaRatePkr, setMediaRatePkr] = React.useState(20);

  const selectedMedia =
    mediaCategories.find((m) => m.id === selectedMediaId) ?? mediaCategories[0];

  function selectMediaCategory(cat: MediaCategoryOption) {
    setSelectedMediaId(cat.id);
    setMediaRatePkr(cat.defaultRatePkr);
  }

  const mediaLineTotalPkr = Math.max(0, mediaQty) * Math.max(0, mediaRatePkr);

  function addMediaJobToBill() {
    const qty = Math.max(1, Math.floor(Number(mediaQty) || 1));
    const ratePaisa = pkrToPaisa(mediaRatePkr);
    const typeName = selectedMedia?.name ?? "Media";
    const cleanTitle = mediaTitle.trim();

    const label = cleanTitle
      ? `${typeName}: ${cleanTitle}`
      : `${typeName} (${qty === 1 ? "1 Item" : `${qty} Items`})`;

    setCart((prev) => [
      ...prev,
      {
        kind: "SERVICE",
        refId: null,
        code: `MED-${(selectedMedia?.id ?? "ITEM").toUpperCase().slice(0, 6)}`,
        name: label,
        qty,
        unitPricePaisa: ratePaisa,
        costPricePaisa: 0,
      },
    ]);

    setMediaTitle("");
    setMediaQty(1);
  }

  function addCatalogItemToCart(item: PosCatalogItem) {
    setCart((prev) => {
      const idx = prev.findIndex(
        (c) => c.refId === item.id && c.kind === item.kind
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        return updated;
      }
      return [
        ...prev,
        {
          kind: item.kind,
          refId: item.id,
          code: item.code,
          name: item.name,
          qty: 1,
          unitPricePaisa: item.price_paisa,
          costPricePaisa: item.cost_paisa,
        },
      ];
    });
  }

  function updateCartQty(index: number, delta: number) {
    setCart((prev) => {
      const updated = [...prev];
      const nextQty = updated[index].qty + delta;
      if (nextQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], qty: nextQty };
      }
      return updated;
    });
  }

  function updateCartRate(index: number, newRatePkr: string) {
    const ratePaisa = pkrToPaisa(newRatePkr);
    setCart((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], unitPricePaisa: ratePaisa };
      return updated;
    });
  }

  const subtotalPaisa = cart.reduce(
    (sum, line) => sum + line.qty * line.unitPricePaisa,
    0
  );
  const discountPaisa = Math.min(subtotalPaisa, pkrToPaisa(discountPkr));
  const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa);
  const tenderedPaisa = tenderedPkr ? pkrToPaisa(tenderedPkr) : totalPaisa;
  const changePaisa = Math.max(0, tenderedPaisa - totalPaisa);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase());
    const matchesCat =
      activeCategory === "ALL" || item.category_name === activeCategory;
    return matchesSearch && matchesCat;
  });

  function handleCheckout() {
    setErrorMsg(null);
    if (!selectedSessionId) {
      setErrorMsg(
        "Click 'Start Shift & Open PC-01' at the top before completing the sale."
      );
      return;
    }
    if (cart.length === 0) {
      setErrorMsg("Add at least one product, service, or print job to the bill.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await completePosSaleAction({
          cashSessionId: selectedSessionId,
          paymentMethod,
          discountPaisa,
          amountTenderedPaisa: tenderedPaisa,
          customerName,
          lines: cart,
        });
        setReceipt(res);
        setCart([]);
        setCustomerName("");
        setDiscountPkr("0");
        setTenderedPkr("");
        window.setTimeout(() => {
          window.print();
        }, 250);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Checkout failed.");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* 80mm Thermal Printer Print-Only Styles (Xprinter XP-80T Edge-to-Edge 72mm) */}
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          html,
          body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-sheet,
          #thermal-receipt-sheet * {
            visibility: visible !important;
          }
          #thermal-receipt-sheet {
            position: fixed !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            padding: 2mm 1mm 5mm 1mm !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: "Segoe UI", Arial, Helvetica, sans-serif !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      {/* Top Status Strip */}
      {openSessions.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning-soft/50 px-4 py-3 transition-all">
          <div className="flex items-center gap-2.5 text-sm">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <div>
              <p className="font-bold text-ink">
                Shift &amp; Cash Drawer Not Started Yet
              </p>
              <p className="text-xs text-muted">
                Click the button on the right to open PC-01 so you can complete sales.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  await quickOpenShiftAndDrawerAction();
                });
              }}
            >
              <Play className="h-3.5 w-3.5" />
              {isPending ? "Opening..." : "Start Shift & Open PC-01"}
            </Button>
            <Link href="/shifts">
              <Button type="button" size="sm" >
                Custom Float
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Monitor className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Active Billing Counter
              </p>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="text-sm font-bold text-ink bg-transparent focus:outline-none"
              >
                {openSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.terminal_code} â€” {s.terminal_name} (Cash in Drawer:{" "}
                    {formatPkr(s.expected_closing_paisa)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Badge variant="success">Counter Open &amp; Ready</Badge>
        </div>
      )}

      {/* Printable 80mm Thermal Receipt + Confirmation Card */}
      {receipt && (
        <Card className="border-success/40 bg-success-soft/40 transition-all duration-300">
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-7 w-7 text-success shrink-0" />
                <div>
                  <p className="font-display text-base font-extrabold text-ink">
                    Sale Completed â€¢ Bill #{receipt.saleNumber} ({receipt.customerName})
                  </p>
                  <p className="text-xs text-muted">
                    Paid{" "}
                    <strong className="font-mono text-ink">
                      {formatPkr(receipt.totalPaisa)}
                    </strong>{" "}
                    ({receipt.paymentMethod}) â€¢ Change Due:{" "}
                    <strong className="font-mono text-success">
                      {formatPkr(receipt.changePaisa)}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={() => window.print()}>
                  <Receipt className="h-4 w-4" />
                  Print Thermal Receipt
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setReceipt(null)}
                >
                  Close
                </Button>
              </div>
            </div>

            <div
              id="thermal-receipt-sheet"
              className="mx-auto w-full max-w-[340px] rounded-xl border border-border bg-white p-4 text-black shadow-sm"
            >
              <div className="text-center border-b-2 border-black pb-2.5">
                <div className="mx-auto mb-1.5 flex items-center justify-center">
                  <svg
                    width="156"
                    height="38"
                    viewBox="0 0 156 38"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mx-auto"
                  >
                    <rect
                      x="1"
                      y="1"
                      width="36"
                      height="36"
                      rx="7"
                      fill="#000000"
                    />
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
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-black">
                  Computers â€¢ Printing â€¢ Accessories
                </p>
                <p className="text-[10px] font-semibold text-black mt-0.5">
                  Rawalpindi â€¢ Sales &amp; Digital Services
                </p>
              </div>

              <div className="py-2 border-b-2 border-black text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold">INVOICE:</span>
                  <span className="font-mono font-extrabold">
                    #{receipt.saleNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">DATE:</span>
                  <span className="font-mono font-semibold">
                    {receipt.createdAt}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">CUSTOMER:</span>
                  <span className="font-extrabold uppercase">
                    {receipt.customerName}
                  </span>
                </div>
              </div>

              <div className="flex justify-between border-b border-black py-1.5 text-[11px] font-black uppercase">
                <span>Description</span>
                <span>Total</span>
              </div>

              <div className="divide-y divide-dashed divide-black border-b-2 border-black">
                {receipt.lines.map((l, idx) => (
                  <div key={idx} className="py-1.5">
                    <div className="flex justify-between items-start gap-2 text-[12px]">
                      <span className="font-extrabold leading-tight flex-1">
                        {l.name}
                      </span>
                      <span className="font-mono font-black whitespace-nowrap">
                        {formatPkr(l.qty * l.unitPricePaisa)}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono font-semibold mt-0.5">
                      Qty: {l.qty} Ã— {formatPkr(l.unitPricePaisa)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="py-2 space-y-1 text-[12px]">
                <div className="flex justify-between font-semibold">
                  <span>Subtotal</span>
                  <span className="font-mono font-bold">
                    {formatPkr(receipt.subtotalPaisa)}
                  </span>
                </div>
                {receipt.discountPaisa > 0 && (
                  <div className="flex justify-between font-semibold">
                    <span>Discount</span>
                    <span className="font-mono font-bold">
                      -{formatPkr(receipt.discountPaisa)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center border-y-2 border-black py-1.5 my-1.5 text-[14px] font-black">
                  <span>GRAND TOTAL</span>
                  <span className="font-mono text-[16px]">
                    {formatPkr(receipt.totalPaisa)}
                  </span>
                </div>

                <div className="flex justify-between text-[11px] font-bold">
                  <span>PAYMENT METHOD</span>
                  <span className="uppercase">{receipt.paymentMethod}</span>
                </div>

                {receipt.paymentMethod === "CASH" && (
                  <>
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Cash Received</span>
                      <span className="font-mono font-bold">
                        {formatPkr(receipt.tenderedPaisa)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] font-extrabold">
                      <span>Change Returned</span>
                      <span className="font-mono font-bold">
                        {formatPkr(receipt.changePaisa)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t-2 border-black pt-2 text-center space-y-0.5">
                <p className="text-[11px] font-black uppercase tracking-wide">
                  Thank You For Visiting Techno World!
                </p>
                <p className="text-[10px] font-semibold">
                  Goods once sold are exchangeable within 3 days with receipt
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* LEFT SIDE (7 Cols) */}
        <div className="space-y-4 lg:col-span-7">
          {/* Interactive 4-Section Switcher */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-2xl border border-border bg-surface p-1.5 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab("CATALOG")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition-all duration-200 active:scale-[0.98] ${
                activeTab === "CATALOG"
                  ? "bg-brand text-white shadow-sm"
                  : "text-muted hover:bg-warm hover:text-ink"
              }`}
            >
              <Box className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Products ({items.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("PRINTS")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition-all duration-200 active:scale-[0.98] ${
                activeTab === "PRINTS"
                  ? "bg-brand text-white shadow-sm"
                  : "text-muted hover:bg-warm hover:text-ink"
              }`}
            >
              <Printer className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Prints</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("MEDIA")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition-all duration-200 active:scale-[0.98] ${
                activeTab === "MEDIA"
                  ? "bg-brand text-white shadow-sm"
                  : "text-muted hover:bg-warm hover:text-ink"
              }`}
            >
              <Film className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Movies &amp; Media</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("COMPOSING")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition-all duration-200 active:scale-[0.98] ${
                activeTab === "COMPOSING"
                  ? "bg-brand text-white shadow-sm"
                  : "text-muted hover:bg-warm hover:text-ink"
              }`}
            >
              <FileEdit className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Composing</span>
            </button>
          </div>

          {/* SECTION A: Products & Shop Services */}
          {activeTab === "CATALOG" && (
            <Card className="transition-all duration-200">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search USB, keyboard, cable, movie copy..."
                      className="h-10 pl-9 text-sm"
                    />
                  </div>

                  <select
                    value={activeCategory}
                    onChange={(e) => setActiveCategory(e.target.value)}
                    className="h-10 rounded-xl border border-border bg-warm px-3 text-xs font-semibold text-ink"
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredItems.length === 0 ? (
                  <div className="rounded-xl border border-border bg-warm/40 p-8 text-center text-xs text-muted">
                    No products or services found. Add them in{" "}
                    <Link
                      href="/inventory"
                      className="font-bold text-brand underline"
                    >
                      Inventory
                    </Link>
                    .
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {filteredItems.map((item) => {
                      const outOfStock =
                        item.kind === "PRODUCT" && (item.stock_qty ?? 0) <= 0;

                      return (
                        <button
                          key={`${item.kind}-${item.id}`}
                          type="button"
                          disabled={outOfStock}
                          onClick={() => addCatalogItemToCart(item)}
                          className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-3.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-brand hover:bg-brand-soft/20 hover:shadow-sm active:scale-[0.97] disabled:opacity-45 disabled:hover:translate-y-0"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="rounded bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-dark">
                                {item.code}
                              </span>
                              {item.kind === "PRODUCT" ? (
                                <span className="text-[11px] font-semibold text-muted">
                                  {item.stock_qty} in stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand">
                                  <Wrench className="h-3 w-3" />
                                  Service
                                </span>
                              )}
                            </div>
                            <p className="line-clamp-2 text-sm font-bold text-ink">
                              {item.name}
                            </p>
                          </div>

                          <p className="mt-3 font-mono text-base font-extrabold text-brand-dark">
                            {formatPkr(item.price_paisa)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* SECTION B: Dedicated Interactive Print & Photocopy Section */}
          {activeTab === "PRINTS" && (
            <Card className="border-brand/30 transition-all duration-200">
              <CardContent className="p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-ink flex items-center gap-2">
                      <Printer className="h-5 w-5 text-brand" />
                      Print &amp; Photocopy Billing
                    </h2>
                    <p className="text-xs text-muted mt-0.5">
                      Pick paper type, color, sides &amp; quantity â€” edit price anytime.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={managingPapers ? "primary" : "secondary"}
                    onClick={() => setManagingPapers((v) => !v)}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    {managingPapers ? "Done Editing Papers" : "Manage Paper Types"}
                  </Button>
                </div>

                {managingPapers && (
                  <div className="rounded-2xl border border-brand/30 bg-brand-soft/30 p-4 space-y-3 transition-all duration-200">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-brand-dark">
                      Add, Edit or Remove Paper Types
                    </p>

                    <form
                      onSubmit={handleAddPaperType}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-end"
                    >
                      <div className="sm:col-span-5">
                        <Label className="text-[11px]">Paper Type Name</Label>
                        <Input
                          value={newPaperName}
                          onChange={(e) => setNewPaperName(e.target.value)}
                          placeholder="e.g. Sticker Sheet, A3 Poster"
                          className="h-9 text-xs"
                          required
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="text-[11px]">
                          Default Rate (Rs.)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={newPaperRate}
                          onChange={(e) => setNewPaperRate(e.target.value)}
                          placeholder="Optional"
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-1.5 pb-2">
                        <input
                          id="isPassportChk"
                          type="checkbox"
                          checked={newPaperIsPassport}
                          onChange={(e) =>
                            setNewPaperIsPassport(e.target.checked)
                          }
                          className="h-4 w-4 accent-brand"
                        />
                        <label
                          htmlFor="isPassportChk"
                          className="text-[11px] font-semibold text-ink"
                        >
                          Photo count?
                        </label>
                      </div>
                      <div className="sm:col-span-2">
                        <Button type="submit" size="sm" className="w-full h-9">
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </Button>
                      </div>
                    </form>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2 border-t border-brand/20">
                      {paperTypes.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2"
                        >
                          {editingPaperId === p.id ? (
                            <div className="flex flex-1 items-center gap-1.5">
                              <Input
                                value={editPaperName}
                                onChange={(e) =>
                                  setEditPaperName(e.target.value)
                                }
                                className="h-7 text-xs"
                              />
                              <Input
                                type="number"
                                min="0"
                                value={editPaperRate}
                                onChange={(e) =>
                                  setEditPaperRate(e.target.value)
                                }
                                placeholder="Rs."
                                className="h-7 w-16 text-xs"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleSaveEditPaper(p.id)}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div>
                                <p className="text-xs font-bold text-ink">
                                  {p.name}
                                </p>
                                <p className="text-[10px] text-muted">
                                  {p.defaultRatePkr
                                    ? `Default Rs. ${p.defaultRatePkr}`
                                    : "Standard B&W / Color rates"}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPaperId(p.id);
                                    setEditPaperName(p.name);
                                    setEditPaperRate(
                                      p.defaultRatePkr
                                        ? String(p.defaultRatePkr)
                                        : ""
                                    );
                                  }}
                                  className="rounded p-1 text-muted hover:bg-warm hover:text-ink"
                                  title="Edit Paper Type"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                {paperTypes.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePaper(p.id)}
                                    className="rounded p-1 text-muted hover:bg-danger-soft hover:text-danger"
                                    title="Remove Paper Type"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted">
                    1. Choose Paper / Card Type
                  </Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {paperTypes.map((paper) => {
                      const active = paper.id === selectedPaper?.id;
                      return (
                        <button
                          key={paper.id}
                          type="button"
                          onClick={() => setSelectedPaperId(paper.id)}
                          className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-left transition-all duration-150 active:scale-[0.97] ${
                            active
                              ? "border-brand bg-brand text-white shadow-sm"
                              : "border-border bg-surface text-ink hover:border-brand/50 hover:bg-warm"
                          }`}
                        >
                          <FileText
                            className={`h-4 w-4 shrink-0 ${
                              active ? "text-white" : "text-brand"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-extrabold">
                              {paper.name}
                            </p>
                            {paper.defaultRatePkr && (
                              <p
                                className={`text-[10px] ${
                                  active ? "text-white/85" : "text-muted"
                                }`}
                              >
                                Rs. {paper.defaultRatePkr}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isPassportSelected ? (
                  <div className="rounded-2xl border-2 border-brand/40 bg-brand-soft/30 p-4 space-y-3 transition-all duration-200">
                    <Label className="text-xs font-extrabold uppercase tracking-wider text-brand-dark">
                      How Many Passport Size Photos Needed?
                    </Label>
                    <div className="grid grid-cols-5 gap-2">
                      {[4, 6, 8, 12, 16].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setPassportPhotosCount(cnt)}
                          className={`rounded-xl border-2 py-2.5 text-center font-mono text-sm font-extrabold transition-all active:scale-95 ${
                            passportPhotosCount === cnt
                              ? "border-brand bg-brand text-white shadow-xs"
                              : "border-border bg-surface text-ink hover:bg-warm"
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-xs font-semibold text-muted">
                        Or enter exact photo count:
                      </span>
                      <Input
                        type="number"
                        min="1"
                        value={passportPhotosCount}
                        onChange={(e) =>
                          setPassportPhotosCount(
                            Math.max(1, Number(e.target.value) || 1)
                          )
                        }
                        className="h-9 w-24 font-mono text-sm font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted">
                        2. Black &amp; White or Color?
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPrintColor("BW")}
                          className={`rounded-2xl border-2 p-3 text-left transition-all duration-150 active:scale-[0.98] ${
                            printColor === "BW"
                              ? "border-ink bg-ink text-white shadow-sm"
                              : "border-border bg-surface text-ink hover:bg-warm"
                          }`}
                        >
                          <p className="text-sm font-extrabold">
                            Black &amp; White
                          </p>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              printColor === "BW"
                                ? "text-white/80"
                                : "text-muted"
                            }`}
                          >
                            Single Rs. 20 â€¢ Multiple Rs. 15
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPrintColor("COLOR")}
                          className={`rounded-2xl border-2 p-3 text-left transition-all duration-150 active:scale-[0.98] ${
                            printColor === "COLOR"
                              ? "border-brand bg-brand text-white shadow-sm"
                              : "border-border bg-surface text-ink hover:bg-warm"
                          }`}
                        >
                          <p className="text-sm font-extrabold">Color Print</p>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              printColor === "COLOR"
                                ? "text-white/90"
                                : "text-muted"
                            }`}
                          >
                            1-Side Rs. 50 â€¢ 2-Side Rs. 100
                          </p>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted">
                          3. Sides
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPrintSides("SINGLE")}
                            className={`rounded-xl border-2 py-2.5 text-xs font-bold transition-all active:scale-95 ${
                              printSides === "SINGLE"
                                ? "border-brand bg-brand-soft text-brand-dark"
                                : "border-border bg-surface text-ink hover:bg-warm"
                            }`}
                          >
                            1-Sided
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintSides("DOUBLE")}
                            className={`rounded-xl border-2 py-2.5 text-xs font-bold transition-all active:scale-95 ${
                              printSides === "DOUBLE"
                                ? "border-brand bg-brand-soft text-brand-dark"
                                : "border-border bg-surface text-ink hover:bg-warm"
                            }`}
                          >
                            2-Sided
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted">
                          4. Singular or Multiple?
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPrintVolume("ONE")}
                            className={`rounded-xl border-2 py-2.5 text-xs font-bold transition-all active:scale-95 ${
                              printVolume === "ONE"
                                ? "border-brand bg-brand-soft text-brand-dark"
                                : "border-border bg-surface text-ink hover:bg-warm"
                            }`}
                          >
                            Singular (1)
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintVolume("MULTIPLE")}
                            className={`rounded-xl border-2 py-2.5 text-xs font-bold transition-all active:scale-95 ${
                              printVolume === "MULTIPLE"
                                ? "border-brand bg-brand-soft text-brand-dark"
                                : "border-border bg-surface text-ink hover:bg-warm"
                            }`}
                          >
                            Multiple
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="rounded-2xl border border-border bg-warm/60 p-4 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="printQty" className="text-xs">
                        {isPassportSelected
                          ? "Sets / Sheets (Qty)"
                          : "Number of Prints (Qty)"}
                      </Label>
                      <Input
                        id="printQty"
                        type="number"
                        min="1"
                        value={printQty}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          setPrintQty(val);
                          if (val > 1 && printVolume === "ONE") {
                            setPrintVolume("MULTIPLE");
                          }
                        }}
                        className="h-11 font-mono text-base font-extrabold"
                      />
                    </div>

                    <div>
                      <Label htmlFor="printRate" className="text-xs">
                        {isPassportSelected
                          ? "Price per Set (Rs.)"
                          : "Selling Price Each (Rs.)"}
                      </Label>
                      <Input
                        id="printRate"
                        type="number"
                        min="0"
                        value={printRatePkr}
                        onChange={(e) =>
                          setPrintRatePkr(
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="h-11 font-mono text-base font-extrabold"
                      />
                    </div>

                    <div className="rounded-xl bg-surface border border-border p-2.5 flex flex-col justify-center text-right">
                      <span className="text-[11px] font-semibold text-muted">
                        Print Total
                      </span>
                      <span className="font-mono text-xl font-extrabold text-brand-dark transition-all">
                        Rs. {printLineTotalPkr.toLocaleString("en-PK")}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={addPrintJobToBill}
                    className="h-12 w-full text-base transition-transform active:scale-[0.99]"
                  >
                    <Plus className="h-5 w-5" />
                    Add Print to Bill â€¢ Rs.{" "}
                    {printLineTotalPkr.toLocaleString("en-PK")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION C: Dedicated Movies, Seasons, Games, Cartoons & Songs Section (With Manage Categories) */}
          {activeTab === "MEDIA" && (
            <Card className="border-brand/30 transition-all duration-200">
              <CardContent className="p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-ink flex items-center gap-2">
                      <Film className="h-5 w-5 text-brand" />
                      Movies, Seasons, Games &amp; Songs
                    </h2>
                    <p className="text-xs text-muted mt-0.5">
                      Pick category, set quantity &amp; price each â€” add multiple seasons or games at different prices.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={managingMedia ? "primary" : "secondary"}
                    onClick={() => setManagingMedia((v) => !v)}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    {managingMedia ? "Done Editing" : "Manage Categories"}
                  </Button>
                </div>

                {/* Inline Add / Edit / Remove Media Categories Drawer */}
                {managingMedia && (
                  <div className="rounded-2xl border border-brand/30 bg-brand-soft/30 p-4 space-y-3 transition-all duration-200">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-brand-dark">
                      Add, Edit or Remove Media Categories
                    </p>

                    <form
                      onSubmit={handleAddMediaCategory}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-end"
                    >
                      <div className="sm:col-span-6">
                        <Label className="text-[11px]">Category Name</Label>
                        <Input
                          value={newMediaName}
                          onChange={(e) => setNewMediaName(e.target.value)}
                          placeholder="e.g. PS4 Games, Software, Wedding Video"
                          className="h-9 text-xs"
                          required
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="text-[11px]">Default Rate (Rs.)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={newMediaRate}
                          onChange={(e) => setNewMediaRate(e.target.value)}
                          className="h-9 text-xs"
                          required
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Button type="submit" size="sm" className="w-full h-9">
                          <Plus className="h-3.5 w-3.5" />
                          Add Category
                        </Button>
                      </div>
                    </form>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2 border-t border-brand/20">
                      {mediaCategories.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2"
                        >
                          {editingMediaId === cat.id ? (
                            <div className="flex flex-1 items-center gap-1.5">
                              <Input
                                value={editMediaName}
                                onChange={(e) =>
                                  setEditMediaName(e.target.value)
                                }
                                className="h-7 text-xs"
                              />
                              <Input
                                type="number"
                                min="0"
                                value={editMediaRate}
                                onChange={(e) =>
                                  setEditMediaRate(e.target.value)
                                }
                                placeholder="Rs."
                                className="h-7 w-16 text-xs"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleSaveEditMedia(cat.id)}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div>
                                <p className="text-xs font-bold text-ink">
                                  {cat.name}
                                </p>
                                <p className="text-[10px] text-muted">
                                  Default Rs. {cat.defaultRatePkr}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMediaId(cat.id);
                                    setEditMediaName(cat.name);
                                    setEditMediaRate(String(cat.defaultRatePkr));
                                  }}
                                  className="rounded p-1 text-muted hover:bg-warm hover:text-ink"
                                  title="Edit Category"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                {mediaCategories.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMedia(cat.id)}
                                    className="rounded p-1 text-muted hover:bg-danger-soft hover:text-danger"
                                    title="Remove Category"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 1: Pick Media Category */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted">
                    1. Choose Media Category
                  </Label>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {mediaCategories.map((cat) => {
                      const active = cat.id === selectedMedia?.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => selectMediaCategory(cat)}
                          className={`rounded-2xl border-2 p-3 text-left transition-all duration-150 active:scale-[0.97] ${
                            active
                              ? "border-brand bg-brand text-white shadow-sm"
                              : "border-border bg-surface text-ink hover:border-brand/50 hover:bg-warm"
                          }`}
                        >
                          <p className="text-sm font-extrabold">{cat.name}</p>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              active ? "text-white/90" : "text-muted"
                            }`}
                          >
                            {cat.hint}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Optional Title / Label */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="mediaTitleInput"
                    className="text-xs font-bold uppercase tracking-wider text-muted"
                  >
                    2. Name / Details (Optional)
                  </Label>
                  <Input
                    id="mediaTitleInput"
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    placeholder="e.g. GTA V, Stranger Things S4, 5 Movies, Punjabi Songs..."
                    className="h-10 text-sm"
                  />
                </div>

                {/* Step 3: Quantity, Price Each (Quick Presets + Custom Input) & Live Total */}
                <div className="rounded-2xl border border-border bg-warm/60 p-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-muted mr-1">
                      Quick Rate:
                    </span>
                    {[20, 50, 100, 150, 200, 250, 300].map((presetRs) => (
                      <button
                        key={presetRs}
                        type="button"
                        onClick={() => setMediaRatePkr(presetRs)}
                        className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-bold transition active:scale-95 ${
                          mediaRatePkr === presetRs
                            ? "border-brand bg-brand text-white"
                            : "border-border bg-surface text-ink hover:bg-warm"
                        }`}
                      >
                        Rs. {presetRs}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="mediaQty" className="text-xs">
                        Quantity
                      </Label>
                      <Input
                        id="mediaQty"
                        type="number"
                        min="1"
                        value={mediaQty}
                        onChange={(e) =>
                          setMediaQty(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="h-11 font-mono text-base font-extrabold"
                      />
                    </div>

                    <div>
                      <Label htmlFor="mediaRate" className="text-xs">
                        Price Each (Rs.)
                      </Label>
                      <Input
                        id="mediaRate"
                        type="number"
                        min="0"
                        value={mediaRatePkr}
                        onChange={(e) =>
                          setMediaRatePkr(
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="h-11 font-mono text-base font-extrabold"
                      />
                    </div>

                    <div className="rounded-xl bg-surface border border-border p-2.5 flex flex-col justify-center text-right">
                      <span className="text-[11px] font-semibold text-muted">
                        Media Total
                      </span>
                      <span className="font-mono text-xl font-extrabold text-brand-dark">
                        Rs. {mediaLineTotalPkr.toLocaleString("en-PK")}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={addMediaJobToBill}
                    className="h-12 w-full text-base transition-transform active:scale-[0.99]"
                  >
                    <Plus className="h-5 w-5" />
                    Add {selectedMedia?.name ?? "Media"} to Bill â€¢ Rs.{" "}
                    {mediaLineTotalPkr.toLocaleString("en-PK")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION D: Dedicated Composing, Form Filling, CVs, Typing & Poster Design Section */}
          {activeTab === "COMPOSING" && (
            <Card className="border-brand/30 transition-all duration-200">
              <CardContent className="p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-ink flex items-center gap-2">
                      <FileEdit className="h-5 w-5 text-brand" />
                      Composing, Form Filling &amp; Design
                    </h2>
                    <p className="text-xs text-muted mt-0.5">
                      Select task type, enter custom rate or details, and add straight to the customer bill.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={managingComposing ? "primary" : "secondary"}
                    onClick={() => setManagingComposing((v) => !v)}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    {managingComposing ? "Done Editing" : "Manage Categories"}
                  </Button>
                </div>

                {/* Inline Add / Edit / Remove Composing Categories Drawer */}
                {managingComposing && (
                  <div className="rounded-2xl border border-brand/30 bg-brand-soft/30 p-4 space-y-3 transition-all duration-200">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-brand-dark">
                      Add, Edit or Remove Composing Categories
                    </p>

                    <form
                      onSubmit={handleAddComposingCategory}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-end"
                    >
                      <div className="sm:col-span-6">
                        <Label className="text-[11px]">Category Name</Label>
                        <Input
                          value={newComposingName}
                          onChange={(e) => setNewComposingName(e.target.value)}
                          placeholder="e.g. Stamp Paper, Visa File, Logo Design"
                          className="h-9 text-xs"
                          required
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="text-[11px]">Default Rate (Rs.)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={newComposingRate}
                          onChange={(e) => setNewComposingRate(e.target.value)}
                          className="h-9 text-xs"
                          required
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Button type="submit" size="sm" className="w-full h-9">
                          <Plus className="h-3.5 w-3.5" />
                          Add Category
                        </Button>
                      </div>
                    </form>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2 border-t border-brand/20">
                      {composingCategories.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2"
                        >
                          {editingComposingId === cat.id ? (
                            <div className="flex flex-1 items-center gap-1.5">
                              <Input
                                value={editComposingName}
                                onChange={(e) =>
                                  setEditComposingName(e.target.value)
                                }
                                className="h-7 text-xs"
                              />
                              <Input
                                type="number"
                                min="0"
                                value={editComposingRate}
                                onChange={(e) =>
                                  setEditComposingRate(e.target.value)
                                }
                                placeholder="Rs."
                                className="h-7 w-16 text-xs"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleSaveEditComposing(cat.id)}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div>
                                <p className="text-xs font-bold text-ink">
                                  {cat.name}
                                </p>
                                <p className="text-[10px] text-muted">
                                  Default Rs. {cat.defaultRatePkr}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingComposingId(cat.id);
                                    setEditComposingName(cat.name);
                                    setEditComposingRate(String(cat.defaultRatePkr));
                                  }}
                                  className="rounded p-1 text-muted hover:bg-warm hover:text-ink"
                                  title="Edit Category"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                {composingCategories.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveComposing(cat.id)}
                                    className="rounded p-1 text-muted hover:bg-danger-soft hover:text-danger"
                                    title="Remove Category"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 1: Pick Composing Category */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted">
                    1. Choose Composing Service
                  </Label>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {composingCategories.map((cat) => {
                      const active = cat.id === selectedComposing?.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => selectComposingCategory(cat)}
                          className={`rounded-2xl border-2 p-3 text-left transition-all duration-150 active:scale-[0.97] ${
                            active
                              ? "border-brand bg-brand text-white shadow-sm"
                              : "border-border bg-surface text-ink hover:border-brand/50 hover:bg-warm"
                          }`}
                        >
                          <p className="text-sm font-extrabold">{cat.name}</p>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              active ? "text-white/90" : "text-muted"
                            }`}
                          >
                            {cat.hint}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Optional Job Description */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="composingNotesInput"
                    className="text-xs font-bold uppercase tracking-wider text-muted"
                  >
                    2. Work Details / Note (Optional)
                  </Label>
                  <Input
                    id="composingNotesInput"
                    value={composingNotes}
                    onChange={(e) => setComposingNotes(e.target.value)}
                    placeholder="e.g. Bilal CV, University Admission Form, 3-Page Urdu Typing, Shop Poster..."
                    className="h-10 text-sm"
                  />
                </div>

                {/* Step 3: Quantity, Custom Price & Live Total */}
                <div className="rounded-2xl border border-border bg-warm/60 p-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-muted mr-1">
                      Quick Rate:
                    </span>
                    {[50, 100, 150, 200, 300, 500, 1000].map((presetRs) => (
                      <button
                        key={presetRs}
                        type="button"
                        onClick={() => setComposingRatePkr(presetRs)}
                        className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-bold transition active:scale-95 ${
                          composingRatePkr === presetRs
                            ? "border-brand bg-brand text-white"
                            : "border-border bg-surface text-ink hover:bg-warm"
                        }`}
                      >
                        Rs. {presetRs}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="composingQty" className="text-xs">
                        Quantity / Pages
                      </Label>
                      <Input
                        id="composingQty"
                        type="number"
                        min="1"
                        value={composingQty}
                        onChange={(e) =>
                          setComposingQty(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="h-11 font-mono text-base font-extrabold"
                      />
                    </div>

                    <div>
                      <Label htmlFor="composingRate" className="text-xs">
                        Price Each (Rs.)
                      </Label>
                      <Input
                        id="composingRate"
                        type="number"
                        min="0"
                        value={composingRatePkr}
                        onChange={(e) =>
                          setComposingRatePkr(
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="h-11 font-mono text-base font-extrabold"
                      />
                    </div>

                    <div className="rounded-xl bg-surface border border-border p-2.5 flex flex-col justify-center text-right">
                      <span className="text-[11px] font-semibold text-muted">
                        Composing Total
                      </span>
                      <span className="font-mono text-xl font-extrabold text-brand-dark">
                        Rs. {composingLineTotalPkr.toLocaleString("en-PK")}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={addComposingJobToBill}
                    className="h-12 w-full text-base transition-transform active:scale-[0.99]"
                  >
                    <Plus className="h-5 w-5" />
                    Add {selectedComposing?.name ?? "Composing"} to Bill â€¢ Rs.{" "}
                    {composingLineTotalPkr.toLocaleString("en-PK")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT SIDE (5 Cols): Ultra-Compact, Minimal, Zero-Scroll Customer Bill */}
        <div className="lg:col-span-5">
          <Card className="sticky top-16">
            <CardContent className="p-3.5 space-y-2.5">
              {/* Compact Header + Customer Name Inline */}
              <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                <div className="flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 text-brand" />
                  <h2 className="font-display text-sm font-extrabold text-ink">
                    Bill ({cart.length})
                  </h2>
                </div>

                <div className="relative flex-1 max-w-[200px]">
                  <User className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer Name..."
                    className="h-7 pl-7 pr-2 text-xs"
                  />
                </div>

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-[11px] font-semibold text-danger hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Minimal Single-Row Bill Items (No Scrolling Needed for Normal Orders) */}
              {cart.length === 0 ? (
                <div className="rounded-xl bg-warm/50 py-6 text-center text-xs text-muted">
                  Tap any product, print, or media on the left to add.
                </div>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border bg-warm/30">
                  {cart.map((line, index) => (
                    <div
                      key={`${line.code}-${index}`}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs"
                    >
                      {/* Item Title */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-ink leading-tight">
                          {line.name}
                        </p>
                      </div>

                      {/* Compact Qty Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQty(index, -1)}
                          className="flex h-5 w-5 items-center justify-center rounded border border-border bg-surface text-ink hover:bg-warm active:scale-90"
                        >
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <span className="w-5 text-center font-mono text-[11px] font-bold">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(index, 1)}
                          className="flex h-5 w-5 items-center justify-center rounded border border-border bg-surface text-ink hover:bg-warm active:scale-90"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      </div>

                      {/* Compact Editable Unit Price */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <span className="text-[10px] text-muted">@</span>
                        <input
                          type="number"
                          min="0"
                          value={Math.round(line.unitPricePaisa / 100)}
                          onChange={(e) =>
                            updateCartRate(index, e.target.value)
                          }
                          className="h-6 w-12 rounded border border-border bg-surface px-1 text-right font-mono text-[11px] font-bold text-ink"
                        />
                      </div>

                      {/* Line Total + Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="w-16 text-right font-mono text-xs font-extrabold text-ink">
                          {formatPkr(line.qty * line.unitPricePaisa)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(index, -line.qty)}
                          className="text-muted hover:text-danger"
                          title="Remove"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Compact Totals, Discount & Payment Controls */}
              <div className="space-y-2 border-t border-border pt-2">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted">Discount (Rs.):</span>
                    <Input
                      type="number"
                      min="0"
                      value={discountPkr}
                      onChange={(e) => setDiscountPkr(e.target.value)}
                      className="h-7 w-16 text-right font-mono text-xs"
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-muted mr-1.5">Subtotal:</span>
                    <span className="font-mono font-bold text-ink">
                      {formatPkr(subtotalPaisa)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-brand-soft px-3 py-2">
                  <span className="font-display text-xs font-extrabold uppercase tracking-wide text-ink">
                    Grand Total
                  </span>
                  <span className="font-mono text-lg font-extrabold text-brand-dark">
                    {formatPkr(totalPaisa)}
                  </span>
                </div>

                {/* Payment Method Pills */}
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      { id: "CASH", label: "Cash" },
                      { id: "JAZZCASH", label: "JazzCash" },
                      { id: "EASYPAISA", label: "EasyPaisa" },
                      { id: "BANK_TRANSFER", label: "Bank" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`rounded-lg border py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
                        paymentMethod === m.id
                          ? "border-brand bg-brand text-white shadow-xs"
                          : "border-border bg-surface text-ink hover:bg-warm"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {paymentMethod === "CASH" && totalPaisa > 0 && (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-warm px-2.5 py-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-muted">
                        Cash Given:
                      </span>
                      <Input
                        type="number"
                        min="0"
                        placeholder={String(Math.round(totalPaisa / 100))}
                        value={tenderedPkr}
                        onChange={(e) => setTenderedPkr(e.target.value)}
                        className="h-7 w-20 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-muted mr-1">Change:</span>
                      <strong className="font-mono text-xs font-extrabold text-success">
                        {formatPkr(changePaisa)}
                      </strong>
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <p className="rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs font-semibold text-danger">
                    {errorMsg}
                  </p>
                )}

                <Button
                  type="button"
                  disabled={isPending || cart.length === 0}
                  onClick={handleCheckout}
                  className="h-10 w-full text-sm transition-transform active:scale-[0.99]"
                >
                  <CreditCard className="h-4 w-4" />
                  {isPending
                    ? "Completing..."
                    : `Complete Sale â€¢ ${formatPkr(totalPaisa)}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}