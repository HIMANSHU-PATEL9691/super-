import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  inr, type Advance, type Customer,
} from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { advancesAPI, customerAPI } from "@/lib/api";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdvancePage() {
  const { data: advances = [], isLoading } = useApi<Advance[]>(["advances"], () => advancesAPI.getAll());
  const { data: customers = [] } = useApi<Customer[]>(["customers"], () => customerAPI.getAll());

  const createMutation = useApiMutation((data: Advance) => advancesAPI.create(data), ["advances"]);
  const updateMutation = useApiMutation((data: { id: string; body: Advance }) => advancesAPI.update(data.id, data.body), ["advances"]);
  const deleteMutation = useApiMutation((id: string) => advancesAPI.delete(id), ["advances"]);
  const createCustomerMutation = useApiMutation((data: any) => customerAPI.create(data), ["customers"]);
  const [newCust, setNewCust] = useState({ name: "", phone: "", address: "" });

  const [open, setOpen] = useState(false);
  const [searchCust, setSearchCust] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    customerId: "",
    customerName: "",
    customerMobile: "",
    metal: "Gold" as Advance["metal"],
    purity: "22K",
    ratePerGram: 0,
    amount: 0,
    note: "",
  });

  const totals = useMemo(() => {
    const active = advances.filter((a) => a.status === "Active");
    return {
      activeCount: active.length,
      activeAmount: active.reduce((s, a) => s + a.amount, 0),
      activeWeight: active.reduce((s, a) => s + a.weightLocked, 0),
    };
  }, [advances]);

  async function add() {
    if (!form.amount || !form.ratePerGram) return;
    if (form.customerId !== "NEW" && !form.customerName) return;

    let custId = form.customerId;
    let custName = form.customerName;
    let custMobile = form.customerMobile;

    if (form.customerId === "NEW") {
      if (!newCust.name || !newCust.phone) {
        toast.error("Customer name and phone are required for a new customer.");
        return;
      }
      try {
        const created = await createCustomerMutation.mutateAsync(newCust);
        custId = created._id || created.id;
        custName = created.name;
        custMobile = created.phone || created.mobile || "";
      } catch (e) {
        toast.error("Failed to create new customer");
        return;
      }
    }

    const weightLocked = form.amount / form.ratePerGram;
    const payload = {
      ...form,
      customerId: custId,
      customerName: custName,
      customerMobile: custMobile,
      weightLocked,
      status: "Active",
    };
    try {
      await createMutation.mutateAsync(payload as any);
      setForm({ ...form, customerName: "", customerMobile: "", customerId: "", amount: 0, note: "" });
      setNewCust({ name: "", phone: "", address: "" });
      setOpen(false);
    } catch (error) {
      console.error("[Advances] Error saving to DB:", error);
    }
  }

  async function setStatus(id: string, status: Advance["status"]) {
    const adv = advances.find((a) => a.id === id || (a as any)._id === id);
    if (adv) await updateMutation.mutateAsync({ id, body: { ...adv, status } });
  }

  async function remove(id: string) {
    await deleteMutation.mutateAsync(id);
  }

  const sorted = [...advances].sort((a, b) => b.date.localeCompare(a.date));

  const totalPages = Math.ceil(sorted.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl">Advance Payments</h1>
          <p className="text-muted-foreground mt-1">
            Lock today&apos;s rate when customer pays advance for future Jewellery purchase.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" /> New Advance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>New Advance Payment</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full" />
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Search Customer</Label>
                  <Input 
                    placeholder="Search name or mobile..." 
                    value={searchCust} 
                    onChange={(e) => {
                      setSearchCust(e.target.value);
                      const match = customers.find(c => c.mobile === e.target.value || (c as any).phone === e.target.value || c.name.toLowerCase() === e.target.value.toLowerCase());
                      if (match) setForm({...form, customerId: match._id || match.id, customerName: match.name, customerMobile: match.mobile || (match as any).phone || ""});
                    }} 
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer *</Label>
                  <Select value={form.customerId || ""} onValueChange={(val) => {
                    if (val === "NEW") {
                      setForm({...form, customerId: "NEW", customerName: "", customerMobile: ""});
                    } else {
                      const match = customers.find(c => (c._id || c.id) === val);
                      if (match) setForm({...form, customerId: val, customerName: match.name, customerMobile: match.mobile || (match as any).phone || ""});
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW" className="font-semibold text-primary">+ Create New Customer</SelectItem>
                      {customers.filter(c => c.name.toLowerCase().includes(searchCust.toLowerCase()) || (c.mobile || (c as any).phone || "").includes(searchCust)).map((c) => (
                        <SelectItem key={(c as any)._id || c.id} value={(c as any)._id || c.id}>
                          {c.name} · {c.mobile || (c as any).phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.customerId === "NEW" && (
                <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm space-y-3 mt-2 col-span-2">
                  <div className="space-y-1.5"><Label className="text-xs">Full Name *</Label><Input value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} className="h-8 bg-background" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Mobile No *</Label><Input value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} className="h-8 bg-background" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Address</Label><Input value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} className="h-8 bg-background" /></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Metal</Label>
                  <Select value={form.metal} onValueChange={(v) => setForm({ ...form, metal: v as Advance["metal"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Purity</Label>
                  <Input value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Rate / gram</Label>
                  <Input type="number" value={form.ratePerGram || ""} onChange={(e) => setForm({ ...form, ratePerGram: +e.target.value })} />
                </div>
                <div>
                  <Label>Advance Amount</Label>
                  <Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: +e.target.value })} />
                </div>
              </div>

              {form.amount > 0 && form.ratePerGram > 0 && (
                <div className="text-sm p-3 rounded-md bg-secondary">
                  Locked weight: <strong>{(form.amount / form.ratePerGram).toFixed(3)} g</strong> at {inr(form.ratePerGram)}/g
                </div>
              )}

              <div>
                <Label>Note</Label>
                <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="For necklace, bangles..." />
              </div>

              <Button className="w-full" onClick={add}>Save Advance</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KPI label="Active Advances" value={totals.activeCount} />
        <KPI label="Locked Amount" value={inr(totals.activeAmount)} />
        <KPI label="Locked Weight" value={`${totals.activeWeight.toFixed(3)} g`} />
      </div>

      <Card>
          <CardHeader><CardTitle className="font-display">All Advances</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading advances...</p>
            ) : sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No advance payments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr>
                      <th className="py-2">Date</th>
                      <th>Customer</th>
                      <th>Metal</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">Weight</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                {paginated.map((a) => (
                      <tr key={(a as any)._id || a.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2 pl-4">{formatDate(a.date)}</td>
                        <td className="px-2">
                          <div className="font-medium">{a.customerName}</div>
                          <div className="text-xs text-muted-foreground">{a.customerMobile}</div>
                        </td>
                        <td className="px-2">{a.metal} {a.purity}</td>
                        <td className="text-right">{inr(a.ratePerGram)}</td>
                        <td className="text-right">{inr(a.amount)}</td>
                        <td className="text-right">{a.weightLocked.toFixed(3)} g</td>
                        <td className="px-2 text-right">
                          <Select value={a.status} onValueChange={(v) => setStatus((a as any)._id || a.id, v as Advance["status"]) }>
                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="Redeemed">Redeemed</SelectItem>
                              <SelectItem value="Cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="text-right pr-4">
                          <Button variant="ghost" size="icon" onClick={() => remove((a as any)._id || a.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, sorted.length)} of {sorted.length} entries</div>
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
