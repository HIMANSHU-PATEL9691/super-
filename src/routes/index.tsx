import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  inr,
  useLocalState,
} from "@/lib/storage";
import {
  Package,
  Receipt,
  TrendingUp,
  Star,
  UserCheck,
  CalendarRange,
  Wallet,
  Wrench,
  ShoppingBag,
  CheckCircle,
  Clock,
  BellRing,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { useEffect, useState, useMemo } from "react";
import { useApi } from "@/hooks/useApi";
import {
  inventoryAPI,
  customerAPI,
  invoicesAPI,
  expensesAPI,
  repairsAPI,
  purchasesAPI,
  goldRatesAPI,
  ordersAPI,
} from "@/lib/api";

const LOYAL_THRESHOLD = 3;
const defaultRates: any = { updatedAt: new Date().toISOString(), gold24: 7850, gold22: 7200, gold18: 5890, silver: 98 };

export default function Dashboard() {
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const { data: products = [] } = useApi<any[]>(["inventory"], () => inventoryAPI.getAll());
  const { data: customers = [] } = useApi<any[]>(["customers"], () => customerAPI.getAll());
  const { data: allInvoices = [] } = useApi<any[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: expenses = [] } = useApi<any[]>(["expenses"], () => expensesAPI.getAll());
  const { data: repairs = [] } = useApi<any[]>(["repairs"], () => repairsAPI.getAll());
  const { data: purchases = [] } = useApi<any[]>(["purchases"], () => purchasesAPI.getAll());
  const { data: ratesList = [] } = useApi<any[]>(["goldRates"], () => goldRatesAPI.getAll());
  const { data: orders = [] } = useApi<any[]>(["orders"], () => ordersAPI.getAll());

  const isOperator = authUser?.role === "operator";
  const invoices = useMemo(() => allInvoices.filter(i => isOperator ? i.type === "GST" : i.type !== "GST"), [allInvoices, isOperator]);

  const rates = ratesList[0] || defaultRates;

  const displayRates = {
    gold24: rates.gold24 ?? defaultRates.gold24,
    gold22: rates.gold22 ?? defaultRates.gold22,
    gold18: rates.gold18 ?? defaultRates.gold18,
    silver: rates.silver ?? defaultRates.silver,
    updatedAt: rates.updatedAt ?? defaultRates.updatedAt,
  };

  const now = new Date();
  const today = now.toDateString();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const inMonth = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}` === monthKey; };

  const todayInvoices = invoices.filter((i) => new Date(i.createdAt).toDateString() === today);
  const monthInvoices = invoices.filter((i) => inMonth(i.createdAt));
  const todaySales = todayInvoices.reduce((s, i) => s + i.total, 0);
  const totalSell = invoices.reduce((s, i) => s + i.total, 0);
  const monthRevenue = monthInvoices.reduce((s, i) => s + i.total, 0);
  const todayExpense = expenses.filter((e) => new Date(e.date).toDateString() === today).reduce((s, e) => s + e.amount, 0);
  const monthExpense = expenses.filter((e) => inMonth(e.date)).reduce((s, e) => s + e.amount, 0);
  const purchaseAmount = purchases.reduce((s, p) => s + p.total, 0);
  const todayCustomers = new Set(todayInvoices.map((i) => i.customerId || i.customerMobile || i.customerName)).size;

  const counts = new Map<string, number>();
  invoices.forEach((i) => { if (i.customerId) counts.set(i.customerId, (counts.get(i.customerId) || 0) + 1); });
  const loyal = customers.filter((c) => (counts.get(c._id || c.id) || 0) >= LOYAL_THRESHOLD).length;
  const normal = customers.length - loyal;

  const stockValue = products.reduce((s, p) => s + p.netWeight * p.ratePerGram * p.stock, 0);
  const goldGrams = products.filter(p => p.category === "Gold").reduce((s, p) => s + p.netWeight * p.stock, 0);
  const silverGrams = products.filter(p => p.category === "Silver").reduce((s, p) => s + p.netWeight * p.stock, 0);

  // 7-day trend
  const days: { label: string; Sales: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const lbl = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    const total = invoices.filter(inv => new Date(inv.createdAt).toDateString() === d.toDateString()).reduce((s, x) => s + x.total, 0);
    days.push({ label: lbl, Sales: total });
  }

  // 6-month trend
  const sixMonthsData = useMemo(() => {
    const arr = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mKey = `${d.getFullYear()}-${d.getMonth()}`;
      const rev = invoices.filter(inv => { const id = new Date(inv.createdAt); return `${id.getFullYear()}-${id.getMonth()}` === mKey; }).reduce((s, x) => s + x.total, 0);
      const exp = expenses.filter(e => { const ed = new Date(e.date); return `${ed.getFullYear()}-${ed.getMonth()}` === mKey; }).reduce((s, x) => s + x.amount, 0);
      arr.push({ name: d.toLocaleString('default', { month: 'short' }), Revenue: rev, Expense: exp });
    }
    return arr;
  }, [invoices, expenses]);

  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 100000) return `₹${(tickItem / 100000).toFixed(1)}L`;
    if (tickItem >= 1000) return `₹${(tickItem / 1000).toFixed(1)}k`;
    return `₹${tickItem}`;
  };

  const lowStock = products.filter(p => p.stock <= 2).length;
  const pendingRepairs = repairs.filter(r => r.status !== "Delivered").length;
  const pendingOrders = orders.filter(o => o.status !== "Delivered" && o.status !== "Cancelled").length;
  
  const todayIso = new Date().toISOString().slice(0, 10);
  const readyOrders = orders.filter(o => o.status === "Ready").length;
  const readyRepairs = repairs.filter(r => r.status === "Ready").length;
  const dueOrders = orders.filter(o => o.dueDate && o.dueDate <= todayIso && !["Delivered", "Cancelled"].includes(o.status)).length;
  const dueRepairs = repairs.filter(r => r.deliveryDate && r.deliveryDate <= todayIso && r.status !== "Delivered").length;
  const unpaidInvoices = invoices.filter(i => (i.balanceDue || 0) > 0).length;

  const stats = [
    { label: "Total Sell", value: inr(totalSell), icon: TrendingUp, sub: `${invoices.length} invoices`, to: "/sales" },
    { label: "Total Money Today", value: inr(todaySales), icon: Wallet, sub: `${todayInvoices.length} invoices`, to: "/sales" },
    { label: "Purchase Amount", value: inr(purchaseAmount), icon: Package, sub: `${purchases.length} purchases`, to: "/purchases" },
    { label: "Today's Customers", value: todayCustomers, icon: UserCheck, sub: `${todayInvoices.length} invoices`, to: "/customers" },
    { label: "Today's Sales", value: inr(todaySales), icon: TrendingUp, sub: `${todayInvoices.length} invoices`, to: "/sales" },
    { label: "24K Gold Rate", value: inr(displayRates.gold24), icon: TrendingUp, sub: "/g", to: "/gold-rates" },
    { label: "22K Gold Rate", value: inr(displayRates.gold22), icon: TrendingUp, sub: "/g", to: "/gold-rates" },
    { label: "Silver Rate", value: inr(displayRates.silver), icon: TrendingUp, sub: "/g", to: "/gold-rates" },
    { label: "Total Gold (g)", value: `${goldGrams.toFixed(2)}g`, icon: Package, sub: `${goldGrams.toFixed(2)} g`, to: "/inventory" },
    { label: "Total Silver (g)", value: `${silverGrams.toFixed(2)}g`, icon: Package, sub: `${silverGrams.toFixed(2)} g`, to: "/inventory" },
    { label: "Today's Income (net)", value: inr(todaySales - todayExpense), icon: Wallet, sub: `Expense ${inr(todayExpense)}`, to: "/reports" },
    { label: "Monthly Revenue", value: inr(monthRevenue), icon: CalendarRange, sub: `${monthInvoices.length} invoices`, to: "/sales" },
    { label: "Monthly Net", value: inr(monthRevenue - monthExpense), icon: TrendingUp, sub: `Expense ${inr(monthExpense)}`, to: "/reports" },
    { label: "Loyal Customers", value: loyal, icon: Star, sub: `${LOYAL_THRESHOLD}+ purchases`, to: "/customers" },
    { label: "Normal Customers", value: normal, icon: UserCheck, sub: "<3 purchases", to: "/customers" },
    { label: "Stock Value", value: inr(stockValue), icon: Package, sub: `${goldGrams.toFixed(1)}g gold`, to: "/inventory" },
    { label: "Total Invoices", value: invoices.length, icon: Receipt, sub: `${customers.length} customers`, to: "/sales" },
    { label: "Inventory Items", value: products.length, icon: Package, sub: `${goldGrams.toFixed(2)}g stock`, to: "/inventory" },
    { label: "Pending Repairs", value: pendingRepairs, icon: Wrench, sub: `${pendingRepairs} open`, to: "/repairs" },
    { label: "Active Orders", value: pendingOrders, icon: ShoppingBag, sub: `${orders.length} total orders`, to: "/orders" },
  ];

  const recent = [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const [dateString, setDateString] = useState("");
  useEffect(() => {
    const d = new Date();
    setDateString(`${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`);
  }, []);

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl">{authUser?.shopName || "Dashboard"}</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your business overview for {dateString}</p>
        </div>
        <Link to="/billing" className="w-full sm:w-auto"><Button size="lg" className="w-full sm:w-auto">New Invoice</Button></Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => {
          const card = (
            <Card key={s.label} className="border-border hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">{s.label}</div>
                    <div className="text-2xl font-display mt-1">{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
                  </div>
                  <div className="w-10 h-10 rounded-md bg-accent text-accent-foreground grid place-items-center">
                    <s.icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );

          return s.to ? (
            <Link key={s.label} to={s.to} className="block">
              {card}
            </Link>
          ) : card;
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader><CardTitle className="font-display">Sales Trend (7 Days)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={formatYAxis} />
                <RechartsTooltip formatter={(value: number) => [inr(value), "Sales"]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="Sales" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display">Revenue vs Expenses (6 Months)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sixMonthsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={formatYAxis} />
                <RechartsTooltip formatter={(value: number) => [inr(value), undefined]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ fill: 'transparent' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="bg-sidebar text-sidebar-foreground lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-display">Today's Metal Rates</CardTitle>
            <div className="text-xs text-muted-foreground text-right">
              <span suppressHydrationWarning>Updated: {formatDate(displayRates.updatedAt) || dateString || "—"}</span>
              <Link to="/gold-rates" className="ml-2 underline text-primary">Edit</Link>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <RateBox label="24K Gold" value={displayRates.gold24} />
            <RateBox label="22K Gold" value={displayRates.gold22} />
            <RateBox label="18K Gold" value={displayRates.gold18} />
            <RateBox label="Silver" value={displayRates.silver} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Recent Sales</CardTitle></CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No invoices yet. Create your first one from Billing.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b"><tr><th className="py-2">Invoice</th><th>Customer</th><th>Type</th><th>Mode</th><th className="text-right">Total</th></tr></thead>
                <tbody>{recent.map((i) => (<tr key={i._id || i.id} className="border-b last:border-0"><td className="py-2 font-medium">{i.number}</td><td>{i.customerName || "—"}</td><td>{i.type}</td><td>{i.paymentMode}</td><td className="text-right">{inr(i.total)}</td></tr>))}</tbody>
              </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-display flex items-center gap-2">
              <BellRing className="w-5 h-5 text-amber-600"/>Reminders & Alerts
            </CardTitle>
            <Link to="/notifications"><Button variant="ghost" size="sm" className="h-8 text-xs border border-border/50">View All</Button></Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Dynamic Reminder Notifications */}
            {readyOrders > 0 && <AlertRow icon={CheckCircle} label="Orders Ready for Delivery" value={readyOrders} to="/orders" className="text-green-700 bg-green-50 border-green-200 font-medium" />}
            {readyRepairs > 0 && <AlertRow icon={CheckCircle} label="Repairs Ready for Delivery" value={readyRepairs} to="/repairs" className="text-green-700 bg-green-50 border-green-200 font-medium" />}
            {dueOrders > 0 && <AlertRow icon={Clock} label="Due Today / Overdue Orders" value={dueOrders} to="/orders" className="text-rose-700 bg-rose-50 border-rose-200 font-medium" />}
            {dueRepairs > 0 && <AlertRow icon={Clock} label="Due Today / Overdue Repairs" value={dueRepairs} to="/repairs" className="text-rose-700 bg-rose-50 border-rose-200 font-medium" />}
            {unpaidInvoices > 0 && <AlertRow icon={Wallet} label="Unpaid Customer Dues" value={unpaidInvoices} to="/dues" className="text-amber-700 bg-amber-50 border-amber-200 font-medium" />}
            
            <AlertRow icon={Package} label="Low Stock Items" value={lowStock} to="/inventory" />
            <AlertRow icon={ShoppingBag} label="Active Orders" value={pendingOrders} to="/orders" />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function RateBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background/10 rounded-md p-3 border border-sidebar-border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-display">{inr(value)}<span className="text-xs text-muted-foreground">/g</span></div>
    </div>
  );
}

function AlertRow({ icon: Icon, label, value, to, className }: { icon: typeof Package; label: string; value: number; to: string; className?: string }) {
  return (
    <Link to={to} className={`flex items-center justify-between rounded-md border p-3 transition-colors ${className || 'hover:bg-accent border-border'}`}>
      <div className="flex items-center gap-2"><Icon className={`w-4 h-4 ${className ? 'opacity-80' : 'text-muted-foreground'}`}/><span className="text-sm">{label}</span></div>
      <span className="font-display text-lg">{value}</span>
    </Link>
  );
}
