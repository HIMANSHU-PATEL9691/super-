import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { Plus, Trash2, Pencil, Search, Loader2, Eye, Receipt, Wallet, ShoppingBag, UserCheck, Wrench, MessageCircle, Printer } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { customerAPI, invoicesAPI, ordersAPI, girviAPI, repairsAPI } from "@/lib/api";
import { inr, calcItem, type Invoice, type Order, type Girvi, type Repair, useLocalState, useDebounce } from "@/lib/storage";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { InvoiceTerms, ShopHeader } from "@/components/InvoiceBranding";

interface Customer {
  _id?: string;
  id?: string;
  name: string;
  phone: string;
  phone2?: string;
  address: string;
  gstNumber?: string;
  pan?: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

const empty: Customer = {
  name: "",
  phone: "",
  phone2: "",
  address: "",
  gstNumber: "",
  pan: "",
  notes: "",
};

const defaultManualDue = {
  customerId: "NEW",
  customerName: "",
  phone: "",
  phone2: "",
  address: "",
  gstNumber: "",
  pan: "",
  notes: "",
  itemName: "",
  purity: "22K",
  netWeight: "" as number | "",
  ratePerGram: "" as number | "",
  makingCharge: "" as number | "",
  dueAmount: "" as number | "",
  date: new Date().toISOString().slice(0, 10),
};

export default function CustomersPage() {
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Customer>(empty);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [viewingRepair, setViewingRepair] = useState<Repair | null>(null);
  const [profileSearchQuery, setProfileSearchQuery] = useState("");
  const debouncedProfileSearchQuery = useDebounce(profileSearchQuery, 300);

  // Fetch customers
  const { data: customers = [], isLoading, error } = useApi(
    ["customers"],
    () => customerAPI.getAll()
  );

  const { data: allInvoices = [] } = useApi<Invoice[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: orders = [] } = useApi<Order[]>(["orders"], () => ordersAPI.getAll());
  const { data: girvis = [] } = useApi<Girvi[]>(["girvis"], () => girviAPI.getAll());
  const { data: repairs = [] } = useApi<Repair[]>(["repairs"], () => repairsAPI.getAll());

  const isOperator = authUser?.role === "operator";
  const invoices = useMemo(() => allInvoices.filter(i => isOperator ? i.type === "GST" : i.type !== "GST"), [allInvoices, isOperator]);

  const createInvoiceMutation = useApiMutation(
    (data: any) => invoicesAPI.create(data),
    ["invoices"]
  );

  // Create mutation
  const createMutation = useApiMutation(
    (data: Customer) => customerAPI.create(data),
    ["customers"]
  );

  // Update mutation
  const updateMutation = useApiMutation(
    (data: { id: string; body: Customer }) => customerAPI.update(data.id, data.body),
    ["customers"]
  );

  // Delete mutation
  const deleteMutation = useApiMutation(
    (id: string) => customerAPI.delete(id),
    ["customers"]
  );

  // Update Invoice mutation
  const updateInvoiceMutation = useApiMutation(
    (data: { id: string; body: Partial<Invoice> }) => invoicesAPI.update(data.id, data.body),
    ["invoices"]
  );

  // Update Order mutation
  const updateOrderMutation = useApiMutation(
    (data: { id: string; body: Partial<Order> }) => ordersAPI.update(data.id, data.body),
    ["orders"]
  );
  // Update Repair mutation
  const updateRepairMutation = useApiMutation(
    (data: { id: string; body: Partial<Repair> }) => repairsAPI.update(data.id, data.body),
    ["repairs"]
  );

  const filtered = customers.filter(
    (c: Customer) =>
      c.name.toLowerCase().includes(debouncedQ.toLowerCase()) ||
      c.phone.includes(debouncedQ) ||
      (c.phone2 && c.phone2.includes(debouncedQ))
  );

  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  const startNew = () => {
    setEditingId(null);
    const query = q.trim();
    const isNumber = /^\d+$/.test(query);
    setDraft({ 
      ...empty, 
      phone: isNumber ? query : "",
      name: !isNumber ? query : ""
    });
    setOpen(true);
  };

  const startEdit = (c: Customer) => {
    setEditingId(c._id || null);
    setDraft(c);
    setOpen(true);
  };

  const save = async () => {
    console.log("[Frontend Component] Attempting to save customer draft:", draft);
    if (!draft.name) {
      toast.error("Customer Name is required");
      return;
    }
    if (!draft.phone) {
      toast.error("Mobile No is required");
      return;
    }
    if (!draft.address) {
      toast.error("Address is required");
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          body: draft,
        });
        toast.success("Customer updated successfully");
      } else {
        await createMutation.mutateAsync(draft);
        toast.success("Customer created successfully");
        setQ(""); // Clear the search bar so the newly added customer is visible
      }
      setOpen(false);
      setDraft(empty);
      setEditingId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to save customer");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Customer deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete customer");
    }
  };

  const set = <K extends keyof Customer>(k: K, v: Customer[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const isLoading_UI = isLoading || createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const selectedCustomer = customers.find((c: Customer) => c._id === profileId);
  
  const custInvoices = invoices.filter(i => i.customerId === profileId || i.customerMobile === selectedCustomer?.phone);
  const custOrders = orders.filter(o => o.customerMobile === selectedCustomer?.phone);
  const custGirvis = girvis.filter(g => g.customerMobile === selectedCustomer?.phone || g.customerMobile2 === selectedCustomer?.phone);
  const custRepairs = repairs.filter(r => r.customerMobile === selectedCustomer?.phone);

  const filteredCustInvoices = custInvoices.filter(i => {
    if (!debouncedProfileSearchQuery) return true;
    const query = debouncedProfileSearchQuery.toLowerCase();
    const matchNo = (i.number || "").toLowerCase().includes(query);
    const matchDate = formatDate(i.createdAt).toLowerCase().includes(query);
    const matchItem = (i.items || []).some((it: any) => (it.name || "").toLowerCase().includes(query));
    return matchNo || matchDate || matchItem;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Sort newest first

  const totalSales = custInvoices.filter(i => !i.number?.startsWith("MAN-")).reduce((s, i) => s + i.total, 0);
  const totalPaid = custInvoices.reduce((s, i) => s + (i.amountPaid !== undefined ? i.amountPaid : i.total), 0);
  const totalDue = custInvoices.reduce((s, i) => s + (i.balanceDue || 0), 0);

  const [payModal, setPayModal] = useState<{ type: 'invoice'|'order'|'repair', item: any, due: number } | null>(null);
  const [payAmount, setPayAmount] = useState<number | "">("");
  const [payMode, setPayMode] = useState("Cash");
  const [payNote, setPayNote] = useState("");

  const [manualDueOpen, setManualDueOpen] = useState(false);
  const [manualDue, setManualDue] = useState(defaultManualDue);

  const saveManualDue = async () => {
    if (!manualDue.date || manualDue.dueAmount === "") {
      toast.error("Please fill required fields (Date, Due Amount)");
      return;
    }
    
    let cid = manualDue.customerId;
    let cName = manualDue.customerName;
    let cPhone = manualDue.phone;

    if (!cid || cid === "NEW") {
      if (!cName || !cPhone) {
         toast.error("Customer name and phone are required for a new customer");
         return;
      }
      try {
        const newCust = await createMutation.mutateAsync({
          name: cName,
          phone: cPhone,
          phone2: manualDue.phone2,
          address: manualDue.address,
          gstNumber: manualDue.gstNumber,
          pan: manualDue.pan,
          notes: manualDue.notes,
        } as Customer);
        cid = newCust._id || newCust.id || "";
      } catch (e: any) {
        toast.error("Failed to create customer: " + (e.message || "Unknown error"));
        return;
      }
    }

    const due = Number(manualDue.dueAmount);
    const total = due;
    const paid = 0;
    const isoDate = new Date(manualDue.date).toISOString();

    const inv: any = {
      number: "MAN-" + Date.now().toString().slice(-6),
      type: "NON-GST",
      createdAt: isoDate,
      customerId: cid,
      customerName: cName,
      customerMobile: cPhone,
      items: [{ productId: "manual", name: manualDue.itemName ? `Manual Due: ${manualDue.itemName}` : "Manual Due", purity: manualDue.purity || "-", netWeight: Number(manualDue.netWeight) || 0, ratePerGram: Number(manualDue.ratePerGram) || 0, makingCharge: Number(manualDue.makingCharge) || 0, stoneCharge: 0, makingChargePct: 0, gstPct: 0, qty: 1 }],
      discount: 0,
      oldGoldAmount: 0,
      paymentMode: "Cash",
      subtotal: total,
      gstAmount: 0,
      total: total,
      amountPaid: paid,
      balanceDue: due,
      payments: [],
    };
    try {
      const savedInv = await createInvoiceMutation.mutateAsync(inv);
      toast.success("Manual due added successfully");
      setManualDueOpen(false);
      setManualDue(defaultManualDue);
      setViewingInvoice(savedInv as Invoice);
    } catch (e) {
      toast.error("Failed to add manual due");
    }
  };

  const openPayModal = (type: 'invoice'|'order'|'repair', item: any, due: number) => {
    setPayModal({ type, item, due });
    setPayAmount(due);
    setPayMode("Cash");
    setPayNote("");
  };

  const submitPayment = async () => {
    if (!payModal || !payAmount || payAmount <= 0) return;
    const amt = Number(payAmount);

    try {
      if (payModal.type === 'invoice') {
        const inv = payModal.item as Invoice;
        const newPaid = (inv.amountPaid || 0) + amt;
        const newDue = Math.max(0, (inv.balanceDue || 0) - amt);
        const newPayment = { date: new Date().toISOString(), amount: amt, mode: payMode, note: payNote };
        const updatedPayments = [...(inv.payments || []), newPayment];
        const updatedInvoice = await updateInvoiceMutation.mutateAsync({
          id: inv._id || inv.id,
          body: { ...inv, amountPaid: newPaid, balanceDue: newDue, payments: updatedPayments } as Partial<Invoice>
        });
        toast.success("Payment recorded successfully!");
        setPayModal(null);
        setViewingInvoice(updatedInvoice as Invoice);
      } else if (payModal.type === 'order') {
        const ord = payModal.item as Order;
        const newPaid = (ord.advancePaid || 0) + amt;
        const updatedOrder = await updateOrderMutation.mutateAsync({
          id: ord._id || ord.id,
          body: { ...ord, advancePaid: newPaid } as Partial<Order>
        });
        toast.success("Payment recorded successfully!");
        setPayModal(null);
        setViewingOrder(updatedOrder as Order);
      } else if (payModal.type === 'repair') {
        const rep = payModal.item as Repair;
        const newPaid = (rep.advance || 0) + amt;
        const updatedRepair = await updateRepairMutation.mutateAsync({
          id: rep._id || rep.id || "",
          body: { ...rep, advance: newPaid } as Partial<Repair>
        });
        toast.success("Payment recorded successfully!");
        setPayModal(null);
        setViewingRepair(updatedRepair as Repair);
      }
    } catch (e) {
      toast.error("Failed to record payment");
    }
  };

  const allPayments = custInvoices
    .flatMap(inv => {
      const pmts = [...(inv.payments || [])];
      const hasInitial = pmts.some(p => p.note === "Initial Payment");
      if (!hasInitial) {
        const subsequentSum = pmts.reduce((s, p) => s + p.amount, 0);
        const totalPaid = inv.amountPaid !== undefined ? inv.amountPaid : inv.total;
        const initialAmt = totalPaid - subsequentSum;
        if (initialAmt > 0) {
          pmts.push({
            date: inv.createdAt,
            amount: initialAmt,
            mode: inv.paymentMode,
            note: "Initial Payment"
          });
        }
      }
      return pmts.map(p => ({ ...p, invoiceNo: inv.number }));
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const groupedPayments = allPayments.reduce((acc, p) => {
    if (!acc[p.invoiceNo]) acc[p.invoiceNo] = [];
    acc[p.invoiceNo].push(p);
    return acc;
  }, {} as Record<string, typeof allPayments>);

  const sendComprehensiveReminder = () => {
    if (!selectedCustomer?.phone) {
      toast.error("No phone number available for this customer.");
      return;
    }

    let message = `*अरिहंत ज्वेलर्स*\n-----------------------------------\nनमस्ते ${selectedCustomer.name},\nआपके खाते का बकाया विवरण नीचे दिया गया है:\n\n`;
    let hasDues = false;
    let overallTotal = 0;

    const dueInvoices = custInvoices.filter(i => (i.balanceDue || 0) > 0);
    if (dueInvoices.length > 0) {
      hasDues = true;
      message += `🧾 *बकाया बिल (Pending Bills)*\n-----------------------------------\n`;
      dueInvoices.forEach(i => {
        message += `▪️ बिल: ${i.number}\n   बकाया: ${inr(i.balanceDue || 0)}\n\n`;
        overallTotal += (i.balanceDue || 0);
      });
      message += `*कुल बिल बकाया: ${inr(totalDue)}*\n-----------------------------------\n\n`;
    }

    const activeGirvi = custGirvis.filter(g => g.status === "Active");
    if (activeGirvi.length > 0) {
      hasDues = true;
      message += `📦 *सक्रिय गिरवी (Active Girvi)*\n-----------------------------------\n`;
      activeGirvi.forEach(g => {
        message += `▪️ लोन: ${g.loanNo} (${g.itemType})\n   मूलधन: ${inr(g.loanAmount)}\n\n`;
      });
      message += `-----------------------------------\n\n`;
    }

    const dueRepairs = custRepairs.filter(r => ((r.estimate || 0) - (r.advance || 0)) > 0 && r.status !== "Delivered");
    if (dueRepairs.length > 0) {
      hasDues = true;
      let totalRepairDue = 0;
      message += `🔧 *रिपेयर बकाया (Repair Dues)*\n-----------------------------------\n`;
      dueRepairs.forEach(r => {
        const rDue = (r.estimate || 0) - (r.advance || 0);
        totalRepairDue += rDue;
        message += `▪️ टिकट: ${r.ticketNo}\n   बकाया: ${inr(rDue)}\n\n`;
      });
      overallTotal += totalRepairDue;
      message += `*कुल रिपेयर बकाया: ${inr(totalRepairDue)}*\n-----------------------------------\n\n`;
    }

    if (!hasDues) {
      toast.error("No pending dues or active loans to share.");
      return;
    }

    if (overallTotal > 0) {
       message += `*कुल भुगतान योग्य (Total Payable): ${inr(overallTotal)}*\n-----------------------------------\n\n`;
    }

    message += `कृपया जल्द से जल्द बकाया राशि का भुगतान करें।\nअधिक जानकारी के लिए हमसे संपर्क करें।\n\nधन्यवाद!`;

    let phone = selectedCustomer.phone.replace(/\D/g, "");
    if (phone.length === 10) phone = "91" + phone;
    
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
  };

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Customers</h1>
          <p className="text-muted-foreground mt-1">{customers.length} on file.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={() => {
            setManualDue({ ...defaultManualDue, date: new Date().toISOString().slice(0, 10) });
            setManualDueOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" /> Manual Due
          </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" onClick={startNew} disabled={isLoading_UI}>
              <Plus className="w-4 h-4 mr-2" /> Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[75vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                {editingId ? "Edit" : "New"} customer
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <F label="Customer Name *">
                <Input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Customer name"
                />
              </F>
              <F label="Mobile No *">
                <Input
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="Primary mobile number"
                />
              </F>
              <F label="Mobile No 2 (optional)">
                <Input
                  value={draft.phone2 || ""}
                  onChange={(e) => set("phone2", e.target.value)}
                  placeholder="Secondary mobile number"
                />
              </F>
              <F label="Address *">
                <Input
                  value={draft.address || ""}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Full address"
                />
              </F>
              <F label="GST No (optional)">
                <Input
                  value={draft.gstNumber || ""}
                  onChange={(e) => set("gstNumber", e.target.value)}
                  placeholder="GSTIN"
                />
              </F>
              <F label="PAN No (optional)">
                <Input
                  value={draft.pan || ""}
                  onChange={(e) => set("pan", e.target.value)}
                  placeholder="PAN number"
                />
              </F>
              <F label="Notes (optional)">
                <Input
                  value={draft.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Additional notes"
                />
              </F>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading_UI}>
                Cancel
              </Button>
              <Button onClick={save} disabled={isLoading_UI || !draft.name || !draft.phone || !draft.address}>
                {isLoading_UI ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </header>

      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 bg-background"
          placeholder="Search by name or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      <Card className="shadow-sm border-border overflow-hidden flex flex-col">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Loading customers...</p>
          ) : error ? (
            <p className="text-sm text-red-500 py-12 text-center">Failed to load customers</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No customers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4 font-semibold">Name</th>
                  <th className="py-3 px-4 font-semibold">Phone</th>
                  <th className="py-3 px-4 font-semibold">Address</th>
                  <th className="py-3 px-4 font-semibold">GST No</th>
                  <th className="py-3 px-4 font-semibold">PAN No</th>
                  <th className="py-3 px-4 font-semibold">Added</th>
                  <th className="py-3 px-4 font-semibold text-right">Due Amount</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
            {paginated.map((c: Customer) => {
                  const custDue = invoices
                    .filter((i) => i.customerId === c._id || i.customerMobile === c.phone)
                    .reduce((sum, i) => sum + (i.balanceDue || 0), 0);

                  return (
                    <tr key={c._id || c.id || c.phone} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">{c.name}</td>
                    <td className="py-3 px-4">
                      <div>{c.phone}</div>
                      {c.phone2 && <div className="text-xs text-muted-foreground">{c.phone2}</div>}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{c.address || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{c.gstNumber || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{c.pan || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {c.createdAt ? formatDate(c.createdAt) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-rose-600">
                      {custDue > 0 ? inr(custDue) : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1 justify-end pr-3">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setProfileId(c._id || null);
                            setProfileSearchQuery("");
                          }}
                          title="View Profile"
                        >
                          <Eye className="w-4 h-4 text-muted-foreground hover:text-primary" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(c)}
                          disabled={isLoading_UI}
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(c._id || "")}
                          disabled={isLoading_UI}
                        >
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

      {/* Customer Profile Dialog */}
      <Dialog open={!!profileId} onOpenChange={(val) => {
        if (!val) setProfileId(null);
        setProfileSearchQuery("");
      }}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pr-8 gap-4">
                  <DialogTitle className="text-2xl font-display flex items-center gap-2">
                    <UserCheck className="w-6 h-6 text-primary" />
                    {selectedCustomer.name}'s Profile
                  </DialogTitle>
                  <Button variant="outline" size="sm" onClick={sendComprehensiveReminder} className="border-green-200 text-green-700 hover:bg-green-50 shrink-0" title="Share All Dues via WhatsApp">
                    <MessageCircle className="w-4 h-4 mr-2" /> Share Dues
                  </Button>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                {/* Contact Info */}
                <Card className="md:col-span-1 shadow-none border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-display text-muted-foreground">Contact Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Mobile</div>
                      <div className="font-medium">{selectedCustomer.phone} {selectedCustomer.phone2 ? `/ ${selectedCustomer.phone2}` : ""}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Address</div>
                      <div className="font-medium">{selectedCustomer.address || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">GST No</div>
                      <div className="font-medium">{selectedCustomer.gstNumber || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">PAN No</div>
                      <div className="font-medium">{selectedCustomer.pan || "—"}</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Summary */}
                <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="shadow-none border-border">
                    <CardContent className="pt-6">
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Receipt className="w-4 h-4"/> Total Sales</div>
                      <div className="text-xl font-display mt-1 text-primary">{inr(totalSales)}</div>
                      <div className="text-xs text-muted-foreground mt-1">{custInvoices.length} bills</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none border-border">
                    <CardContent className="pt-6">
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-4 h-4 text-green-500"/> Total Paid</div>
                      <div className="text-xl font-display mt-1 text-green-600">{inr(totalPaid)}</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none border-border">
                    <CardContent className="pt-6">
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-4 h-4 text-rose-500"/> Balance Due</div>
                      <div className="text-xl font-display mt-1 text-rose-600">{inr(totalDue)}</div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Invoices List */}
              <div className="mt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
                  <h3 className="font-display text-lg flex items-center gap-2"><Receipt className="w-5 h-5"/> Billing History</h3>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input 
                        className="pl-9 h-9 bg-background text-sm" 
                        placeholder="Search invoice, item, or date..." 
                        value={profileSearchQuery} 
                        onChange={(e) => setProfileSearchQuery(e.target.value)} 
                      />
                    </div>
                    <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={() => {
                      setManualDue({
                        ...defaultManualDue,
                        date: new Date().toISOString().slice(0, 10),
                        customerId: selectedCustomer?._id || selectedCustomer?.id || "NEW",
                        customerName: selectedCustomer?.name || "",
                        phone: selectedCustomer?.phone || "",
                        phone2: selectedCustomer?.phone2 || "",
                        address: selectedCustomer?.address || "",
                        gstNumber: selectedCustomer?.gstNumber || "",
                        pan: selectedCustomer?.pan || "",
                        notes: selectedCustomer?.notes || "",
                      });
                      setManualDueOpen(true);
                    }}>+ Add Manual Due</Button>
                  </div>
                </div>
                <Card className="shadow-none border-border">
                  <CardContent className="p-0">
                    {filteredCustInvoices.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        {custInvoices.length === 0 ? "No bills for this customer." : "No bills match your search."}
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-muted-foreground border-b bg-muted/20">
                          <tr>
                            <th className="py-2 px-4">Invoice</th>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Items</th>
                            <th className="text-right">Total</th>
                            <th className="text-right">Paid</th>
                            <th className="text-right px-4">Due</th>
                            <th className="text-right px-4">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCustInvoices.map((inv) => (
                            <tr key={inv._id || inv.id || inv.number} className="border-b last:border-0 hover:bg-muted/40">
                              <td className="py-2 px-4 font-medium">{inv.number}</td>
                              <td>{formatDate(inv.createdAt)}</td>
                              <td>{inv.type === "NON-GST" && inv.number?.startsWith("MAN-") ? "Manual Due" : inv.type}</td>
                              <td className="py-2">
                                <div className="text-xs text-muted-foreground truncate max-w-40" title={inv.items?.map(it => it.name).join(", ")}>
                                  {inv.items?.map(it => it.name).join(", ") || "—"}
                                </div>
                              </td>
                              <td className="text-right">{inr(inv.total)}</td>
                              <td className="text-right text-green-600">{inr(inv.amountPaid !== undefined ? inv.amountPaid : inv.total)}</td>
                              <td className="text-right px-4 text-rose-600 font-medium">{inr(inv.balanceDue || 0)}</td>
                              <td className="text-right px-4">
                                <div className="flex justify-end items-center gap-2">
                                  <Button size="sm" variant="ghost" onClick={() => setViewingInvoice(inv)} title="View Invoice">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  {(inv.balanceDue || 0) > 0 && (
                                    <Button size="sm" variant="outline" onClick={() => openPayModal('invoice', inv, inv.balanceDue || 0)}>Pay Due</Button>
                                  )}
                                  {(inv.balanceDue || 0) <= 0 && (
                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase inline-block">Paid</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>
              {/* Payment History */}
              <div className="mt-4">
                <h3 className="font-display text-lg mb-3 flex items-center gap-2"><Wallet className="w-5 h-5"/> Payment History</h3>
                <Card className="shadow-none border-border">
                  <CardContent className="p-4">
                    {Object.keys(groupedPayments).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No payments recorded.</p>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {Object.entries(groupedPayments).map(([invNo, pmts]) => (
                          <div key={invNo} className="border border-border rounded-lg overflow-hidden">
                            <div className="bg-muted/20 px-4 py-2 font-medium text-sm text-primary flex justify-between items-center border-b border-border/50">
                              <span>Bill / Due: {invNo}</span>
                              <span className="text-xs text-muted-foreground">Total Paid: <span className="text-green-600 font-bold">{inr(pmts.reduce((s, p) => s + p.amount, 0))}</span></span>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-muted-foreground">Total Paid: <span className="text-green-600 font-bold">{inr(pmts.reduce((s, p) => s + p.amount, 0))}</span></span>
                                <Button size="sm" variant="outline" className="h-7 text-xs bg-background hover:bg-muted" onClick={() => {
                                  const inv = custInvoices.find(i => i.number === invNo);
                                  if (inv) setViewingInvoice(inv);
                                }}>
                                  <Eye className="w-3 h-3 mr-1" /> View Invoice
                                </Button>
                              </div>
                            </div>
                            <table className="w-full text-sm">
                              <thead className="text-left text-muted-foreground border-b border-border/50">
                                <tr>
                                  <th className="py-2 px-4 w-1/4">Date</th>
                                  <th className="w-1/4">Mode</th>
                                  <th className="w-1/4">Note</th>
                                  <th className="text-right px-4 w-1/4">Amount Paid</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pmts.map((p, idx) => (
                                  <tr key={`${invNo}-${p.date}-${p.amount}-${p.mode}-${idx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/40">
                                    <td className="py-2 px-4">{formatDate(p.date)}</td>
                                    <td>{p.mode}</td>
                                    <td className="text-muted-foreground">{p.note || "—"}</td>
                                    <td className="text-right px-4 text-green-600 font-medium">{inr(p.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Active Orders */}
              <div className="mt-4">
                <h3 className="font-display text-lg mb-3 flex items-center gap-2"><ShoppingBag className="w-5 h-5"/> Custom Orders</h3>
                <Card className="shadow-none border-border">
                  <CardContent className="p-0">
                    {custOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No orders.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-muted-foreground border-b bg-muted/20">
                          <tr>
                            <th className="py-2 px-4">Order No</th>
                            <th>Date</th>
                            <th>Item Details</th>
                            <th className="text-right">Paid</th>
                            <th className="text-center px-4">Status</th>
                            <th className="text-right px-4">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {custOrders.map((o) => {
                            return (
                            <tr key={o.id || o.orderNo} className="border-b last:border-0 hover:bg-muted/40">
                              <td className="py-2 px-4 font-medium">{o.orderNo}</td>
                              <td>{formatDate(o.date)}</td>
                              <td>
                                <div className="font-medium">{o.itemDescription}</div>
                                <div className="text-xs text-muted-foreground">{o.metal} {o.purity}</div>
                              </td>
                              <td className="text-right text-green-600">
                                <div>{inr(o.advancePaid)}</div>
                                {o.status === "Delivered" && (o.advancePaid || 0) > 0 && (
                                  <span className="inline-block mt-0.5 bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase">Settled</span>
                                )}
                              </td>
                              <td className="text-center px-4">
                                <span className="inline-block px-2 py-1 bg-muted rounded-full text-xs">{o.status}</span>
                              </td>
                              <td className="text-right px-4">
                                <div className="flex justify-end items-center gap-2">
                                  <Button size="sm" variant="ghost" onClick={() => setViewingOrder(o)} title="View Order">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Repairs */}
              <div className="mt-4">
                <h3 className="font-display text-lg mb-3 flex items-center gap-2"><Wrench className="w-5 h-5"/> Repairs</h3>
                <Card className="shadow-none border-border">
                  <CardContent className="p-0">
                    {custRepairs.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No repairs.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-muted-foreground border-b bg-muted/20">
                          <tr>
                            <th className="py-2 px-4">Ticket No</th>
                            <th>Date</th>
                            <th>Item Details</th>
                            <th>Problem</th>
                            <th className="text-right">Paid</th>
                            <th className="text-center px-4">Status</th>
                            <th className="text-right px-4">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {custRepairs.map((r) => (
                            <tr key={r.id || r._id || r.ticketNo} className="border-b last:border-0 hover:bg-muted/40">
                              <td className="py-2 px-4 font-medium">{r.ticketNo}</td>
                              <td>{formatDate(r.date)}</td>
                              <td>
                                <div className="font-medium">{r.itemDescription}</div>
                                <div className="text-xs text-muted-foreground">{r.itemWeight}g</div>
                              </td>
                              <td className="text-rose-500 max-w-37.5 truncate" title={r.problem}>{r.problem}</td>
                              <td className="text-right text-green-600">
                                <div>{inr(r.advance)}</div>
                                {r.status === "Delivered" && (r.advance || 0) > 0 && (
                                  <span className="inline-block mt-0.5 bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase">Settled</span>
                                )}
                              </td>
                              <td className="text-center px-4">
                                <span className="inline-block px-2 py-1 bg-muted rounded-full text-xs">{r.status}</span>
                              </td>
                              <td className="text-right px-4">
                                <div className="flex justify-end items-center gap-2">
                                  <Button size="sm" variant="ghost" onClick={() => setViewingRepair(r)} title="View Repair">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Girvi Loans */}
              <div className="mt-4">
                <h3 className="font-display text-lg mb-3 flex items-center gap-2"><Wallet className="w-5 h-5"/> Girvi Loans</h3>
                <Card className="shadow-none border-border">
                    <CardContent className="p-0">
                      {custGirvis.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">No girvi loans.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-left text-muted-foreground border-b bg-muted/20">
                            <tr>
                              <th className="py-2 px-4">Loan No</th>
                              <th>Date</th>
                              <th>Item Description</th>
                              <th className="text-right">Amount</th>
                              <th className="text-center px-4">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {custGirvis.map((g) => (
                              <tr key={g.id || g.loanNo} className="border-b last:border-0 hover:bg-muted/40">
                                <td className="py-2 px-4 font-medium">{g.loanNo}</td>
                                <td>{formatDate(g.date)}</td>
                                <td>
                                  <div className="font-medium">{g.itemType} {g.purity}</div>
                                  <div className="text-xs text-muted-foreground">{g.itemDescription}</div>
                                </td>
                                <td className="text-right">{inr(g.loanAmount)}</td>
                                <td className="text-center px-4">
                                  <span className="inline-block px-2 py-1 bg-muted rounded-full text-xs">{g.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={!!payModal} onOpenChange={(v) => !v && setPayModal(null)}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          {payModal && (
            <>
              <DialogHeader>
                <DialogTitle>Record Payment - {payModal?.type.toUpperCase()}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="text-sm text-muted-foreground">
                  Paying for {payModal?.type === 'invoice' ? 'Invoice' : payModal?.type === 'order' ? 'Order' : 'Repair'}
                  <strong className="text-foreground mx-1">{payModal?.type === 'invoice' ? payModal?.item?.number : payModal?.type === 'order' ? payModal?.item?.orderNo : payModal?.item?.ticketNo}</strong>.
                  Current Due: <strong className="text-rose-600">{inr(payModal?.due || 0)}</strong>
                </div>
                <F label="Payment Amount ₹ *">
                  <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value === "" ? "" : Number(e.target.value))} />
                </F>
                <F label="Payment Mode">
                  <Select value={payMode} onValueChange={setPayMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </F>
                <F label="Note (Optional)">
                  <Input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Transaction ID, remarks..." />
                </F>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayModal(null)}>Cancel</Button>
                <Button onClick={submitPayment} disabled={updateInvoiceMutation.isPending || updateOrderMutation.isPending || updateRepairMutation.isPending || !payAmount}>Save Payment</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Manual Due Dialog */}
      <Dialog open={manualDueOpen} onOpenChange={setManualDueOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Add Manual Due</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {/* Customer Section */}
            <div className="p-4 border rounded-lg bg-muted/10 space-y-4">
              <h3 className="font-semibold text-primary">1. Customer Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <F label="Select Customer">
                    <Select value={manualDue.customerId} onValueChange={(val) => {
                      if (val === "NEW") {
                        setManualDue({ ...manualDue, customerId: "NEW", customerName: "", phone: "", phone2: "", address: "", gstNumber: "", pan: "", notes: "" });
                      } else {
                        const c = customers.find((x: Customer) => x._id === val || x.id === val);
                        if (c) {
                          setManualDue({ ...manualDue, customerId: c._id || c.id || "", customerName: c.name, phone: c.phone, phone2: c.phone2||"", address: c.address||"", gstNumber: c.gstNumber||"", pan: c.pan||"", notes: c.notes||"" });
                        }
                      }
                    }}>
                      <SelectTrigger className="bg-background"><SelectValue placeholder="Select or create customer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NEW" className="font-semibold text-primary">+ Create New Customer</SelectItem>
                        {customers.map((c: Customer) => (
                          <SelectItem key={c._id || c.id} value={c._id || c.id || ""}>{c.name} - {c.phone}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </F>
                </div>
                <F label="Customer Name *"><Input className="bg-background" value={manualDue.customerName} onChange={e => setManualDue({...manualDue, customerName: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F>
                <F label="Mobile No *"><Input className="bg-background" value={manualDue.phone} onChange={e => setManualDue({...manualDue, phone: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F>
                <F label="Mobile No 2 (optional)"><Input className="bg-background" value={manualDue.phone2} onChange={e => setManualDue({...manualDue, phone2: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F>
                <F label="GST No (optional)"><Input className="bg-background" value={manualDue.gstNumber} onChange={e => setManualDue({...manualDue, gstNumber: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F>
                <F label="PAN No (optional)"><Input className="bg-background" value={manualDue.pan} onChange={e => setManualDue({...manualDue, pan: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F>
                <div className="sm:col-span-2"><F label="Address (optional)"><Input className="bg-background" value={manualDue.address} onChange={e => setManualDue({...manualDue, address: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F></div>
                <div className="sm:col-span-2"><F label="Notes (optional)"><Input className="bg-background" value={manualDue.notes} onChange={e => setManualDue({...manualDue, notes: e.target.value})} disabled={manualDue.customerId !== "NEW"} /></F></div>
              </div>
            </div>

            {/* Product Section */}
            <div className="p-4 border rounded-lg bg-muted/10 space-y-4">
              <h3 className="font-semibold text-primary">2. Product Details (Optional)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <F label="Item Name / Description">
                    <Input className="bg-background" value={manualDue.itemName} onChange={e => setManualDue({...manualDue, itemName: e.target.value})} placeholder="E.g., Gold Chain, Old repair balance..." />
                  </F>
                </div>
                <F label="Purity"><Input className="bg-background" value={manualDue.purity} onChange={e => setManualDue({...manualDue, purity: e.target.value})} placeholder="22K" /></F>
                <F label="Net Weight (g)">
                  <Input className="bg-background" type="number" value={manualDue.netWeight} onChange={e => {
                    const nw = e.target.value === "" ? "" : Number(e.target.value);
                    setManualDue({...manualDue, netWeight: nw});
                  }} />
                </F>
                <F label="Rate / g (₹)">
                  <Input className="bg-background" type="number" value={manualDue.ratePerGram} onChange={e => {
                    const rg = e.target.value === "" ? "" : Number(e.target.value);
                    setManualDue({...manualDue, ratePerGram: rg});
                  }} />
                </F>
                <F label="Making Charge (₹)">
                  <Input className="bg-background" type="number" value={manualDue.makingCharge} onChange={e => {
                    const mc = e.target.value === "" ? "" : Number(e.target.value);
                    setManualDue({...manualDue, makingCharge: mc});
                  }} />
                </F>
              </div>
            </div>

            {/* Financials Section */}
            <div className="p-4 border rounded-lg bg-muted/10 space-y-4">
              <h3 className="font-semibold text-primary">3. Financials</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <F label="Date *">
                  <DatePicker value={manualDue.date} onChange={v => setManualDue({...manualDue, date: v})} className="w-full bg-background" />
                </F>
                <F label="Due Amount (₹) *">
                  <Input className="bg-background font-medium text-lg text-rose-600" type="number" value={manualDue.dueAmount} onChange={e => setManualDue({...manualDue, dueAmount: e.target.value === "" ? "" : Number(e.target.value)})} />
                </F>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDueOpen(false)}>Cancel</Button>
            <Button onClick={saveManualDue} disabled={createInvoiceMutation.isPending || !manualDue.date || manualDue.dueAmount === "" || (!manualDue.customerName && manualDue.customerId === "NEW")}>
              Save Manual Due
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewingInvoice && <InvoiceModal inv={viewingInvoice} authUser={authUser} onClose={() => setViewingInvoice(null)} />}
      {viewingOrder && <OrderInvoiceModal order={viewingOrder} authUser={authUser} onClose={() => setViewingOrder(null)} />}
      {viewingRepair && <RepairInvoiceModal repair={viewingRepair} authUser={authUser} onClose={() => setViewingRepair(null)} />}
    </Layout>
  );
}

function InvoiceModal({ inv, authUser, onClose }: { inv: any; authUser: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-100 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:bg-white print:p-0 overflow-y-auto pointer-events-auto">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:max-h-none print:block">
        <div className="p-4 sm:p-6 print:p-0 border-2 border-transparent print:border-none m-2 print:m-0 bg-white overflow-y-auto flex-1 print:overflow-visible">
          
          <ShopHeader documentLabel={inv.type === "GST" ? "Tax Invoice" : "Invoice"} compact />

          {/* Invoice Meta & Customer Details */}
          <div className="flex justify-between items-start mb-3 text-sm">
            <div>
              <div className="font-bold text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Billed To:</div>
              <div className="font-bold text-base leading-tight">{inv.customerName}</div>
              <div className="text-slate-700 text-xs">{inv.customerMobile}</div>
              <div className="max-w-62.5 text-slate-700 text-xs">{inv.customerAddress || "Address not provided"}</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-display font-bold mb-1 text-slate-900">{inv.type === "GST" ? "TAX INVOICE" : "INVOICE"}</div>
              <table className="ml-auto text-left text-slate-700 text-xs">
                <tbody>
                  <tr><td className="pr-3 py-0.5 text-right font-medium text-slate-500">Invoice No:</td><td className="font-semibold text-slate-900">{inv.number}</td></tr>
                  <tr><td className="pr-3 py-0.5 text-right font-medium text-slate-500">Date:</td><td className="font-semibold text-slate-900">{formatDate(inv.createdAt)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto w-full mb-3">
            <table className="w-full text-xs border-collapse border border-slate-300 min-w-150">
              <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 py-1 px-1.5 text-center w-8 text-slate-600">#</th>
                <th className="border border-slate-300 py-1 px-1.5 text-left text-slate-600">Description of Goods</th>
                <th className="border border-slate-300 py-1 px-1.5 text-right text-slate-600">Qty</th>
                <th className="border border-slate-300 py-1 px-1.5 text-right text-slate-600">Gross Wt</th>
                <th className="border border-slate-300 py-1 px-1.5 text-right text-slate-600">less Wt</th>
                <th className="border border-slate-300 py-1 px-1.5 text-right text-slate-600">Net Wt</th>
                <th className="border border-slate-300 py-1 px-1.5 text-right text-slate-600">Rate/g</th>
                <th className="border border-slate-300 py-1 px-1.5 text-right text-slate-600">Amount</th>
                <th className="border border-slate-300 py-1 px-1.5 text-right text-slate-600">Making (₹)</th>
                <th className="border border-slate-300 py-1 px-1.5 text-right text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it: any, i: number) => {
                let gw = it.grossWeight !== undefined ? it.grossWeight : it.netWeight;
                let sw = it.stoneWeight || 0;
                if (it.productId && typeof it.productId === 'string' && it.productId.includes("__GW_")) {
                  const parts = it.productId.split("__GW_");
                  const subParts = parts[1].split("__SW_");
                  gw = Number(subParts[0]);
                  sw = Number(subParts[1]);
                }
                const c = calcItem(it, inv.type === "GST");
                const amount = it.netWeight * it.ratePerGram;
                return (
                  <tr key={i} className="border-b border-slate-300 last:border-0">
                    <td className="border border-slate-300 py-1 px-1.5 text-center text-slate-600">{i + 1}</td>
                    <td className="border border-slate-300 py-1 px-1.5">
                      <div className="font-semibold leading-tight">{it.name}</div>
                      <div className="text-[10px] text-slate-500">Purity: {it.purity}</div>
                    </td>
                    <td className="border border-slate-300 py-1 px-1.5 text-right">{it.qty}</td>
                    <td className="border border-slate-300 py-1 px-1.5 text-right">{gw} g</td>
                    <td className="border border-slate-300 py-1 px-1.5 text-right">{sw} g</td>
                    <td className="border border-slate-300 py-1 px-1.5 text-right">{it.netWeight} g</td>
                    <td className="border border-slate-300 py-1 px-1.5 text-right">{inr(it.ratePerGram)}</td>
                    <td className="border border-slate-300 py-1 px-1.5 text-right">{inr(amount)}</td>
                    <td className="border border-slate-300 py-1 px-1.5 text-right">
                      {inr(it.makingCharge || 0)}
                    </td>
                    <td className="border border-slate-300 py-1 px-1.5 text-right font-bold">{inr(c.line)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {/* Calculations & Totals */}
          <div className="flex flex-col sm:flex-row justify-between items-start text-xs gap-4">
            <div className="w-full sm:w-1/2 sm:pr-8 order-2 sm:order-1">
              {((inv.balanceDue || 0) <= 0) && (
                <div className="p-1.5 bg-green-50 border border-green-200 text-green-800 text-center font-bold rounded tracking-widest text-base">
                  PAYMENT DONE
                </div>
              )}
            </div>
            <div className="w-full sm:w-1/2 max-w-sm order-1 sm:order-2">
              <table className="w-full">
                <tbody>
                  <tr><td className="py-0.5 text-slate-600">Subtotal</td><td className="py-0.5 text-right font-semibold">{inr(inv.subtotal)}</td></tr>
                  {inv.discount > 0 && <tr><td className="py-0.5 text-slate-600">Discount</td><td className="py-0.5 text-right font-semibold text-green-600">- {inr(inv.discount)}</td></tr>}
                  {inv.oldGoldAmount > 0 && <tr><td className="py-0.5 text-slate-600">Old Gold / Silver Exchange</td><td className="py-0.5 text-right font-semibold text-green-600">- {inr(inv.oldGoldAmount)}</td></tr>}
                  {inv.type === "GST" && (
                    <>
                      <tr><td className="py-0.5 text-slate-600">CGST @ 1.5%</td><td className="py-0.5 text-right font-semibold">{inr(inv.gstAmount / 2)}</td></tr>
                      <tr><td className="py-0.5 text-slate-600">SGST @ 1.5%</td><td className="py-0.5 text-right font-semibold">{inr(inv.gstAmount / 2)}</td></tr>
                    </>
                  )}
                  {(() => {
                    const preRound = Math.round((inv.subtotal - inv.discount - inv.oldGoldAmount + (inv.type === "GST" ? inv.gstAmount : 0)) * 100) / 100;
                    const roundOff = Math.round((inv.total - preRound) * 100) / 100;
                    return roundOff !== 0 ? <tr><td className="py-0.5 text-slate-600">Round Off</td><td className="py-0.5 text-right font-semibold">{inr(roundOff)}</td></tr> : null;
                  })()}
                  <tr className="border-t-2 border-slate-300 text-sm">
                    <td className="py-1 font-bold text-slate-900">Grand Total</td>
                    <td className="py-1 text-right font-bold text-slate-900">{inr(inv.total)}</td>
                  </tr>
                  {inv.amountPaid !== undefined && (
                    <>
                      {(() => {
                        if (inv.payments && inv.payments.length > 0) {
                          const cashPaid = inv.payments.filter((p: any) => p.mode === "Cash").reduce((s: number, p: any) => s + p.amount, 0);
                        const onlinePaid = inv.payments.filter((p: any) => p.mode !== "Cash" && p.mode !== "Advance" && p.mode !== "Order Advance").reduce((s: number, p: any) => s + p.amount, 0);
                        const advancePaid = inv.payments.filter((p: any) => p.mode === "Advance" || p.mode === "Order Advance").reduce((s: number, p: any) => s + p.amount, 0);
                          return (
                            <>
                            {advancePaid > 0 && (
                              <tr className="border-t border-slate-200 text-xs">
                                <td className="py-0.5 text-slate-600">Advance Settled</td>
                                <td className="py-0.5 text-right font-medium text-green-700">{inr(advancePaid)}</td>
                              </tr>
                            )}
                              {cashPaid > 0 && (
                              <tr className={advancePaid > 0 ? "text-xs" : "border-t border-slate-200 text-xs"}>
                                  <td className="py-0.5 text-slate-600">Paid (Cash)</td>
                                  <td className="py-0.5 text-right font-medium text-green-700">{inr(cashPaid)}</td>
                                </tr>
                              )}
                              {onlinePaid > 0 && (
                              <tr className={(cashPaid > 0 || advancePaid > 0) ? "text-xs" : "border-t border-slate-200 text-xs"}>
                                  <td className="py-0.5 text-slate-600">Paid (Online)</td>
                                  <td className="py-0.5 text-right font-medium text-green-700">{inr(onlinePaid)}</td>
                                </tr>
                              )}
                            {(cashPaid > 0 || onlinePaid > 0 || advancePaid > 0) && (
                                <tr className="text-xs">
                                  <td className="py-0.5 font-bold text-slate-800">Total Paid</td>
                                  <td className="py-0.5 text-right font-bold text-green-700">{inr(inv.amountPaid)}</td>
                                </tr>
                              )}
                            </>
                          );
                        }
                        return (
                          <tr className="border-t border-slate-200 text-xs">
                            <td className="py-0.5 text-slate-600">Amount Paid {inv.paymentMode && !inv.paymentMode.includes("+") ? `(${inv.paymentMode})` : ""}</td>
                            <td className="py-0.5 text-right font-semibold text-green-700">{inr(inv.amountPaid)}</td>
                          </tr>
                        );
                      })()}
                      <tr>
                        <td className="py-0.5 font-bold text-sm">Balance Due</td>
                        <td className="py-0.5 text-right font-bold text-sm text-rose-700">{inr(inv.balanceDue || 0)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="text-center order-2 sm:order-1">
              {inv.customerSignature ? (
                <img src={inv.customerSignature} alt="Customer Signature" className="h-10 mx-auto mb-1 object-contain" />
              ) : (
                <div className="w-32 border-t border-slate-300 mb-1 mx-auto"></div>
              )}
              Customer Signature
            </div>
            <div className="normal-case tracking-normal font-normal text-left text-slate-800 order-1 sm:order-2 text-[10px]">
              {authUser?.termsAndConditions ? <div className="whitespace-pre-wrap text-slate-600">{authUser.termsAndConditions}</div> : <InvoiceTerms compact />}
            </div>
            <div className="text-center order-3 sm:order-3">
              {inv.authorizedSignatory ? (
                <img src={inv.authorizedSignatory} alt="Authorized Signatory" className="h-10 mx-auto mb-1 object-contain" />
              ) : (
                <div className="w-32 border-t border-slate-300 mb-1 mx-auto"></div>
              )}
              Authorized Signatory
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="shrink-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-lg flex justify-end gap-3 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print Bill
          </Button>
        </div>
      </div>
    </div>
  );
}

function OrderInvoiceModal({ order, authUser, onClose }: { order: Order; authUser: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-100 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:bg-white print:p-0 overflow-y-auto pointer-events-auto">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:max-h-none print:block">
        <div className="p-6 sm:p-10 print:p-0 border-2 border-transparent print:border-none m-2 print:m-0 bg-white overflow-y-auto flex-1 print:overflow-visible">
          <ShopHeader documentLabel="Custom Order Receipt" />
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
          <div className="flex flex-col sm:flex-row justify-between items-start text-sm gap-6">
            <div className="w-full sm:w-1/2 sm:pr-8 order-2 sm:order-1"></div>
            <div className="w-full sm:w-1/2 max-w-sm order-1 sm:order-2">
              <table className="w-full">
                <tbody>
                  <tr className="border-t-2 border-slate-300 text-lg">
                    <td className="py-2 font-bold text-slate-900">
                      Advance Paid
                      {order.status === "Delivered" && (order.advancePaid || 0) > 0 && <span className="ml-2 text-xs font-semibold text-green-700 uppercase tracking-wider bg-green-100 px-2 py-0.5 rounded">Settled</span>}
                    </td>
                    <td className="py-2 text-right font-bold text-green-700">{inr(order.advancePaid)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="text-center order-2 sm:order-1">
              {order.customerSignature ? (
                <img src={order.customerSignature} alt="Customer Signature" className="h-16 mx-auto mb-2 object-contain" />
              ) : <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>}
              Customer Signature
            </div>
            <div className="normal-case tracking-normal font-normal text-left text-slate-800 order-1 sm:order-2 text-[10px]">
              {authUser?.termsAndConditions ? <div className="whitespace-pre-wrap text-slate-600">{authUser.termsAndConditions}</div> : <InvoiceTerms compact />}
            </div>
            <div className="text-center order-3 sm:order-3">
              {order.authorizedSignatory ? (
                <img src={order.authorizedSignatory} alt="Authorized Signatory" className="h-16 mx-auto mb-2 object-contain" />
              ) : <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>}
              Authorized Signatory
            </div>
          </div>
        </div>
        <div className="shrink-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-lg flex justify-end gap-3 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Print Receipt</Button>
        </div>
      </div>
    </div>
  );
}

function RepairInvoiceModal({ repair, authUser, onClose }: { repair: Repair; authUser: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-100 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:bg-white print:p-0 overflow-y-auto pointer-events-auto">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:max-h-none print:block">
        <div className="p-6 sm:p-10 print:p-0 border-2 border-transparent print:border-none m-2 print:m-0 bg-white overflow-y-auto flex-1 print:overflow-visible">
          <ShopHeader documentLabel="Repair Receipt" />
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
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="text-center order-2 sm:order-1">
              {repair.customerSignature ? (
                <img src={repair.customerSignature} alt="Customer Signature" className="h-16 mx-auto mb-2 object-contain" />
              ) : <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>}
              Customer Signature
            </div>
            <div className="normal-case tracking-normal font-normal text-left text-slate-800 order-1 sm:order-2 text-[10px]">
              {authUser?.termsAndConditions ? <div className="whitespace-pre-wrap text-slate-600">{authUser.termsAndConditions}</div> : <InvoiceTerms compact />}
            </div>
            <div className="text-center order-3 sm:order-3">
              {repair.authorizedSignatory ? (
                <img src={repair.authorizedSignatory} alt="Authorized Signatory" className="h-16 mx-auto mb-2 object-contain" />
              ) : <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>}
              Authorized Signatory
            </div>
          </div>
        </div>
        <div className="shrink-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-lg flex justify-end gap-3 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Print Receipt</Button>
        </div>
      </div>
    </div>
  );
}


function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
