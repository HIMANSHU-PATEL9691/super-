import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr } from "@/lib/storage";
import { Calculator, RotateCcw, Scale, ArrowRightLeft, Sparkles, Gem, Percent } from "lucide-react";

export default function CalculatorPage() {
  // New Item States
  const [weight, setWeight] = useState<number | "">("");
  const [rate, setRate] = useState<number | "">("");
  const [making, setMaking] = useState<number | "">("");
  const [makingType, setMakingType] = useState<"percent" | "fixed">("percent");
  const [stone, setStone] = useState<number | "">("");
  const [gstType, setGstType] = useState<"GST" | "NON-GST">("GST");
  const [gst, setGst] = useState<number | "">(3);

  // Old Gold Exchange States
  const [oldGoldAmount, setOldGoldAmount] = useState<number | "">("");

  const calc = useMemo(() => {
    // New Item calculations
    const w = Number(weight) || 0;
    const r = Number(rate) || 0;
    const m = Number(making) || 0;
    const s = Number(stone) || 0;
    const g = gstType === "GST" ? (Number(gst) || 0) : 0;

    const metalValue = w * r;
    const makingValue = makingType === "percent" ? (metalValue * m) / 100 : m;
    const subtotal = metalValue + makingValue + s;
    const gstValue = (subtotal * g) / 100;
    const total = subtotal + gstValue;

    // Exchange calculations
    const exchangeValue = Number(oldGoldAmount) || 0;

    const payable = total - exchangeValue;

    return {
      metalValue,
      makingValue,
      subtotal,
      gstValue,
      total,
      exchangeValue,
      payable
    };
  }, [weight, rate, making, makingType, stone, gstType, gst, oldGoldAmount]);

  const reset = () => {
    setWeight("");
    setRate("");
    setMaking("");
    setMakingType("percent");
    setStone("");
    setGstType("GST");
    setGst(3);
    setOldGoldAmount("");
  };

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-4 gap-4">
        <div>
          <h1 className="text-3xl font-display tracking-tight text-primary">Jewellery Calculator</h1>
          <p className="text-muted-foreground mt-1 text-sm">Quick, precise estimates for new purchases and exchanges.</p>
        </div>
        <Button variant="outline" onClick={reset} className="h-9 px-4 bg-background shadow-sm hover:bg-muted/50 w-full sm:w-auto">
          <RotateCcw className="w-3.5 h-3.5 mr-2" /> Reset All
        </Button>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Inputs */}
        <div className="xl:col-span-2 space-y-6">
          {/* New Item Calculator */}
          <Card className="shadow-lg border-primary/10 overflow-hidden transition-all duration-300 hover:shadow-xl">
            <div className="bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 border-b border-primary/10">
              <CardTitle className="font-display flex items-center gap-2 text-primary text-lg">
                <div className="p-2 bg-primary/20 rounded-lg shadow-inner text-primary">
                  <Calculator className="w-4 h-4" />
                </div>
                New Item Details
              </CardTitle>
            </div>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 p-4 sm:p-5">
              <F label="Net Weight">
                <div className="relative shadow-sm rounded-md">
                  <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9 h-10 text-base bg-muted/20 font-medium focus-visible:bg-background transition-colors" type="number" value={weight} onChange={e => setWeight(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0.000" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">g</span>
                </div>
              </F>
              <F label="Rate / gram">
                <div className="relative shadow-sm rounded-md">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                  <Input className="pl-8 h-10 text-base bg-muted/20 font-medium focus-visible:bg-background transition-colors" type="number" value={rate} onChange={e => setRate(e.target.value === "" ? "" : Number(e.target.value))} placeholder="7200" />
                </div>
              </F>
              
              <F label="Making Charge">
                <div className="flex gap-2 shadow-sm rounded-md">
                  <Select value={makingType} onValueChange={v => setMakingType(v as "percent" | "fixed")}>
                    <SelectTrigger className="w-24 shrink-0 h-10 bg-muted/20 font-medium text-sm focus:ring-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent" className="font-medium">% Percent</SelectItem>
                      <SelectItem value="fixed" className="font-medium">₹ Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    {makingType === "fixed" ? <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span> : <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>}
                    <Input type="number" value={making} onChange={e => setMaking(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" className="pl-8 h-10 text-base bg-muted/20 font-medium focus-visible:bg-background transition-colors" />
                  </div>
                </div>
              </F>
              
              <F label="Stone Charges">
                <div className="relative shadow-sm rounded-md">
                  <Gem className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9 h-10 text-base bg-muted/20 font-medium focus-visible:bg-background transition-colors" type="number" value={stone} onChange={e => setStone(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">₹</span>
                </div>
              </F>
              
              <F label="Tax Options">
                <div className="flex gap-2 shadow-sm rounded-md">
                  <Select value={gstType} onValueChange={v => setGstType(v as "GST" | "NON-GST")}>
                    <SelectTrigger className="w-28 shrink-0 h-10 bg-muted/20 font-medium text-sm focus:ring-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GST" className="font-medium">GST</SelectItem>
                      <SelectItem value="NON-GST" className="font-medium">NON-GST</SelectItem>
                    </SelectContent>
                  </Select>
                  {gstType === "GST" && (
                    <div className="relative flex-1">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                      <Input type="number" value={gst} onChange={e => setGst(e.target.value === "" ? "" : Number(e.target.value))} placeholder="3" className="pl-9 h-10 text-base bg-muted/20 font-medium focus-visible:bg-background transition-colors" />
                    </div>
                  )}
                </div>
              </F>
            </CardContent>
          </Card>

          {/* Old Gold Calculator */}
          <Card className="shadow-lg border-rose-500/20 overflow-hidden transition-all duration-300 hover:shadow-xl">
            <div className="bg-linear-to-r from-rose-500/10 via-rose-500/5 to-transparent px-4 py-3 border-b border-rose-500/20">
              <CardTitle className="font-display flex items-center gap-2 text-rose-700 text-lg">
                <div className="p-2 bg-rose-500/20 rounded-lg shadow-inner text-rose-600">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                Old Gold Exchange
              </CardTitle>
            </div>
            <CardContent className="p-4 sm:p-5">
              <F label="Exchange Amount">
                <div className="relative shadow-sm rounded-md max-w-sm">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-600 font-bold text-base">₹</span>
                  <Input className="pl-7 h-10 text-lg bg-rose-50 border-rose-200 font-bold text-rose-700 placeholder:text-rose-700/30 focus-visible:ring-rose-500 transition-colors" type="number" value={oldGoldAmount} onChange={e => setOldGoldAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 font-medium">Enter the total calculated value of the old gold being exchanged.</p>
              </F>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary */}
        <div className="space-y-6">
          <Card className="shadow-2xl border-amber-500/30 bg-linear-to-b from-amber-50/80 to-white overflow-hidden sticky top-24">
            <div className="bg-linear-to-r from-amber-500/20 via-amber-500/10 to-transparent px-4 py-3 border-b border-amber-500/20">
              <CardTitle className="font-display flex items-center gap-2 text-amber-800 text-lg">
                <div className="p-2 bg-amber-500/20 rounded-lg shadow-inner text-amber-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                Final Estimate
              </CardTitle>
            </div>
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="space-y-4">
                <div className="text-[10px] font-bold text-amber-700/70 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <div className="w-8 h-px bg-amber-700/30"></div>New Item Breakdown
                </div>
                <Row label="Metal Value" v={inr(calc.metalValue)} />
                <Row label="Making Charges" v={inr(calc.makingValue)} />
                {Number(stone) > 0 && <Row label="Stone Charges" v={inr(Number(stone))} />}
                <div className="pt-0.5 pb-0.5"><div className="w-full h-px border-t border-dashed border-border/70"></div></div>
                <Row label="Subtotal" v={inr(calc.subtotal)} />
                {gstType === "GST" && <Row label={`GST (${Number(gst)}%)`} v={inr(calc.gstValue)} />}
                <div className="p-3 bg-amber-500/10 rounded-xl mt-3 border border-amber-500/20 shadow-sm">
                  <Row label="Total Item Value" v={inr(calc.total)} highlight boldValue />
                </div>
              </div>

              {Number(oldGoldAmount) > 0 && (
                <div className="space-y-3 pt-3">
                  <div className="text-[10px] font-bold text-rose-700/70 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <div className="w-8 h-px bg-rose-700/30"></div>Exchange Deduction
                  </div>
                  <Row label="Exchange Value" v={`- ${inr(calc.exchangeValue)}`} negative />
                </div>
              )}

              <div className="pt-4 border-t-2 border-amber-500/20 mt-3">
                <div className="flex flex-col gap-1">
                  <span className="font-display font-semibold text-sm text-slate-600 uppercase tracking-wider">Net Payable</span>
                  <span className={`font-display font-bold text-3xl tracking-tighter ${calc.payable < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {inr(calc.payable)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </Layout>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground/80">{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, v, highlight = false, negative = false, boldValue = false }: { label: string; v: string; highlight?: boolean; negative?: boolean; boldValue?: boolean }) {
  return (
    <div className={`flex justify-between items-center ${highlight ? "mt-2" : "text-sm"}`}>
      <span className={highlight ? "text-foreground font-semibold" : "text-muted-foreground font-medium"}>{label}</span>
      <span className={highlight || boldValue ? "text-primary font-bold text-base" : negative ? "text-rose-600 font-bold" : "font-semibold text-foreground"}>{v}</span>
    </div>
  );
}