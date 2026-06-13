import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Search, Briefcase, IndianRupee, Users } from "lucide-react";
import { inr } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { employeesAPI } from "@/lib/api";

export interface Employee {
  id: string;
  name: string;
  phone: string;
  role: string;
  salary: number;
  joinDate: string;
  status: "Active" | "Inactive";
  totalPaid: number;
  notes: string;
}

const empty: Employee = {
  id: "",
  name: "",
  phone: "",
  role: "Sales",
  salary: 0,
  joinDate: new Date().toISOString().slice(0, 10),
  status: "Active",
  totalPaid: 0,
  notes: "",
};

function getCompletedMonths(joinDateStr: string) {
  const joinDate = new Date(joinDateStr);
  const now = new Date();
  let months = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
  if (now.getDate() < joinDate.getDate()) {
    months--;
  }
  return Math.max(0, months);
}

const ROLES = ["Sales", "Store Manager", "Cashier", "Security Guard", "Cleaner", "Other"];

export default function EmployeesPage() {
  const { data: list = [], isLoading } = useApi<Employee[]>(["employees"], () => employeesAPI.getAll());
  const createMutation = useApiMutation((data: Employee) => employeesAPI.create(data), ["employees"]);
  const updateMutation = useApiMutation((data: { id: string; body: Partial<Employee> }) => employeesAPI.update(data.id, data.body), ["employees"]);
  const deleteMutation = useApiMutation((id: string) => employeesAPI.delete(id), ["employees"]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Employee>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const save = async () => {
    if (!form.name || !form.role || !form.salary) {
      toast.error("Name, role, and salary are required");
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: form });
        toast.success("Employee updated successfully");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Employee added successfully");
      }
      setOpen(false);
      setForm(empty);
      setEditingId(null);
    } catch (error) {
      toast.error("Failed to save employee");
    }
  };

  const remove = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this employee?")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast.success("Employee deleted");
      } catch (error) {
        toast.error("Failed to delete employee");
      }
    }
  };

  const startEdit = (emp: Employee) => {
    setForm(emp);
    setEditingId(emp.id);
    setOpen(true);
  };

  const paySalary = async (emp: Employee) => {
    const completedMonths = getCompletedMonths(emp.joinDate);
    const pending = (completedMonths * emp.salary) - (emp.totalPaid || 0);
    if (pending <= 0) {
      toast.error("No pending salary for completed months.");
      return;
    }
    const amountStr = window.prompt(`Pending salary is ${pending}. Enter amount to pay:`, pending.toString());
    if (amountStr) {
      const amt = parseFloat(amountStr);
      if (!isNaN(amt) && amt > 0) {
        try {
          await updateMutation.mutateAsync({ id: emp.id || (emp as any)._id, body: { totalPaid: (emp.totalPaid || 0) + amt } as any });
          toast.success(`Paid ${inr(amt)} to ${emp.name}`);
        } catch (error) {
          toast.error("Failed to process payment");
        }
      }
    }
  };

  const filtered = list.filter(
    (e) =>
      e.name.toLowerCase().includes(q.toLowerCase()) ||
      e.phone.includes(q) ||
      e.role.toLowerCase().includes(q.toLowerCase())
  );

  const activeCount = list.filter((e) => e.status === "Active").length;
  const totalSalary = list.filter((e) => e.status === "Active").reduce((sum, e) => sum + e.salary, 0);

  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage staff, roles, and monthly salaries.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full sm:w-auto" onClick={() => { setForm(empty); setEditingId(null); }}>
              <Plus className="w-4 h-4 mr-2" /> Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                {editingId ? "Edit" : "New"} Employee
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5"><Label className="text-xs">Full Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Mobile Number</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Role / Designation *</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Monthly Salary (₹) *</Label>
                  <Input type="number" value={form.salary || ""} onChange={(e) => setForm({ ...form, salary: +e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Join Date</Label>
                  <Input type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} className="w-full" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Employee["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5"><Label className="text-xs">Additional Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save Employee</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground flex items-center gap-2"><Users className="w-4 h-4"/>Total Staff</div><div className="text-2xl font-display mt-1">{list.length}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground flex items-center gap-2"><Briefcase className="w-4 h-4"/>Active Staff</div><div className="text-2xl font-display mt-1 text-primary">{activeCount}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground flex items-center gap-2"><IndianRupee className="w-4 h-4"/>Monthly Salary Roll</div><div className="text-2xl font-display mt-1 text-rose-600">{inr(totalSalary)}</div></CardContent></Card>
      </div>

      <div className="relative mb-4 w-full sm:max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9 w-full bg-background" placeholder="Search by name, role or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display">Employee Directory</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <p className="text-center text-muted-foreground py-12">Loading employees...</p> : 
           filtered.length === 0 ? <p className="text-center text-muted-foreground py-12">No employees found.</p> :
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b bg-muted/20">
              <tr><th className="p-3 font-medium">Name</th><th className="font-medium">Role</th><th className="font-medium">Join Date</th><th className="font-medium">Salary/mo</th><th className="font-medium">Pending</th><th className="text-center font-medium">Status</th><th className="text-right pr-4 font-medium">Action</th></tr>
            </thead>
            <tbody>{paginated.map((e) => {
              const pending = (getCompletedMonths(e.joinDate) * e.salary) - (e.totalPaid || 0);
              return (
                <tr key={e.id || (e as any)._id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                <td className="p-3">
                  <div className="font-medium">{e.name}</div><div className="text-xs text-muted-foreground">{e.phone}</div>
                </td>
                <td>{e.role}</td>
                <td>{formatDate(e.joinDate)}</td>
                <td className="font-medium">{inr(e.salary)}</td>
                <td className="font-medium text-rose-600">{inr(pending > 0 ? pending : 0)}</td>
                <td className="text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${e.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>{e.status}</span></td>
                <td className="text-right pr-3 space-x-1">
                  {pending > 0 && <Button size="sm" variant="outline" className="h-8" onClick={() => paySalary(e)}>Pay</Button>}
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(e)}><Pencil className="w-4 h-4"/></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(e.id || (e as any)._id)}><Trash2 className="w-4 h-4 text-red-500"/></Button>
                </td>
              </tr>
            )})}</tbody>
          </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, filtered.length)} of {filtered.length} entries</div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
          </div>
        )}
          </div>}
        </CardContent>
      </Card>
    </Layout>
  );
}