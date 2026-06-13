import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type Repair, type Karigar, useDebounce } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { repairsAPI, karigarsAPI, customerAPI } from "@/lib/api";
import { useLocalState } from "@/lib/storage";
import { Plus, Trash2, Wrench, Pencil, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { InvoiceTerms, ShopHeader } from "@/components/InvoiceBranding";

export default function RepairsPage() {
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchCust, setSearchCust] = useState("");
  const debouncedSearchCust = useDebounce(searchCust, 300);
  const [searchKar, setSearchKar] = useState("");
  const debouncedSearchKar = useDebounce(searchKar, 300);
  const empty: Repair = { ticketNo: "", date: new Date().toISOString().slice(0,10), customerName: "", customerMobile: "", customerAddress: "", itemDescription: "", itemWeight: 0, problem: "", advance: 0, deliveryDate: "", karigarId: "", status: "Received", note: "", customerSignature: "", authorizedSignatory: "" };
  const [form, setForm] = useState<Repair>(empty);
  const [viewingReceipt, setViewingReceipt] = useState<Repair | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [filter, setFilter] = useState<"All" | Repair["status"]>("All");
  const [shopProfile, setShopProfile] = useState<any>(null);

  useEffect(() => {
    if (authUser?.tenantId) {
      let API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      API_BASE_URL = API_BASE_URL.replace("localhost", "127.0.0.1");
      const url = API_BASE_URL.endsWith('/api') ? `${API_BASE_URL}/tenants/${authUser.tenantId}` : `${API_BASE_URL}/api/tenants/${authUser.tenantId}`;
      fetch(url)
        .then(res => res.json())
        .then(data => setShopProfile(data))
        .catch(console.error);
    }
  }, [authUser?.tenantId]);

  const { data = [], isLoading, error } = useApi<Repair[]>(["repairs"], () => repairsAPI.getAll());
  const { data: karigars = [] } = useApi<Karigar[]>(["karigars"], () => karigarsAPI.getAll());
  const { data: customers = [] } = useApi<any[]>(["customers"], () => customerAPI.getAll());
  const createMutation = useApiMutation((data: Repair) => repairsAPI.create(data), ["repairs"]);
  const updateMutation = useApiMutation(
    (data: { id: string; body: Repair }) => repairsAPI.update(data.id, data.body),
    ["repairs"]
  );
  const deleteMutation = useApiMutation((id: string) => repairsAPI.delete(id), ["repairs"]);
  const createCustomerMutation = useApiMutation((data: any) => customerAPI.create(data), ["customers"]);
  const [newCust, setNewCust] = useState({ name: "", phone: "", address: "" });

  const list = (data || []).map((item) => ({
    ...item,
    id: item.id || item._id,
    date: item.date ? new Date(item.date).toISOString().slice(0,10) : new Date().toISOString().slice(0,10),
    deliveryDate: item.deliveryDate ? new Date(item.deliveryDate).toISOString().slice(0,10) : "",
  }));

  const save = async () => {
    if (form.customerMobile !== "NEW" && !form.customerName) return;

    let custName = form.customerName;
    let custMobile = form.customerMobile;
    let custAddress = form.customerAddress;

    if (form.customerMobile === "NEW") {
      if (!newCust.name || !newCust.phone) {
        toast.error("Customer name and phone are required for a new customer.");
        return;
      }
      try {
        const created = await createCustomerMutation.mutateAsync(newCust);
        custName = created.name;
        custMobile = created.phone || created.mobile || "";
        custAddress = created.address || "";
      } catch (e) {
        toast.error("Failed to create new customer");
        return;
      }
    }
    const ticketNo = form.ticketNo || `REP-${(list.length + 1).toString().padStart(4, "0")}`;
    const finalKarigarId = form.karigarId === "unassigned" ? "" : form.karigarId;

    // Fallback: Safely tag the assignment in the note just in case the backend silently drops the karigarId column.
    let safeNote = form.note || "";
    if (finalKarigarId) {
      const kName = karigars.find((k) => (k._id || k.id) === finalKarigarId)?.name;
      if (kName && !safeNote.includes(`[Assigned: ${kName}]`)) {
        safeNote = safeNote.replace(/\[Assigned:.*?\]/g, "").trim() + ` [Assigned: ${kName}]`;
      }
    } else {
      safeNote = safeNote.replace(/\[Assigned:.*?\]/g, "").trim();
    }

    const payload = { ...form, customerName: custName, customerMobile: custMobile, customerAddress: custAddress, ticketNo, status: form.status || "Received", karigarId: finalKarigarId, note: safeNote.trim() };

    console.log("[Repairs] Attempting to save to DB:", payload);
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      console.log("[Repairs] Successfully saved to DB!");
      setForm(empty);
      setNewCust({ name: "", phone: "", address: "" });
      setEditingId(null);
      setOpen(false);
    } catch (error: any) {
      console.error("[Repairs] Error saving to DB:", error);
    }
  };

  const setStatus = async (id: string, status: Repair["status"]) => {
    const repair = list.find((r) => r.id === id || r._id === id);
    if (!repair || !repair._id) return;
    await updateMutation.mutateAsync({ id: repair._id, body: { ...repair, status } });
  };

  const remove = async (id: string) => {
    const repair = list.find((r) => r.id === id || r._id === id);
    if (!repair || !repair._id) return;
    await deleteMutation.mutateAsync(repair._id);
  };

  const pending = list.filter((r) => r.status !== "Delivered").length;
  const totalAdvance = list.filter((r) => r.status !== "Delivered").reduce((s, r) => s + (r.advance || 0), 0);

  const filtered = useMemo(() => {
    let result = filter === "All" ? list : list.filter(o => o.status === filter);
    if (debouncedQ.trim()) {
      const lowerQ = debouncedQ.toLowerCase().trim();
      result = result.filter(o => 
        o.customerName.toLowerCase().includes(lowerQ) ||
        o.ticketNo.toLowerCase().includes(lowerQ) ||
        o.customerMobile.includes(lowerQ) ||
        o.itemDescription.toLowerCase().includes(lowerQ)
      );
    }
    return [...result].sort((a, b) => b.date.localeCompare(a.date));
  }, [list, debouncedQ, filter]);

  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl">Repairs</h1>
          <p className="text-muted-foreground mt-1">Customer repair orders & status.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full sm:w-auto" onClick={() => { setForm(empty); setNewCust({ name: "", phone: "", address: "" }); setEditingId(null); }}>
              <Plus className="w-4 h-4 mr-2" />New Repair
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>New Repair Ticket</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Search Customer</Label>
                  <Input 
                    placeholder="Search name or mobile..." 
                    value={searchCust} 
                    onChange={(e) => {
                      setSearchCust(e.target.value);
                      const match = customers.find(c => c.mobile === e.target.value || (c as any).phone === e.target.value || c.name.toLowerCase() === e.target.value.toLowerCase());
                      if (match) setForm({...form, customerName: match.name, customerMobile: match.mobile || (match as any).phone || "", customerAddress: match.address || ""});
                    }} 
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer *</Label>
                  <Select value={form.customerMobile || ""} onValueChange={(val) => {
                    if (val === "NEW") {
                      setForm({...form, customerMobile: "NEW", customerName: "", customerAddress: ""});
                    } else {
                      const match = customers.find(c => (c.mobile || c.phone) === val);
                      if (match) setForm({...form, customerName: match.name, customerMobile: match.mobile || (match as any).phone || "", customerAddress: match.address || ""});
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW" className="font-semibold text-primary">+ Create New Customer</SelectItem>
                      {customers.filter(c => c.name.toLowerCase().includes(debouncedSearchCust.toLowerCase()) || (c.mobile || (c as any).phone || "").includes(debouncedSearchCust)).map((c) => (
                        <SelectItem key={c.mobile || c.phone} value={c.mobile || c.phone}>{c.name} · {c.mobile || (c as any).phone}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.customerMobile === "NEW" && (
                <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm space-y-3 mt-2 col-span-2">
                  <div className="space-y-1.5"><Label className="text-xs">Full Name *</Label><Input value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} className="h-8 bg-background" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Mobile No *</Label><Input value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} className="h-8 bg-background" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Address</Label><Input value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} className="h-8 bg-background" /></div>
                </div>
              )}
              <div className="col-span-2">
                <Field label="Customer Address" v={form.customerAddress || ""} on={(v) => setForm({ ...form, customerAddress: v })} />
              </div>
              <div className="col-span-2">
                <Field label="Item Description" v={form.itemDescription} on={(v) => setForm({ ...form, itemDescription: v })} />
              </div>
              <Field label="Item Weight (g)" type="number" v={String(form.itemWeight)} on={(v) => setForm({ ...form, itemWeight: +v })} />
              <Field label="Problem" v={form.problem} on={(v) => setForm({ ...form, problem: v })} />
              <Field label="Advance ₹" type="number" v={String(form.advance)} on={(v) => setForm({ ...form, advance: +v })} />
              <Field label="Date" type="date" v={form.date} on={(v) => setForm({ ...form, date: v })} />
              <Field label="Delivery Date" type="date" v={form.deliveryDate || ""} on={(v) => setForm({ ...form, deliveryDate: v })} />
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Search Karigar</Label>
                  <Input placeholder="Search name..." value={searchKar} onChange={e => {
                    setSearchKar(e.target.value);
                    const match = karigars.find(k => k.name.toLowerCase() === e.target.value.toLowerCase() || (k.mobile||"").includes(e.target.value));
                    if (match) setForm({...form, karigarId: match._id || match.id});
                  }} />
                </div>
                <div>
                  <Label className="text-xs">Karigar</Label>
                  <Select value={form.karigarId || ""} onValueChange={val => setForm({...form, karigarId: val})}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {karigars.filter(k => k.name.toLowerCase().includes(debouncedSearchKar.toLowerCase()) || (k.mobile||"").includes(debouncedSearchKar)).map(k => (
                        <SelectItem key={k._id || k.id} value={k._id || k.id}>{k.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="col-span-2">
                <Field label="Note" v={form.note || ""} on={(v) => setForm({ ...form, note: v })} />
              </div>
              <div className="col-span-2 bg-muted/40 p-4 rounded-lg border border-border mt-2">
                <Label className="text-muted-foreground font-normal block mb-3">Signatures (Optional)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Customer Signature</Label>
                    <Input type="file" accept="image/*" className="bg-background mt-1" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setForm({ ...form, customerSignature: reader.result as string });
                        reader.readAsDataURL(file);
                      }
                    }} />
                    {form.customerSignature && <img src={form.customerSignature} alt="Customer Signature" className="mt-2 h-16 object-contain" />}
                  </div>
                  <div>
                    <Label className="text-xs">Authorized Signatory</Label>
                    <Input type="file" accept="image/*" className="bg-background mt-1" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setForm({ ...form, authorizedSignatory: reader.result as string });
                        reader.readAsDataURL(file);
                      }
                    }} />
                    {form.authorizedSignatory && <img src={form.authorizedSignatory} alt="Authorized Signatory" className="mt-2 h-16 object-contain" />}
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={save} className="mt-2">
              {editingId ? "Save Changes" : "Create Ticket"}
            </Button>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Total Tickets" value={list.length} />
        <Stat label="Pending" value={pending} />
        <Stat label="Total Advances Collected" value={inr(totalAdvance)} />
      </div>

      <Card className="shadow-sm border-border overflow-hidden flex flex-col">
        <CardHeader className="bg-muted/20 border-b border-border pb-3 pt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-base font-semibold font-display flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" /> All Repair Tickets
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search ticket or customer..."
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  className="pl-9 h-8 bg-background text-xs border-border shadow-sm"
                />
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <SelectTrigger className="w-32 h-8 bg-background text-xs font-medium border-border shadow-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="Received">Received</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Ready">Ready</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Loading repairs...</p>
          ) : error ? (
            <p className="text-center text-red-500 py-12">Failed to load repairs.</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="w-10 h-10 mb-3 opacity-20" />
              <p>No repair tickets found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Ticket</th>
                    <th className="py-3 px-4 font-semibold">Customer</th>
                    <th className="py-3 px-4 font-semibold">Item</th>
                    <th className="py-3 px-4 font-semibold">Karigar</th>
                    <th className="py-3 px-4 font-semibold text-right">Advance</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r) => {
                    const statusColors: any = {
                      "Received": "bg-slate-100 text-slate-700",
                      "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
                      "Ready": "bg-green-50 text-green-700 border-green-200",
                      "Delivered": "bg-slate-100 text-slate-500",
                    };
                    return (
                      <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{r.ticketNo}</div>
                          <div className="text-[11px] text-muted-foreground">{formatDate(r.date)}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{r.customerName}</div>
                          <div className="text-xs text-muted-foreground">{r.customerMobile}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{r.itemDescription}</div>
                          <div className="text-xs text-rose-500">{r.problem}</div>
                        </td>
                        <td className="py-3 px-4">
                          {karigars.find((k) => k._id === r.karigarId || k.id === r.karigarId)?.name || r.note?.match(/\[Assigned:\s*(.*?)\]/)?.[1] || "—"}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 font-medium">
                          <div>{inr(r.advance)}</div>
                          {r.status === "Delivered" && (r.advance || 0) > 0 && (
                            <span className="inline-block mt-0.5 bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase">Settled</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Select value={r.status} onValueChange={(v) => setStatus(r.id || r._id || '', v as Repair['status'])} disabled={r.status === 'Delivered'}>
                            <SelectTrigger className={`mx-auto h-7 w-28 text-[10px] font-bold uppercase tracking-wider shadow-none border-transparent ${statusColors[r.status] || ""}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['Received', 'In Progress', 'Ready', 'Delivered'].filter(s => s !== "Delivered" || r.status === "Delivered").map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewingReceipt(r)} title="Print Receipt">
                              <Printer className="w-4 h-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setForm(r); setEditingId(r.id || r._id || null); setOpen(true); }} title="Edit Repair">
                              <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => remove(r.id || r._id || '')} title="Delete Repair">
                              <Trash2 className="w-4 h-4 text-rose-500 hover:text-rose-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
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

      {viewingReceipt && <RepairInvoiceModal repair={viewingReceipt} shopProfile={shopProfile} onClose={() => setViewingReceipt(null)} />}
    </Layout>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label><Input type={type} value={v} onChange={(e) => on(e.target.value)} /></div>;
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-display mt-1">{value}</div></CardContent></Card>;
}

function RepairInvoiceModal({ repair, shopProfile, onClose }: { repair: Repair; shopProfile: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-100 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:bg-white print:p-0 overflow-y-auto pointer-events-auto">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:max-h-none print:block">
        <div className="p-6 sm:p-10 print:p-0 border-2 border-transparent print:border-none m-2 print:m-0 bg-white overflow-y-auto flex-1 print:overflow-visible">
          
          <ShopHeader documentLabel="Repair Receipt" />

          {/* Invoice Meta & Customer Details */}
          <div className="flex justify-between items-start mb-6 text-sm">
            <div>
              <div className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-1">Customer Details:</div>
              <div className="font-bold text-lg">{repair.customerName}</div>
              <div className="text-slate-700">{repair.customerMobile}</div>
              {repair.customerAddress && <div className="text-slate-700 mt-0.5 max-w-xs"><span className="font-medium">Address:</span> {repair.customerAddress}</div>}
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold mb-2 text-slate-900">REPAIR RECEIPT</div>
              <table className="ml-auto text-left text-slate-700">
                <tbody>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Ticket No:</td><td className="font-semibold text-slate-900">{repair.ticketNo}</td></tr>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Date Received:</td><td className="font-semibold text-slate-900">{formatDate(repair.date)}</td></tr>
                  {repair.deliveryDate && <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Delivery Date:</td><td className="font-semibold text-slate-900">{formatDate(repair.deliveryDate)}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto w-full mb-6">
            <table className="w-full text-sm border-collapse border border-slate-300 min-w-100">
              <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 py-2 px-3 text-center w-12 text-slate-600">#</th>
                <th className="border border-slate-300 py-2 px-3 text-left text-slate-600">Item Description</th>
                <th className="border border-slate-300 py-2 px-3 text-left text-slate-600">Problem / Work Done</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Weight (g)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-300 last:border-0">
                <td className="border border-slate-300 py-2 px-3 text-center text-slate-600">1</td>
                <td className="border border-slate-300 py-2 px-3 font-semibold">{repair.itemDescription}</td>
                <td className="border border-slate-300 py-2 px-3 text-rose-600">{repair.problem}</td>
                <td className="border border-slate-300 py-2 px-3 text-right">{repair.itemWeight} g</td>
              </tr>
            </tbody>
          </table>
          </div>

          {/* Calculations & Totals */}
          <div className="flex flex-col sm:flex-row justify-between items-start text-sm gap-6">
            <div className="w-full sm:w-1/2 sm:pr-8 order-2 sm:order-1"></div>
            <div className="w-full sm:w-1/2 max-w-sm order-1 sm:order-2">
              <table className="w-full">
                <tbody>
                  <tr className="border-t-2 border-slate-300 text-lg">
                    <td className="py-2 font-bold text-slate-900">
                      Advance Paid
                      {repair.status === "Delivered" && (repair.advance || 0) > 0 && <span className="ml-2 text-xs font-semibold text-green-700 uppercase tracking-wider bg-green-100 px-2 py-0.5 rounded">Settled</span>}
                    </td>
                    <td className="py-2 text-right font-bold text-green-700">{inr(repair.advance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="text-center order-2 sm:order-1">
              {repair.customerSignature ? (
                <img src={repair.customerSignature} alt="Customer Signature" className="h-16 mx-auto mb-2 object-contain" />
              ) : (
                <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>
              )}
              Customer Signature
            </div>
            <div className="normal-case tracking-normal font-normal text-left text-slate-800 order-1 sm:order-2 text-[10px]">
              {shopProfile?.termsAndConditions ? <div className="whitespace-pre-wrap text-slate-600">{shopProfile.termsAndConditions}</div> : <InvoiceTerms compact />}
            </div>
            <div className="text-center order-3 sm:order-3">
              {repair.authorizedSignatory ? (
                <img src={repair.authorizedSignatory} alt="Authorized Signatory" className="h-16 mx-auto mb-2 object-contain" />
              ) : (
                <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>
              )}
              Authorized Signatory
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="shrink-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-lg flex justify-end gap-3 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
