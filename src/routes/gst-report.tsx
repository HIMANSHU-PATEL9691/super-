import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type Invoice, type Purchase } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";
import { invoicesAPI, purchasesAPI, customerAPI, supplierAPI } from "@/lib/api";
import { Download, FileText } from "lucide-react";

export default function GstReportPage() {
  const { data: invoices = [], isLoading } = useApi<Invoice[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: purchases = [], isLoading: isLoadingPurchases } = useApi<Purchase[]>(["purchases"], () => purchasesAPI.getAll());
  const { data: customers = [] } = useApi<any[]>(["customers"], () => customerAPI.getAll());
  const { data: suppliers = [] } = useApi<any[]>(["suppliers"], () => supplierAPI.getAll());

  const [transactionType, setTransactionType] = useState<"Sales" | "Purchases">("Sales");
  const [reportType, setReportType] = useState<"Daily" | "Monthly">("Daily");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [page, setPage] = useState(1);

  const gstInvoices = useMemo(() => {
    return invoices.filter((i) => i.type === "GST");
  }, [invoices]);

  const gstPurchases = useMemo(() => {
    return purchases.filter((p) => p.gstPct && p.gstPct > 0);
  }, [purchases]);

  const filteredInvoices = useMemo(() => {
    if (reportType === "Daily") {
      return gstInvoices.filter((i) => i.createdAt && i.createdAt.startsWith(selectedDate));
    } else {
      return gstInvoices.filter((i) => i.createdAt && i.createdAt.startsWith(selectedMonth));
    }
  }, [gstInvoices, reportType, selectedDate, selectedMonth]);

  const filteredPurchases = useMemo(() => {
    if (reportType === "Daily") {
      return gstPurchases.filter((p) => p.date && p.date.startsWith(selectedDate));
    } else {
      return gstPurchases.filter((p) => p.date && p.date.startsWith(selectedMonth));
    }
  }, [gstPurchases, reportType, selectedDate, selectedMonth]);

  const activeData = useMemo(() => {
    const data = transactionType === "Sales" ? filteredInvoices : filteredPurchases;
    return [...data].sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }, [transactionType, filteredInvoices, filteredPurchases]);

  const stats = useMemo(() => {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let tax = 0;
    let total = 0;

    if (transactionType === "Sales") {
      filteredInvoices.forEach((i) => {
        const invTaxable = i.subtotal - (i.discount || 0) - (i.oldGoldAmount || 0);
        taxable += invTaxable;
        tax += i.gstAmount;
        cgst += i.gstAmount / 2;
        sgst += i.gstAmount / 2;
        total += i.total;
      });
    } else {
      filteredPurchases.forEach((p) => {
        const pTaxable = p.total / (1 + p.gstPct / 100);
        const pTax = p.total - pTaxable;
        taxable += pTaxable;
        tax += pTax;
        cgst += pTax / 2;
        sgst += pTax / 2;
        total += p.total;
      });
    }

    return { taxable, cgst, sgst, tax, total, count: activeData.length };
  }, [filteredInvoices, filteredPurchases, transactionType, activeData.length]);

  const totalPages = Math.ceil(activeData.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = activeData.slice((currentPage - 1) * 10, currentPage * 10);

  const exportToExcel = () => {
    const periodLabel = reportType === "Daily" ? selectedDate : selectedMonth;
    const rows = [
      [`GST Report - ${transactionType}`, reportType, periodLabel],
      [],
      transactionType === "Sales"
        ? ["Invoice No", "Date", "Customer Name", "GSTIN", "Customer Mobile", "Taxable Value (Rs)", "CGST (Rs)", "SGST (Rs)", "Total Tax (Rs)", "Total Amount (Rs)"]
        : ["Bill No", "Date", "Supplier Name", "GSTIN", "Metal", "Taxable Value (Rs)", "CGST (Rs)", "SGST (Rs)", "Total Tax (Rs)", "Total Amount (Rs)"]
    ];

    if (transactionType === "Sales") {
      filteredInvoices.forEach((i) => {
        const c = customers.find(x => x._id === i.customerId || x.id === i.customerId || x.mobile === i.customerMobile);
        const invTaxable = i.subtotal - (i.discount || 0) - (i.oldGoldAmount || 0);
        const invCgst = i.gstAmount / 2;
        const invSgst = i.gstAmount / 2;
        rows.push([
          i.number,
          formatDate(i.createdAt),
          i.customerName,
          c?.gstNumber || "—",
          i.customerMobile,
          invTaxable.toFixed(2),
          invCgst.toFixed(2),
          invSgst.toFixed(2),
          i.gstAmount.toFixed(2),
          i.total.toFixed(2)
        ]);
      });
    } else {
      filteredPurchases.forEach((p) => {
        const s = suppliers.find(x => x._id === p.supplierId || x.id === p.supplierId || x.name === p.supplierName);
        const pTaxable = p.total / (1 + p.gstPct / 100);
        const pTax = p.total - pTaxable;
        rows.push([
          p.billNo,
          formatDate(p.date),
          p.supplierName,
          s?.gstNumber || "—",
          p.metal,
          pTaxable.toFixed(2),
          (pTax / 2).toFixed(2),
          (pTax / 2).toFixed(2),
          pTax.toFixed(2),
          p.total.toFixed(2)
        ]);
      });
    }

    rows.push([]);
    rows.push(["TOTAL", "", "", "", stats.taxable.toFixed(2), stats.cgst.toFixed(2), stats.sgst.toFixed(2), stats.tax.toFixed(2), stats.total.toFixed(2)]);

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gst_report_${transactionType.toLowerCase()}_${reportType.toLowerCase()}_${periodLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl">GST Report</h1>
          <p className="text-muted-foreground mt-1">Daily and monthly summary of GST invoices.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-end w-full sm:w-auto gap-4">
          <div className="space-y-1.5 w-full sm:w-auto">
            <Label className="text-xs">Transaction</Label>
            <Select value={transactionType} onValueChange={(v) => { setTransactionType(v as "Sales" | "Purchases"); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-32 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Sales">Sales</SelectItem>
                <SelectItem value="Purchases">Purchases</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 w-full sm:w-auto">
            <Label className="text-xs">Report Type</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as "Daily" | "Monthly")}>
              <SelectTrigger className="w-full sm:w-32 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Daily">Daily</SelectItem>
                <SelectItem value="Monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 w-full sm:w-auto">
            <Label className="text-xs">Select Period</Label>
            {reportType === "Daily" ? (
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full sm:w-48 bg-background h-9" />
            ) : (
              <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full sm:w-48 bg-background h-9" />
            )}
          </div>
          <Button onClick={exportToExcel} disabled={activeData.length === 0} variant="outline" className="h-9 w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" /> Export to Excel
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Total {transactionType}</div><div className="text-2xl font-display mt-1">{stats.count}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Taxable Value</div><div className="text-2xl font-display mt-1 text-blue-600">{inr(stats.taxable)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Total Tax (CGST + SGST)</div><div className="text-2xl font-display mt-1 text-amber-600">{inr(stats.tax)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground flex items-center gap-1">Total Amount</div><div className="text-2xl font-display mt-1 text-green-600">{inr(stats.total)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><FileText className="w-5 h-5"/> {reportType} GST {transactionType}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading || isLoadingPurchases ? (
            <p className="text-center text-muted-foreground py-12">Loading data...</p>
          ) : activeData.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No GST {transactionType.toLowerCase()} found for the selected period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b bg-muted/20">
                  {transactionType === "Sales" ? (
                    <tr><th className="py-3 px-4">Invoice No</th><th>Date</th><th>Customer</th><th>GSTIN</th><th className="text-right">Taxable Val</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right px-4">Total Amount</th></tr>
                  ) : (
                    <tr><th className="py-3 px-4">Bill No</th><th>Date</th><th>Supplier</th><th>GSTIN</th><th className="text-right">Taxable Val</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right px-4">Total Amount</th></tr>
                  )}
                </thead>
                <tbody>
              {paginated.map((item: any) => {
                    if (transactionType === "Sales") {
                      const i = item as Invoice;
                      const c = customers.find(x => x._id === i.customerId || x.id === i.customerId || x.mobile === i.customerMobile);
                      const invTaxable = i.subtotal - (i.discount || 0) - (i.oldGoldAmount || 0);
                      return (<tr key={i.id || i._id} className="border-b last:border-0 hover:bg-muted/40"><td className="py-3 px-4 font-medium">{i.number}</td><td>{formatDate(i.createdAt)}</td><td><div className="font-medium">{i.customerName}</div></td><td className="text-muted-foreground">{c?.gstNumber || "—"}</td><td className="text-right">{inr(invTaxable)}</td><td className="text-right text-muted-foreground">{inr(i.gstAmount / 2)}</td><td className="text-right text-muted-foreground">{inr(i.gstAmount / 2)}</td><td className="text-right px-4 font-medium text-green-700">{inr(i.total)}</td></tr>);
                    } else {
                      const p = item as Purchase;
                      const s = suppliers.find(x => x._id === p.supplierId || x.id === p.supplierId || x.name === p.supplierName);
                      const pTaxable = p.total / (1 + (p.gstPct || 0) / 100);
                      const pTax = p.total - pTaxable;
                      return (<tr key={p.id || p._id} className="border-b last:border-0 hover:bg-muted/40"><td className="py-3 px-4 font-medium">{p.billNo}</td><td>{formatDate(p.date)}</td><td><div className="font-medium">{p.supplierName}</div></td><td className="text-muted-foreground">{s?.gstNumber || "—"}</td><td className="text-right">{inr(pTaxable)}</td><td className="text-right text-muted-foreground">{inr(pTax / 2)}</td><td className="text-right text-muted-foreground">{inr(pTax / 2)}</td><td className="text-right px-4 font-medium text-amber-700">{inr(p.total)}</td></tr>);
                    }
                  })}
                </tbody>
              </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, activeData.length)} of {activeData.length} entries</div>
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