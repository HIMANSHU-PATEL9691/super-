import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/useApi";
import { customerAPI, expensesAPI, invoicesAPI, ordersAPI, repairsAPI, purchasesAPI } from "@/lib/api";
import { inr, type Customer, type Expense, type Invoice, type Order, type Repair, type Purchase, useLocalState } from "@/lib/storage";
import { BookOpen, ArrowDownLeft, ArrowUpRight, Users, Wrench, ShoppingBag, Receipt, Wallet, Package } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

export default function LedgerPage() {
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const targetDateStr = useMemo(() => new Date(selectedDate).toDateString(), [selectedDate]);

  // Fetch all related data
  const { data: allInvoices = [], isLoading: loadingInvoices } = useApi<Invoice[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: expenses = [], isLoading: loadingExpenses } = useApi<Expense[]>(["expenses"], () => expensesAPI.getAll());
  const { data: orders = [], isLoading: loadingOrders } = useApi<Order[]>(["orders"], () => ordersAPI.getAll());
  const { data: repairs = [], isLoading: loadingRepairs } = useApi<Repair[]>(["repairs"], () => repairsAPI.getAll());
  const { data: customers = [], isLoading: loadingCustomers } = useApi<Customer[]>(["customers"], () => customerAPI.getAll());
  const { data: purchases = [], isLoading: loadingPurchases } = useApi<Purchase[]>(["purchases"], () => purchasesAPI.getAll());

  const isOperator = authUser?.role === "operator";
  const invoices = useMemo(() => allInvoices.filter(i => isOperator ? i.type === "GST" : i.type !== "GST"), [allInvoices, isOperator]);

  const isLoading = loadingInvoices || loadingExpenses || loadingOrders || loadingRepairs || loadingCustomers || loadingPurchases;

  // Process and group all transactions for the selected day
  const entries = useMemo(() => {
    const arr: any[] = [];

    invoices.forEach(i => {
      if (new Date(i.createdAt).toDateString() === targetDateStr) {
        arr.push({ id: i.id || (i as any)._id, time: i.createdAt, type: 'Income', icon: Receipt, desc: `Sale: ${i.number} - ${i.customerName}`, in: i.total, out: 0, mode: i.paymentMode });
      }
    });

    expenses.forEach(e => {
      if (new Date(e.date).toDateString() === targetDateStr) {
        arr.push({ id: e.id || (e as any)._id, time: e.date, type: 'Expense', icon: Wallet, desc: `${e.category} - ${e.description}`, in: 0, out: e.amount, mode: e.paymentMode || 'Cash' });
      }
    });

    orders.forEach(o => {
      if (new Date(o.date).toDateString() === targetDateStr && (o.advancePaid || 0) > 0) {
        arr.push({ id: o.id || (o as any)._id, time: o.date, type: 'Order Advance', icon: ShoppingBag, desc: `Order: ${o.orderNo} - ${o.customerName}`, in: o.advancePaid, out: 0, mode: '—' });
      }
    });

    repairs.forEach(r => {
      if (new Date(r.date || "").toDateString() === targetDateStr && (r.advance || 0) > 0) {
        arr.push({ id: r.id || (r as any)._id, time: r.date, type: 'Repair Advance', icon: Wrench, desc: `Repair: ${r.ticketNo} - ${r.customerName}`, in: r.advance, out: 0, mode: '—' });
      }
    });

    purchases.forEach(p => {
      if (new Date(p.date).toDateString() === targetDateStr) {
        arr.push({ id: p.id || (p as any)._id, time: p.date, type: 'Purchase', icon: Package, desc: `Purchase: ${p.billNo} - ${p.supplierName}`, in: 0, out: p.paymentMode === 'Credit' ? 0 : (p.total || 0), mode: p.paymentMode });
      }
    });

    customers.forEach(c => {
      if (c.createdAt && new Date(c.createdAt).toDateString() === targetDateStr) {
        const phone = (c as any).phone || c.mobile || "";
        arr.push({ id: c._id || phone, time: c.createdAt, type: 'New Customer', icon: Users, desc: `${c.name} (${phone})`, in: 0, out: 0, mode: '—' });
      }
    });

    // Sort newest transactions first
    return arr.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [invoices, expenses, orders, repairs, customers, purchases, targetDateStr]);

  const totalIn = entries.reduce((s, e) => s + e.in, 0);
  const totalOut = entries.reduce((s, e) => s + e.out, 0);
  const netBalance = totalIn - totalOut;

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl">Daily Ledger</h1>
          <p className="text-muted-foreground mt-1">Consolidated view of all daily activities.</p>
        </div>
        <div className="space-y-1.5 w-full sm:w-auto">
          <Label className="text-xs">Select Date</Label>
          <DatePicker 
            value={selectedDate} 
            onChange={setSelectedDate} 
            className="w-full sm:w-48 bg-background"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1"><ArrowDownLeft className="w-4 h-4 text-green-500"/> Total In</div>
            <div className="text-2xl font-display mt-1 text-green-600">{inr(totalIn)}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1"><ArrowUpRight className="w-4 h-4 text-rose-500"/> Total Out</div>
            <div className="text-2xl font-display mt-1 text-rose-600">{inr(totalOut)}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1"><BookOpen className="w-4 h-4"/> Net Balance</div>
            <div className={`text-2xl font-display mt-1 ${netBalance >= 0 ? "text-green-600" : "text-rose-600"}`}>{inr(netBalance)}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1"><Users className="w-4 h-4"/> Transactions</div>
            <div className="text-2xl font-display mt-1">{entries.length} entries</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Daybook Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Loading ledger data...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No transactions recorded for this date.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b bg-muted/20">
                  <tr>
                    <th className="py-3 px-4 font-medium">Type</th>
                    <th className="py-3 font-medium">Description</th>
                    <th className="py-3 font-medium">Mode</th>
                    <th className="py-3 font-medium text-right text-green-600">In (+)</th>
                    <th className="py-3 px-4 font-medium text-right text-rose-600">Out (-)</th>
                  </tr>
                </thead>
                <tbody>
              {entries.map((e, idx) => {
                    const Icon = e.icon;
                    return (
                      <tr key={`${e.id}-${idx}`} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-3 px-4 flex items-center gap-2"><Icon className="w-4 h-4 text-muted-foreground"/> {e.type}</td>
                        <td className="py-3">{e.desc}</td>
                        <td className="py-3 text-muted-foreground">{e.mode}</td>
                        <td className="py-3 text-right font-medium text-green-600">{e.in > 0 ? inr(e.in) : '—'}</td>
                        <td className="py-3 px-4 text-right font-medium text-rose-600">{e.out > 0 ? inr(e.out) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/20 font-bold">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-right">Day Total:</td>
                    <td className="py-3 text-right text-green-600">{inr(totalIn)}</td>
                    <td className="py-3 px-4 text-right text-rose-600">{inr(totalOut)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}