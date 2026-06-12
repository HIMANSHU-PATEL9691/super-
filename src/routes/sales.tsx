import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr, type Invoice, useLocalState } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { Receipt, Trash2, TrendingUp } from "lucide-react";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { invoicesAPI, inventoryAPI } from "@/lib/api";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

export default function SalesPage() {
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const { data: allInvoices = [] } = useApi<Invoice[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: products = [] } = useApi<any[]>(["inventory"], () => inventoryAPI.getAll());
  const deleteMutation = useApiMutation((id: string) => invoicesAPI.delete(id), ["invoices"]);
  const updateProductMutation = useApiMutation((data: { id: string; body: any }) => inventoryAPI.update(data.id, data.body), ["inventory"]);

  const isOperator = authUser?.role === "operator";
  const invoices = useMemo(() => allInvoices.filter(i => isOperator ? i.type === "GST" : i.type !== "GST"), [allInvoices, isOperator]);

  const [q, setQ] = useState("");
  const [pages, setPages] = useState<Record<number, number>>({});

  const filtered = invoices.filter(i =>
    (i.number + i.customerName + i.customerMobile).toLowerCase().includes(q.toLowerCase())
  );
  const total = filtered.reduce((s, i) => s + i.total, 0);

  const last30Days = useMemo(() => {
    const arr = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toDateString();
      const dayTotal = filtered.filter(inv => new Date(inv.createdAt).toDateString() === dStr).reduce((s, x) => s + x.total, 0);
      arr.push({ date: `${d.getDate()}/${d.getMonth()+1}`, Sales: dayTotal });
    }
    return arr;
  }, [filtered]);

  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 100000) return `₹${(tickItem / 100000).toFixed(1)}L`;
    if (tickItem >= 1000) return `₹${(tickItem / 1000).toFixed(1)}k`;
    return `₹${tickItem}`;
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
            await updateProductMutation.mutateAsync({ id: p._id || p.id, body: { ...p, stock: newStock } });
          }
        }
        await deleteMutation.mutateAsync(invoice._id || invoice.id || "");
        toast.success("Invoice deleted and stock restored.");
      } catch (e) { toast.error("Failed to delete invoice."); }
    }
  };

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div><h1 className="text-4xl">Sales</h1><p className="text-muted-foreground mt-1">All invoices issued.</p></div>
        <Link to="/billing"><Button size="lg">New Invoice</Button></Link>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Total Invoices" value={invoices.length} />
        <Stat label="Filtered Total" value={inr(total)} />
        <Stat label="Avg Invoice" value={inr(filtered.length ? total / filtered.length : 0)} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Sales Trend (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last30Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={formatYAxis} />
              <RechartsTooltip formatter={(value: number) => [inr(value), "Sales"]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Line type="monotone" dataKey="Sales" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="flex justify-end mb-4">
        <Input placeholder="Search invoice / customer" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs bg-background" />
      </div>

      {[
        { title: isOperator ? "GST Invoice History" : "NON-GST Invoice History", data: filtered }
      ].map((table, index) => {
        // Sort before paginating
        const sortedData = [...table.data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const totalPages = Math.ceil(sortedData.length / 10) || 1;
        const currentPage = Math.min(pages[index] || 1, totalPages);
        const paginated = sortedData.slice((currentPage - 1) * 10, currentPage * 10);

        return (
        <Card key={table.title} className="shadow-sm border-border overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/20 border-b border-border pb-3 pt-4">
            <CardTitle className="text-base font-semibold font-display flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" /> {table.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {table.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Receipt className="w-10 h-10 mb-3 opacity-20" />
                <p>No invoices match your search.</p>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Invoice</th>
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">Customer</th>
                    <th className="py-3 px-4 font-semibold">Mode</th>
                    <th className="py-3 px-4 font-semibold">Items</th>
                    <th className="py-3 px-4 font-semibold text-right">Total</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(i => (
                    <tr key={i._id || i.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">{i.number}</td>
                      <td className="py-3 px-4">{formatDate(i.createdAt)}</td>
                      <td className="py-3 px-4">{i.customerName}<div className="text-xs text-muted-foreground">{i.customerMobile}</div></td>
                      <td className="py-3 px-4">{i.paymentMode}</td><td className="py-3 px-4">{i.items.length}</td>
                      <td className="py-3 px-4 text-right font-medium">{inr(i.total)}</td>
                      <td className="py-3 px-4 text-center">
                        {(i.balanceDue || 0) <= 0 ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">Paid</span> : <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">Due</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeInvoice(i)} title="Delete Invoice"><Trash2 className="w-4 h-4 text-red-500 hover:text-red-600" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, table.data.length)} of {table.data.length} entries</div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setPages(p => ({ ...p, [index]: Math.max(1, currentPage - 1) }))} disabled={currentPage === 1}>Prev</Button>
                    <Button size="sm" variant="outline" onClick={() => setPages(p => ({ ...p, [index]: Math.min(totalPages, currentPage + 1) }))} disabled={currentPage === totalPages}>Next</Button>
                  </div>
                </div>
              )}
            </div>)}
          </CardContent>
        </Card>
      )})}
    </Layout>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-display mt-1">{value}</div></CardContent></Card>;
}
