import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { Search, Package, Filter, Gem, Hash, Weight, Sparkles, Plus, Image as ImageIcon, Loader2, Trash2, ZoomIn } from "lucide-react";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { inventoryAPI } from "@/lib/api";
import { type Product, inr } from "@/lib/storage";
import { toast } from "sonner";

export default function CatalogPage() {
  const { data: allItems = [], isLoading } = useApi<Product[]>(["inventory"], () => inventoryAPI.getAll());
  const createMutation = useApiMutation((data: Product) => inventoryAPI.create(data), ["inventory"]);
  const deleteMutation = useApiMutation((id: string) => inventoryAPI.delete(id), ["inventory"]);
  
  const products = useMemo(() => (Array.isArray(allItems) ? allItems : []), [allItems]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  const [draft, setDraft] = useState<Partial<Product>>({
    name: "",
    category: "Gold",
    purity: "22K",
    netWeight: 0,
    ratePerGram: 7200,
    makingCharge: 0,
    stock: 0,
    imageUrl: "",
    imageUrls: [],
    note: "Catalog Item"
  });
  
  const categories = useMemo(() => {
    const cats = new Set(["Gold", "Silver", ...products.map(p => p.category)]);
    return ["All", ...Array.from(cats).filter(Boolean)];
  }, [products]);

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(q.toLowerCase()) || 
                          (p.huid || "").toLowerCase().includes(q.toLowerCase());
    const matchesCategory = category === "All" || p.category === category;
    
    return matchesSearch && matchesCategory;
  });
  
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    filtered.forEach(p => {
      const cat = p.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [filtered]);

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
          setDraft((prev) => ({ ...prev, imageUrls: [...(prev.imageUrls || []), compressedBase64] }));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async () => {
    if (!draft.name) {
      toast.error("Item name is required.");
      return;
    }
    try {
      await createMutation.mutateAsync({ 
        id: Date.now().toString(), 
        barcode: `CAT-${Date.now()}`,
        name: draft.name,
        category: draft.category || "Gold",
        subcategory: draft.subcategory || "",
        note: "Catalog Item",
        purity: draft.purity || "22K",
        netWeight: draft.netWeight || 0,
        grossWeight: draft.netWeight || 0,
        stoneWeight: 0,
        makingCharge: draft.makingCharge || 0,
        makingChargePct: 0,
        ratePerGram: draft.ratePerGram || 0,
        gstPct: 3,
        stock: 0,
        huid: "",
        imageUrl: draft.imageUrls?.[0] || "",
        imageUrls: draft.imageUrls || [],
      } as Product);
      toast.success("Catalog item saved to database!");
      setAddOpen(false);
      setDraft({ name: "", category: "Gold", purity: "22K", netWeight: 0, ratePerGram: 7200, makingCharge: 0, stock: 0, imageUrl: "", imageUrls: [], note: "Catalog Item" });
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save to database. Check backend connection.");
    }
  };

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl">Product Catalog</h1>
          <p className="text-muted-foreground mt-1">
            Browse and showcase your inventory items.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" /> Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Catalog Item</DialogTitle>
              <DialogDescription>Add a new item directly to the catalog.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Item Image</Label>
                <div className="flex flex-col gap-4 mt-1">
                    <div className="relative border-2 border-dashed border-border rounded-lg p-4 hover:bg-muted/50 transition-colors text-center cursor-pointer">
                      <Input type="file" accept="image/*" multiple onChange={(e) => handleImageChange(e.target.files)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <ImageIcon className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-muted-foreground">Click to upload images</p>
                    </div>
                  <div className="flex flex-wrap gap-2">
                    {(draft.imageUrls || []).map((img, idx) => (
                      <div key={idx} className="w-20 h-20 shrink-0 rounded-lg border border-border overflow-hidden relative group">
                        <img src={img} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button" 
                          onClick={() => setDraft(prev => ({ ...prev, imageUrls: prev.imageUrls?.filter((_, i) => i !== idx) }))}
                          className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Item Name *</Label>
                <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Diamond Necklace" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Category</Label><Input value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} placeholder="Gold, Silver..." /></div>
                <div className="space-y-1.5"><Label>Purity</Label><Input value={draft.purity} onChange={e => setDraft({ ...draft, purity: e.target.value })} placeholder="22K, 18K..." /></div>
                <div className="space-y-1.5"><Label>Weight (g)</Label><Input type="number" value={draft.netWeight || ""} onChange={e => setDraft({ ...draft, netWeight: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Rate (₹/g)</Label><Input type="number" value={draft.ratePerGram || ""} onChange={e => setDraft({ ...draft, ratePerGram: Number(e.target.value) })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!draft.name || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            className="pl-9 bg-background" 
            placeholder="Search by name or HUID..." 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="bg-background">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <SelectValue placeholder="Category" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Package className="w-6 h-6 mr-2 animate-pulse" /> Loading catalog...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed border-border">
          <Gem className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-20" />
          <h3 className="text-lg font-medium text-foreground">No products found</h3>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedProducts).map(([cat, prods]) => (
            <div key={cat}>
              <h2 className="text-2xl font-display mb-4 flex items-center gap-2">
                {cat} <Badge variant="secondary" className="text-xs">{prods.length}</Badge>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {prods.map(p => {
                  const metalValue = p.netWeight * p.ratePerGram;
                  const making = p.makingChargePct ? (metalValue * p.makingChargePct) / 100 : p.makingCharge;
                  const totalEst = metalValue + making + (p.stoneWeight || 0);

                  return (
                    <Card key={(p as any)._id || p.id} className="overflow-hidden flex flex-col group hover:shadow-lg transition-all cursor-pointer border-border hover:border-primary/50" onClick={() => setSelectedProduct(p)}>
                      <div className="aspect-square bg-muted relative overflow-hidden">
                {(p.imageUrls?.[0] || p.imageUrl) ? (
                  <img 
                    src={p.imageUrls?.[0] || p.imageUrl} 
                    alt={p.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                    <Gem className="w-12 h-12 mb-2" />
                    <span className="text-xs font-medium">No Image</span>
                  </div>
                )}
                {p.stock <= 0 && p.note !== "Catalog Item" && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-[1px]">
                    <Badge variant="destructive" className="text-xs uppercase tracking-widest px-3 py-1">Out of Stock</Badge>
                  </div>
                )}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="w-8 h-8 rounded-full shadow-md"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm("Are you sure you want to delete this catalog item?")) {
                        try {
                          await deleteMutation.mutateAsync((p as any)._id || p.id);
                          toast.success("Item deleted from database.");
                        } catch (error) {
                          toast.error("Failed to delete item.");
                        }
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                      </div>
                      <CardContent className="p-4 flex-1 flex flex-col bg-card">
                        <h3 className="font-semibold text-base line-clamp-1 mb-1" title={p.name}>{p.name}</h3>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">{p.category}</Badge>
                          <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">{p.purity}</Badge>
                        </div>
                        <div className="mt-auto flex items-center justify-between text-sm border-t border-border pt-3">
                          <div className="flex flex-col">
                            <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Net Wt</span>
                            <span className="font-medium text-foreground">{p.netWeight} g</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Est. Price</span>
                            <span className="font-bold text-primary">{inr(totalEst)}</span>
                          </div>
                        </div>
                      </CardContent>
            </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedProduct} onOpenChange={(v) => { if (!v) { setSelectedProduct(null); setActiveImageIndex(0); } }}>
        <DialogContent className="max-w-3xl overflow-hidden p-0 sm:rounded-2xl" aria-describedby={undefined}>
          {selectedProduct && (() => {
            const displayImages = selectedProduct.imageUrls?.length ? selectedProduct.imageUrls : (selectedProduct.imageUrl ? [selectedProduct.imageUrl] : []);
            const currentImage = displayImages[activeImageIndex] || displayImages[0];
            return (
              <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
              {/* Left: Image */}
              <div 
                className={`w-full md:w-1/2 bg-muted/30 relative flex flex-col items-center justify-center aspect-square md:aspect-auto md:min-h-112.5 group/img ${currentImage ? 'cursor-zoom-in' : ''}`}
                onClick={() => {
                  if (currentImage) {
                    setFullScreenImage(currentImage);
                  }
                }}
              >
                {currentImage ? (
                  <>
                    <img src={currentImage} alt={selectedProduct.name} className={`absolute inset-0 w-full h-full object-contain p-6 drop-shadow-md transition-transform duration-300 group-hover/img:scale-[1.02] ${displayImages.length > 1 ? "pb-20" : ""}`} />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 transition-colors pointer-events-none flex items-center justify-center">
                      <ZoomIn className="w-10 h-10 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" />
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground flex flex-col items-center opacity-50">
                    <Gem className="w-16 h-16 mb-2" />
                    <span className="font-medium">No Image</span>
                  </div>
                )}
                {displayImages.length > 1 && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 z-20">
                    {displayImages.map((img, idx) => (
                      <img 
                        key={idx} 
                        src={img} 
                        className={`w-12 h-12 object-cover rounded-md cursor-pointer border-2 shadow-sm transition-all hover:scale-105 bg-background ${idx === activeImageIndex ? 'border-primary scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`} 
                        onClick={(e) => { e.stopPropagation(); setActiveImageIndex(idx); }}
                      />
                    ))}
                  </div>
                )}
                {selectedProduct.stock <= 0 && selectedProduct.note !== "Catalog Item" && (
                  <div className="absolute top-4 left-4 z-10">
                    <Badge variant="destructive" className="uppercase tracking-widest shadow-sm">Out of Stock</Badge>
                  </div>
                )}
              </div>

              {/* Right: Details */}
              <div className="w-full md:w-1/2 p-6 overflow-y-auto flex flex-col">
                <DialogHeader className="text-left space-y-1 mb-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none">{selectedProduct.category}</Badge>
                    {selectedProduct.subcategory && <Badge variant="outline" className="border-border">{selectedProduct.subcategory}</Badge>}
                    <Badge variant="outline" className="border-border">{selectedProduct.purity}</Badge>
                  </div>
                  <DialogTitle className="text-2xl font-display leading-tight">{selectedProduct.name}</DialogTitle>
                  <DialogDescription className="text-sm line-clamp-3">
                    {selectedProduct.note || "No additional description available for this item."}
                  </DialogDescription>
                </DialogHeader>
                <div className="absolute top-4 right-12 bg-background rounded-md shadow-sm border border-border z-10">
                  <Button variant="ghost" size="icon" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={async () => {
                    if (window.confirm("Are you sure you want to delete this catalog item?")) {
                      try {
                        await deleteMutation.mutateAsync((selectedProduct as any)._id || selectedProduct.id);
                        toast.success("Item deleted from database.");
                        setSelectedProduct(null);
                      } catch (error) {
                        toast.error("Failed to delete item.");
                      }
                    }
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4 flex-1 mt-2">
                  <div className="grid grid-cols-2 gap-4 bg-muted/40 p-4 rounded-xl border border-border">
                    <div>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Weight className="w-3.5 h-3.5" /> Net Weight
                      </span>
                      <span className="font-semibold">{selectedProduct.netWeight} g</span>
                    </div>
                    <div>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Weight className="w-3.5 h-3.5" /> Gross Weight
                      </span>
                      <span className="font-semibold">{selectedProduct.grossWeight || selectedProduct.netWeight} g</span>
                    </div>
                    {selectedProduct.huid && (
                      <div className="col-span-2 border-t border-border pt-3 mt-1">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                          <Hash className="w-3.5 h-3.5" /> HUID
                        </span>
                        <span className="font-semibold tracking-wider">{selectedProduct.huid}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary/70 mb-3 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Price Estimate
                    </h4>
                    {(() => {
                      const metalValue = selectedProduct.netWeight * selectedProduct.ratePerGram;
                      const making = selectedProduct.makingChargePct ? (metalValue * selectedProduct.makingChargePct) / 100 : selectedProduct.makingCharge;
                      const estTotal = metalValue + making + (selectedProduct.stoneWeight || 0);
                      return (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Metal (@ {inr(selectedProduct.ratePerGram)}/g)</span>
                            <span className="font-medium">{inr(metalValue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Making {selectedProduct.makingChargePct ? `(${selectedProduct.makingChargePct}%)` : ''}</span>
                            <span className="font-medium">{inr(making)}</span>
                          </div>
                          {selectedProduct.stoneWeight > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Stone</span>
                              <span className="font-medium">{inr(selectedProduct.stoneWeight)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center border-t border-primary/10 pt-2 mt-2">
                            <span className="font-semibold text-primary">Est. Total (ex. GST)</span>
                            <span className="text-xl font-bold text-primary">{inr(estTotal)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>);
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!fullScreenImage} onOpenChange={(v) => !v && setFullScreenImage(null)}>
        <DialogContent className="max-w-[95vw] h-[95vh] p-0 border-none bg-black/95 shadow-none sm:rounded-none flex items-center justify-center [&>button]:text-white [&>button]:hover:bg-white/20 [&>button]:hover:text-white" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Image Zoom</DialogTitle>
          {fullScreenImage && (
            <img src={fullScreenImage} alt="Zoomed" className="w-full h-full object-contain p-4" />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}