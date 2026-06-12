import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { karigarsAPI, repairsAPI, ordersAPI } from "@/lib/api";
import { type Karigar, type Repair, type Order, useLocalState } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { Hammer, Wrench, ShoppingBag, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function KarigarTasksPage() {
  const { data: karigars = [], isLoading: isLoadingK } = useApi<Karigar[]>(["karigars"], () => karigarsAPI.getAll());
  const { data: repairs = [], isLoading: isLoadingR } = useApi<Repair[]>(["repairs"], () => repairsAPI.getAll());
  const { data: orders = [], isLoading: isLoadingO } = useApi<Order[]>(["orders"], () => ordersAPI.getAll());

  const updateRepairMutation = useApiMutation((data: { id: string; body: Repair }) => repairsAPI.update(data.id, data.body), ["repairs"]);
  const updateOrderMutation = useApiMutation((data: { id: string; body: Order }) => ordersAPI.update(data.id, data.body), ["orders"]);

  const [authUser] = useLocalState<any>("ajms.auth", null);
  const isKarigar = authUser?.role === "karigar";

  const [selectedKarigarId, setSelectedKarigarId] = useState<string>(isKarigar ? authUser.id : "");
  const [viewingRepair, setViewingRepair] = useState<Repair | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [pageR, setPageR] = useState(1);
  const [pageO, setPageO] = useState(1);

  const activeKarigarName = useMemo(() => karigars.find(k => (k._id || k.id) === selectedKarigarId)?.name || "", [karigars, selectedKarigarId]);

  const assignedRepairs = useMemo(() => {
    return repairs.filter((r) => r.karigarId === selectedKarigarId || (activeKarigarName && r.note?.includes(`[Assigned: ${activeKarigarName}]`))).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [repairs, selectedKarigarId, activeKarigarName]);

  const assignedOrders = useMemo(() => {
    return orders.filter((o) => o.karigarId === selectedKarigarId || (activeKarigarName && o.note?.includes(`[Assigned: ${activeKarigarName}]`))).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [orders, selectedKarigarId, activeKarigarName]);

  const activeRepairs = useMemo(() => assignedRepairs.filter(r => r.status !== "Delivered"), [assignedRepairs]);
  const activeOrders = useMemo(() => assignedOrders.filter(o => o.status !== "Delivered" && o.status !== "Cancelled"), [assignedOrders]);
  const repairsWeight = activeRepairs.reduce((sum, r) => sum + (Number(r.itemWeight) || 0), 0);

  const totalPagesR = Math.ceil(assignedRepairs.length / 10) || 1;
  const currentPageR = Math.min(pageR, totalPagesR);
  const paginatedR = assignedRepairs.slice((currentPageR - 1) * 10, currentPageR * 10);

  const totalPagesO = Math.ceil(assignedOrders.length / 10) || 1;
  const currentPageO = Math.min(pageO, totalPagesO);
  const paginatedO = assignedOrders.slice((currentPageO - 1) * 10, currentPageO * 10);

  const updateRepairStatus = async (id: string, status: Repair["status"]) => {
    const repair = repairs.find(r => r._id === id || r.id === id);
    if (repair) {
      await updateRepairMutation.mutateAsync({ id, body: { ...repair, status } });
      toast.success(`Repair status updated to ${status}`);
    }
  };

  const updateOrderStatus = async (id: string, status: Order["status"]) => {
    const order = orders.find(o => o._id === id || o.id === id);
    if (order) {
      await updateOrderMutation.mutateAsync({ id, body: { ...order, status } });
      toast.success(`Order status updated to ${status}`);
    }
  };

  const isLoading = isLoadingK || isLoadingR || isLoadingO;

  const pageContent = (
    <>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl">Karigar Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track assigned repairs and custom orders.</p>
        </div>
        {isKarigar ? (
          <div className="bg-primary/10 text-primary px-4 py-2 rounded-md border border-primary/20 font-medium">
            Logged in as: {authUser.name}
          </div>
        ) : (
          <div className="w-full sm:w-72">
            <Select value={selectedKarigarId} onValueChange={setSelectedKarigarId}>
              <SelectTrigger className="h-12 bg-background border-primary shadow-sm">
                <SelectValue placeholder="Select Karigar Profile" />
              </SelectTrigger>
              <SelectContent>
                {karigars.map(k => (
                  <SelectItem key={k._id || k.id} value={k._id || k.id || ""}>
                    {k.name} ({k.specialty || k.category || "General"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      {isLoading ? (
        <p className="text-center py-12 text-muted-foreground">Loading tasks...</p>
      ) : !selectedKarigarId ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
          <Hammer className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg">Select a Karigar from the dropdown above to view their dashboard.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground flex items-center gap-1"><Wrench className="w-4 h-4"/> Active Repairs</div>
                <div className="text-2xl font-display mt-1 text-primary">{activeRepairs.length} <span className="text-sm text-muted-foreground font-normal">assigned</span></div>
                <div className="text-xs font-medium text-muted-foreground mt-2 bg-muted/40 inline-block px-2 py-1 rounded">
                  Total Quantity / Weight: {repairsWeight.toFixed(2)} g
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground flex items-center gap-1"><ShoppingBag className="w-4 h-4"/> Active Orders</div>
                <div className="text-2xl font-display mt-1 text-primary">{activeOrders.length} <span className="text-sm text-muted-foreground font-normal">assigned</span></div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* REPAIRS */}
            <Card>
              <CardHeader><CardTitle className="font-display flex items-center gap-2"><Wrench className="w-5 h-5"/> Repairs ({assignedRepairs.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b bg-muted/20"><tr><th className="py-2 px-4">Ticket</th><th>Item</th><th>Due</th><th className="px-4 text-right">Status</th><th className="px-4"></th></tr></thead>
              <tbody>{paginatedR.map(r => (<tr key={r._id || r.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 px-4"><div className="font-medium">{r.ticketNo}</div><div className="text-xs text-muted-foreground">{formatDate(r.date)}</div></td>
                    <td><div className="font-medium">{r.itemDescription}</div><div className="text-xs text-rose-500">{r.problem}</div></td>
                    <td>{r.deliveryDate ? formatDate(r.deliveryDate) : "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <select className={`border rounded px-2 py-1 text-xs cursor-pointer ${r.status === 'Ready' ? 'bg-green-50 text-green-700 border-green-200 font-medium' : r.status === 'Delivered' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-background'}`} value={r.status} onChange={e => updateRepairStatus(r._id || r.id || "", e.target.value as Repair["status"])} disabled={r.status === 'Delivered'}>
                        {['Received', 'In Progress', 'Ready', 'Delivered'].filter(s => s !== "Delivered" || r.status === "Delivered").map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setViewingRepair(r)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>))}
                  {assignedRepairs.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">No repairs assigned.</td></tr>}
                  </tbody></table>
            {totalPagesR > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-xs text-muted-foreground">Showing {(currentPageR - 1) * 10 + 1} to {Math.min(currentPageR * 10, assignedRepairs.length)} of {assignedRepairs.length} entries</div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setPageR(p => Math.max(1, p - 1))} disabled={currentPageR === 1}>Prev</Button>
                  <Button size="sm" variant="outline" onClick={() => setPageR(p => Math.min(totalPagesR, p + 1))} disabled={currentPageR === totalPagesR}>Next</Button>
                </div>
              </div>
            )}
              </CardContent>
            </Card>

            {/* ORDERS */}
            <Card>
              <CardHeader><CardTitle className="font-display flex items-center gap-2"><ShoppingBag className="w-5 h-5"/> Custom Orders ({assignedOrders.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b bg-muted/20"><tr><th className="py-2 px-4">Order</th><th>Item</th><th>Due</th><th className="px-4 text-right">Status</th><th className="px-4"></th></tr></thead>
              <tbody>{paginatedO.map(o => (<tr key={o._id || o.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 px-4"><div className="font-medium">{o.orderNo}</div><div className="text-xs text-muted-foreground">{formatDate(o.date)}</div></td>
                    <td><div className="font-medium">{o.itemDescription}</div><div className="text-xs text-muted-foreground">{o.metal} {o.purity}</div></td>
                    <td>{o.dueDate ? formatDate(o.dueDate) : "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <select className={`border rounded px-2 py-1 text-xs cursor-pointer ${o.status === 'Ready' ? 'bg-green-50 text-green-700 border-green-200 font-medium' : o.status === 'Delivered' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-background'}`} value={o.status} onChange={e => updateOrderStatus(o._id || o.id || "", e.target.value as Order["status"])} disabled={o.status === 'Delivered'}>
                        {["Pending","In Progress","Ready","Delivered","Cancelled"].filter(s => s !== "Delivered" || o.status === "Delivered").map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setViewingOrder(o)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>))}
                  {assignedOrders.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">No custom orders assigned.</td></tr>}
                  </tbody></table>
            {totalPagesO > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-xs text-muted-foreground">Showing {(currentPageO - 1) * 10 + 1} to {Math.min(currentPageO * 10, assignedOrders.length)} of {assignedOrders.length} entries</div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setPageO(p => Math.max(1, p - 1))} disabled={currentPageO === 1}>Prev</Button>
                  <Button size="sm" variant="outline" onClick={() => setPageO(p => Math.min(totalPagesO, p + 1))} disabled={currentPageO === totalPagesO}>Next</Button>
                </div>
              </div>
            )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={!!viewingRepair} onOpenChange={(v) => !v && setViewingRepair(null)}>
        <DialogContent className="max-w-md">
          {viewingRepair && (
            <>
              <DialogHeader>
                <DialogTitle>Repair Details - {viewingRepair.ticketNo}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground">Item Description</div>
                  <div className="font-medium text-lg">{viewingRepair.itemDescription}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Problem / Work to do</div>
                  <div className="font-medium text-rose-500">{viewingRepair.problem}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Item Weight</div>
                    <div className="font-medium">{viewingRepair.itemWeight} g</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Delivery Date</div>
                    <div className="font-medium">{viewingRepair.deliveryDate ? formatDate(viewingRepair.deliveryDate) : "—"}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Note</div>
                  <div className="font-medium">{viewingRepair.note || "—"}</div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingOrder} onOpenChange={(v) => !v && setViewingOrder(null)}>
        <DialogContent className="max-w-md">
          {viewingOrder && (
            <>
              <DialogHeader>
                <DialogTitle>Order Details - {viewingOrder.orderNo}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground">Item Description</div>
                  <div className="font-medium text-lg">{viewingOrder.itemDescription}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Metal & Purity</div>
                    <div className="font-medium">{viewingOrder.metal} - {viewingOrder.purity}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Due Date</div>
                    <div className="font-medium">{viewingOrder.dueDate ? formatDate(viewingOrder.dueDate) : "—"}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Note</div>
                  <div className="font-medium">{viewingOrder.note || "—"}</div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  if (isKarigar) {
    return (
      <div className="min-h-screen bg-muted/10 flex flex-col">
        <div className="bg-card border-b px-6 py-4 flex items-center justify-between shadow-sm mb-6">
          <div className="font-display font-bold text-xl text-primary flex items-center gap-2">
            <Hammer className="w-5 h-5" /> Coudiefy  Karigar
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            localStorage.removeItem("ajms.auth");
            window.location.href = "/";
          }}>
            Logout
          </Button>
        </div>
        <div className="px-4 sm:px-6 w-full max-w-7xl mx-auto pb-12 flex-1">
          {pageContent}
        </div>
      </div>
    );
  }

  return <Layout>{pageContent}</Layout>;
}