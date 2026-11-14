"use client";

import * as React from "react";
import {
  AlertTriangle,
  Boxes,
  Edit,
  FolderCog,
  Plus,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { formatPkr, pkrToPaisa } from "@/lib/format/currency";
import type { InventoryItemPayload } from "@/app/(workspace)/inventory/actions";

export interface CategoryRecord {
  id: string;
  name: string;
}

export interface InventoryItemRecord {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  stock_quantity: number;
  cost_price_paisa: number;
  retail_price_paisa: number;
  min_stock_alert: number;
  unit: string;
  notes: string | null;
}

interface InventoryManagerProps {
  categories: CategoryRecord[];
  items: InventoryItemRecord[];
  onCreateCategory: (name: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onCreateItem: (payload: InventoryItemPayload) => Promise<void>;
  onUpdateItem: (id: string, payload: InventoryItemPayload) => Promise<void>;
  onAdjustStock: (id: string, delta: number) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export function InventoryManager({
  categories,
  items,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onCreateItem,
  onUpdateItem,
  onAdjustStock,
  onDeleteItem,
}: InventoryManagerProps) {
  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("ALL");

  // Modals
  const [showProductModal, setShowProductModal] = React.useState(false);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<InventoryItemRecord | null>(null);

  // Category Form State
  const [newCatName, setNewCatName] = React.useState("");
  const [editingCat, setEditingCat] = React.useState<CategoryRecord | null>(null);

  // Product Form States
  const [name, setName] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [category, setCategory] = React.useState(categories[0]?.name || "General");
  const [stockQty, setStockQty] = React.useState("10");
  const [costPkr, setCostPkr] = React.useState("1000");
  const [retailPkr, setRetailPkr] = React.useState("1500");
  const [minAlert, setMinAlert] = React.useState("5");
  const [unit, setUnit] = React.useState("pcs");
  const [notes, setNotes] = React.useState("");

  const [feedback, setFeedback] = React.useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const filterCategories = ["ALL", ...Array.from(new Set(categories.map((c) => c.name)))];

  const filteredItems = items.filter((item) => {
    if (selectedCategory !== "ALL" && item.category !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !(item.sku ?? "").toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const totalItemsCount = items.reduce((acc, i) => acc + i.stock_quantity, 0);
  const lowStockCount = items.filter((i) => i.stock_quantity <= i.min_stock_alert).length;
  const totalValuation = items.reduce((acc, i) => acc + i.stock_quantity * i.retail_price_paisa, 0);

  function openAddModal() {
    setName("");
    setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setCategory(categories[0]?.name || "General");
    setStockQty("10");
    setCostPkr("1000");
    setRetailPkr("1500");
    setMinAlert("5");
    setUnit("pcs");
    setNotes("");
    setEditingItem(null);
    setShowProductModal(true);
  }

  function openEditModal(item: InventoryItemRecord) {
    setEditingItem(item);
    setName(item.name);
    setSku(item.sku || "");
    setCategory(item.category);
    setStockQty(item.stock_quantity.toString());
    setCostPkr(Math.round(item.cost_price_paisa / 100).toString());
    setRetailPkr(Math.round(item.retail_price_paisa / 100).toString());
    setMinAlert(item.min_stock_alert.toString());
    setUnit(item.unit);
    setNotes(item.notes || "");
    setShowProductModal(true);
  }

  function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        const payload: InventoryItemPayload = {
          name,
          sku,
          category,
          stockQuantity: Number(stockQty) || 0,
          costPricePaisa: pkrToPaisa(costPkr),
          retailPricePaisa: pkrToPaisa(retailPkr),
          minStockAlert: Number(minAlert) || 5,
          unit,
          notes,
        };

        if (editingItem) {
          await onUpdateItem(editingItem.id, payload);
          setFeedback({ type: "ok", text: "Product updated successfully!" });
        } else {
          await onCreateItem(payload);
          setFeedback({ type: "ok", text: "Product added to inventory & POS counter successfully!" });
        }
        setShowProductModal(false);
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to save product." });
      }
    });
  }

  function handleDeleteProduct(id: string) {
    if (!confirm("Are you sure you want to delete this physical product?")) return;
    startTransition(async () => {
      try {
        await onDeleteItem(id);
        setShowProductModal(false);
        setFeedback({ type: "ok", text: "Product removed from inventory." });
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to delete item." });
      }
    });
  }

  function handleAdjust(id: string, delta: number) {
    startTransition(async () => {
      try {
        await onAdjustStock(id, delta);
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Stock adjustment failed." });
      }
    });
  }

  function handleCategorySave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        if (editingCat) {
          await onUpdateCategory(editingCat.id, newCatName);
          setEditingCat(null);
        } else {
          await onCreateCategory(newCatName);
        }
        setNewCatName("");
        setFeedback({ type: "ok", text: "Category saved successfully!" });
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to save category." });
      }
    });
  }

  function handleDeleteCategory(id: string) {
    if (!confirm("Delete this category? Products in this category will remain.")) return;
    startTransition(async () => {
      try {
        await onDeleteCategory(id);
        setFeedback({ type: "ok", text: "Category deleted." });
      } catch (err) {
        setFeedback({ type: "err", text: err instanceof Error ? err.message : "Failed to delete category." });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-brand/30 bg-brand-soft/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted">Total Stock Units</span>
              <Boxes className="h-4 w-4 text-brand" />
            </div>
            <p className="mt-1 font-mono text-xl font-extrabold text-ink">{totalItemsCount} units</p>
            <p className="mt-0.5 text-[10px] text-muted">{items.length} physical products</p>
          </CardContent>
        </Card>

        <Card className={`border-warning/30 ${lowStockCount > 0 ? "bg-warning-soft/10" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-warning">Low Stock Alerts</span>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
            <p className="mt-1 font-mono text-xl font-extrabold text-warning">{lowStockCount}</p>
            <p className="mt-0.5 text-[10px] text-muted">Items at or below minimum threshold</p>
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-success-soft/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-success">Total Inventory Value</span>
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <p className="mt-1 font-mono text-xl font-extrabold text-success">{formatPkr(totalValuation)}</p>
            <p className="mt-0.5 text-[10px] text-muted">Retail asset valuation</p>
          </CardContent>
        </Card>
      </div>

      {feedback && (
        <div className={`rounded-2xl px-4 py-3 text-xs font-semibold ${feedback.type === "ok" ? "bg-success-soft text-success border border-success/30" : "bg-danger-soft text-danger border border-danger/30"}`}>
          {feedback.text}
        </div>
      )}

      {/* Controls & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name or SKU..."
              className="h-9 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" size="sm"  onClick={() => setShowCategoryModal(true)}>
            <FolderCog className="h-4 w-4 mr-1" /> Manage Categories ({categories.length})
          </Button>
          <Button type="button" size="sm" onClick={openAddModal}>
            <Plus className="h-4 w-4 mr-1" /> Add Product
          </Button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-1.5">
        {filterCategories.map((cat, idx) => (
          <button
            key={`${cat}-${idx}`}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${selectedCategory === cat ? "bg-brand text-white shadow-xs" : "border border-border bg-surface text-muted hover:text-ink"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Compact Professional Inventory Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-warm/50 text-muted">
                <th className="p-3 font-bold">Product Name &amp; SKU</th>
                <th className="p-3 font-bold">Category</th>
                <th className="p-3 font-bold">Stock Qty</th>
                <th className="p-3 font-bold">Cost Price</th>
                <th className="p-3 font-bold">Retail Price</th>
                <th className="p-3 font-bold">Status</th>
                <th className="p-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted">No physical products found.</td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isLow = item.stock_quantity <= item.min_stock_alert;

                  return (
                    <tr key={item.id} className="hover:bg-warm/20 transition">
                      <td className="p-3">
                        <p className="font-bold text-ink">{item.name}</p>
                        <p className="font-mono text-[10px] text-muted">{item.sku || "NO SKU"}</p>
                      </td>
                      <td className="p-3">
                        <span className="rounded-lg bg-surface border border-border px-2 py-1 font-semibold text-ink">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-extrabold text-ink">
                        {item.stock_quantity} {item.unit}
                      </td>
                      <td className="p-3 font-mono text-muted">{formatPkr(item.cost_price_paisa)}</td>
                      <td className="p-3 font-mono font-bold text-brand-dark">{formatPkr(item.retail_price_paisa)}</td>
                      <td className="p-3">
                        <Badge variant={isLow ? "warning" : "success"}>
                          {isLow ? "Low Stock" : "In Stock"}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button type="button" size="sm"  className="h-7 w-7 p-0 text-xs" onClick={() => handleAdjust(item.id, -1)} title="Decrease Stock">
                            -
                          </Button>
                          <Button type="button" size="sm"  className="h-7 w-7 p-0 text-xs" onClick={() => handleAdjust(item.id, 1)} title="Increase Stock">
                            +
                          </Button>
                          <Button type="button" size="sm"  className="h-7 px-2.5 text-xs font-semibold" onClick={() => openEditModal(item)} title="Edit Product">
                            <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          <Button type="button" size="sm"  className="h-7 w-7 p-0 text-danger hover:bg-danger-soft border-danger/30" onClick={() => handleDeleteProduct(item.id)} title="Delete Product">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* MODAL: Manage Categories */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-base font-extrabold text-ink">Manage Product Categories</h3>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowCategoryModal(false)}>âœ•</Button>
            </div>

            <form onSubmit={handleCategorySave} className="flex gap-2">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder={editingCat ? "Rename category..." : "New category name (e.g. Cables)..."}
                className="h-9 text-xs flex-1"
                required
              />
              <Button type="submit" size="sm">
                {editingCat ? "Update" : "Add"}
              </Button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between rounded-xl border border-border bg-warm px-3 py-2 text-xs">
                  <span className="font-bold text-ink">{cat.name}</span>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingCat(cat); setNewCatName(cat.name); }}>
                      <Edit className="h-3.5 w-3.5 text-muted" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-danger hover:bg-danger-soft" onClick={() => handleDeleteCategory(cat.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" size="sm" onClick={() => setShowCategoryModal(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Product (With Delete Option in Edit Settings) */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-display text-base font-extrabold text-ink">
                {editingItem ? "Edit Physical Product" : "Add Physical Product"}
              </h3>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowProductModal(false)}>âœ•</Button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3.5">
              <div>
                <Label className="text-xs">Product Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Type-C Fast Cable 1m" className="mt-1 h-9 text-xs" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">SKU / Code</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} className="mt-1 h-9 text-xs font-mono" />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-border bg-warm px-2.5 text-xs font-semibold"
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Stock Qty</Label>
                  <Input type="number" min="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} className="mt-1 h-9 text-xs font-mono" required />
                </div>
                <div>
                  <Label className="text-xs">Unit</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs / box" className="mt-1 h-9 text-xs" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Retail Price (Rs.)</Label>
                  <Input type="number" min="0" value={retailPkr} onChange={(e) => setRetailPkr(e.target.value)} className="mt-1 h-9 font-mono text-xs" required />
                </div>
                <div>
                  <Label className="text-xs">Cost Price (Rs.)</Label>
                  <Input type="number" min="0" value={costPkr} onChange={(e) => setCostPkr(e.target.value)} className="mt-1 h-9 font-mono text-xs" required />
                </div>
              </div>

              <div>
                <Label className="text-xs">Low Stock Alert Threshold</Label>
                <Input type="number" min="0" value={minAlert} onChange={(e) => setMinAlert(e.target.value)} className="mt-1 h-9 font-mono text-xs" required />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                {editingItem ? (
                  <Button
                    type="button"
                    
                    className="text-danger hover:bg-danger-soft border-danger/30 text-xs"
                    onClick={() => handleDeleteProduct(editingItem.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Product
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowProductModal(false)}>Cancel</Button>
                  <Button type="submit" size="sm">{editingItem ? "Update Product" : "Save Product"}</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}