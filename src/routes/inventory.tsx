import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil, Search, Image as ImageIcon, Upload, Filter } from "lucide-react";
import { useLocalState, uid, type Product, useDebounce } from "@/lib/storage";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { inventoryAPI } from "@/lib/api";
import { toast } from "sonner";

const empty: Product = {
  id: "",
  name: "",
  category: "Gold",
  subcategory: "",
  note: "",
  huid: "",
  purity: "22K",
  grossWeight: 0,
  netWeight: 0,
  stoneWeight: 0,
  makingCharge: 500,
  makingChargePct: 0,
  gstPct: 3,
  ratePerGram: 7200,
  stock: 1,
  barcode: "",
  imageUrl: "",
  imageUrls: [],
} as any;

export default function InventoryPage() {
  const { data: allItems = [], isLoading } = useApi<Product[]>(["inventory"], () => inventoryAPI.getAll());
  const createMutation = useApiMutation((data: Product) => inventoryAPI.create(data), ["inventory"]);
  const updateMutation = useApiMutation((data: { id: string; body: Product }) => inventoryAPI.update(data.id, data.body), ["inventory"]);
  const bulkCreateMutation = useApiMutation(async (data: Product[]) => {
    for (const p of data) {
      await inventoryAPI.create(p);
    }
  }, ["inventory"]);
  const deleteMutation = useApiMutation((id: string) => inventoryAPI.delete(id), ["inventory"]);

  const [categories, setCategories] = useLocalState<string[]>("ajms.categories", ["Gold", "Silver", "Diamond", "Platinum", "Coin"]);
  const [subcategories, setSubcategories] = useLocalState<Record<string, string[]>>("ajms.subcategories", {});
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Product>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newSub, setNewSub] = useState("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [catFilter, setCatFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<Product[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const products = useMemo(() => (Array.isArray(allItems) ? allItems : []), [allItems]);

  const filtered = products.filter(
    (p) =>
      (catFilter === "All" || p.category === catFilter) &&
      (p.name.toLowerCase().includes(debouncedQ.toLowerCase()) ||
      p.barcode.toLowerCase().includes(debouncedQ.toLowerCase()) ||
      (p.huid || "").toLowerCase().includes(debouncedQ.toLowerCase()))
  );

  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  const startNew = () => {
    setEditingId(null);
    setDraft({ ...empty, id: uid(), barcode: "AJ-" + uid().toUpperCase() });
    setImagePreviews([]);
    setOpen(true);
  };
  const startEdit = (p: Product) => {
    setEditingId((p as any)._id || p.id);
    setDraft(p);
    const urls = p.imageUrls?.length ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []);
    setImagePreviews(urls);
    setOpen(true);
  };
  const save = async () => {
    if (!draft.name) return;
    try {
      const payload = { ...draft, imageUrl: imagePreviews[0] || "", imageUrls: imagePreviews };
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setOpen(false);
    } catch (error) {
      console.error("[Inventory] Error saving to DB:", error);
    }
  };
  const remove = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const set = <K extends keyof Product>(k: K, v: Product[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleImageChange = (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 400; // Drastically reduce size for much shorter Base64 strings
          let { width, height } = img;
          
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/webp", 0.5); // Use WebP for massive size reduction
          setImagePreviews((prev) => [...prev, compressedBase64]);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!json || json.length === 0) {
          toast.error("Excel file is empty or formatted incorrectly.");
          return;
        }

        // Flexible getter for various column name formats (case-insensitive)
        const getVal = (row: any, ...keys: string[]) => {
          const rowKeys = Object.keys(row);
          for (const k of keys) {
            const match = rowKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
            if (match && row[match] !== undefined && row[match] !== null) return row[match];
          }
          return undefined;
        };

        const newProducts = json.map((row): Product | null => {
          const name = String(getVal(row, 'name', 'product name', 'item', 'product') || '').trim();
          if (!name || name === 'undefined') return null;

          return {
            id: uid(),
            barcode: "AJ-" + uid().toUpperCase(),
            name: name,
            category: String(getVal(row, 'category', 'type', 'group') || 'Gold'),
            subcategory: String(getVal(row, 'subcategory', 'subcat') || ''),
            purity: String(getVal(row, 'purity', 'karat', 'quality') || '22K'),
            netWeight: parseFloat(getVal(row, 'net weight', 'net wt', 'weight')) || 0,
            makingCharge: parseFloat(getVal(row, 'making charge', 'making', 'making (₹)')) || 0,
            makingChargePct: parseFloat(getVal(row, 'making charge %', 'making %', 'making (%)')) || 0,
            gstPct: parseFloat(getVal(row, 'gst %', 'gst', 'tax')) || 3,
            ratePerGram: parseFloat(getVal(row, 'rate/gram', 'rate', 'price', 'rate per gram')) || 0,
            stock: parseInt(String(getVal(row, 'stock', 'qty', 'quantity', 'count'))) || 1,
            huid: String(getVal(row, 'huid', 'hallmark', 'serial') || ''),
            grossWeight: parseFloat(getVal(row, 'gross weight', 'gross wt')) || 0,
            stoneWeight: parseFloat(getVal(row, 'stone weight', 'less Wt')) || 0,
            note: String(getVal(row, 'note', 'remarks', 'description') || ''),
            imageUrl: "",
          } as Product;
        }).filter(Boolean) as Product[];

        setParsedProducts(newProducts);
        if (newProducts.length === 0) {
          toast.warning("Could not find any products. Ensure your Excel file has a 'Name' column.");
        } else {
          setImportOpen(true);
        }
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast.error("Failed to parse Excel file. Make sure it's a valid .xlsx or .xls file.");
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read the file.");
    };
    reader.readAsArrayBuffer(file);
  };

  const addCategory = () => {
    const c = newCat.trim();
    if (!c) return;
    if (!categories.includes(c)) setCategories((p) => [...p, c]);
    setDraft((d) => ({ ...d, category: c }));
    setNewCat("");
    setAddCatOpen(false);
  };

  const addSubcategory = () => {
    const s = newSub.trim();
    if (!s || !draft.category) return;
    setSubcategories((prev) => {
      const map = { ...(prev || {}) } as Record<string, string[]>;
      map[draft.category] = Array.from(new Set([...(map[draft.category] || []), s]));
      return map;
    });
    setDraft((d) => ({ ...d, subcategory: s }));
    setNewSub("");
    setAddSubOpen(false);
  };

  const saveImport = async () => {
    if (parsedProducts.length === 0) {
      toast.warning("No products to import.");
      return;
    }
    try {
      await bulkCreateMutation.mutateAsync(parsedProducts);
      toast.success(`${parsedProducts.length} products imported successfully.`);
      setImportOpen(false);
      setParsedProducts([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      toast.error("Failed to import products.");
    }
  };

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl">Inventory</h1>
          <p className="text-muted-foreground mt-1">
            {products.length} item{products.length === 1 ? "" : "s"} in stock.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".xlsx, .xls" 
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileImport(e.target.files[0]);
              }
              e.target.value = ''; // Allow selecting the same file again
            }} 
          />
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" /> Import Excel
          </Button>
          <Dialog open={importOpen} onOpenChange={(val) => { setImportOpen(val); if (!val) setParsedProducts([]); }}>
            <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Confirm Import</DialogTitle>
                <DialogDescription>
                  Review the {parsedProducts.length} products found in the file.
                  <a href="/product-template.xlsx" download className="text-primary underline ml-2 font-medium">Download Template</a>
                </DialogDescription>
              </DialogHeader>
              {parsedProducts.length > 0 && (
                <div className="flex-1 overflow-y-auto border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Category</th>
                        <th className="p-2 text-right">Net Wt.</th>
                        <th className="p-2 text-right">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedProducts.map((p, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="p-2 font-medium">{p.name}</td>
                          <td className="p-2">{p.category}</td>
                          <td className="p-2 text-right">{p.netWeight}g</td>
                          <td className="p-2 text-right">{p.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                <Button onClick={saveImport} disabled={parsedProducts.length === 0 || bulkCreateMutation.isPending}>
                  {bulkCreateMutation.isPending ? "Importing..." : `Import ${parsedProducts.length} Products`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
            <Button size="lg" className="flex-1 sm:flex-none" onClick={startNew}>
              <Plus className="w-4 h-4 mr-2" /> Add Product
            </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                {editingId ? "Edit" : "New"} product
              </DialogTitle>
              <DialogDescription>
                Fill in product details, category, pricing and stock information.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Field label="Product Name">
                  <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
              </div>
              <Field label="Category">
                <div className="flex gap-2 items-center">
                  <Select value={draft.category} onValueChange={(v) => set("category", v as Product["category"]) }>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="outline" className="shrink-0" title="Add Category">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[60vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add Category</DialogTitle>
                        <DialogDescription>Add a new product category for organizing your inventory.</DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Category name" autoFocus />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAddCatOpen(false)}>Cancel</Button>
                        <Button onClick={addCategory}>Add</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </Field>
              <Field label="Subcategory">
                <div className="flex gap-2 items-center">
                  <Select value={draft.subcategory || ""} onValueChange={(v) => set("subcategory", v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select subcategory" /></SelectTrigger>
                    <SelectContent>
                      {(subcategories[draft.category || ""] || []).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={addSubOpen} onOpenChange={setAddSubOpen}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="outline" className="shrink-0" disabled={!draft.category} title="Add Subcategory">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[60vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add Subcategory</DialogTitle>
                        <DialogDescription>
                          Add a new subcategory under <strong>{draft.category || "the selected category"}</strong>.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Subcategory name" autoFocus />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAddSubOpen(false)}>Cancel</Button>
                        <Button onClick={addSubcategory}>Add</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </Field>
              <Field label="HUID"><Input value={draft.huid} onChange={(e) => set("huid", e.target.value)} /></Field>
              <Field label="Purity"><Input value={draft.purity} onChange={(e) => set("purity", e.target.value)} /></Field>
              
              <div className="md:col-span-2 grid grid-cols-3 gap-3 bg-muted/30 p-3 rounded-lg border border-border">
                <Field label="Gross Wt (g)">
                  <NumIn v={draft.grossWeight} on={(v) => setDraft(d => ({ ...d, grossWeight: v, netWeight: Math.max(0, Number((v - d.stoneWeight).toFixed(3))) }))} />
                </Field>
                <Field label="less Wt (g)">
                  <NumIn v={draft.stoneWeight} on={(v) => setDraft(d => ({ ...d, stoneWeight: v, netWeight: Math.max(0, Number((d.grossWeight - v).toFixed(3))) }))} />
                </Field>
                <Field label="Net Wt (g)">
                  <NumIn v={draft.netWeight} on={(v) => setDraft(d => ({ ...d, netWeight: v, grossWeight: Number((v + d.stoneWeight).toFixed(3)) }))} />
                </Field>
              </div>

              <Field label="Stock Qty"><NumIn v={draft.stock} on={(v) => set("stock", v)} /></Field>
              
              <div className="md:col-span-2">
                <Field label="Note">
                  <Textarea value={draft.note || ""} onChange={(e) => set("note", e.target.value)} />
                </Field>
              </div>

              <div className="md:col-span-2 mt-2">
                <Label className="text-xs mb-1.5 block">Product Images</Label>
                <div className="flex flex-col gap-4">
                    <div className="relative border-2 border-dashed border-border rounded-lg p-4 hover:bg-muted/50 transition-colors text-center cursor-pointer">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        multiple
                        onChange={(e) => handleImageChange(e.target.files)} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <ImageIcon className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-muted-foreground">Click to pick images from Gallery</p>
                    </div>
                  <div className="flex flex-wrap gap-3">
                  {imagePreviews.map((img, idx) => (
                    <div key={idx} className="w-24 h-24 shrink-0 rounded-lg border border-border overflow-hidden relative group">
                      <img src={img} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => setImagePreviews(p => p.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        title="Remove Image"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 bg-background" placeholder="Search by name, HUID or barcode" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="w-full sm:w-48">
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="bg-background">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <SelectValue placeholder="Category" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              <SelectItem value="Gold">Gold</SelectItem>
              <SelectItem value="Silver">Silver</SelectItem>
              {categories.filter(c => c !== "Gold" && c !== "Silver").map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Loading inventory...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No products yet. Click "Add Product" to start.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="p-3">Name</th>
                  <th>Category</th>
                  <th>Subcat</th>
                  <th>Purity</th>
                  <th>Net Wt</th>
                  <th>Stock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((p) => (
                  <tr key={(p as any)._id || p.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {(p.imageUrls?.[0] || p.imageUrl) ? (
                          <img src={p.imageUrls?.[0] || p.imageUrl} alt={p.name} className="w-10 h-10 rounded object-cover border border-border shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center border border-border shrink-0 text-[10px] text-muted-foreground">No img</div>
                        )}
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.barcode}</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge variant="secondary">{p.category}</Badge></td>
                    <td>{p.subcategory || "—"}</td>
                    <td>{p.purity}</td>
                    <td>{p.netWeight} g</td>
                    <td>{p.stock}</td>
                    <td>
                      <div className="flex gap-1 justify-end pr-3">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(p)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove((p as any)._id || p.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, filtered.length)} of {filtered.length} entries</div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                  <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                </div>
              </div>
            )}
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function NumIn({ v, on }: { v: number; on: (n: number) => void }) {
  return (
    <Input type="number" value={v} onChange={(e) => on(parseFloat(e.target.value) || 0)} />
  );
}
