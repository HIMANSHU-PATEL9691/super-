import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocalState, useDebounce } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { supplierAPI } from "@/lib/api";
import { Plus, Trash2, Pencil, Search, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";

interface SupplierTransaction {
  id?: string;
  _id?: string;
  date: string;
  type: "Credit" | "Debit";
  metal: "Gold" | "Silver";
  purity?: string;
  weight: number;
  note: string;
}

interface Supplier {
  _id?: string;
  id?: string;
  name: string;
  mobile: string;
  companyNo: string;
  email?: string;
  category: string;
  gstNumber?: string;
  address: string;
  note: string;
  outstanding?: number;
  balanceGold?: number;
  balanceSilver?: number;
  transactions?: SupplierTransaction[];
  createdAt?: string;
  updatedAt?: string;
}

export default function SuppliersPage() {
  const { data: list = [], isLoading, error } = useApi<Supplier[]>(["suppliers"], () => supplierAPI.getAll());
  const createMutation = useApiMutation((data: Supplier) => supplierAPI.create(data), ["suppliers"]);
  const updateMutation = useApiMutation((data: { id: string; body: Supplier }) => supplierAPI.update(data.id, data.body), ["suppliers"]);
  const deleteMutation = useApiMutation((id: string) => supplierAPI.delete(id), ["suppliers"]);

  const [open, setOpen] = useState(false);
  const empty: Supplier = { name: "", mobile: "", companyNo: "", email: "", category: "", gstNumber: "", address: "", note: "", balanceGold: 0, balanceSilver: 0, outstanding: 0, transactions: [] };
  const [form, setForm] = useState<Supplier>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useLocalState<string[]>("ajms.supplierCategories", ["Wholesale", "Manufacturer", "Distributor"]);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");

  const [ledgerShop, setLedgerShop] = useState<Supplier | null>(null);
  const [goldPage, setGoldPage] = useState(1);
  const [silverPage, setSilverPage] = useState(1);
  const [txSearchQuery, setTxSearchQuery] = useState("");
  const debouncedTxSearchQuery = useDebounce(txSearchQuery, 300);
  const [txSearchDate, setTxSearchDate] = useState<string>("");
  const [txForm, setTxForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "Credit" as "Credit" | "Debit",
    metal: "Gold" as "Gold" | "Silver",
    purity: "22K",
    weight: 0,
    note: ""
  });

  const save = async () => {
    if (!form.name || !form.mobile || !form.companyNo || !form.category || !form.address || !form.note) {
      toast.error("Name, mobile, company no, category, address, and note are required");
      return;
    }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: form });
        toast.success("Supplier updated successfully");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Supplier created successfully");
      }
      setForm(empty);
      setEditingId(null);
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save supplier");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Supplier deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete supplier");
    }
  };

  const addCategory = () => {
    const c = newCat.trim();
    if (!c) return;
    if (!categories.includes(c)) setCategories((p) => [...p, c]);
    setForm((d) => ({ ...d, category: c }));
    setNewCat("");
    setAddCatOpen(false);
  };

  const addTransaction = async () => {
    if (!ledgerShop) return;
    const newTx: SupplierTransaction = {
      id: Date.now().toString(),
      date: txForm.date,
      type: txForm.type,
      metal: txForm.metal,
      purity: txForm.purity,
      weight: Number(txForm.weight) || 0,
      note: txForm.note
    };

    const multiplier = newTx.type === "Credit" ? 1 : -1;
    let newBalanceGold = ledgerShop.balanceGold || 0;
    let newBalanceSilver = ledgerShop.balanceSilver || 0;

    if (newTx.metal === "Gold") newBalanceGold += newTx.weight * multiplier;
    if (newTx.metal === "Silver") newBalanceSilver += newTx.weight * multiplier;

    const updatedSupplier = {
      ...ledgerShop,
      balanceGold: newBalanceGold,
      balanceSilver: newBalanceSilver,
      transactions: [...(ledgerShop.transactions || []), newTx]
    };

    try {
      const saved = await updateMutation.mutateAsync({ id: ledgerShop._id || ledgerShop.id || "", body: updatedSupplier });
      setLedgerShop(saved || updatedSupplier);
      setTxForm({ date: new Date().toISOString().slice(0, 10), type: "Credit", metal: "Gold", purity: "22K", weight: 0, note: "" });
      toast.success("Transaction added successfully!");
    } catch (e) {
      toast.error("Failed to add transaction");
    }
  };

  const deleteTransaction = async (txId: string) => {
    if (!ledgerShop) return;
    if (!window.confirm("Delete this transaction?")) return;

    const txToDelete = ledgerShop.transactions?.find(t => (t._id || t.id) === txId);
    if (!txToDelete) return;

    const multiplier = txToDelete.type === "Credit" ? -1 : 1; // Reverse the effect
    let newBalanceGold = ledgerShop.balanceGold || 0;
    let newBalanceSilver = ledgerShop.balanceSilver || 0;

    if (txToDelete.metal === "Gold") newBalanceGold += txToDelete.weight * multiplier;
    if (txToDelete.metal === "Silver") newBalanceSilver += txToDelete.weight * multiplier;

    const updatedSupplier = {
      ...ledgerShop,
      balanceGold: newBalanceGold,
      balanceSilver: newBalanceSilver,
      transactions: ledgerShop.transactions?.filter(t => (t._id || t.id) !== txId)
    };

    try {
      const saved = await updateMutation.mutateAsync({ id: ledgerShop._id || ledgerShop.id || "", body: updatedSupplier });
      setLedgerShop(saved || updatedSupplier);
      toast.success("Transaction deleted");
    } catch (e) {
      toast.error("Failed to delete transaction");
    }
  };

  const filtered = list.filter(s => 
    s.name.toLowerCase().includes(debouncedQ.toLowerCase()) || 
    s.mobile.includes(debouncedQ) || 
    s.companyNo.toLowerCase().includes(debouncedQ.toLowerCase())
  );

  const isLoading_UI = isLoading || createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  const goldTx = useMemo(() => {
    if (!ledgerShop?.transactions) return [];
    let txs = ledgerShop.transactions.filter(t => t.metal === "Gold");
    if (debouncedTxSearchQuery) {
      const q = debouncedTxSearchQuery.toLowerCase();
      txs = txs.filter(t => 
        t.type.toLowerCase().includes(q) || 
        (t.note || "").toLowerCase().includes(q) || 
        (t.purity || "").toLowerCase().includes(q) ||
        formatDate(t.date).toLowerCase().includes(q)
      );
    }
    if (txSearchDate) {
      txs = txs.filter(t => t.date === txSearchDate);
    }
    return txs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [ledgerShop, txSearchQuery, txSearchDate]);

  const silverTx = useMemo(() => {
    if (!ledgerShop?.transactions) return [];
    let txs = ledgerShop.transactions.filter(t => t.metal === "Silver");
    if (debouncedTxSearchQuery) {
      const q = debouncedTxSearchQuery.toLowerCase();
      txs = txs.filter(t => 
        t.type.toLowerCase().includes(q) || 
        (t.note || "").toLowerCase().includes(q) || 
        (t.purity || "").toLowerCase().includes(q) ||
        formatDate(t.date).toLowerCase().includes(q)
      );
    }
    if (txSearchDate) {
      txs = txs.filter(t => t.date === txSearchDate);
    }
    return txs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [ledgerShop, txSearchQuery, txSearchDate]);

  const totalGoldPages = Math.ceil(goldTx.length / 15) || 1;
  const currentGoldPage = Math.min(goldPage, totalGoldPages);
  const paginatedGoldTx = goldTx.slice((currentGoldPage - 1) * 15, currentGoldPage * 15);

  const totalSilverPages = Math.ceil(silverTx.length / 15) || 1;
  const currentSilverPage = Math.min(silverPage, totalSilverPages);
  const paginatedSilverTx = silverTx.slice((currentSilverPage - 1) * 15, currentSilverPage * 15);

  const goldBreakdown = useMemo(() => {
    if (!ledgerShop) return {};
    const breakdown: Record<string, number> = {};
    let txSum = 0;
    (ledgerShop.transactions || []).filter(t => t.metal === "Gold").forEach(t => {
      const p = t.purity || "22K";
      const w = t.weight * (t.type === "Credit" ? 1 : -1);
      breakdown[p] = (breakdown[p] || 0) + w;
      txSum += w;
    });
    const opening = (ledgerShop.balanceGold || 0) - txSum;
    if (Math.abs(opening) > 0.001) breakdown["Opening/Other"] = (breakdown["Opening/Other"] || 0) + opening;
    return breakdown;
  }, [ledgerShop]);

  const silverBreakdown = useMemo(() => {
    if (!ledgerShop) return {};
    const breakdown: Record<string, number> = {};
    let txSum = 0;
    (ledgerShop.transactions || []).filter(t => t.metal === "Silver").forEach(t => {
      const p = t.purity || "Silver";
      const w = t.weight * (t.type === "Credit" ? 1 : -1);
      breakdown[p] = (breakdown[p] || 0) + w;
      txSum += w;
    });
    const opening = (ledgerShop.balanceSilver || 0) - txSum;
    if (Math.abs(opening) > 0.001) breakdown["Opening/Other"] = (breakdown["Opening/Other"] || 0) + opening;
    return breakdown;
  }, [ledgerShop]);

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Suppliers</h1>
          <p className="text-muted-foreground mt-1">{list.length} on file.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" onClick={() => { setForm(empty); setEditingId(null); }} disabled={isLoading_UI}>
              <Plus className="w-4 h-4 mr-2"/> Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{editingId ? "Edit" : "New"} supplier</DialogTitle>
              <DialogDescription>Add or update supplier information</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Supplier Name *" v={form.name} on={v => setForm({...form, name: v})} />
              <Field label="Mobile No *" v={form.mobile} on={v => setForm({...form, mobile: v})} />
              <Field label="Company No *" v={form.companyNo} on={v => setForm({...form, companyNo: v})} />
              <Field label="Email (optional)" v={form.email || ""} on={v => setForm({...form, email: v})} />
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Category *</Label>
                <div className="flex gap-2 items-center">
                  <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select category" /></SelectTrigger>
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
                        <DialogDescription>Add a new category label for your suppliers.</DialogDescription>
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
              </div>
              <Field label="GST No (optional)" v={form.gstNumber || ""} on={v => setForm({...form, gstNumber: v})} />
              <div className="col-span-2 grid grid-cols-2 gap-4 mt-2 p-3 bg-muted/30 rounded-md border border-border">
                <div className="col-span-2 text-xs font-semibold text-primary uppercase tracking-wider -mb-1">Opening Balance (Weight)</div>
                <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Gold Due (g)</Label><Input type="number" value={form.balanceGold === 0 ? "" : form.balanceGold} onChange={e => setForm({...form, balanceGold: Number(e.target.value)})} placeholder="0" /></div>
                <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Silver Due (g)</Label><Input type="number" value={form.balanceSilver === 0 ? "" : form.balanceSilver} onChange={e => setForm({...form, balanceSilver: Number(e.target.value)})} placeholder="0" /></div>
              </div>
              <div className="col-span-2 space-y-3 mt-1">
                <Field label="Address *" v={form.address} on={v => setForm({...form, address: v})} />
                <Field label="Note *" v={form.note} on={v => setForm({...form, note: v})} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading_UI}>Cancel</Button>
              <Button onClick={save} disabled={isLoading_UI || !form.name || !form.mobile || !form.companyNo || !form.category || !form.address || !form.note}>
                {isLoading_UI ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, mobile or company no" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <p className="text-center text-muted-foreground py-12">Loading suppliers...</p> : error ? <p className="text-center text-red-500 py-12">Failed to load suppliers</p> : filtered.length === 0 ? <p className="text-center text-muted-foreground py-12">No suppliers yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="p-3">Name</th><th>Mobile</th><th>Company No</th><th>Category</th><th className="text-right">Gold Due (g)</th><th className="text-right">Silver Due (g)</th><th></th></tr>
            </thead>
        <tbody>{paginated.map(s => (
              <tr key={s._id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="p-3 font-medium">{s.name}</td>
                <td>{s.mobile}</td>
                <td>{s.companyNo}</td>
                <td><span className="inline-flex items-center rounded-full border border-sidebar-border bg-sidebar px-2.5 py-0.5 text-xs font-semibold">{s.category}</span></td>
                <td className="text-right font-medium text-amber-600">{(s.balanceGold || 0).toFixed(3)}g</td>
                <td className="text-right font-medium text-slate-500">{(s.balanceSilver || 0).toFixed(3)}g</td>
                <td>
                  <div className="flex gap-1 justify-end pr-3">
                    <Button size="icon" variant="ghost" onClick={() => { setLedgerShop(s); setGoldPage(1); setSilverPage(1); }} title="View Ledger">
                      <BookOpen className="w-4 h-4 text-blue-600 hover:text-blue-700" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setForm(s); setEditingId(s._id || null); setOpen(true); }} disabled={isLoading_UI}><Pencil className="w-4 h-4"/></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s._id || "")} disabled={isLoading_UI}><Trash2 className="w-4 h-4"/></Button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
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

      <Dialog open={!!ledgerShop} onOpenChange={(v) => { if (!v) { setLedgerShop(null); setGoldPage(1); setSilverPage(1); setTxSearchQuery(""); setTxSearchDate(""); } }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          {ledgerShop && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-display flex items-center gap-2">
                   <BookOpen className="w-6 h-6 text-primary" /> {ledgerShop.name} - Ledger
                </DialogTitle>
                <DialogDescription>Manage credits and debits (Amount & Metal Weight) for this supplier.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 mb-4 mt-2">
                <Card className="bg-amber-50 border-amber-100 shadow-none">
                  <CardContent className="p-4">
                     <div className="text-sm text-amber-800 font-medium">Gold Due (g)</div>
                     <div className="text-2xl font-bold text-amber-600 mt-1">{(ledgerShop.balanceGold || 0).toFixed(3)} g</div>
                     {Object.keys(goldBreakdown).length > 0 && (
                       <div className="mt-2 text-xs text-amber-700/80 space-y-0.5 border-t border-amber-200/50 pt-2">
                         {Object.entries(goldBreakdown).filter(([_, w]) => Math.abs(w) > 0.001).map(([p, w]) => (
                           <div key={p} className="flex justify-between"><span>{p}:</span><span className="font-medium">{w.toFixed(3)} g</span></div>
                         ))}
                       </div>
                     )}
                  </CardContent>
                </Card>
                <Card className="bg-slate-100 border-slate-200 shadow-none">
                  <CardContent className="p-4">
                     <div className="text-sm text-slate-800 font-medium">Silver Due (g)</div>
                     <div className="text-2xl font-bold text-slate-600 mt-1">{(ledgerShop.balanceSilver || 0).toFixed(3)} g</div>
                     {Object.keys(silverBreakdown).length > 0 && (
                       <div className="mt-2 text-xs text-slate-500 space-y-0.5 border-t border-slate-300/50 pt-2">
                         {Object.entries(silverBreakdown).filter(([_, w]) => Math.abs(w) > 0.001).map(([p, w]) => (
                           <div key={p} className="flex justify-between"><span>{p}:</span><span className="font-medium">{w.toFixed(3)} g</span></div>
                         ))}
                       </div>
                     )}
                  </CardContent>
                </Card>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg border border-border mb-4">
                <h3 className="font-semibold mb-3">Add Transaction</h3>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                  <div className="space-y-1.5">
                     <Label className="text-xs">Type</Label>
                     <Select value={txForm.type} onValueChange={(v: any) => setTxForm({...txForm, type: v})}>
                       <SelectTrigger><SelectValue /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="Credit">Credit (+ We Owe)</SelectItem>
                         <SelectItem value="Debit">Debit (- We Paid)</SelectItem>
                       </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-1.5">
                     <Label className="text-xs">Metal</Label>
                     <Select value={txForm.metal} onValueChange={(v: any) => setTxForm({...txForm, metal: v})}>
                       <SelectTrigger><SelectValue /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="Gold">Gold</SelectItem>
                         <SelectItem value="Silver">Silver</SelectItem>
                       </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Purity</Label>
                    <Input value={txForm.purity} onChange={e => setTxForm({...txForm, purity: e.target.value})} placeholder="e.g. 22K" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Weight (g)</Label>
                    <Input type="number" value={txForm.weight || ""} onChange={e => setTxForm({...txForm, weight: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date</Label>
                    <DatePicker 
                      value={txForm.date} 
                      onChange={v => setTxForm({...txForm, date: v})} 
                      className="w-full bg-background shadow-sm h-9" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Note</Label>
                    <Input value={txForm.note} onChange={e => setTxForm({...txForm, note: e.target.value})} placeholder="Remarks..." />
                  </div>
                  <div className="col-span-2 md:col-span-6 flex justify-end mt-2">
                    <Button onClick={addTransaction} disabled={updateMutation.isPending || (!txForm.weight)}>
                      Add Transaction
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 mt-6">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" /> Transaction History
                </h3>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <DatePicker 
                    value={txSearchDate} 
                    onChange={v => { setTxSearchDate(v); setGoldPage(1); setSilverPage(1); }} 
                    className="w-full sm:w-40 bg-background h-9"
                  />
                  {txSearchDate && (
                    <Button variant="ghost" size="sm" onClick={() => { setTxSearchDate(""); setGoldPage(1); setSilverPage(1); }} className="h-9">
                      Clear
                    </Button>
                  )}
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search type, note..." 
                      value={txSearchQuery} 
                      onChange={e => { setTxSearchQuery(e.target.value); setGoldPage(1); setSilverPage(1); }} 
                      className="pl-9 h-9 bg-background text-sm shadow-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gold Table */}
                <Card className="shadow-sm border-amber-200/50 overflow-hidden flex flex-col">
                  <CardHeader className="bg-amber-50/50 py-3 border-b border-amber-100">
                    <CardTitle className="text-base font-semibold text-amber-700 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500"></div> Gold Ledger
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 flex flex-col">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-amber-50/30 text-left border-b border-amber-100/50">
                          <tr>
                            <th className="p-3 font-medium text-amber-900/70">Date</th>
                            <th className="p-3 font-medium text-amber-900/70">Details</th>
                            <th className="p-3 text-right font-medium text-amber-900/70">Weight</th>
                            <th className="p-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedGoldTx.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">No Gold transactions.</td></tr>
                          ) : (
                            paginatedGoldTx.map((tx, i) => (
                              <tr key={tx._id || tx.id || i} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                                <td className="p-3 align-top whitespace-nowrap">
                                  <div className="font-medium text-foreground">{formatDate(tx.date)}</div>
                                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tx.type === 'Credit' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {tx.type}
                                  </span>
                                </td>
                                <td className="p-3 align-top">
                                  <div className="font-medium text-foreground">{tx.purity || "—"}</div>
                                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2 max-w-40" title={tx.note}>{tx.note || "No remarks"}</div>
                                </td>
                                <td className="p-3 text-right align-top">
                                  <div className={`font-bold ${tx.type === 'Credit' ? 'text-green-600' : 'text-rose-600'}`}>
                                    {tx.type === 'Credit' ? '+' : '-'}{tx.weight > 0 ? `${tx.weight}g` : "0g"}
                                  </div>
                                </td>
                                <td className="p-3 text-right align-top">
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50" onClick={() => deleteTransaction(tx.id || tx._id || "")} title="Delete Transaction">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {totalGoldPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10 mt-auto">
                        <div className="text-xs text-muted-foreground">Page {currentGoldPage} of {totalGoldPages}</div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-background" onClick={() => setGoldPage(p => Math.max(1, p - 1))} disabled={currentGoldPage === 1}>Prev</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-background" onClick={() => setGoldPage(p => Math.min(totalGoldPages, p + 1))} disabled={currentGoldPage === totalGoldPages}>Next</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Silver Table */}
                <Card className="shadow-sm border-slate-200/80 overflow-hidden flex flex-col">
                  <CardHeader className="bg-slate-50 py-3 border-b border-slate-200">
                    <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div> Silver Ledger
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 flex flex-col">
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100/50 text-left border-b border-slate-200">
                        <tr>
                          <th className="p-2 pl-3">Date</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Note</th>
                          <th className="p-2">Purity</th>
                          <th className="p-2 text-right">Wt (g)</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedSilverTx.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No Silver transactions.</td></tr>
                        ) : (
                          paginatedSilverTx.map((tx, i) => (
                            <tr key={tx._id || tx.id || i} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="p-2 pl-3">{formatDate(tx.date)}</td>
                              <td className="p-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${tx.type === 'Credit' ? 'bg-rose-100 text-rose-700' : 'bg-green-100 text-green-700'}`}>
                                  {tx.type}
                                </span>
                              </td>
                              <td className="p-2 max-w-24 truncate" title={tx.note}>{tx.note || "—"}</td>
                              <td className="p-2 text-muted-foreground">{tx.purity || "—"}</td>
                              <td className="p-2 text-right font-medium text-slate-700">
                                {tx.weight > 0 ? `${tx.weight}g` : "—"}
                              </td>
                              <td className="p-2 text-right">
                                 <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteTransaction(tx.id || tx._id || "")} title="Delete Transaction">
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                 </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    </div>
                    {totalSilverPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10 mt-auto">
                        <div className="text-xs text-muted-foreground">Page {currentSilverPage} of {totalSilverPages}</div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-background" onClick={() => setSilverPage(p => Math.max(1, p - 1))} disabled={currentSilverPage === 1}>Prev</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-background" onClick={() => setSilverPage(p => Math.min(totalSilverPages, p + 1))} disabled={currentSilverPage === totalSilverPages}>Next</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">{label}</Label><Input value={v} onChange={e => on(e.target.value)} /></div>;
}
