import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/hooks/useApi";
import {
  inventoryAPI,
  invoicesAPI,
  repairsAPI,
  ordersAPI,
} from "@/lib/api";
import { inr, type Order, type Repair, type Invoice, type Product } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { CheckCircle, Clock, Wallet, MessageCircle, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";

export default function NotificationsPage() {
  const { data: products = [], isLoading: isLoadingP } = useApi<Product[]>(["inventory"], () => inventoryAPI.getAll());
  const { data: invoices = [], isLoading: isLoadingI } = useApi<Invoice[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: repairs = [], isLoading: isLoadingR } = useApi<Repair[]>(["repairs"], () => repairsAPI.getAll());
  const { data: orders = [], isLoading: isLoadingO } = useApi<Order[]>(["orders"], () => ordersAPI.getAll());

  const isLoading = isLoadingP || isLoadingI || isLoadingR || isLoadingO;

  const todayIso = new Date().toISOString().slice(0, 10);

  const tabs = ["All", "Orders", "Ready for Delivery", "Low Stock Alerts", "Overdue", "Pending Payments"];
  const [activeTab, setActiveTab] = useState("All");

  const readyOrders = orders.filter(o => o.status === "Ready");
  const readyRepairs = repairs.filter(r => r.status === "Ready");
  const dueOrders = orders.filter(o => o.dueDate && o.dueDate <= todayIso && !["Delivered", "Cancelled"].includes(o.status));
  const dueRepairs = repairs.filter(r => r.deliveryDate && r.deliveryDate <= todayIso && r.status !== "Delivered");
  const unpaidInvoices = invoices.filter(i => (i.balanceDue || 0) > 0);
  const lowStock = products.filter(p => p.stock <= 2);

  const totalNotifications = readyOrders.length + readyRepairs.length + dueOrders.length + dueRepairs.length + unpaidInvoices.length + lowStock.length;

  const displayReadyOrders = (activeTab === "All" || activeTab === "Ready for Delivery" || activeTab === "Orders") ? readyOrders : [];
  const displayReadyRepairs = (activeTab === "All" || activeTab === "Ready for Delivery") ? readyRepairs : [];
  const displayDueOrders = (activeTab === "All" || activeTab === "Overdue" || activeTab === "Orders") ? dueOrders : [];
  const displayDueRepairs = (activeTab === "All" || activeTab === "Overdue") ? dueRepairs : [];
  const displayInvoices = (activeTab === "All" || activeTab === "Pending Payments") ? unpaidInvoices : [];
  const displayLowStock = (activeTab === "All" || activeTab === "Low Stock Alerts") ? lowStock : [];

  const activeCount = displayReadyOrders.length + displayReadyRepairs.length + displayDueOrders.length + displayDueRepairs.length + displayInvoices.length + displayLowStock.length;

  const sendWhatsApp = (phoneRaw: string | undefined, message: string) => {
    if (!phoneRaw) {
      toast.error("No phone number available for this customer.");
      return;
    }
    let phone = phoneRaw.replace(/\D/g, "");
    if (phone.length === 10) phone = "91" + phone;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
  };

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="text-4xl tracking-tight font-display">
            Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            You have <strong className="text-foreground">{totalNotifications}</strong> active alerts requiring your attention.
          </p>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {tabs.map(tab => (
          <Button 
            key={tab} 
            variant={activeTab === tab ? "default" : "outline"} 
            onClick={() => setActiveTab(tab)}
            className={`rounded-full ${activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "bg-background text-muted-foreground hover:bg-muted"}`}
            size="sm"
          >
            {tab}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-center py-12 text-muted-foreground">Loading notifications...</p>
      ) : activeCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/10 border border-dashed border-muted-foreground/20 rounded-lg">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">You're all caught up!</h2>
          <p className="text-sm mt-1">{totalNotifications === 0 ? "No active notifications or alerts at this time." : `No active notifications for the "${activeTab}" filter.`}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          
          {/* Ready for Delivery */}
          {(displayReadyOrders.length > 0 || displayReadyRepairs.length > 0) && (
            <Card className="shadow-sm border-border overflow-hidden flex flex-col">
              <CardHeader className="bg-muted/20 border-b border-border pb-3 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Ready for Delivery
                  </CardTitle>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                    {displayReadyOrders.length + displayReadyRepairs.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto max-h-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Type & ID</th>
                        <th className="py-3 px-4 font-semibold">Customer</th>
                        <th className="py-3 px-4 font-semibold">Item Details</th>
                        <th className="py-3 px-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayReadyOrders.map(o => {
                        return (
                          <tr key={o.id || (o as any)._id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 shadow-none rounded-sm px-1.5 py-0">Order</Badge>
                                <span className="font-medium text-foreground">{o.orderNo}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-foreground">{o.customerName}</div>
                              <div className="text-xs text-muted-foreground">{o.customerMobile}</div>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">{o.itemDescription}</td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => sendWhatsApp(o.customerMobile, `*अरिहंत ज्वेलर्स*\n\nनमस्ते ${o.customerName},\n\nआपका कस्टम ऑर्डर (${o.orderNo}) - ${o.itemDescription} अब डिलीवरी के लिए तैयार है। ऑर्डर ${formatDate(o.date)} को दिया गया था।\n\nकृपया इसे लेने के लिए दुकान पर आएं।\n\nधन्यवाद!`)} title="Send WhatsApp Reminder">
                                  <MessageCircle className="w-4 h-4" />
                                </Button>
                                <Link to="/orders"><Button size="sm" variant="outline" className="h-8">View</Button></Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {displayReadyRepairs.map(r => {
                        const balanceDue = (r.estimate || 0) - (r.advance || 0);
                        return (
                          <tr key={r.id || (r as any)._id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 shadow-none rounded-sm px-1.5 py-0">Repair</Badge>
                                <span className="font-medium text-foreground">{r.ticketNo}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-foreground">{r.customerName}</div>
                              <div className="text-xs text-muted-foreground">{r.customerMobile}</div>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">{r.itemDescription}</td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => sendWhatsApp(r.customerMobile, `*अरिहंत ज्वेलर्स*\n\nनमस्ते ${r.customerName},\n\nआपका रिपेयर आइटम (${r.ticketNo}) - ${r.itemDescription} अब डिलीवरी के लिए तैयार है। आइटम ${formatDate(r.date)} को प्राप्त हुआ था। बकाया राशि ${inr(balanceDue)} है।\n\nकृपया इसे लेने के लिए दुकान पर आएं।\n\nधन्यवाद!`)} title="Send WhatsApp Reminder">
                                  <MessageCircle className="w-4 h-4" />
                                </Button>
                                <Link to="/repairs"><Button size="sm" variant="outline" className="h-8">View</Button></Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overdue / Due Today */}
          {(displayDueOrders.length > 0 || displayDueRepairs.length > 0) && (
            <Card className="shadow-sm border-border overflow-hidden flex flex-col">
              <CardHeader className="bg-muted/20 border-b border-border pb-3 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-rose-600" />
                    Overdue & Due Today
                  </CardTitle>
                  <Badge variant="secondary" className="bg-rose-100 text-rose-700 hover:bg-rose-100">
                    {displayDueOrders.length + displayDueRepairs.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto max-h-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Type & ID</th>
                        <th className="py-3 px-4 font-semibold">Customer</th>
                        <th className="py-3 px-4 font-semibold">Due Date</th>
                        <th className="py-3 px-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayDueOrders.map(o => (
                        <tr key={o.id || (o as any)._id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 shadow-none rounded-sm px-1.5 py-0">Order</Badge>
                              <span className="font-medium text-foreground">{o.orderNo}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground">{o.customerName}</div>
                            <div className="text-xs text-muted-foreground">{o.customerMobile}</div>
                          </td>
                          <td className="py-3 px-4 text-rose-600 font-medium">
                            {o.dueDate ? formatDate(o.dueDate) : "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => sendWhatsApp(o.customerMobile, `*अरिहंत ज्वेलर्स*\n\nनमस्ते ${o.customerName},\n\nयह आपके कस्टम ऑर्डर (${o.orderNo}) के संबंध में एक रिमाइंडर है। अपेक्षित देय तिथि ${o.dueDate ? formatDate(o.dueDate) : "—"} थी।\n\nअपडेट के लिए कृपया हमसे संपर्क करें या दुकान पर आएं।\n\nधन्यवाद!`)} title="Send WhatsApp Reminder">
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                              <Link to="/orders"><Button size="sm" variant="outline" className="h-8">View</Button></Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {displayDueRepairs.map(r => (
                        <tr key={r.id || (r as any)._id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 shadow-none rounded-sm px-1.5 py-0">Repair</Badge>
                              <span className="font-medium text-foreground">{r.ticketNo}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground">{r.customerName}</div>
                            <div className="text-xs text-muted-foreground">{r.customerMobile}</div>
                          </td>
                          <td className="py-3 px-4 text-rose-600 font-medium">
                            {r.deliveryDate ? formatDate(r.deliveryDate) : "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => sendWhatsApp(r.customerMobile, `*अरिहंत ज्वेलर्स*\n\nनमस्ते ${r.customerName},\n\nयह आपके रिपेयर आइटम (${r.ticketNo}) के संबंध में एक रिमाइंडर है। अपेक्षित डिलीवरी तिथि ${r.deliveryDate ? formatDate(r.deliveryDate) : "—"} थी।\n\nअपडेट के लिए कृपया हमसे संपर्क करें या दुकान पर आएं।\n\nधन्यवाद!`)} title="Send WhatsApp Reminder">
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                              <Link to="/repairs"><Button size="sm" variant="outline" className="h-8">View</Button></Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unpaid Dues */}
          {displayInvoices.length > 0 && (
            <Card className="shadow-sm border-border overflow-hidden flex flex-col">
              <CardHeader className="bg-muted/20 border-b border-border pb-3 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-amber-600" />
                    Pending Payments
                  </CardTitle>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                    {displayInvoices.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto max-h-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Invoice No</th>
                        <th className="py-3 px-4 font-semibold">Customer</th>
                        <th className="py-3 px-4 font-semibold text-right">Due Amount</th>
                        <th className="py-3 px-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayInvoices.map(i => (
                        <tr key={i.id || (i as any)._id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-medium text-foreground">{i.number}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground">{i.customerName}</div>
                            <div className="text-xs text-muted-foreground">{i.customerMobile}</div>
                          </td>
                          <td className="py-3 px-4 text-right text-amber-600 font-semibold">{inr(i.balanceDue || 0)}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => sendWhatsApp(i.customerMobile, `*अरिहंत ज्वेलर्स*\n\nनमस्ते ${i.customerName},\n\nयह आपके इनवॉइस नंबर: ${i.number} (दिनांक ${formatDate(i.createdAt)}) के लिए *${inr(i.balanceDue || 0)}* की बकाया राशि के संबंध में एक रिमाइंडर है।\n\nकृपया जल्द से जल्द बकाया राशि का भुगतान करें।\n\nधन्यवाद!`)} title="Send WhatsApp Reminder">
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                              <Link to="/dues"><Button size="sm" variant="outline" className="h-8">Collect</Button></Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Low Stock */}
          {displayLowStock.length > 0 && (
            <Card className="shadow-sm border-border overflow-hidden flex flex-col">
              <CardHeader className="bg-muted/20 border-b border-border pb-3 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-slate-600" />
                    Low Stock Alerts
                  </CardTitle>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-200">
                    {displayLowStock.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto max-h-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Product Name</th>
                        <th className="py-3 px-4 font-semibold">Category</th>
                        <th className="py-3 px-4 font-semibold text-right">Current Stock</th>
                        <th className="py-3 px-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayLowStock.map(p => (
                        <tr key={p.id || (p as any)._id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-medium text-foreground">{p.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{p.category} {p.subcategory ? `> ${p.subcategory}` : ""}</td>
                          <td className="py-3 px-4 text-right text-rose-600 font-semibold">{p.stock}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link to="/inventory"><Button size="sm" variant="outline" className="h-8">Restock</Button></Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      )}
    </Layout>
  );
}