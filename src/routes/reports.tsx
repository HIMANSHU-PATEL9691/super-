import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inr, useLocalState } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { TrendingUp, Wallet, AlertTriangle, Download, PieChart as PieChartIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApi } from "@/hooks/useApi";
import { invoicesAPI, expensesAPI, supplierAPI } from "@/lib/api";

export default function ReportsPage() {
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const { data: allInvoices = [] } = useApi<any[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: expenses = [] } = useApi<any[]>(["expenses"], () => expensesAPI.getAll());
  const { data: suppliers = [] } = useApi<any[]>(["suppliers"], () => supplierAPI.getAll());

  const isOperator = authUser?.role === "operator";
  const invoices = useMemo(() => allInvoices.filter(i => isOperator ? i.type === "GST" : i.type !== "GST"), [allInvoices, isOperator]);

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const targetDateStr = useMemo(() => new Date(selectedDate).toDateString(), [selectedDate]);

  const dailyInvoices = useMemo(() => invoices.filter((i) => new Date(i.createdAt).toDateString() === targetDateStr), [invoices, targetDateStr]);
  const dailyExpenses = useMemo(() => expenses.filter((e) => new Date(e.date).toDateString() === targetDateStr), [expenses, targetDateStr]);

  const monthKey = useMemo(() => {
    const d = new Date(selectedDate);
    return `${d.getFullYear()}-${d.getMonth()}`;
  }, [selectedDate]);

  const monthlyInvoices = useMemo(() => invoices.filter((i) => {
    const d = new Date(i.createdAt);
    return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
  }), [invoices, monthKey]);

  const monthlyExpenses = useMemo(() => expenses.filter((e) => {
    const d = new Date(e.date);
    return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
  }), [expenses, monthKey]);

  const suppliersWithDue = useMemo(() => suppliers.filter((s) => (s.balanceGold || 0) > 0 || (s.balanceSilver || 0) > 0), [suppliers]);

  const stats = useMemo(() => {
    const dailyIncome = dailyInvoices.reduce((s, i) => s + i.total, 0);
    const dailyExpenseTotal = dailyExpenses.reduce((s, e) => s + e.amount, 0);
    const monthlyIncome = monthlyInvoices.reduce((s, i) => s + i.total, 0);
    const monthlyExpenseTotal = monthlyExpenses.reduce((s, e) => s + e.amount, 0);
    
    return {
      dailyIncome,
      dailyExpenseTotal,
      monthlyIncome,
      monthlyExpenseTotal,
      net: dailyIncome - dailyExpenseTotal,
      monthlyNet: monthlyIncome - monthlyExpenseTotal,
      invoicesCount: dailyInvoices.length,
      expensesCount: dailyExpenses.length,
      monthlyInvoicesCount: monthlyInvoices.length,
      monthlyExpensesCount: monthlyExpenses.length
    };
  }, [dailyInvoices, dailyExpenses, suppliers, monthlyInvoices, monthlyExpenses]);

  const trendData = useMemo(() => {
    const arr = [];
    const end = new Date(selectedDate);
    for(let i = 14; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const dStr = d.toDateString();
      const inc = invoices.filter(inv => new Date(inv.createdAt).toDateString() === dStr).reduce((s, x) => s + x.total, 0);
      const exp = expenses.filter(e => new Date(e.date).toDateString() === dStr).reduce((s, x) => s + x.amount, 0);
      arr.push({ date: `${d.getDate()}/${d.getMonth()+1}`, Income: inc, Expense: exp });
    }
    return arr;
  }, [selectedDate, invoices, expenses]);

  const pieData = useMemo(() => {
    const monthStart = new Date(selectedDate);
    monthStart.setDate(1);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    
    const monthExps = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= monthStart && d < monthEnd;
    });
    
    const map = new Map<string, number>();
    monthExps.forEach(e => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [selectedDate, expenses]);
  
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#ec4899', '#64748b'];

  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 100000) return `₹${(tickItem / 100000).toFixed(1)}L`;
    if (tickItem >= 1000) return `₹${(tickItem / 1000).toFixed(1)}k`;
    return `₹${tickItem}`;
  };

  const exportToExcel = () => {
    const rows = [
      ["Report Date", formatDate(selectedDate)],
      ["Daily Income", stats.dailyIncome],
      ["Daily Expenses", stats.dailyExpenseTotal],
      ["Net Revenue", stats.net],
      [],
      ["Type", "Date/ID", "Description", "Amount"]
    ];

    dailyInvoices.forEach(i => rows.push(["Income", i.number, i.customerName || "Walk-in", i.total]));
    dailyExpenses.forEach(e => rows.push(["Expense", formatDate(e.date), `${e.category} - ${e.description}`, e.amount]));
    suppliers.forEach(s => {
      const goldDue = s.balanceGold || 0;
      const silverDue = s.balanceSilver || 0;
      if (goldDue > 0 || silverDue > 0) rows.push(["Supplier Due", "", s.name, `${goldDue > 0 ? goldDue+'g Gold' : ''} ${silverDue > 0 ? silverDue+'g Silver' : ''}`.trim()]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daily_report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl">Reports</h1>
          <p className="text-muted-foreground mt-1">View your daily income, expenses, and due.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-end w-full sm:w-auto gap-4">
          <div className="space-y-1.5 w-full sm:w-auto">
            <Label className="text-xs">Select Date</Label>
            <Input 
              type="date"
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              className="w-full sm:w-48 bg-background"
            />
          </div>
          <Button onClick={exportToExcel} variant="outline" className="h-10 w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <Card className="border-border hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Daily Income</div>
                <div className="text-2xl font-display mt-1 text-green-600">{inr(stats.dailyIncome)}</div>
                <div className="text-xs text-muted-foreground mt-1">{stats.invoicesCount} invoices</div>
              </div>
              <div className="w-10 h-10 rounded-md bg-green-100 text-green-700 grid place-items-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Daily Expenses</div>
                <div className="text-2xl font-display mt-1 text-rose-600">{inr(stats.dailyExpenseTotal)}</div>
                <div className="text-xs text-muted-foreground mt-1">{stats.expensesCount} expenses</div>
              </div>
              <div className="w-10 h-10 rounded-md bg-rose-100 text-rose-700 grid place-items-center">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Suppliers with Dues</div>
                <div className="text-2xl font-display mt-1 text-amber-600">{suppliersWithDue.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Pending Returns</div>
              </div>
              <div className="w-10 h-10 rounded-md bg-amber-100 text-amber-700 grid place-items-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <Card className="border-border hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Monthly Income</div>
                <div className="text-2xl font-display mt-1 text-green-600">{inr(stats.monthlyIncome)}</div>
                <div className="text-xs text-muted-foreground mt-1">{stats.monthlyInvoicesCount} invoices</div>
              </div>
              <div className="w-10 h-10 rounded-md bg-green-100 text-green-700 grid place-items-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Monthly Expenses</div>
                <div className="text-2xl font-display mt-1 text-rose-600">{inr(stats.monthlyExpenseTotal)}</div>
                <div className="text-xs text-muted-foreground mt-1">{stats.monthlyExpensesCount} expenses</div>
              </div>
              <div className="w-10 h-10 rounded-md bg-rose-100 text-rose-700 grid place-items-center">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Monthly Net Revenue</div>
                <div className={`text-2xl font-display mt-1 ${stats.monthlyNet >= 0 ? "text-green-600" : "text-rose-600"}`}>{inr(stats.monthlyNet)}</div>
                <div className="text-xs text-muted-foreground mt-1">This month</div>
              </div>
              <div className={`w-10 h-10 rounded-md grid place-items-center ${stats.monthlyNet >= 0 ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-700"}`}>
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="mb-6 bg-sidebar text-sidebar-foreground border-sidebar-border">
        <CardHeader>
           <CardTitle className="font-display">Summary for {formatDate(selectedDate)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
             <p>On <strong>{formatDate(selectedDate)}</strong>, you have a daily net revenue of <strong className={stats.net >= 0 ? "text-green-500" : "text-rose-500"}>{inr(stats.net)}</strong> after deducting daily expenses from daily sales.</p>
             <p>For the month of <strong>{new Date(selectedDate).toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>, your monthly net revenue is <strong className={stats.monthlyNet >= 0 ? "text-green-500" : "text-rose-500"}>{inr(stats.monthlyNet)}</strong>.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="font-display flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Income vs Expenses (15 Days Trend)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={formatYAxis} />
                <RechartsTooltip formatter={(value: number) => [inr(value), undefined]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorInc)" />
                <Area type="monotone" dataKey="Expense" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display flex items-center gap-2"><PieChartIcon className="w-5 h-5"/> Expenses by Category (Month)</CardTitle></CardHeader>
          <CardContent className="h-64">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No expenses this month.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                    {pieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => [inr(value), "Amount"]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Daily Income</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No income for this date.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr>
                      <th className="py-2">Invoice</th>
                      <th>Customer</th>
                      <th>Mode</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyInvoices.map((i) => (
                      <tr key={i._id || i.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2 font-medium">{i.number}</td>
                        <td>{i.customerName || "Walk-in"}</td>
                        <td>{i.paymentMode}</td>
                        <td className="text-right text-green-600">{inr(i.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><Wallet className="w-5 h-5"/> Daily Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No expenses for this date.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr>
                      <th className="py-2">Category</th>
                      <th>Description</th>
                      <th>Mode</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyExpenses.map((e) => (
                      <tr key={(e as any)._id || e.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2">{e.category}</td>
                        <td>{e.description}</td>
                        <td>{e.paymentMode}</td>
                        <td className="text-right text-rose-600">{inr(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600"/> Suppliers with Dues</CardTitle>
        </CardHeader>
        <CardContent>
          {suppliersWithDue.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No outstanding supplier dues.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2">Supplier Name</th>
                    <th>Mobile</th>
                    <th>Category</th>
                    <th className="text-right">Gold Due</th>
                    <th className="text-right">Silver Due</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliersWithDue.map((s) => (
                    <tr key={(s as any)._id || (s as any).id || s.name} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 font-medium">{s.name}</td>
                      <td>{s.mobile}</td>
                      <td>{s.category}</td>
                      <td className="text-right text-amber-600 font-medium">{(s.balanceGold || 0).toFixed(3)}g</td>
                      <td className="text-right text-slate-500 font-medium">{(s.balanceSilver || 0).toFixed(3)}g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}