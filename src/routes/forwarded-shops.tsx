import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inr, type Girvi, useLocalState, uid } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { girviAPI } from "@/lib/api";
import { Store, Eye, ArrowUpRight, Plus, MapPin, FileText, Phone, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { InvoiceTerms, ShopHeader } from "@/components/InvoiceBranding";

function getElapsedMonthsAndDays(dateStr: string) {
  if (!dateStr) return { months: 0, days: 0 };
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (now.getTime() <= start.getTime()) return { months: 0, days: 0 };

  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }

  return { months, days };
}

function calculateForwardedInterest(girvi: Girvi) {
  if (!girvi.date || !girvi.forwardedAmount || !girvi.forwardedInterestPct) return 0;
  
  const isDaily = girvi.forwardedInterestPeriod === "Daily" || girvi.note?.includes("[FwdIntPeriod:Daily]");
  if (isDaily) {
    const start = new Date(girvi.date);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffTime = now.getTime() > start.getTime() ? now.getTime() - start.getTime() : 0;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const interestPerDay = girvi.forwardedAmount * (girvi.forwardedInterestPct / 100);
    return Math.round(interestPerDay * diffDays);
  } else {
    const { months, days } = getElapsedMonthsAndDays(girvi.date);
    const interestPerMonth = girvi.forwardedAmount * (girvi.forwardedInterestPct / 100);
    const interestForDays = (interestPerMonth / 30) * days;
    return Math.round((months * interestPerMonth) + interestForDays);
  }
}

export type ForwardedShopProfile = {
  id: string;
  name: string;
  phone: string;
  address: string;
  gst: string;
};

export default function ForwardedShopsPage() {
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const { data: girvis = [], isLoading } = useApi<Girvi[]>(["girvis"], () => girviAPI.getAll());
  const updateMutation = useApiMutation((data: { id: string; body: Girvi }) => girviAPI.update(data.id, data.body), ["girvis"]);
  const [profiles, setProfiles] = useLocalState<ForwardedShopProfile[]>("ajms.forwardedShops", []);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [settlingItem, setSettlingItem] = useState<Girvi | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState<ForwardedShopProfile>({ id: "", name: "", phone: "", address: "", gst: "" });

  const shops = useMemo(() => {
    const map = new Map<string, any>();
    
    // 1. Initialize with explicitly saved profiles
    profiles.forEach(p => {
      map.set(p.name.toLowerCase().trim(), {
        profileId: p.id,
        name: p.name,
        phone: p.phone,
        address: p.address,
        gst: p.gst,
        records: [],
      });
    });

    // 2. Group girvis by forwarded shop name
    girvis.forEach(g => {
      const originalName = (g.forwardedShopName || g.forwardedTo)?.trim();
      if (originalName) {
        const key = originalName.toLowerCase();
        const existing = map.get(key);
        const records = existing ? existing.records : [];
        records.push(g);
        
        map.set(key, {
          ...(existing || {
            name: originalName,
            address: g.forwardedShopAddress,
            gst: g.forwardedShopGstNo,
          }),
          records,
        });
      }
    });

    return Array.from(map.values()).map(shop => {
      const activeRecords = shop.records.filter((r: Girvi) => r.status === "Active" && (r.forwardedAmount || 0) > 0);
      const settledRecords = shop.records.filter((r: Girvi) => r.note && /\[Forwarding to .*? cleared on .*? - Paid .*?\]/.test(r.note));
      const totalPrincipal = activeRecords.reduce((s: number, r: Girvi) => s + (r.forwardedAmount || 0), 0);
      const totalInterest = activeRecords.reduce((s: number, r: Girvi) => s + calculateForwardedInterest(r), 0);
      
      let addr = shop.address;
      let gst = shop.gst;
      if (!shop.profileId && shop.records.length > 0) {
        const latest = [...shop.records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        addr = latest.forwardedShopAddress;
        gst = latest.forwardedShopGstNo;
      }

      return {
        ...shop,
        address: addr,
        gst: gst,
        activeRecords,
        settledRecords,
        totalPrincipal,
        totalInterest,
      };
    })
    .filter(shop => shop.profileId || shop.activeRecords.length > 0 || shop.settledRecords.length > 0)
    .sort((a, b) => b.totalPrincipal - a.totalPrincipal); // Sort by highest principal first
  }, [girvis, profiles]);

  const activeProfile = shops.find(s => s.name === selectedShop);

  const totalMarketOwed = shops.reduce((s, shop) => s + shop.totalPrincipal + shop.totalInterest, 0);
  const totalMarketPrincipal = shops.reduce((s, shop) => s + shop.totalPrincipal, 0);

  const handleSettle = async () => {
    if (!settlingItem) return;
    const principal = settlingItem.forwardedAmount || 0;
    const interest = calculateForwardedInterest(settlingItem);
    const total = principal + interest;
    
    try {
      const updatedGirvi = {
        ...settlingItem,
        forwardedAmount: 0,
        forwardedInterestPct: 0,
        note: `${settlingItem.note ? settlingItem.note + '\n' : ''}[Forwarding to ${settlingItem.forwardedShopName || settlingItem.forwardedTo} cleared on ${formatDate(new Date().toISOString())} - Paid ${inr(total)}]`
      };
      
      await updateMutation.mutateAsync({ id: settlingItem.id || (settlingItem as any)._id, body: updatedGirvi });
      
      setReceiptData({
        girvi: settlingItem,
        principal,
        interest,
        total,
        date: new Date().toISOString()
      });
      
      setSettlingItem(null);
      toast.success("Forwarding settled successfully");
    } catch (e) {
      toast.error("Failed to settle forwarding");
    }
  };

  const handleDelete = (shop: any) => {
    if (shop.activeRecords.length > 0) {
      toast.error("Cannot delete a shop with active forwarded items.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete the profile for ${shop.name}?`)) {
      setProfiles(profiles.filter(p => p.name.toLowerCase().trim() !== shop.name.toLowerCase().trim()));
      toast.success("Shop profile deleted");
      if (selectedShop === shop.name) setSelectedShop(null);
    }
  };

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Forwarded Shops</h1>
          <p className="text-muted-foreground mt-1">Manage profiles and payouts for shops you forward Girvi items to.</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button size="lg" onClick={() => setForm({ id: "", name: "", phone: "", address: "", gst: "" })}>
              <Plus className="w-4 h-4 mr-2" /> Add Shop Profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Edit Shop Profile" : "New Shop Profile"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Shop Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="E.g., ABC Jewellers" /></div>
              <div><Label>Mobile / Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div><Label>GST No (optional)</Label><Input value={form.gst} onChange={e => setForm({...form, gst: e.target.value})} /></div>
              <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => {
                if (!form.name) return;
                if (form.id) {
                  setProfiles(profiles.map(p => p.id === form.id ? form : p));
                } else {
                  setProfiles([...profiles, { ...form, id: uid() }]);
                }
                setOpenNew(false);
              }}>Save Profile</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Shops Forwarded To</div>
            <div className="text-2xl font-display mt-1">{shops.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Market Principal (Active)</div>
            <div className="text-2xl font-display mt-1 text-purple-700">{inr(totalMarketPrincipal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-rose-600 font-medium">Total Market Payable (w/ Interest)</div>
            <div className="text-2xl font-display mt-1 text-rose-700">{inr(totalMarketOwed)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Store className="w-5 h-5 text-purple-700" /> Forwarding Partners
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Loading shops...</p>
          ) : shops.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No items have been forwarded to other shops yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b bg-muted/20">
                <tr>
                  <th className="py-3 px-4 font-medium">Shop Name</th>
                  <th className="py-3 font-medium">Items</th>
                  <th className="py-3 font-medium text-right">Principal Taken</th>
                  <th className="py-3 font-medium text-right">Interest Due</th>
                  <th className="py-3 font-medium text-right text-rose-600">Total Owed</th>
                  <th className="py-3 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => (
                  <tr key={shop.name} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-3 px-4 font-medium text-primary">{shop.name}</td>
                    <td className="py-3">
                      <div>{shop.activeRecords.length} active</div>
                      {shop.settledRecords.length > 0 && <div className="text-xs text-muted-foreground">{shop.settledRecords.length} settled</div>}
                    </td>
                    <td className="py-3 text-right">{inr(shop.totalPrincipal)}</td>
                    <td className="py-3 text-right text-amber-600">{inr(shop.totalInterest)}</td>
                    <td className="py-3 text-right font-medium text-rose-600">{inr(shop.totalPrincipal + shop.totalInterest)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedShop(shop.name)}>
                          <Eye className="w-4 h-4 mr-2" /> View Profile
                        </Button>
                        <Button size="icon" variant="ghost" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(shop)}>
                          <Trash2 className="w-4 h-4" />
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

      {/* Shop Profile Dialog */}
      <Dialog open={!!selectedShop} onOpenChange={(v) => !v && setSelectedShop(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          {activeProfile && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-display flex items-center gap-2 text-purple-800">
                  <Store className="w-6 h-6" /> {activeProfile.name}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="flex items-start gap-2 text-sm text-muted-foreground"><Phone className="w-4 h-4 mt-0.5 shrink-0" /> {activeProfile.phone || "No phone on file"}</div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /> {activeProfile.address || "No address on file"}</div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground"><FileText className="w-4 h-4 mt-0.5 shrink-0" /> GST: {activeProfile.gst || "—"}</div>
              </div>
              
              <h3 className="font-semibold mt-6 mb-2 flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-rose-500"/> Forwarded Items Currently Active</h3>
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b bg-muted/20">
                    <tr>
                      <th className="py-2 px-3 font-medium">Original Loan</th>
                      <th className="py-2 font-medium">Item Details</th>
                      <th className="py-2 font-medium text-right">Rate</th>
                      <th className="py-2 font-medium text-right">Principal</th>
                      <th className="py-2 font-medium text-right">Accrued Interest</th>
                      <th className="py-2 px-3 font-medium text-right">Payable</th>
                      <th className="py-2 px-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeProfile.activeRecords.map((r: Girvi) => {
                      const interest = calculateForwardedInterest(r);
                      return (
                        <tr key={r.id || (r as any)._id} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2 px-3">
                            <div className="font-medium">{r.loanNo}</div>
                            <div className="text-xs text-muted-foreground">{formatDate(r.date)}</div>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-3">
                              {r.forwardedImageUrl ? (
                                <img src={r.forwardedImageUrl} alt="Forwarded Item" className="w-10 h-10 rounded object-cover border border-border shrink-0" />
                              ) : r.imageUrl ? (
                                <img src={r.imageUrl} alt="Pledged Item" className="w-10 h-10 rounded object-cover border border-border shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center border border-border shrink-0 text-[10px] text-muted-foreground">No img</div>
                              )}
                              <div>
                                <div className="font-medium text-primary">{r.itemDescription}</div>
                                <div className="text-xs text-muted-foreground">{r.itemType} {r.purity} • {r.netWeight}g</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 text-right">{r.forwardedInterestPct}%/{r.forwardedInterestPeriod === "Daily" || r.note?.includes("[FwdIntPeriod:Daily]") ? "day" : "mo"}</td>
                          <td className="py-2 text-right">{inr(r.forwardedAmount || 0)}</td>
                          <td className="py-2 text-right text-amber-600">{inr(interest)}</td>
                          <td className="py-2 px-3 text-right font-medium text-rose-600">{inr((r.forwardedAmount || 0) + interest)}</td>
                          <td className="py-2 px-3 text-right">
                            <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={() => setSettlingItem(r)}>
                              Settle
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {activeProfile.settledRecords.length > 0 && (
                <>
                  <h3 className="font-semibold mt-6 mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-green-600"/> Settlement History</h3>
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-muted-foreground border-b bg-muted/20">
                        <tr>
                          <th className="py-2 px-3 font-medium">Original Loan</th>
                          <th className="py-2 font-medium">Item Details</th>
                          <th className="py-2 font-medium text-right pr-3">Settlement Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeProfile.settledRecords.map((r: Girvi) => {
                          const match = r.note?.match(/cleared on (.*?) - Paid (.*?)\]/);
                          const clearedDate = match ? match[1] : "—";
                          const paidAmount = match ? match[2] : "—";
                          return (
                            <tr key={r.id || (r as any)._id} className="border-b last:border-0 hover:bg-muted/40">
                              <td className="py-2 px-3">
                                <div className="font-medium">{r.loanNo}</div>
                              </td>
                              <td className="py-2">
                                <div className="font-medium text-primary">{r.itemDescription}</div>
                                <div className="text-xs text-muted-foreground">{r.itemType} {r.purity}</div>
                              </td>
                              <td className="py-2 text-right pr-3">
                                <div className="text-green-700 font-medium">Paid {paidAmount}</div>
                                <div className="text-xs text-muted-foreground">on {clearedDate}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!settlingItem} onOpenChange={(v) => !v && setSettlingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Settle Forwarded Item</DialogTitle>
          </DialogHeader>
          {settlingItem && (
            <div className="space-y-4 py-2">
              <div className="text-sm text-muted-foreground">
                You are about to clear the forwarding balance for <strong className="text-foreground">{settlingItem.itemDescription}</strong>.
              </div>
              <div className="bg-muted/30 p-4 rounded-md border border-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Principal Taken:</span>
                  <span className="font-medium">{inr(settlingItem.forwardedAmount || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Interest Accrued:</span>
                  <span className="font-medium text-amber-600">{inr(calculateForwardedInterest(settlingItem))}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t mt-2">
                  <span>Total to Pay:</span>
                  <span className="text-rose-600">{inr((settlingItem.forwardedAmount || 0) + calculateForwardedInterest(settlingItem))}</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSettlingItem(null)}>Cancel</Button>
                <Button onClick={handleSettle} disabled={updateMutation.isPending}>Confirm Payment & Print Bill</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {receiptData && <ForwardingReceiptModal data={receiptData} authUser={authUser} onClose={() => setReceiptData(null)} />}
    </Layout>
  );
}

function ForwardingReceiptModal({ data, authUser, onClose }: { data: any, authUser: any, onClose: () => void }) {
  const { girvi, principal, interest, total, date } = data;
  return (
    <div className="fixed inset-0 z-100 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:bg-white print:p-0 overflow-y-auto pointer-events-auto">
      <div className="bg-white w-full max-w-3xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:max-h-none print:block">
        <div className="p-8 print:p-0 bg-white overflow-y-auto flex-1 print:overflow-visible">
          <ShopHeader documentLabel="Forwarding Settlement" />
          
          {/* Meta */}
          <div className="flex justify-between items-start mb-6 text-sm">
            <div>
              <div className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-1">Settled With Partner:</div>
              <div className="font-bold text-lg text-purple-800">{girvi.forwardedShopName || girvi.forwardedTo}</div>
              <div className="text-slate-700">{girvi.forwardedShopAddress || "—"}</div>
              {girvi.forwardedShopGstNo && <div className="text-slate-700">GST: {girvi.forwardedShopGstNo}</div>}
            </div>
            <div className="text-right">
              <div className="text-xl font-display font-bold mb-2 text-slate-900">FORWARDING SETTLEMENT</div>
              <table className="ml-auto text-left text-slate-700">
                <tbody>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Ref Loan No:</td><td className="font-semibold text-slate-900">{girvi.loanNo}</td></tr>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Settlement Date:</td><td className="font-semibold text-slate-900">{formatDate(date)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Details */}
          <div className="overflow-x-auto w-full mb-6">
            <table className="w-full text-sm border-collapse border border-slate-300 min-w-125">
              <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 py-2 px-3 text-left text-slate-600">Item Description</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Net Wt</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Rate</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Principal Taken</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Interest Accrued</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="border border-slate-300 py-2 px-3 font-medium">{girvi.itemDescription}</td>
                <td className="border border-slate-300 py-2 px-3 text-right">{girvi.netWeight} g</td>
                <td className="border border-slate-300 py-2 px-3 text-right">{girvi.forwardedInterestPct}% / {girvi.forwardedInterestPeriod === "Daily" || girvi.note?.includes("[FwdIntPeriod:Daily]") ? "day" : "mo"}</td>
                <td className="border border-slate-300 py-2 px-3 text-right">{inr(principal)}</td>
                <td className="border border-slate-300 py-2 px-3 text-right">{inr(interest)}</td>
              </tr>
            </tbody>
          </table>
          </div>
          
          <div className="flex justify-end">
             <div className="w-full max-w-sm">
               <table className="w-full text-sm">
                 <tbody>
                    <tr><td className="py-1.5 text-slate-600">Principal Cleared</td><td className="py-1.5 text-right font-medium">{inr(principal)}</td></tr>
                    <tr><td className="py-1.5 text-slate-600">Interest Paid</td><td className="py-1.5 text-right font-medium">{inr(interest)}</td></tr>
                    <tr className="border-t-2 border-slate-300 text-lg">
                      <td className="py-2 font-bold text-slate-900">Total Settled</td>
                      <td className="py-2 text-right font-bold text-green-700">{inr(total)}</td>
                    </tr>
                 </tbody>
               </table>
             </div>
          </div>

          <div className="mt-6 text-[10px] text-slate-600">
            {authUser?.termsAndConditions ? <div className="whitespace-pre-wrap">{authUser.termsAndConditions}</div> : <InvoiceTerms />}
          </div>
          
          <div className="mt-12 text-center text-sm font-bold text-slate-400 uppercase tracking-widest border-t-2 border-dashed border-slate-200 pt-4">
            End of Receipt
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
