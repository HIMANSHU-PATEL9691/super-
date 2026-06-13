import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Printer, Receipt, Pencil, Search } from "lucide-react";
import {
  inr,
  calcItem,
  type Invoice,
  type InvoiceItem,
  useLocalState,
  useDebounce,
} from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { invoicesAPI, inventoryAPI, customerAPI, goldRatesAPI, ordersAPI, repairsAPI } from "@/lib/api";
import { toast } from "sonner";
import { InvoiceTerms, ShopHeader } from "@/components/InvoiceBranding";

export default function BillingPage() {
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const { data: invoices = [] } = useApi<any[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: products = [] } = useApi<any[]>(["inventory"], () => inventoryAPI.getAll());
  const { data: customers = [] } = useApi<any[]>(["customers"], () => customerAPI.getAll());
  const { data: ratesList = [] } = useApi<any[]>(["goldRates"], () => goldRatesAPI.getAll());
  const { data: orders = [] } = useApi<any[]>(["orders"], () => ordersAPI.getAll());
  const { data: repairs = [] } = useApi<any[]>(["repairs"], () => repairsAPI.getAll());
  const latestRates = ratesList[0];
  
  const createMutation = useApiMutation((data: any) => invoicesAPI.create(data), ["invoices"]);
  const deleteMutation = useApiMutation((id: string) => invoicesAPI.delete(id), ["invoices"]);
  const updateProductMutation = useApiMutation((data: { id: string; body: any }) => inventoryAPI.update(data.id, data.body), ["inventory"]);
  const updateMutation = useApiMutation((data: { id: string; body: any }) => invoicesAPI.update(data.id, data.body), ["invoices"]);
  const updateOrderMutation = useApiMutation((data: { id: string; body: any }) => ordersAPI.update(data.id, data.body), ["orders"]);
  const updateRepairMutation = useApiMutation((data: { id: string; body: any }) => repairsAPI.update(data.id, data.body), ["repairs"]);
  const createCustomerMutation = useApiMutation((data: any) => customerAPI.create(data), ["customers"]);

  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCust, setNewCust] = useState({ name: "", phone: "", address: "" });

  const [type, setType] = useState<"GST" | "NON-GST">("GST");
  const [customerId, setCustomerId] = useState<string>("");
  const [searchCust, setSearchCust] = useState("");
  const debouncedSearchCust = useDebounce(searchCust, 300);
  const [searchProd, setSearchProd] = useState("");
  const debouncedSearchProd = useDebounce(searchProd, 300);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState<number | "">("");
  const [oldGoldAmount, setOldGoldAmount] = useState<number | "">("");
  const [cashAmount, setCashAmount] = useState<number | "">("");
  const [onlineAmount, setOnlineAmount] = useState<number | "">("");
  const [onlineMode, setOnlineMode] = useState<string>("UPI");
  const [customerSignature, setCustomerSignature] = useState<string>("");
  const [authorizedSignatory, setAuthorizedSignatory] = useState<string>("");
  const [pages, setPages] = useState<Record<number, number>>({});
  const [linkedOrderId, setLinkedOrderId] = useState<string>("");
  const [nonGstFilter, setNonGstFilter] = useState<"All" | "INV" | "MAN">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const isOperator = authUser?.role === 'operator';
  const isGst = type === "GST";

  const addProduct = (pid: string) => {
    const p = products.find((x) => (x.id || x._id) === pid);
    if (!p) return;

    const actualPid = p.id || p._id;
    let requestedQty = 1;
    items.forEach(it => {
      const itPid = it.productId ? it.productId.split("__GW_")[0] : it.productId;
      if (itPid === actualPid) requestedQty += it.qty;
    });

    let available = p.stock;
    if (editingId) {
      const existingInv = invoices.find((inv) => (inv.id || inv._id) === editingId);
      existingInv?.items.forEach((x: any) => {
        const opid = x.productId ? x.productId.split("__GW_")[0] : x.productId;
        if (opid === actualPid) available += x.qty;
      });
    }

    if (requestedQty > available) {
      toast.error(`Cannot add "${p.name}". Only ${available} units available in stock.`);
      return;
    }

    let currentRate = p.ratePerGram;
    if (latestRates && p.category !== "Diamond" && p.category !== "Other") {
      const purityUpper = (p.purity || "").toUpperCase();
      if (purityUpper.includes("24K") && latestRates.gold24) currentRate = latestRates.gold24;
      else if (purityUpper.includes("22K") && latestRates.gold22) currentRate = latestRates.gold22;
      else if (purityUpper.includes("18K") && latestRates.gold18) currentRate = latestRates.gold18;
      else if ((p.category === "Silver" || purityUpper.includes("SILVER") || purityUpper.includes("925")) && latestRates.silver) currentRate = latestRates.silver;
    }

    let itemName = p.name;
    if (p.huid) {
      itemName += ` (HUID: ${p.huid})`;
    } else if (p.barcode && !p.barcode.startsWith("AJ-") && !p.barcode.startsWith("CAT-")) {
      itemName += ` (BC: ${p.barcode})`;
    }

    setItems((prev) => [
      ...prev,
      {
        productId: p.id || p._id,
        name: itemName,
        purity: p.purity,
        netWeight: p.netWeight,
        grossWeight: p.grossWeight !== undefined ? p.grossWeight : p.netWeight,
        stoneWeight: p.stoneWeight || 0,
        ratePerGram: currentRate,
        makingCharge: 0,
        makingChargePct: 0,
        stoneCharge: 0,
        gstPct: p.gstPct,
        qty: 1,
      } as any,
    ]);
  };

  const addCustomItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: "manual-" + Date.now(),
        name: "",
        purity: "22K",
        netWeight: 0,
        grossWeight: 0,
        stoneWeight: 0,
        ratePerGram: 0,
        makingCharge: 0,
        makingChargePct: 0,
        stoneCharge: 0,
        gstPct: type === "GST" ? 3 : 0,
        qty: 1,
      } as any,
    ]);
  };

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const totals = useMemo(() => {
    let subtotal = 0;
    let gst = 0;

    items.forEach((it) => {
      const c = calcItem(it, isGst);
      subtotal += c.line;
      gst += c.gst;
    });

    const afterAdj = subtotal - (Number(discount) || 0) - (Number(oldGoldAmount) || 0);
    const preRound = Math.round((afterAdj + gst) * 100) / 100;
    const gTotal = Math.round(preRound);
    const roundOff = Math.round((gTotal - preRound) * 100) / 100;
    const cgst = gst / 2;
    const sgst = gst / 2;

    return { subtotal, gst, cgst, sgst, preRound, roundOff, gTotal };
  }, [items, discount, oldGoldAmount, isGst]);

  const selectedCust = useMemo(() => customers.find((c) => (c._id || c.id) === customerId), [customers, customerId]);
  const customerOrdersAndRepairs = useMemo(() => {
    if (!selectedCust) return [];
    const o = orders.filter(o => 
      (o.customerMobile === selectedCust.mobile || (selectedCust.phone && o.customerMobile === selectedCust.phone)) && 
      o.status !== "Delivered" && 
      o.status !== "Cancelled"
    ).map(o => ({ type: 'order', id: `order_${o._id || o.id}`, originalId: o._id || o.id, desc: `${o.orderNo} - ${o.itemDescription}`, advance: o.advancePaid || 0, item: o }));

    const r = repairs.filter(r => 
      (r.customerMobile === selectedCust.mobile || (selectedCust.phone && r.customerMobile === selectedCust.phone)) && 
      r.status !== "Delivered"
    ).map(r => ({ type: 'repair', id: `repair_${r._id || r.id}`, originalId: r._id || r.id, desc: `${r.ticketNo} - ${r.itemDescription}`, advance: r.advance || 0, item: r }));

    return [...o, ...r];
  }, [orders, repairs, selectedCust]);

  const reset = () => {
    setEditingId(null);
    setItems([]);
    setDiscount("");
    setOldGoldAmount("");
    setCustomerId("");
    setCashAmount("");
    setOnlineAmount("");
    setOnlineMode("UPI");
    setCustomerSignature("");
    setAuthorizedSignatory("");
    setLinkedOrderId("");
    setNewCust({ name: "", phone: "", address: "" });
  };

  useEffect(() => {
    if (isOperator) {
      setType("GST");
    } else {
      setType("NON-GST");
    }
  }, [isOperator]);

  const editInvoice = (inv: any) => {
    setEditingId(inv._id || inv.id);
    setType(inv.type);
    setCustomerId(inv.customerId);
    setSearchCust(inv.customerName || "");
    const parsedItems = (inv.items || []).map((it: any) => {
      let pid = it.productId;
      let gw = it.netWeight;
      let sw = 0;
      if (pid && typeof pid === "string" && pid.includes("__GW_")) {
        const parts = pid.split("__GW_");
        pid = parts[0];
        const subParts = parts[1].split("__SW_");
        gw = Number(subParts[0]);
        sw = Number(subParts[1]);
      }
      return { ...it, productId: pid, grossWeight: gw, stoneWeight: sw };
    });
    setItems(parsedItems);
    setDiscount(inv.discount || "");
    setOldGoldAmount(inv.oldGoldAmount || "");
    
    let cAmt = 0;
    let oAmt = 0;
    let oMode = "UPI";

    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((p: any) => {
        if (p.mode === "Cash") cAmt += p.amount;
        else if (p.mode === "Advance" || p.mode === "Order Advance") {
           // Do not bleed advance amounts into general online amount inputs
        } else { oAmt += p.amount; oMode = p.mode; }
      });
    } else {
      const paid = inv.amountPaid !== undefined ? inv.amountPaid : inv.total;
      if (inv.paymentMode === "Cash") { cAmt = paid; }
      else { oAmt = paid; oMode = inv.paymentMode || "UPI"; }
    }
    
    if (cAmt === 0 && oAmt === 0) {
      setCashAmount(0);
      setOnlineAmount("");
    } else {
      setCashAmount(cAmt > 0 ? cAmt : "");
      setOnlineAmount(oAmt > 0 ? oAmt : "");
    }
    setOnlineMode(oMode);
    
    setCustomerSignature(inv.customerSignature || "");
    setAuthorizedSignatory(inv.authorizedSignatory || "");
    setLinkedOrderId(inv.linkedOrderId || "");
    setOpen(true);
  };

  const save = async () => {
    if (items.length === 0 || !customerId) {
      toast.error("Please select a customer and add items.");
      return;
    }

    // Sum quantities by product ID
    const qtyByProduct: Record<string, number> = {};
    for (const item of items) {
      const actualPid = item.productId ? item.productId.split("__GW_")[0] : item.productId;
      if (actualPid && !actualPid.startsWith("manual-") && !actualPid.startsWith("linked-")) {
        qtyByProduct[actualPid] = (qtyByProduct[actualPid] || 0) + item.qty;
      }
    }

    // Strict check to prevent billing out-of-stock items
    for (const [actualPid, requestedQty] of Object.entries(qtyByProduct)) {
      const p = products.find((x) => (x.id || x._id) === actualPid);
      if (p) {
        let available = p.stock;
        if (editingId) {
          const existingInv = invoices.find((inv) => (inv.id || inv._id) === editingId);
          existingInv?.items.forEach((x: any) => {
            const opid = x.productId ? x.productId.split("__GW_")[0] : x.productId;
            if (opid === actualPid) available += x.qty;
          });
        }
        if (requestedQty > available) {
          toast.error(`Cannot generate bill. Only ${available} units of "${p.name}" are available in stock. You requested ${requestedQty}.`);
          return;
        }
      }
    }

    let custIdToUse = customerId;
    let custName = "";
    let custMobile = "";
    let custAddress = "";

    if (customerId === "NEW") {
      if (!newCust.name || !newCust.phone) {
        toast.error("Customer name and phone are required for a new customer.");
        return;
      }
      try {
        const created = await createCustomerMutation.mutateAsync(newCust);
        custIdToUse = created._id || created.id;
        custName = created.name;
        custMobile = created.phone || created.mobile || "";
        custAddress = created.address || "";
      } catch (e) {
        toast.error("Failed to create new customer");
        return;
      }
    } else {
      const cust = customers.find((c) => (c._id || c.id) === customerId);
      if (!cust) {
        toast.error("Selected customer not found.");
        return;
      }
      custName = cust.name;
      custMobile = cust.mobile || (cust as any).phone || "";
      custAddress = cust.address || "";
    }

    const existingInv = editingId ? invoices.find(i => (i._id || i.id) === editingId) : null;

    const isCashEmpty = cashAmount === "";
    const isOnlineEmpty = onlineAmount === "";
    const cAmt = Number(cashAmount) || 0;
    const oAmt = Number(onlineAmount) || 0;
    const linkedOrder = orders.find(o => (o._id || o.id) === linkedOrderId || `order_${o._id || o.id}` === linkedOrderId);
    const linkedRepair = repairs.find(r => `repair_${r._id || r.id}` === linkedOrderId);
    const orderAdvanceAmount = linkedOrder ? (linkedOrder.advancePaid || 0) : linkedRepair ? (linkedRepair.advance || 0) : 0;
    const advanceNote = linkedOrder ? `Order ${linkedOrder.orderNo} Advance` : linkedRepair ? `Repair ${linkedRepair.ticketNo} Advance` : "Advance";
 
    let safeActualPaid = 0;
    let finalPaymentMode = "Cash";
    const initialPayment: any[] = [];
 
    if (isCashEmpty && isOnlineEmpty && orderAdvanceAmount === 0) {
      if (editingId) {
        safeActualPaid = 0;
        finalPaymentMode = "Cash";
      } else {
        safeActualPaid = totals.gTotal;
        finalPaymentMode = "Cash";
        if (safeActualPaid > 0) {
          initialPayment.push({ date: new Date().toISOString(), amount: safeActualPaid, mode: "Cash", note: "Initial Payment" });
        }
      }
    } else {
      safeActualPaid = cAmt + oAmt + orderAdvanceAmount;
      finalPaymentMode = oAmt > (cAmt + orderAdvanceAmount) ? onlineMode : "Cash";
 
      if (orderAdvanceAmount > 0) initialPayment.push({ date: new Date().toISOString(), amount: orderAdvanceAmount, mode: "Advance", note: advanceNote });
      if (cAmt > 0) initialPayment.push({ date: new Date().toISOString(), amount: cAmt, mode: "Cash", note: "Initial Cash Payment" });
      if (oAmt > 0) initialPayment.push({ date: new Date().toISOString(), amount: oAmt, mode: onlineMode, note: `Initial ${onlineMode} Payment` });
    }
    const balanceDue = Math.max(0, totals.gTotal - safeActualPaid);

    // Clean _id from subdocuments to avoid Mongoose immutable _id CastErrors on update
    const cleanItems = items.map((it: any) => {
      const { _id, id, ...rest } = it;
      
      // Safely clean up the productId so Mongoose doesn't throw a 400 CastError
      let validPid = rest.productId;
      if (validPid && typeof validPid === "string") {
        if (validPid.startsWith("manual-") || validPid.startsWith("linked-")) {
          validPid = undefined; // Drop fake IDs for custom/linked items
        } else if (validPid.includes("__GW_")) {
          validPid = validPid.split("__GW_")[0]; // Strip legacy metadata
        }
      }
      
      const gw = rest.grossWeight !== undefined ? rest.grossWeight : rest.netWeight;
      const sw = rest.stoneWeight || 0;
      const cleaned = { ...rest, grossWeight: gw, stoneWeight: sw };
      if (validPid) {
        cleaned.productId = validPid;
      }
      return cleaned;
    });

    let cleanPayments = initialPayment;
    const oldPaid = existingInv?.amountPaid || 0;
    if (existingInv) {
      if (safeActualPaid === oldPaid) {
        cleanPayments = existingInv.payments || [];
      } else if (Array.isArray(existingInv.payments) && existingInv.payments.length > 0) {
        const oldFirstDate = existingInv.payments[0].date || existingInv.createdAt;
        initialPayment.forEach(p => p.date = oldFirstDate);
        cleanPayments = initialPayment;
      }
    }

    let newNumber = existingInv ? existingInv.number : "";
    if (!existingInv) {
      const typeInvoices = invoices.filter(i => i.type === type && !i.number?.startsWith("MAN-"));
      const prefix = type === "GST" ? "GST-" : "INV-";
      newNumber = prefix + (typeInvoices.length + 1).toString().padStart(4, "0");
    }

    const inv: any = {
      number: newNumber,
      type,
      customerId: custIdToUse,
      customerName: custName,
      customerMobile: custMobile,
      customerAddress: custAddress,
      items: cleanItems,
      discount: Number(discount) || 0,
      oldGoldAmount: Number(oldGoldAmount) || 0,
      paymentMode: finalPaymentMode,
      subtotal: totals.subtotal,
      gstAmount: totals.gst,
      total: totals.gTotal,
      amountPaid: safeActualPaid,
      balanceDue,
      payments: cleanPayments,
      customerSignature,
      authorizedSignatory,
      linkedOrderId: linkedOrderId || undefined,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: inv });
        toast.success("Invoice updated successfully");
      } else {
        const saved = await createMutation.mutateAsync(inv);
        
        if (linkedOrderId) {
          if (linkedOrder) {
            await updateOrderMutation.mutateAsync({
              id: linkedOrder._id || linkedOrder.id,
              body: { ...linkedOrder, status: "Delivered" }
            });
          } else if (linkedRepair) {
            await updateRepairMutation.mutateAsync({
              id: linkedRepair._id || linkedRepair.id,
              body: { ...linkedRepair, status: "Delivered" }
            });
          }
        }
        
        // Deduct sold quantities from inventory stock
        for (const item of items) {
          const actualPid = item.productId ? item.productId.split("__GW_")[0] : item.productId;
          const p = products.find((x) => (x.id || x._id) === actualPid);
          if (p) {
            const newStock = Math.max(0, (p.stock || 0) - (item.qty || 1));
            const newNetWeight = Math.max(0, Number(((p.netWeight || 0) - (item.netWeight || 0)).toFixed(3)));
            const itemGross = (item as any).grossWeight !== undefined ? (item as any).grossWeight : item.netWeight;
            const newGrossWeight = Math.max(0, Number(((p.grossWeight || 0) - (itemGross || 0)).toFixed(3)));
            await updateProductMutation.mutateAsync({ id: p._id || p.id, body: { ...p, stock: newStock, netWeight: newNetWeight, grossWeight: newGrossWeight } });
          }
        }
        
        setViewing(saved);
        toast.success("Invoice generated successfully");
      }
      reset();
      setOpen(false);
    } catch (e) {
      toast.error("Failed to save invoice");
    }
  };

  const removeInvoice = async (invoice: Invoice) => {
    if (window.confirm(`Are you sure you want to delete Invoice ${invoice.number}? This will also add the sold items back to your inventory.`)) {
      try {
        // Add stock back to inventory
        for (const item of invoice.items) {
          const actualPid = item.productId ? item.productId.split("__GW_")[0] : item.productId;
          const p = products.find((x) => (x.id || x._id) === actualPid);
          if (p) {
            const newStock = (p.stock || 0) + (item.qty || 1);
            const newNetWeight = Number(((p.netWeight || 0) + (item.netWeight || 0)).toFixed(3));
            const itemGross = (item as any).grossWeight !== undefined ? (item as any).grossWeight : item.netWeight;
            const newGrossWeight = Number(((p.grossWeight || 0) + (itemGross || 0)).toFixed(3));
            await updateProductMutation.mutateAsync({ id: p._id || p.id, body: { ...p, stock: newStock, netWeight: newNetWeight, grossWeight: newGrossWeight } });
          }
        }
        await deleteMutation.mutateAsync(invoice._id || invoice.id || "");
        toast.success("Invoice deleted and stock restored.");
      } catch (e) { toast.error("Failed to delete invoice."); }
    }
  };

  const today = new Date().toDateString();
  const roleInvoices = invoices.filter(i => i.type === type);
  const todayInvoices = roleInvoices.filter(i => new Date(i.createdAt).toDateString() === today);
  const todayRevenue = todayInvoices.reduce((s, i) => s + i.total, 0);

  const gstInvoices = useMemo(() => {
    let list = invoices.filter((i) => i.type === "GST");
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase().trim();
      list = list.filter((i) => (i.number || "").toLowerCase().includes(q) || (i.customerName || "").toLowerCase().includes(q) || (i.customerMobile || "").includes(q));
    }
    return list;
  }, [invoices, debouncedSearchQuery]);

  const nonGstInvoices = useMemo(() => {
    let list = invoices.filter((i) => i.type === "NON-GST");
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase().trim();
      list = list.filter((i) => (i.number || "").toLowerCase().includes(q) || (i.customerName || "").toLowerCase().includes(q) || (i.customerMobile || "").includes(q));
    }
    return list;
  }, [invoices, debouncedSearchQuery]);

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl">Billing & Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage sales invoices and point-of-sale.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full sm:w-auto" onClick={() => reset()}>
              <Plus className="w-4 h-4 mr-2" /> New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] lg:max-w-5xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-display">{editingId ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
            </DialogHeader>
            <form className="space-y-6 mt-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
              
              {/* 1. Invoice Details */}
              <div className="p-5 border rounded-lg bg-muted/10 space-y-4">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">1</span>
                  Invoice Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-3 md:col-span-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Customer</Label>
                      <Select value={customerId} onValueChange={(val) => {
                        setCustomerId(val);
                        setLinkedOrderId("");
                      }}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select or search customer..." />
                        </SelectTrigger>
                        <SelectContent>
                          <div onKeyDown={(e) => e.stopPropagation()} className="p-2">
                            <Input 
                              placeholder="Search name or mobile..." 
                              value={searchCust} 
                              onChange={e => setSearchCust(e.target.value)} 
                              className="w-full" 
                            />
                          </div>
                          <SelectItem value="NEW" className="font-semibold text-primary">+ Create New Customer</SelectItem>
                          {customers
                            .filter(
                              (c) =>
                                c.name.toLowerCase().includes(debouncedSearchCust.toLowerCase()) ||
                                (c.mobile || c.phone || "").includes(debouncedSearchCust)
                            )
                            .map((c) => (
                              <SelectItem key={c._id || c.id} value={c._id || c.id}>
                                {c.name} · {c.mobile || c.phone}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {customerId === "NEW" && (
                      <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm space-y-3 mt-2">
                        <div className="space-y-1.5"><Label className="text-xs">Full Name *</Label><Input value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} className="h-8 bg-background" /></div>
                        <div className="space-y-1.5"><Label className="text-xs">Mobile No *</Label><Input value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} className="h-8 bg-background" /></div>
                        <div className="space-y-1.5"><Label className="text-xs">Address</Label><Input value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} className="h-8 bg-background" /></div>
                        <Button type="button" size="sm" className="w-full mt-2" disabled={createCustomerMutation.isPending || !newCust.name || !newCust.phone} onClick={async () => {
                          if (!newCust.name || !newCust.phone) {
                            toast.error("Name and mobile are required.");
                            return;
                          }
                          try {
                            const created = await createCustomerMutation.mutateAsync(newCust);
                            toast.success("Customer saved successfully!");
                            setCustomerId(created._id || created.id);
                            setNewCust({ name: "", phone: "", address: "" });
                          } catch(e) {
                            toast.error("Failed to create new customer.");
                          }
                        }}>
                          {createCustomerMutation.isPending ? "Saving..." : "Save Customer"}
                        </Button>
                      </div>
                    )}

                    {customerId && (
                      <div className="p-3 rounded-md bg-background border border-border text-sm">
                        {(() => {
                          if (!selectedCust) return null;
                          return (
                            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                              <div>
                                <strong className="text-foreground">Name:</strong> {selectedCust.name}
                              </div>
                              <div>
                                <strong className="text-foreground">Mobile:</strong>{" "}
                                {selectedCust.mobile || selectedCust.phone}
                              </div>
                              <div className="col-span-2">
                                <strong className="text-foreground">Address:</strong>{" "}
                                {selectedCust.address || "—"}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {customerId && customerOrdersAndRepairs.length > 0 && !editingId && (
                      <div className="mt-2 space-y-1.5 p-3 rounded-md bg-primary/5 border border-primary/20">
                        <Label className="text-xs text-primary font-semibold">Link Active Order / Repair (Apply Advance)</Label>
                        <Select value={linkedOrderId || "none"} onValueChange={(v) => {
                          const newLinkedId = v === "none" ? "" : v;
                          const oldLinkedId = linkedOrderId;
                          setLinkedOrderId(newLinkedId);
                          
                          setItems(prev => {
                            let updated = [...prev];
                            if (oldLinkedId) {
                               updated = updated.filter(it => it.productId !== `linked-${oldLinkedId}`);
                            }
                            
                            if (newLinkedId) {
                              const isOrder = newLinkedId.startsWith("order_") || orders.find(o => (o._id || o.id) === newLinkedId);
                              if (isOrder) {
                                const linkedOrder = orders.find(o => `order_${o._id || o.id}` === newLinkedId || (o._id || o.id) === newLinkedId);
                                if (linkedOrder) {
                                  let currentRate = 0;
                                  if (latestRates && linkedOrder.metal !== "Diamond" && linkedOrder.metal !== "Other") {
                                    const purityUpper = (linkedOrder.purity || "").toUpperCase();
                                    if (purityUpper.includes("24K") && latestRates.gold24) currentRate = latestRates.gold24;
                                    else if (purityUpper.includes("22K") && latestRates.gold22) currentRate = latestRates.gold22;
                                    else if (purityUpper.includes("18K") && latestRates.gold18) currentRate = latestRates.gold18;
                                    else if ((linkedOrder.metal === "Silver" || purityUpper.includes("SILVER") || purityUpper.includes("925")) && latestRates.silver) currentRate = latestRates.silver;
                                  }
                                  updated.push({
                                    productId: `linked-${newLinkedId}`,
                                    name: linkedOrder.itemDescription,
                                    purity: linkedOrder.purity || "22K",
                                    netWeight: 0,
                                    grossWeight: 0,
                                    stoneWeight: 0,
                                    ratePerGram: currentRate,
                                    makingCharge: 0,
                                    makingChargePct: 0,
                                    stoneCharge: 0,
                                    gstPct: type === "GST" ? 3 : 0,
                                    qty: 1,
                                  } as any);
                                }
                              } else {
                                const linkedRepair = repairs.find(r => `repair_${r._id || r.id}` === newLinkedId);
                                if (linkedRepair) {
                                  updated.push({
                                    productId: `linked-${newLinkedId}`,
                                    name: `Repair: ${linkedRepair.itemDescription}`,
                                    purity: "-",
                                    netWeight: 0,
                                    grossWeight: 0,
                                    stoneWeight: 0,
                                    ratePerGram: 0,
                                    makingCharge: 0,
                                    makingChargePct: 0,
                                    stoneCharge: 0,
                                    gstPct: type === "GST" ? 3 : 0,
                                    qty: 1,
                                  } as any);
                                }
                              }
                            }
                            return updated;
                          });
                        }}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select an order or repair" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {customerOrdersAndRepairs.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.desc} (Advance: {inr(item.advance)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Items */}
              <div className="p-5 border rounded-lg bg-muted/10 space-y-4">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</span>
                  Items
                </h3>
                <div className="flex flex-col sm:flex-row gap-3 w-full items-start sm:items-center">
                    <Input
                      placeholder="Type name/barcode & press Enter..."
                      value={searchProd}
                      onChange={(e) => setSearchProd(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (searchProd.trim() !== "") {
                            const query = searchProd.toLowerCase().trim();
                          const matches = products.filter(
                            (p) =>
                              p.name.toLowerCase().includes(query) ||
                              (p.barcode || "").toLowerCase() === query ||
                              (p.huid || "").toLowerCase() === query
                          );
                          if (matches.length > 0) {
                            const exact = matches.find(
                              (p) =>
                                p.name.toLowerCase() === query ||
                                (p.barcode || "").toLowerCase() === query ||
                                (p.huid || "").toLowerCase() === query
                            );
                            addProduct((exact || matches[0])._id || (exact || matches[0]).id);
                            setSearchProd("");
                          } else {
                            toast.error("No product found matching this name or barcode.");
                          }
                          }
                        }
                      }}
                      className="bg-background w-full sm:w-64"
                    />

                    <div className="w-full sm:w-64">
                      <Select
                        value=""
                        onValueChange={(val) => {
                          addProduct(val);
                          setSearchProd("");
                        }}
                      >
                        <SelectTrigger className="bg-background w-full sm:w-64">
                          <SelectValue
                            placeholder={
                              products.length ? "Add product…" : "No products in inventory"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {products
                            .filter(
                              (p) =>
                                p.name.toLowerCase().includes(debouncedSearchProd.toLowerCase()) ||
                                (p.barcode || "")
                                  .toLowerCase()
                                  .includes(debouncedSearchProd.toLowerCase()) ||
                                (p.huid || "")
                                  .toLowerCase()
                                  .includes(debouncedSearchProd.toLowerCase())
                            )
                            .map((p) => (
                              <SelectItem key={p._id || p.id} value={p._id || p.id} disabled={p.stock <= 0}>
                                {p.name} · {p.barcode || p.huid || p.purity} · {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="secondary" onClick={addCustomItem} className="shrink-0">
                      <Plus className="w-4 h-4 mr-2" /> Add Custom Item
                    </Button>
                </div>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      Add products from the dropdown to start billing.
                    </p>
                  ) : (
                    <div className="overflow-x-auto w-full border border-border rounded-md">
                      <table className="w-full text-sm min-w-200">
                      <thead className="text-left text-muted-foreground border-b bg-muted/20">
                        <tr>
                          <th className="p-3 font-medium">Product</th>
                          <th className="py-3 font-medium w-16">Qty</th>
                          <th className="py-3 font-medium w-20">Gross Wt</th>
                          <th className="py-3 font-medium w-20">less Wt</th>
                          <th className="py-3 font-medium w-20">Net Wt</th>
                          <th className="py-3 font-medium w-24">Rate(₹/g)</th>
                          <th className="py-3 font-medium w-24">Amount</th>
                          <th className="py-3 font-medium w-20">Making (₹)</th>
                          <th className="py-3 font-medium text-right pr-3 w-28">Total (₹)</th>
                          <th className="w-12" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, i) => {
                          const c = calcItem(it, isGst);
                          const amount = it.netWeight * it.ratePerGram;
                          return (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                              <td className="p-3 min-w-40 space-y-2">
                                <Input value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} className="h-8 text-sm font-medium" placeholder="Item Name" />
                                <Input value={it.purity} onChange={(e) => updateItem(i, { purity: e.target.value })} className="h-7 text-xs" placeholder="Purity (e.g. 22K)" />
                              </td>
                              <td className="py-2">
                                <NumI
                                  v={it.qty}
                                  on={(v) => {
                                    const actualPid = it.productId ? it.productId.split("__GW_")[0] : it.productId;
                                    const p = products.find((x) => (x.id || x._id) === actualPid);
                                    if (p) {
                                      let requestedQty = v;
                                      items.forEach((otherIt, otherIdx) => {
                                        if (otherIdx !== i) {
                                          const opid = otherIt.productId ? otherIt.productId.split("__GW_")[0] : otherIt.productId;
                                          if (opid === actualPid) requestedQty += otherIt.qty;
                                        }
                                      });

                                      let available = p.stock;
                                      if (editingId) {
                                        const existingInv = invoices.find((inv) => (inv.id || inv._id) === editingId);
                                        existingInv?.items.forEach((x: any) => {
                                          const opid = x.productId ? x.productId.split("__GW_")[0] : x.productId;
                                          if (opid === actualPid) available += x.qty;
                                        });
                                      }
                                      if (requestedQty > available) {
                                        const maxAllowedForThisRow = available - (requestedQty - v);
                                        toast.error(`Only ${available} units available in stock.`);
                                        updateItem(i, { qty: maxAllowedForThisRow });
                                        return;
                                      }
                                    }
                                    updateItem(i, { qty: v });
                                  }}
                                  className="w-12 h-8 bg-background"
                                />
                              </td>
                              <td className="py-2">
                                <NumI
                                  v={(it as any).grossWeight !== undefined ? (it as any).grossWeight : it.netWeight}
                                  on={(v) => {
                                    const stWt = (it as any).stoneWeight || 0;
                                    const net = Math.max(0, v - stWt);
                                    const patch: any = { grossWeight: v, netWeight: net };
                                    if (it.makingChargePct) patch.makingCharge = (net * it.ratePerGram * it.makingChargePct) / 100;
                                    updateItem(i, patch);
                                  }}
                                  className="w-16 h-8 bg-background"
                                />
                              </td>
                              <td className="py-2">
                                <NumI
                                  v={(it as any).stoneWeight || 0}
                                  on={(v) => {
                                    const grWt = (it as any).grossWeight !== undefined ? (it as any).grossWeight : it.netWeight;
                                    const net = Math.max(0, grWt - v);
                                    const patch: any = { stoneWeight: v, netWeight: net };
                                    if (it.makingChargePct) patch.makingCharge = (net * it.ratePerGram * it.makingChargePct) / 100;
                                    updateItem(i, patch);
                                  }}
                                  className="w-16 h-8 bg-background"
                                />
                              </td>
                              <td className="py-2">
                                <NumI
                                  v={it.netWeight}
                                on={(v) => {
                                  const patch: any = { netWeight: v, grossWeight: v + ((it as any).stoneWeight || 0) };
                                  if (it.makingChargePct) patch.makingCharge = (v * it.ratePerGram * it.makingChargePct) / 100;
                                  updateItem(i, patch);
                                }}
                                  className="w-16 h-8 bg-background"
                                />
                              </td>
                              <td className="py-2">
                                <NumI
                                  v={it.ratePerGram}
                                on={(v) => {
                                  const patch: any = { ratePerGram: v };
                                  if (it.makingChargePct) patch.makingCharge = (it.netWeight * v * it.makingChargePct) / 100;
                                  updateItem(i, patch);
                                }}
                                  className="w-20 h-8 bg-background"
                                />
                              </td>
                              <td className="py-2 font-medium">{inr(amount)}</td>
                            <td className="py-2">
                              <NumI
                                v={it.makingCharge || 0}
                                on={(v) => {
                                  updateItem(i, { makingCharge: v, makingChargePct: 0 });
                                }}
                                className="w-20 h-8 bg-background"
                              />
                            </td>
                              <td className="py-2 text-right pr-3 font-medium">{inr(c.line)}</td>
                              <td className="py-2 text-right">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeItem(i)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  )}
              </div>

              {/* 3. Payment Summary */}
              <div className="p-5 border rounded-lg bg-muted/10 space-y-4">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">3</span>
                  Payment Summary
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="text-sm text-muted-foreground bg-background p-4 rounded-lg border border-border">
                    <p className="font-medium text-foreground mb-2">Billing Instructions:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Verify the customer and item details before generating.</li>
                      <li>Any discount or old gold amount entered will be deducted from the subtotal.</li>
                      <li>GST is calculated automatically if 'GST Invoice' is selected.</li>
                    </ul>
                  </div>
                  <div className="space-y-4 text-sm bg-background p-5 rounded-lg border border-border shadow-sm">
                    <Row label="Subtotal" v={inr(totals.subtotal)} />
                    
                    <div className="flex items-center justify-between gap-4">
                      <Label className="text-muted-foreground font-normal">Discount (₹)</Label>
                      <Input type="number" className="w-32 h-8 text-right bg-background" value={discount} onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" />
                    </div>
                    
                    <div className="flex items-center justify-between gap-4">
                      <Label className="text-muted-foreground font-normal">Old Gold / Silver (₹)</Label>
                      <Input type="number" className="w-32 h-8 text-right bg-background" value={oldGoldAmount} onChange={(e) => setOldGoldAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" />
                    </div>

                    {isGst && (
                      <>
                        <Row label="CGST @ 1.5%" v={inr(totals.cgst)} />
                        <Row label="SGST @ 1.5%" v={inr(totals.sgst)} />
                      </>
                    )}
                    
                    <Row label="Round Off" v={inr(totals.roundOff)} />
                    
                    <div className="border-t pt-4 mt-2 flex justify-between items-center font-display text-xl text-primary">
                      <span>Grand Total</span>
                      <span>{inr(totals.gTotal)}</span>
                    </div>

                    <div className="bg-muted/40 p-4 rounded-lg border border-border space-y-4 mt-4">
                      {(linkedOrderId && (() => {
                        const linkedOrder = orders.find(o => (o._id || o.id) === linkedOrderId || `order_${o._id || o.id}` === linkedOrderId);
                        const linkedRepair = repairs.find(r => `repair_${r._id || r.id}` === linkedOrderId);
                        return (linkedOrder && (linkedOrder.advancePaid || 0) > 0) || (linkedRepair && (linkedRepair.advance || 0) > 0);
                      })()) && (
                        <Row 
                          label={
                            (() => {
                              const linkedOrder = orders.find(o => (o._id || o.id) === linkedOrderId || `order_${o._id || o.id}` === linkedOrderId);
                              if (linkedOrder) return `Order Advance (${linkedOrder.orderNo})`;
                              const linkedRepair = repairs.find(r => `repair_${r._id || r.id}` === linkedOrderId);
                              if (linkedRepair) return `Repair Advance (${linkedRepair.ticketNo})`;
                              return "Advance";
                            })()
                          }
                          v={`- ${inr(
                            (() => {
                              const linkedOrder = orders.find(o => (o._id || o.id) === linkedOrderId || `order_${o._id || o.id}` === linkedOrderId);
                              if (linkedOrder) return linkedOrder.advancePaid || 0;
                              const linkedRepair = repairs.find(r => `repair_${r._id || r.id}` === linkedOrderId);
                              if (linkedRepair) return linkedRepair.advance || 0;
                              return 0;
                            })()
                          )}`} 
                          valueClassName="text-green-600" 
                        />
                      )}
                      <div className="flex items-center justify-between gap-4">
                        <Label className="text-muted-foreground font-normal">Cash Amount</Label>
                        <Input type="number" className="w-32 h-8 text-right bg-background" value={cashAmount} onChange={(e) => setCashAmount(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} placeholder={editingId ? "0" : `${totals.gTotal}`} />
                      </div>
                      
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="text-muted-foreground font-normal">Online Amount</Label>
                          <Select value={onlineMode} onValueChange={setOnlineMode}>
                            <SelectTrigger className="w-24 h-8 bg-background text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(["UPI", "Card", "Bank", "EMI"] as const).map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input type="number" className="w-32 h-8 text-right bg-background" value={onlineAmount} onChange={(e) => setOnlineAmount(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} placeholder="0" />
                      </div>

                      {(() => {
                        let currentPaid = 0;
                        const linkedOrder = orders.find(o => (o._id || o.id) === linkedOrderId || `order_${o._id || o.id}` === linkedOrderId);
                        const linkedRepair = repairs.find(r => `repair_${r._id || r.id}` === linkedOrderId);
                        const orderAdv = linkedOrder ? (linkedOrder.advancePaid || 0) : linkedRepair ? (linkedRepair.advance || 0) : 0;
                        if (cashAmount === "" && onlineAmount === "" && orderAdv === 0 && !editingId) {
                          currentPaid = totals.gTotal;
                        } else {
                          currentPaid = (Number(cashAmount) || 0) + (Number(onlineAmount) || 0) + orderAdv;
                        }
                        const currentDue = Math.max(0, totals.gTotal - currentPaid);
                        return (
                          <Row 
                            label="Balance Due" 
                            v={inr(currentDue)} 
                            valueClassName={currentDue > 0 ? "text-rose-600" : "text-green-600"}
                          />
                        );
                      })()}
                    </div>
                    
                    <div className="bg-muted/40 p-4 rounded-lg border border-border mt-4">
                      <Label className="text-muted-foreground font-normal block mb-3">Signatures (Optional)</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Customer Signature</Label>
                          <Input type="file" accept="image/*" className="bg-background mt-1" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setCustomerSignature(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }} />
                          {customerSignature && <img src={customerSignature} alt="Customer Signature" className="mt-2 h-16 object-contain" />}
                        </div>
                        <div>
                          <Label className="text-xs">Authorized Signatory</Label>
                          <Input type="file" accept="image/*" className="bg-background mt-1" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setAuthorizedSignatory(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }} />
                          {authorizedSignatory && <img src={authorizedSignatory} alt="Authorized Signatory" className="mt-2 h-16 object-contain" />}
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full mt-2" size="lg" disabled={items.length === 0 || !customerId}>
                      <Plus className="w-4 h-4 mr-2" /> {editingId ? "Save Changes" : "Generate Invoice"}
                    </Button>
              </div>
            </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPI label="Total Invoices" value={roleInvoices.length} />
        <KPI label="Today's Invoices" value={todayInvoices.length} />
        <KPI label="Today's Revenue" value={inr(todayRevenue)} />
      </div>

      <div className="relative mb-4 w-full sm:max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9 w-full bg-background border-border shadow-sm" placeholder="Search by invoice no, name or mobile..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      {(isOperator ? [{ title: "GST Invoice History", data: gstInvoices }] : [
        { title: "NON-GST Invoice History", data: nonGstInvoices }
      ]).map(({ title, data }, index) => {
        let tableData = data;
        if (title === "NON-GST Invoice History") {
          if (nonGstFilter === "INV") {
            tableData = tableData.filter((i) => !i.number?.startsWith("MAN-"));
          } else if (nonGstFilter === "MAN") {
            tableData = tableData.filter((i) => i.number?.startsWith("MAN-"));
          }
        }

        // Ensure the newest invoices always appear at the top of Page 1
        const sortedData = [...tableData].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const totalPages = Math.ceil(sortedData.length / 10) || 1;
        const currentPage = Math.min(pages[index] || 1, totalPages);
        const paginated = sortedData.slice((currentPage - 1) * 10, currentPage * 10);
        
        return (
        <Card key={title} className={index === 0 ? "mb-6" : ""}>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="font-display flex items-center gap-2">
              <Receipt className="w-5 h-5" /> {title}
            </CardTitle>
            {title === "NON-GST Invoice History" && (
              <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
                <button className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${nonGstFilter === "All" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setNonGstFilter("All")}>All</button>
                <button className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${nonGstFilter === "INV" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setNonGstFilter("INV")}>Invoices</button>
                <button className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${nonGstFilter === "MAN" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setNonGstFilter("MAN")}>Manual Dues</button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {tableData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">No invoices found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b bg-muted/20">
                    <tr>
                      <th className="p-3 font-medium">Invoice</th>
                      <th className="font-medium">Date</th>
                      <th className="font-medium">Customer</th>
                      {title === "NON-GST Invoice History" && <th className="font-medium">Type</th>}
                      <th className="font-medium">Mode</th>
                      <th className="text-right font-medium">Total</th>
                      <th className="text-right font-medium">Due</th>
                      <th className="text-center font-medium">Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(i => (
                      <tr key={i._id || i.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="p-3 font-medium">{i.number}</td>
                        <td>{formatDate(i.createdAt)}</td>
                        <td>{i.customerName}</td>
                        {title === "NON-GST Invoice History" && (
                          <td>
                            {i.number?.startsWith("MAN-") ? (
                              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">Manual Due</span>
                            ) : (
                              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">Invoice</span>
                            )}
                          </td>
                        )}
                        <td>{i.paymentMode}</td>
                        <td className="text-right font-medium text-green-600">{inr(i.total)}</td>
                        <td className="text-right font-medium text-rose-600">{inr(i.balanceDue || 0)}</td>
                        <td className="text-center">
                          {(i.balanceDue || 0) <= 0 ? (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">Paid</span>
                          ) : (
                            <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">Due</span>
                          )}
                        </td>
                        <td>
                          <div className="flex justify-end gap-2 pr-3">
                            <Button size="sm" variant="outline" onClick={() => setViewing(i)}>View</Button>
                            <Button size="icon" variant="ghost" onClick={() => editInvoice(i)}>
                              <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => removeInvoice(i)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, tableData.length)} of {tableData.length} entries</div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setPages(p => ({ ...p, [index]: Math.max(1, currentPage - 1) }))} disabled={currentPage === 1}>Prev</Button>
                      <Button size="sm" variant="outline" onClick={() => setPages(p => ({ ...p, [index]: Math.min(totalPages, currentPage + 1) }))} disabled={currentPage === totalPages}>Next</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )})}

      {viewing && <InvoiceModal inv={viewing} authUser={authUser} onClose={() => setViewing(null)} />}
    </Layout>
  );
}

function Row({ label, v, className, valueClassName }: { label: string; v: string; className?: string; valueClassName?: string }) {
  return (
    <div className={`flex justify-between items-center ${className || ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${valueClassName || ""}`}>{v}</span>
    </div>
  );
}

function NumI({ v, on, className = "w-24 h-8" }: { v: number; on: (n: number) => void; className?: string }) {
  const [val, setVal] = useState(v != null ? v.toString() : "0");

  // Update local state if the prop changes externally (e.g., reset)
  useEffect(() => {
    setVal((prev) => {
      const parsedPrev = parseFloat(prev);
      if (parsedPrev === v || (prev === "" && (v === 0 || v == null))) {
        return prev;
      }
      return v != null ? v.toString() : "0";
    });
  }, [v]);

  return (
    <Input
      type="number"
      className={className}
      value={val}
      onBlur={() => {
        if (val === "" || isNaN(parseFloat(val))) {
          setVal("0");
          on(0);
        }
      }}
      onChange={(e) => {
        setVal(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed)) {
          on(parsed);
        } else if (e.target.value === "") {
          on(0);
        }
      }}
    />
  );
}

function KPI({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-display mt-1">{value}</div>
      </CardContent>
    </Card>
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
