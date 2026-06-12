import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type Order, type Karigar, useLocalState, useDebounce } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { ordersAPI, customerAPI, karigarsAPI } from "@/lib/api";
import { Plus, Trash2, ShoppingBag, Pencil, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { InvoiceTerms, ShopHeader } from "@/components/InvoiceBranding";

export default function OrdersPage() {
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const { data: list = [], isLoading } = useApi<Order[]>(["orders"], () => ordersAPI.getAll());
  const { data: customers = [] } = useApi<any[]>(["customers"], () => customerAPI.getAll());
  const { data: karigars = [] } = useApi<Karigar[]>(["karigars"], () => karigarsAPI.getAll());
  
  const createMutation = useApiMutation((data: Order) => ordersAPI.create(data), ["orders"]);
  const updateMutation = useApiMutation((data: { id: string; body: Order }) => ordersAPI.update(data.id, data.body), ["orders"]);
  const deleteMutation = useApiMutation((id: string) => ordersAPI.delete(id), ["orders"]);
  const createCustomerMutation = useApiMutation((data: any) => customerAPI.create(data), ["customers"]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchCust, setSearchCust] = useState("");
  const debouncedSearchCust = useDebounce(searchCust, 300);
  const [searchKar, setSearchKar] = useState("");
  const debouncedSearchKar = useDebounce(searchKar, 300);
  const [viewingReceipt, setViewingReceipt] = useState<Order | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [filter, setFilter] = useState<"All" | Order["status"]>("All");
  const [newCust, setNewCust] = useState({ name: "", phone: "", address: "" });
  const empty: Order = {
    id: "",
    orderNo: "",
    date: new Date().toISOString().slice(0, 10),
    customerName: "",
    customerMobile: "",
    customerAddress: "",
    itemDescription: "",
    metal: "Gold",
    purity: "22K",
    fixedPrice: 0,
    advancePaid: 0,
    karigarId: "",
    dueDate: "",
    status: "Pending",
    note: "",
    customerSignature: "",
    authorizedSignatory: "",
  };
  const [form, setForm] = useState<Order>(empty);

  const save = async () => {
    if (!form.itemDescription) return;
    if (form.customerMobile !== "NEW" && !form.customerName) return;
    const orderNo = form.orderNo || `ORD-${(list.length + 1).toString().padStart(4, "0")}`;
    const finalKarigarId = form.karigarId === "unassigned" ? "" : form.karigarId;

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

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: { ...form, customerName: custName, customerMobile: custMobile, customerAddress: custAddress, orderNo, karigarId: finalKarigarId, note: safeNote.trim() } });
        toast.success("Order updated successfully!");
      } else {
        await createMutation.mutateAsync({ ...form, customerName: custName, customerMobile: custMobile, customerAddress: custAddress, orderNo, karigarId: finalKarigarId, note: safeNote.trim() });
        toast.success("Order created successfully!");
      }
      setForm(empty);
      setNewCust({ name: "", phone: "", address: "" });
      setEditingId(null);
      setOpen(false);
    } catch (error) {
      console.error("[Orders] Error saving to DB:", error);
      toast.error("Failed to connect to backend server. Is it running?");
    }
  };

  const setStatus = async (id: string, status: Order["status"]) => {
    const order = list.find(r => r.id === id || (r as any)._id === id);
    if (order) {
      await updateMutation.mutateAsync({ id, body: { ...order, status } });
    }
  };

  const remove = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const activeOrders = list.filter(r => r.status === "Pending" || r.status === "In Progress" || r.status === "Ready").length;
  const totalAdvance = list.reduce((s, r) => s + (r.advancePaid || 0), 0);

  const filtered = useMemo(() => {
    let result = filter === "All" ? list : list.filter(o => o.status === filter);
    if (debouncedQ.trim()) {
      const lowerQ = debouncedQ.toLowerCase().trim();
      result = result.filter(o => 
        o.customerName.toLowerCase().includes(lowerQ) ||
        o.orderNo.toLowerCase().includes(lowerQ) ||
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
          <h1 className="text-4xl">Customer Orders</h1>
          <p className="text-muted-foreground mt-1">Manage custom Jewellery orders and advances.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg" className="w-full sm:w-auto" onClick={() => { setForm(empty); setNewCust({ name: "", phone: "", address: "" }); setEditingId(null); }}><Plus className="w-4 h-4 mr-2"/>New Order</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader><DialogTitle>Create Custom Order</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Customer *</Label>
                <Select value={form.customerMobile || ""} onValueChange={(val) => {
                  if (val === "NEW") {
                    setForm({...form, customerMobile: "NEW", customerName: "", customerAddress: ""});
                  } else {
                    const match = customers.find(c => (c.mobile || c.phone) === val);
                    if (match) setForm({...form, customerName: match.name, customerMobile: match.mobile || (match as any).phone || "", customerAddress: match.address || ""});
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Select or search customer..." /></SelectTrigger>
                  <SelectContent>
                    <div onKeyDown={(e) => e.stopPropagation()} className="p-2">
                      <Input placeholder="Search name or mobile..." value={searchCust} onChange={e => setSearchCust(e.target.value)} className="w-full" />
                    </div>
                    <SelectItem value="NEW" className="font-semibold text-primary">+ Create New Customer</SelectItem>
                    {customers.filter(c => c.name.toLowerCase().includes(debouncedSearchCust.toLowerCase()) || (c.mobile || (c as any).phone || "").includes(debouncedSearchCust)).map((c) => (
                      <SelectItem key={c.mobile || c.phone} value={c.mobile || c.phone}>{c.name} · {c.mobile || (c as any).phone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.customerMobile === "NEW" && (
                <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm space-y-3 mt-2 col-span-2">
                  <div className="space-y-1.5"><Label className="text-xs">Full Name *</Label><Input value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} className="h-8 bg-background" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Mobile No *</Label><Input value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} className="h-8 bg-background" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Address</Label><Input value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} className="h-8 bg-background" /></div>
                </div>
              )}
              <div className="col-span-2">
                <Field label="Customer Address" v={form.customerAddress || ""} on={v => setForm({...form, customerAddress: v})} />
              </div>
              <Field label="Item Description *" v={form.itemDescription} on={v => setForm({...form, itemDescription: v})} />
              <div>
                <Label className="text-xs">Metal</Label>
                <select className="w-full h-10 border rounded-md px-3 bg-background text-sm" value={form.metal} onChange={e => setForm({...form, metal: e.target.value as Order["metal"]})}>
                  <option>Gold</option><option>Silver</option><option>Diamond</option><option>Platinum</option><option>Other</option>
                </select>
              </div>
              <Field label="Purity" v={form.purity} on={v => setForm({...form, purity: v})} />
              <Field label="Fixed Rate ₹ (Optional)" type="number" v={String(form.fixedPrice || "")} on={v => setForm({...form, fixedPrice: +v})} />
              <Field label="Advance Paid ₹" type="number" v={String(form.advancePaid || "")} on={v => setForm({...form, advancePaid: +v})} />
              <Field label="Date" type="date" v={form.date} on={v => setForm({...form, date: v})} />
              <Field label="Due Date" type="date" v={form.dueDate || ""} on={v => setForm({...form, dueDate: v})} />
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
                  <Label className="text-xs">Assign Karigar</Label>
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
              <div className="col-span-2"><Field label="Note" v={form.note || ""} on={v => setForm({...form, note: v})} /></div>
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
            <Button onClick={save} className="mt-2">{editingId ? "Save Changes" : "Save Order"}</Button>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Total Orders" value={list.length} />
        <Stat label="Active Orders" value={activeOrders} />
        <Stat label="Total Advances Collected" value={inr(totalAdvance)} />
      </div>

      <Card className="shadow-sm border-border overflow-hidden flex flex-col">
        <CardHeader className="bg-muted/20 border-b border-border pb-3 pt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-base font-semibold font-display flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" /> All Orders
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search order or customer..."
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
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Ready">Ready</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Loading orders...</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="w-10 h-10 mb-3 opacity-20" />
              <p>No orders found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Order No</th>
                    <th className="py-3 px-4 font-semibold">Customer</th>
                    <th className="py-3 px-4 font-semibold">Item</th>
                    <th className="py-3 px-4 font-semibold">Karigar</th>
                    <th className="py-3 px-4 font-semibold text-right">Fixed Rate</th>
                    <th className="py-3 px-4 font-semibold text-right">Advance</th>
                    <th className="py-3 px-4 font-semibold">Due Date</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(r => {
                    const statusColors: any = {
                      "Pending": "bg-slate-100 text-slate-700",
                      "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
                      "Ready": "bg-green-50 text-green-700 border-green-200",
                      "Delivered": "bg-slate-100 text-slate-500",
                      "Cancelled": "bg-rose-50 text-rose-700 border-rose-200"
                    };
                    
                    return (
                      <tr key={(r as any)._id || r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{r.orderNo}</div>
                          <div className="text-[11px] text-muted-foreground">{formatDate(r.date)}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{r.customerName}</div>
                          <div className="text-xs text-muted-foreground">{r.customerMobile}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{r.itemDescription}</div>
                          <div className="text-xs text-muted-foreground">{r.metal} {r.purity}</div>
                        </td>
                        <td className="py-3 px-4">
                          {karigars.find(k => k._id === r.karigarId || k.id === r.karigarId)?.name || r.note?.match(/\[Assigned:\s*(.*?)\]/)?.[1] || "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-foreground">
                          {r.fixedPrice ? inr(r.fixedPrice) : "—"}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 font-medium">
                          <div>{inr(r.advancePaid)}</div>
                          {r.status === "Delivered" && (r.advancePaid || 0) > 0 && (
                            <span className="inline-block mt-0.5 bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase">Settled</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium">
                          {r.dueDate ? formatDate(r.dueDate) : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Select value={r.status} onValueChange={(v) => setStatus((r as any)._id || r.id, v as Order["status"])} disabled={r.status === 'Delivered'}>
                            <SelectTrigger className={`mx-auto h-7 w-28 text-[10px] font-bold uppercase tracking-wider shadow-none border-transparent ${statusColors[r.status] || ""}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["Pending","In Progress","Ready","Delivered","Cancelled"].filter(s => s !== "Delivered" || r.status === "Delivered").map(s => (
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
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setForm(r); setEditingId((r as any)._id || r.id || null); setOpen(true); }} title="Edit Order">
                              <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => remove((r as any)._id || r.id)} title="Delete Order">
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

      {viewingReceipt && <OrderInvoiceModal order={viewingReceipt} authUser={authUser} onClose={() => setViewingReceipt(null)} />}
    </Layout>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  if (type === "date") {
    return <div className="space-y-1.5"><Label className="text-xs">{label}</Label><DatePicker value={v} onChange={on} className="w-full h-9" /></div>;
  }
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label><Input type={type} value={v} onChange={e => on(e.target.value)} /></div>;
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-display mt-1">{value}</div></CardContent></Card>;
}

function OrderInvoiceModal({ order, authUser, onClose }: { order: Order; authUser: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-100 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:bg-white print:p-0 overflow-y-auto pointer-events-auto">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:max-h-none print:block">
        <div className="p-6 sm:p-10 print:p-0 border-2 border-transparent print:border-none m-2 print:m-0 bg-white overflow-y-auto flex-1 print:overflow-visible">
          
          <ShopHeader documentLabel="Custom Order Receipt" />

          {/* Invoice Meta & Customer Details */}
          <div className="flex justify-between items-start mb-6 text-sm">
            <div>
              <div className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-1">Customer Details:</div>
              <div className="font-bold text-lg">{order.customerName}</div>
              <div className="text-slate-700">{order.customerMobile}</div>
              {order.customerAddress && <div className="text-slate-700 mt-0.5 max-w-xs"><span className="font-medium">Address:</span> {order.customerAddress}</div>}
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold mb-2 text-slate-900">CUSTOM ORDER RECEIPT</div>
              <table className="ml-auto text-left text-slate-700">
                <tbody>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Order No:</td><td className="font-semibold text-slate-900">{order.orderNo}</td></tr>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Date Ordered:</td><td className="font-semibold text-slate-900">{formatDate(order.date)}</td></tr>
                  {order.dueDate && <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Expected Delivery:</td><td className="font-semibold text-slate-900">{formatDate(order.dueDate)}</td></tr>}
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
                <th className="border border-slate-300 py-2 px-3 text-left text-slate-600">Metal & Purity</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-300 last:border-0">
                <td className="border border-slate-300 py-2 px-3 text-center text-slate-600">1</td>
                <td className="border border-slate-300 py-2 px-3 font-semibold">{order.itemDescription}</td>
                <td className="border border-slate-300 py-2 px-3 text-slate-600">{order.metal} - {order.purity}</td>
              </tr>
            </tbody>
          </table>
          </div>

          {/* Calculations & Totals */}
          <div className="flex flex-col sm:flex-row justify-between items-start text-sm gap-6">
            <div className="w-full sm:w-1/2 sm:pr-8 order-2 sm:order-1">
            </div>
            <div className="w-full sm:w-1/2 max-w-sm order-1 sm:order-2">
              <table className="w-full">
                <tbody>
                  {order.fixedPrice ? (
                    <>
                      <tr className="border-t-2 border-slate-300 text-lg">
                        <td className="py-2 font-bold text-slate-900">Fixed Rate</td>
                        <td className="py-2 text-right font-bold text-slate-900">{inr(order.fixedPrice)}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="py-1.5 text-slate-600">
                          Advance Paid
                          {order.status === "Delivered" && (order.advancePaid || 0) > 0 && <span className="ml-2 text-xs font-semibold text-green-700 uppercase tracking-wider bg-green-100 px-2 py-0.5 rounded">Settled</span>}
                        </td>
                        <td className="py-1.5 text-right font-semibold text-green-700">{inr(order.advancePaid)}</td>
                      </tr>
                      <tr className="border-t border-slate-200 text-lg">
                        <td className="py-1.5 font-bold text-slate-900">Balance Due</td>
                        <td className="py-1.5 text-right font-bold text-rose-700">{inr(order.fixedPrice - (order.advancePaid || 0))}</td>
                      </tr>
                    </>
                  ) : (
                    <tr className="border-t-2 border-slate-300 text-lg">
                      <td className="py-2 font-bold text-slate-900">
                        Advance Paid
                        {order.status === "Delivered" && (order.advancePaid || 0) > 0 && <span className="ml-2 text-xs font-semibold text-green-700 uppercase tracking-wider bg-green-100 px-2 py-0.5 rounded">Settled</span>}
                      </td>
                      <td className="py-2 text-right font-bold text-green-700">{inr(order.advancePaid)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="text-center order-2 sm:order-1">
              {order.customerSignature ? (
                <img src={order.customerSignature} alt="Customer Signature" className="h-16 mx-auto mb-2 object-contain" />
              ) : (
                <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>
              )}
              Customer Signature
            </div>
            <div className="normal-case tracking-normal font-normal text-left text-slate-800 order-1 sm:order-2 text-[10px]">
              {authUser?.termsAndConditions ? <div className="whitespace-pre-wrap text-slate-600">{authUser.termsAndConditions}</div> : <InvoiceTerms compact />}
            </div>
            <div className="text-center order-3 sm:order-3">
              {order.authorizedSignatory ? (
                <img src={order.authorizedSignatory} alt="Authorized Signatory" className="h-16 mx-auto mb-2 object-contain" />
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
