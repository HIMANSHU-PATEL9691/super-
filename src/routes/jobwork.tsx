import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type JobWork, type Karigar } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { jobworkAPI, karigarsAPI } from "@/lib/api";
import { Plus, Trash2, ClipboardList } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

export default function JobWorkPage() {
  const { data: list = [], isLoading } = useApi<JobWork[]>(["jobwork"], () => jobworkAPI.getAll());
  const { data: karigars = [] } = useApi<Karigar[]>(["karigars"], () => karigarsAPI.getAll());
  
  const createMutation = useApiMutation((data: JobWork) => jobworkAPI.create(data), ["jobwork"]);
  const updateMutation = useApiMutation((data: { id: string; body: JobWork }) => jobworkAPI.update(data.id, data.body), ["jobwork"]);
  const deleteMutation = useApiMutation((id: string) => jobworkAPI.delete(id), ["jobwork"]);

  const [open, setOpen] = useState(false);
  const [searchKar, setSearchKar] = useState("");
  const [page, setPage] = useState(1);
  const empty: JobWork = { id: "", jobNo: "", date: new Date().toISOString().slice(0,10), karigarId: "", karigarName: "", itemDescription: "", metal: "Gold", purity: "22K", issuedWeight: 0, receivedWeight: 0, makingCharge: 0, dueDate: "", status: "Issued", note: "" };
  const [form, setForm] = useState<JobWork>(empty);

  const save = async () => {
    if (!form.karigarName || !form.itemDescription) return;
    const jobNo = form.jobNo || `JW-${(list.length + 1).toString().padStart(4, "0")}`;
    try {
      await createMutation.mutateAsync({ ...form, jobNo });
      setForm(empty); 
      setOpen(false);
    } catch (error) {
      console.error("[JobWork] Error saving to DB:", error);
    }
  };
  const setStatus = async (id: string, status: JobWork["status"]) => {
    const job = list.find(r => r.id === id || (r as any)._id === id);
    if (job) {
      await updateMutation.mutateAsync({ id, body: { ...job, status } });
    }
  };
  const remove = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const pending = list.filter(r => r.status !== "Settled").length;
  const issuedG = list.filter(r => r.status !== "Settled").reduce((s, r) => s + r.issuedWeight, 0);

  const totalPages = Math.ceil(list.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = list.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div><h1 className="text-4xl">Job Work</h1><p className="text-muted-foreground mt-1">Metal issued to karigars & received back.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg" className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2"/>New Job</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto" aria-describedby={undefined}><DialogHeader><DialogTitle>Issue Job Work</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Search Karigar</Label>
                  <Input placeholder="Search name..." value={searchKar} onChange={e => {
                    setSearchKar(e.target.value);
                    const match = karigars.find(k => k.name.toLowerCase() === e.target.value.toLowerCase() || (k.mobile||"").includes(e.target.value));
                    if (match) setForm({...form, karigarId: match._id || match.id, karigarName: match.name});
                  }} />
                </div>
                <div>
                  <Label className="text-xs">Karigar *</Label>
                  <Select value={form.karigarId || ""} onValueChange={val => {
                    const k = karigars.find(x => (x._id || x.id) === val);
                    if (k) setForm({...form, karigarId: val, karigarName: k.name});
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select karigar" /></SelectTrigger>
                    <SelectContent>
                      {karigars.filter(k => k.name.toLowerCase().includes(searchKar.toLowerCase()) || (k.mobile||"").includes(searchKar)).map(k => (
                        <SelectItem key={k._id || k.id} value={k._id || k.id}>{k.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Field label="Item Description *" v={form.itemDescription} on={v => setForm({...form, itemDescription: v})} />
              <div><Label className="text-xs">Metal</Label>
                <select className="w-full h-10 border rounded-md px-3 bg-background" value={form.metal} onChange={e => setForm({...form, metal: e.target.value as JobWork["metal"]})}>
                  <option>Gold</option><option>Silver</option>
                </select></div>
              <Field label="Purity" v={form.purity} on={v => setForm({...form, purity: v})} />
              <Field label="Issued Weight (g)" type="number" v={String(form.issuedWeight)} on={v => setForm({...form, issuedWeight: +v})} />
              <Field label="Received Weight (g)" type="number" v={String(form.receivedWeight)} on={v => setForm({...form, receivedWeight: +v})} />
              <Field label="Making Charge ₹" type="number" v={String(form.makingCharge)} on={v => setForm({...form, makingCharge: +v})} />
              <Field label="Date" type="date" v={form.date} on={v => setForm({...form, date: v})} />
              <Field label="Due Date" type="date" v={form.dueDate || ""} on={v => setForm({...form, dueDate: v})} />
              <div className="col-span-2"><Field label="Note" v={form.note || ""} on={v => setForm({...form, note: v})} /></div>
            </div>
            <Button onClick={save} className="mt-2">Issue</Button>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Total Jobs" value={list.length} />
        <Stat label="Pending" value={pending} />
        <Stat label="Issued (active)" value={`${issuedG.toFixed(2)} g`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><ClipboardList className="w-5 h-5"/>Jobs</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center text-muted-foreground py-12">Loading jobs...</p> : list.length === 0 ? <p className="text-center text-muted-foreground py-12">No jobs issued yet.</p> :
          <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b"><tr><th className="py-2">Job</th><th>Date</th><th>Karigar</th><th>Item</th><th>Issued</th><th>Received</th><th>Making</th><th>Status</th><th></th></tr></thead>
          <tbody>{paginated.map(r => (<tr key={(r as any)._id || r.id} className="border-b last:border-0">
              <td className="py-2 font-medium">{r.jobNo}</td><td>{formatDate(r.date)}</td><td>{r.karigarName}</td><td>{r.itemDescription}</td>
              <td>{r.issuedWeight}g</td><td>{r.receivedWeight}g</td><td>{inr(r.makingCharge)}</td>
              <td><select className="border rounded px-2 py-1 bg-background text-xs" value={r.status} onChange={e => setStatus((r as any)._id || r.id, e.target.value as JobWork["status"])}>
                {["Issued","In Progress","Received","Settled"].map(s => <option key={s}>{s}</option>)}
              </select></td>
              <td className="text-right"><Button size="sm" variant="ghost" onClick={() => remove((r as any)._id || r.id)}><Trash2 className="w-4 h-4"/></Button></td>
            </tr>))}</tbody></table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, list.length)} of {list.length} entries</div>
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

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  if (type === "date") {
    return <div className="space-y-1.5"><Label className="text-xs">{label}</Label><DatePicker value={v} onChange={on} className="w-full h-9" /></div>;
  }
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label><Input type={type} value={v} onChange={e => on(e.target.value)} /></div>;
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-display mt-1">{value}</div></CardContent></Card>;
}
