import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, LogOut, Plus, Trash2, Pencil, Building, CalendarDays, KeyRound, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

// Use VITE_API_URL as backend base.
// Your .env currently contains http://localhost:3000/api, so we must NOT append another /api.
let API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
API_BASE_URL = API_BASE_URL.replace("localhost", "127.0.0.1"); // Force IPv4 resolution

// Backend mounts tenants at: /api/tenants
const API_URL = API_BASE_URL.endsWith('/api')
  ? `${API_BASE_URL}/tenants`
  : `${API_BASE_URL}/api/tenants`;




console.log("[Super Admin Init] Loaded VITE_API_URL from .env:", import.meta.env.VITE_API_URL);
console.log("[Super Admin Init] Final calculated API_URL:", API_URL);

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    shopName: "",
    phone: "",
    adminUsername: "",
    adminPassword: "",
    operatorUsername: "",
    operatorPassword: "",
    status: "Active",
    validUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10),
  });

  const fetchTenants = async () => {
    setIsLoading(true);
    try {
      console.log("[Super Admin] Fetching tenants from:", API_URL);
      const res = await fetch(API_URL);
      console.log("[Super Admin] Fetch response status:", res.status);

      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await res.json();
          console.log("[Super Admin] Fetched tenants:", data);
          setTenants(data);
        } else {
          const text = await res.text();
          console.error("Non-JSON response body:", text);
          throw new Error(`Expected JSON but received '${contentType || "unknown"}'.`);
        }
      } else {
        const errorText = await res.text();
        toast.error(`Failed to load tenants: ${res.status} ${res.statusText}`);
        console.error("Server error response:", errorText);
      }
    } catch (e) {
      console.error("[Super Admin] Failed to fetch tenants. Is backend running?", e);
      console.error("[Super Admin] Full error details:", e);
      toast.error("Network Error: Ensure your backend server is running on port 3000.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const save = async () => {
    if (!form.shopName || !form.phone || !form.adminUsername || !form.adminPassword || !form.operatorUsername || !form.operatorPassword) {
      toast.error("Shop Name, Phone Number, and both sets of credentials are required.");
      return;
    }

    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      
      console.log(`[Super Admin] Attempting to ${method} shop at ${url} with payload:`, form);

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      console.log(`[Super Admin] Save response status: ${res.status}`);

      if (res.ok) {
        const data = await res.json();
        console.log("[Super Admin] Shop saved successfully:", data);
        toast.success(`Shop ${editingId ? "updated" : "created"} successfully!`);
        setOpen(false);
        fetchTenants();
      } else {
        const data = await res.json();
        console.error("[Super Admin] Server returned error during save:", data);
        toast.error(data.error || "Failed to save tenant");
      }
    } catch (e) {
      console.error("[Super Admin] Network error saving tenant:", e);
      toast.error("Network error saving tenant. Is the backend running?");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this shop and revoke their access?")) return;
    
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Shop deleted successfully");
        fetchTenants();
      } else {
        toast.error("Failed to delete shop");
      }
    } catch (e) {
      toast.error("Network error.");
    }
  };

  const [approveValidUntil, setApproveValidUntil] = useState<string>(() => new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10));
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null);

  const requestApproveShop = (id: string) => {
    setApproveTargetId(id);
    setApproveValidUntil(new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10));
    setApproveDialogOpen(true);
  };

  const approveShop = async () => {
    if (!approveTargetId) return;
    if (!approveValidUntil) {
      toast.error("Valid Until date is required.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/${approveTargetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Active",
          validUntil: approveValidUntil,
        })
      });

      if (res.ok) {
        toast.success("Shop approved successfully!");
        setApproveDialogOpen(false);
        setApproveTargetId(null);
        fetchTenants();
      } else {
        const data = await res.text().catch(() => "");
        toast.error(data ? "Failed to approve shop" : "Failed to approve shop");
      }
    } catch {
      toast.error("Network error.");
    }
  };


  const logout = () => {
    localStorage.removeItem("ajms.auth");
    window.location.href = "/";
  };

  const activeTenants = tenants.filter(t => t.status === 'Active').length;
  const pendingTenants = tenants.filter(t => t.status === 'Pending').length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Topbar */}
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="font-display font-bold text-xl flex items-center gap-3">
          <div className="bg-white p-1 rounded-md flex items-center justify-center">
            <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain drop-shadow-sm" />
          </div>
          Coudiefy Super Admin
        </div>
        <Button variant="ghost" className="text-rose-400 hover:text-rose-300 hover:bg-slate-800" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-7xl mx-auto p-6">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="border-border shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Shops</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">{tenants.length}</div>
                </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-green-600">{activeTenants}</div>
                </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-amber-600">{pendingTenants}</div>
                </CardContent>
            </Card>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">Shop Directory</h2>
            <p className="text-slate-500 mt-1">Manage tenant access, GST/Non-GST credentials, and billing limits.</p>
          </div>
          <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) { 
              setEditingId(null); 
              setForm({ 
                shopName: "", 
                phone: "",
                adminUsername: "", 
                adminPassword: "", 
                operatorUsername: "", 
                operatorPassword: "", 
                status: "Active", 
                validUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10) 
              }); 
            }
          }}>
            <DialogTrigger asChild>
              <Button size="lg"><Plus className="w-4 h-4 mr-2" /> Add New Shop</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" aria-describedby={undefined}>
              <DialogHeader><DialogTitle className="text-2xl font-display">{editingId ? "Edit Shop Access" : "Register New Shop"}</DialogTitle></DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Shop Name *</Label>
                    <Input value={form.shopName} onChange={e => setForm({...form, shopName: e.target.value})} placeholder="e.g. Royal Jewellers" className="h-10 text-lg" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Phone Number *</Label>
                    <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="e.g. 9876543210" className="h-10 text-lg" required />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-primary border-b pb-2 flex items-center gap-2">
                       <ShieldCheck className="w-4 h-4"/> Admin (Non-GST)
                    </h3>
                    <div className="space-y-1.5"><Label>Username</Label><Input value={form.adminUsername} onChange={e => setForm({...form, adminUsername: e.target.value})} placeholder="admin" /></div>
                    <div className="space-y-1.5"><Label>Password</Label><Input type="text" value={form.adminPassword} onChange={e => setForm({...form, adminPassword: e.target.value})} placeholder="admin123" /></div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-blue-600 border-b pb-2 flex items-center gap-2">
                       <KeyRound className="w-4 h-4"/> Operator (GST)
                    </h3>
                    <div className="space-y-1.5"><Label>Username</Label><Input value={form.operatorUsername} onChange={e => setForm({...form, operatorUsername: e.target.value})} placeholder="admin2" /></div>
                    <div className="space-y-1.5"><Label>Password</Label><Input type="text" value={form.operatorPassword} onChange={e => setForm({...form, operatorPassword: e.target.value})} placeholder="admin123" /></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5"><Label>Subscription Status</Label>
                    <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive (Suspended)</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Valid Until</Label><Input type="date" className="h-10" value={form.validUntil} onChange={e => setForm({...form, validUntil: e.target.value})} /></div>
                </div>
              </div>
              <DialogFooter><Button size="lg" onClick={save}>{editingId ? "Update Shop" : "Create Shop"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                Loading subscriptions...
              </div>
            ) : tenants.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Building className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-slate-800">No shops registered yet</h3>
                <p>Click "Add New Shop" to provision a tenant.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-semibold">Shop Name</th>
                    <th className="p-4 font-semibold">Admin Login (Non-GST)</th>
                    <th className="p-4 font-semibold">Operator Login (GST)</th>
                    <th className="p-4 font-semibold">Valid Until</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(t => (
                    <tr key={t._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-800 flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                            {t.shopName.charAt(0).toUpperCase()}
                         </div>
                         <div>
                           <div>{t.shopName}</div>
                           {t.phone && <div className="text-xs text-slate-500 font-normal mt-0.5">{t.phone}</div>}
                         </div>
                      </td>
                      <td className="p-4">
                         <div className="text-sm font-medium">{t.adminUsername}</div>
                         <div className="text-xs text-slate-500 font-mono">pwd: {t.adminPassword}</div>
                      </td>
                      <td className="p-4">
                         <div className="text-sm font-medium">{t.operatorUsername}</div>
                         <div className="text-xs text-slate-500 font-mono">pwd: {t.operatorPassword}</div>
                      </td>
                      <td className="p-4">
                        {(() => {
                          const expiry = new Date(t.validUntil);
                          const daysLeft = Math.ceil((expiry.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                          const isExpiringSoon = daysLeft <= 7 && daysLeft > 0;
                          const isExpired = daysLeft <= 0;
                          return (
                            <div className="flex flex-col gap-1.5">
                              <div className={`flex items-center gap-1.5 font-medium ${isExpired ? 'text-rose-600' : isExpiringSoon ? 'text-amber-600' : 'text-slate-700'}`}>
                                <CalendarDays className={`w-4 h-4 ${isExpired ? 'text-rose-500' : isExpiringSoon ? 'text-amber-500' : 'text-muted-foreground'}`}/> 
                                {expiry.toLocaleDateString('en-GB')}
                              </div>
                              {isExpired ? (
                                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider bg-rose-100 px-2 py-0.5 rounded w-fit">Expired</span>
                              ) : isExpiringSoon ? (
                                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded w-fit">Expires in {daysLeft} days</span>
                              ) : null}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-4">
                        {t.status === 'Pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                             <Clock className="w-3.5 h-3.5" /> Pending
                          </span>
                        ) : t.status === 'Active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                             <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                             <XCircle className="w-3.5 h-3.5" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right flex justify-end gap-1">
                        {t.status === 'Pending' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => requestApproveShop(t._id)}
                            title="Approve Shop"
                          >
                            <CheckCircle2 className="w-5 h-5 text-green-600 hover:text-green-700" />
                          </Button>
                        )}

                        <Button size="icon" variant="ghost" onClick={() => { 
                          setEditingId(t._id); 
                          setForm({ 
                            shopName: t.shopName, 
                            phone: t.phone || "",
                            adminUsername: t.adminUsername, 
                            adminPassword: t.adminPassword, 
                            operatorUsername: t.operatorUsername, 
                            operatorPassword: t.operatorPassword, 
                            status: t.status, 
                            validUntil: t.validUntil ? new Date(t.validUntil).toISOString().slice(0,10) : "" 
                          }); 
                          setOpen(true); 
                        }}>
                          <Pencil className="w-4 h-4 text-slate-600 hover:text-blue-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(t._id)}>
                          <Trash2 className="w-4 h-4 text-rose-500 hover:text-rose-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Approve shop dialog (requires Valid Until) */}
              <Dialog open={approveDialogOpen} onOpenChange={(val) => {
                setApproveDialogOpen(val);
                if (!val) {
                  setApproveTargetId(null);
                }
              }}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display">Approve Shop</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label>Valid Until *</Label>
                      <Input
                        type="date"
                        className="h-10"
                        value={approveValidUntil}
                        onChange={(e) => setApproveValidUntil(e.target.value)}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      After approval, shop status will be set to <b>Active</b> and Valid Until will be reset to this date.
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={approveShop}>
                      Approve
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

