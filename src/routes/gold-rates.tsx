import { useEffect, useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { inr, type MetalRates } from "@/lib/storage";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { goldRatesAPI } from "@/lib/api";
import { TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

const defaultRates: MetalRates = {
  updatedAt: new Date().toISOString(),
  gold24: 7850,
  gold22: 7200,
  gold18: 5890,
  silver: 98,
};

export default function GoldRatesPage() {
  const { data = [], isLoading, error } = useApi<MetalRates[]>(["goldRates"], () => goldRatesAPI.getAll());
  const createMutation = useApiMutation((data: MetalRates) => goldRatesAPI.create(data), ["goldRates"]);
  const updateMutation = useApiMutation(
    (data: { id: string; body: MetalRates }) => goldRatesAPI.update(data.id, data.body),
    ["goldRates"]
  );

  const latest = data[0];
  const [open, setOpen] = useState(false);
  const [rates, setRates] = useState<MetalRates>(defaultRates);

  useEffect(() => {
    if (latest) {
      setRates({
        updatedAt: latest.updatedAt ?? new Date().toISOString(),
        gold24: latest.gold24,
        gold22: latest.gold22,
        gold18: latest.gold18,
        silver: latest.silver,
      });
    }
  }, [latest]);

  const saveRate = async (key: keyof MetalRates, value: number) => {
    const nextRates = { ...rates, [key]: value, updatedAt: new Date().toISOString() };
    setRates(nextRates);

    console.log(`[Gold Rates] Saving rate to DB | ${key}: ${value}`, nextRates);
    if (latest && (latest as any)._id) {
      await updateMutation.mutateAsync({ id: (latest as any)._id, body: nextRates });
    } else {
      await createMutation.mutateAsync(nextRates);
    }
    console.log(`[Gold Rates] Successfully updated DB!`);
  };

  const markUpdatedNow = async () => {
    const nextRates = { ...rates, updatedAt: new Date().toISOString() };
    setRates(nextRates);

    const todayStr = new Date().toDateString();
    const latestDateStr = latest?.updatedAt ? new Date(latest.updatedAt).toDateString() : "";

    // Create a new historical entry if it's a new day to build the graph, otherwise update today's
    if (latest && (latest as any)._id && todayStr === latestDateStr) {
      await updateMutation.mutateAsync({ id: (latest as any)._id, body: nextRates });
    } else {
      await createMutation.mutateAsync(nextRates);
    }
    setOpen(false);
  };

  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    if (sorted.length === 0) {
      return [{
        date: formatDate(defaultRates.updatedAt).split(",")[0],
        "24K Gold": defaultRates.gold24,
        "22K Gold": defaultRates.gold22,
        "18K Gold": defaultRates.gold18,
        "Silver": defaultRates.silver,
      }];
    }
    return sorted.map(r => {
      const d = new Date(r.updatedAt);
      return {
        date: `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth()+1).toString().padStart(2, "0")}`,
        "24K Gold": r.gold24,
        "22K Gold": r.gold22,
        "18K Gold": r.gold18,
        "Silver": r.silver,
      };
    });
  }, [data]);

  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 1000) return `₹${(tickItem / 1000).toFixed(1)}k`;
    return `₹${tickItem}`;
  };

  const cards = [
    { key: "gold24" as const, label: "24K Gold", tone: "from-yellow-100 to-yellow-50" },
    { key: "gold22" as const, label: "22K Gold", tone: "from-amber-100 to-amber-50" },
    { key: "gold18" as const, label: "18K Gold", tone: "from-orange-100 to-orange-50" },
    { key: "silver" as const, label: "Silver", tone: "from-slate-100 to-slate-50" },
  ];

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Gold & Silver Rates</h1>
          <p className="text-muted-foreground mt-1">Set today's per-gram rates. Used in billing & advances.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg">Edit Rates</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[75vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Metal Rates</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {cards.map((c) => (
                <div key={c.key}>
                  <Label className="text-xs">{c.label} (₹/g)</Label>
                  <Input type="number" value={rates[c.key] as number} onChange={(e) => saveRate(c.key, +e.target.value)} />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              {isLoading ? 'Loading rates...' : error ? 'Failed to load rates' : `Updated: ${formatDate(rates.updatedAt)}`}
              <Button onClick={markUpdatedNow}>Save Rates & Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.key} className={`bg-linear-to-br ${c.tone}`}>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground flex items-center gap-1"><TrendingUp className="w-4 h-4" />{c.label}</div>
              <div className="text-3xl font-display mt-1">{inr(rates[c.key] as number)}<span className="text-base text-muted-foreground">/g</span></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Gold Price Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="color24k" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="color22k" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="color18k" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b45309" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#b45309" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={formatYAxis} domain={['auto', 'auto']} tickMargin={10} />
                <RechartsTooltip 
                  formatter={(value: number) => [inr(value), undefined]} 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}
                  cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: '16px' }} />
                <Area type="monotone" dataKey="24K Gold" stroke="#f59e0b" strokeWidth={3} fill="url(#color24k)" dot={chartData.length === 1} activeDot={{ r: 6, strokeWidth: 0, fill: '#f59e0b' }} />
                <Area type="monotone" dataKey="22K Gold" stroke="#d97706" strokeWidth={3} fill="url(#color22k)" dot={chartData.length === 1} activeDot={{ r: 6, strokeWidth: 0, fill: '#d97706' }} />
                <Area type="monotone" dataKey="18K Gold" stroke="#b45309" strokeWidth={3} fill="url(#color18k)" dot={chartData.length === 1} activeDot={{ r: 6, strokeWidth: 0, fill: '#b45309' }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Silver Price Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSilver" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={formatYAxis} domain={['auto', 'auto']} tickMargin={10} />
                <RechartsTooltip 
                  formatter={(value: number) => [inr(value), undefined]} 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}
                  cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: '16px' }} />
                <Area type="monotone" dataKey="Silver" stroke="#64748b" strokeWidth={3} fill="url(#colorSilver)" dot={chartData.length === 1} activeDot={{ r: 6, strokeWidth: 0, fill: '#64748b' }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
