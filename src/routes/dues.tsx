import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr, type Invoice, useLocalState } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";
import { invoicesAPI, supplierAPI } from "@/lib/api";
import { Search, AlertCircle, MessageCircle, Scale, Building2, User, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export default function DuesPage() {
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const { data: allInvoices = [], isLoading: isLoadingInv } = useApi<Invoice[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: suppliers = [], isLoading: isLoadingSup } = useApi<any[]>(["suppliers"], () => supplierAPI.getAll());
  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"Customer" | "Supplier">("Customer");

  const isOperator = authUser?.role === "operator";
  const invoices = useMemo(() => allInvoices.filter(i => isOperator ? i.type === "GST" : i.type !== "GST"), [allInvoices, isOperator]);

  const dueInvoices = useMemo(() => {
    return invoices
      .filter((i) => (i.balanceDue || 0) > 0)
      .filter(
        (i) =>
          i.customerName.toLowerCase().includes(q.toLowerCase()) ||
          i.customerMobile.includes(q) ||
          i.number.toLowerCase().includes(q.toLowerCase())
      )
      .filter((i) => {
        if (!dateFilter) return true;
        return new Date(i.createdAt).toISOString().slice(0, 10) === dateFilter;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Oldest first
  }, [invoices, q, dateFilter]);

  const totalDue = dueInvoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0);

  const totalPages = Math.ceil(dueInvoices.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = dueInvoices.slice((currentPage - 1) * 10, currentPage * 10);

  const customerMetalTrapped = useMemo(() => {
    const breakdown: Record<string, number> = {};
    dueInvoices.forEach(inv => {
      inv.items?.forEach(it => {
        const purity = it.purity || "Unknown";
        breakdown[purity] = (breakdown[purity] || 0) + (it.netWeight || 0);
      });
    });
    return breakdown;
  }, [dueInvoices]);

  const supplierDues = useMemo(() => {
    let result = suppliers.map((s: any) => {
      const goldBreakdown: Record<string, { credit: number, debit: number, net: number }> = {};
      const silverBreakdown: Record<string, { credit: number, debit: number, net: number }> = {};
      let totalGoldTx = 0;
      let totalSilverTx = 0;

      (s.transactions || []).forEach((tx: any) => {
        if (tx.metal === "Gold") {
          const p = tx.purity || "22K";
          if (!goldBreakdown[p]) goldBreakdown[p] = { credit: 0, debit: 0, net: 0 };
          if (tx.type === "Credit") {
            goldBreakdown[p].credit += tx.weight;
            goldBreakdown[p].net += tx.weight;
            totalGoldTx += tx.weight;
          } else {
            goldBreakdown[p].debit += tx.weight;
            goldBreakdown[p].net -= tx.weight;
            totalGoldTx -= tx.weight;
          }
        } else if (tx.metal === "Silver") {
          const p = tx.purity || "Silver";
          if (!silverBreakdown[p]) silverBreakdown[p] = { credit: 0, debit: 0, net: 0 };
          if (tx.type === "Credit") {
            silverBreakdown[p].credit += tx.weight;
            silverBreakdown[p].net += tx.weight;
            totalSilverTx += tx.weight;
          } else {
            silverBreakdown[p].debit += tx.weight;
            silverBreakdown[p].net -= tx.weight;
            totalSilverTx -= tx.weight;
          }
        }
      });

      const openingGold = (s.balanceGold || 0) - totalGoldTx;
      if (Math.abs(openingGold) > 0.001) {
         if (!goldBreakdown["Opening"]) goldBreakdown["Opening"] = { credit: 0, debit: 0, net: 0 };
         goldBreakdown["Opening"].net += openingGold;
         if (openingGold > 0) goldBreakdown["Opening"].credit += openingGold;
         else goldBreakdown["Opening"].debit += Math.abs(openingGold);
      }

      const openingSilver = (s.balanceSilver || 0) - totalSilverTx;
      if (Math.abs(openingSilver) > 0.001) {
         if (!silverBreakdown["Opening"]) silverBreakdown["Opening"] = { credit: 0, debit: 0, net: 0 };
         silverBreakdown["Opening"].net += openingSilver;
         if (openingSilver > 0) silverBreakdown["Opening"].credit += openingSilver;
         else silverBreakdown["Opening"].debit += Math.abs(openingSilver);
      }

      return { ...s, goldBreakdown, silverBreakdown };
    }).filter((s: any) => 
      Object.values(s.goldBreakdown as Record<string, {net:number}>).some(v => Math.abs(v.net) > 0.001) || 
      Object.values(s.silverBreakdown as Record<string, {net:number}>).some(v => Math.abs(v.net) > 0.001)
    );

    if (q.trim()) {
      const lowerQ = q.toLowerCase().trim();
      result = result.filter((s: any) => s.name.toLowerCase().includes(lowerQ) || s.mobile.includes(lowerQ));
    }
    return result;
  }, [suppliers, q]);

  const totalPagesSup = Math.ceil(supplierDues.length / 10) || 1;
  const currentPageSup = Math.min(page, totalPagesSup);
  const paginatedSup = supplierDues.slice((currentPageSup - 1) * 10, currentPageSup * 10);

  const sendWhatsApp = (inv: Invoice) => {
    let phone = inv.customerMobile.replace(/\D/g, "");
    // Default to Indian country code if standard 10 digits are provided
    if (phone.length === 10) phone = "91" + phone;
    
    const message = `*अरिहंत ज्वेलर्स*\n\nनमस्ते ${inv.customerName},\n\nयह आपके इनवॉइस नंबर: ${inv.number} (दिनांक ${formatDate(inv.createdAt)}) के लिए *${inr(inv.balanceDue || 0)}* की बकाया राशि के संबंध में एक रिमाइंडर है।\n\nकृपया जल्द से जल्द बकाया राशि का भुगतान करें।\n\nधन्यवाद!`;
    const encoded = encodeURIComponent(message);
    
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
  };

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Dues Management</h1>
          <p className="text-muted-foreground mt-1">Track unpaid customer invoices and supplier metal dues.</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button 
          variant={activeTab === "Customer" ? "default" : "outline"} 
          onClick={() => { setActiveTab("Customer"); setPage(1); setQ(""); }}
          className={`rounded-full ${activeTab === "Customer" ? "bg-primary text-primary-foreground shadow-sm" : "bg-background text-muted-foreground hover:bg-muted"}`}
        >
          <User className="w-4 h-4 mr-2" /> Customer Amount Dues
        </Button>
        <Button 
          variant={activeTab === "Supplier" ? "default" : "outline"} 
          onClick={() => { setActiveTab("Supplier"); setPage(1); setQ(""); }}
          className={`rounded-full ${activeTab === "Supplier" ? "bg-primary text-primary-foreground shadow-sm" : "bg-background text-muted-foreground hover:bg-muted"}`}
        >
          <Building2 className="w-4 h-4 mr-2" /> Supplier Metal Dues
        </Button>
      </div>

      {activeTab === "Customer" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-rose-500" /> Total Outstanding Dues
                </div>
                <div className="text-3xl font-display mt-1 text-rose-600">{inr(totalDue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Unpaid Invoices</div>
                <div className="text-3xl font-display mt-1">{dueInvoices.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Scale className="w-4 h-4 text-amber-500" /> Gold Trapped in Dues
                </div>
                <div className="mt-2 space-y-1">
                  {Object.keys(customerMetalTrapped).length === 0 ? (
                    <div className="text-sm font-medium text-muted-foreground">0 g</div>
                  ) : (
                    Object.entries(customerMetalTrapped).filter(([_,w]) => w > 0).map(([purity, weight]) => (
                      <div key={purity} className="text-sm flex justify-between border-b border-border/50 last:border-0 pb-1 mb-1 last:pb-0 last:mb-0">
                        <span className="text-muted-foreground">{purity}:</span>
                        <span className="font-medium text-amber-600">{weight.toFixed(3)} g</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 max-w-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 bg-background" placeholder="Search by customer name, mobile or invoice no" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Input 
            type="date"
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)} 
            className="w-40 bg-background h-9"
          />
          {dateFilter && (
            <Button variant="ghost" onClick={() => setDateFilter("")}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Customer Pending Dues</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingInv ? (
            <p className="text-center text-muted-foreground py-12">Loading dues...</p>
          ) : dueInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No pending dues found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b bg-muted/20">
                  <tr>
                    <th className="py-3 px-4 font-medium">Invoice Date</th>
                    <th className="py-3 font-medium">Invoice No</th>
                    <th className="py-3 font-medium">Customer</th>
                    <th className="py-3 px-4 font-medium">Item Details</th>
                    <th className="py-3 font-medium text-right">Total Bill</th>
                    <th className="py-3 font-medium text-right text-rose-600">Due Amount</th>
                    <th className="py-3 px-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
              {paginated.map((inv) => (
                    <tr key={inv._id || inv.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-3 px-4">{formatDate(inv.createdAt)}</td>
                      <td className="py-3 font-medium">{inv.number}</td>
                      <td className="py-3">
                        <div className="font-medium">{inv.customerName}</div>
                        <div className="text-xs text-muted-foreground">{inv.customerMobile}</div>
                      </td>
                      <td className="py-3 px-4">
                        {inv.items?.length === 0 ? "—" : (
                          <div className="space-y-1 max-w-50">
                            {inv.items?.map((it: any, idx: number) => (
                              <div key={idx} className="text-xs text-muted-foreground flex items-center gap-1.5 truncate" title={`${it.netWeight}g - ${it.name}`}>
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{it.purity || "Unk"}</Badge>
                                <span className="truncate">{it.netWeight}g - {it.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right">{inr(inv.total)}</td>
                      <td className="py-3 text-right font-medium text-rose-600">{inr(inv.balanceDue || 0)}</td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" variant="outline" className="border-green-200 hover:bg-green-50 hover:text-green-700" onClick={() => sendWhatsApp(inv)}>
                          <MessageCircle className="w-4 h-4 mr-2 text-green-600" /> Reminder
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, dueInvoices.length)} of {dueInvoices.length} entries</div>
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
        </>
      )}

      {activeTab === "Supplier" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4 max-w-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9 bg-background" placeholder="Search supplier..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" /> Supplier Metal Dues
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingSup ? (
                <p className="text-center text-muted-foreground py-12">Loading suppliers...</p>
              ) : supplierDues.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No pending metal dues for suppliers.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-b bg-muted/20">
                      <tr>
                        <th className="py-3 px-4 font-medium">Supplier</th>
                        <th className="py-3 font-medium">Contact</th>
                        <th className="py-3 font-medium">Gold Due (By Carat)</th>
                        <th className="py-3 font-medium">Silver Due (By Carat)</th>
                        <th className="py-3 px-4 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSup.map((sup) => (
                        <tr key={sup._id || sup.id} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-3 px-4 font-medium text-foreground">{sup.name}</td>
                          <td className="py-3">
                            <div className="text-sm">{sup.mobile}</div>
                            <div className="text-xs text-muted-foreground">{sup.companyNo}</div>
                          </td>
                          <td className="py-3 align-top">
                            {Object.keys(sup.goldBreakdown).length === 0 ? <span className="text-muted-foreground">—</span> : (
                              <div className="space-y-1.5 max-w-45">
                                {Object.entries(sup.goldBreakdown).filter(([_, w]: any) => Math.abs(w.net) > 0.001 || w.credit > 0 || w.debit > 0).map(([p, w]: any) => (
                                  <div key={p} className="text-xs border-b border-border/40 last:border-0 pb-1.5 mb-1.5 last:pb-0 last:mb-0">
                                    <div className="flex justify-between items-center mb-1">
                                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-amber-100 text-amber-800 hover:bg-amber-100">{p}</Badge>
                                      <span className="font-semibold text-amber-600">Net: {w.net.toFixed(3)}g</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                      <span>Owe: {w.credit.toFixed(3)}g</span>
                                      <span>Paid: {w.debit.toFixed(3)}g</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 align-top">
                            {Object.keys(sup.silverBreakdown).length === 0 ? <span className="text-muted-foreground">—</span> : (
                              <div className="space-y-1.5 max-w-45">
                                {Object.entries(sup.silverBreakdown).filter(([_, w]: any) => Math.abs(w.net) > 0.001 || w.credit > 0 || w.debit > 0).map(([p, w]: any) => (
                                  <div key={p} className="text-xs border-b border-border/40 last:border-0 pb-1.5 mb-1.5 last:pb-0 last:mb-0">
                                    <div className="flex justify-between items-center mb-1">
                                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-slate-100 text-slate-700 hover:bg-slate-100">{p}</Badge>
                                      <span className="font-semibold text-slate-600">Net: {w.net.toFixed(3)}g</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                      <span>Owe: {w.credit.toFixed(3)}g</span>
                                      <span>Paid: {w.debit.toFixed(3)}g</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right align-top">
                            <Link to="/suppliers">
                              <Button size="sm" variant="outline" className="h-8">
                                <ExternalLink className="w-3 h-3 mr-1.5" /> Ledger
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {totalPagesSup > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <div className="text-xs text-muted-foreground">Showing {(currentPageSup - 1) * 10 + 1} to {Math.min(currentPageSup * 10, supplierDues.length)} of {supplierDues.length} entries</div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPageSup === 1}>Prev</Button>
                        <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPagesSup, p + 1))} disabled={currentPageSup === totalPagesSup}>Next</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Layout>
  );
}