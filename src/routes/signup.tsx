import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

export default function SignupPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    shopName: "",
    adminUsername: "",
    adminPassword: "",
    operatorUsername: "",
    operatorPassword: "",
  });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log("\n--- [Signup Flow Started] ---");
    console.log("[1] Form payload prepared:", form);

    try {
      console.log("[2] Checking environment variables. VITE_API_URL =", import.meta.env.VITE_API_URL);
      
      let API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      console.log("[3] Base URL before processing:", API_BASE_URL);
      
      API_BASE_URL = API_BASE_URL.replace("localhost", "127.0.0.1"); // Force IPv4 resolution
      console.log("[4] Base URL after enforcing IPv4:", API_BASE_URL);
      
      const API_URL = API_BASE_URL.endsWith('/api')
        ? `${API_BASE_URL}/tenants`
        : `${API_BASE_URL}/api/tenants`;
      const url = `${API_URL}/signup`;
      
      console.log("[5] Final Target URL ready for fetch:", url);
      console.log("[6] Initiating fetch request...");
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      console.log("[7] Fetch completed! Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("[8] Success! Parsed JSON response:", data);
        toast.success("Sign up successful! Your account is pending approval by the Super Admin.", { duration: 5000 });
        navigate("/");
      } else {
        const data = await response.json();
        console.error("[8] Server responded with an error (Non-200). Payload:", data);
        toast.error(data.error || "Failed to sign up.");
      }
    } catch (err) {
      console.error("\n[!] FATAL ERROR: Network request failed to execute.");
      console.error("[!] Error Object:", err);
      console.error("[!] Is your backend Node.js server currently running?");
      console.error("[!] Try opening the Target URL directly in a new browser tab to check if the server responds.");
      toast.error("Network Error: Could not connect to the server.");
    } finally {
      setIsLoading(false);
      console.log("--- [Signup Flow Ended] ---\n");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-muted/50 to-muted p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      
      <Card className="w-full max-w-xl shadow-2xl border-border/50 relative z-10 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-20 h-20 mb-2 flex items-center justify-center transform hover:scale-105 transition-all duration-300">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-md" />
          </div>
          <CardTitle className="text-2xl font-display tracking-tight">Register Your Shop</CardTitle>
          <CardDescription>Create your credentials. Access will be granted after Admin approval.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-6">
            <div className="space-y-2">
              <Label>Shop Name</Label>
              <Input required placeholder="e.g. Royal Jewellers" value={form.shopName} onChange={e => setForm({...form, shopName: e.target.value})} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border border-border/50">
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-primary border-b pb-1"><ShieldCheck className="w-4 h-4"/> Admin Login</h3>
                <div className="space-y-1.5"><Label className="text-xs">Username</Label><Input required placeholder="admin" value={form.adminUsername} onChange={e => setForm({...form, adminUsername: e.target.value})} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Password</Label><Input required type="password" placeholder="••••••••" value={form.adminPassword} onChange={e => setForm({...form, adminPassword: e.target.value})} /></div>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-blue-600 border-b pb-1"><KeyRound className="w-4 h-4"/> Operator Login (GST)</h3>
                <div className="space-y-1.5"><Label className="text-xs">Username</Label><Input required placeholder="admin_gst" value={form.operatorUsername} onChange={e => setForm({...form, operatorUsername: e.target.value})} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Password</Label><Input required type="password" placeholder="••••••••" value={form.operatorPassword} onChange={e => setForm({...form, operatorPassword: e.target.value})} /></div>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Processing...</> : "Submit for Approval"}
            </Button>
          </form>
          
          <div className="text-center mt-6 text-sm text-muted-foreground">
            Already have an approved account?{" "}
            <Link to="/" className="text-primary font-medium hover:underline">
              Log in here
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}