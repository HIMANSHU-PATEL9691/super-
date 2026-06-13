import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type Purchase, type Supplier } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { purchasesAPI, supplierAPI } from "@/lib/api";
import { Plus, Trash2, ShoppingBag } from "lucide-react";

function calcTaxable(p: Purchase) {
  return (Number(p.weight) || 0) * (Number(p.ratePerGram) || 0) + (Number(p.makingCharge) || 0);
}
function calcGst(p: Purchase) {
  return (calcTaxable(p) * (Number(p.gstPct) || 0)) / 100;
}
function calcTotal(p: Purchase) {
  return calcTaxable(p) + calcGst(p);
}

export default function PurchasesPage() {
  const { data: list = [], isLoading } = useApi<Purchase[]>(["purchases"], () => purchasesAPI.getAll());
  const { data: suppliers = [] } = useApi<Supplier[]>(["suppliers"], () => supplierAPI.getAll());

  const createMutation = useApiMutation((data: Purchase) => purchasesAPI.create(data), ["purchases"]);
  const updateSupplierMutation = useApiMutation((data: { id: string; body: Supplier }) => supplierAPI.update(data.id, data.body), ["suppliers"]);
  const deleteMutation = useApiMutation((id: string) => purchasesAPI.delete(id), ["purchases"]);

  const [open, setOpen] = useState(false);
  const [searchSup, setSearchSup] = useState("");
  const [page, setPage] = useState(1);
  const empty: Purchase = { id: "", billNo: "", date: new Date().toISOString().slice(0,10), supplierId: "", supplierName: "", metal: "Gold", purity: "22K", weight: 0, ratePerGram: 0, makingCharge: 0, gstPct: 3, total: 0, paymentMode: "Cash", note: "" };
  const [form, setForm] = useState<Purchase>(empty);

  const save = async () => {
    if (!form.supplierName || !form.weight) return;
    const billNo = form.billNo || `PUR-${(list.length + 1).toString().padStart(4, "0")}`;
    const total = calcTotal(form);
    try {
      await createMutation.mutateAsync({ ...form, billNo, total });
      
      // Automatically sync metal weight to the Supplier's Ledger
      if (form.supplierId) {
        const supplier = suppliers.find(s => (s._id || s.id) === form.supplierId);
        if (supplier) {
          const newTx = {
            id: Date.now().toString(),
            date: form.date,
            type: "Credit" as const,
            metal: (form.metal === "Silver" ? "Silver" : "Gold") as "Gold" | "Silver",
            purity: form.purity || "",
            weight: Number(form.weight) || 0,
            note: `Purchase Bill No: ${billNo}`
          };

          const updatedSupplier = {
            ...supplier,
            balanceGold: (supplier.balanceGold || 0) + (form.metal === "Gold" ? Number(form.weight) : 0),
            balanceSilver: (supplier.balanceSilver || 0) + (form.metal === "Silver" ? Number(form.weight) : 0),
            transactions: [...(supplier.transactions || []), newTx]
          };

          await updateSupplierMutation.mutateAsync({ id: supplier._id || supplier.id, body: updatedSupplier });
        }
      }

      setForm(empty); 
      setOpen(false);
    } catch (error) {
      console.error("[Purchases] Error saving to DB:", error);
    }
  };
  const remove = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };
  const monthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
  const monthTotal = list.filter(p => { const d = new Date(p.date); return `${d.getFullYear()}-${d.getMonth()}` === monthKey; }).reduce((s, p) => s + p.total, 0);

  const totalPages = Math.ceil(list.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = list.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div><h1 className="text-4xl">Purchases</h1><p className="text-muted-foreground mt-1">Stock & metal purchased from suppliers.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg" className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2"/>New Purchase</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto" aria-describedby={undefined}><DialogHeader><DialogTitle>Record Purchase</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Search Supplier</Label>
                  <Input placeholder="Search name or mobile..." value={searchSup} onChange={e => {
                    setSearchSup(e.target.value);
                    const match = suppliers.find(s => s.name.toLowerCase() === e.target.value.toLowerCase() || (s.mobile||"").includes(e.target.value));
                    if (match) setForm({...form, supplierId: match._id || match.id, supplierName: match.name});
                  }} />
                </div>
                <div>
                  <Label className="text-xs">Supplier *</Label>
                  <Select value={form.supplierId || ""} onValueChange={val => {
                    const s = suppliers.find(x => (x._id || x.id) === val);
                    if (s) setForm({...form, supplierId: val, supplierName: s.name});
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.filter(s => s.name.toLowerCase().includes(searchSup.toLowerCase()) || (s.mobile||"").includes(searchSup)).map(s => (
                        <SelectItem key={s._id || s.id} value={s._id || s.id}>{s.name} · {s.mobile}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Metal</Label>
                <select className="w-full h-10 border rounded-md px-3 bg-background" value={form.metal} onChange={e => setForm({...form, metal: e.target.value as Purchase["metal"]})}>
                  <option>Gold</option><option>Silver</option><option>Diamond</option><option>Other</option>
                </select></div>
              <Field label="Purity" v={form.purity || ""} on={v => setForm({...form, purity: v})} />
              <Field label="Weight (g) *" type="number" v={String(form.weight)} on={v => setForm({...form, weight: +v})} />
              <Field label="Rate ₹/g" type="number" v={String(form.ratePerGram)} on={v => setForm({...form, ratePerGram: +v})} />
              <Field label="Making Charge ₹" type="number" v={String(form.makingCharge)} on={v => setForm({...form, makingCharge: +v})} />
              <Field label="GST %" type="number" v={String(form.gstPct)} on={v => setForm({...form, gstPct: +v})} />
              <Field label="Bill Date" type="date" v={form.date} on={v => setForm({...form, date: v})} />
              <div><Label className="text-xs">Payment Mode</Label>
                <select className="w-full h-10 border rounded-md px-3 bg-background" value={form.paymentMode} onChange={e => setForm({...form, paymentMode: e.target.value as Purchase["paymentMode"]})}>
                  {["Cash","UPI","Card","Bank","Credit"].map(m => <option key={m}>{m}</option>)}
                </select></div>
              <div className="col-span-2"><Field label="Note" v={form.note || ""} on={v => setForm({...form, note: v})} /></div>
              <div className="col-span-2 bg-muted/30 p-3 rounded-md flex flex-col sm:flex-row justify-between items-center text-sm border border-border mt-2">
                 <div className="text-muted-foreground font-medium">
                    Taxable: <span className="text-foreground">{inr(calcTaxable(form))}</span> <span className="mx-2 text-border">|</span> GST ({form.gstPct || 0}%): <span className="text-amber-600">{inr(calcGst(form))}</span>
                 </div>
                 <div className="text-muted-foreground font-medium mt-2 sm:mt-0">Grand Total: <span className="font-display text-lg text-foreground ml-2">{inr(calcTotal(form))}</span></div>
              </div>
            </div>
            <Button onClick={save} className="mt-2">Save</Button>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Total Purchases" value={list.length} />
        <Stat label="This Month" value={inr(monthTotal)} />
        <Stat label="Suppliers Used" value={new Set(list.map(p => p.supplierName)).size} />
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><ShoppingBag className="w-5 h-5"/>Purchase Bills</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center text-muted-foreground py-12">Loading purchases...</p> : list.length === 0 ? <p className="text-center text-muted-foreground py-12">No purchases yet.</p> :
          <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b"><tr><th className="py-2">Bill</th><th>Date</th><th>Supplier</th><th>Metal</th><th className="text-right">Wt</th><th className="text-right">Rate</th><th className="text-right">GST</th><th>Mode</th><th className="text-right">Total</th><th></th></tr></thead>
          <tbody>{paginated.map(p => (<tr key={(p as any)._id || p.id} className="border-b last:border-0">
              <td className="py-2 font-medium">{p.billNo}</td><td>{formatDate(p.date)}</td><td className="font-medium">{p.supplierName}</td>
              <td>{p.metal} {p.purity}</td><td className="text-right">{p.weight}g</td><td className="text-right">{inr(p.ratePerGram)}</td>
              <td className="text-right text-muted-foreground">{p.gstPct > 0 ? `${p.gstPct}%` : '—'}</td><td>{p.paymentMode}</td>
              <td className="text-right font-medium text-green-700">{inr(p.total)}</td>
              <td className="text-right"><Button size="icon" variant="ghost" onClick={() => remove((p as any)._id || p.id)}><Trash2 className="w-4 h-4 text-rose-500 hover:text-rose-600"/></Button></td>
            </tr>))}</tbody></table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, list.length)} of {list.length} entries</div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          )}
            </div>}
        </CardContent>
      </Card>
    </Layout>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label><Input type={type} value={v} onChange={e => on(e.target.value)} /></div>;
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-display mt-1">{value}</div></CardContent></Card>;
}
